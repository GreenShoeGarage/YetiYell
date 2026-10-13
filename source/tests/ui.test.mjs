import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';
test('DOM interactions: profile selection, filtering, result import visibility, and navigation',async()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');const dom=new JSDOM(html,{url:'https://yetiyell.test/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,isSecureContext:true,Option:dom.window.Option});
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 const data=JSON.parse(readFileSync(new URL('../dist/profiles.json',import.meta.url)));
 globalThis.fetch=async path=>{if(String(path).includes('profiles.json'))return {ok:true,json:async()=>data};return {ok:false};};
 await import('../dist/app.mjs?test=1');await new Promise(r=>setTimeout(r,100));
 assert.equal(document.querySelectorAll('.profile-option').length,42);
 document.querySelector('[data-tab=operate]').click();assert.equal(document.getElementById('operate').hidden,false);
 document.querySelector('[data-filter=negative]').click();assert.equal(document.querySelectorAll('.profile-option').length,7);
 document.querySelector('.profile-option').click();assert.equal(document.getElementById('expectedType').textContent,'NO MATCH');
 assert.equal(document.getElementById('startButton').disabled,true);assert.equal(document.getElementById('flashButton').disabled,true);
 const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);
 document.querySelector('[data-tab=results]').click();assert.equal(document.getElementById('resultsEmpty').hidden,false);
 document.querySelector('[data-tab=suites]').click();document.getElementById('smokeSuite').click();assert.equal(document.querySelectorAll('#suiteSteps li').length,4);document.getElementById('saveSuite').click();await new Promise(r=>setTimeout(r,10));assert.equal(JSON.parse(localStorage.getItem('yetiyell.workspace.v1')).suites.length,1);assert.equal(document.getElementById('runSuite').disabled,true);
 dom.window.close();
});
