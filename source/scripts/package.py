#!/usr/bin/env python3
import pathlib,zipfile,json,subprocess,hashlib
root=pathlib.Path(__file__).resolve().parents[1]
subprocess.run(['python3',str(root/'scripts/release_gate.py')],check=True)
version=json.loads((root/'release.json').read_text())['version'];name=f'YetiYell-v{version}.zip'
out=root/'dist/downloads';out.mkdir(parents=True,exist_ok=True)
(out/'README.txt').write_text(f'To enable the in-app package download on your host, copy the original {name} into this downloads directory. All operating features work without this optional copy. The ZIP does not contain a recursive copy of itself.\n')
archive=out/name;entries={};prefix=f'YetiYell-v{version}/'
for p in sorted((root/'dist').rglob('*')):
 if p.is_file() and not p.name.endswith('.zip'):
  rel=p.relative_to(root/'dist');entries[prefix+'server/'+str(rel)]=p;entries[prefix+'source/dist/'+str(rel)]=p
for folder in ['firmware','scripts','tests','examples','validation']:
 for p in sorted((root/folder).rglob('*')):
  if p.is_file() and '.pio' not in p.parts and '__pycache__' not in p.parts:entries[prefix+'source/'+str(p.relative_to(root))]=p
for p in sorted(root.iterdir()):
 if p.is_file() and (p.suffix in ['.md','.json','.csv'] or p.name in ['LICENSE','.gitignore']):
  entries[prefix+'source/'+p.name]=p
  if p.suffix in ['.md','.csv'] or p.name in ['LICENSE','release.json']:entries[prefix+p.name]=p
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,p in sorted(entries.items()):
  info=zipfile.ZipInfo(name,date_time=(2026,10,20,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,p.read_bytes())
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
print(archive);print(f'{archive.stat().st_size:,} bytes; SHA-256 {hashlib.sha256(archive.read_bytes()).hexdigest()}')
