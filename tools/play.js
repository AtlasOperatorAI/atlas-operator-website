/* Google Play helpers (ASO 2026-10-26).
   App mode (inside the Play app): a one-time "Rate us" card after the 3rd use.
   Web mode: the official "Get it on Google Play" badge (downloaded 2026-10-26 from play.google.com/intl/en_us/badges/, hosted at /img/google-play-badge-en.png) plus the trademark line.
   Usage: <script src="/tools/play.js" data-pkg="ai.atlasoperator.xxx" defer></script>
   Both go right below the calculator. */
(function(root){
"use strict";
var USES=3;
function shouldShow(n,done){return !done&&n>=USES}
function playUrl(pkg){return "https://play.google.com/store/apps/details?id="+encodeURIComponent(pkg)}
function marketUrl(pkg){return "market://details?id="+encodeURIComponent(pkg)}
var api={USES:USES,shouldShow:shouldShow,playUrl:playUrl,marketUrl:marketUrl};
if(typeof module!=="undefined"&&module.exports){module.exports=api;return}
var d=document,s=d.currentScript||d.querySelector("script[data-pkg]"),pkg=s&&s.getAttribute("data-pkg");if(!pkg)return;
var TWA=false;try{TWA=/^android-app:\/\//.test(d.referrer)||new URLSearchParams(location.search).get("src")==="twa"||sessionStorage.getItem("atlas_twa")==="1";if(TWA)sessionStorage.setItem("atlas_twa","1")}catch(e){}
function css(t){var st=d.createElement("style");st.textContent=t;d.head.appendChild(st)}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
function onReady(f){if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",f);else f()}
function anchor(){
  /* Right below the calculator: currency's .app, an easy.js tool's main.ezbelow, or a guide's first calculator card. */
  var h=d.createElement("div"),x;
  if((x=d.querySelector("body > .app")))x.parentNode.insertBefore(h,x.nextSibling);
  else if((x=d.querySelector("main.ezbelow")))x.insertBefore(h,x.firstChild);
  else if((x=d.querySelector("main section.card")))x.parentNode.insertBefore(h,x.nextSibling);
  else{x=d.querySelector("footer");if(x)x.parentNode.insertBefore(h,x);else d.body.appendChild(h)}
  return h}
if(TWA){
  var kN="atlas_rate_n_"+pkg,kD="atlas_rate_done_"+pkg;
  var n=(parseInt(ls(kN),10)||0)+1;ls(kN,String(n));
  if(!shouldShow(n,ls(kD)==="1"))return;
  /* In page flow below the keypad, never fixed over it. */
  css("#ratecard{margin:14px 16px;background:#121826;color:#eef2f8;border:1px solid #2c3a55;border-radius:14px;padding:16px;font:16px/1.4 system-ui,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap}#ratecard p{margin:0;flex:1 1 100%;font-weight:600}#ratecard button{font:inherit;border-radius:10px;padding:10px 16px;border:0;cursor:pointer}#ratego{background:#8ab4ff;color:#07090e;font-weight:700}#rateno{background:#232c3f;color:#eef2f8}");
  onReady(function(){
    var c=anchor();c.id="ratecard";c.setAttribute("role","region");c.setAttribute("aria-label","Rate this app");
    c.innerHTML='<p>Finding this app useful? A rating on Google Play helps others find it.</p><button id="ratego" type="button">Rate on Google Play</button><button id="rateno" type="button">No thanks</button>';
    function close(){ls(kD,"1");if(c.parentNode)c.parentNode.removeChild(c)}
    d.getElementById("rateno").onclick=close;
    d.getElementById("ratego").onclick=function(){close();var t=setTimeout(function(){location.href=playUrl(pkg)},1500);
      d.addEventListener("visibilitychange",function(){if(d.hidden)clearTimeout(t)},{once:true});location.href=marketUrl(pkg)};
  });
}else{
  css("#playbadge{margin:14px auto;text-align:center}#playbadge img{height:64px;width:auto;display:inline-block}#playbadge small{display:block;font-size:.72rem;opacity:.75;margin-top:2px}");
  onReady(function(){
    var h=d.getElementById("playbadge")||anchor();h.id="playbadge";
    h.innerHTML='<a href="'+playUrl(pkg)+'" rel="noopener"><img src="/img/google-play-badge-en.png" width="166" height="64" alt="Get it on Google Play"></a><small>Google Play and the Google Play logo are trademarks of Google LLC.</small>';
  });
}
})(this);
