import test from 'node:test';
import assert from 'node:assert/strict';
import { GenerationSlots } from './slotQueue.ts';

test('six requests start together, seventh waits, release transfers the permit atomically', async () => {
  const slots = new GenerationSlots(6);
  const started: number[] = [];
  const requests = Array.from({length:8}, (_,i) => slots.acquire(String(i)).then(() => started.push(i)));
  await Promise.resolve();
  assert.deepEqual(started,[0,1,2,3,4,5]);
  slots.release('0');
  slots.release('0'); // stale release cannot overbook
  await Promise.resolve();
  assert.deepEqual(started,[0,1,2,3,4,5,6]);
  slots.release('1');
  await Promise.all(requests);
  assert.deepEqual(started,[0,1,2,3,4,5,6,7]);
});
