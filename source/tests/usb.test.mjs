import test from 'node:test';import assert from 'node:assert/strict';
import {usbEnvironment,requestUSBPort,usbFailure} from '../dist/usb.mjs';
function environment(patch={}){const win={};win.top=win;win.self=win;return {win,secure:true,location:{protocol:'https:'},doc:{},nav:{serial:{requestPort:()=>Promise.resolve('port')}},...patch};}
test('port selection is invoked synchronously in the click context with no awaited probes',async()=>{let clicked=true,calls=0;const env=environment({nav:{serial:{requestPort(){assert.equal(clicked,true);calls++;return Promise.resolve('port');}}}});const result=requestUSBPort(env);clicked=false;assert.equal(calls,1);assert.equal(await result,'port');});
test('USB environment distinguishes HTTP, local files, unavailable APIs and embedded policy blocks',()=>{
 assert.equal(usbEnvironment(environment()).ok,true);
 for(const [patch,code] of [[{secure:false},'insecure'],[{location:{protocol:'file:'}},'file'],[{nav:{}},'unsupported'],[{doc:{featurePolicy:{allowsFeature:()=>false}},win:{self:{},top:{}}},'policy']]){
  const env=environment(patch);assert.equal(usbEnvironment(env).code,code);assert.throws(()=>requestUSBPort(env),e=>e.name==='USBEnvironmentError');
 }
});
test('chooser cancellation, browser permission denial and missing API have actionable messages',()=>{
 assert.equal(usbFailure({name:'NotFoundError'},environment()).code,'cancelled');
 assert.match(usbFailure({name:'SecurityError'},environment()).detail,/site settings/);
 assert.equal(usbFailure({name:'TypeError'},environment({nav:{}})).code,'unsupported');
});
test('an opened but silent serial port gets firmware recovery instead of browser-policy advice',()=>{
 const status=usbFailure({code:'YETI_HANDSHAKE_TIMEOUT',serial:{portOpened:true,bytesReceived:0,textTail:''}},environment());assert.equal(status.code,'firmware');assert.equal(status.deviceRecovery,true);assert.match(status.detail,/Choose board & flash/);assert.match(status.detail,/No serial bytes/);assert.doesNotMatch(status.detail,/another tab|site settings/);
});
test('boot output distinguishes download mode, boot errors, and unrecognized firmware',()=>{
 for(const [text,code] of [['waiting for download','bootloader'],['boot:0x3 (DOWNLOAD_BOOT)','bootloader'],['invalid header: 0xffffffff','boot-error'],['Guru Meditation Error','boot-error'],['Some other application','firmware']]){
  const status=usbFailure({code:'YETI_HANDSHAKE_TIMEOUT',serial:{portOpened:true,bytesReceived:text.length,textTail:text}},environment());assert.equal(status.code,code,text);assert.equal(status.deviceRecovery,true);
 }
});
