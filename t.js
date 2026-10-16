/* atlasoperator.ai: cookie-free page-view beacon. No cookies, no identifiers stored in the browser. */
(function(){var E="https://atlas-analytics-production-f29e.up.railway.app";window.ATLAS_API=E;
function q(k){try{return new URLSearchParams(location.search).get(k)||""}catch(e){return ""}}
window.atlasUTM=function(){return{utm_source:q("utm_source"),utm_medium:q("utm_medium"),utm_campaign:q("utm_campaign"),referrer:document.referrer||""}};
window.atlasPost=function(p,d){try{var b=JSON.stringify(d);return fetch(E+p,{method:"POST",headers:{"Content-Type":"text/plain"},body:b,keepalive:true,credentials:"omit"})}catch(e){return Promise.reject(e)}};
if(navigator.webdriver||/^(localhost|127\.)/.test(location.hostname))return;
var d=atlasUTM();d.site="atlas";d.path=location.pathname;atlasPost("/hit",d).catch(function(){})})();
