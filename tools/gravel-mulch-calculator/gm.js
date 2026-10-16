/* Gravel / mulch / soil volume math. window.GM and module.exports. Lengths in feet, depth in inches. */
(function(root){
/* Typical bulk densities in US tons per cubic yard. Real values vary by stone size and moisture: confirm with your supplier. */
var MATERIALS={gravel:{name:"Gravel / crushed stone",tpy:1.4},pea:{name:"Pea gravel",tpy:1.4},sand:{name:"Sand",tpy:1.35},topsoil:{name:"Topsoil",tpy:1.1},mulch:{name:"Mulch (bark / wood chips)",tpy:0.3}};
function shapeFt2(type,a,b){if(!(a>0))return NaN;if(type==="circle")return Math.PI*a*a/4;if(!(b>0))return NaN;return type==="tri"?a*b/2:a*b}
function calc(o){var ft2=shapeFt2(o.shape||"rect",o.a,o.b),d=o.depthIn;if(!(isFinite(ft2)&&d>0))return null;
  var w=1+(isFinite(o.waste)&&o.waste>0?o.waste:0)/100,ft3=ft2*d/12*w,yd3=ft3/27,tpy=isFinite(o.tpy)&&o.tpy>0?o.tpy:1.4;
  return{ft2:ft2,ft3:ft3,yd3:yd3,m3:ft3*0.028316846592,tons:yd3*tpy,bags2:Math.ceil(ft3/2-1e-9),bags3:Math.ceil(ft3/3-1e-9),bags05:Math.ceil(ft3/0.5-1e-9),cost:o.pricePerYd>0?yd3*o.pricePerYd:(o.pricePerTon>0?yd3*tpy*o.pricePerTon:0)}}
var api={MATERIALS:MATERIALS,shapeFt2:shapeFt2,calc:calc};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.GM=api;
})(this);
