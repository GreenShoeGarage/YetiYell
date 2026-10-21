import {VERSION,FIRMWARE_VERSION,STORAGE_KEY,validateSettings,reportCSV,makeRun,matchVerdict} from './core.mjs';
import {emptyWorkspace,restoreWorkspace,mergeWorkspace} from './workspace.mjs';
import {initWorkflow} from './workflow-ui.mjs';
import {friendlyError} from './compat.mjs';
import {usbEnvironment,requestUSBPort,usbFailure} from './usb.mjs';
import {YetiSerial} from './serial.mjs';
const $=id=>document.getElementById(id);
const all=selector=>[...document.querySelectorAll(selector)];
let profiles=[],selected=null,filter='all',workspace=emptyWorkspace(),device=null,activeRun=null,busy=false,flashBusy=false,release=null,flasher=null,reviewId=null,lines=[],storageOK=true;
let lab=null,resolveRun=null,catalogHash='',pendingWorker=null,pickingFor='',appReady=false,lastUSBError=null;

const serial=new YetiSerial({onEvent:handleEvent,onLine:log,onDisconnect:disconnected,onHealth:()=>updateControls()});
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);$('message').hidden=!text;}
function log(text){const entry=new Date().toLocaleTimeString()+'  '+String(text).trim();lines.push(entry);if(lines.length>500)lines.shift();$('console').textContent=lines.join('\n');$('console').scrollTop=$('console').scrollHeight;}
function save(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(workspace));storageOK=true;$('saveStatus').innerHTML='<i></i> Saved locally';}
 catch{storageOK=false;$('saveStatus').textContent='Storage unavailable — export your results';message('This browser cannot save the workspace. Export JSON or CSV before closing.',true);}
}
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function tab(name){
 if(!['setup','operate','suites','results','guide'].includes(name))return;
 all('.tab-panel').forEach(p=>p.hidden=p.id!==name);all('.nav-button').forEach(b=>{b.classList.toggle('active',b.dataset.tab===name);if(b.dataset.tab===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 if(name==='results')renderResults();
}
all('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
function renderProfiles(){
 const search=$('profileSearch').value.trim().toLowerCase();
 const visible=profiles.filter(p=>(filter==='all'||filter===p.radio||(filter==='negative'&&p.negative))&&[p.name,p.expected,p.mechanism].join(' ').toLowerCase().includes(search));
 const list=$('profileList');list.replaceChildren();$('profileCount').textContent=visible.length+' profiles';
 for(const p of visible){
  const b=document.createElement('button');b.type='button';b.className='profile-option'+(selected?.id===p.id?' active':'');b.setAttribute('aria-pressed',String(selected?.id===p.id));b.disabled=!!activeRun||busy||!!lab?.runner.active;
  const icon=document.createElement('span');icon.className='profile-icon';icon.textContent=p.negative?'CTRL':p.radio==='BLE'?'BT':'WI';
  const text=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=p.name;small.textContent=p.radio+' / '+(p.negative?'NEGATIVE CONTROL':p.expected);text.append(strong,small);
  const arrow=document.createElement('span');arrow.className='arrow';arrow.textContent=selected?.id===p.id?'↗':'';b.append(icon,text,arrow);b.addEventListener('click',()=>selectProfile(p));list.append(b);
 }
 if(!visible.length){const p=document.createElement('p');p.className='tiny';p.textContent='No profiles match. Try another search or filter.';list.append(p);}
}
function selectProfile(profile){
 selected=profile;$('profileTitle').textContent=profile.name;$('profileRadio').textContent=profile.radio;$('profileSummary').textContent=profile.summary;$('profileMechanism').textContent=profile.mechanism;$('expectedType').textContent=profile.expected==='NONE'?'NO MATCH':profile.expected;
 $('profileNote').hidden=!profile.note;$('profileNote').textContent=profile.note||'';
 $('power').replaceChildren();for(const n of profile.radio==='Wi-Fi'?[2,5,8]:[-12,-6,0,3]){const o=document.createElement('option');o.value=n;o.textContent=(n>0?'+':'')+n+' dBm';$('power').append(o);}
 renderProfiles();updateControls();
}
function updateControls(){
 const locked=busy||flashBusy||!!pickingFor||!!activeRun||!!lab?.runner.active;
 $('connectButton').disabled=busy||flashBusy||!!pickingFor||!!lab?.runner.active;
 $('connectButton').textContent=device?'Disconnect':'Connect ESP32 ↗';
 $('connectionStatus').textContent=pickingFor?'Choose a port…':flashBusy?'Flashing…':busy&&!device?'Connecting…':device?(serial.health==='checking'?'Checking connection…':'Connected'):'Not connected';
 $('connectionDot').classList.toggle('connected',!!device);
 $('deviceDescription').textContent=device?'YetiYell '+device.version+' · '+device.chip:'Connect a flashed ESP32 to put the bench to work.';
 $('firmwareUpdateNotice').hidden=deviceReady();
 $('consoleLabel').textContent=flashBusy?'FLASHING':activeRun?'TRANSMITTING':device?'USB CONNECTED':'WAITING FOR DEVICE';
 $('startButton').disabled=!deviceReady()||serial.health!=='connected'||locked||!device.profiles?.includes(selected?.id);
 $('stopButton').disabled=!activeRun||flashBusy;
 $('flashButton').disabled=locked||!!device||!release||!$('flashConsent').checked;
 $('flashHint').textContent=device?'Disconnect the board before flashing.':!release?'Waiting for the bundled firmware to load.':!$('flashConsent').checked?'Select the firmware replacement checkbox to enable flashing.':'Click Choose board & flash to open the browser’s USB port chooser.';
 $('flashConsent').disabled=locked||!!device;
 for(const id of ['duration','power','detectorVersion','boardSelect','flashSpeed','benchNotes'])$(id).disabled=locked;
 $('interval').disabled=locked||selected?.radio==='Wi-Fi';$('channel').disabled=locked||selected?.radio==='BLE';
 $('startButton').textContent=activeRun?'Transmitting…':'▶ Transmit for '+$('duration').value+' seconds';
 $('startHint').textContent=!device?'Connect your ESP32 to start.':!device.profiles?.includes(selected?.id)?'Update your transmitter firmware for this profile.':activeRun?'Keep this tab visible. The board stops automatically.':!deviceReady()?'Install the bundled firmware to match this app and profile catalog.':'Ready. The radio is idle until you start a test.';
 renderProfiles();lab?.refresh();refreshUSB();
}
function renderResults(){
 const runs=workspace.runs;$('resultCount').textContent=runs.length;$('statTotal').textContent=runs.length;
 for(const [id,type]of [['statPass','pass'],['statFail','fail'],['statReview','unreviewed']])$(id).textContent=runs.filter(r=>r.verdict===type).length;
 const q=$('resultsSearch').value.toLowerCase(),filter=$('resultFilter').value;
 const visible=runs.filter(r=>(!$('resultSession').value||r.sessionId===$('resultSession').value)&&(filter==='all'||r.verdict===filter)&&[r.profileName,r.expected,r.observed,r.notes,r.verdict].join(' ').toLowerCase().includes(q)).slice().reverse();
 const body=$('resultsBody');body.replaceChildren();$('resultsEmpty').hidden=!!runs.length;$('resultsTable').hidden=!runs.length;
 for(const r of visible){const tr=document.createElement('tr');
  const title=document.createElement('td');title.textContent=r.profileName;const date=document.createElement('small');date.textContent=new Date(r.date).toLocaleString();title.append(date);const detail=document.createElement('small');detail.className='report-detail';detail.textContent='TX '+(r.firmware||'—')+' · RX '+(r.detectorVersion||'not recorded')+' · '+r.duration+' s / '+r.power+' dBm / ch '+r.channel+' · '+(r.benchNotes||'No bench notes');title.append(detail);if(r.notes){const note=document.createElement('small');note.className='report-detail';note.textContent=r.notes;title.append(note);}tr.append(title);
  for(const v of [r.expected,r.observed||'—',r.state+(r.reason&&r.reason!=='complete'?' / '+r.reason:'')]){const td=document.createElement('td');td.textContent=v;tr.append(td);}
  const verdict=document.createElement('td'),badge=document.createElement('span');badge.className='verdict '+r.verdict;badge.textContent=r.verdict==='unreviewed'?'NEEDS REVIEW':r.verdict.toUpperCase();verdict.append(badge);tr.append(verdict);
  const action=document.createElement('td'),button=document.createElement('button');button.className='text-button';button.textContent='Record ↗';button.disabled=r.state==='running'||r.state==='starting';button.addEventListener('click',()=>review(r.id));action.append(button);tr.append(action);body.append(tr);
 }
 if(runs.length&&!visible.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No runs match these filters.';tr.append(td);body.append(tr);}
 $('exportCSV').disabled=!runs.length;$('printReport').disabled=!runs.length;
}
function review(id){
 const r=workspace.runs.find(r=>r.id===id);if(!r)return;reviewId=id;
 $('reviewTitle').textContent=r.profileName;$('reviewExpected').textContent='Expected: '+r.expected+' · '+r.state+' · '+r.duration+' s';
 for(const k of ['observed','rssi','latency','verdict','notes'])$(k).value=r[k]??'';
 $('reviewEvidence').textContent=r.evidenceSource?'Receiver evidence: '+r.evidenceSource+':'+r.evidenceRow+' · '+r.evidenceTime:'';
 $('reviewDialog').showModal();
}
$('closeReview').addEventListener('click',()=>$('reviewDialog').close());
$('observed').addEventListener('change',()=>{const r=workspace.runs.find(r=>r.id===reviewId);if(r)$('verdict').value=matchVerdict(r.expected,$('observed').value);});
$('reviewForm').addEventListener('submit',e=>{e.preventDefault();const r=workspace.runs.find(r=>r.id===reviewId);if(!r)return;for(const k of ['observed','rssi','latency','verdict','notes'])r[k]=$(k).value;r.observationSource=r.evidenceId?'manual review with attached evidence':'manual';save();renderResults();$('reviewDialog').close();});
function finishRun(reason,state='completed'){
 if(!activeRun)return;const finished=activeRun;activeRun.state=state;activeRun.reason=reason;activeRun.endedAt=new Date().toISOString();activeRun=null;const complete=resolveRun;resolveRun=null;complete?.(finished);$('activeBanner').hidden=true;save();updateControls();renderResults();
 if(state==='completed'&&!lab?.runner.active)message('Transmission finished. Open Results to record what SquachWatch detected.');
}
function handleEvent(event){
 if(event.event==='hello'&&event.id===0&&device){serial.disconnect('Board restarted. Reconnect to verify the firmware.');return;}
 if(!activeRun||event.run!==activeRun.id)return;
 if(event.event==='started'||(event.event==='status'&&event.running)){
  activeRun.state='running';if(!activeRun.startedAt)activeRun.startedAt=new Date().toISOString();activeRun.mac=String(event.mac||'');$('activeBanner').hidden=false;$('activeName').textContent=activeRun.profileName;$('activeProtocol').textContent=activeRun.radio;$('remaining').textContent=Math.max(0,Math.ceil(event.remainingMs/1000));
  if(event.event==='started')save();updateControls();
 }
 if(event.event==='status'&&!event.running)finishRun(activeRun.stopRequested?'user':'idle',activeRun.stopRequested?'stopped':'interrupted');
 if(event.event==='stopped')finishRun(event.reason,event.reason==='complete'?'completed':event.reason==='user'?'stopped':'interrupted');
}
function disconnected(reason){
 if(reason!=='Disconnected'){lastUSBError=Object.assign(Error(reason),{code:serial.diagnostics?.disconnectCode,serial:serial.snapshot()});}
 const wasRunning=!!activeRun;device=null;busy=false;if(lab?.runner.active)lab.runner.interrupt(reason).catch(()=>{});if(activeRun)finishRun(reason,'interrupted');updateControls();if(reason!=='Disconnected')message(reason+(wasRunning?' Active radio tests stop within 6 seconds of the last heartbeat.':''),true);log(reason);
}
function refreshUSB(){
 const status=usbEnvironment();$('usbStatus').textContent=status.ok?'USB port picker available':status.title;
 $('usbStatus').classList.toggle('error',!status.ok);
 $('compatibility').hidden=status.ok&&!status.embedded;
 $('compatibility').textContent=status.ok?status.detail:status.title+'. '+status.detail;
 const url=new URL('./',window.location.href);for(const id of ['openUSBTab','usbHelpTab'])$(id).href=url.href;
}
function showUSBHelp(error){
 const status=error?usbFailure(error):usbEnvironment();
 $('usbHelpTitle').textContent=status.title;$('usbHelpText').textContent=status.detail;
 $('usbDeviceRecovery').hidden=!status.deviceRecovery;$('usbBrowserRecovery').hidden=!!status.deviceRecovery;
 $('usbCopyStatus').textContent='';
 $('usbDiagnostics').textContent=JSON.stringify({app:VERSION,url:window.location.href,...status,lastError:error?{name:error.name,message:error.message,code:error.code}:null,serial:error?.serial||serial.snapshot()},null,2);
 const dialog=$('usbHelp');if(!dialog.open)dialog.showModal();
}
$('checkUSB').addEventListener('click',()=>showUSBHelp(lastUSBError));
$('closeUSBHelp').addEventListener('click',()=>$('usbHelp').close());
$('usbGoSetup').addEventListener('click',()=>{$('usbHelp').close();tab('setup');$('flashConsent').focus();});
$('usbViewConsole').addEventListener('click',()=>{$('usbHelp').close();$('consolePanel').open=true;$('consolePanel').scrollIntoView?.({block:'center',behavior:'smooth'});});
$('usbRetryReset').addEventListener('click',()=>{$('usbHelp').close();connectESP(true);});
$('copyUSBDiagnostics').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('usbDiagnostics').textContent);$('usbCopyStatus').textContent='Connection details copied.';}catch{$('usbCopyStatus').textContent='Select and copy the connection details below.';}});
$('connectButton').addEventListener('click',()=>connectESP());
async function connectESP(reset=false){
 if(pickingFor||busy||flashBusy||lab?.runner.active)return;
 if(device){try{await serial.command('stop');}catch{}await serial.disconnect();return;}
 if(!appReady){message('The app has not finished loading. Check the startup message above.',true);return;}
 try{
  const selection=requestUSBPort();lastUSBError=null;pickingFor='connect';updateControls();message('Choose the board’s USB-to-UART port (for example CP2102 or CH340).');
  const port=await selection;pickingFor='';busy=true;updateControls();message('USB selected. Waiting for the installed YetiYell firmware…');device=await serial.connect(port,{reset});
  message(deviceReady()?'ESP32 connected. Choose a profile to begin.':'Board firmware '+device.version+' does not match the required '+FIRMWARE_VERSION+'. Disconnect, open Set up, and flash the bundled radio-start fix.',!deviceReady());tab(deviceReady()?'operate':'setup');
 }catch(e){lastUSBError=e;message(friendlyError(e),true);showUSBHelp(e);}
 finally{pickingFor='';busy=false;updateControls();}
}
function deviceReady(){return !!device&&device.version===FIRMWARE_VERSION&&device.catalog===catalogHash;}
async function stopTransmission(){
 if(!device)return;
 try{if(activeRun)activeRun.stopRequested=true;await serial.command('stop');if(activeRun){await serial.command('status');if(activeRun)throw Error('Board did not confirm an idle radio.');}}
 catch(e){await serial.disconnect('Stop was not acknowledged.');throw Error(e.message+' The heartbeat timeout stops the radio within 6 seconds.');}
}
async function transmitStep(step,sessionId=''){
 if(!deviceReady()||serial.health!=='connected'||activeRun||busy||flashBusy)throw Error('Connect a matching idle YetiYell transmitter first.');
 if(workspace.runs.length>=1000)throw Error('This workspace has 1,000 runs. Export it before creating more tests.');
 const profile=profiles.find(p=>p.id===step.profile);if(!profile||!device.profiles.includes(profile.id))throw Error('Profile is unavailable in the connected firmware.');
 const settings=validateSettings(step,profile.radio);selectProfile(profile);for(const k of ['duration','power','channel','interval'])$(k).value=settings[k];
 const completion=new Promise(resolve=>resolveRun=resolve);
 try{
  workspace.detectorVersion=$('detectorVersion').value;activeRun=makeRun(profile,settings,device.version,workspace.detectorVersion);Object.assign(activeRun,{sessionId,board:device.board||device.chip,catalog:catalogHash,benchNotes:$('benchNotes').value,observationSource:'manual'});workspace.runs.push(activeRun);busy=true;save();updateControls();renderResults();
  const run=activeRun;
  // A started/running event for this exact run is stronger evidence than a
  // command acknowledgement. Never stop a confirmed run for a lost status ack.
  try{await serial.command('start',{...settings,profile:profile.id,run:run.id});}
  catch(e){if(e.code!=='SERIAL_TIMEOUT'||!run.startedAt)throw e;log('Start acknowledgement missed; the board confirmed run '+run.id+'.');}
  if(activeRun===run&&!run.startedAt){
   try{await serial.command('status');}
   catch(e){if(e.code!=='SERIAL_TIMEOUT'||!run.startedAt)throw e;log('Status acknowledgement missed; the board confirmed run '+run.id+'.');}
  }
  if(activeRun===run){
   if(!run.startedAt)throw Error('The board acknowledged Start but did not confirm a running radio. Save the USB console log.');
   message('Board confirmed radio start. Check SquachWatch’s log for '+profile.expected+'.');
  }
 }catch(e){if(activeRun)finishRun(e.message,'error');try{await stopTransmission();}catch{}message(friendlyError(e),true);}
 finally{busy=false;updateControls();}
 return completion;
}
$('startButton').addEventListener('click',()=>{if(lab?.runner.active)return;transmitStep({profile:selected?.id,...Object.fromEntries(['duration','power','channel','interval'].map(k=>[k,$(k).value]))}).catch(e=>message(e.message,true));});
$('addSuiteStep').addEventListener('click',()=>{try{lab.addStep(selected,validateSettings(Object.fromEntries(['duration','power','channel','interval'].map(k=>[k,$(k).value])),selected.radio));}catch(e){message(e.message,true);}});
$('stopButton').addEventListener('click',async()=>{try{if(lab?.runner.active)await lab.runner.cancel();else await stopTransmission();message('Transmission stopped. The partial run is saved.');}catch(e){message(e.message,true);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(lab?.runner.active)lab.runner.cancel().catch(()=>{});else if(activeRun)stopTransmission().catch(()=>{});}});
window.addEventListener('pagehide',()=>{if(lab?.runner.active)lab.runner.cancel().catch(()=>{});else if(activeRun)serial.command('stop').catch(()=>{});});
window.addEventListener('beforeunload',e=>{if(flashBusy||activeRun||lab?.runner.active){e.preventDefault();e.returnValue='';}});
$('flashConsent').addEventListener('change',updateControls);
$('flashButton').addEventListener('click',async()=>{
 if(!release||!$('flashConsent').checked||device||flashBusy||busy||pickingFor||activeRun||lab?.runner.active)return;
 try{
  const selection=requestUSBPort();pickingFor='flash';updateControls();message('Choose your ESP32 USB serial port in the browser window.');const port=await selection;pickingFor='';flashBusy=true;updateControls();$('flashProgressBox').hidden=false;$('flashProgress').value=0;$('flashState').textContent='Connecting to the bootloader…';$('consolePanel').open=true;
  await flasher.flashBoard(port,release,{log,baudrate:Number($('flashSpeed').value),progress:(i,w,total)=>{const fraction=(i+w/total)/release.files.length;$('flashProgress').value=fraction*100;$('flashState').textContent='Writing firmware '+Math.round(fraction*100)+'%';}});
  $('flashProgress').value=100;$('flashState').textContent='Installed and verified. Ready to connect.';$('flashConsent').checked=false;
  message('YetiYell installed. Press Connect ESP32 to operate it. If it does not answer, tap EN/RESET once.');
 }catch(e){$('flashState').textContent='Installation did not complete.';message(friendlyError(e),true);log(e.message);showUSBHelp(e);}
 finally{pickingFor='';flashBusy=false;updateControls();}
});
$('duration').addEventListener('input',updateControls);
$('detectorVersion').addEventListener('change',()=>{workspace.detectorVersion=$('detectorVersion').value;save();});
$('profileSearch').addEventListener('input',renderProfiles);
all('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;all('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderProfiles();}));
$('resultsSearch').addEventListener('input',renderResults);$('resultFilter').addEventListener('change',renderResults);$('resultSession').addEventListener('change',renderResults);
$('exportCSV').addEventListener('click',()=>download('YetiYell-results.csv',reportCSV(workspace.runs),'text/csv;charset=utf-8'));
$('resetWorkspace').addEventListener('click',()=>{if(activeRun||lab?.runner.active){message('Stop the active transmission before starting a new workspace.',true);return;}if(workspace.runs.length&&!window.confirm('Start a new workspace? This removes '+workspace.runs.length+' local run records. Export a workspace backup first if you need to keep them.'))return;workspace=emptyWorkspace();$('detectorVersion').value='';save();renderResults();lab?.reset();message('New workspace ready.');});
$('exportJSON').addEventListener('click',()=>download('YetiYell-workspace.json',JSON.stringify({...workspace,appVersion:VERSION},null,2),'application/json'));
$('printReport').addEventListener('click',()=>{tab('results');window.print();});
$('importJSONButton').addEventListener('click',()=>$('importJSON').click());
$('importJSON').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>5_000_000)throw Error('Workspace files must be smaller than 5 MB.');
  if(activeRun||lab?.runner.active)throw Error('Stop the active session before importing.');
  const imported=restoreWorkspace(JSON.parse(await file.text()),profiles);workspace=mergeWorkspace(workspace,imported);save();renderResults();lab.acceptance();lab.refresh();message('Workspace merged. Existing records were kept.');
 }catch(e){message('Import failed: '+e.message,true);}finally{e.target.value='';}
});
$('saveConsole').addEventListener('click',()=>download('YetiYell-console.txt',JSON.stringify({app:VERSION,requiredFirmware:FIRMWARE_VERSION,url:window.location.href,script:$('appScript')?.src,browser:navigator.userAgent,capturedAt:new Date().toISOString(),serial:serial.snapshot()},null,2)+'\n\n'+lines.join('\n'),'text/plain'));
$('clearConsole').addEventListener('click',()=>{lines=[];$('console').textContent='';});
let theme='dark';try{theme=localStorage.getItem('yetiyell.theme')||'dark';}catch{}if(!['dark','light','contrast'].includes(theme))theme='dark';document.documentElement.dataset.theme=theme;
$('themeToggle').addEventListener('click',()=>{const themes=['dark','light','contrast'];theme=themes[(themes.indexOf(theme)+1)%themes.length];document.documentElement.dataset.theme=theme;$('themeToggle').setAttribute('aria-label','Color theme: '+theme+'. Switch theme.');try{localStorage.setItem('yetiyell.theme',theme);}catch{}});
async function prepareOffline(){
 if(!('serviceWorker'in navigator))throw Error('Offline caching is unavailable in this browser. Keep the server download for local use.');
 $('cacheStatus').textContent='Caching the app and firmware…';
 await registerWorker();const reg=await navigator.serviceWorker.ready;
 await new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>reject(Error('Caching timed out. Check your connection and try again.')),60000);channel.port1.onmessage=e=>{clearTimeout(timer);e.data.ok?resolve():reject(Error(e.data.error));};reg.active.postMessage({type:'CACHE_ALL'},[channel.port2]);});
 $('cacheStatus').textContent='App and firmware cached for offline use on this browser.';
}
$('cacheButton').addEventListener('click',()=>prepareOffline().catch(e=>$('cacheStatus').textContent=e.message));
async function init(){
 const expected=document.documentElement.dataset.appVersion;
 if(expected&&expected!==VERSION){window.yetiBoot?.fail('Mixed app files: page '+expected+', script '+VERSION+'. Open Refresh app files before connecting.');return;}
 log('YetiYell app '+VERSION+'; required firmware '+FIRMWARE_VERSION+'; '+window.location.href);
 for(let i=1;i<=11;i++){const o=document.createElement('option');o.value=i;o.textContent='Channel '+i;$('channel').append(o);} $('channel').value='6';
 refreshUSB();
 try{
  const response=await fetch('./profiles.json');if(!response.ok)throw Error('Profile library is missing.');const data=await response.json();profiles=data.profiles;catalogHash=data.catalog;
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)workspace=restoreWorkspace(JSON.parse(raw),profiles);}catch(e){message('Saved workspace could not be restored: '+e.message,true);}
  for(const r of workspace.runs)if(['running','starting'].includes(r.state)){r.state='interrupted';r.reason='Page reloaded before the run ended';}
  $('detectorVersion').value=workspace.detectorVersion;selectProfile(profiles[0]);renderResults();
  lab=initWorkflow({profiles,workspace:()=>workspace,save,message,download,tab,device:()=>device,ready:deviceReady,idle:()=>!activeRun&&!busy&&!flashBusy,transmit:transmitStep,stop:stopTransmission,refresh:updateControls,results:renderResults});save();
 }catch(e){message(e.message,true);window.yetiBoot?.fail('YetiYell could not load its workspace or profiles: '+e.message);return;}
 appReady=true;window.yetiBoot?.ready();updateControls();
 try{flasher=await import('./flasher.mjs');release=await flasher.loadRelease();$('releaseVersion').textContent='v'+release.manifest.version+' · ready';}
 catch(e){$('releaseVersion').textContent='Unavailable';log(e.message);message(e.message,true);}
 updateControls();
 if(globalThis.isSecureContext&&window.location.protocol!=='file:'&&'serviceWorker'in navigator)registerWorker().catch(e=>log('Offline cache: '+e.message));
}
$('boardSelect').addEventListener('change',async()=>{const target=$('boardSelect').value;release=null;updateControls();$('releaseVersion').textContent='Checking firmware…';try{const loaded=await flasher.loadRelease(target);if($('boardSelect').value!==target)return;release=loaded;$('releaseVersion').textContent='v'+release.manifest.version+' · ready';}catch(e){$('releaseVersion').textContent='Unavailable';message(e.message,true);}updateControls();});
async function registerWorker(){
 const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
 function waiting(){if(reg.waiting){pendingWorker=reg.waiting;$('updateNotice').hidden=false;}}
 waiting();reg.addEventListener('updatefound',()=>{reg.installing?.addEventListener('statechange',waiting);});return reg;
}
$('applyUpdate').addEventListener('click',async()=>{if(activeRun||flashBusy||busy||pickingFor||lab?.runner.active){message('Finish flashing or stop the active session before updating.',true);return;}if(!pendingWorker)return;await serial.disconnect();navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});pendingWorker.postMessage({type:'APPLY_UPDATE'});});
init().catch(e=>{message(e.message,true);window.yetiBoot?.fail('YetiYell could not start: '+e.message);});
