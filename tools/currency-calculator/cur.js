/* Currency math + rate sources for /tools/currency-calculator/. Pure functions; works in the browser (window.CUR) and Node (tests). */
(function(root){
var FIAT="AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWL".split(" ");
var FIAT_SET={};FIAT.forEach(function(c){FIAT_SET[c]=1});
var SOURCES=[
 {id:"fawaz-jsdelivr",name:"fawazahmed0 currency-api (jsDelivr)",url:"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json",kind:"fawaz"},
 {id:"fawaz-pages",name:"fawazahmed0 currency-api (Cloudflare Pages)",url:"https://latest.currency-api.pages.dev/v1/currencies/eur.min.json",kind:"fawaz"},
 {id:"frankfurter",name:"Frankfurter (ECB reference rates)",url:"https://api.frankfurter.dev/v1/latest?base=EUR",kind:"frank"}];
/* Official USD/MXN: Banco de México FIX (SIE series SF43718), keyless through Frankfurter's provider filter. Daily, published around midday CDMX time. */
var MXN_FIX={id:"banxico-fix",name:"Banco de México FIX (via Frankfurter)",url:"https://api.frankfurter.dev/v2/rates?base=USD&quotes=MXN&providers=BANXICO",kind:"fix"};
var FIX_MAXDEV=0.10;/* a FIX more than 10% away from the daily USD/MXN is treated as bad data and ignored */
/* Hourly rates, tried FIRST: fxRatesAPI through our own proxy (tools/currency-proxy, a Railway Function that holds the key and calls the API
   at most once an hour). Used only when fresh (provider time within 3 hours) and within 10% of the daily rates; otherwise the daily chain below is shown. */
var HOURLY={id:"fxratesapi-hourly",name:"fxRatesAPI hourly (via Atlas proxy)",url:"https://atlas-fx-proxy.up.railway.app/v1/rates",kind:"hourly"};
var HOURLY_MAXAGE=3*3600000,HOURLY_MAXDEV=0.10,HOURLY_CHECK=["EUR","GBP","JPY","MXN","CAD"];
/* Provider adapter: every source is {id,name,url,kind}; parse(kind,json) normalizes it. To swap providers, edit SOURCES and add a parse kind. */
var TTL=300000;/* re-check for a newer daily file when the shown rates were checked more than 5 minutes ago */
function ok(x){return typeof x==="number"&&isFinite(x)&&x>0}
/* Normalize either source to {date, base:"EUR", rates:{USD:1.08,...}} with EUR=1, fiat only. */
function parse(kind,j){var out={},src,date;
 if(!j||typeof j!=="object")return null;
 if(kind==="fawaz"){src=j.eur;date=j.date;if(!src)return null;for(var k in src){var K=k.toUpperCase();if(FIAT_SET[K]&&ok(src[k]))out[K]=src[k]}}
 else{src=j.rates;date=j.date;if(!src||j.base!=="EUR")return null;for(var k2 in src){if(FIAT_SET[k2]&&ok(src[k2]))out[k2]=src[k2]}}
 out.EUR=1;if(!/^\d{4}-\d{2}-\d{2}$/.test(date||"")||Object.keys(out).length<20)return null;
 return{date:date,base:"EUR",rates:out}}
/* Frankfurter v2 rows [{date,base:"USD",quote:"MXN",rate}] -> {date, rate} (MXN per USD) or null */
function parseFix(j){var r=Array.isArray(j)?j.filter(function(x){return x&&x.base==="USD"&&x.quote==="MXN"&&ok(x.rate)&&/^\d{4}-\d{2}-\d{2}$/.test(x.date||"")}):[];
 if(!r.length)return null;r.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0});var x=r[r.length-1];return{date:x.date,rate:x.rate}}
/* Use the Banxico FIX for MXN when it's dated the same day as the daily set or newer. MXN is set so USD/MXN equals the FIX exactly; every
   MXN cross (EUR/MXN, MXN/JPY…) then uses the FIX times the daily USD cross. Returns a new set with .fix, or the set unchanged. */
function applyFix(p,fix){if(!p||!fix||!ok(fix.rate)||!ok(p.rates.USD)||!ok(p.rates.MXN)||fix.date<p.date)return p;
 var usdmxn=p.rates.MXN/p.rates.USD;if(Math.abs(fix.rate/usdmxn-1)>FIX_MAXDEV)return p;
 var out={},k;for(k in p)out[k]=p[k];out.rates={};for(k in p.rates)out.rates[k]=p.rates[k];out.rates.MXN=p.rates.USD*fix.rate;out.fix={date:fix.date,rate:fix.rate,src:MXN_FIX.id};return out}
