import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSettings,csvCell,reportCSV,validateWorkspace,makeRun,matchVerdict} from '../dist/core.mjs';
const {profiles}=JSON.parse(readFileSync(new URL('../dist/profiles.json',import.meta.url)));
test('profile coverage and negative controls remain explicit',()=>{
 assert.equal(profiles.length,42);assert.equal(profiles.filter(p=>p.radio==='BLE').length,33);assert.equal(profiles.filter(p=>p.negative).length,7);assert.equal(new Set(profiles.map(p=>p.id)).size,42);
 assert.equal(profiles.find(p=>p.id==='tile').uuid,'FEED');assert.equal(profiles.find(p=>p.id==='raven_near').expected,'NONE');assert.equal(profiles.find(p=>p.id==='raven_near').uuid,'3101');
 for(const p of profiles){if(p.mfg)assert.ok(p.mfg.length/2+2+(p.flags===false?0:3)<=31);if(p.ssid)assert.ok(Buffer.byteLength(p.ssid)<=32);}
});
test('settings reject unsupported power, invalid numeric input and long transmissions',()=>{
 const valid={duration:20,power:-12,channel:6,interval:250};assert.deepEqual(validateSettings(valid,'BLE'),valid);
 for(const patch of [{duration:0},{duration:121},{duration:NaN},{duration:20.5},{channel:12},{interval:99},{power:8}])assert.throws(()=>validateSettings({...valid,...patch},'BLE'));
 assert.equal(validateSettings({...valid,power:2},'Wi-Fi').power,2);assert.throws(()=>validateSettings({...valid,power:3},'Wi-Fi'));
});
test('CSV neutralizes formula cells and quotes multiline notes',()=>{
 assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(csvCell('a\nb'),'"a\nb"');assert.ok(reportCSV([{notes:'@SUM(A1)'}]).includes("'@SUM(A1)"));
});
test('workspace import validates records and never turns an imported run into a live transmission',()=>{
 const r=makeRun(profiles[0],{duration:20},'0.1.0','test','abc');r.state='running';const d={schema:1,runs:[r]};assert.equal(validateWorkspace(d,['tile']).runs[0].state,'interrupted');
 assert.throws(()=>validateWorkspace({...d,runs:[r,r]},['tile']));assert.throws(()=>validateWorkspace(d,['raven']));assert.throws(()=>validateWorkspace({...d,schema:2},['tile']));assert.throws(()=>validateWorkspace({...d,runs:[{...r,notes:{evil:1}}]},['tile']));
});
test('expected observations do not become automatic positive detections',()=>{
 const r=makeRun(profiles[0],{duration:20},'0.1.0','','abc');assert.equal(r.observed,'');assert.equal(r.verdict,'unreviewed');assert.equal(matchVerdict('TILE','NONE'),'fail');assert.equal(matchVerdict('NONE','NONE'),'pass');assert.equal(matchVerdict('TILE',''),'unreviewed');
});
