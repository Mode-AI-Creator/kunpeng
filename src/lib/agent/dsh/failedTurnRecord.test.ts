import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompletedStepsRunNotice,
  buildHarnessFailureRecord,
  collectHarnessTurnProgress,
  harnessTurnHadPaidExecution,
} from './failedTurnRecord.ts';

const freeSteps = [
  {
    status: 'done',
    toolCalls: [
      { name: 'read_file', summary: '读取 remix_dialogue.py', status: 'done', resultSummary: '120 行脚本' },
      { name: 'bash', summary: '编译 kp_tracks', status: 'done' },
    ],
  },
];

const paidSteps = [
  {
    status: 'done',
    toolCalls: [
      { name: 'image_generate', summary: '生成 A-01 定妆图', status: 'done', resultSummary: '/ws/a-01.png' },
      { name: 'video_generate', summary: '生成 001 镜视频', status: 'running' },
    ],
  },
];

test('collectHarnessTurnProgress 统计完成/付费/未完成付费调用', () => {
  const progress = collectHarnessTurnProgress(paidSteps);
  assert.equal(progress.toolCallCount, 2);
  assert.equal(progress.completedCalls.length, 1);
  assert.equal(progress.paidCompletedCalls.length, 1);
  assert.equal(progress.unfinishedPaidCalls.length, 1);
  assert.equal(harnessTurnHadPaidExecution(progress), true);
});

test('纯免费工具轮次不算付费执行', () => {
  const progress = collectHarnessTurnProgress(freeSteps);
  assert.equal(harnessTurnHadPaidExecution(progress), false);
});

test('collectHarnessTurnProgress 容忍空输入', () => {
  assert.deepEqual(collectHarnessTurnProgress(undefined), {
    toolCallCount: 0,
    completedCalls: [],
    unfinishedPaidCalls: [],
    paidCompletedCalls: [],
  });
});

test('buildHarnessFailureRecord 含付费勿重做清单与错误信息', () => {
  const progress = collectHarnessTurnProgress(paidSteps);
  const record = buildHarnessFailureRecord(new Error('DeepSeek Harness ACP 请求失败: 503 Service is too busy'), progress);
  assert.match(record, /503 Service is too busy/);
  assert.match(record, /image_generate（付费，勿重做）/);
  assert.match(record, /\/ws\/a-01\.png/);
  assert.match(record, /video_generate/);
  assert.match(record, /状态不明/);
});

test('buildHarnessFailureRecord 无付费时不含付费清单', () => {
  const progress = collectHarnessTurnProgress(freeSteps);
  const record = buildHarnessFailureRecord(new Error('x'), progress);
  assert.doesNotMatch(record, /付费，勿重做/);
  assert.match(record, /read_file/);
});

test('buildCompletedStepsRunNotice 输出接管上下文', () => {
  const progress = collectHarnessTurnProgress(freeSteps);
  const notice = buildCompletedStepsRunNotice(progress);
  assert.match(notice ?? '', /引擎切换上下文/);
  assert.match(notice ?? '', /read_file/);
  assert.match(notice ?? '', /不要重做/);
});

test('buildCompletedStepsRunNotice 无完成步骤时返回 null', () => {
  const progress = collectHarnessTurnProgress([{ status: 'done', toolCalls: [{ name: 'bash', summary: 's', status: 'running' }] }]);
  assert.equal(buildCompletedStepsRunNotice(progress), null);
});

test('摘要截断防止失败记录膨胀', () => {
  const big = {
    status: 'done',
    toolCalls: Array.from({ length: 60 }, (_, i) => ({
      name: 'bash',
      summary: `步骤 ${i} ${'x'.repeat(300)}`,
      status: 'done',
      resultSummary: 'y'.repeat(400),
    })),
  };
  const progress = collectHarnessTurnProgress([big]);
  const record = buildHarnessFailureRecord(new Error('boom'), progress);
  assert.ok(record.length < 8000, `record length ${record.length}`);
});
