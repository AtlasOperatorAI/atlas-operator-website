/* Paint coverage math. window.PAINT and module.exports. Lengths in feet. */
(function(root){
var DOOR_FT2=20,WINDOW_FT2=15; /* typical allowances: 3' x 6' 8" door = 20 sq ft, 3' x 5' window = 15 sq ft */
function calc(o){var L=o.length,W=o.width,H=o.height;if(!(L>0&&W>0&&H>0))return null;
  var walls=2*(L+W)*H,open=(o.doors||0)*DOOR_FT2+(o.windows||0)*WINDOW_FT2,net=Math.max(0,walls-open),ceil=o.ceiling?L*W:0;
  var coats=o.coats>0?Math.round(o.coats):2,cov=o.coverage>0?o.coverage:350;
  var wallGal=net*coats/cov,ceilGal=ceil*coats/cov,total=wallGal+ceilGal;
  return{walls:walls,openings:open,netWalls:net,ceiling:ceil,paintable:net+ceil,coats:coats,coverage:cov,wallGal:wallGal,ceilGal:ceilGal,gallons:total,buyGallons:Math.ceil(total-1e-9),quarts:Math.ceil(total*4-1e-9),primerGal:o.primer?(net+ceil)/cov:0}}
var api={calc:calc,DOOR_FT2:DOOR_FT2,WINDOW_FT2:WINDOW_FT2};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.PAINT=api;
})(this);
