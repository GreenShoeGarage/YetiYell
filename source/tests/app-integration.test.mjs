import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';import {FIRMWARE_VERSION} from '../dist/core.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let n=0;n<100;n++){if(fn())return;await wait(5);}throw Error('State transition timed out');}
test('connected app completes a run, retains manual evidence separation, then cancels a hidden suite',async()=>{
 const data=JSON.parse(readFileSync(new URL('../dist/profiles.json',import.meta.url)));const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');const dom=new JSDOM(html,{url:'https://yetiyell.test/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,Option:dom.window.Option,isSecureContext:true});
 let controller,active=null;const commands=[];
 const send=m=>controller.enqueue(new TextEncoder().encode(JSON.stringify(m)+'\n'));
 const port={readable:new ReadableStream({start(c){controller=c;}}),writable:new WritableStream({write(bytes){const m=JSON.parse(new TextDecoder().decode(bytes));commands.push(m);
  if(m.cmd==='hello')return send({event:'hello',id:m.id,app:'YetiYell',protocol:1,chip:'esp32',board:'esp32dev',version:FIRMWARE_VERSION,catalog:data.catalog,maxDuration:120,heartbeatTimeoutMs:6000,profiles:data.profiles.map(p=>p.id)});
  send({event:'ack',id:m.id,ok:true});
  if(m.cmd==='start'){active=m;send({event:'started',run:m.run,profile:m.profile,running:true,mac:'C2:59:59:00:00:01',remainingMs:5000});}
  if(m.cmd==='stop'&&active){send({event:'stopped',run:active.run,reason:'user',running:false});active=null;}
 }}),async open(){},async close(){},async setSignals(){}};
 Object.defineProperty(globalThis,'navigator',{value:{serial:{requestPort:async()=>port}},configurable:true});globalThis.fetch=async path=>String(path).includes('profiles.json')?{ok:true,json:async()=>data}:{ok:false};
 await import('../dist/app.mjs?integration=1');await until(()=>document.querySelectorAll('.profile-option').length===42);
 document.getElementById('connectButton').click();await until(()=>document.getElementById('connectionStatus').textContent==='Connected');assert.equal(document.getElementById('startButton').disabled,false);
 document.getElementById('startButton').click();await until(()=>active);const first=active;send({event:'stopped',run:first.run,reason:'complete',running:false});active=null;
 await until(()=>JSON.parse(localStorage.getItem('yetiyell.workspace.v1')).runs[0]?.state==='completed');let w=JSON.parse(localStorage.getItem('yetiyell.workspace.v1'));assert.equal(w.runs[0].observed,'');assert.equal(w.runs[0].verdict,'unreviewed');assert.ok(w.runs[0].startedAt);assert.ok(w.runs[0].endedAt);
 document.getElementById('smokeSuite').click();document.getElementById('suiteGap').value=1;document.getElementById('runSuite').click();await until(()=>active);assert.equal(document.getElementById('startButton').disabled,true);
 Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new dom.window.Event('visibilitychange'));
 await until(()=>JSON.parse(localStorage.getItem('yetiyell.workspace.v1')).sessions[0]?.state==='cancelled');await until(()=>!active);await wait(30);w=JSON.parse(localStorage.getItem('yetiyell.workspace.v1'));assert.equal(w.runs.length,2);assert.equal(w.runs[1].state,'stopped');assert.equal(w.sessions[0].cursor,0);assert.equal(commands.filter(x=>x.cmd==='start').length,2);
 await until(()=>!document.getElementById('connectButton').disabled);document.getElementById('connectButton').click();await until(()=>document.getElementById('connectionStatus').textContent==='Not connected');dom.window.close();
});
