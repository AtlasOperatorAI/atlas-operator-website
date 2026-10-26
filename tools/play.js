/* Google Play helpers (ASO 2026-10-26).
   App mode (inside the Play app): a one-time "Rate us" card after the 3rd use.
   Web mode: a "Get it on Google Play" text button (no official badge asset on hand).
   Usage: <script src="/tools/play.js" data-pkg="ai.atlasoperator.xxx" defer></script>
   Optional placeholder <div id="playbadge"></div>; otherwise the button goes before <footer>. */
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
if(TWA){
  var kN="atlas_rate_n_"+pkg,kD="atlas_rate_done_"+pkg;
  var n=(parseInt(ls(kN),10)||0)+1;ls(kN,String(n));
  if(!shouldShow(n,ls(kD)==="1"))return;
  css("#ratecard{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:#fff;color:#111;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.35);padding:16px;font:16px/1.4 system-ui,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap}#ratecard p{margin:0;flex:1 1 100%;font-weight:600}#ratecard button{font:inherit;border-radius:10px;padding:10px 16px;border:0;cursor:pointer}#ratego{background:#0b57d0;color:#fff;font-weight:700}#rateno{background:#eee;color:#111}");
  onReady(function(){
    var c=d.createElement("div");c.id="ratecard";c.setAttribute("role","dialog");c.setAttribute("aria-label","Rate this app");
    c.innerHTML='<p>Finding this app useful? A rating on Google Play helps others find it.</p><button id="ratego" type="button">Rate on Google Play</button><button id="rateno" type="button">No thanks</button>';
    d.body.appendChild(c);
    function close(){ls(kD,"1");if(c.parentNode)c.parentNode.removeChild(c)}
    d.getElementById("rateno").onclick=close;
    d.getElementById("ratego").onclick=function(){close();var t=setTimeout(function(){location.href=playUrl(pkg)},1500);
      d.addEventListener("visibilitychange",function(){if(d.hidden)clearTimeout(t)},{once:true});location.href=marketUrl(pkg)};
  });
}else{
  css(".playbtn{display:inline-flex;align-items:center;gap:8px;background:#000;color:#fff!important;border:1px solid #888;border-radius:10px;padding:10px 18px;text-decoration:none;font:600 16px/1.2 system-ui,sans-serif}.playbtn:hover{background:#222}#playbadge{margin:20px 0;text-align:center}");
  onReady(function(){
    var h=d.getElementById("playbadge");if(!h){h=d.createElement("div");h.id="playbadge";var f=d.querySelector("footer");if(f)f.parentNode.insertBefore(h,f);else d.body.appendChild(h)}
    h.innerHTML='<a class="playbtn" href="'+playUrl(pkg)+'" rel="noopener">&#9654; Get it on Google Play</a>';
  });
}
})(this);
