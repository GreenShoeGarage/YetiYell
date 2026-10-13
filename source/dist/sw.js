const CACHE='yetiyell-1.0.0-rc.1';
const BASE=new URL('./',self.location.href);
const FILES=["./", "./app.mjs", "./compat.mjs", "./core.mjs", "./evidence.mjs", "./firmware/boot_app0.bin", "./firmware/bootloader.bin", "./firmware/esp32c3/boot_app0.bin", "./firmware/esp32c3/bootloader.bin", "./firmware/esp32c3/firmware.bin", "./firmware/esp32c3/manifest.json", "./firmware/esp32c3/partitions.bin", "./firmware/esp32s3/boot_app0.bin", "./firmware/esp32s3/bootloader.bin", "./firmware/esp32s3/firmware.bin", "./firmware/esp32s3/manifest.json", "./firmware/esp32s3/partitions.bin", "./firmware/firmware.bin", "./firmware/manifest.json", "./firmware/partitions.bin", "./flasher.mjs", "./icon.svg", "./index.html", "./manifest.webmanifest", "./profiles.json", "./serial.mjs", "./style.css", "./suites.mjs", "./vendor/atob-lite-LICENSE", "./vendor/crypto-js-LICENSE", "./vendor/esptool-js-LICENSE", "./vendor/esptool.bundle.mjs", "./vendor/pako-LICENSE", "./workflow-ui.mjs", "./workspace.mjs"];

const absolute=FILES.map(f=>new URL(f,BASE).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(absolute))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(event.data?.type==='APPLY_UPDATE')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='CACHE_ALL')event.waitUntil(caches.open(CACHE).then(async c=>{for(const url of absolute)if(!await c.match(url))throw Error('Offline cache is incomplete. Reconnect and install an updated release.');}).then(()=>event.ports[0]?.postMessage({ok:true})).catch(e=>event.ports[0]?.postMessage({ok:false,error:e.message})));
});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||!absolute.includes(event.request.url))return;event.respondWith(caches.open(CACHE).then(async c=>(await c.match(event.request))||fetch(event.request)));});
