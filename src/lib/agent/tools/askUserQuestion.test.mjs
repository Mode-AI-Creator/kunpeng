import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { useAskUserStore as store } from '../../../stores/askUserStore.ts';
const questions = [{id:'q',question:'选择方案？',options:[{id:'a',label:'方案 A'},{id:'b',label:'方案 B'}],multiSelect:false}];
const meta = {sourceView:'chat',sourceSessionId:'original'};
function reset() {
  const state=store.getState();
  for(const req of [state.pending,...state.queue]) if(req) store.getState().cancel(req.id);
  store.setState({pending:null,queue:[],history:[],snoozed:false});
}
function toolFixture() {
  reset();
  const exports={};
  const chat={activeView:'canvas',currentSessionId:'changed',sessions:[]};
  const js=ts.transpileModule(readFileSync(new URL('./askUserQuestionTool.ts',import.meta.url),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  runInNewContext(js,{exports,require:name=>({
    '@/stores/askUserStore':{useAskUserStore:store},
    '@/stores/chatStore':{useChatStore:{getState:()=>chat}},
    '../headless':{isAgentHeadless:()=>false},
  })[name]});
  return exports.askUserQuestionTool;
}

test('active and queued aborts settle exactly their own promises and preserve queue order', async () => {
  reset();
  const a=new AbortController(),b=new AbortController();
  const first=store.getState().ask(questions,meta,a.signal);
  const second=store.getState().ask(questions,meta,b.signal);
  const third=store.getState().ask(questions,meta);
  const firstId=store.getState().pending.id;
  b.abort();
  assert.equal(await second,null);
  assert.equal(store.getState().pending.id,firstId);
  assert.equal(store.getState().queue.length,1);
  a.abort();
  assert.equal(await first,null);
  const next=store.getState().pending;
  assert.ok(next && next.id!==firstId);
  store.getState().submit(next.id,[{selected:['方案 B']}]);
  assert.deepEqual(await third,[{selected:['方案 B']}]);
  assert.equal(store.getState().pending,null);
});

test('stale double-submit, cancel and snooze cannot affect the next request', async () => {
  reset();
  const first=store.getState().ask(questions,meta);
  const firstId=store.getState().pending.id;
  const second=store.getState().ask(questions,meta);
  store.getState().submit(firstId,[{selected:['方案 A']}]);
  await first;
  const nextId=store.getState().pending.id;
  store.getState().submit(firstId,[{selected:['方案 A']}]);
  store.getState().cancel(firstId);
  store.getState().snooze(firstId);
  assert.equal(store.getState().pending.id,nextId);
  assert.equal(store.getState().snoozed,false);
  store.getState().cancel(nextId);
  assert.equal(await second,null);
});

test('pre-aborted request is not queued; completed request detaches abort handler', async () => {
  reset();
  const aborted=new AbortController();aborted.abort();
  assert.equal(await store.getState().ask(questions,meta,aborted.signal),null);
  assert.equal(store.getState().pending,null);
  const controller=new AbortController();let removed=0;
  const remove=controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.removeEventListener=(...args)=>{removed++;remove(...args);};
  const answer=store.getState().ask(questions,meta,controller.signal);
  store.getState().submit(store.getState().pending.id,[{selected:['方案 A']}]);
  await answer;
  assert.equal(removed,1);
  controller.abort();
  assert.equal(store.getState().history.length,1);
});

test('tool handles malformed model arguments without throwing or showing broken UI', async () => {
  const tool=toolFixture();
  for(const input of [null,{question:3,options:[]},{question:'?',options:[null,{}]},
    {question:'?',options:[{label:3},{label:'B'}]},
    {...questions[0],options:[{id:'same',label:'A'},{id:'same',label:'B'}]},
    {...questions[0],multiSelect:'false'}]) {
    const result=await tool.execute({questions:[input]});
    assert.equal(result.success,false);
    assert.equal(store.getState().pending,null);
  }
  assert.equal((await tool.execute({questions:[questions[0],questions[0]]})).success,false);
});

test('tool keeps run origin after view change, returns the answer and honors cancellation', async () => {
  const tool=toolFixture();
  const controller=new AbortController();
  const result=tool.execute({questions},controller.signal,{decisionSource:meta});
  assert.equal(store.getState().pending.sourceView,'chat');
  assert.equal(store.getState().pending.sourceSessionId,'original');
  store.getState().submit(store.getState().pending.id,[{selected:['方案 B'],freeText:'保留原图'}]);
  assert.match((await result).output,/方案 B.*保留原图/);
  const pending=tool.execute({questions},controller.signal);
  controller.abort();
  assert.equal((await pending).success,false);
  assert.equal(store.getState().pending,null);
});
