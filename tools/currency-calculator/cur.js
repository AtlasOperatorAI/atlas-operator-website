/* Currency math + rate sources for /tools/currency-calculator/. Pure functions; works in the browser (window.CUR) and Node (tests). */
(function(root){
var FIAT="AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWL".split(" ");
var FIAT_SET={};FIAT.forEach(function(c){FIAT_SET[c]=1});
var SOURCES=[
 {id:"fawaz-jsdelivr",name:"fawazahmed0 currency-api (jsDelivr)",url:"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json",kind:"fawaz"},
 {id:"fawaz-pages",name:"fawazahmed0 currency-api (Cloudflare Pages)",url:"https://latest.currency-api.pages.dev/v1/currencies/eur.min.json",kind:"fawaz"},
 {id:"frankfurter",name:"Frankfurter (ECB reference rates)",url:"https://api.frankfurter.dev/v1/latest?base=EUR",kind:"frank"}];
function ok(x){return typeof x==="number"&&isFinite(x)&&x>0}
/* Normalize either source to {date, base:"EUR", rates:{USD:1.08,...}} with EUR=1, fiat only. */
function parse(kind,j){var out={},src,date;
 if(!j||typeof j!=="object")return null;
 if(kind==="fawaz"){src=j.eur;date=j.date;if(!src)return null;for(var k in src){var K=k.toUpperCase();if(FIAT_SET[K]&&ok(src[k]))out[K]=src[k]}}
 else{src=j.rates;date=j.date;if(!src||j.base!=="EUR")return null;for(var k2 in src){if(FIAT_SET[k2]&&ok(src[k2]))out[k2]=src[k2]}}
 out.EUR=1;if(!/^\d{4}-\d{2}-\d{2}$/.test(date||"")||Object.keys(out).length<20)return null;
 return{date:date,base:"EUR",rates:out}}
function rate(from,to,R){if(!R||!ok(R[from])||!ok(R[to]))return NaN;return R[to]/R[from]}
function convert(amt,from,to,R){amt=+amt;if(!isFinite(amt))return NaN;return amt*rate(from,to,R)}
function tip(amt,pct){amt=+amt;pct=+pct;if(!isFinite(amt))return{tip:NaN,total:NaN};if(!isFinite(pct)||pct<0)pct=0;var t=amt*pct/100;return{tip:t,total:amt+t}}
function decimals(code){return /^(JPY|KRW|VND|CLP|ISK|PYG|UGX|XAF|XOF|XPF|IDR|HUF|COP|KMF|GNF|RWF|BIF|DJF|VUV|LAK|MGA|UZS|IRR|LBP|SYP|MMK|SLE|SOS|TZS|KHR)$/.test(code)?0:2}
/* Fetch the first source that answers with valid data. fetchFn(url) -> Promise<json>. skip: array of source ids to skip. */
function load(fetchFn,skip){var i=0,errs=[];skip=skip||[];
 function next(){while(i<SOURCES.length&&skip.indexOf(SOURCES[i].id)>=0)i++;if(i>=SOURCES.length)return Promise.reject(new Error("all sources failed: "+errs.join("; ")));var s=SOURCES[i++];
  return Promise.resolve().then(function(){return fetchFn(s.url)}).then(function(j){var p=parse(s.kind,j);if(!p)throw new Error("bad data");p.src=s.id;p.srcName=s.name;p.fetched=Date.now();return p}).catch(function(e){errs.push(s.id+": "+(e&&e.message||e));return next()})}
 return next()}
/* Pro trip budget: lines [{label,amount,cur}] -> totals in home currency */
function budget(lines,home,R){var tot=0,bad=0,rows=(lines||[]).map(function(l){var v=convert(l.amount,l.cur,home,R);if(!isFinite(v)){bad++;return{label:l.label,amount:+l.amount,cur:l.cur,home:NaN}}tot+=v;return{label:l.label,amount:+l.amount,cur:l.cur,home:v}});return{rows:rows,total:tot,bad:bad}}
function csv(b,home,meta){var q=function(s){s=String(s==null?"":s);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 var L=[["Item","Amount","Currency","In "+home].join(",")];b.rows.forEach(function(r){L.push([q(r.label),r.amount,r.cur,isFinite(r.home)?r.home.toFixed(decimals(home)):""].join(","))});
 L.push(["Total","","",b.total.toFixed(decimals(home))].join(","));if(meta)L.push(q(meta));return L.join("\n")}
var API={FIAT:FIAT,SOURCES:SOURCES,parse:parse,rate:rate,convert:convert,tip:tip,decimals:decimals,load:load,budget:budget,csv:csv};
if(typeof module!=="undefined"&&module.exports)module.exports=API;else root.CUR=API;
})(this);
