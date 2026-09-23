import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import type { AgentUserContentBlock } from '../types';
import { agentLog } from '../logger';
import { buildAcpPromptContent } from './mediaFilter.ts';
import type { DshAcpLineEvent, DshHarnessEvent, DshStartOptions } from './types';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: number;
  /** 静默超时续期（仅 session/prompt）：重新武装计时器，返回新句柄。 */
  rearm?: () => number;
}

/**
 * session/prompt 的静默超时窗口。一轮 agent 任务可以合法运行数小时
 * （串联多个 toolCallTimeoutMs=30 分钟的付费工具调用），因此不设墙钟
 * 上限，只有「完全没有通道活动」达到该窗口才判死。窗口必须大于单个
 * 工具调用上限（30 分钟），为静默的长思考留出缓冲。
 */
const PROMPT_INACTIVITY_MS = 45 * 60 * 1000;

export interface AcpUpdate {
  sessionId: string;
  update: Record<string, unknown>;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

let warnedDroppedMedia = false;

export class DshAcpClient {
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private unlisten: UnlistenFn[] = [];
  private started = false;
  private closed = false;
  private sessionId: string | null = null;
  private stderr = '';
  private channelError: Error | null = null;

  constructor(
    private readonly options: DshStartOptions,
    private readonly instanceId: string,
    private readonly onUpdate: (update: AcpUpdate) => void,
    private readonly resumeSessionId?: string,
  ) {}

  /** 本轮已建立的 ACP 会话 id（失败轮也保留，供下轮 resume 磁盘恢复）。 */
  getSessionId(): string | null {
    return this.sessionId;
  }

