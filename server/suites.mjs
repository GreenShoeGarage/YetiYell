export function delay(ms,signal){return new Promise((resolve,reject)=>{if(signal.aborted)return reject(Error('Cancelled'));const cancel=()=>{clearTimeout(timer);reject(Error('Cancelled'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);signal.addEventListener('abort',cancel,{once:true});});}
export class SuiteRunner{
 constructor({transmit,stop,onChange=()=>{},sleep=delay}){Object.assign(this,{transmit,stop,onChange,sleep});this.session=null;}
 get active(){return !!this.engaged;}
 update(state){this.session.state=state;this.onChange(this.session);}
 async start(session){
  if(this.active)throw Error('A suite is already active.');
  this.engaged=true;this.session=session;this.abort=new AbortController();this.pauseRequested=false;this.cancelled=false;this.termination=null;this.update('running');
  try{
   for(;session.cursor<session.steps.length;){
    if(this.cancelled)break;
    if(this.pauseRequested){this.update('paused');await new Promise(r=>this.resumeStep=r);this.resumeStep=null;if(this.cancelled)break;this.update('running');}
    this.update('running');const run=await this.transmit(session.steps[session.cursor],session.id);
    if(this.cancelled)break;
    if(run.state!=='completed')throw Error('Step stopped before completing: '+(run.reason||run.state));
    session.cursor++;this.onChange(session);
    if(session.cursor<session.steps.length){this.update(this.pauseRequested?'pausing':'gap');await this.sleep(session.gap*1000,this.abort.signal);}
   }
   this.update(this.cancelled?(this.termination||'cancelled'):'completed');
  }catch(e){session.reason=session.reason||e.message;this.update(this.cancelled?(this.termination||'cancelled'):'interrupted');await this.stop().catch(()=>{});}
  finally{this.resumeStep=null;this.engaged=false;this.onChange(this.session);}
 }
 pause(){if(!this.active)return;this.pauseRequested=true;this.update('pausing');}
 resume(){if(this.session?.state!=='paused')return;this.pauseRequested=false;this.resumeStep?.();}
 async cancel(){return this.terminate('cancelled');}
 async interrupt(reason){if(this.session)this.session.reason=reason;return this.terminate('interrupted');}
 async terminate(state){if(!this.active||this.cancelled)return;this.cancelled=true;this.termination=state;this.abort.abort();this.resumeStep?.();this.update(state);await this.stop();}
}
