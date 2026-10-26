/* Offline cache for /tools/area-calculator/. Same-origin GET only; analytics (Railway) and Stripe are never cached. */
const CACHE="atlas-area-calculator-v5";
const SCOPE="/tools/area-calculator/";
const ASSETS=[SCOPE,SCOPE+"fic.js",SCOPE+"area.js",SCOPE+"manifest.webmanifest",SCOPE+"icons/icon-192.png",SCOPE+"icons/icon-512.png",SCOPE+"icons/maskable-512.png","/t.js","/tools/play.js","/tools/easy.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("atlas-area-calculator-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return; /* analytics, Stripe, anything cross-origin: straight to network */
  if(r.mode==="navigate"||(r.headers.get("accept")||"").includes("text/html")){
    /* network-first for HTML so updates show up; fall back to cached page offline */
    e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(SCOPE,cp))}return res}).catch(()=>caches.match(SCOPE)));
    return;
  }
  /* stale-while-revalidate for JS/CSS/icons */
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>{const net=fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res}).catch(()=>hit);return hit||net}));
});
