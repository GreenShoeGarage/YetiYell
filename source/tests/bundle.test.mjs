import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';
import {FIRMWARE_VERSION} from '../dist/core.mjs';
const dist=new URL('../dist/',import.meta.url),profiles=JSON.parse(readFileSync(new URL('profiles.json',dist)));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let n=0;n<100;n++){if(fn())return;await wait(5);}throw Error('App did not reach the expected state');}
function browser({serial=true,blocked=false,fastSerialTimeout=false}={}){
 const dom=new JSDOM(readFileSync(new URL('index.html',dist),'utf8'),{url:'https://example.test/yetiyell/',runScripts:'outside-only'}),w=dom.window;let calls=0,resolvePicker,rejectPicker;
 Object.defineProperty(w,'isSecureContext',{value:true});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 if(fastSerialTimeout){const schedule=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>schedule(fn,ms===1800?10:ms,...args);}
 if(blocked)w.document.featurePolicy={allowsFeature:()=>false};
 if(serial)Object.defineProperty(w.navigator,'serial',{value:{requestPort(){calls++;return new Promise((resolve,reject)=>{resolvePicker=resolve;rejectPicker=reject;});}}});
 w.fetch=async url=>String(url).includes('profiles.json')?{ok:true,json:async()=>profiles}:{ok:false};
 w.eval(readFileSync(new URL('boot.js',dist),'utf8'));w.eval(readFileSync(new URL('app.js',dist),'utf8'));
 return {dom,w,get calls(){return calls;},choose(port){resolvePicker(port);},cancel(){rejectPicker(new w.DOMException('No port selected','NotFoundError'));}};
}
test('the delivered classic bundle starts without .mjs requests and opens one picker per click',async()=>{
 const b=browser();await until(()=>b.w.document.getElementById('startupStatus').hidden);const button=b.w.document.getElementById('connectButton');assert.equal(button.disabled,false);button.click();assert.equal(b.calls,1);assert.equal(button.disabled,true);button.click();assert.equal(b.calls,1);assert.equal(b.w.document.getElementById('connectionStatus').textContent,'Choose a port…');
 b.cancel();await until(()=>!button.disabled);assert.equal(b.w.document.getElementById('usbHelp').open,true);assert.equal(b.w.document.getElementById('usbHelpTitle').textContent,'No port selected');assert.equal(b.w.document.getElementById('openUSBTab').href,'https://example.test/yetiyell/');b.dom.window.close();
});
test('unsupported or policy-blocked browsers get connection help instead of an inert button',async()=>{
 for(const options of [{serial:false},{blocked:true}]){const b=browser(options);await until(()=>b.w.document.getElementById('startupStatus').hidden);const button=b.w.document.getElementById('connectButton');assert.equal(button.disabled,false);button.click();await until(()=>b.w.document.getElementById('usbHelp').open);assert.equal(b.calls,0);assert.match(b.w.document.getElementById('usbHelpTitle').textContent,/unavailable|blocks/);b.dom.window.close();}
});
test('bootstrap reports script-load failures even when the application never starts',()=>{
 const dom=new JSDOM(readFileSync(new URL('index.html',dist),'utf8'),{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;w.eval(readFileSync(new URL('boot.js',dist),'utf8'));w.document.getElementById('appScript').dispatchEvent(new w.Event('error'));assert.match(w.document.getElementById('startupStatus').textContent,/script could not load/);dom.window.close();
});
test('delivered app routes a real handshake timeout to reset and firmware setup without flashing',async()=>{
 const b=browser({fastSerialTimeout:true}),d=b.w.document;await until(()=>d.getElementById('startupStatus').hidden);let opened=false;
 const port={readable:new ReadableStream(),writable:new WritableStream({write(){}}),getInfo:()=>({usbVendorId:0x10c4,usbProductId:0xea60}),async open(){opened=true;},async setSignals(){},async close(){opened=false;}};
 d.getElementById('connectButton').click();b.choose(port);await until(()=>d.getElementById('usbHelp').open);
 assert.equal(opened,false);assert.equal(d.getElementById('usbBrowserRecovery').hidden,true);assert.equal(d.getElementById('usbDeviceRecovery').hidden,false);assert.match(d.getElementById('usbHelpTitle').textContent,/firmware did not reply/);
 const detail=JSON.parse(d.getElementById('usbDiagnostics').textContent);assert.equal(detail.serial.portOpened,true);assert.equal(detail.serial.bytesReceived,0);assert.equal(detail.serial.helloAttempts,4);
 d.getElementById('usbGoSetup').click();assert.equal(d.getElementById('setup').hidden,false);assert.equal(d.getElementById('flashConsent').checked,false);assert.equal(d.getElementById('usbHelp').open,false);
 d.getElementById('checkUSB').click();d.getElementById('usbRetryReset').click();assert.equal(b.calls,2);b.cancel();await until(()=>!d.getElementById('connectButton').disabled);b.dom.window.close();
});
function firmwarePort({version=FIRMWARE_VERSION,rejectStart=false}={}){
 let controller;const commands=[];const send=m=>controller.enqueue(new TextEncoder().encode(JSON.stringify(m)+'\n'));
 return {commands,readable:new ReadableStream({start(c){controller=c;}}),writable:new WritableStream({write(bytes){
  const m=JSON.parse(new TextDecoder().decode(bytes));commands.push(m);
  if(m.cmd==='hello')return send({event:'hello',id:m.id,app:'YetiYell',protocol:1,chip:'esp32',board:'esp32dev',version,catalog:profiles.catalog,maxDuration:120,heartbeatTimeoutMs:6000,profiles:profiles.profiles.map(p=>p.id)});
  if(m.cmd==='start'&&rejectStart)return send({event:'ack',id:m.id,ok:false,error:'BLE advertising start failed; see USB console for stack errors'});
  send({event:'ack',id:m.id,ok:true});
 }}),async open(){},async close(){},async setSignals(){}};
}
test('old firmware is routed to setup and cannot transmit until the radio fix is flashed',async()=>{
 const b=browser(),d=b.w.document;await until(()=>d.getElementById('startupStatus').hidden);const port=firmwarePort({version:'1.0.0-rc.1'});
 d.getElementById('connectButton').click();b.choose(port);await until(()=>d.getElementById('connectionStatus').textContent==='Connected');
 assert.equal(d.getElementById('setup').hidden,false);assert.equal(d.getElementById('startButton').disabled,true);assert.match(d.getElementById('message').textContent,/flash the bundled radio-start fix/);d.getElementById('startButton').click();assert.equal(port.commands.some(m=>m.cmd==='start'),false);
 d.getElementById('connectButton').click();await until(()=>d.getElementById('connectionStatus').textContent==='Not connected');b.dom.window.close();
});
test('a firmware radio rejection interrupts the suite without recording a transmission or pass',async()=>{
 const b=browser(),d=b.w.document;await until(()=>d.getElementById('startupStatus').hidden);const port=firmwarePort({rejectStart:true});
 d.getElementById('connectButton').click();b.choose(port);await until(()=>d.getElementById('connectionStatus').textContent==='Connected');
 d.getElementById('smokeSuite').click();d.getElementById('runSuite').click();const workspace=()=>JSON.parse(b.w.localStorage.getItem('yetiyell.workspace.v1'));
 await until(()=>workspace().sessions[0]?.state==='interrupted');const saved=workspace();assert.equal(saved.sessions[0].cursor,0);assert.equal(saved.runs.length,1);assert.equal(saved.runs[0].state,'error');assert.match(saved.runs[0].reason,/BLE advertising start failed/);assert.equal(saved.runs[0].verdict,'unreviewed');assert.ok(!saved.runs[0].startedAt);assert.equal(port.commands.filter(m=>m.cmd==='start').length,1);
 await until(()=>!d.getElementById('connectButton').disabled);d.getElementById('connectButton').click();await until(()=>d.getElementById('connectionStatus').textContent==='Not connected');b.dom.window.close();
});
