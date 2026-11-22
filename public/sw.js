const CACHE='volna-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'])));});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('volna-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.headers.has('range')){
  if(!url.pathname.endsWith('/wave-loop.mp4'))return;
  event.respondWith((async()=>{const hit=await caches.match(url.href,{ignoreVary:true});if(!hit)return fetch(req);const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.get('range')||'');if(!range)return hit;const bytes=await hit.arrayBuffer(),start=+range[1],end=Math.min(range[2]?+range[2]:bytes.byteLength-1,bytes.byteLength-1);if(start>end)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes.byteLength}`}});return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':'video/mp4','Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${bytes.byteLength}`,'Accept-Ranges':'bytes'}});})());return;
 }
 if(req.mode==='navigate'){
  event.respondWith((async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);try{const r=await fetch(req,{signal:controller.signal});if(!r.ok)throw new Error('Navigation unavailable');const copy=r.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put('./',copy)).catch(()=>{}));return r;}catch{const cached=await caches.match('./',{ignoreVary:true});return cached||new Response('Нет соединения. Открой wave с интернетом для первого запуска.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}finally{clearTimeout(timer);}})());return;
 }
 event.respondWith(caches.match(req,{ignoreVary:true}).then(hit=>hit||fetch(req).then(r=>{if(r.status===200&&['script','style','image','font','manifest','video'].includes(req.destination)){const copy=r.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{}));}return r;})));
});
