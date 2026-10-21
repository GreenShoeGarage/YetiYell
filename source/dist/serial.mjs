import {validateHello} from './compat.mjs';
const HEARTBEAT_INTERVAL=1200,REPLY_TIMEOUT=2500,RETRY_DELAY=250,MAX_MISSED_PINGS=2,STATUS_INTERVAL=3000;
const clock={now:()=>performance.now(),setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id)};
export class YetiSerial {
 constructor({onEvent=()=>{},onLine=()=>{},onDisconnect=()=>{},onHealth=()=>{},timer=clock}={}){
  Object.assign(this,{onEvent,onLine,onDisconnect,onHealth,timer});
  this.pending=new Map();this.seq=0;this.session=0;this.port=null;this.reader=null;this.writer=null;this.info=null;this.closing=false;this.writeQueue=Promise.resolve();this.health='disconnected';
 }
 snapshot(){
  const now=this.timer.now(),age=value=>value==null?null:Math.max(0,Math.round(now-value));
  return {...this.diagnostics,health:this.health,lastReplyAgeMs:age(this.lastReplyAt),lastPingAckAgeMs:age(this.lastPingAckAt),lastStatusAgeMs:age(this.lastStatusAt),pending:[...this.pending].map(([id,p])=>({id,command:p.cmd,phase:p.phase}))};
 }
 setHealth(health){if(this.health===health)return;this.health=health;this.onHealth(health);}
 async connect(port,{reset=false}={}){
  if(this.port)throw Error('A device is already connected.');
  this.port=port;this.closing=false;this.session++;this.missedPings=0;this.statusPending=false;this.lastReplyAt=null;this.lastPingAckAt=null;this.lastStatusAt=null;
  this.diagnostics={phase:'opening',portOpened:false,baudRate:115200,resetRequested:reset,helloAttempts:0,bytesReceived:0,textTail:'',pingTimeouts:0,statusTimeouts:0,readErrors:0,commandTimeouts:0};
  try{this.diagnostics.usb=port.getInfo?.()||{};}catch{}
  try{
   this.onLine('Opening the selected serial port at 115200 baud.');
   await port.open({baudRate:115200,bufferSize:8192,flowControl:'none'});
   this.diagnostics.portOpened=true;
   await port.setSignals({dataTerminalReady:false,requestToSend:false}).catch(e=>{this.diagnostics.signalWarning=e.message;this.onLine('Control lines: '+e.message+'. If needed, release BOOT and tap EN/RESET.');});
   this.writer=port.writable.getWriter();this.readTask=this.readLoop();
   if(reset){
    this.diagnostics.phase='resetting';this.onLine('Restarting the board for normal operation. Keep BOOT released.');
    try{
     await port.setSignals({dataTerminalReady:false,requestToSend:true});
     await new Promise(r=>this.timer.setTimeout(r,100));
    }finally{await port.setSignals({dataTerminalReady:false,requestToSend:false});}
    await new Promise(r=>this.timer.setTimeout(r,500));
   }
   this.diagnostics.phase='handshake';
   let hello;
   for(let n=0;n<4;n++){
    this.diagnostics.helloAttempts=n+1;this.onLine('Waiting for YetiYell firmware ('+(n+1)+'/4)…');
    try{hello=await this.command('hello',{},1800);break;}catch(e){if(e.code!=='SERIAL_TIMEOUT'||n===3)throw e;}
   }
   this.diagnostics.phase='validating';this.info=validateHello(hello);this.diagnostics.firmware=this.info.version;
   // Attaching to a leftover run never resumes transmission silently.
   await this.command('stop');
   this.diagnostics.phase='connected';this.onLine('YetiYell firmware '+this.info.version+' replied; transmitter confirmed idle.');
   this.setHealth('connected');this.scheduleHeartbeat();
   return this.info;
  }catch(e){
   if(e.code==='SERIAL_TIMEOUT'&&this.diagnostics.phase==='handshake'){e.code='YETI_HANDSHAKE_TIMEOUT';e.message='The serial port opened, but YetiYell firmware did not reply.';}
   e.serial=this.snapshot();await this.disconnect(e.message,e.code);throw e;
  }
 }
 scheduleHeartbeat(delay=HEARTBEAT_INTERVAL){
  const session=this.session;
  this.heartbeat=this.timer.setTimeout(()=>this.checkHeartbeat(session),delay);
 }
 async checkHeartbeat(session){
  if(this.closing||session!==this.session)return;
  let delay=HEARTBEAT_INTERVAL;
  try{
   await this.command('ping',{},REPLY_TIMEOUT);
   if(this.closing||session!==this.session)return;
   this.lastPingAckAt=this.timer.now();this.missedPings=0;
   if(this.health==='checking')this.onLine('Heartbeat reply received; USB connection retained.');
   this.setHealth('connected');
   // Status is telemetry, not the keepalive. A lost status ack must not close
   // a responsive connection or delay the next ping. Active firmware streams
   // status every second, so only poll when those updates are absent.
   if(!this.statusPending&&(this.lastStatusAt==null||this.timer.now()-this.lastStatusAt>=STATUS_INTERVAL))this.pollStatus(session);
  }catch(e){
   if(this.closing||session!==this.session)return;
   if(e.code!=='SERIAL_TIMEOUT'){await this.disconnect('Heartbeat command failed: '+e.message,e.code);return;}
   this.diagnostics.pingTimeouts++;this.missedPings++;
   this.onLine('Heartbeat reply missed ('+this.missedPings+'/'+MAX_MISSED_PINGS+').');
   if(this.missedPings>=MAX_MISSED_PINGS){await this.disconnect('No heartbeat reply after two attempts. Open Connection help or save the USB console log.','HEARTBEAT_TIMEOUT');return;}
   this.setHealth('checking');delay=RETRY_DELAY;
  }
  if(!this.closing&&session===this.session)this.scheduleHeartbeat(delay);
 }
 async pollStatus(session){
  this.statusPending=true;
  try{await this.command('status',{},REPLY_TIMEOUT);}
  catch(e){if(!this.closing&&session===this.session){if(e.code==='SERIAL_TIMEOUT')this.diagnostics.statusTimeouts++;this.onLine('Status request: '+e.message+' Heartbeat monitoring continues.');}}
  finally{if(session===this.session)this.statusPending=false;}
 }
 async readLoop(){
  const port=this.port,session=this.session;let failure='USB connection lost.';
  try{
   // Web Serial replaces readable after recoverable parity/framing/overflow
   // errors. Release the failed reader and acquire the replacement stream.
   while(!this.closing&&session===this.session&&port.readable){
    const stream=port.readable,reader=stream.getReader(),decoder=new TextDecoder();this.reader=reader;let buffer='';
    try{
     while(!this.closing&&session===this.session){
      const {value,done}=await reader.read();if(done)break;
      const text=decoder.decode(value,{stream:true});buffer+=text;
      this.diagnostics.bytesReceived+=value.byteLength;this.diagnostics.textTail=(this.diagnostics.textTail+text).slice(-4000);
      let at;
      while((at=buffer.indexOf('\n'))>=0){
       const line=buffer.slice(0,at).trim();buffer=buffer.slice(at+1);if(!line)continue;this.onLine(line);
       let msg;try{msg=JSON.parse(line);}catch{continue;}
       if(!msg||typeof msg!=='object')continue;
       const pending=this.pending.get(msg.id);
       if(pending&&(msg.event==='ack'||msg.event==='hello')){
        this.lastReplyAt=this.timer.now();this.timer.clearTimeout(pending.timer);this.pending.delete(msg.id);
        if(msg.event==='ack'&&!msg.ok)pending.reject(Error(msg.error||'Device rejected command.'));else pending.resolve(msg);
       }
       if(['status','started','stopped'].includes(msg.event)&&typeof msg.running==='boolean'){this.lastReplyAt=this.timer.now();this.lastStatusAt=this.lastReplyAt;}
       this.onEvent(msg);if(this.closing)break;
      }
      if(buffer.length>16384){buffer='';this.onLine('Discarded an oversized incomplete serial line.');}
     }
    }catch(e){
     if(!this.closing){this.diagnostics.readErrors++;this.diagnostics.lastReadError={name:e.name,message:e.message};failure='USB read failed: '+e.name+': '+e.message;this.onLine(failure);}
    }finally{reader.releaseLock();if(this.reader===reader)this.reader=null;}
    if(this.closing||port.readable===stream)break; // Closed stream, not a replacement; avoid spinning.
    if(port.readable)this.onLine('Recovering the serial reader without resetting the board.');
   }
  }catch(e){failure='USB reader unavailable: '+e.message;}
  finally{if(!this.closing&&session===this.session)queueMicrotask(()=>{if(!this.closing&&session===this.session)this.disconnect(failure,'SERIAL_READ_FAILED');});}
 }
 command(cmd,data={},timeout=3500){
  if(!this.writer||this.closing)return Promise.reject(Error('Connect your ESP32 first.'));
  const id=++this.seq,session=this.session,writer=this.writer;
  return new Promise((resolve,reject)=>{
   const pending={resolve,reject,cmd,phase:'queued',timer:null};this.pending.set(id,pending);
   const arm=()=>{
    this.timer.clearTimeout(pending.timer);
    pending.timer=this.timer.setTimeout(()=>{
     if(this.pending.get(id)!==pending)return;this.pending.delete(id);
     const error=Error(pending.phase==='reply'?'No reply from the ESP32. Check USB and firmware.':'USB command could not be written in time.');
     error.code=pending.phase==='reply'?'SERIAL_TIMEOUT':'SERIAL_WRITE_TIMEOUT';error.command=cmd;error.commandId=id;
     this.diagnostics.commandTimeouts++;this.diagnostics.lastCommandTimeout={command:cmd,id,phase:pending.phase};
     this.onLine('Command timeout: '+cmd+' #'+id+' ('+pending.phase+').');reject(error);
     if(pending.phase==='writing')this.disconnect('USB write stalled. Reconnect the board.','SERIAL_WRITE_TIMEOUT');
    },timeout);
   };
   arm();const bytes=new TextEncoder().encode(JSON.stringify({...data,cmd,id})+'\n');
   this.writeQueue=this.writeQueue.catch(()=>{}).then(async()=>{
    // Never emit an expired queued command, or one from a previous connection.
    if(this.closing||session!==this.session||this.pending.get(id)!==pending)return;
    pending.phase='writing';arm();await writer.write(bytes);
    if(this.pending.get(id)===pending){pending.phase='reply';arm();}
   });
   this.writeQueue.catch(e=>{if(this.pending.get(id)!==pending)return;this.timer.clearTimeout(pending.timer);this.pending.delete(id);reject(e);if(!this.closing&&session===this.session)this.disconnect('USB write failed: '+e.message,'SERIAL_WRITE_FAILED');});
  });
 }
 async disconnect(reason='Disconnected',code=''){
  if(this.closing)return;this.closing=true;this.timer.clearTimeout(this.heartbeat);
  if(this.diagnostics){this.diagnostics.disconnectReason=reason;this.diagnostics.disconnectCode=code;this.diagnostics.atDisconnect=this.snapshot();}
  this.setHealth('disconnected');
  for(const p of this.pending.values()){this.timer.clearTimeout(p.timer);p.reject(Error(reason));}this.pending.clear();
  try{await this.reader?.cancel();}catch{}
  try{await this.readTask;}catch{}
  try{this.writer?.releaseLock();}catch{}this.writer=null;
  try{await this.port?.close();}catch{}
  this.port=null;this.info=null;this.writeQueue=Promise.resolve();this.onDisconnect(reason);
 }
}
