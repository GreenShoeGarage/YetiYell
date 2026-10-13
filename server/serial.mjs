import {validateHello} from './compat.mjs';
export class YetiSerial {
 constructor({onEvent=()=>{},onLine=()=>{},onDisconnect=()=>{}}={}){this.onEvent=onEvent;this.onLine=onLine;this.onDisconnect=onDisconnect;this.pending=new Map();this.seq=0;this.port=null;this.reader=null;this.writer=null;this.info=null;this.closing=false;this.writeQueue=Promise.resolve();}
 async connect(port){
  if(this.port)throw Error('A device is already connected.');
  this.port=port;this.closing=false;
  try{
   await port.open({baudRate:115200,bufferSize:8192});
   await port.setSignals({dataTerminalReady:false,requestToSend:false}).catch(()=>{});
   this.writer=port.writable.getWriter();this.reader=port.readable.getReader();this.readTask=this.readLoop();
   let hello;
   for(let n=0;n<4;n++){
    try{hello=await this.command('hello',{},1800);break;}catch(e){if(n===3)throw e;}
   }
   this.info=validateHello(hello);
   // Attaching to a leftover run never resumes transmission silently.
   await this.command('stop');
   this.heartbeat=setInterval(()=>this.command('ping',{},2500).then(()=>this.command('status',{},2500)).catch(()=>this.disconnect('Device stopped responding.')),1200);
   return this.info;
  }catch(e){await this.disconnect(e.message);throw e;}
 }
 async readLoop(){
  const decoder=new TextDecoder();let buffer='';
  try{
   while(!this.closing){const {value,done}=await this.reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
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
   const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('No reply from the ESP32. Check USB and firmware.'));},timeout);
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
