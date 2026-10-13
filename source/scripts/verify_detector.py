#!/usr/bin/env python3
"""Validate profile fixtures with pinned upstream signature lookup code, not RF.
Usage: python3 scripts/verify_detector.py [/path/to/reference/headers-and-cpp]
Without a path, fetch the pinned reference into a temporary directory.
The upstream code is GPL-3.0; it is used only as a separate test oracle here.
"""
import json,pathlib,subprocess,sys,tempfile,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'dist/profiles.json').read_text());commit=data['source']['commit']
with tempfile.TemporaryDirectory(prefix='yetiyell-oracle-') as tmp:
 out=pathlib.Path(tmp);ref=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else out
 if len(sys.argv)<2:
  for src in ['src/signatures.cpp','include/signatures.h','include/state.h']:
   url=f'https://raw.githubusercontent.com/skizzophrenic/SquachWatch-CYD/{commit}/{src}'
   (ref/pathlib.Path(src).name).write_bytes(urllib.request.urlopen(url,timeout=30).read())
 lines=['#include "signatures.h"','#include <assert.h>','#include <string.h>','#include <stdio.h>','int main(){']
 for p in data['profiles']:
  lines+=['{ DetectionType actual=DetectionType::UNKNOWN;']
  if p.get('macPrefix'):
   b=[int(x,16) for x in p['macPrefix'].split(':')]+[0,0,1];lines += ['uint8_t mac[]={'+','.join(map(str,b))+'}; actual=lookupOui(mac);']
  elif p.get('ssid'):lines += ['actual=lookupSsid('+json.dumps(p['ssid'])+');']
  elif p.get('uuid'):lines += ['actual=lookupUuid(0x'+p['uuid']+');']
  elif p.get('nameField'):lines += ['actual=lookupBtName('+json.dumps(p['nameField'])+');']
  elif p.get('mfg'):
   b=bytes.fromhex(p['mfg']);raw=bytes([len(b)+1,255])+b
   lines+=['uint8_t mfg[]={'+','.join(map(str,b))+'}; uint8_t raw[]={'+','.join(map(str,raw))+'};','actual=lookupMfgId(mfg[0]|(mfg[1]<<8)); if(actual==DetectionType::AIRTAG&&!isAirTagPayload(raw,sizeof(raw)))actual=isIBeacon(mfg,sizeof(mfg))?DetectionType::IBEACON:DetectionType::UNKNOWN;']
  expected=p['expected'] if p['expected']!='NONE' else 'UNKNOWN'
  lines+=['if(actual!=DetectionType::'+expected+'){fprintf(stderr,"Failed: '+p['id']+' -> %s\\n",detectionTypeName(actual));return 1;} }']
 lines+=['assert(!isAirTagPayload(nullptr,0));','assert(!isIBeacon(nullptr,0));','assert(lookupBtName("123456789")==DetectionType::UNKNOWN);','assert(lookupBtName("12345678901")==DetectionType::UNKNOWN);','assert(lookupSsid("Flockhart Family WiFi")==DetectionType::UNKNOWN);','assert(lookupUuid(0x3084)==DetectionType::UNKNOWN);','assert(lookupUuid(0x3101)==DetectionType::UNKNOWN);',f'puts("{len(data["profiles"])} profile lookup checks and 7 boundary checks passed against {commit}");','}']
 source=out/'oracle.cpp';source.write_text('\n'.join(lines)+'\n')
 subprocess.run(['g++','-std=c++11','-I',str(ref),str(source),str(ref/'signatures.cpp'),'-o',str(out/'oracle')],check=True)
 subprocess.run([str(out/'oracle')],check=True)