  async start(): Promise<{ sessionId: string; resumed: boolean }> {
    if (this.started) throw new Error('DeepSeek Harness ACP 客户端已启动');
    this.unlisten.push(await listen<DshAcpLineEvent>('dsh-acp-line', ({ payload }) => {
      if (payload.runId !== this.options.runId || payload.instanceId !== this.instanceId) return;
      this.handleLine(payload.line);
    }));
    this.unlisten.push(await listen<DshHarnessEvent>('dsh-harness-event', ({ payload }) => {
      if (payload.runId !== this.options.runId || payload.instanceId !== this.instanceId || !payload.event || this.closed) return;
      this.touchActivity();
      this.onUpdate({ sessionId: this.sessionId || '', update: payload.event });
    }));
    this.unlisten.push(await listen<DshAcpLineEvent>('dsh-acp-stderr', ({ payload }) => {
      if (payload.runId !== this.options.runId || payload.instanceId !== this.instanceId) return;
      this.touchActivity();
      this.stderr = `${this.stderr}\n${payload.line}`.trim().slice(-5000);
    }));
    this.unlisten.push(await listen<DshAcpLineEvent>('dsh-acp-closed', ({ payload }) => {
      if (payload.runId !== this.options.runId || payload.instanceId !== this.instanceId || this.closed) return;
      this.channelError = new Error(this.stderr || payload.line || 'DeepSeek Harness 已关闭');
      this.rejectAll(this.channelError);
    }));
    await invoke('dsh_start', { request: { ...this.options, instanceId: this.instanceId } });
    this.started = true;
    await this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: 'kunpeng', version: '1.0.0' },
    });
    if (this.resumeSessionId) {
      try {
        // wire 契约：成功返回 { configOptions }，sessionId 即请求传入值
        // （上游原样恢复该会话）；任何失败以 JSON-RPC error 形式抛出。
        await this.request('session/resume', {
          sessionId: this.resumeSessionId,
          cwd: this.options.workspace,
          mcpServers: [],
        });
        this.sessionId = this.resumeSessionId;
        return { sessionId: this.sessionId, resumed: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // resume 失败（会话不存在 / cwd 不匹配 / 中断态不可恢复等）不是
        // 致命错误：降级为新会话，文本回放兜底由调用方负责。
        agentLog.warn('DSH', `session/resume 降级为新会话: ${message}`);
      }
    }
    const session = await this.request('session/new', {
      cwd: this.options.workspace,
      mcpServers: [],
    }) as { sessionId?: string };
    if (!session?.sessionId) throw new Error('DeepSeek Harness 未返回 ACP sessionId');
    this.sessionId = session.sessionId;
    return { sessionId: this.sessionId, resumed: false };
  }

  async prompt(text: string, mediaBlocks: AgentUserContentBlock[] = []): Promise<{ stopReason?: string }> {
    if (!this.sessionId) throw new Error('DeepSeek Harness 会话尚未建立');
    // dsh-acp rejects image prompt blocks with invalidParams before any model
    // call; mediaFilter drops them so a stray image can never kill the turn.
    const prompt = buildAcpPromptContent(mediaBlocks, () => {
      if (warnedDroppedMedia) return;
      warnedDroppedMedia = true;
      agentLog.warn('DSH', 'Dropped unsupported media block: ACP accepts native images; use analysis tools for video');
    });
    prompt.push({ type: 'text', text });
    return this.request('session/prompt', { sessionId: this.sessionId, prompt }) as Promise<{ stopReason?: string }>;
  }

  async cancel(): Promise<void> {
    if (this.sessionId && this.started && !this.closed) {
      await this.notify('session/cancel', { sessionId: this.sessionId }).catch(() => {});
    }
  }

  async dispose(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.rejectAll(new DOMException('Aborted', 'AbortError'));
    await invoke('dsh_stop', { runId: this.options.runId, instanceId: this.instanceId }).catch(() => {});
    for (const stop of this.unlisten.splice(0)) stop();
  }

  private async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (this.closed) throw new Error('DeepSeek Harness ACP 客户端已关闭');
    // The ACP child can close between two JSON-RPC calls. Without a sticky
    // channel state, a close event that arrives before the next request has no
    // pending promise to reject, and that next request waits until the generic
    // 30-minute timeout. Fail synchronously with the already-redacted stderr.
    if (this.channelError) throw this.channelError;
    const id = this.nextId++;
    // 一次性握手类请求 90 秒固定超时；session/prompt 是一整轮 agent 任务
    // （可以串联多个长付费工具调用），不能按墙钟掐断——改为静默超时：
    // 期间任何 ACP 通道活动（模型输出分片、工具事件、host stderr）都会
    // 续期，只有连续 PROMPT_INACTIVITY_MS 无声才中止。
    const isPrompt = method === 'session/prompt';
    const timeoutMs = isPrompt ? PROMPT_INACTIVITY_MS : 90 * 1000;
    const promise = new Promise<unknown>((resolve, reject) => {
      const arm = () => window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(isPrompt
          ? `DeepSeek Harness 会话轮次已中止：连续 ${Math.round(PROMPT_INACTIVITY_MS / 60000)} 分钟没有任何模型输出或工具活动`
          : `DeepSeek Harness ACP 请求超时: ${method}`));
      }, timeoutMs);
      const timeout = arm();
      this.pending.set(id, { resolve, reject, timeout, rearm: isPrompt ? arm : undefined });
    });
    try {
      await this.send({ jsonrpc: '2.0', id, method, params });
    } catch (error) {
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.delete(id);
        window.clearTimeout(pending.timeout);
        pending.reject(asError(error));
      }
    }
    return promise;
  }

  private notify(method: string, params: Record<string, unknown>): Promise<void> {
    return this.send({ jsonrpc: '2.0', method, params });
  }

  private send(message: Record<string, unknown>): Promise<void> {
    if (this.channelError) return Promise.reject(this.channelError);
    return invoke('dsh_send', {
      runId: this.options.runId,
      instanceId: this.instanceId,
      message: JSON.stringify(message),
    });
  }

  private handleLine(line: string): void {
    if (this.closed) return;
    this.touchActivity();
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    // JSON-RPC allows string ids. The current @agentclientprotocol/sdk uses
    // numbers, but a server-side change to string ids must not wedge us: an
    // unanswered session/request_permission hangs the whole tool call.
    const id = (typeof message.id === 'number' || typeof message.id === 'string') ? message.id : null;
    if (id !== null && !message.method) {
      const pending = typeof id === 'number' ? this.pending.get(id) : undefined;
      if (!pending) return;
      this.pending.delete(id as number);
      window.clearTimeout(pending.timeout);
      if (message.error) {
        const error = message.error as { message?: string };
        pending.reject(new Error(error.message || 'DeepSeek Harness ACP 请求失败'));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message.method === 'session/update') {
      const params = message.params as AcpUpdate | undefined;
      if (params?.update) this.onUpdate(params);
      return;
    }
    if (id !== null && message.method === 'session/request_permission') {
      const params = message.params as { options?: Array<{ kind?: string; optionId?: string }> };
      const selected = params.options?.find((option) => option.kind === 'allow_once') ?? params.options?.[0];
      void this.send({
        jsonrpc: '2.0',
        id,
        result: selected?.optionId
          ? { outcome: { outcome: 'selected', optionId: selected.optionId } }
          : { outcome: { outcome: 'cancelled' } },
      });
    }
  }

  /** 任何 ACP 通道活动都证明 host 存活：为静默超时中的请求续期。 */
  private touchActivity(): void {
    for (const pending of this.pending.values()) {
      if (!pending.rearm) continue;
      window.clearTimeout(pending.timeout);
      pending.timeout = pending.rearm();
    }
  }

  private rejectAll(error: unknown): void {
    const normalized = asError(error);
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timeout);
      pending.reject(normalized);
    }
    this.pending.clear();
  }
}
