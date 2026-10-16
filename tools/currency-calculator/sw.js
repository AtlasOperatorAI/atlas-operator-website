/* Offline cache for /tools/currency-calculator/. Same-origin app shell + the daily rate files (last-known rates for offline use). Analytics (Railway) and Stripe are never cached. */
const CACHE="atlas-currency-calculator-v1";
const SCOPE="/tools/currency-calculator/";
const ASSETS=[SCOPE,SCOPE+"cur.js",SCOPE+"manifest.webmanifest",SCOPE+"icons/icon-192.png",SCOPE+"icons/icon-512.png",SCOPE+"icons/maskable-512.png","/t.js"];
const RATE_HOSTS=["cdn.jsdelivr.net","latest.currency-api.pages.dev","api.frankfurter.dev"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("atlas-currency-calculator-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET")return;
  if(RATE_HOSTS.includes(u.hostname)){
    /* rates: network-first, keep the last good copy for offline */
    e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r.url,cp))}return res}).catch(()=>caches.match(r.url).then(h=>h||Response.error())));
    return;
  }
  if(u.origin!==location.origin)return; /* analytics, Stripe, anything else cross-origin: straight to network */
  if(r.mode==="navigate"||(r.headers.get("accept")||"").includes("text/html")){
    e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(SCOPE,cp))}return res}).catch(()=>caches.match(SCOPE)));
    return;
  }
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>{const net=fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res}).catch(()=>hit);return hit||net}));
});
