/* Area math. window.AREA and module.exports. Lengths come in as inches (ft-in mode) or metres (metric); areas come out in sq ft. */
(function(root){
var SQFT_PER_M2=10.763910416709722,M2_PER_SQFT=0.09290304;
/* Raw area in the input unit squared (sq in or m²). Returns NaN for bad/negative input. */
function shape(type,d){var a=d.a,b=d.b,c=d.c,e=d.e;function ok(){for(var i=0;i<arguments.length;i++){var v=arguments[i];if(!(isFinite(v)&&v>0))return false}return true}
  if(type==="rect")return ok(a,b)?a*b:NaN;
  if(type==="tri")return ok(a,b)?a*b/2:NaN;            /* a = base, b = height */
  if(type==="circle")return ok(a)?Math.PI*a*a/4:NaN;   /* a = diameter */
  if(type==="l"){                                       /* overall a × b minus the missing corner c × e */
    if(!ok(a,b,c,e)||c>=a||e>=b)return NaN;return a*b-c*e}
  return NaN}
/* Convert a raw area to sq ft. unit "ftin" (sq in) or "m" (m²). */
function toSqft(raw,unit){return unit==="m"?raw*SQFT_PER_M2:raw/144}
/* Totals from a list of sq ft areas; waste % and $/sq ft optional. */
function totals(sqftList,wastePct,costPerSqft){var net=0;sqftList.forEach(function(x){if(isFinite(x))net+=x});var w=isFinite(wastePct)&&wastePct>0?wastePct:0,g=net*(1+w/100),cost=isFinite(costPerSqft)&&costPerSqft>0?g*costPerSqft:0;
  return{net:net,gross:g,waste:g-net,sqyd:g/9,m2:g*M2_PER_SQFT,netSqyd:net/9,netM2:net*M2_PER_SQFT,cost:cost}}
var api={shape:shape,toSqft:toSqft,totals:totals,SQFT_PER_M2:SQFT_PER_M2,M2_PER_SQFT:M2_PER_SQFT};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.AREA=api;
})(this);
