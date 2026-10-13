import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';import {JSDOM} from 'jsdom';
const dist=new URL('../dist/',import.meta.url);
test('firmware manifest matches every packaged byte and the ESP32 memory map',()=>{
 const m=JSON.parse(readFileSync(new URL('firmware/manifest.json',dist)));assert.equal(m.chip,'ESP32');assert.equal(m.hardwareValidated,false);assert.deepEqual(m.parts.map(p=>p.offset),[0x1000,0x8000,0xe000,0x10000]);
 let end=0;
 for(const p of m.parts){const bytes=readFileSync(new URL('firmware/'+p.file,dist));assert.equal(bytes.length,p.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256);assert.ok(p.offset>=end);end=p.offset+p.size;}
 assert.ok(end<=0x310000);const app=readFileSync(new URL('firmware/firmware.bin',dist));assert.equal(app[0],0xe9);
});
test('all static runtime resources are local and present',()=>{
 const html=readFileSync(new URL('index.html',dist),'utf8'),doc=new JSDOM(html).window.document;
 for(const e of doc.querySelectorAll('script[src],link[href],img[src]')){const path=e.getAttribute('src')||e.getAttribute('href');assert.ok(path.startsWith('./'));assert.ok(existsSync(new URL(path,dist)),path);}
 const bundle=readFileSync(new URL('vendor/esptool.bundle.mjs',dist),'utf8');assert.ok(bundle.length>100000);assert.ok(!/import\s*\(\s*['"]https?:/.test(bundle));assert.ok(!/fetch\(\s*['"]https?:/.test(bundle));
});
test('generated firmware catalog and browser profile IDs agree',()=>{
 const js=JSON.parse(readFileSync(new URL('profiles.json',dist))).profiles;const cpp=readFileSync(new URL('../firmware/src/profiles.h',import.meta.url),'utf8');
 const ids=[...cpp.matchAll(/\{"([a-z_]+)", (?:true|false),/g)].map(m=>m[1]);assert.deepEqual(ids,js.map(p=>p.id));
});
