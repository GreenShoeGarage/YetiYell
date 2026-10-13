import json,pathlib,hashlib
root=pathlib.Path(__file__).resolve().parents[1]
catalog=json.loads((root/'dist/profiles.json').read_text());profiles=catalog['profiles']
catalog['catalog']=hashlib.sha256(json.dumps(profiles,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:16]
(root/'dist/profiles.json').write_text(json.dumps(catalog,indent=2)+'\n')
lines=['#pragma once','#include <stdint.h>','struct Profile { const char* id; bool wifi; const char* expected; uint16_t uuid; const char* uuid128; const char* name; const char* mfgHex; const char* ssid; const char* macPrefix; bool flags; };','static const Profile profiles[] = {']
for p in profiles:
 vals=[json.dumps(p['id']),'true' if p['radio']=='Wi-Fi' else 'false',json.dumps(p['expected']),'0x'+p.get('uuid','0000')]+[json.dumps(p.get(k,'')) for k in ['uuid128','nameField','mfg','ssid','macPrefix']]+['true' if p.get('flags',True) else 'false']
 lines.append('  {'+', '.join(vals)+'},')
lines+=['};','static const char* PROFILE_CATALOG = '+json.dumps(catalog['catalog'])+';','static constexpr unsigned PROFILE_COUNT = sizeof(profiles) / sizeof(profiles[0]);']
(root/'firmware/src/profiles.h').write_text('\n'.join(lines)+'\n')
