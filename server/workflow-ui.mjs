import {validateSuite,expandSuite} from './workspace.mjs';
import {SuiteRunner} from './suites.mjs';
import {parseReceiverLog,correlateEvidence,compareSessions} from './evidence.mjs';
import {matchVerdict,VERSION} from './core.mjs';
const $=id=>document.getElementById(id);
const text=(tag,value,className='')=>{const e=document.createElement(tag);e.textContent=value;e.className=className;return e;};
export const ACCEPTANCE=[
 ['flash','Flash, reset, reconnect; correct board/version'],['boot','Verify no advertisements or AP beacons at boot'],['profiles','Verify all 42 profiles using packet capture and SquachWatch'],['deadline','Verify natural deadline and Stop'],['heartbeat','Verify radio stops within 6 seconds of USB heartbeat loss'],['visibility','Verify hidden tab cancels suite and stops radio'],['recovery','Verify interrupted flash and USB reconnect recovery'],['suite','Complete repeated BLE/Wi-Fi suite with quiet gaps'],['offline','Verify offline reload, flashing, and operation'],['records','Round-trip workspace and review receiver-log correlation'],['browsers','Verify desktop Chrome and Edge, keyboard and responsive layout'],['soak','Complete 100-step session and inspect resets, memory, radio stop']
];
export function initWorkflow(h){
 let steps=[],suiteId='',matches=[],comparison=[];
 const runner=new SuiteRunner({transmit:h.transmit,stop:h.stop,onChange:()=>{h.save();render();h.refresh();}});
 const ws=()=>h.workspace();
 const guard=fn=>async()=>{try{await fn();}catch(e){h.message(e.message,true);}};
 const listen=(id,fn)=>$(id).addEventListener('click',guard(fn));
 const busy=()=>runner.active||!h.idle();
 function draft(){return validateSuite({id:suiteId||crypto.randomUUID(),name:$('suiteName').value,repeats:Number($('suiteRepeats').value),gap:Number($('suiteGap').value),steps},h.profiles);}
 function renderSteps(){
  $('suiteSteps').replaceChildren();steps.forEach((s,i)=>{
   const p=h.profiles.find(p=>p.id===s.profile),li=text('li',p.name+' · '+s.duration+' s · '+s.power+' dBm'+(p.radio==='Wi-Fi'?' · ch '+s.channel:' · '+s.interval+' ms'));
   const row=text('div','','button-row');
   for(const [label,action,disabled] of [['↑',()=>{[steps[i-1],steps[i]]=[steps[i],steps[i-1]];},i===0],['↓',()=>{[steps[i+1],steps[i]]=[steps[i],steps[i+1]];},i===steps.length-1],['Remove',()=>steps.splice(i,1),false]]){
    const b=text('button',label,'text-button');b.setAttribute('aria-label',label+' '+p.name);b.disabled=busy()||disabled;b.onclick=()=>{action();renderSteps();};row.append(b);
   }li.append(row);$('suiteSteps').append(li);
  });
  try{const s=draft(),count=s.steps.length*s.repeats,seconds=s.steps.reduce((a,b)=>a+b.duration,0)*s.repeats+(count-1)*s.gap;$('suiteEstimate').textContent=count+' transmissions · approximately '+Math.ceil(seconds/60)+' minutes.';}catch{$('suiteEstimate').textContent='Add steps from Transmit, or load a preset.';}
 }
 function fillSelect(id,items,placeholder='Choose a session'){
  const select=$(id),value=select.value;select.replaceChildren(new Option(placeholder,''));for(const item of items)select.append(new Option(item.name,item.id));select.value=items.some(x=>x.id===value)?value:'';
 }
 function render(){
  fillSelect('suiteSelect',ws().suites,'New unsaved suite');$('suiteSelect').value=suiteId;
  fillSelect('benchSelect',ws().benches,'Unsaved bench');
  const sessionItems=ws().sessions.map(s=>({id:s.id,name:s.name+' · '+s.date.slice(0,16)+' · '+s.state}));
  fillSelect('resultSession',sessionItems,'All sessions & individual runs');fillSelect('baselineSession',sessionItems);fillSelect('currentSession',sessionItems);
  const s=runner.session;$('suiteState').textContent=s?s.state.toUpperCase():'IDLE';$('suiteProgress').max=s?.steps.length||1;$('suiteProgress').value=s?.cursor||0;
  $('suiteStatus').textContent=s?s.name+' · '+s.cursor+'/'+s.steps.length+' completed'+(s.reason?' · '+s.reason:''):'Connect the transmitter and select a suite.';
  for(const id of ['runSuite','newSuite','saveSuite','deleteSuite','smokeSuite','fullSuite','suiteName','suiteSelect','suiteRepeats','suiteGap','sessionName','saveBench','deleteBench','benchSelect','benchNotes','addSuiteStep'])$(id).disabled=busy();
  $('runSuite').disabled=busy()||!h.ready()||!steps.length;
  $('pauseSuite').disabled=!runner.active||['paused','pausing','cancelled'].includes(s?.state);$('resumeSuite').disabled=s?.state!=='paused';$('cancelSuite').disabled=!runner.active||s?.state==='cancelled';
  $('sessionList').replaceChildren();
  for(const session of ws().sessions.slice().reverse().slice(0,15)){
   const div=text('div','','session-item');div.append(text('strong',session.name),text('p',session.state+' · '+session.cursor+'/'+session.steps.length+' steps · '+new Date(session.date).toLocaleString(),'tiny'));
   const b=text('button','Copy remaining steps','text-button');b.disabled=busy()||session.cursor>=session.steps.length;
   b.onclick=()=>{steps=session.steps.slice(session.cursor);suiteId='';$('suiteName').value=session.name+' continuation';$('suiteRepeats').value=1;$('suiteGap').value=session.gap;renderSteps();render();};const view=text('button','View runs','text-button');view.onclick=()=>{$('resultSession').value=session.id;h.tab('results');h.results();};div.append(b,view);$('sessionList').append(div);
  }
  renderSteps();$('evidenceStatus').textContent=ws().evidence.length+' receiver rows saved. Import does not change test verdicts.';
 }
 listen('newSuite',()=>{steps=[];suiteId='';$('suiteName').value='Untitled suite';render();});
 $('suiteSelect').addEventListener('change',()=>{const s=ws().suites.find(x=>x.id===$('suiteSelect').value);suiteId=s?.id||'';steps=structuredClone(s?.steps||[]);$('suiteName').value=s?.name||'Untitled suite';$('suiteRepeats').value=s?.repeats||1;$('suiteGap').value=s?.gap||10;renderSteps();});
 for(const id of ['suiteRepeats','suiteGap'])$(id).addEventListener('input',renderSteps);
 function preset(profiles,name){steps=profiles.map(p=>({profile:p.id,duration:20,power:p.radio==='BLE'?-12:2,channel:6,interval:250}));suiteId='';$('suiteName').value=name;$('suiteRepeats').value=1;$('suiteGap').value=10;render();}
 listen('smokeSuite',()=>preset(['tile','neutral_ble','flock_wifi','neutral_wifi'].map(id=>h.profiles.find(p=>p.id===id)),'Smoke test'));
 listen('fullSuite',()=>preset(h.profiles,'Full signature coverage'));
 listen('saveSuite',()=>{const s=draft(),index=ws().suites.findIndex(x=>x.id===s.id);if(index<0){if(ws().suites.length>=50)throw Error('Export or remove suites before adding more.');ws().suites.push(s);}else ws().suites[index]=s;suiteId=s.id;h.save();render();h.message('Suite saved.');});
 listen('deleteSuite',()=>{if(!suiteId)return;ws().suites=ws().suites.filter(s=>s.id!==suiteId);suiteId='';h.save();render();});
 listen('runSuite',async()=>{
  if(busy()||!h.ready())return;
  const suite=draft(),plan=expandSuite(suite);if(ws().runs.length+plan.length>1000)throw Error('This session would exceed 1,000 runs. Export and start a new workspace.');
  if(ws().sessions.length>=100)throw Error('This workspace has 100 sessions. Export and start a new workspace.');
  const supported=h.device().profiles;for(const step of plan)if(!supported.includes(step.profile))throw Error('Update firmware for profile '+step.profile);
  const session={id:crypto.randomUUID(),name:$('sessionName').value.trim()||suite.name,date:new Date().toISOString(),detectorVersion:$('detectorVersion').value,steps:plan,gap:suite.gap,cursor:0,state:'running',reason:''};ws().sessions.push(session);h.save();await runner.start(session);h.message('Session '+session.state+'. Review its observations in Results.');
 });
 listen('pauseSuite',()=>runner.pause());listen('resumeSuite',()=>runner.resume());listen('cancelSuite',()=>runner.cancel());
 listen('saveBench',()=>{const name=window.prompt('Name this bench configuration');if(!name?.trim())return;if(ws().benches.length>=30)throw Error('Maximum 30 bench configurations.');const b={id:crypto.randomUUID(),name:name.trim().slice(0,100),detectorVersion:$('detectorVersion').value,channel:Number($('channel').value),notes:$('benchNotes').value};ws().benches.push(b);h.save();render();$('benchSelect').value=b.id;});
 listen('deleteBench',()=>{ws().benches=ws().benches.filter(b=>b.id!==$('benchSelect').value);h.save();render();});
 $('benchSelect').addEventListener('change',()=>{const b=ws().benches.find(b=>b.id===$('benchSelect').value);if(b){$('detectorVersion').value=b.detectorVersion;$('benchNotes').value=b.notes;$('channel').value=b.channel;ws().detectorVersion=b.detectorVersion;h.save();}});
 listen('importLogButton',()=>$('importLog').click());
 $('importLog').addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>2_000_000)throw Error('Log exceeds 2 MB.');const parsed=parseReceiverLog(await f.text(),f.name);const keys=new Set(ws().evidence.map(x=>x.raw));const fresh=parsed.rows.filter(x=>!keys.has(x.raw));if(ws().evidence.length+fresh.length>5000)throw Error('Import exceeds 5,000 receiver rows.');ws().evidence.push(...fresh);h.save();render();h.message('Imported '+fresh.length+' rows; '+parsed.rejected.length+' unsupported rows skipped'+(parsed.rejected.length?' (lines '+parsed.rejected.slice(0,10).join(', ')+').':'.'));}catch(e){h.message(e.message,true);}finally{e.target.value='';}});
 listen('clearEvidence',()=>{if(ws().evidence.length&&!window.confirm('Clear imported receiver rows? Reviewed run observations and their source references will remain.'))return;ws().evidence=[];matches=[];$('evidenceMatches').replaceChildren();h.save();render();});
 listen('matchEvidence',()=>{
  if($('bootEpoch').value&&!Number.isFinite(Date.parse($('bootEpoch').value)))throw Error('Use an ISO UTC boot time, such as 2026-10-13T20:00:00Z.');
  matches=correlateEvidence(ws().runs,ws().evidence,{offsetSeconds:Number($('clockOffset').value),bootEpoch:$('bootEpoch').value});$('evidenceMatches').replaceChildren();
  for(const m of matches.slice().reverse()){
   const run=ws().runs.find(r=>r.id===m.runId),row=text('div','','evidence-match');row.append(text('strong',run.profileName+' · '+new Date(run.date).toLocaleString()),text('p',m.status+' · '+m.candidates.length+' rows · expected '+run.expected,'tiny'));
   if(m.candidates.length){const select=document.createElement('select');select.setAttribute('aria-label','Receiver observation for '+run.profileName);for(const e of m.candidates)select.append(new Option(e.type+' · '+e.time+' · '+e.rssi+' dBm · '+e.source+':'+e.row,e.id));const apply=text('button','Apply reviewed observation','button secondary');apply.disabled=['running','starting'].includes(run.state);
    apply.onclick=()=>{const e=m.candidates.find(e=>e.id===select.value);if(!e)return;if(run.observed&&!window.confirm('Replace this run’s existing observation?'))return;Object.assign(run,{observed:e.type,rssi:e.rssi,verdict:matchVerdict(run.expected,e.type),evidenceId:e.id,evidenceSource:e.source,evidenceRow:e.row,evidenceTime:e.time,observationSource:'receiver log, reviewed',clockOffset:Number($('clockOffset').value),receiverBoot:$('bootEpoch').value});h.save();h.results();h.message('Reviewed receiver observation applied.');};row.append(select,apply);
   }$('evidenceMatches').append(row);
  }
 });
 listen('compareSessions',()=>{
  const a=$('baselineSession').value,b=$('currentSession').value;if(!a||!b||a===b)throw Error('Choose two different sessions.');comparison=compareSessions(ws().runs,a,b);const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');for(const c of ['Profile / duration, power, channel, interval','Baseline pass / fail / review','Current pass / fail / review','Change'])tr.append(text('th',c));head.append(tr);table.append(head);const body=document.createElement('tbody');for(const c of comparison){const tr=document.createElement('tr');for(const value of [c.profile+' / '+c.settings,...[c.baseline,c.current].map(s=>s.pass+' / '+s.fail+' / '+s.pending),c.result])tr.append(text('td',value));body.append(tr);}table.append(body);$('comparisonResults').replaceChildren(table);
 });
 function acceptance(){
  $('acceptanceList').replaceChildren();for(const [id,label] of ACCEPTANCE){const row=text('div','','acceptance-row'),sel=document.createElement('select'),input=document.createElement('input');sel.id='accept-'+id;input.setAttribute('aria-label',label+' evidence');input.placeholder='Board, browser, result and evidence reference';input.maxLength=2000;for(const v of ['pending','pass','fail','blocked'])sel.append(new Option(v,v));const a=ws().acceptance.find(a=>a.id===id);sel.value=a?.result||'pending';input.value=a?.notes||'';const l=text('label',label);l.htmlFor=sel.id;row.append(l,sel,input);$('acceptanceList').append(row);const write=()=>{let a=ws().acceptance.find(a=>a.id===id);if(!a){a={id};ws().acceptance.push(a);}Object.assign(a,{result:sel.value,notes:input.value});h.save();};sel.onchange=write;input.onchange=write;}
 }
 listen('exportAcceptance',()=>h.download('YetiYell-acceptance.json',JSON.stringify({version:VERSION,recordedAt:new Date().toISOString(),releaseHardwareValidated:false,operatorRecords:ws().acceptance,requirements:ACCEPTANCE},null,2),'application/json'));
 acceptance();render();
 return {runner,refresh:render,reset:()=>{suiteId='';steps=[];matches=[];$('evidenceMatches').replaceChildren();$('comparisonResults').replaceChildren();runner.session=null;acceptance();render();},addStep:(p,settings)=>{if(steps.length>=50)throw Error('A suite may have at most 50 steps.');steps.push({profile:p.id,...settings});render();h.tab('suites');},acceptance};
}
