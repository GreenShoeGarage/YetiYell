import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync,existsSync} from 'node:fs';
test('offline worker caches complete local assets and only activates an update on request',async()=>{
 const handlers={},cached=new Map(),calls=[];let activated=0;
 const context={URL,Request,self:{location:{href:'https://example.test/lab/sw.js'},clients:{claim:async()=>{}},addEventListener:(k,f)=>handlers[k]=f,skipWaiting:async()=>activated++},caches:{open:async key=>({addAll:async urls=>{calls.push(key);for(const request of urls){assert.equal(request.cache,'reload');const url=request.url;const path=new URL(url).pathname.replace('/lab/','');assert.ok(existsSync(new URL('../dist/'+path,import.meta.url)),path);cached.set(url,{status:200});}},match:async request=>cached.get(typeof request==='string'?request:request.url)})},fetch:async()=>{throw Error('Network should not be used for cached assets');}};
 vm.runInNewContext(readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8'),context);let task;handlers.install({waitUntil:p=>task=p});await task;assert.equal(activated,0);assert.ok(cached.size>=35);
 let recoveryHandled=false;handlers.fetch({request:{method:'GET',url:'https://example.test/lab/refresh-app.html'},respondWith:()=>recoveryHandled=true});assert.equal(recoveryHandled,false);
 let response;handlers.fetch({request:{method:'GET',url:'https://example.test/lab/firmware/esp32s3/firmware.bin'},respondWith:p=>response=p});assert.equal((await response).status,200);
 let reply;handlers.message({data:{type:'CACHE_ALL'},ports:[{postMessage:x=>reply=x}],waitUntil:p=>task=p});await task;assert.equal(reply.ok,true);assert.equal(calls.length,1);
 cached.delete('https://example.test/lab/core.mjs');handlers.message({data:{type:'CACHE_ALL'},ports:[{postMessage:x=>reply=x}],waitUntil:p=>task=p});await task;assert.equal(reply.ok,false);
 handlers.message({data:{type:'APPLY_UPDATE'},waitUntil:p=>task=p});await task;assert.equal(activated,1);
});
