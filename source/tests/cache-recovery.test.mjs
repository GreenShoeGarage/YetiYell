import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import {VERSION} from '../dist/core.mjs';
const dist=new URL('../dist/',import.meta.url);const wait=()=>new Promise(r=>setTimeout(r,5));
async function until(fn){for(let n=0;n<100;n++){if(fn())return;await wait();}throw Error('Recovery did not finish');}
function recovery({oldPage=false}={}){
 const dom=new JSDOM(readFileSync(new URL('refresh-app.html',dist),'utf8'),{url:'https://example.test/yetiyell/refresh-app.html',runScripts:'outside-only'}),w=dom.window;const removed=[],deleted=[],fetched=[];
 Object.defineProperty(w.navigator,'serviceWorker',{value:{getRegistrations:async()=>['https://example.test/','https://example.test/yetiyell/','https://example.test/other/'].map(scope=>({scope,unregister:async()=>removed.push(scope)}))}});
 w.caches={keys:async()=>['yetiyell-old','another-app'],open:async key=>({keys:async()=>[{url:'https://example.test/yetiyell/app.js'},{url:'https://example.test/other/app.js'}],delete:async req=>deleted.push([key,req.url])})};
 w.localStorage.setItem('yetiyell.workspace.v1','saved operator data');w.fetch=async(url,options)=>{fetched.push([url,options.cache]);return {ok:true,text:async()=>oldPage?'<html></html>':readFileSync(new URL('index.html',dist),'utf8')};};
 w.eval(w.document.querySelector('script').textContent);return {dom,w,removed,deleted,fetched};
}
test('cache recovery removes only this app scope and cached paths while preserving saved work',async()=>{
 const b=recovery(),d=b.w.document;assert.equal(d.getElementById('refresh').disabled,true);d.getElementById('closed').click();d.getElementById('refresh').click();await until(()=>!d.getElementById('open').hidden);
 assert.deepEqual(b.removed,['https://example.test/yetiyell/']);assert.deepEqual(b.deleted,[['yetiyell-old','https://example.test/yetiyell/app.js']]);assert.equal(b.w.localStorage.getItem('yetiyell.workspace.v1'),'saved operator data');assert.ok(b.fetched.every(([,cache])=>cache==='reload'));assert.ok(b.fetched.some(([url])=>url.endsWith('app-'+VERSION+'.js')));assert.match(d.getElementById('open').href,/index.html\?fresh=/);b.dom.window.close();
});
test('cache recovery reports incomplete server uploads instead of claiming success',async()=>{
 const b=recovery({oldPage:true}),d=b.w.document;d.getElementById('closed').click();d.getElementById('refresh').click();await until(()=>/not serving/.test(d.getElementById('status').textContent));assert.equal(d.getElementById('open').hidden,true);assert.equal(d.getElementById('refresh').disabled,false);assert.equal(b.w.localStorage.getItem('yetiyell.workspace.v1'),'saved operator data');b.dom.window.close();
});
