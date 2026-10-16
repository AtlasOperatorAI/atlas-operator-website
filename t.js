/* atlasoperator.ai: cookie-free page-view beacon. No cookies, no identifiers stored in the browser. */
(function(){var E="https://atlas-analytics-production-f29e.up.railway.app";window.ATLAS_API=E;
function q(k){try{return new URLSearchParams(location.search).get(k)||""}catch(e){return ""}}
window.atlasUTM=function(){return{utm_source:q("utm_source"),utm_medium:q("utm_medium"),utm_campaign:q("utm_campaign"),referrer:document.referrer||""}};
window.atlasPost=function(p,d){try{var b=JSON.stringify(d);return fetch(E+p,{method:"POST",headers:{"Content-Type":"text/plain"},body:b,keepalive:true,credentials:"omit"})}catch(e){return Promise.reject(e)}};
if(navigator.webdriver||/^(localhost|127\.)/.test(location.hostname))return;
var d=atlasUTM();d.site="atlas";d.path=location.pathname;atlasPost("/hit",d).catch(function(){})})();
/* Play app (TWA) mode: keep the app strictly free-only by neutralizing links to the homepage and to Stripe. */
(function(){var T=false;try{T=/^android-app:\/\//.test(document.referrer)||new URLSearchParams(location.search).get("src")==="twa"||sessionStorage.getItem("atlas_twa")==="1";if(T)sessionStorage.setItem("atlas_twa","1")}catch(e){}
if(!T)return;window.ATLAS_TWA=true;
function bad(a){var h=a.getAttribute("href")||"";if(/stripe\.com/i.test(h))return true;try{var u=new URL(h,location.href);if(/stripe\.com$/i.test(u.hostname))return true;if(u.origin===location.origin&&(u.pathname==="/"||u.pathname==="/index.html"))return true}catch(e){}return false}
function fix(){document.querySelectorAll("a[href]").forEach(function(a){if(!bad(a))return;var s=document.createElement("span");s.className=a.className;s.innerHTML=a.innerHTML;s.setAttribute("style",(a.getAttribute("style")||"")+";cursor:default");s.setAttribute("data-twa-neutralized","1");a.parentNode.replaceChild(s,a)})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fix);else fix()})();
