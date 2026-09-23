import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deepseekBuiltinRoute,
  shouldContinueWithBuiltin,
  shouldFallbackHarnessToBuiltin,
} from './routing.ts';

test('Harness failure before visible output falls back to built-in DeepSeek', () => {
  assert.equal(shouldFallbackHarnessToBuiltin(new Error('ACP bridge disposed'), false), true);
  assert.equal(shouldFallbackHarnessToBuiltin(new Error('HTTP 503 unavailable'), false), true);
  assert.equal(shouldFallbackHarnessToBuiltin(new Error('HTTP 400 invalid request'), false), true);
});

test('Harness never restarts after output or user abort', () => {
  assert.equal(shouldFallbackHarnessToBuiltin(new Error('socket closed'), true), false);
  assert.equal(shouldFallbackHarnessToBuiltin(new DOMException('Aborted', 'AbortError'), false), false);
  const namedAbort = new Error('cancelled');
  namedAbort.name = 'AbortError';
  assert.equal(shouldFallbackHarnessToBuiltin(namedAbort, false), false);
});

test('built-in handoff preserves the DeepSeek model and disables provider fallback', () => {
  assert.deepEqual(deepseekBuiltinRoute('deepseek-v4-flash'), {
    kind: 'primary',
    providerId: 'deepseek',
    modelId: 'deepseek-v4-flash',
  });
});

const freeOnlyProgress = {
  toolCallCount: 3,
  completedCalls: [
    { name: 'read_file', summary: '读文件', status: 'done' },
    { name: 'bash', summary: '编译', status: 'done' },
  ],
  unfinishedPaidCalls: [],
  paidCompletedCalls: [],
};

const paidProgress = {
  ...freeOnlyProgress,
  paidCompletedCalls: [{ name: 'image_generate', summary: '定妆图', status: 'done' }],
};

const paidInFlightProgress = {
  ...freeOnlyProgress,
  unfinishedPaidCalls: [{ name: 'video_generate', summary: '001 镜', status: 'running' }],
};

test('continuation fallback allows free-tool turns and blocks any paid execution', () => {
  assert.equal(shouldContinueWithBuiltin(new Error('503 busy'), freeOnlyProgress), true);
  assert.equal(shouldContinueWithBuiltin(new Error('503 busy'), paidProgress), false);
  assert.equal(shouldContinueWithBuiltin(new Error('503 busy'), paidInFlightProgress), false);
  assert.equal(
    shouldContinueWithBuiltin(new DOMException('Aborted', 'AbortError'), freeOnlyProgress),
    false,
  );
});
