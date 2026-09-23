/**
 * harnessSession — DeepSeek Harness 跨轮会话复用（L3）。
 *
 * 现状问题：每轮 `session/new` 起新 DSH 会话，上一轮的全部工作记忆
 * （工具调用、中间产物、推理）留在废弃的 session 文件里，跨轮只能靠
 * 文本回放（≤160K）补偿——真实场景里一次 503 中断就丢整轮上下文。
 *
 * 方案：persistenceRoot 是全局固定的（~/.kunpeng/dsh/sessions），DSH
 * 官方支持 ACP `session/resume` 跨进程恢复持久化会话。每个聊天会话
 * 记住自己的 { sessionId, workspace, model, skillSig }，下一轮先
 * resume；resume 失败自动降级为现状（新 session + 文本回放兜底）。
 *
 * 注意 resume 的硬约束（上游 dsh-acp）：cwd 必须与原 session 完全
 * 一致——所以 workspace 固定为首次创建时的值，跨天不复位。
 *
 * 注册表本身通过 localStorage 持久化（键 kunpeng-harness-sessions）：
 * DSH 会话文件在磁盘上本来就是永生的，如果映射表只在内存里，应用
 * 重启一次就把 chatSessionId → DSH sessionId 的对应关系抹掉，跨轮
 * 复用随之中断（实测：一次重启后用户说「继续」即回到纯文本回放）。
 */

/** localStorage 键：聊天会话 → DSH 会话映射，跨应用重启存活。 */
const STORAGE_KEY = 'kunpeng-harness-sessions';

/** 最小存储接口（生产用 localStorage；测试注入内存实现；node 直测时无存储）。 */
interface HarnessStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): HarnessStorage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // WKWebView 异常场景下降级为纯内存（行为等同修复前）。
  }
  return null;
}

function isRecordLike(value: unknown): value is HarnessSessionRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.sessionId === 'string' && v.sessionId.length > 0
    && typeof v.workspace === 'string' && v.workspace.length > 0
    && typeof v.model === 'string'
    && typeof v.skillSig === 'string';
}

export interface HarnessSessionRecord {
  sessionId: string;
  /** 会话创建时的 workspace（resume 硬约束：必须一致） */
  workspace: string;
  /** 创建时的 harness 模型 id（模型变化 → 新会话） */
  model: string;
  /** 技能目录签名（技能变化 → persona 变化 → 新会话） */
  skillSig: string;
}

export type HarnessSessionPlan =
  | { mode: 'resume'; sessionId: string; workspace: string; record: HarnessSessionRecord }
  | { mode: 'fresh'; workspace: string };

export interface HarnessSessionDecisionInput {
  chatSessionId: string | null | undefined;
  model: string;
  skillSig: string;
  todayWorkspace: string;
}

/**
 * 聊天会话级注册表。变更即时写入 storage；构造时回读——应用重启后
 * 「继续」仍能 resume 到磁盘上的 DSH 会话。storage 不可用时纯内存
 * （降级安全：resume 失败本就回退新会话 + 文本回放）。
 */
export class HarnessSessionRegistry {
  private readonly records = new Map<string, HarnessSessionRecord>();
  private readonly storage: HarnessStorage | null;

  constructor(storage?: HarnessStorage | null) {
    this.storage = storage === undefined ? defaultStorage() : storage;
    const raw = this.storage ? this.safeGet() : null;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed ?? {})) {
        if (isRecordLike(value)) this.records.set(key, value);
      }
    } catch {
      // 损坏的存储按空表处理（等同首次启动），不让 L3 拖垮发送链路。
    }
  }

  private safeGet(): string | null {
    try {
      return this.storage!.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  get(chatSessionId: string | null | undefined): HarnessSessionRecord | null {
    if (!chatSessionId) return null;
    return this.records.get(chatSessionId) ?? null;
  }

  record(chatSessionId: string | null | undefined, value: HarnessSessionRecord): void {
    if (!chatSessionId) return;
    this.records.set(chatSessionId, value);
    this.persist();
  }

  drop(chatSessionId: string | null | undefined): void {
    if (!chatSessionId) return;
    this.records.delete(chatSessionId);
    this.persist();
  }

  clear(): void {
    this.records.clear();
    this.persist();
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.records)));
    } catch {
      // 写失败只影响下次重启后的恢复，本轮内存态仍然正确。
    }
  }
}

/**
 * 决定本轮 harness 会话怎么开：resume 上一轮的持久化会话，还是新开。
 * 任一关键因子（模型/技能签名/注册缺失）变化都回到 fresh——fresh 的
 * 输入会拼文本回放，等价于旧行为，永远是安全兜底。
 */
export function resolveHarnessSessionPlan(
  registry: HarnessSessionRegistry,
  input: HarnessSessionDecisionInput,
): HarnessSessionPlan {
  const record = registry.get(input.chatSessionId);
  if (
    record
    && record.model === input.model
    && record.skillSig === input.skillSig
  ) {
    return { mode: 'resume', sessionId: record.sessionId, workspace: record.workspace, record };
  }
  return { mode: 'fresh', workspace: input.todayWorkspace };
}

/** 全局单例：跨 hook 实例存活；经 localStorage 跨应用重启存活。 */
export const harnessSessionRegistry = new HarnessSessionRegistry();
