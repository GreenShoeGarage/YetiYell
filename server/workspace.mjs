import {validateSettings} from './core.mjs';
export const emptyWorkspace=()=>({schema:2,detectorVersion:'',runs:[],suites:[],sessions:[],benches:[],evidence:[],acceptance:[]});
const str=(x,max=100)=>typeof x==='string'&&x.length<=max;
const states=['starting','running','completed','stopped','interrupted','error'];
export function validateSuite(s,profiles){
 if(!s||!str(s.id)||!s.id||!str(s.name)||!s.name.trim()||!Array.isArray(s.steps)||!s.steps.length||s.steps.length>50)throw Error('A suite needs a name and 1–50 steps.');
 if(!Number.isInteger(s.repeats)||s.repeats<1||s.repeats>10||s.steps.length*s.repeats>100)throw Error('Use 1–10 repeats and at most 100 total steps.');
 if(!Number.isInteger(s.gap)||s.gap<1||s.gap>120)throw Error('Quiet gaps must be 1–120 seconds.');
 return {id:s.id,name:s.name.trim(),repeats:s.repeats,gap:s.gap,steps:s.steps.map(step=>{const p=profiles.find(p=>p.id===step.profile);if(!p)throw Error('Suite contains an unknown profile.');return {profile:p.id,...validateSettings(step,p.radio)};})};
}
export function expandSuite(s){return Array.from({length:s.repeats},(_,repeat)=>s.steps.map((step,index)=>({...step,repeat:repeat+1,position:index+1}))).flat();}
export function restoreWorkspace(data,profiles){
 if(!data||![1,2].includes(data.schema)||!Array.isArray(data.runs)||data.runs.length>1000)throw Error('Use a YetiYell workspace with at most 1,000 runs.');
 const w=emptyWorkspace(),ids=new Set();w.detectorVersion=String(data.detectorVersion||'').slice(0,100);
 w.runs=data.runs.map(r=>{
  if(!r||!str(r.id)||!r.id||ids.has(r.id)||!profiles.some(p=>p.id===r.profile)||!str(r.date)||!Number.isFinite(Date.parse(r.date))||!['unreviewed','pass','fail','inconclusive'].includes(r.verdict)||!states.includes(r.state))throw Error('Workspace contains an invalid run.');
  ids.add(r.id);for(const [k,v] of Object.entries(r))if(['__proto__','constructor','prototype'].includes(k)||v===null||typeof v==='object'||String(v).length>5000)throw Error('Unsupported run data.');
  return {...r,state:['starting','running'].includes(r.state)?'interrupted':r.state,reason:['starting','running'].includes(r.state)?'Workspace loaded before run completion':r.reason||''};
 });
 for(const key of ['suites','sessions','benches','evidence','acceptance'])if(data[key]!==undefined&&(!Array.isArray(data[key])||data[key].length>({suites:50,sessions:100,benches:30,evidence:5000,acceptance:200}[key])))throw Error('Workspace '+key+' exceeds its limit.');
 w.suites=(data.suites||[]).map(s=>validateSuite(s,profiles));
 w.sessions=(data.sessions||[]).map(s=>{
  if(!s||!str(s.id)||!str(s.name)||!str(s.date)||!Number.isFinite(Date.parse(s.date))||!str(s.detectorVersion)||!Array.isArray(s.steps)||s.steps.length>100||!Number.isInteger(s.cursor)||s.cursor<0||s.cursor>s.steps.length||!['running','paused','pausing','gap','completed','cancelled','interrupted'].includes(s.state))throw Error('Invalid session.');
  if(!Number.isInteger(s.gap)||s.gap<1||s.gap>120)throw Error('Invalid session gap.');const suite={steps:s.steps.map(step=>{const p=profiles.find(p=>p.id===step.profile);if(!p)throw Error('Unknown session profile.');return {profile:step.profile,...validateSettings(step,p.radio)};})};
  return {id:s.id,name:s.name,date:s.date,detectorVersion:s.detectorVersion,steps:suite.steps,gap:s.gap,cursor:s.cursor,state:['completed','cancelled','interrupted'].includes(s.state)?s.state:'interrupted',reason:String(s.reason||'').slice(0,500)};
 });
 w.benches=(data.benches||[]).map(b=>{if(!str(b.id)||!str(b.name)||!str(b.detectorVersion)||!str(b.notes,1000)||!Number.isInteger(b.channel)||b.channel<1||b.channel>11)throw Error('Invalid bench configuration.');return {id:b.id,name:b.name,detectorVersion:b.detectorVersion,notes:b.notes,channel:b.channel};});
 w.evidence=(data.evidence||[]).map(e=>{if(!str(e.id)||!str(e.source,200)||!str(e.type,32)||!str(e.mac,17)||!str(e.time)||!Number.isInteger(e.row)||!Number.isFinite(e.rssi)||e.rssi>0||e.rssi< -127||!str(e.raw,1000))throw Error('Invalid receiver evidence.');return {id:e.id,source:e.source,type:e.type,mac:e.mac,time:e.time,row:e.row,rssi:e.rssi,raw:e.raw};});
 w.acceptance=(data.acceptance||[]).map(a=>{if(!str(a.id)||!str(a.notes,2000)||!['pending','pass','fail','blocked'].includes(a.result))throw Error('Invalid acceptance record.');return {id:a.id,notes:a.notes,result:a.result};});
 for(const key of ['suites','sessions','benches','evidence','acceptance'])if(new Set(w[key].map(x=>x.id)).size!==w[key].length)throw Error('Duplicate '+key+' identifiers.');
 return w;
}
export function mergeWorkspace(current,incoming){
 const out=structuredClone(current);
 for(const key of ['runs','suites','sessions','benches','evidence','acceptance']){
  const ids=new Set(out[key].map(x=>x.id));out[key].push(...incoming[key].filter(x=>!ids.has(x.id)));
  if(out[key].length>({runs:1000,suites:50,sessions:100,benches:30,evidence:5000,acceptance:200}[key]))throw Error('Merged '+key+' exceeds workspace capacity.');
 }
 return out;
}
