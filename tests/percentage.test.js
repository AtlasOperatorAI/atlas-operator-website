// Unit tests for tools/percentage-calculator/pct.js. Run: node --test
const test=require("node:test"),assert=require("node:assert/strict");
const P=require(process.env.PCT_JS||require("path").join(__dirname,"../tools/percentage-calculator/pct.js"));
const v=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r.value};
const bad=(r,code)=>{assert.equal(r.ok,false);assert.equal(r.error,code)};
test("X% of Y",()=>{
  assert.equal(v(P.percentOf(15,80)),12);
  assert.equal(v(P.percentOf(10,0)),0);
  assert.equal(v(P.percentOf(0,500)),0);
  assert.equal(v(P.percentOf(200,50)),100);
  assert.equal(v(P.percentOf(-20,50)),-10);
  assert.equal(v(P.percentOf(20,-50)),-10);
  assert.equal(v(P.percentOf(-20,-50)),10);
  assert.equal(v(P.percentOf(0.5,1000)),5);
  assert.equal(v(P.percentOf(7,19.99)),1.3993);
  assert.equal(v(P.percentOf("12.5","1,000")),125);
  assert.equal(v(P.percentOf(33.333,3)),0.99999);
  assert.equal(v(P.percentOf(10,0.3)),0.03); // float noise cleaned
});
test("X is what % of Y",()=>{
  assert.equal(v(P.whatPercent(12,80)),15);
  assert.equal(v(P.whatPercent(80,80)),100);
  assert.equal(v(P.whatPercent(120,80)),150);
  assert.equal(v(P.whatPercent(0,80)),0);
  assert.equal(v(P.whatPercent(-5,20)),-25);
  assert.equal(v(P.whatPercent(5,-20)),-25);
  assert.equal(v(P.whatPercent(1,3)),33.3333333333);
  bad(P.whatPercent(5,0),"div0");
  bad(P.whatPercent(0,0),"div0");
  bad(P.whatPercent(5,"-0"),"div0");
});
test("% change from A to B",()=>{
  assert.equal(v(P.change(50,75)),50);
  assert.equal(v(P.change(75,50)),-33.3333333333);
  assert.equal(v(P.change(100,100)),0);
  assert.equal(v(P.change(100,0)),-100);
  assert.equal(v(P.change(20,100)),400);
  assert.equal(P.change(50,75).diff,25);
  // negative starting values: sign follows the direction of the move
  assert.equal(v(P.change(-50,-25)),50);   // went up
  assert.equal(v(P.change(-50,-75)),-50);  // went down
  assert.equal(v(P.change(-10,10)),200);
  assert.equal(v(P.change(10,-10)),-200);
  assert.equal(v(P.change(0.1,0.3)),200);
  bad(P.change(0,5),"div0");
  bad(P.change(0,-5),"div0");
  assert.equal(v(P.change(0,0)),0);
});
test("add / subtract %",()=>{
  assert.equal(v(P.addSub(100,8.25,1)),108.25);        // price + sales tax
  assert.equal(P.addSub(100,8.25,1).amount,8.25);
  assert.equal(v(P.addSub(80,25,-1)),60);              // 25% off
  assert.equal(P.addSub(80,25,-1).amount,20);
  assert.equal(v(P.addSub(40,50,1)),60);               // 50% markup on cost
  assert.equal(v(P.addSub(19.99,7,1)),21.3893);
  assert.equal(v(P.addSub(50,100,-1)),0);
  assert.equal(v(P.addSub(50,150,-1)),-25);
  assert.equal(v(P.addSub(0,20,1)),0);
  assert.equal(v(P.addSub(100,0,-1)),100);
  assert.equal(v(P.addSub(-100,10,1)),-110);
  assert.equal(v(P.addSub(100,-10,1)),90);
  assert.equal(v(P.addSub(0.1,200,1)),0.3);
});
test("reverse (before tax / before discount)",()=>{
  assert.equal(v(P.reverse(108.25,8.25,1)),100);
  assert.equal(v(P.reverse(60,25,-1)),80);
  assert.equal(P.reverse(60,25,-1).amount,-20);
  assert.equal(v(P.reverse(110,10,1)),100);
  bad(P.reverse(0,100,-1),"div0");
  bad(P.reverse(50,-100,1),"div0");
  assert.equal(v(P.reverse(0,10,1)),0);
});
test("margin price",()=>{
  const r=P.marginPrice(60,40);assert.equal(r.value,100);assert.equal(r.profit,40);assert.equal(r.markup,66.6666666667);
  bad(P.marginPrice(60,100),"div0");
  assert.equal(v(P.marginPrice(100,0)),100);
});
test("missing or invalid input",()=>{
  for(const s of ["","-",".","abc","1.2.3",null,undefined,NaN,Infinity]){bad(P.percentOf(s,10),"input");bad(P.change(10,s),"input")}
  bad(P.addSub(10,"",1),"input");
});
test("fmt",()=>{
  assert.equal(P.fmt(1234567.891),"1,234,567.891");
  assert.equal(P.fmt(12),"12");
  assert.equal(P.fmt(-33.33333333),"−33.3333");
  assert.equal(P.fmt(0),"0");
  assert.equal(P.fmt(-0),"0");
  assert.equal(P.fmt(0.1+0.2),"0.3");
  assert.equal(P.fmt(0.00001),"1e-5");
  assert.equal(P.fmt(2e16),"2e+16");
  assert.equal(P.fmt(NaN),"–");
  assert.equal(P.fmt(1.005,2),"1.01");
});
test("keypad",()=>{
  let s="";for(const k of "12.5")s=P.key(s,k,false);assert.equal(s,"12.5");
  assert.equal(P.key("12.5",".",false),"12.5");
  assert.equal(P.key("0","7",false),"7");
  assert.equal(P.key("",".",false),"0.");
  assert.equal(P.key("12","B",false),"1");
  assert.equal(P.key("12","C",false),"");
  assert.equal(P.key("12","N",false),"-12");
  assert.equal(P.key("-12","N",false),"12");
  assert.equal(P.key("","N",false),"-");
  assert.equal(P.key("-","5",false),"-5");
  assert.equal(P.key("99","5",true),"5");
  assert.equal(P.key("-99","5",true),"-5");
  assert.equal(P.key("123456789012","3",false),"123456789012");
  assert.equal(P.show("1234567.50"),"1,234,567.50");
  assert.equal(P.show("-0."),"−0.");
  assert.equal(P.num("-0.5"),-0.5);
});
