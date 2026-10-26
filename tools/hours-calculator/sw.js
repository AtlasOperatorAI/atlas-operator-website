/* Offline cache for /tools/hours-calculator/. Same-origin app shell only. Analytics (Railway) is never cached. */
const CACHE="atlas-hours-calculator-v1";
const SCOPE="/tools/hours-calculator/";
const ASSETS=[SCOPE,SCOPE+"hours.js",SCOPE+"manifest.webmanifest",SCOPE+"icons/icon-192.png",SCOPE+"icons/icon-512.png",SCOPE+"icons/maskable-512.png","/t.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("atlas-hours-calculator-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  if(r.mode==="navigate"||(r.headers.get("accept")||"").includes("text/html")){
    e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(SCOPE,cp))}return res}).catch(()=>caches.match(SCOPE)));
    return;
  }
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>{const net=fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res}).catch(()=>hit);return hit||net}));
});
