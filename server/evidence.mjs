const MAC=/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i;
const TYPES=new Set(['FLOCK','AXON','META','SKIMMER','RAVEN','AIRTAG','DRONE','ALPR','CAMERA','SAMSUNG_TAG','GOOGLE_TAG','TILE','RING','DEAUTH','EVIL TWIN','IBEACON','HACKER','UNKNOWN']);
export function parseReceiverLog(text,source='receiver.log'){
 if(text.length>2_000_000)throw Error('Receiver logs must be smaller than 2 MB.');
 const rows=[],rejected=[];
 text.replace(/^\uFEFF/,'').split(/\r?\n/).forEach((raw,i)=>{
  if(!raw.trim()||/^#/.test(raw))return;
  const cells=raw.split(',');const [time,type,rssi,mac,channel]=cells;
  if(/^time(stamp)?$/i.test(time))return;
  if(![7,10].includes(cells.length)||!TYPES.has(type)||!MAC.test(mac)||!/^(-?\d+)$/.test(rssi)||+rssi>0||+rssi< -127||!/^\d+$/.test(channel)||+channel>196||!(/^\d+$/.test(time)||(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(time)&&Number.isFinite(Date.parse(time))))){rejected.push(i+1);return;}
  rows.push({id:crypto.randomUUID(),source:source.slice(0,200),row:i+1,time,type,mac:mac.toUpperCase(),rssi:+rssi,raw:raw.slice(0,1000)});
 });
 if(rows.length>5000)throw Error('Use a receiver log with at most 5,000 valid rows.');
 if(!rows.length)throw Error('No supported SquachWatch SD log rows found. Expected time,type,rssi,mac,channel,vendor,name (optional GPS columns).');
 return {rows,rejected};
}
export function correlateEvidence(runs,rows,{offsetSeconds=0,bootEpoch='',tolerance=2}={}){
 if(!Number.isFinite(offsetSeconds)||Math.abs(offsetSeconds)>86400||!Number.isFinite(tolerance)||tolerance<0||tolerance>30)throw Error('Invalid clock offset or tolerance.');
 const epoch=bootEpoch?Date.parse(bootEpoch):NaN;
 return runs.map(run=>{
  const start=Date.parse(run.startedAt||run.date),end=Date.parse(run.endedAt||'');
  const candidates=rows.filter(row=>{
   if(!run.mac||row.mac.toUpperCase()!==run.mac.toUpperCase()||!Number.isFinite(start)||!Number.isFinite(end))return false;
   const time=/^\d+$/.test(row.time)?epoch+Number(row.time):Date.parse(row.time);
   const adjusted=time+offsetSeconds*1000;
   return Number.isFinite(adjusted)&&adjusted>=start-tolerance*1000&&adjusted<=end+tolerance*1000;
  });
  const unique=candidates.filter(row=>runs.filter(r=>r.mac?.toUpperCase()===row.mac&&Date.parse(r.startedAt||r.date)-tolerance*1000<=((/^\d+$/.test(row.time)?epoch+Number(row.time):Date.parse(row.time))+offsetSeconds*1000)&&Date.parse(r.endedAt||'')+tolerance*1000>=((/^\d+$/.test(row.time)?epoch+Number(row.time):Date.parse(row.time))+offsetSeconds*1000)).length===1);
  const types=[...new Set(unique.map(x=>x.type))];
  return {runId:run.id,candidates:unique,ambiguous:candidates.length!==unique.length||types.length>1,suggested:types.length===1?types[0]:'',status:!candidates.length?'No evidence':candidates.length!==unique.length||types.length>1?'Review ambiguity':'Candidate match'};
 });
}
export function compareSessions(runs,baseline,current){
 const group=id=>{const m=new Map();for(const r of runs.filter(r=>r.sessionId===id)){const k=JSON.stringify([r.profile,r.duration,r.power,r.channel,r.interval,r.benchNotes||'']);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
 const a=group(baseline),b=group(current);
 return [...new Set([...a.keys(),...b.keys()])].map(key=>{
  const left=a.get(key)||[],right=b.get(key)||[];
  const score=xs=>({total:xs.length,pass:xs.filter(r=>r.verdict==='pass').length,fail:xs.filter(r=>r.verdict==='fail').length,pending:xs.filter(r=>['unreviewed','inconclusive'].includes(r.verdict)).length});
  const A=score(left),B=score(right);
  return {profile:(right[0]||left[0]).profileName,settings:JSON.parse(key).slice(1,5).join(' / '),baseline:A,current:B,result:!A.total||!B.total?'Missing counterpart':A.total!==B.total?'Different sample counts':A.pending||B.pending?'Needs review':B.fail>A.fail?'Regression':B.fail<A.fail?'Improvement':'Unchanged'};
 });
}
