import { isPaidTool } from '../paidToolIdempotency.ts';

/**
 * failedTurnRecord — 保全被模型服务中断的 DeepSeek Harness 轮次。
 *
 * 背景：DshBridge 每轮都是全新 ACP 会话，跨轮连续性靠把 coordinator 的
 * 对话记录以文本回放注入 persona。原实现里失败轮次（如 DeepSeek 503 重试
 * 耗尽）不调用 recordHarnessTurn，导致该轮用户请求与已执行进度从后续轮
 * 的历史里整体消失——用户只能说「继续」，而模型根本不知道要继续什么。
 *
 * 这里提供两个产物：
 * 1. buildHarnessFailureRecord：写进 coordinator 历史的失败记录（下轮回放可见）
 * 2. buildCompletedStepsRunNotice：降级到内置模式接管时的当轮上下文注入
 */

export interface ToolCallDigest {
  name: string;
  summary: string;
  status: string;
  resultSummary?: string;
}

export interface StepDigest {
  status: string;
  toolCalls: ToolCallDigest[];
}

export interface HarnessTurnProgress {
  toolCallCount: number;
  completedCalls: ToolCallDigest[];
  unfinishedPaidCalls: ToolCallDigest[];
  paidCompletedCalls: ToolCallDigest[];
}

const MAX_TOTAL_CHARS = 6_000;
const MAX_RESULT_CHARS = 160;
const MAX_PAID_CALLS = 12;
const MAX_TAIL_FREE_CALLS = 15;

interface StepLike {
  status?: string;
  toolCalls?: Array<{ name?: string; summary?: string; status?: string; resultSummary?: string }>;
}

function truncate(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

export function collectHarnessTurnProgress(steps: StepLike[] | undefined): HarnessTurnProgress {
  const progress: HarnessTurnProgress = {
    toolCallCount: 0,
    completedCalls: [],
    unfinishedPaidCalls: [],
    paidCompletedCalls: [],
  };
  if (!Array.isArray(steps)) return progress;
  for (const step of steps) {
    for (const call of step.toolCalls ?? []) {
      if (typeof call.name !== 'string') continue;
      progress.toolCallCount += 1;
      const digest: ToolCallDigest = {
        name: call.name,
        summary: truncate(call.summary ?? call.name, MAX_RESULT_CHARS),
        status: call.status ?? 'unknown',
        ...(typeof call.resultSummary === 'string' && call.resultSummary
          ? { resultSummary: truncate(call.resultSummary, MAX_RESULT_CHARS) }
          : {}),
      };
      if (call.status === 'done') {
        progress.completedCalls.push(digest);
        if (isPaidTool(digest.name)) progress.paidCompletedCalls.push(digest);
      } else if (isPaidTool(digest.name)) {
        // 已启动但未确认完成的付费调用（中断/状态不明）：按最坏情况对待。
        progress.unfinishedPaidCalls.push(digest);
      }
    }
  }
  return progress;
}

/** 任一付费工具已启动即视为「付费已发生」，禁止降级重放（防重复扣费）。 */
export function harnessTurnHadPaidExecution(progress: HarnessTurnProgress): boolean {
  return progress.paidCompletedCalls.length > 0 || progress.unfinishedPaidCalls.length > 0;
}

function formatCall(call: ToolCallDigest, paid: boolean): string {
  const flag = paid ? '（付费，勿重做）' : '';
  const result = call.resultSummary ? ` → ${call.resultSummary}` : '';
  return `- ${call.name}${flag}：${call.summary}${result}`;
}

function formatCallList(calls: string[]): string | null {
  return calls.length > 0 ? calls.join('\n') : null;
}

function clampTotal(lines: string[]): string[] {
  const kept: string[] = [];
  let used = 0;
  for (const line of lines.slice(-MAX_TAIL_FREE_CALLS)) {
    if (used + line.length > MAX_TOTAL_CHARS && kept.length > 0) break;
    kept.push(line);
    used += line.length;
  }
  return kept;
}

/**
 * 失败轮次的对话记录（作为 assistant 消息写入 coordinator 历史）。
 * 下一轮回放时模型能看到：本轮请求是什么、错误是什么、哪些已完成（含付费勿重做清单）。
 */
export function buildHarnessFailureRecord(error: Error, progress: HarnessTurnProgress): string {
  const sections: string[] = [
    `（本轮因 DeepSeek 模型服务中断未完成。错误：${truncate(error.message, 200)}）`,
    '这是一条失败记录，不是给用户的正式回复。用户随后大概率会说「继续」——先读取本记录和项目目录现状，再从断点续做，不要重复已完成的（尤其已付费的）生成。',
  ];
  if (progress.toolCallCount > 0) {
    sections.push(`本轮已执行工具调用 ${progress.toolCallCount} 个（完成 ${progress.completedCalls.length} 个）。`);
  }
  const paidLines = progress.paidCompletedCalls.slice(0, MAX_PAID_CALLS).map((call) => formatCall(call, true));
  const paidList = formatCallList(paidLines);
  if (paidList) sections.push(`已付费完成的生成（绝对不要重做）：\n${paidList}`);
  if (progress.unfinishedPaidCalls.length > 0) {
    const unfinished = progress.unfinishedPaidCalls
      .slice(0, MAX_PAID_CALLS)
      .map((call) => `- ${call.name}：${call.summary}（状态：${call.status}，是否已扣费不明，续做前先核对产物与账单）`)
      .join('\n');
    sections.push(`中断时正在执行的付费调用（状态不明，先核对再决定是否重提）：\n${unfinished}`);
  }
  const freeLines = clampTotal(
    progress.completedCalls
      .filter((call) => !isPaidTool(call.name))
      .map((call) => formatCall(call, false)),
  );
  const freeList = formatCallList(freeLines);
  if (freeList) sections.push(`其余已完成步骤：\n${freeList}`);
  return sections.join('\n\n');
}

/**
 * 「内置模式接管」时的当轮注入：原 Harness 轮已完成的工作摘要。
 * 仅在没有任何付费调用启动过的轮次使用（见 routing.ts 的降级白名单）。
 */
export function buildCompletedStepsRunNotice(progress: HarnessTurnProgress): string | null {
  const completed = progress.completedCalls;
  if (completed.length === 0) return null;
  const lines = clampTotal(completed.map((call) => formatCall(call, false)));
  const list = formatCallList(lines);
  if (!list) return null;
  return [
    '[引擎切换上下文] 原执行引擎（DeepSeek Harness）已中断，由内置模式接管本轮。',
    `以下 ${completed.length} 个步骤在本轮早前已完成，直接在此基础上继续，不要重做：`,
    list,
  ].join('\n');
}
