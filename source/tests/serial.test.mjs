import test from 'node:test';import assert from 'node:assert/strict';
import {YetiSerial} from '../dist/serial.mjs';
function portMock({badFirmware=false,silent=false,needsReset=false}={}){
 let controller;const commands=[],signals=[];let open=false,resetAsserted=false,booted=!needsReset;
 const readable=new ReadableStream({start(c){controller=c;}});
 const send=m=>controller.enqueue(new TextEncoder().encode(JSON.stringify(m)+'\n'));
 const writable=new WritableStream({write(bytes){const m=JSON.parse(new TextDecoder().decode(bytes));commands.push(m);if(silent||!booted)return;
  if(m.cmd==='hello')send({id:m.id,event:'hello',app:badFirmware?'OtherApp':'YetiYell',protocol:1,chip:'ESP32',version:'1.0.0-rc.1',maxDuration:120,heartbeatTimeoutMs:6000,profiles:['tile']});
  else if(m.cmd==='start'&&m.profile!=='tile')send({id:m.id,event:'ack',ok:false,error:'Unknown profile'});
  else send({id:m.id,event:'ack',ok:true});
 }});
 return {commands,signals,readable,writable,send,raw(text){controller.enqueue(new TextEncoder().encode(text));},getInfo(){return {usbVendorId:0x10c4,usbProductId:0xea60};},async open(options){assert.equal(options.flowControl,'none');open=true;},async setSignals(value){signals.push(value);if(value.requestToSend)resetAsserted=true;else if(resetAsserted)booted=true;},async close(){open=false;},get isOpen(){return open;}};
}
test('USB handshake verifies firmware and stops an existing run before use',async()=>{
 const p=portMock();const serial=new YetiSerial();const h=await serial.connect(p);assert.equal(h.app,'YetiYell');assert.deepEqual(p.commands.map(x=>x.cmd),['hello','stop']);
 await serial.command('start',{profile:'tile'});await assert.rejects(serial.command('start',{profile:'unknown'}),/Unknown profile/);await serial.disconnect();assert.equal(p.isOpen,false);
});
test('wrong firmware releases the port and never starts heartbeat transmission',async()=>{
 const p=portMock({badFirmware:true});const serial=new YetiSerial();await assert.rejects(serial.connect(p),/compatible/);assert.equal(p.isOpen,false);assert.equal(serial.writer,null);
});
test('split JSON and boot noise do not confuse command acknowledgements',async()=>{
 const events=[];const p=portMock();const serial=new YetiSerial({onEvent:e=>events.push(e)});await serial.connect(p);p.send({event:'status',running:true,run:'test'});await new Promise(r=>setTimeout(r,10));assert.ok(events.some(x=>x.run==='test'));await serial.disconnect();
});
test('device silence rejects timed-out commands without a success result',async()=>{
 const p=portMock();const serial=new YetiSerial();await serial.connect(p);
 serial.writer.releaseLock();serial.writer=new WritableStream({write(){}}).getWriter();await assert.rejects(serial.command('status',{},15),/No reply/);assert.equal(serial.pending.size,0);await serial.disconnect();
});
function quickHandshake(serial){const command=serial.command.bind(serial);serial.command=(cmd,data,timeout)=>command(cmd,data,cmd==='hello'?15:timeout);}
test('silent board failure records an opened CP2102 port and releases it for flashing',async()=>{
 const p=portMock({silent:true}),serial=new YetiSerial();quickHandshake(serial);
 await assert.rejects(serial.connect(p),e=>{assert.equal(e.code,'YETI_HANDSHAKE_TIMEOUT');assert.equal(e.serial.portOpened,true);assert.equal(e.serial.usb.usbVendorId,0x10c4);assert.equal(e.serial.bytesReceived,0);assert.equal(e.serial.helloAttempts,4);return true;});
 assert.equal(p.isOpen,false);assert.equal(serial.pending.size,0);assert.equal(p.signals.some(x=>x.requestToSend),false);
});
test('explicit normal-boot reset releases DTR and RTS before connecting and never starts RF',async()=>{
 const p=portMock({needsReset:true}),serial=new YetiSerial();const h=await serial.connect(p,{reset:true});
 assert.equal(h.app,'YetiYell');assert.deepEqual(p.signals,[{dataTerminalReady:false,requestToSend:false},{dataTerminalReady:false,requestToSend:true},{dataTerminalReady:false,requestToSend:false}]);assert.deepEqual(p.commands.map(x=>x.cmd),['hello','stop']);await serial.disconnect();
});
test('partial ROM boot text survives a failed handshake in bounded diagnostics',async()=>{
 const p=portMock({silent:true}),serial=new YetiSerial();quickHandshake(serial);p.raw('x'.repeat(5000));p.raw('waiting for down');p.raw('load');
 await assert.rejects(serial.connect(p),e=>{assert.equal(e.serial.bytesReceived,5020);assert.ok(e.serial.textTail.endsWith('waiting for download'));assert.equal(e.serial.textTail.length,4000);return true;});assert.equal(p.isOpen,false);
});
test('failed reset still attempts to release RTS and closes the port',async()=>{
 const p=portMock(),serial=new YetiSerial(),set=p.setSignals;p.setSignals=async v=>{await set(v);if(v.requestToSend)throw Error('Reset signal rejected');};
 await assert.rejects(serial.connect(p,{reset:true}),e=>e.serial.phase==='resetting'&&/Reset signal rejected/.test(e.message));assert.deepEqual(p.signals.at(-1),{dataTerminalReady:false,requestToSend:false});assert.equal(p.isOpen,false);assert.equal(p.commands.length,0);
});
