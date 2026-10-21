import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';
import {virtualClock} from './helpers/clock.mjs';
import {VERSION,FIRMWARE_VERSION} from '../dist/core.mjs';
const dist=new URL('../dist/',import.meta.url),profiles=JSON.parse(readFileSync(new URL('profiles.json',dist)));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let n=0;n<100;n++){if(fn())return;await wait(5);}throw Error('App did not reach the expected state');}
function browser({serial=true,blocked=false,fastSerialTimeout=false,timer=null,pageVersion=null}={}){
 const dom=new JSDOM(readFileSync(new URL('index.html',dist),'utf8'),{url:'https://example.test/yetiyell/',runScripts:'outside-only'}),w=dom.window;let calls=0,resolvePicker,rejectPicker;
 if(pageVersion)w.document.documentElement.dataset.appVersion=pageVersion;
 Object.defineProperty(w,'isSecureContext',{value:true});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 if(timer){w.setTimeout=timer.setTimeout;w.clearTimeout=timer.clearTimeout;w.performance.now=timer.now;}
 if(fastSerialTimeout){const schedule=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>schedule(fn,ms===1800?10:ms,...args);}
 if(blocked)w.document.featurePolicy={allowsFeature:()=>false};
 if(serial)Object.defineProperty(w.navigator,'serial',{value:{requestPort(){calls++;return new Promise((resolve,reject)=>{resolvePicker=resolve;rejectPicker=reject;});}}});
 w.fetch=async url=>String(url).includes('profiles.json')?{ok:true,json:async()=>profiles}:{ok:false};
 w.eval(readFileSync(new URL(w.document.querySelector('script[src]').getAttribute('src'),dist),'utf8'));w.eval(readFileSync(new URL(w.document.getElementById('appScript').getAttribute('src'),dist),'utf8'));
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
function firmwarePort({version=FIRMWARE_VERSION,rejectStart=false,drop=()=>false,onCommand=()=>false}={}){
 let controller;const commands=[];const send=m=>controller.enqueue(new TextEncoder().encode(JSON.stringify(m)+'\n'));
 return {commands,send,readable:new ReadableStream({start(c){controller=c;}}),writable:new WritableStream({write(bytes){
  const m=JSON.parse(new TextDecoder().decode(bytes));commands.push(m);if(onCommand(m,send)||drop(m))return;
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

test('delivered app keeps the USB connection when optional status acknowledgements are missing',async()=>{
 const timer=virtualClock(),b=browser({timer}),d=b.w.document;await until(()=>d.getElementById('startupStatus').hidden);const port=firmwarePort({drop:m=>m.cmd==='status'});
 d.getElementById('connectButton').click();b.choose(port);await until(()=>d.getElementById('connectionStatus').textContent==='Connected');
 await timer.advance(30000);assert.equal(d.getElementById('connectionStatus').textContent,'Connected');assert.equal(d.getElementById('startButton').disabled,false);assert.equal(port.commands.filter(m=>m.cmd==='ping').length,25);
 d.getElementById('checkUSB').click();const diag=JSON.parse(d.getElementById('usbDiagnostics').textContent);assert.ok(diag.serial.statusTimeouts>0);assert.equal(diag.serial.firmware,FIRMWARE_VERSION);
 d.getElementById('connectButton').click();await until(()=>d.getElementById('connectionStatus').textContent==='Not connected');b.dom.window.close();
});
test('delivered app blocks new runs while checking a missed ping, then recovers without flashing',async()=>{
 const timer=virtualClock(),b=browser({timer}),d=b.w.document;let pings=0;await until(()=>d.getElementById('startupStatus').hidden);const port=firmwarePort({drop:m=>m.cmd==='ping'&&++pings===1});
 d.getElementById('connectButton').click();b.choose(port);await until(()=>d.getElementById('connectionStatus').textContent==='Connected');
 await timer.advance(3700);assert.equal(d.getElementById('connectionStatus').textContent,'Checking connection…');assert.equal(d.getElementById('startButton').disabled,true);
 await timer.advance(250);assert.equal(d.getElementById('connectionStatus').textContent,'Connected');assert.equal(d.getElementById('startButton').disabled,false);assert.equal(d.getElementById('firmwareUpdateNotice').hidden,true);assert.equal(port.commands.some(m=>m.cmd==='start'),false);
 d.getElementById('connectButton').click();await until(()=>d.getElementById('connectionStatus').textContent==='Not connected');b.dom.window.close();
});
test('delivered app reports runtime heartbeat loss with captured diagnostics instead of suggesting missing firmware',async()=>{
 const timer=virtualClock(),b=browser({timer}),d=b.w.document;let silent=false;await until(()=>d.getElementById('startupStatus').hidden);const port=firmwarePort({drop:()=>silent});
 d.getElementById('connectButton').click();b.choose(port);await until(()=>d.getElementById('connectionStatus').textContent==='Connected');silent=true;
 await timer.advance(6500);await until(()=>d.getElementById('connectionStatus').textContent==='Not connected');d.getElementById('checkUSB').click();assert.match(d.getElementById('usbHelpTitle').textContent,/stopped communicating/);
 const diag=JSON.parse(d.getElementById('usbDiagnostics').textContent);assert.equal(diag.lastError.code,'HEARTBEAT_TIMEOUT');assert.equal(diag.serial.pingTimeouts,2);assert.equal(diag.serial.lastCommandTimeout.command,'ping');assert.equal(diag.serial.firmware,FIRMWARE_VERSION);b.dom.window.close();
});

test('a confirmed run survives missing status or start acknowledgements without sending another start or stop',async()=>{
 for(const missing of ['background-status','start','initial-status']){
  const timer=virtualClock(),b=browser({timer}),d=b.w.document;await until(()=>d.getElementById('startupStatus').hidden);let run;
  const port=firmwarePort({onCommand(m,send){
   const state=()=>send({event:'status',running:true,run:run.run,profile:run.profile,remainingMs:20000,mac:'C2:59:59:00:00:01'});
   if(m.cmd==='start'){run=m;if(missing!=='start')send({event:'ack',id:m.id,ok:true});if(missing!=='initial-status')state();return true;}
   if(m.cmd==='status'){if(missing==='initial-status')state();return true;}
   return false;
  }});
  d.getElementById('connectButton').click();b.choose(port);await until(()=>d.getElementById('connectionStatus').textContent==='Connected');d.getElementById('startButton').click();await until(()=>run);
  await timer.advance(15000);assert.equal(d.getElementById('connectionStatus').textContent,'Connected',missing);assert.equal(d.getElementById('activeBanner').hidden,false,missing);assert.equal(port.commands.filter(m=>m.cmd==='start').length,1);assert.equal(port.commands.filter(m=>m.cmd==='stop').length,1,'only the connect-time stop');
  port.send({event:'stopped',run:run.run,reason:'complete',running:false});const saved=()=>JSON.parse(b.w.localStorage.getItem('yetiyell.workspace.v1'));
  await until(()=>saved().runs[0]?.state==='completed');assert.equal(saved().runs[0].verdict,'unreviewed');assert.ok(saved().runs[0].startedAt);
  d.getElementById('connectButton').click();await until(()=>d.getElementById('connectionStatus').textContent==='Not connected');b.dom.window.close();
 }
});
test('Start acknowledgement alone never produces a transmission-success message',async()=>{
 const b=browser(),d=b.w.document;await until(()=>d.getElementById('startupStatus').hidden);const port=firmwarePort();d.getElementById('connectButton').click();b.choose(port);await until(()=>d.getElementById('connectionStatus').textContent==='Connected');d.getElementById('startButton').click();
 const saved=()=>JSON.parse(b.w.localStorage.getItem('yetiyell.workspace.v1'));await until(()=>saved().runs[0]?.state==='error');assert.ok(!saved().runs[0].startedAt);assert.equal(saved().runs[0].verdict,'unreviewed');assert.match(d.getElementById('message').textContent,/did not confirm/);assert.equal(d.getElementById('activeBanner').hidden,true);
 await until(()=>!d.getElementById('connectButton').disabled);d.getElementById('connectButton').click();await until(()=>d.getElementById('connectionStatus').textContent==='Not connected');b.dom.window.close();
});
test('the delivered versioned scripts refuse to operate with a mismatched page version',async()=>{
 const b=browser({pageVersion:'1.0.0-rc.999'}),d=b.w.document;assert.match(d.getElementById('appScript').getAttribute('src'),new RegExp('app-'+VERSION.replaceAll('.','\\.')+'\\.js'));
 await until(()=>/Mixed app files/.test(d.getElementById('startupStatus').textContent));d.getElementById('connectButton').click();assert.equal(b.calls,0);assert.equal(d.getElementById('startupStatus').hidden,false);b.dom.window.close();
});