/* Daily set (load) and the Banxico FIX in parallel. The FIX never blocks or breaks the daily set. */
/* Hourly proxy, daily set (load) and Banxico FIX in parallel. Hourly wins when it passes applyHourly's checks; otherwise the daily set
   (with the FIX for MXN) is returned exactly as before. Rejects only when neither hourly nor daily rates are available. */
function opt(fetchFn,s,skip,parser){return !s.url||skip.indexOf(s.id)>=0?Promise.resolve(null):Promise.resolve().then(function(){return fetchFn(s.url)}).then(parser,function(){return null})}
function loadAll(fetchFn,skip,now){skip=skip||[];var err=null;
 var daily=load(fetchFn,skip).catch(function(e){err=e;return null});
 return Promise.all([daily,opt(fetchFn,MXN_FIX,skip,parseFix),opt(fetchFn,HOURLY,skip,parseHourly)]).then(function(a){
  var d=a[0]?applyFix(a[0],a[1]):null,out=applyHourly(d,a[2],now);if(!out)throw err||new Error("no rates");return out})}
/* Proxy JSON {base:"USD",rates:{EUR:0.91,..},timestamp:<unix s>} -> {asOf:ms, rates (per USD, fiat only, USD=1)} or null */
function parseHourly(j){if(!j||typeof j!=="object"||j.base!=="USD"||!j.rates||typeof j.rates!=="object"||!ok(j.timestamp))return null;
 var r={USD:1},n=0;for(var k in j.rates){if(FIAT_SET[k]&&ok(j.rates[k])){r[k]=j.rates[k];n++}}if(n<20)return null;return{asOf:j.timestamp*1000,rates:r}}
/* Put hourly rates over the daily set d (which may be null). Every currency is anchored on USD: hourly codes use hourly USD crosses, the rest keep
   their daily USD cross. Ignored (d returned unchanged) when the hourly set is older than 3 hours, from the future, or more than 10% away
   from the daily rate on any of HOURLY_CHECK. Returns a new set with .hourly {asOf, codes}; the Banxico FIX is dropped when MXN is hourly. */
function applyHourly(d,h,now){now=now||Date.now();if(!h||now-h.asOf>HOURLY_MAXAGE||h.asOf>now+600000)return d;
 var dr=d&&d.rates,k,i;
 if(dr&&ok(dr.USD))for(i=0;i<HOURLY_CHECK.length;i++){k=HOURLY_CHECK[i];if(ok(h.rates[k])&&ok(dr[k])&&Math.abs(h.rates[k]/(dr[k]/dr.USD)-1)>HOURLY_MAXDEV)return d}
 var U=ok(h.rates.EUR)?1/h.rates.EUR:(dr&&ok(dr.USD)?dr.USD:0);if(!U)return d;
 var out={},R={};if(d)for(k in d)out[k]=d[k];
 if(dr&&ok(dr.USD))for(k in dr)if(ok(dr[k]))R[k]=U*dr[k]/dr.USD;
 for(k in h.rates)R[k]=U*h.rates[k];
 out.rates=R;out.base="EUR";if(!d){out.date=new Date(h.asOf).toISOString().slice(0,10);out.src=HOURLY.id;out.srcName=HOURLY.name}
 out.hourly={asOf:h.asOf,codes:Object.keys(h.rates),src:HOURLY.id};out.fetched=now;if(h.rates.MXN)delete out.fix;return out}
