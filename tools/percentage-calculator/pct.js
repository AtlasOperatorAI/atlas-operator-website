/* Percentage Calculator math (atlasoperator.ai). Pure functions, no DOM. Works in the browser (window.PCT) and in Node (module.exports) for unit tests. */
(function(root){
"use strict";
/* Clean float noise (0.1*3 = 0.30000000000000004) by rounding to 12 significant digits. */
function clean(n){if(typeof n!=="number"||!isFinite(n))return n;if(n===0)return 0;return parseFloat(n.toPrecision(12))}
function num(s){if(typeof s==="number")return s;if(s==null)return NaN;s=String(s).replace(/,/g,"").trim();if(s===""||s==="-"||s==="."||s==="-.")return NaN;return /^-?(\d+\.?\d*|\.\d+)$/.test(s)?parseFloat(s):NaN}
function ok(v,extra){var r={ok:true,value:clean(v)};for(var k in extra)r[k]=clean(extra[k]);return r}
function err(code,msg){return{ok:false,error:code,message:msg}}
function need(){for(var i=0;i<arguments.length;i++)if(!isFinite(arguments[i]))return err("input","Enter both numbers");return null}
/* 1) X% of Y */
function percentOf(x,y){x=num(x);y=num(y);var e=need(x,y);if(e)return e;return ok(x/100*y)}
/* 2) X is what % of Y */
function whatPercent(x,y){x=num(x);y=num(y);var e=need(x,y);if(e)return e;if(y===0)return err("div0","Can't divide by 0: the whole (Y) must not be 0");return ok(x/y*100)}
/* 3) % change from A to B. Divides by |A| so the sign always shows the direction of the move (up = +, down = −), also for negative starting values. */
function change(a,b){a=num(a);b=num(b);var e=need(a,b);if(e)return e;var d=b-a;
 if(a===0){if(b===0)return ok(0,{diff:0});return err("div0","Can't compute a % change from 0")}
 return ok(d/Math.abs(a)*100,{diff:d})}
/* 4) Add or subtract X% (tax, tip, markup / discount). sign: +1 adds, -1 subtracts. */
function addSub(y,x,sign){y=num(y);x=num(x);var e=need(x,y);if(e)return e;sign=sign<0?-1:1;var amt=y*x/100;return ok(y+sign*amt,{amount:amt})}
/* Reverse (under More): the price before X% was added (sign +1) or taken off (sign -1). */
function reverse(total,x,sign){total=num(total);x=num(x);var e=need(total,x);if(e)return e;sign=sign<0?-1:1;var f=1+sign*x/100;
 if(f===0)return err("div0",sign<0?"A 100% discount leaves 0, so the original price can't be found":"Adding −100% leaves 0, so the original can't be found");
 var orig=total/f;return ok(orig,{amount:total-orig})}
/* Margin vs markup helper (under More): price from cost and margin %. */
function marginPrice(cost,m){cost=num(cost);m=num(m);var e=need(cost,m);if(e)return e;if(m>=100)return err("div0","Margin must be below 100%");var p=cost/(1-m/100);return ok(p,{profit:p-cost,markup:cost===0?NaN:(p-cost)/cost*100})}
/* Display: thousands separators, up to `d` decimals (default 4), trailing zeros removed, "−" for negatives. */
function fmt(n,d){if(typeof n!=="number"||!isFinite(n))return "–";d=d==null?4:d;n=clean(n);var a=Math.abs(n);
 if(a!==0&&a<Math.pow(10,-d))return (n<0?"−":"")+a.toExponential(2).replace(/\.?0+e/,"e");
 if(a>=1e15)return (n<0?"−":"")+a.toExponential(6).replace(/\.?0+e/,"e");
 var s=a.toLocaleString("en-US",{maximumFractionDigits:d,minimumFractionDigits:0});if(s==="0")return "0";return (n<0?"−":"")+s}
/* Keypad editing of an input string. k: 0-9 . B (backspace) C (clear) N (negate). fresh = first key replaces the value. */
var MAX=12;
function key(s,k,fresh){s=s==null?"":String(s);
 if(k==="C")return "";
 if(k==="B")return fresh?"":s.slice(0,-1);
 if(k==="N")return s.charAt(0)==="-"?s.slice(1):"-"+s;
 if(fresh)s=s.charAt(0)==="-"?"-":"";
 var neg=s.charAt(0)==="-",body=neg?s.slice(1):s;
 if(k==="."){if(body.indexOf(".")>=0)return s;body=body===""?"0.":body+"."}
 else if(/^[0-9]$/.test(k)){if(body.replace(".","").length>=MAX)return s;body=body==="0"?k:body+k}
 else return s;
 return (neg?"-":"")+body}
/* Show an input string with separators while typing ("1234.5" -> "1,234.5"). */
function show(s){if(s==null||s==="")return "";var neg=s.charAt(0)==="-",b=neg?s.slice(1):s,p=b.split("."),i=p[0]===""?"":Number(p[0]).toLocaleString("en-US");return (neg?"−":"")+i+(p.length>1?"."+p[1]:"")}
var PCT={clean:clean,num:num,percentOf:percentOf,whatPercent:whatPercent,change:change,addSub:addSub,reverse:reverse,marginPrice:marginPrice,fmt:fmt,key:key,show:show};
if(typeof module!=="undefined"&&module.exports)module.exports=PCT;else root.PCT=PCT;
})(this);
