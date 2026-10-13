import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {loadRelease} from '../dist/flasher.mjs';import {md5} from '../dist/vendor/esptool.bundle.mjs';
test('browser flasher loads verified binaries and refuses altered firmware bytes',async()=>{
 const base=new URL('../dist/',import.meta.url);let corrupt=false;
 globalThis.fetch=async path=>{const b=readFileSync(new URL(path,base));if(String(path).endsWith('.json'))return {ok:true,json:async()=>JSON.parse(b)};const bytes=new Uint8Array(b);if(corrupt&&String(path).endsWith('/firmware.bin'))bytes[100]^=1;return {ok:true,arrayBuffer:async()=>bytes.buffer};};
 assert.equal((await loadRelease()).files.length,4);corrupt=true;await assert.rejects(loadRelease(),/integrity check failed/);
 assert.equal(md5(new TextEncoder().encode('abc')),'900150983cd24fb0d6963f7d28e17f72');
});
test('all three board manifests load, and swapping target manifests is rejected',async()=>{
 const base=new URL('../dist/',import.meta.url);let swap=false;
 globalThis.fetch=async path=>{const target=swap&&String(path).endsWith('manifest.json')?'./firmware/manifest.json':path;const b=readFileSync(new URL(target,base));return String(path).endsWith('.json')?{ok:true,json:async()=>JSON.parse(b)}:{ok:true,arrayBuffer:async()=>new Uint8Array(b).buffer};};
 for(const id of ['esp32dev','esp32c3','esp32s3']){const r=await loadRelease(id);assert.equal(r.manifest.board,id);assert.equal(r.files[0].address,id==='esp32dev'?4096:0);}
 swap=true;await assert.rejects(loadRelease('esp32s3'),/does not match/);
});
