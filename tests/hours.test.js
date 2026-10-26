// Unit tests for tools/hours-calculator/hours.js. Run: node --test
const test=require("node:test"),assert=require("node:assert/strict");
const H=require(process.env.HRS_JS||require("path").join(__dirname,"../tools/hours-calculator/hours.js"));
const T=(d,ap)=>H.parse12(d,ap);
test("parse 12-hour keypad times",()=>{
  assert.equal(T("9","AM"),540);assert.equal(T("930","AM"),570);assert.equal(T("1215","PM"),735);
  assert.equal(T("12","AM"),0);assert.equal(T("12","PM"),720);assert.equal(T("1159","PM"),1439);assert.equal(T("0530","PM"),1050);
  for(const [d,ap] of [["","AM"],["0","AM"],["13","PM"],["960","AM"],["12345","AM"],["9",""],["9","XM"],[null,"AM"]])assert.equal(T(d,ap),null,d+ap);
});
test("parse 24-hour",()=>{
  assert.equal(H.parse24("00:00"),0);assert.equal(H.parse24("23:59"),1439);assert.equal(H.parse24("7:05"),425);
  for(const s of ["24:00","12:60","","abc","9","9:5",null])assert.equal(H.parse24(s),null);
});
test("day shift with and without break",()=>{
  let r=H.shift(T("9","AM"),T("530","PM"),"30");assert.equal(r.ok,true);assert.equal(r.minutes,480);assert.equal(H.hm(r.minutes),"8:00");assert.equal(H.dec(r.minutes),"8.00");assert.equal(r.overnight,false);
  r=H.shift(T("8","AM"),T("420","PM"),"");assert.equal(r.minutes,500);assert.equal(H.hm(500),"8:20");assert.equal(H.dec(500),"8.33");
});
test("overnight shifts crossing midnight",()=>{
  let r=H.shift(T("10","PM"),T("6","AM"),"30");assert.equal(r.ok,true);assert.equal(r.overnight,true);assert.equal(r.minutes,450);assert.equal(H.hm(450),"7:30");assert.equal(H.dec(450),"7.50");
  r=H.shift(T("1130","PM"),T("1230","AM"),"0");assert.equal(r.minutes,60);
  r=H.shift(T("6","PM"),T("12","AM"),"");assert.equal(r.minutes,360);assert.equal(r.overnight,true); // ends exactly at midnight
  r=H.shift(T("12","AM"),T("8","AM"),"");assert.equal(r.minutes,480);assert.equal(r.overnight,false);
  r=H.shift(T("9","AM"),T("845","AM"),"");assert.equal(r.minutes,1425); // almost 24h
});
test("zero",()=>{
  let r=H.shift(T("9","AM"),T("9","AM"),"");assert.equal(r.ok,true);assert.equal(r.minutes,0);assert.equal(H.hm(0),"0:00");assert.equal(H.dec(0),"0.00");
  r=H.shift(T("9","AM"),T("10","AM"),"60");assert.equal(r.minutes,0);
  assert.equal(H.pay(480,"0").pay,0);assert.equal(H.pay(0,"20").pay,0);
});
test("invalid input",()=>{
  assert.equal(H.shift(null,540,"").error,"time");assert.equal(H.shift(540,1440,"").error,"time");assert.equal(H.shift(-1,540,"").error,"time");
  assert.equal(H.shift(540,600,"61").error,"break");assert.equal(H.shift(540,600,"-5").error,"break");assert.equal(H.shift(540,600,"abc").error,"break");assert.equal(H.shift(540,600,"7.5").error,"break");
  assert.equal(H.pay(480,"-3").ok,false);assert.equal(H.pay(480,"x").ok,false);assert.equal(H.pay(480,"").pay,null);
});
test("pay",()=>{
  assert.equal(H.pay(480,"20").pay,160);assert.equal(H.pay(450,"18.50").pay,138.75);
  assert.equal(H.pay(440,"15").pay,110);           // 7:20 × $15 from exact minutes, not rounded hours
  assert.equal(H.pay(500,"17.25").pay,143.75);
  assert.equal(H.money(1234.5),"$1,234.50");assert.equal(H.money(null),"–");
});
test("week total",()=>{
  const d=[{start:"09:00",end:"17:30",brk:"30"},{start:"22:00",end:"06:00",brk:"30"},{},{start:"",end:""},{start:"25:00",end:"06:00"},{start:"08:00",end:"12:15",brk:""},{start:"09:00",end:"09:00"}];
  const w=H.week(d,"20");assert.equal(w.minutes,480+450+255+0);assert.equal(w.days,4);assert.deepEqual(w.bad,[4]);assert.equal(H.hm(w.minutes),"19:45");assert.equal(H.dec(w.minutes),"19.75");assert.equal(w.pay,395);
  assert.equal(H.week([],"").minutes,0);assert.equal(H.week([],"").pay,null);assert.equal(H.week(d,"-1").ok,false);
});
test("display helpers",()=>{
  assert.equal(H.show("9"),"9");assert.equal(H.show("930"),"9:30");assert.equal(H.show("1215"),"12:15");
  assert.equal(H.hm(65),"1:05");assert.equal(H.hm(3000),"50:00");assert.equal(H.hm(NaN),"–");assert.equal(H.dec(1),"0.02");assert.equal(H.dec(20),"0.33");
});
