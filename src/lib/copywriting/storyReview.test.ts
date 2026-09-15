import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryReviewPacket } from './storyReview.ts';
import { auditCopywriting } from './qualityAudit.ts';
import { buildCopywritingTaskHarness } from './antiAiStyle.ts';

test('长稿分页无遗漏，包含连续大段和中文/emoji，证据必须可回溯原文', () => {
  const text = '# 第一场 内景 老屋 夜\n\n'+ '母亲把钥匙放回抽屉。'.repeat(2000) + '🌙\n\n# 第二场 外景 车站 日\n\n女儿推回了车票。';
  let start = 0, collected = '', pages = 0;
  while (true) {
    const packet = buildStoryReviewPacket(text, start);
    assert.equal(packet.status, 'requires_model_review');
    assert.ok(packet.end > start);
    collected += packet.source;
    for (const evidence of packet.evidence) {
      assert.equal(evidence.text, text.slice(evidence.sourceStart, evidence.sourceEnd));
      assert.match(evidence.blockId, /^B\d+$/);
    }
    pages++;
    if (packet.nextStart === null) break;
    start = packet.nextStart;
  }
  assert.ok(pages > 1);
  assert.equal(collected, text);
});

test('空稿、越界和非整数游标不伪造审阅', () => {
  assert.equal(buildStoryReviewPacket('').status, 'empty');
  for (const offset of [-1, 0.5, NaN, Infinity, 5]) assert.throws(() => buildStoryReviewPacket('abc', offset));
  const packet = buildStoryReviewPacket('妈妈：钥匙呢？\n女儿：我放门口了。');
  assert.equal(packet.completeDocument, true);
  assert.equal('score' in packet, false);
});

test('剧本里的正常对立句、破折号与道具重复只作提示，不触发改写', () => {
  const text = '# 第一场 内景 厨房 夜\n\n妈妈：不是我不让你走，是末班车已经停了。\n\n女儿：你——\n\n妈妈捏紧钥匙，把钥匙塞进信封。女儿抽走钥匙。';
  const audit = auditCopywriting(text);
  assert.equal(audit.kind, 'screenplay');
  assert.equal(audit.blockerCount, 0);
  assert.notEqual(audit.grade, 'rewrite');
  assert.ok(audit.issues.length > 0);
  assert.ok(audit.issues.every(issue => issue.severity === 'note'));
});

test('Fountain 代码块仍被审阅，广告保留原有机械规则', () => {
  assert.ok(auditCopywriting('```fountain\nINT. ROOM - NIGHT\n妈妈：不是你，是我。\n```').charCount > 0);
  assert.equal(auditCopywriting('品牌不是产品，而是生活方式。').blockerCount, 1);
});

test('故事和英文编剧请求进入专用方法，普通商业文案不会误入', () => {
  for (const task of ['续写这个故事', '写一季短剧', '帮我写 logline', 'screenwriting', '优化对白']) {
    assert.match(buildCopywritingTaskHarness(task), /编剧方法/);
  }
  assert.doesNotMatch(buildCopywritingTaskHarness('写一个洗衣液卖点'), /## 编剧方法/);
});
