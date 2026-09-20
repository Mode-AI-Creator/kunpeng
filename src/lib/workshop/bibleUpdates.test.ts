import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkshopData } from './types.ts';
import { patchWorkshopBibles } from './bibleUpdates.ts';

function fixture() {
  const data = patchWorkshopBibles(emptyWorkshopData('p'), {
    director: { styleIntent: '克制', cameraRules: ['保持空间'] },
    character: { rules: [{ characterId: 'a', lockedAppearance: '短发', costumeRules: ['灰衣'] }], globalRules: ['身份一致'] },
    scene: { globalRules: ['窗在北侧'] }, continuity: { propContinuity: ['钥匙在甲手中'] },
  }, 1);
  data.steps.assets.status = 'done'; data.steps.prompts.status = 'done';
  data.steps.generate.status = 'in-progress'; data.steps.handoff.status = 'pending';
  data.shots = [{shotNo:'1',description:'递钥匙',characterIds:['a'],videoPath:'/existing.mp4'}];
  return data;
}
test('partial category and field updates preserve all omitted content and existing media', () => {
  const old=fixture();
  const next=patchWorkshopBibles(old,{director:{styleIntent:'温暖'}},2);
  assert.equal(next.bibles?.director?.styleIntent,'温暖');
  assert.deepEqual(next.bibles?.director?.cameraRules,['保持空间']);
  for(const key of ['character','scene','continuity'] as const) assert.deepEqual(next.bibles?.[key],old.bibles?.[key]);
  assert.equal(next.shots,old.shots);
  assert.equal(old.bibles?.director?.styleIntent,'克制');
  assert.equal(next.steps.assets.status,'stale'); assert.equal(next.steps.prompts.status,'stale');
  assert.equal(next.steps.generate.status,'in-progress'); assert.equal(next.steps.handoff.status,'pending');
});
test('no-op and timestamp-only patches do not invalidate steps or change revision times', () => {
  const old=fixture();
  for(const patch of [{},{director:{}},{director:{updatedAt:999}},{director:{styleIntent:'克制',updatedAt:999}}]) {
    assert.equal(patchWorkshopBibles(old,patch,3),old);
  }
});
test('explicit list clear is scoped; malformed patch fails atomically', () => {
  const old=fixture();
  const next=patchWorkshopBibles(old,{director:{cameraRules:[]}},2);
  assert.deepEqual(next.bibles?.director?.cameraRules,[]);
  assert.equal(next.bibles?.director?.styleIntent,'克制');
  for(const patch of [null,[],{director:null},{director:{cameraRules:'wrong'}},{director:{styleIntent:'new'},scene:null},{other:{}}]) {
    assert.throws(()=>patchWorkshopBibles(old,patch));
    assert.equal(old.bibles?.director?.styleIntent,'克制');
    assert.equal(old.steps.assets.status,'done');
  }
});
