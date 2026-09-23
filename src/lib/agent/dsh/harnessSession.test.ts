import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HarnessSessionRegistry,
  resolveHarnessSessionPlan,
} from './harnessSession.ts';

const baseInput = {
  chatSessionId: 'agent:main:abc',
  model: 'deepseek-flash',
  skillSig: 'sig-1',
  todayWorkspace: '/ws/2026-09-21',
};

const record = {
  sessionId: 'dsh-session-1',
  workspace: '/ws/2026-09-20',
  model: 'deepseek-flash',
  skillSig: 'sig-1',
};

test('registry round-trips per chat session', () => {
  const registry = new HarnessSessionRegistry();
  assert.equal(registry.get(baseInput.chatSessionId), null);
  registry.record(baseInput.chatSessionId, record);
  assert.deepEqual(registry.get(baseInput.chatSessionId), record);
  registry.drop(baseInput.chatSessionId);
  assert.equal(registry.get(baseInput.chatSessionId), null);
});

test('registry ignores null/empty session ids', () => {
  const registry = new HarnessSessionRegistry();
  registry.record(null, record);
  registry.record('', record);
  assert.equal(registry.get(null), null);
  registry.drop(undefined);
  assert.doesNotThrow(() => registry.clear());
});

test('plan resumes when model and skill signature match', () => {
  const registry = new HarnessSessionRegistry();
  registry.record(baseInput.chatSessionId, record);
  const plan = resolveHarnessSessionPlan(registry, baseInput);
  assert.equal(plan.mode, 'resume');
  if (plan.mode === 'resume') {
    assert.equal(plan.sessionId, 'dsh-session-1');
    assert.equal(plan.workspace, '/ws/2026-09-20');
  }
});

test('plan falls back to fresh on model or skill signature change', () => {
  const registry = new HarnessSessionRegistry();
  registry.record(baseInput.chatSessionId, record);
  for (const override of [{ model: 'deepseek-v4' }, { skillSig: 'sig-2' }]) {
    const plan = resolveHarnessSessionPlan(registry, { ...baseInput, ...override });
    assert.equal(plan.mode, 'fresh');
    if (plan.mode === 'fresh') assert.equal(plan.workspace, baseInput.todayWorkspace);
  }
});

test('plan is fresh without a registry record', () => {
  const registry = new HarnessSessionRegistry();
  const plan = resolveHarnessSessionPlan(registry, baseInput);
  assert.equal(plan.mode, 'fresh');
});

test('resume keeps the original workspace across days (cwd hard constraint)', () => {
  const registry = new HarnessSessionRegistry();
  registry.record(baseInput.chatSessionId, record);
  const plan = resolveHarnessSessionPlan(registry, {
    ...baseInput,
    todayWorkspace: '/ws/2026-09-30',
  });
  assert.equal(plan.mode, 'resume');
  if (plan.mode === 'resume') assert.equal(plan.workspace, '/ws/2026-09-20');
});

/** 内存假存储：模拟 localStorage 跨实例（应用重启）存活。 */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    snapshot: () => Object.fromEntries(map),
  };
}

test('registry survives app restart via storage round-trip', () => {
  const storage = fakeStorage();
  const before = new HarnessSessionRegistry(storage);
  before.record(baseInput.chatSessionId, record);
  // 模拟应用重启：同一 storage 构造出的新实例必须还原映射。
  const after = new HarnessSessionRegistry(storage);
  assert.deepEqual(after.get(baseInput.chatSessionId), record);
  const plan = resolveHarnessSessionPlan(after, baseInput);
  assert.equal(plan.mode, 'resume');
  // drop 也要落盘：重启后不得复活。
  after.drop(baseInput.chatSessionId);
  const restarted = new HarnessSessionRegistry(storage);
  assert.equal(restarted.get(baseInput.chatSessionId), null);
});

test('registry tolerates corrupted or malformed storage', () => {
  const broken = new HarnessSessionRegistry({ getItem: () => '{not json', setItem: () => {} });
  assert.equal(broken.get(baseInput.chatSessionId), null);
  const malformed = new HarnessSessionRegistry({
    getItem: () => JSON.stringify({ bad: { sessionId: 1 }, [baseInput.chatSessionId]: record }),
    setItem: () => {},
  });
  assert.equal(malformed.get('bad'), null);
  assert.deepEqual(malformed.get(baseInput.chatSessionId), record);
});
