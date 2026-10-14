export const VERSION='1.0.0-rc.4';
export const FIRMWARE_VERSION='1.0.0-rc.4';
export const STORAGE_KEY='yetiyell.workspace.v1';
export function validateSettings(input,radio){
 const s={duration:Number(input.duration),channel:Number(input.channel),power:Number(input.power),interval:Number(input.interval)};
 if(!Number.isInteger(s.duration)||s.duration<5||s.duration>120)throw Error('Choose a duration from 5 to 120 seconds.');
 if(!Number.isInteger(s.channel)||s.channel<1||s.channel>11)throw Error('Choose a Wi-Fi channel from 1 to 11.');
 if(!Number.isInteger(s.interval)||s.interval<100||s.interval>2000)throw Error('BLE interval must be 100–2000 ms.');
 if(!(radio==='Wi-Fi'?[2,5,8]:[-12,-6,0,3]).includes(s.power))throw Error('Choose a supported transmit power.');
 return s;
}
export function csvCell(value){const s=String(value??'');const safe=/^[=+@\-\t\r]/.test(s)?"'"+s:s;return '"'+safe.replaceAll('"','""')+'"';}
export function reportCSV(runs){
 const fields=['id','date','profileName','radio','expected','observed','verdict','rssi','latency','duration','power','channel','interval','state','reason','mac','firmware','detectorVersion','sessionId','board','catalog','benchNotes','startedAt','endedAt','observationSource','evidenceSource','evidenceRow','evidenceTime','clockOffset','receiverBoot','notes'];
 return [fields.join(','),...runs.map(r=>fields.map(k=>csvCell(r[k])).join(','))].join('\r\n');
}
export function validateWorkspace(data,knownIds){
 if(data?.schema!==1||!Array.isArray(data.runs)||data.runs.length>1000)throw Error('Use a YetiYell workspace JSON file with at most 1,000 runs.');
 const seen=new Set();
 for(const r of data.runs){
  if(!r||typeof r.id!=='string'||seen.has(r.id)||!knownIds.includes(r.profile)||typeof r.date!=='string'||isNaN(Date.parse(r.date)))throw Error('The file contains an invalid or duplicate run.');
  seen.add(r.id);
  for(const [k,v]of Object.entries(r))if(typeof v==='object'||String(v).length>5000)throw Error('A run contains unsupported data.');
  if(!['unreviewed','pass','fail','inconclusive'].includes(r.verdict))throw Error('A run has an invalid verdict.');
 }
 return {schema:1,detectorVersion:String(data.detectorVersion||'').slice(0,100),runs:data.runs.map(r=>({...r,state:['running','starting'].includes(r.state)?'interrupted':r.state}))};
}
export function makeRun(profile,settings,firmware,detectorVersion,id=crypto.randomUUID()){
 return {id,date:new Date().toISOString(),profile:profile.id,profileName:profile.name,radio:profile.radio,expected:profile.expected,observed:'',verdict:'unreviewed',rssi:'',latency:'',notes:'',...settings,firmware,detectorVersion,state:'starting',reason:'',mac:''};
}
export function matchVerdict(expected,observed){return observed===''?'unreviewed':expected===observed?'pass':'fail';}
