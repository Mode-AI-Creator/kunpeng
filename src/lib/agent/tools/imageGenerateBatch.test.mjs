import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { GenerationSlots } from '../../canvasGen/slotQueue.ts';
import { PaidToolIdempotencyGate } from '../paidToolIdempotency.ts';
function fixture(execute) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(new URL('./imageGenerateBatchTool.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  runInNewContext(js,{exports,require:name => name.includes('slotQueue') ? {GenerationSlots} : {imageGenerateTool:{definition:{parameters:{}},execute}}});
  return exports.imageGenerateBatchTool;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('real batch entry starts six paid submissions before any finishes; keeps order and partial results', async () => {
  const releases = [];
  const calls = [];
  const tool = fixture(job => new Promise((resolve,reject) => {
    calls.push(job.prompt);
    releases.push(() => job.prompt === '2' ? reject(new Error('invalid provider response')) : resolve({success:true,output:job.prompt,media:[{type:'image'}]}));
  }));
  const params = {jobs:Array.from({length:8},(_,i) => ({prompt:String(i)}))};
  const resultPromise = tool.execute(params);
  await tick();
  assert.deepEqual(calls,['0','1','2','3','4','5']);
  releases[0](); releases[1]();
  await tick();
  assert.deepEqual(calls,['0','1','2','3','4','5','6','7']);
  releases.slice(2).forEach(release=>release());
  const result = await resultPromise;
  assert.equal(result.success,false);
  assert.equal(result.terminal,true);
  assert.equal(result.media.length,7);
  assert.match(result.output,/任务 8：7/);
  const gate = new PaidToolIdempotencyGate();
  gate.record('run','image_generate_batch',params,result);
  assert.ok(gate.check('run','image_generate_batch',params));
});
test('invalid batch and duplicate destinations submit nothing', async () => {
  let calls=0;
  const tool=fixture(async()=>{calls++;return {success:true,output:''};});
  for(const jobs of [[{prompt:'a'},null],[{prompt:'a',output_path:'/x'},{prompt:'b',output_path:'/x'}],[]]) {
    assert.equal((await tool.execute({jobs})).success,false);
  }
  assert.equal(calls,0);
});
test('abort skips waiting jobs without replaying already submitted requests', async () => {
  const ac=new AbortController(); let calls=0;
  const tool=fixture(async()=>{calls++; ac.abort(); return {success:true,output:'submitted'};});
  const result=await tool.execute({jobs:Array.from({length:8},()=>({prompt:'a'}))},ac.signal);
  assert.equal(calls,1);
  assert.equal(result.success,false);
});
