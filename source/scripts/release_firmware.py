#!/usr/bin/env python3
import hashlib,json,pathlib,shutil
root=pathlib.Path(__file__).resolve().parents[1]
release=json.loads((root/'release.json').read_text())
catalog=json.loads((root/'dist/profiles.json').read_text())
platformio=pathlib.Path.home()/'.platformio/packages'
boot_app=platformio/'framework-arduinoespressif32/tools/partitions/boot_app0.bin'
for env,chip,boot,size,freq in [('esp32dev','ESP32',0x1000,'4MB','40m'),('esp32c3','ESP32-C3',0,'4MB','40m'),('esp32s3','ESP32-S3',0,'8MB','80m')]:
 build=root/'firmware/.pio/build'/env
 out=root/'dist/firmware'/('' if env=='esp32dev' else env);out.mkdir(parents=True,exist_ok=True)
 parts=[]
 for source,name,offset in [(build/'bootloader.bin','bootloader.bin',boot),(build/'partitions.bin','partitions.bin',0x8000),(boot_app,'boot_app0.bin',0xe000),(build/'firmware.bin','firmware.bin',0x10000)]:
  data=source.read_bytes();(out/name).write_bytes(data);parts.append(dict(file=name,offset=offset,size=len(data),sha256=hashlib.sha256(data).hexdigest()))
 manifest=dict(name='YetiYell',version=release['version'],protocol=1,board=env,chip=chip,flashSize=size,flashMode='dio',flashFreq=freq,parts=parts,hardwareValidated=False,catalog=catalog['catalog'],build=dict(platform='espressif32@6.10.0',arduino='2.0.17',nimble='1.4.3',arduinojson='6.21.5',usb='UART'))
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(env,parts[-1]['size'],'bytes',parts[-1]['sha256'])
licenses=root/'firmware/licenses';licenses.mkdir(parents=True,exist_ok=True)
for folder,prefix in [(platformio/'framework-arduinoespressif32','arduino-esp32'),(root/'firmware/.pio/libdeps/esp32dev/NimBLE-Arduino','nimble-arduino'),(root/'firmware/.pio/libdeps/esp32dev/ArduinoJson','arduinojson')]:
 for p in folder.glob('*'):
  if p.is_file() and (p.name.upper().startswith('LICENSE') or p.name.upper().startswith('COPYING')):shutil.copy2(p,licenses/(prefix+'-'+p.name))
