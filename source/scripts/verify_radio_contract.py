#!/usr/bin/env python3
"""Check the firmware's advertising mode with pinned NimBLE's actual validator.

Usage: python3 scripts/verify_radio_contract.py [NimBLE-Arduino directory] [main.cpp]
Uses installed 1.4.3 sources as a separate native oracle; no radio is simulated.
Only connection allocation and the idle GAP state are stubbed. The library's
setter and parameter validator are copied verbatim into a temporary test.
"""
import pathlib,re,subprocess,sys,tempfile

root=pathlib.Path(__file__).resolve().parents[1]
lib=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'firmware/.pio/libdeps/esp32dev/NimBLE-Arduino'
main=pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else root/'firmware/src/main.cpp'
assert 'version=1.4.3' in (lib/'library.properties').read_text(),'Requires pinned NimBLE-Arduino 1.4.3'
src=lib/'src'
gap=(src/'nimble/nimble/host/src/ble_gap.c').read_text()
advertising=(src/'NimBLEAdvertising.cpp').read_text()

def function(text,signature):
 start=text.index(signature);begin=text.index('{',start);depth=1;end=begin+1
 while depth:
  if text[end]=='{':depth+=1
  elif text[end]=='}':depth-=1
  end+=1
 return text[start:end]

validate='static int\n'+function(gap,'ble_gap_adv_validate(')
setter='void '+function(advertising,'NimBLEAdvertising::setAdvertisementType(')
names=['BLE_HS_EINVAL','BLE_HS_ENOMEM','BLE_HS_EALREADY','BLE_HCI_ADV_OWN_ADDR_MAX',
 'BLE_ADDR_PUBLIC','BLE_ADDR_RANDOM','BLE_ADDR_PUBLIC_ID','BLE_ADDR_RANDOM_ID',
 'BLE_GAP_OP_NULL','BLE_GAP_DISC_MODE_MAX','BLE_GAP_DISC_MODE_NON',
 'BLE_GAP_CONN_MODE_NON','BLE_GAP_CONN_MODE_DIR','BLE_GAP_CONN_MODE_UND',
 'BLE_HCI_ADV_TYPE_ADV_NONCONN_IND']
headers='\n'.join(p.read_text() for p in (src/'nimble/nimble').rglob('*.h'))+'\n'+gap
defines=[]
for name in names:
 match=re.search(r'^#define\s+'+name+r'\s+(\(?\s*(?:0x[0-9a-fA-F]+|\d+)\s*\)?)\s*$',headers,re.M)
 assert match,'Missing numeric constant: '+name
 defines.append('#define '+name+' '+match[1])
calls=re.findall(r'advertiser->setAdvertisementType\((\w+)\)',main.read_text())
assert len(calls)==1,'Expected one production advertising-mode configuration'
assert calls[0] in names,'Unknown advertising-mode expression'
test='''
#include <cstdint>
#include <cassert>
#include <cstdio>
DEFINES
struct ble_addr_t { uint8_t type; uint8_t val[6]; };
struct ble_gap_adv_params { uint8_t conn_mode,disc_mode,high_duty_cycle; };
struct { int op; } ble_gap_slave[1]={{BLE_GAP_OP_NULL}};
int ble_hs_conn_can_alloc(){return 1;}
class NimBLEAdvertising { public: ble_gap_adv_params m_advParams{}; void setAdvertisementType(uint8_t); };
SETTER
VALIDATE
int main(){
 NimBLEAdvertising adv;
 adv.m_advParams.disc_mode=BLE_GAP_DISC_MODE_NON;
 adv.setAdvertisementType(BLE_HCI_ADV_TYPE_ADV_NONCONN_IND);
 assert(ble_gap_adv_validate(BLE_ADDR_RANDOM,nullptr,&adv.m_advParams)==BLE_HS_EINVAL);
 adv.setAdvertisementType(PRODUCTION);
 assert(adv.m_advParams.conn_mode==BLE_GAP_CONN_MODE_NON);
 assert(ble_gap_adv_validate(BLE_ADDR_RANDOM,nullptr,&adv.m_advParams)==0);
 adv.m_advParams.high_duty_cycle=1;
 assert(ble_gap_adv_validate(BLE_ADDR_RANDOM,nullptr,&adv.m_advParams)==BLE_HS_EINVAL);
 puts("NimBLE 1.4.3 contract: old HCI mode rejected; production GAP mode accepted; invalid high-duty mode rejected.");
}
'''.replace('DEFINES','\n'.join(defines)).replace('SETTER',setter).replace('VALIDATE',validate).replace('PRODUCTION',calls[0])
with tempfile.TemporaryDirectory(prefix='yetiyell-radio-contract-') as tmp:
 p=pathlib.Path(tmp);(p/'test.cpp').write_text(test)
 subprocess.run(['g++','-std=c++11',str(p/'test.cpp'),'-o',str(p/'test')],check=True)
 subprocess.run([str(p/'test')],check=True)
