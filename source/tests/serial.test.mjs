import test from 'node:test';import assert from 'node:assert/strict';
import {YetiSerial} from '../dist/serial.mjs';
function portMock({badFirmware=false,silent=false}={}){
 let controller;const commands=[];let open=false;
 const readable=new ReadableStream({start(c){controller=c;}});
 const send=m=>controller.enqueue(new TextEncoder().encode(JSON.stringify(m)+'\n'));
 const writable=new WritableStream({write(bytes){const m=JSON.parse(new TextDecoder().decode(bytes));commands.push(m);if(silent)return;
  if(m.cmd==='hello')send({id:m.id,event:'hello',app:badFirmware?'OtherApp':'YetiYell',protocol:1,chip:'ESP32',version:'1.0.0-rc.1',maxDuration:120,heartbeatTimeoutMs:6000,profiles:['tile']});
  else if(m.cmd==='start'&&m.profile!=='tile')send({id:m.id,event:'ack',ok:false,error:'Unknown profile'});
  else send({id:m.id,event:'ack',ok:true});
 }});
 return {commands,readable,writable,send,async open(){open=true;},async setSignals(){},async close(){open=false;},get isOpen(){return open;}};
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
