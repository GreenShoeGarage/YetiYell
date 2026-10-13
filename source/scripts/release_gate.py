#!/usr/bin/env python3
"""Static release consistency gate. Run functional tests separately first."""
import json,pathlib,hashlib,re
root=pathlib.Path(__file__).resolve().parents[1]
release=json.loads((root/'release.json').read_text());v=release['version']
assert json.loads((root/'package.json').read_text())['version']==v
assert json.loads((root/'package-lock.json').read_text())['version']==v
assert f"VERSION='{v}'" in (root/'dist/core.mjs').read_text()
assert f'VERSION = "{v}"' in (root/'firmware/src/main.cpp').read_text()
assert v in (root/'dist/index.html').read_text()
assert f"yetiyell-{v}" in (root/'dist/sw.js').read_text()
if '-' not in v:
 assert release.get('hardwareValidated') is True,'Stable release blocked: physical acceptance is not validated.'
 evidence=root/'validation/approved-evidence.json'
 assert evidence.exists(),'Stable release needs approved bench evidence.'
 approval=json.loads(evidence.read_text())
 assert approval.get('version')==v and approval.get('reviewer') and approval.get('approved') is True
 assert all(approval.get('targets',{}).get(k,{}).get('passed') is True and approval['targets'][k].get('evidence') for k in ['esp32dev','esp32c3','esp32s3'])
catalog=json.loads((root/'dist/profiles.json').read_text())
assert catalog['catalog']==hashlib.sha256(json.dumps(catalog['profiles'],sort_keys=True,separators=(',',':')).encode()).hexdigest()[:16]
assert catalog['catalog'] in (root/'firmware/src/profiles.h').read_text()
for env,chip,offset,capacity,freq,chipid in [('esp32dev','ESP32',4096,'4MB','40m',0),('esp32c3','ESP32-C3',0,'4MB','40m',5),('esp32s3','ESP32-S3',0,'8MB','80m',9)]:
 folder=root/'dist/firmware'/('' if env=='esp32dev' else env);m=json.loads((folder/'manifest.json').read_text())
 assert (m['version'],m['chip'],m['flashSize'],m['flashFreq'],m['catalog'])==(v,chip,capacity,freq,catalog['catalog'])
 assert m['hardwareValidated']==release['hardwareValidated']
 assert [p['offset'] for p in m['parts']]==[offset,32768,57344,65536]
 end=0
 for p in m['parts']:
  b=(folder/p['file']).read_bytes();assert p['offset']>=end;end=p['offset']+len(b)
  assert len(b)==p['size'] and hashlib.sha256(b).hexdigest()==p['sha256']
  if p['file'] in ['bootloader.bin','firmware.bin']:assert b[0]==0xe9 and int.from_bytes(b[12:14],'little')==chipid
  if p['file']=='firmware.bin':assert v.encode() in b
 assert end<=0x310000
# Ensure all local ES module imports and registered cache URLs resolve.
for p in (root/'dist').glob('*.mjs'):
 for path in re.findall(r'''(?:from\s+|import\s*\()['"](\./[^'"]+)''',p.read_text()):assert (p.parent/path).exists(),path
sw=(root/'dist/sw.js').read_text();files=json.loads(re.search(r'const FILES=(\[.*?\]);',sw).group(1))
for f in files:assert (root/'dist'/f).exists(),f
for p in (root/'dist').rglob('*'):
 if p.is_file() and 'downloads' not in p.parts and p.name!='sw.js':assert './'+str(p.relative_to(root/'dist')) in files
print(f'{v}: version, catalog, three image headers/hashes/memory maps, module references and {len(files)} cached assets passed.')
print('Stable v1.0 gate: '+('eligible' if release['hardwareValidated'] else 'CLOSED — physical/browser/RF evidence outstanding.'))
