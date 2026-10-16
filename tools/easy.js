/* Easy-read layer shared by the measuring tools (same format as /tools/currency-calculator/):
   one main job, big fields filled by a custom keypad (readonly + inputmode=none, so the system keyboard never opens;
   a hardware keyboard still works), one big result, and everything else in a "More" sheet.
   The original calculator card is moved, untouched, into the More sheet: the tool's own math, prefill, analytics,
   A/B arms and app-mode code keep working on the same inputs. Pure keypad helpers are exported for unit tests. */
(function(root){
/* ---------- pure helpers ---------- */
/* Apply one key to an edit buffer. pad "num" (digits, .) or "ftin" (digits, ., ' " /). */
function key(buf,k,pad){buf=buf||"";
  if(k==="C")return "";
  if(k==="B")return buf.replace(/\s+$/,"").slice(0,-1).replace(/\s+$/,"");
  var seg=buf.split(/['"\s]/).pop(),endD=/\d$/.test(buf);
  if(/^\d$/.test(k)){if(pad==="num"&&buf==="0")return k;return buf.length>=14?buf:buf+k}
  if(k==="."){if(seg.indexOf(".")>=0||seg.indexOf("/")>=0)return buf;return buf+(seg===""?"0.":".")}
  if(pad!=="ftin")return buf;
  if(k==="'"){if(!endD||/['"\/]/.test(buf))return buf;return buf+"' "}
  if(k==='"'){if(!endD||/["\/]/.test(buf))return buf;return buf+'" '}
  if(k==="/"){if(!endD||seg.indexOf("/")>=0||seg.indexOf(".")>=0)return buf;return buf+"/"}
  return buf}
/* Turn an ftin buffer into text the tools' FIC.parse understands: 7" 3/8 -> 7 3/8". plain "ft" makes a bare number feet. */
function norm(buf,plain){var s=String(buf||"").trim().replace(/\/$/,"").trim();
  s=s.replace(/(\d+(?:\.\d+)?)"\s*(\d+\/\d+)$/,'$1 $2"');
  if(plain==="ft"&&/^\d*\.?\d+$/.test(s))s+="'";return s}
var api={key:key,norm:norm};
if(typeof module!=="undefined"&&module.exports){module.exports=api;return}
root.EZK=api;
var C=root.EZCFG;if(!C||typeof document==="undefined")return;
/* ---------- DOM layer ---------- */
var d=document,$=function(s){return typeof s==="string"?d.querySelector(s):s},ls={g:function(k){try{return localStorage.getItem(k)}catch(e){return null}},s:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
var TWA=false;try{TWA=/^android-app:\/\//.test(d.referrer)||new URLSearchParams(location.search).get("src")==="twa"||sessionStorage.getItem("atlas_twa")==="1"}catch(e){}
var css=".ez{max-width:480px;margin:0 auto;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;padding:0 14px env(safe-area-inset-bottom)}"+
".eztop{display:flex;justify-content:space-between;align-items:center;height:50px;flex-shrink:0}.eztop .logo{display:flex;gap:8px;align-items:center;font-weight:800;color:var(--fg);text-decoration:none;min-width:0}.eztop .logo i{width:20px;height:20px;border-radius:6px;flex-shrink:0;background:linear-gradient(135deg,var(--acc),var(--acc2))}.eztop h1{font-size:.95rem;margin:0;font-weight:700;color:var(--mut);letter-spacing:0;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
".ezmore{background:transparent;border:1px solid var(--line);color:var(--fg);border-radius:999px;padding:6px 14px;font:inherit;font-size:.9rem;cursor:pointer;flex-shrink:0}"+
".ezres{text-align:center;background:var(--card);border:1px solid #33456b;border-radius:18px;padding:8px 12px 10px;margin:2px 0 8px}.ezres b{display:block;font-size:3.1rem;line-height:1.1;font-weight:800;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ezres b.m{font-size:2.4rem}.ezres b.s{font-size:1.8rem}"+
".ezres .u{display:block;font-size:1.05rem;color:var(--acc);font-weight:700}.ezres .sub{display:block;font-size:1rem;color:var(--fg);opacity:.85;margin-top:2px}"+
".ezf{display:flex;align-items:center;gap:8px;background:var(--card);border:2px solid var(--line);border-radius:16px;padding:6px 12px;margin-bottom:7px;min-height:60px;cursor:pointer}.ezf.on{border-color:var(--acc);background:#14203a}"+
".ezf label{flex-shrink:0;font-size:.95rem;color:var(--mut);font-weight:600;max-width:42%;line-height:1.2;cursor:pointer}"+
".ezf input{flex:1;min-width:0;text-align:right;font:inherit;font-weight:700;font-size:1.9rem;background:transparent;border:0;color:var(--fg);padding:0;margin:0;outline:none;caret-color:transparent;cursor:pointer}"+
".ezseg{display:flex;flex-shrink:0;border:1px solid var(--line);border-radius:10px;overflow:hidden}.ezseg button{background:transparent;border:0;color:var(--mut);font:inherit;font-size:.9rem;font-weight:700;padding:8px 9px;min-width:38px;cursor:pointer}.ezseg button[aria-pressed=true]{background:var(--acc);color:#06101f}"+
".ezchips{display:flex;gap:6px;margin-bottom:7px}.ezchips button{flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;color:var(--fg);font:inherit;font-size:1.15rem;font-weight:700;padding:9px 4px;cursor:pointer;min-height:44px}.ezchips button[aria-pressed=true]{background:var(--acc);color:#06101f;border-color:var(--acc)}"+
".ezpad{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,minmax(52px,1fr));gap:8px;margin-top:4px;flex:1;max-height:330px;min-height:236px}"+
".ezpad button{border:0;border-radius:16px;background:#151c2b;color:var(--fg);font:inherit;font-size:1.7rem;font-weight:600;cursor:pointer;touch-action:manipulation}.ezpad button:active{background:#22304a}.ezpad .op{background:#1b2438;color:var(--acc);font-size:1.3rem}.ezpad .fk{background:#1b2438;color:#ffd166;font-size:1.25rem}"+
".ezpad .c{grid-column:4;grid-row:1/span 2}.ezpad .bk{grid-column:4;grid-row:3/span 2}.ezpad .z{grid-column:span 2}"+
".eznote{text-align:center;font-size:.8rem;color:var(--mut);padding:8px 0 10px;margin:0}"+
".ezsheet{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:30;display:flex;align-items:flex-end;justify-content:center}.ezsheet.hidden{display:none!important}"+
".ezsheet>div{background:var(--bg);border:1px solid var(--line);border-bottom:0;border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:88vh;max-height:88dvh;overflow:auto;padding:14px 14px 22px}"+
".ezsh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.ezsh h2{margin:0;font-size:1.2rem}.ezx{padding:9px 14px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--fg);font:inherit;cursor:pointer}"+
".ezsheet .card{margin-bottom:10px}.ezmi{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;color:var(--fg);padding:12px 14px;margin-top:8px;text-decoration:none;font-weight:600}.ezmi small{display:block;color:var(--mut);font-weight:400}"+
".ezbelow{border-top:1px solid var(--line);margin-top:6px;padding-top:18px}.ezh{font-size:1.5rem;line-height:1.2;margin:4px 0 6px}"+
"html[data-twa] .webonly{display:none!important}";
var st=d.createElement("style");st.textContent=css;d.head.appendChild(st);
var ez=$("#ez"),card=$(C.card),UK="atlas_ez_"+C.tool,saved={};try{saved=JSON.parse(ls.g(UK)||"{}")||{}}catch(e){}
var act=0,buf=null,fresh=true,F=C.fields;
function el(tag,cls,html){var e=d.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
var res=el("div","ezres");res.setAttribute("aria-live","polite");res.innerHTML='<b id="ezv">–</b><span class="u" id="ezu"></span><span class="sub" id="ezsub"></span>';
var box=el("div","ezbox"),pad=el("div","ezpad");pad.id="ezpad";pad.setAttribute("aria-label","Keypad");
var note=el("p","eznote",C.note||"Tap a box, type on the keypad. Shapes, waste, cost and more are under More.");
ez.appendChild(res);ez.appendChild(box);ez.appendChild(pad);ez.appendChild(note);
/* More sheet: the original calculator card + links */
var sh=el("div","ezsheet hidden");sh.id="ezsheet";sh.setAttribute("role","dialog");sh.setAttribute("aria-modal","true");sh.setAttribute("aria-labelledby","ezsh");
sh.innerHTML='<div><div class="ezsh"><h2 id="ezsh">More options</h2><button class="ezx" type="button" data-close>Done</button></div><div id="ezslot"></div>'+
 (C.proText?'<a class="ezmi webonly" href="#pro" data-close>'+C.proText+'</a>':'')+'<a class="ezmi" href="#guide" data-close>📖 Guide &amp; FAQ<small>How the math works, tables and tips</small></a><a class="ezmi" href="/#tools">🧰 All tools</a></div>';
d.body.appendChild(sh);$("#ezslot").appendChild(card);
if(TWA){d.documentElement.setAttribute("data-twa","1");sh.querySelectorAll(".webonly").forEach(function(e){e.parentNode.removeChild(e)})}
function openS(){sh.classList.remove("hidden");d.body.style.overflow="hidden";if(C.onMore)C.onMore()}
function closeS(){sh.classList.add("hidden");d.body.style.overflow="";buf=null;draw()}
$("#ezmore").addEventListener("click",openS);
sh.addEventListener("click",function(e){if(e.target===sh||(e.target.closest&&e.target.closest("[data-close]")))closeS()});
/* field helpers */
function tgt(f){return typeof f.t==="function"?f.t():$(f.t)}
function vis(f){if(f.chips)return true;var t=tgt(f);return !!t&&!(f.hide&&f.hide())}
function units(f){return f.units?f.units():[{n:"",k:1,pad:"num"}]}
function uidx(f,i){var U=units(f);for(var j=0;j<U.length;j++)if(U[j].on&&U[j].on())return j;var s=saved[f.id];return s!=null&&s<U.length?s:0}
function unit(f,i){return units(f)[uidx(f,i)]}
function base2disp(f,u){var t=tgt(f);if(!t)return "";var v=String(t.value||"");if(u.pad==="ftin"&&u.k===1)return v;
  var n=/^\s*-?\d*\.?\d+\s*$/.test(v)?parseFloat(v):(root.FIC&&f.ftin!==false?root.FIC.parse(v)/12:NaN);if(!isFinite(n))return v;var x=n/u.k;return String(+x.toFixed(3))}
function write(f,u,b){var t=tgt(f);if(!t)return;var v;
  if(u.pad==="ftin")v=norm(b,f.plain);else{var n=parseFloat(b);v=b===""?"":u.k===1?b.replace(/\.$/,""):isFinite(n)?String(+(n*u.k).toFixed(4)):""}
  t.value=v;t.dispatchEvent(new Event("input",{bubbles:true}));t.dispatchEvent(new Event("change",{bubbles:true}))}
function label(f){var l=typeof f.lab==="function"?f.lab():f.lab;return String(l||"").replace(/\s*\(.*?\)\s*/g," ").replace(/,.*$/,"").trim()}
function draw(){var vF=[],h=d.activeElement&&d.activeElement.closest&&d.activeElement.closest(".ezf");box.innerHTML="";
  F.forEach(function(f,i){if(!vis(f))return;
   if(f.chips){var c=el("div","ezchips");c.setAttribute("role","group");c.setAttribute("aria-label",f.aria||"Options");f.chips.forEach(function(o){var b=el("button","",o.n);b.type="button";b.setAttribute("aria-pressed",String(!!o.on()));if(o.aria)b.setAttribute("aria-label",o.aria);b.onclick=function(){o.go();buf=null;draw()};c.appendChild(b)});box.appendChild(c);return}
   vF.push(i);var U=units(f),ui=uidx(f,i),u=U[ui],w=el("div","ezf"+(i===act?" on":""));w.dataset.i=i;
   var id="ezi"+i,lb=label(f);w.innerHTML='<label for="'+id+'"></label><input id="'+id+'" readonly inputmode="none" autocomplete="off">';
   w.querySelector("label").textContent=lb;var inp=w.querySelector("input");inp.value=(i===act&&buf!=null)?buf:base2disp(f,u);inp.setAttribute("aria-label",lb+(u.n?" in "+u.n:""));
   if(U.length>1){var sg=el("div","ezseg");sg.setAttribute("role","group");sg.setAttribute("aria-label",lb+" unit");U.forEach(function(x,j){var b=el("button","",x.n);b.type="button";b.dataset.u=j;b.setAttribute("aria-pressed",String(j===ui));
     b.onclick=function(e){e.stopPropagation();if(j===ui)return;if(x.go){x.go()}else{var disp=base2disp(f,x);saved[f.id]=j;ls.s(UK,JSON.stringify(saved));if(f.keep!==false){/* value stays the same length, shown in the new unit */}void disp}
       act=i;buf=null;fresh=true;draw()};sg.appendChild(b)});w.appendChild(sg)}
   else if(u.n){var s=el("span","ezseg");s.innerHTML='<button type="button" aria-pressed="true" tabindex="-1">'+u.n+'</button>';w.appendChild(s)}
   w.addEventListener("click",function(){sel(i)});inp.addEventListener("focus",function(){if(act!==i)sel(i,true)});box.appendChild(w)});
  if(vF.indexOf(act)<0&&vF.length)act=vF[0];
  if(h){var nf=box.querySelector('.ezf[data-i="'+act+'"] input');if(nf&&d.activeElement!==nf)nf.focus({preventScroll:true})}
  keys();result()}
function sel(i,fromFocus){if(C.onField)C.onField();act=i;buf=null;fresh=true;draw();if(!fromFocus){var nf=box.querySelector('.ezf[data-i="'+i+'"] input');if(nf&&matchMedia("(hover:hover)").matches)nf.focus({preventScroll:true})}}
var padKind=null;
function keys(){var f=F[act],k=f&&!f.chips?unit(f,act).pad:"num";if(k===padKind)return;padKind=k;
  pad.innerHTML=k==="ftin"?
   '<button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="fk" data-k="\'" aria-label="Feet">ft \'</button>'+
   '<button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="fk" data-k="&quot;" aria-label="Inches">in "</button>'+
   '<button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="fk" data-k="/" aria-label="Fraction">⁄ frac</button>'+
   '<button data-k="0">0</button><button data-k=".">.</button><button class="op" data-k="B" aria-label="Backspace">⌫</button><button class="op" data-k="C" aria-label="Clear">C</button>':
   '<button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="op c" data-k="C" aria-label="Clear">C</button>'+
   '<button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button>'+
   '<button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op bk" data-k="B" aria-label="Backspace">⌫</button>'+
   '<button class="z" data-k="0">0</button><button data-k=".">.</button>';
  pad.querySelectorAll("button").forEach(function(b){b.type="button";b.addEventListener("click",function(){press(b.dataset.k)})})}
function press(k){var f=F[act];if(!f||f.chips||!vis(f))return;var u=unit(f,act);
  if(k==="N"){var vs=[];F.forEach(function(g,j){if(!g.chips&&vis(g))vs.push(j)});act=vs[(vs.indexOf(act)+1)%vs.length];buf=null;fresh=true;draw();return}
  var cur=buf!=null?buf:(fresh?"":base2disp(f,u));if(fresh&&k!=="C"&&k!=="B"){cur=""}if(fresh&&k==="B"){cur=base2disp(f,u)}fresh=false;
  buf=key(cur,k,u.pad);write(f,u,buf);var inp=box.querySelector('.ezf[data-i="'+act+'"] input');if(inp)inp.value=buf;result()}
function size(e,t){var n=t.length;e.classList.toggle("m",n>9&&n<=13);e.classList.toggle("s",n>13)}
function result(){var r=C.result()||{};var v=String(r.v==null?"–":r.v);$("#ezv").textContent=v;size($("#ezv"),v);$("#ezu").textContent=r.u||"";$("#ezsub").textContent=r.sub||""}
d.addEventListener("keydown",function(e){if(!sh.classList.contains("hidden")||e.ctrlKey||e.metaKey||e.altKey)return;var a=d.activeElement;if(a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)&&!a.closest(".ezf"))return;var k=e.key;
  if(/^[0-9.]$/.test(k)||k==="'"||k==='"'||k==="/"){press(k);e.preventDefault()}else if(k===","){press(".");e.preventDefault()}else if(k==="Backspace"){press("B");e.preventDefault()}else if(k==="Escape"||k==="Delete"){press("C")}else if(k==="Enter"){press("N");e.preventDefault()}});
/* the tool's own code (prefill, More-sheet edits) can change the card: keep the main screen in sync */
var pend=0;new MutationObserver(function(){if(pend)return;pend=setTimeout(function(){pend=0;if(buf==null)draw();else result()},0)}).observe(card,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["style","class","aria-selected"]});
card.addEventListener("input",function(e){if(!e.isTrusted)return;buf=null});
draw();root.__ez={press:press,sel:sel,open:openS,close:closeS,state:function(){return{act:act,buf:buf}}};
})(this);
