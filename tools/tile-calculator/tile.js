/* Tile count math. window.TILE and module.exports. Area in sq ft, tile size in inches. */
(function(root){
function calc(o){var A=o.areaFt2,tw=o.tileW,th=o.tileH;if(!(A>0&&tw>0&&th>0))return null;
  var g=o.groutIn>0?o.groutIn:0,tileFt2=(tw+g)*(th+g)/144,w=isFinite(o.waste)&&o.waste>=0?o.waste:10,need=A*(1+w/100);
  var tiles=Math.ceil(need/tileFt2-1e-9),per=o.perBox>0?Math.floor(o.perBox):0,boxes=per?Math.ceil(tiles/per-1e-9):0;
  return{tileFt2:tileFt2,base:A/tileFt2,areaWithWaste:need,tiles:tiles,boxes:boxes,cost:o.pricePerFt2>0?(per?boxes*per*tw*th/144:need)*o.pricePerFt2:0}}
var api={calc:calc};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.TILE=api;
})(this);
