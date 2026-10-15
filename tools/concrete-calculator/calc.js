/* Concrete math. Exposed as window.ConcreteCalc and module.exports for tests. */
(function(root){
var BAG_YIELD_FT3={80:0.60,60:0.45,40:0.30}; /* typical premixed concrete yields (cu ft per bag) */
function slabFt3(lengthFt,widthFt,thicknessIn){return lengthFt*widthFt*(thicknessIn/12)}
function footingFt3(lengthFt,widthIn,depthIn){return lengthFt*(widthIn/12)*(depthIn/12)}
function columnFt3(diameterIn,heightFt){var r=diameterIn/24;return Math.PI*r*r*heightFt}
function calc(o){
  var n=Math.max(1,Math.floor(o.qty||1)),ft3;
  if(o.shape==="footing")ft3=footingFt3(o.a,o.b,o.c);
  else if(o.shape==="column")ft3=columnFt3(o.a,o.b);
  else ft3=slabFt3(o.a,o.b,o.c);
  ft3*=n;var w=1+(o.waste||0)/100,tot=ft3*w,yd3=tot/27;
  var bags={};for(var s in BAG_YIELD_FT3)bags[s]=Math.ceil(tot/BAG_YIELD_FT3[s]-1e-9);
  var size=o.bagSize||80;
  return{ft3:ft3,ft3WithWaste:tot,yd3:yd3,m3:tot*0.0283168,bags:bags,
    readyMixCost:o.pricePerYd?yd3*o.pricePerYd:0,bagCost:o.pricePerBag?bags[size]*o.pricePerBag:0};
}
var api={slabFt3:slabFt3,footingFt3:footingFt3,columnFt3:columnFt3,calc:calc,BAG_YIELD_FT3:BAG_YIELD_FT3};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ConcreteCalc=api;
})(this);
