import test from 'node:test';import assert from 'node:assert/strict';
import {YetiSerial} from '../dist/serial.mjs';
import {virtualClock,flush} from './helpers/clock.mjs';
function board(clock,{drop=()=>false,delayWrite=()=>null}={}){
 let controller,readable;const commands=[],signals=[];let open=false;
 const replace=()=>{readable=new ReadableStream({start(c){controller=c;}});};replace();
 const send=m=>controller.enqueue(new TextEncoder().encode(JSON.stringify(m)+'\n'));
 const port={commands,signals,send,get readable(){return readable;},writable:new WritableStream({async write(bytes){
  const m=JSON.parse(new TextDecoder().decode(bytes));commands.push({...m,at:clock.now()});await delayWrite(m);
  if(drop(m))return;
  if(m.cmd==='hello')send({id:m.id,event:'hello',app:'YetiYell',protocol:1,chip:'ESP32',version:'1.0.0-rc.4',maxDuration:120,heartbeatTimeoutMs:6000,profiles:['tile']});
  else {if(m.cmd==='status')send({event:'status',running:false,run:''});send({id:m.id,event:'ack',ok:true});}
 }}),async open(){open=true;},async close(){open=false;},async setSignals(s){signals.push(s);},get isOpen(){return open;},
 recoverableError(){const old=controller;replace();old.error(new DOMException('Serial framing error','FramingError'));},
 unplug(){const old=controller;readable=null;old.error(new DOMException('Device removed','NetworkError'));},
 raw(text){controller.enqueue(new TextEncoder().encode(text));}};return port;
}
test('three-minute connection survives missing status replies while keeping pings on time',async()=>{
 const timer=virtualClock(),port=board(timer,{drop:m=>m.cmd==='status'}),serial=new YetiSerial({timer});await serial.connect(port);
 await timer.advance(180000);assert.equal(port.isOpen,true);assert.equal(serial.health,'connected');assert.ok(serial.diagnostics.statusTimeouts>30);
 const pings=port.commands.filter(m=>m.cmd==='ping');assert.equal(pings.length,150);assert.ok(pings.slice(1).every((m,i)=>m.at-pings[i].at===1200));assert.equal(serial.diagnostics.pingTimeouts,0);assert.ok(!port.commands.some(m=>m.cmd==='start'));await serial.disconnect();
});
test('periodic missing ping replies recover without resetting or resending start',async()=>{
 const timer=virtualClock();let pings=0;const health=[];const port=board(timer,{drop:m=>m.cmd==='ping'&&++pings%8===0}),serial=new YetiSerial({timer,onHealth:s=>health.push(s)});await serial.connect(port);
 await serial.command('start',{profile:'tile'});await timer.advance(180000);
 assert.equal(port.isOpen,true);assert.ok(serial.diagnostics.pingTimeouts>10);assert.equal(port.commands.filter(m=>m.cmd==='start').length,1);assert.equal(port.commands.filter(m=>m.cmd==='stop').length,1);assert.equal(port.signals.length,1);assert.ok(health.includes('checking'));assert.equal(serial.health,'connected');
 const pingCommands=port.commands.filter(m=>m.cmd==='ping');assert.ok(pingCommands.slice(1).every((m,i)=>m.at-pingCommands[i].at<6000));await serial.disconnect();
});
test('complete silence still disconnects once after two bounded heartbeat attempts',async()=>{
 const timer=virtualClock();let silent=false;const reasons=[];const port=board(timer,{drop:()=>silent}),serial=new YetiSerial({timer,onDisconnect:r=>reasons.push(r)});await serial.connect(port);silent=true;
 await timer.advance(6500);assert.equal(port.isOpen,false);assert.equal(reasons.length,1);assert.match(reasons[0],/two attempts/);assert.equal(serial.diagnostics.disconnectCode,'HEARTBEAT_TIMEOUT');assert.equal(serial.diagnostics.pingTimeouts,2);assert.equal(serial.pending.size,0);
 const count=port.commands.length;await timer.advance(10000);assert.equal(port.commands.length,count);assert.equal(reasons.length,1);
});
test('recoverable read error reacquires the stream and discards an incomplete old line',async()=>{
 const timer=virtualClock(),events=[],port=board(timer),serial=new YetiSerial({timer,onEvent:m=>events.push(m)});await serial.connect(port);port.raw('{"event":');await flush();port.recoverableError();await flush();
 port.raw('{"event":"status",');port.raw('"running":false,"run":"recovered"}\n');await flush();await timer.advance(15000);
 assert.equal(port.isOpen,true);assert.equal(serial.diagnostics.readErrors,1);assert.equal(serial.diagnostics.lastReadError.name,'FramingError');assert.ok(events.some(m=>m.run==='recovered'));assert.equal(port.signals.length,1);await serial.disconnect();
});
test('physical port removal closes the session and records the read error',async()=>{
 const timer=virtualClock(),reasons=[],port=board(timer),serial=new YetiSerial({timer,onDisconnect:r=>reasons.push(r)});await serial.connect(port);port.unplug();await flush();assert.equal(port.isOpen,false);assert.equal(reasons.length,1);assert.match(reasons[0],/Device removed/);assert.equal(serial.diagnostics.disconnectCode,'SERIAL_READ_FAILED');await timer.advance(15000);assert.equal(reasons.length,1);
});
test('an expired command behind a slow write is never transmitted later',async()=>{
 const timer=virtualClock();let release;const blocked=new Promise(r=>release=r);const port=board(timer,{delayWrite:m=>m.cmd==='status'?blocked:null}),serial=new YetiSerial({timer});await serial.connect(port);
 const status=serial.command('status',{},1000);await flush();const start=assert.rejects(serial.command('start',{profile:'tile'},20),e=>e.code==='SERIAL_WRITE_TIMEOUT');await timer.advance(21);await start;release();await flush();await status;
 assert.equal(port.commands.some(m=>m.cmd==='start'),false);assert.equal(port.isOpen,true);await serial.disconnect();
});
test('old connection callbacks cannot close or poll a new connection',async()=>{
 const timer=virtualClock(),port=board(timer,{drop:m=>m.cmd==='status'}),serial=new YetiSerial({timer});await serial.connect(port);await timer.advance(1200);assert.equal(serial.statusPending,true);await serial.disconnect();
 const replacement=board(timer);await serial.connect(replacement);await timer.advance(15000);assert.equal(replacement.isOpen,true);assert.equal(serial.diagnostics.commandTimeouts,0);assert.equal(port.commands.filter(m=>m.cmd==='ping').length,1);await serial.disconnect();
});
