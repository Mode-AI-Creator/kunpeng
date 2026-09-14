import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function fixture() {
  const source = await readFile(new URL('./copywritingTools.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace(/^import[\s\S]*?;\n/gm, '');
  const url = name => JSON.stringify(new URL(`../../copywriting/${name}.ts`, import.meta.url).href);
  const setup = `import {buildCopyDocMap} from ${url('documentMap')};
    import {buildStoryReviewPacket} from ${url('storyReview')};
    import {auditCopywriting,formatWritingAuditForAgent} from ${url('qualityAudit')};
    export const doc={id:'d1',title:'测试剧本',content:'内景 厨房 夜\\n\\n'+ '女儿把车票压在碗下。'.repeat(1500),contentRevision:7};
    const useCopywritingStore={getState:()=>({activeDocId:'d1',docs:[doc]})};`;
  return import(`data:text/javascript;base64,${Buffer.from(setup+js).toString('base64')}#${Math.random()}`);
}

test('剧情审阅工具提供真实分页且不写回，拒绝失效版本和错误参数', async () => {
  const {doc,copywritingReviewDocTool:tool} = await fixture();
  const original = JSON.stringify(doc);
  const first = JSON.parse((await tool.execute({mode:'story'})).output);
  assert.equal(first.doc.contentRevision, 7);
  assert.equal(first.storyReview.source,doc.content.slice(0,first.storyReview.end));
  const start=first.storyReview.nextStart;
  assert.ok(start>0);
  assert.equal((await tool.execute({mode:'story',start})).success,false);
  assert.equal((await tool.execute({mode:'story',start,content_revision:6})).success,false);
  assert.equal((await tool.execute({mode:'story',start,content_revision:7})).success,true);
  assert.equal((await tool.execute({mode:'story',start:'bad'})).success,false);
  assert.equal((await tool.execute({mode:'bad'})).success,false);
  assert.equal((await tool.execute({doc_id:'missing'})).success,false);
  assert.equal(JSON.stringify(doc),original);
});

test('既有 style 调用向后兼容', async () => {
  const {copywritingReviewDocTool:tool} = await fixture();
  const result=await tool.execute({});
  assert.equal(result.success,true);
  assert.equal(typeof JSON.parse(result.output).qualityAudit.score,'number');
});
