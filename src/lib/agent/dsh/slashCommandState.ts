import { invoke } from '@tauri-apps/api/tauri';
import { agentLog } from '../logger';
import type { HarnessSessionRecord } from './harnessSession';
import { DshAcpClient, type AcpUpdate } from './acpClient';

/** 会话级命令状态（进程内存活；重启后回到默认，安全）。 */
class SlashCommandState {
  private readonly planModes = new Set<string>();
  private readonly goals = new Map<string, string>();

  isPlanMode(sessionId: string | null | undefined): boolean {
    return !!sessionId && this.planModes.has(sessionId);
  }

  togglePlanMode(sessionId: string | null | undefined, enable: boolean): void {
    if (!sessionId) return;
    if (enable) this.planModes.add(sessionId);
    else this.planModes.delete(sessionId);
  }

  getGoal(sessionId: string | null | undefined): string | null {
    return sessionId ? this.goals.get(sessionId) ?? null : null;
  }

  setGoal(sessionId: string | null | undefined, goal: string): void {
    if (sessionId && goal.trim()) this.goals.set(sessionId, goal.trim());
  }

  clearGoal(sessionId: string | null | undefined): void {
    if (sessionId) this.goals.delete(sessionId);
  }

  drop(sessionId: string | null | undefined): void {
    if (!sessionId) return;
    this.planModes.delete(sessionId);
    this.goals.delete(sessionId);
  }
}

export const slashCommandState = new SlashCommandState();

/** dsh_list_sessions 返回的持久化会话摘要。 */
export interface DshSessionSummaryDto {
  sessionId: string;
  cwd: string;
  createdAtMs: number;
  updatedAtMs: number;
  sizeBytes: number;
}

/** 列出磁盘上的持久化 DSH 会话（按最后活动倒序，最多 12 条）。 */
export async function listDshSessions(): Promise<DshSessionSummaryDto[]> {
  const raw = await invoke<unknown[]>('dsh_list_sessions');
  // 防御：通道契约（字段缺失/命名不符）不应炸掉 /resume 的回执渲染。
  return (Array.isArray(raw) ? raw : []).filter(
    (entry): entry is DshSessionSummaryDto =>
      !!entry
      && typeof (entry as DshSessionSummaryDto).sessionId === 'string'
      && (entry as DshSessionSummaryDto).sessionId.length > 0
      && typeof (entry as DshSessionSummaryDto).cwd === 'string',
  );
}

function formatSessionTime(ms: number): string {
  if (!ms) return '未知时间';
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSessionSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/** 渲染编号会话清单（/resume 无参数时的回执体）。 */
export function formatDshSessionList(sessions: readonly DshSessionSummaryDto[]): string[] {
  return sessions.map((session, index) => {
    const id = session.sessionId.length > 8 ? `${session.sessionId.slice(0, 8)}…` : session.sessionId;
    const when = formatSessionTime(session.updatedAtMs || session.createdAtMs);
    return `${index + 1}. \`${id}\`　${when}　${formatSessionSize(session.sizeBytes)}　${session.cwd}`;
  });
}

/** 计划模式的轮次前缀（拼在用户消息之前）。 */
export function buildPlanModePrefix(): string {
  return [
    '[计划模式]',
    '本会话处于计划模式：先探索与设计，产出一份完整、可执行的计划（目标、步骤、涉及产物、风险），',
    '呈交用户批准后再开始执行。计划批准前不要执行任何产生副作用的操作（写文件、生图、生视频、付费调用）；',
    '只读类操作（读文件、搜索）可以自由进行。用户明确批准或说「开始执行」后才切换到执行。',
  ].join('');
}

/** 长期目标的轮次前缀。 */
export function buildGoalPrefix(goal: string): string {
  return [
    '[会话长期目标]',
    `目标：${goal}`,
    '本目标跨轮次持续生效：围绕目标推进当前步骤，完成一项标记一项；所有回复都要说明当前离目标还差什么。',
  ].join('\n');
}

export interface ManualCompactResult {
  ok: boolean
  text: string;
}

/** sidecar 通道的响应信封：{ok:true, result} 或 {ok:false, error}。 */
export interface SidecarEnvelope {
  ok: boolean;
  result?: { shadowedSeqs?: number[]; shadowedTokenCount?: number };
  error?: string;
}

/**
 * 手动压缩一个持久化 DSH 会话：起临时 host 进程 → ACP resume →
 * sidecar 通道触发官方 ctx.compaction.compactNow() → 进程退出。
 * 压缩直接改写磁盘会话文件，下次 resume 即为压缩后的历史。
 * onProgress 会收到阶段性进度文本（恢复会话 / 生成摘要）。
 */
export async function compactDshSession(
  record: HarnessSessionRecord,
  credentials: { apiKey: string; baseUrl: string },
  onProgress?: (text: string) => void,
): Promise<ManualCompactResult> {
  const runId = `compact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const instanceId = 'compact';
  const onUpdate = (update: AcpUpdate) => {
    if (!onProgress) return;
    const event = update.update as Record<string, unknown>;
    if (event?.sessionUpdate === 'kunpeng_compaction') {
      if (event.phase === 'start') onProgress('已恢复会话，开始压缩……');
      else if (event.phase === 'summary') onProgress('DeepSeek 正在生成摘要（最耗时的一步）……');
    }
  };
  onProgress?.('正在启动临时 Harness 进程并恢复会话……（整体约需 20–60 秒，请勿关闭应用）');
  const client = new DshAcpClient(
    {
      runId,
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
      model: record.model,
      persona: '',
      workspace: record.workspace,
    },
    instanceId,
    onUpdate,
    record.sessionId,
  );
  try {
    const session = await client.start();
    if (!session.resumed) {
      return { ok: false, text: '未能恢复目标会话（会话可能已失效），压缩未执行。' };
    }
    const envelope = await invoke<SidecarEnvelope | string>(
      'dsh_sidecar_call',
      { runId, payload: { command: 'compact' } },
    );
    if (typeof envelope === 'string') {
      return { ok: true, text: envelope };
    }
    if (!envelope?.ok) {
      return { ok: false, text: `压缩未完成：${envelope?.error ?? '未知错误'}` };
    }
    const count = envelope.result?.shadowedSeqs?.length ?? 0;
    const tokens = envelope.result?.shadowedTokenCount ?? 0;
    return {
      ok: true,
      text: count > 0
        ? `压缩完成：已将 ${count} 条较早历史（约 ${tokens} tokens）替换为摘要。下次继续对话时自动使用压缩后的历史。`
        : '当前没有可压缩的较早历史（会话还很短，或此前已压缩过）。',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    agentLog.warn('DSH', `manual compact failed: ${message}`);
    return { ok: false, text: `压缩未完成：${message.slice(0, 200)}` };
  } finally {
    await client.dispose().catch(() => {});
  }
}
