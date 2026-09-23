import type { AgentUserContentBlock, CoordinatorCallbacks } from '../types';
import type { ToolRegistry } from '../toolRegistry';

export interface DshStartOptions {
  runId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  persona: string;
  workspace: string;
  maxTokens?: number;
  contextWindow?: number;
  httpProxy?: string;
  httpsProxy?: string;
}

export interface DshRunOptions extends DshStartOptions {
  input: string;
  mediaBlocks?: AgentUserContentBlock[];
  toolRegistry: ToolRegistry;
  callbacks: CoordinatorCallbacks;
  signal?: AbortSignal;
  /** 上一轮持久化会话 id：存在时优先 session/resume，失败降级 session/new。 */
  resumeSessionId?: string;
}

export interface DshRunResult {
  text: string;
  thinking: string;
  visibleOutput: boolean;
  stopReason?: string;
  /** 本轮实际使用的 ACP 会话 id（resume 与新建都会返回）。 */
  sessionId: string;
  /** true = 恢复了上一轮会话（历史已在 DSH 内，无需文本回放）。 */
  resumed: boolean;
}

export interface DshAcpLineEvent {
  runId: string;
  instanceId: string;
  line: string;
}

export interface DshHarnessEvent {
  runId: string;
  instanceId: string;
  event: Record<string, unknown>;
}

export interface DshToolCallEvent {
  runId: string;
  instanceId: string;
  requestId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface DshToolCancelEvent {
  runId: string;
  instanceId: string;
  requestId: string;
}

export type AcpContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource_link'; uri: string; name: string; mimeType?: string };
