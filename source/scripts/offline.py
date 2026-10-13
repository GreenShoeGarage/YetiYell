import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
version=json.loads((root/'release.json').read_text())['version']
files=['./']+['./'+str(p.relative_to(root/'dist')) for p in sorted((root/'dist').rglob('*')) if p.is_file() and 'downloads' not in p.parts and p.name!='sw.js']
s="const CACHE='yetiyell-"+version+"';\nconst BASE=new URL('./',self.location.href);\nconst FILES="+json.dumps(files)+";\n"+'''
const absolute=FILES.map(f=>new URL(f,BASE).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(absolute))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(event.data?.type==='APPLY_UPDATE')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='CACHE_ALL')event.waitUntil(caches.open(CACHE).then(async c=>{for(const url of absolute)if(!await c.match(url))throw Error('Offline cache is incomplete. Reconnect and install an updated release.');}).then(()=>event.ports[0]?.postMessage({ok:true})).catch(e=>event.ports[0]?.postMessage({ok:false,error:e.message})));
});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||!absolute.includes(event.request.url))return;event.respondWith(caches.open(CACHE).then(async c=>(await c.match(event.request))||fetch(event.request)));});
'''
(root/'dist/sw.js').write_text(s)
print('Offline assets:',len(files))
