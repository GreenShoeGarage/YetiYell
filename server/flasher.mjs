import {ESPLoader,Transport,md5} from './vendor/esptool.bundle.mjs';
import {BOARDS,normalizeChip} from './compat.mjs';
import {FIRMWARE_VERSION} from './core.mjs';
export async function loadRelease(boardId='esp32dev'){
 const board=BOARDS[boardId];if(!board)throw Error('Unknown board target.');
 const r=await fetch(board.directory+'manifest.json',{cache:'no-cache'});if(!r.ok)throw Error('Bundled firmware is missing. Restore the complete YetiYell server folder.');
 const manifest=await r.json();
 if(manifest.name!=='YetiYell'||manifest.chip!==board.chip||manifest.version!==FIRMWARE_VERSION||manifest.protocol!==1||manifest.flashSize!==board.flashSize||manifest.flashFreq!==board.flashFreq||manifest.flashMode!=='dio'||!Array.isArray(manifest.parts)||manifest.parts.length!==4)throw Error('Firmware does not match this app or board. Reload the complete release.');
 if(manifest.parts.map(p=>p.offset).join(',')!==[board.boot,32768,57344,65536].join(','))throw Error('Invalid firmware memory map.');
 const files=[];let end=0;
 for(const part of manifest.parts){
  if(!/^[-_a-z0-9.]+\.bin$/.test(part.file)||!Number.isInteger(part.size)||part.size<=0||part.offset<end||part.offset+part.size>0x310000)throw Error('Invalid firmware part.');
  end=part.offset+part.size;
  const r=await fetch(board.directory+part.file);if(!r.ok)throw Error('Firmware file missing: '+part.file);
  const data=new Uint8Array(await r.arrayBuffer());
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==part.sha256||data.length!==part.size)throw Error('Firmware integrity check failed: '+part.file);
  files.push({data,address:part.offset});
 }
 return {manifest,files,boardId};
}
export function checkTarget(chip,capacity,manifest){
 if(normalizeChip(chip)!==manifest.chip)throw Error('Selected '+manifest.chip+' but found '+chip+'. Choose the matching board. No firmware was written.');
 if(capacity!==manifest.flashSize)throw Error('This build requires '+manifest.flashSize+' flash. Detected '+capacity+'. No firmware was written.');
}
export async function flashBoard(port,release,{log=()=>{},progress=()=>{},baudrate=460800}={}){
 const transport=new Transport(port,true);
 const loader=new ESPLoader({transport,baudrate,romBaudrate:115200,terminal:{clean(){},write:log,writeLine:log},debugLogging:false});
 try{
  await loader.main();checkTarget(loader.chip?.CHIP_NAME,await loader.detectFlashSize(),release.manifest);
  await loader.writeFlash({fileArray:release.files,flashMode:release.manifest.flashMode,flashFreq:release.manifest.flashFreq,flashSize:release.manifest.flashSize,eraseAll:false,compress:true,calculateMD5Hash:md5,reportProgress:(i,written,total)=>progress(i,written,total)});
  await loader.after('hard_reset');
 }finally{await transport.disconnect().catch(()=>{});}
}