function rate(from,to,R){if(!R||!ok(R[from])||!ok(R[to]))return NaN;return R[to]/R[from]}
function convert(amt,from,to,R){amt=+amt;if(!isFinite(amt))return NaN;return amt*rate(from,to,R)}
function tip(amt,pct){amt=+amt;pct=+pct;if(!isFinite(amt))return{tip:NaN,total:NaN};if(!isFinite(pct)||pct<0)pct=0;var t=amt*pct/100;return{tip:t,total:amt+t}}
function decimals(code){return /^(JPY|KRW|VND|CLP|ISK|PYG|UGX|XAF|XOF|XPF|IDR|HUF|COP|KMF|GNF|RWF|BIF|DJF|VUV|LAK|MGA|UZS|IRR|LBP|SYP|MMK|SLE|SOS|TZS|KHR)$/.test(code)?0:2}
/* Fetch one source -> parsed set or null. */
function one(fetchFn,s,errs){return Promise.resolve().then(function(){return fetchFn(s.url)}).then(function(j){var p=parse(s.kind,j);if(!p)throw new Error("bad data");p.src=s.id;p.srcName=s.name;p.fetched=Date.now();return p}).catch(function(e){errs.push(s.id+": "+(e&&e.message||e));return null})}
/* Ask both fawaz mirrors at once and keep the NEWEST dated file (a CDN edge can still hold yesterday's file for hours).
   Ties go to the first listed. Frankfurter (ECB) is used only when both mirrors fail. fetchFn(url) -> Promise<json>. skip: source ids to skip. */
function load(fetchFn,skip){var errs=[];skip=skip||[];
 var live=SOURCES.filter(function(s){return skip.indexOf(s.id)<0});
 var fz=live.filter(function(s){return s.kind==="fawaz"}),rest=live.filter(function(s){return s.kind!=="fawaz"});
 return Promise.all(fz.map(function(s){return one(fetchFn,s,errs)})).then(function(a){var best=null;
  a.forEach(function(p){if(p&&(!best||p.date>best.date))best=p});if(best)return best;
  var i=0;function next(){if(i>=rest.length)return Promise.reject(new Error("all sources failed: "+errs.join("; ")));return one(fetchFn,rest[i++],errs).then(function(p){return p||next()})}
  return next()})}
function stale(meta,now){return !meta||!meta.fetched||((now||Date.now())-meta.fetched)>=TTL}
/* Freshness text. meta {date, fetched, offline, failed} or null; busy = a refresh is running. Returns {top, foot}. Never says "live" or "updated <now>". */
function clock(ms,now,full){var t=new Date(ms),n=new Date(now||Date.now()),o={hour:"numeric",minute:"2-digit"};if(full||t.toDateString()!==n.toDateString()){o.month="short";o.day="numeric"}return t.toLocaleString("en-US",o)}
/* pair {from,to} (optional): when it involves MXN and the Banxico FIX was applied, the line under the rate names the FIX. */
function stamp(meta,busy,now,pair){if(!meta)return{top:busy?"Updating…":"No rates yet",foot:"No rates yet. Connect to the internet once to load them."};
 var hr=meta.hourly;if(hr&&hr.asOf){var codes=hr.codes||[],inH=!pair||(codes.indexOf(pair.from)>=0&&codes.indexOf(pair.to)>=0);
  var hc="(checked "+clock(meta.fetched||hr.asOf,now)+")",at=clock(hr.asOf,now),hs="Updated hourly, rates as of "+clock(hr.asOf,now,1)+" "+hc+" · fxRatesAPI"+(meta.src===HOURLY.id?"":" · other currencies: daily reference rates dated "+meta.date);
  if(inH){var ht="Updated hourly, rates as of "+at+" "+hc;
   /* offline/failed: when the rates and the last check are on the same earlier day, the date is shown once so the line fits */
   var fc=meta.fetched||hr.asOf,hc2=at.indexOf(",")>0&&new Date(fc).toDateString()===new Date(hr.asOf).toDateString()?"(checked "+new Date(fc).toLocaleString("en-US",{hour:"numeric",minute:"2-digit"})+")":hc;
   if(meta.offline){hs="Offline · saved "+hs.charAt(0).toLowerCase()+hs.slice(1);ht="Offline · saved hourly "+at+" "+hc2}
   else if(meta.failed){hs="Couldn't refresh · showing "+hs.charAt(0).toLowerCase()+hs.slice(1);ht="Couldn't refresh · hourly "+at+" "+hc2}
   return{top:busy?"Updating…":ht,foot:hs}}
  var ds=stamp({date:meta.date,fetched:meta.fetched,offline:meta.offline,failed:meta.failed},busy,now,pair);ds.foot=ds.foot+" · "+hs.replace(/ \(checked [^)]*\)/,"");return ds}
 var chk="(checked "+clock(meta.fetched||Date.parse(meta.date+"T12:00:00Z"),now)+")",fx=meta.fix,d=day(meta.date,now),
  tail="dated "+meta.date+(fx?" · USD/MXN: Banxico FIX dated "+fx.date:"")+" "+chk,s="Daily reference rates "+tail,
  mx=fx&&pair&&(pair.from==="MXN"||pair.to==="MXN"),usd=mx&&(pair.from==="USD"||pair.to==="USD"),fd=fx?day(fx.date,now):"",
  /* offline/failed keep the short r2 form so the line stays on one row at 390px; the footer carries the full FIX credit */
  what=usd?"Banxico "+fd:d+" rates",
  t=!mx?"Daily rates dated "+d+" "+chk:usd?"Banxico FIX dated "+fd+" "+chk:(fd===d?"Daily + Banxico FIX "+d:"Daily "+d+" + Banxico FIX "+fd)+" "+chk;
 if(meta.offline){s="Offline · saved daily reference rates "+tail;t="Offline · saved "+what+" "+chk}
 else if(meta.failed){s="Couldn't refresh · showing daily reference rates "+tail;t="Couldn't refresh · "+what+" "+chk}
 return{top:busy?"Updating…":t,foot:s}}
