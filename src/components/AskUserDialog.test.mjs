import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const root=fileURLToPath(new URL('../../',import.meta.url));
function chromium() {
  if(process.env.BROWSER_BIN) return process.env.BROWSER_BIN;
  const base=path.join(root,'.local-browsers/chromium');
  if(existsSync(base)) for(const version of readdirSync(base)) {
    for(const suffix of ['chrome-mac/Chromium.app/Contents/MacOS/Chromium','chrome-linux/chrome','chrome-win/chrome.exe']) {
      const candidate=path.join(base,version,suffix);if(existsSync(candidate))return candidate;
    }
  }
  throw Error('Set BROWSER_BIN to a test Chromium executable');
}

test('real React card survives snooze/resume and sends multi-question/custom answers without leaking to next request', {timeout:60000}, async () => {
  const bundle=await build({stdin:{contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {AskUserDecisionCard} from './src/components/AskUserDialog';
    import {useAskUserStore as store} from './src/stores/askUserStore';
    window.answers=[];window.ask=questions=>{store.getState().ask(questions,{sourceView:'chat',sourceSessionId:'test'}).then(a=>window.answers.push(a));};
    window.snapshot=()=>({pending:store.getState().pending?.id,queue:store.getState().queue.length,snoozed:store.getState().snoozed});
    function App(){const req=store(s=>s.pending);return <><div contentEditable id="editor" suppressContentEditableWarning>草稿</div>{req&&<AskUserDecisionCard request={req}/>}</>};
    createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
  `,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"'}});
  const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/test.js'?'application/javascript':'text/html');res.end(req.url==='/test.js'?bundle.outputFiles[0].text:'<div id="root"></div><script src="/test.js"></script>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await puppeteer.launch({executablePath:chromium(),headless:true,args:['--no-sandbox'],defaultViewport:{width:900,height:900}});
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>typeof window.ask==='function');
    await page.evaluate(()=>{
      const options=[{id:'a',label:'方案 A'},{id:'b',label:'方案 B'}];
      window.ask([{id:'q1',question:'选哪些？',options,multiSelect:true},{id:'q2',question:'补充要求？',options,multiSelect:false,allowCustom:true}]);
      window.ask([{id:'q3',question:'下一组问题？',options,multiSelect:false}]);
    });
    const click=async text=>{const button=await page.waitForSelector(`::-p-xpath(//button[contains(., '${text}')])`);await button.click();};
    await click('方案 A');await click('方案 B');await click('稍后');
    await page.waitForFunction(()=>window.snapshot().snoozed);
    await click('继续回答');await click('下一步');
    await click('都不合适');await page.type('textarea','保留中文对白');
    await click('稍后');await click('继续回答');
    assert.equal(await page.$eval('textarea',e=>e.value),'保留中文对白');
    await click('按此回答继续');
    await page.waitForFunction(()=>window.answers.length===1);
    const answers=await page.evaluate(()=>window.answers[0]);
    assert.deepEqual(answers[0].selected,['方案 A','方案 B']);
    assert.equal(answers[1].freeText,'保留中文对白');
    await page.waitForSelector('h3');
    assert.equal(await page.$eval('h3',e=>e.textContent),'下一组问题？');
    assert.equal(await page.$eval('button:disabled',e=>e.textContent.trim()),'确认选择并继续');
    // Typing in a separate editable surface must not select the question's numbered choice.
    await page.focus('#editor');await page.keyboard.type('1');
    assert.equal(await page.$eval('button:disabled',e=>e.textContent.trim()),'确认选择并继续');
    await click('方案 B');
    await page.focus('#editor');await page.keyboard.down('Control');await page.keyboard.press('Enter');await page.keyboard.up('Control');
    assert.equal(await page.evaluate(()=>window.answers.length),1);
    await click('采用');
    await page.waitForFunction(()=>window.answers.length===2);
    assert.deepEqual(await page.evaluate(()=>window.answers[1][0].selected),['方案 B']);
    assert.deepEqual(errors,[]);
  } finally {
    await browser?.close();await new Promise(resolve=>server.close(resolve));
  }
});
