import type { RouteStrategy } from '../providers/router';
import type { HarnessTurnProgress } from './failedTurnRecord.ts';
import { harnessTurnHadPaidExecution } from './failedTurnRecord.ts';

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return /\babort(?:ed)?\b/i.test(error instanceof Error ? error.message : String(error ?? ''));
}

/**
 * Harness is an execution engine, not a provider fallback link. If it fails
 * before producing visible output, retry the same DeepSeek model once through
 * Kunpeng's built-in coordinator. Never hand this turn to Kimi/GLM.
 */
export function shouldFallbackHarnessToBuiltin(error: unknown, hasVisibleOutput: boolean): boolean {
  return !hasVisibleOutput && !isAbortError(error);
}

/**
 * Continuation fallback: the harness died mid-turn but the turn only ran
 * free tools (file/bash/read — no paid generation ever started). Replaying
 * through the built-in DeepSeek loop cannot double-charge in that case, and
 * the completed-steps notice keeps the model from redoing finished work.
 * Paid execution of any state (done/failed/running) still blocks fallback:
 * replaying a paid turn is forbidden by billing discipline.
 */
export function shouldContinueWithBuiltin(
  error: unknown,
  progress: HarnessTurnProgress,
): boolean {
  return !isAbortError(error) && !harnessTurnHadPaidExecution(progress);
}

export function deepseekBuiltinRoute(modelId?: string): RouteStrategy {
  return { kind: 'primary', providerId: 'deepseek', modelId };
}
