/* Feet-inch-fraction math. window.FIC and module.exports. All lengths in inches internally. */
(function(root){
function gcd(a,b){return b?gcd(b,a%b):a}
/* Parse: 5' 7 3/8", 5ft 7in, 7-3/8, 67.375, 5'7", 3/4, 2m? (no metric). Returns inches or NaN. */
function parse(str){
  var s=String(str||"").trim().toLowerCase().replace(/feet|foot|ft/g,"'").replace(/inches|inch|in/g,'"').replace(/[″”]/g,'"').replace(/[′’]/g,"'");
  if(!s)return NaN;var neg=false;if(s[0]==="-"){neg=true;s=s.slice(1).trim()}
  var ft=0,inch=0,m=s.match(/^(\d+(?:\.\d+)?)\s*'\s*(.*)$/);
  if(m){ft=parseFloat(m[1]);s=m[2].trim()}
  s=s.replace(/"$/,"").trim();
  if(s){m=s.match(/^(\d+(?:\.\d+)?)?(?:[\s-]+)?(?:(\d+)\s*\/\s*(\d+))?$/);
    if(!m||(!m[1]&&!m[2]))return NaN;
    if(m[1]&&!m[2]&&/\d\s*\/\s*\d/.test(s))return NaN;
    var whole=m[1]?parseFloat(m[1]):0,fr=0;if(m[2]){if(+m[3]===0)return NaN;fr=+m[2]/+m[3]}
    if(m[1]&&!m[2]&&s.indexOf("/")<0)inch=whole;else inch=whole+fr}
  var t=ft*12+inch;return neg?-t:t}
/* Format inches as 5' 7 3/8" rounded to 1/den */
function fmt(inches,den){den=den||16;var neg=inches<0,a=Math.abs(inches),n=Math.round(a*den),ft=Math.floor(n/(12*den));n-=ft*12*den;var wi=Math.floor(n/den),fr=n-wi*den,out="";
  if(fr){var g=gcd(fr,den);out=(wi?wi+" ":"")+(fr/g)+"/"+(den/g)+'"'}else out=wi+'"';
  return(neg?"-":"")+(ft?ft+"' ":"")+out}
function op(a,o,b){if(o==="+")return a+b;if(o==="-")return a-b;if(o==="*")return a*b;if(o==="/")return b?a/b:NaN;return NaN} /* * and / take b as a plain number */
function stairs(totalRiseIn,maxRiserIn,treadIn){maxRiserIn=maxRiserIn||7.75;treadIn=treadIn||10;var n=Math.ceil(totalRiseIn/maxRiserIn-1e-9),r=totalRiseIn/n,treads=n-1;return{risers:n,riser:r,treads:treads,tread:treadIn,totalRun:treads*treadIn,angleDeg:Math.atan(r/treadIn)*180/Math.PI,stringer:Math.sqrt(Math.pow(treads*treadIn,2)+Math.pow(totalRiseIn,2))}}
function rafter(runIn,pitch,overhangIn){/* pitch = rise per 12 in of run */var slope=Math.sqrt(144+pitch*pitch)/12;return{rise:runIn*pitch/12,length:runIn*slope,withOverhang:(runIn+(overhangIn||0))*slope,angleDeg:Math.atan(pitch/12)*180/Math.PI}}
function boardFeet(thickIn,widthIn,lengthFt,qty){return thickIn*widthIn*lengthFt/12*(qty||1)}
var api={parse:parse,fmt:fmt,op:op,stairs:stairs,rafter:rafter,boardFeet:boardFeet};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.FIC=api;
})(this);
