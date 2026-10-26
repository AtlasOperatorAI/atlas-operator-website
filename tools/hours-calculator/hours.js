/* Hours Calculator math (atlasoperator.ai). Pure functions, no DOM. Browser: window.HRS. Node: module.exports (unit tests). All times are minutes after midnight (0..1439). */
(function(root){
"use strict";
var DAY=1440;
function isInt(n){return typeof n==="number"&&isFinite(n)&&Math.floor(n)===n}
/* Keypad digits ("930", "1215") + AM/PM -> minutes. 1-2 digits = hour only; 3 = H:MM; 4 = HH:MM. Hour 1-12, minutes 0-59. */
function parse12(d,ap){d=String(d==null?"":d).replace(/\D/g,"");if(!d||d.length>4)return null;
 var h,m;if(d.length<=2){h=+d;m=0}else{h=+d.slice(0,-2);m=+d.slice(-2)}
 if(h<1||h>12||m>59)return null;ap=String(ap||"").toUpperCase();if(ap!=="AM"&&ap!=="PM")return null;
 return (h%12+(ap==="PM"?12:0))*60+m}
/* "HH:MM" 24-hour (as from <input type=time>) -> minutes. */
function parse24(s){var r=/^(\d{1,2}):(\d{2})$/.exec(String(s==null?"":s).trim());if(!r)return null;var h=+r[1],m=+r[2];if(h>23||m>59)return null;return h*60+m}
/* Keypad digits -> display "9:30" while typing. */
function show(d){d=String(d||"");if(d.length<=2)return d;return d.slice(0,-2)+":"+d.slice(-2)}
/* Break minutes / pay rate: "" means none (0 / no pay). */
function optNum(s){if(s==null||String(s).trim()==="")return {none:true,v:0};s=String(s).replace(/,/g,"").trim();if(!/^(\d+\.?\d*|\.\d+)$/.test(s))return null;return {none:false,v:parseFloat(s)}}
/* One shift. End at or before start = the shift crossed midnight (end is the next day). Equal start and end = 0 hours. */
function shift(start,end,brk){
 if(!isInt(start)||!isInt(end)||start<0||end<0||start>=DAY||end>=DAY)return {ok:false,error:"time",message:"Enter a valid start and end time"};
 var b=optNum(brk);if(!b||!isInt(b.v))return {ok:false,error:"break",message:"Break must be whole minutes (0 or more)"};
 var span=end>=start?end-start:end+DAY-start,overnight=end<start;
 if(b.v>span)return {ok:false,error:"break",message:"Break is longer than the shift"};
 return {ok:true,minutes:span-b.v,span:span,breakMin:b.v,overnight:overnight}}
/* Pay from exact minutes, rounded to cents. rate "" -> null (no pay shown). */
function pay(minutes,rate){var r=optNum(rate);if(r===null)return {ok:false,error:"rate",message:"Pay rate must be a number (0 or more)"};if(r.none)return {ok:true,pay:null};
 return {ok:true,pay:Math.round(minutes*r.v/60*100+1e-9)/100}}
function hm(min){if(!isInt(min))return "–";var neg=min<0;min=Math.abs(min);var h=Math.floor(min/60),m=min%60;return (neg?"−":"")+h+":"+(m<10?"0":"")+m}
function dec(min){if(!isInt(min))return "–";return (Math.round(min/60*100+1e-9)/100).toFixed(2)}
function money(v){if(v==null||!isFinite(v))return "–";return "$"+v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
/* Week: days = [{start:"HH:MM",end:"HH:MM",brk:"30"}...]. Days with no start and no end are skipped. */
function week(days,rate){var tot=0,bad=[],used=0,rows=[];
 (days||[]).forEach(function(d,i){d=d||{};var s=String(d.start||"").trim(),e=String(d.end||"").trim();
  if(!s&&!e){rows.push(null);return}
  var r=shift(parse24(s),parse24(e),d.brk);rows.push(r);if(r.ok){tot+=r.minutes;used++}else bad.push(i)});
 var p=pay(tot,rate);return {ok:p.ok,minutes:tot,days:used,bad:bad,rows:rows,pay:p.ok?p.pay:null,error:p.ok?null:p.error,message:p.message}}
var HRS={parse12:parse12,parse24:parse24,show:show,shift:shift,pay:pay,hm:hm,dec:dec,money:money,week:week,optNum:optNum};
if(typeof module!=="undefined"&&module.exports)module.exports=HRS;else root.HRS=HRS;
})(this);
