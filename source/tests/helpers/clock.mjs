// Advance protocol time while allowing real Streams API promise jobs to run.
export const flush=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
export function virtualClock(){
 let now=0,seq=0;const tasks=new Map();
 const clock={now:()=>now,setTimeout(fn,ms){const id=++seq;tasks.set(id,{at:now+ms,fn});return id;},clearTimeout(id){tasks.delete(id);},async advance(ms){
  const end=now+ms;await flush();
  while(true){const next=[...tasks].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;
   const [id,t]=next;tasks.delete(id);now=t.at;t.fn();await flush();
  }now=end;await flush();
 }};return clock;
}
