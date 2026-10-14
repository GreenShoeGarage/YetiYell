import {validateHello} from './compat.mjs';
export class YetiSerial {
 constructor({onEvent=()=>{},onLine=()=>{},onDisconnect=()=>{}}={}){this.onEvent=onEvent;this.onLine=onLine;this.onDisconnect=onDisconnect;this.pending=new Map();this.seq=0;this.port=null;this.reader=null;this.writer=null;this.info=null;this.closing=false;this.writeQueue=Promise.resolve();}
 async connect(port,{reset=false}={}){
  if(this.port)throw Error('A device is already connected.');
  this.port=port;this.closing=false;
  this.diagnostics={phase:'opening',portOpened:false,baudRate:115200,resetRequested:reset,helloAttempts:0,bytesReceived:0,textTail:''};
  try{this.diagnostics.usb=port.getInfo?.()||{};}catch{}
  try{
   this.onLine('Opening the selected serial port at 115200 baud.');
   await port.open({baudRate:115200,bufferSize:8192,flowControl:'none'});
   this.diagnostics.portOpened=true;
   await port.setSignals({dataTerminalReady:false,requestToSend:false}).catch(e=>{this.diagnostics.signalWarning=e.message;this.onLine('Control lines: '+e.message+'. If needed, release BOOT and tap EN/RESET.');});
   this.writer=port.writable.getWriter();this.reader=port.readable.getReader();this.readTask=this.readLoop();
   if(reset){
    this.diagnostics.phase='resetting';this.onLine('Restarting the board for normal operation. Keep BOOT released.');
    try{
     await port.setSignals({dataTerminalReady:false,requestToSend:true});
     await new Promise(r=>setTimeout(r,100));
    }finally{await port.setSignals({dataTerminalReady:false,requestToSend:false});}
    await new Promise(r=>setTimeout(r,500));
   }
   this.diagnostics.phase='handshake';
   let hello;
   for(let n=0;n<4;n++){
    this.diagnostics.helloAttempts=n+1;this.onLine('Waiting for YetiYell firmware ('+(n+1)+'/4)…');
    try{hello=await this.command('hello',{},1800);break;}catch(e){if(e.code!=='SERIAL_TIMEOUT'||n===3)throw e;}
   }
   this.diagnostics.phase='validating';
   this.info=validateHello(hello);
   // Attaching to a leftover run never resumes transmission silently.
   await this.command('stop');
   this.diagnostics.phase='connected';this.onLine('YetiYell firmware '+this.info.version+' replied; transmitter confirmed idle.');
   this.heartbeat=setInterval(()=>this.command('ping',{},2500).then(()=>this.command('status',{},2500)).catch(()=>this.disconnect('Device stopped responding.')),1200);
   return this.info;
  }catch(e){
   if(e.code==='SERIAL_TIMEOUT'&&this.diagnostics.phase==='handshake'){e.code='YETI_HANDSHAKE_TIMEOUT';e.message='The serial port opened, but YetiYell firmware did not reply.';}
   e.serial={...this.diagnostics};await this.disconnect(e.message);throw e;
  }
 }
 async readLoop(){
  const decoder=new TextDecoder();let buffer='';
  try{
   while(!this.closing){const {value,done}=await this.reader.read();if(done)break;const text=decoder.decode(value,{stream:true});buffer+=text;
    if(this.diagnostics){this.diagnostics.bytesReceived+=value.byteLength;this.diagnostics.textTail=(this.diagnostics.textTail+text).slice(-4000);}
    if(buffer.length>16384){buffer='';continue;}
    let at;
    while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at).trim();buffer=buffer.slice(at+1);if(!line)continue;this.onLine(line);
     let msg;try{msg=JSON.parse(line);}catch{continue;}
     if(!msg||typeof msg!=='object')continue;
     const pending=this.pending.get(msg.id);
     if(pending&&(msg.event==='ack'||msg.event==='hello')){
      clearTimeout(pending.timer);this.pending.delete(msg.id);
      if(msg.event==='ack'&&!msg.ok)pending.reject(Error(msg.error||'Device rejected command.'));else pending.resolve(msg);
     }
     this.onEvent(msg);
    }
   }
  }catch(e){if(!this.closing)this.onLine('Serial: '+e.message);}
  finally{try{this.reader?.releaseLock();}catch{}this.reader=null;if(!this.closing){queueMicrotask(()=>this.disconnect('USB connection lost.'));}}
 }
 command(cmd,data={},timeout=3500){
  if(!this.writer||this.closing)return Promise.reject(Error('Connect your ESP32 first.'));
  const id=++this.seq;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);const error=Error('No reply from the ESP32. Check USB and firmware.');error.code='SERIAL_TIMEOUT';reject(error);},timeout);
   this.pending.set(id,{resolve,reject,timer});
   const bytes=new TextEncoder().encode(JSON.stringify({...data,cmd,id})+'\n');
   this.writeQueue=this.writeQueue.catch(()=>{}).then(()=>{if(this.closing||!this.writer)throw Error('USB link closed.');return this.writer.write(bytes);});
   this.writeQueue.catch(e=>{clearTimeout(timer);this.pending.delete(id);reject(e);});
  });
 }
 async disconnect(reason='Disconnected'){
  if(this.closing)return;this.closing=true;clearInterval(this.heartbeat);
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(reason));}this.pending.clear();
  try{await this.reader?.cancel();}catch{}
  try{await this.readTask;}catch{}
  try{this.writer?.releaseLock();}catch{}this.writer=null;
  try{await this.port?.close();}catch{}
  this.port=null;this.info=null;this.writeQueue=Promise.resolve();this.onDisconnect(reason);
 }
}