/* "2026-11-19" -> "Nov 19" (year added when it isn't the current year). Short form for the line under the rate. */
function day(iso,now){var t=new Date(iso+"T12:00:00Z"),o={month:"short",day:"numeric",timeZone:"UTC"};if(isNaN(t))return iso;if(t.getUTCFullYear()!==new Date(now||Date.now()).getFullYear())o.year="numeric";return t.toLocaleDateString("en-US",o)}
/* Pro trip budget: lines [{label,amount,cur}] -> totals in home currency */
function budget(lines,home,R){var tot=0,bad=0,rows=(lines||[]).map(function(l){var v=convert(l.amount,l.cur,home,R);if(!isFinite(v)){bad++;return{label:l.label,amount:+l.amount,cur:l.cur,home:NaN}}tot+=v;return{label:l.label,amount:+l.amount,cur:l.cur,home:v}});return{rows:rows,total:tot,bad:bad}}
function csv(b,home,meta){var q=function(s){s=String(s==null?"":s);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 var L=[["Item","Amount","Currency","In "+home].join(",")];b.rows.forEach(function(r){L.push([q(r.label),r.amount,r.cur,isFinite(r.home)?r.home.toFixed(decimals(home)):""].join(","))});
 L.push(["Total","","",b.total.toFixed(decimals(home))].join(","));if(meta)L.push(q(meta));return L.join("\n")}
/* Emoji flag for a currency (regional-indicator letters, no image assets). Multi-country currencies get a neutral symbol. */
var SPECIAL={EUR:"EU",ANG:"CW",XCD:"AG",XAF:"CM",XOF:"SN",XPF:"PF"};
function flag(code){code=String(code||"").toUpperCase();var cc=SPECIAL[code]||code.slice(0,2);if(!/^[A-Z]{2}$/.test(cc))return "🏳️";
 return String.fromCodePoint(0x1F1E6+cc.charCodeAt(0)-65,0x1F1E6+cc.charCodeAt(1)-65)}
/* Keypad: (current string, key, fresh) -> next string. Keys: 0-9 . C B(ackspace). Max 12 integer digits, 6 decimals. */
function key(s,k,fresh){s=String(s==null?"0":s);if(k==="C")return "0";if(k==="B"){if(fresh)return "0";s=s.slice(0,-1);return s===""||s==="-"?"0":s}
 if(fresh)s="0";
 if(k==="."){return s.indexOf(".")>=0?s:s+"."}
 if(!/^[0-9]$/.test(k))return s;var parts=s.split(".");
 if(parts.length>1){if(parts[1].length>=6)return s;return s+k}
 if(parts[0].replace(/^0+/,"").length>=12)return s;return s==="0"?k:s+k}
function show(s){s=String(s);var p=s.split("."),i=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,",");return p.length>1?i+"."+p[1]:i}
var API={HOURLY:HOURLY,parseHourly:parseHourly,applyHourly:applyHourly,MXN_FIX:MXN_FIX,parseFix:parseFix,applyFix:applyFix,loadAll:loadAll,TTL:TTL,stale:stale,stamp:stamp,clock:clock,flag:flag,key:key,show:show,FIAT:FIAT,SOURCES:SOURCES,parse:parse,rate:rate,convert:convert,tip:tip,decimals:decimals,load:load,budget:budget,csv:csv};
if(typeof module!=="undefined"&&module.exports)module.exports=API;else root.CUR=API;
})(this);
