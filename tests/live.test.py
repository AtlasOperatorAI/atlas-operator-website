"""Browser test. Usage: python3 tests/live.test.py [base_url]  (default https://atlasoperator.ai)
Checks: zero console errors (on a local server, the analytics endpoint's CORS refusal for localhost is ignored), calculator results, app mode (?src=twa) has no ad/affiliate slots or Stripe links, word counts."""
import sys,re,json
from playwright.sync_api import sync_playwright
B=(sys.argv[1] if len(sys.argv)>1 else "https://atlasoperator.ai").rstrip("/")
PAGES=["/","/about/","/contact/","/affiliate-disclosure/","/privacy-policy.html","/guides/",
"/tools/concrete-calculator/","/tools/feet-inch-calculator/","/tools/area-calculator/","/tools/currency-calculator/",
"/tools/gravel-mulch-calculator/","/tools/paint-calculator/","/tools/tile-calculator/",
"/guides/bags-of-concrete-for-10x10-slab/","/guides/concrete-for-fence-posts/","/guides/bags-of-concrete-per-yard/","/guides/feet-inch-to-decimal-chart/",
"/guides/inches-to-feet-conversion/","/guides/square-footage-of-a-room/","/guides/flooring-square-footage-with-waste/","/guides/square-feet-to-square-yards-carpet/",
"/guides/usd-to-mxn-travel-guide/","/guides/tipping-in-mexico/"]
CHECKS={"/tools/gravel-mulch-calculator/":{"ryd":"0.93","rt":"1.30","rb2":"13","rb3":"9"},
"/tools/paint-calculator/":{"rg":"2","rexact":"1.73","rarea":"302"},
"/tools/tile-calculator/":{"rt":"44","ra":"88.0"},
"/tools/concrete-calculator/?shape=slab&a=10&b=10&c=4&waste=10":{"rbags":"62","ryd":"1.36"},
"/tools/concrete-calculator/?shape=column&a=12&b=4&waste=0":{"rbags":"6"},
"/tools/area-calculator/?l=12'6\"&w=10'":{"r1":"125.00"},
"/tools/tile-calculator/?l=10&w=8&waste=15&pb=8":{"rt":"46","rb":"6"},
"/guides/bags-of-concrete-for-10x10-slab/":{"yd":"1.36","b80":"62","b60":"82","b40":"123"},
"/guides/concrete-for-fence-posts/":{"pp":"1.38","bp":"2.30","bt":"24"},
"/guides/bags-of-concrete-per-yard/":{"b80":"45","b60":"60","b40":"90"},
"/guides/feet-inch-to-decimal-chart/":{"ft":"7.4479"},
"/guides/inches-to-feet-conversion/":{"fi":"8' 4 3/4\""},
"/guides/square-footage-of-a-room/":{"sf":"128.13","sy":"14.24"},
"/guides/flooring-square-footage-with-waste/":{"sf":"184.00","bx":"11"},
"/guides/square-feet-to-square-yards-carpet/":{"y":"16.00"},
"/guides/tipping-in-mexico/":{"tip":"$127.50","tot":"$977.50","pp":"$488.75"}}
fails=[];res={}
LOCAL=bool(re.match(r"https?://(127\.0\.0\.1|localhost)",B))
def noise(t):return LOCAL and ("atlas-analytics" in t or t.startswith("Failed to load resource: net::ERR_FAILED"))
EZ=["feet-inch","concrete","area","gravel-mulch","paint","tile"]
def keys(pg,seq):
    for k in seq:
        i=pg.evaluate("k=>[...document.querySelectorAll('#ezpad button')].findIndex(b=>b.dataset.k===k)",k)
        if i<0:fails.append(f"key {k!r} missing on pad");continue
        pg.locator("#ezpad button").nth(i).tap()
def txt(pg,sel):return pg.eval_on_selector(sel,"e=>(e.value!==undefined&&e.tagName!=='DIV'?e.value:e.textContent).trim()")
def want(name,got,exp):
    if got!=exp:fails.append(f"{name}: got {got!r} want {exp!r}")
def q(u,extra):return u+("&" if "?" in u else "?")+extra
with sync_playwright() as p:
    br=p.chromium.launch();ctx=br.new_context()
    for path in PAGES:
        for mode in ("web","app"):
            pg=ctx.new_page();errs=[]
            pg.on("console",lambda m:errs.append(m.text) if m.type=="error" and not noise(m.text) else None);pg.on("pageerror",lambda e:errs.append(str(e)))
            u=B+path; u=q(u,"atlas_test=1"); u=q(u,"src=twa") if mode=="app" else u
            r=pg.goto(u,wait_until="load");pg.wait_for_timeout(1200)
            if r.status!=200:fails.append(f"{mode} {path} HTTP {r.status}")
            if errs:fails.append(f"{mode} {path} console: {errs[:3]}")
            if mode=="app":
                bad=pg.evaluate("""()=>({slots:document.querySelectorAll('.ad-slot,.aff-slot,[data-ad],[data-affiliate],ins.adsbygoogle').length,stripe:[...document.querySelectorAll('a[href]')].filter(a=>/stripe\\.com|amazon\\.|amzn\\.to|tag=/.test(a.href)).length,pro:document.querySelectorAll('#gateB,[data-plan]').length,ads:document.querySelectorAll('script[src*="googlesyndication"],script[src*="adsbygoogle"]').length})""")
                if path.startswith("/tools/"):
                    pro=pg.evaluate("()=>(document.body.innerText.match(/\\bPro\\b/g)||[]).length")
                    if pro:fails.append(f"app {path} shows 'Pro' text x{pro}")
                if bad["slots"] or bad["stripe"] or bad["pro"] or bad["ads"]:fails.append(f"app {path} not clean {bad}")
            else:
                w=pg.evaluate("""()=>{const m=document.querySelector('main')||document.body;const c=m.cloneNode(true);c.querySelectorAll('section.card,script,style,#pro,form').forEach(e=>e.remove());return (c.innerText||c.textContent).split(/\\s+/).filter(x=>/[A-Za-z]/.test(x)).length}""")
                res[path]=w
            pg.close()
    for path,exp in CHECKS.items():
        pg=ctx.new_page();errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.goto(B+path,wait_until="load");pg.wait_for_timeout(1200);pg.wait_for_timeout(300)
        for k,v in exp.items():
            got=pg.eval_on_selector("#"+k,"e=>e.textContent.trim()")
            if got!=v:fails.append(f"{path} #{k}: got {got!r} want {v!r}")
        pg.close()
    pg=ctx.new_page();pg.goto(B+"/guides/usd-to-mxn-travel-guide/?atlas_test=1",wait_until="load");pg.wait_for_timeout(1200);pg.wait_for_timeout(1500)
    rate=pg.eval_on_selector("#r","e=>parseFloat(e.value)");mx=pg.eval_on_selector("#m","e=>parseFloat(e.value)")
    if not(rate>5 and abs(mx-100*rate)<0.02):fails.append(f"usd-mxn rate={rate} m={mx}")
    print("USD->MXN live rate loaded:",rate)
    # Easy-read layout + keypad (390x844 phone, touch)
    mob=br.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    for t in EZ:
        for mode in ("web","app"):
            pg=mob.new_page();errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
            pg.goto(f"{B}/tools/{t}-calculator/?atlas_test=1"+("&src=twa" if mode=="app" else ""),wait_until="load");pg.wait_for_timeout(600)
            info=pg.evaluate("""()=>({f:[...document.querySelectorAll('.ezf input')].map(i=>i.readOnly&&i.getAttribute('inputmode')==='none'),keys:document.querySelectorAll('#ezpad button').length,
              over:document.documentElement.scrollWidth>innerWidth+1,res:document.getElementById('ezv').textContent,big:parseFloat(getComputedStyle(document.getElementById('ezv')).fontSize),
              padH:document.getElementById('ezpad').getBoundingClientRect().height,padBottom:document.getElementById('ezpad').getBoundingClientRect().bottom,
              card:!!document.querySelector('#ezslot section.card'),sheetHidden:document.getElementById('ezsheet').classList.contains('hidden')})""")
            n=f"ez {mode} {t}"
            if not info["f"] or not all(info["f"]):fails.append(f"{n}: fields must be readonly + inputmode=none {info['f']}")
            if info["keys"]<13:fails.append(f"{n}: keypad has {info['keys']} keys")
            if info["over"]:fails.append(f"{n}: horizontal overflow at 390px")
            if info["res"] in ("","–"):fails.append(f"{n}: no result on load")
            if info["big"]<40:fails.append(f"{n}: result font {info['big']}px < 40")
            if info["padH"]<230 or info["padBottom"]>844:fails.append(f"{n}: keypad size/pos {info['padH']}/{info['padBottom']}")
            if not info["card"] or not info["sheetHidden"]:fails.append(f"{n}: More sheet setup {info}")
            pg.tap("#ezmore");pg.wait_for_timeout(150)
            if not pg.is_visible('#ezsheet section.card'):fails.append(f"{n}: More sheet did not open")
            pg.tap("#ezsheet [data-close].ezx");pg.wait_for_timeout(150)
            if pg.is_visible('#ezsheet'):fails.append(f"{n}: More sheet did not close")
            if errs:fails.append(f"{n}: {errs[:2]}")
            pg.close()
    pg=mob.new_page();pg.goto(B+"/tools/concrete-calculator/?atlas_test=1",wait_until="load");pg.wait_for_timeout(500)
    pg.tap("#ezi0");keys(pg,["2","0"]);want("ez concrete 20x10x4 bags",txt(pg,"#ezv"),"123");want("ez concrete #a",txt(pg,"#a"),"20")
    keys(pg,["B"]);want("ez concrete backspace",txt(pg,"#a"),"2");keys(pg,["C","1","0"])
    pg.tap('.ezf[data-i="0"] .ezseg button[data-u="1"]');keys(pg,["3"]);want("ez concrete 3 m -> ft",txt(pg,"#a"),"9.8425");want("ez concrete m field",txt(pg,"#ezi0"),"3")
    pg.tap('.ezf[data-i="0"] .ezseg button[data-u="0"]');pg.evaluate("localStorage.clear()");pg.close()
    pg=mob.new_page();pg.goto(B+"/tools/concrete-calculator/?shape=column&a=12&b=4&waste=0&atlas_test=1",wait_until="load");pg.wait_for_timeout(500)
    want("ez concrete prefill column bags",txt(pg,"#ezv"),"6");want("ez concrete column has 2 fields",str(pg.locator(".ezf").count()),"2");pg.close()
    pg=mob.new_page();pg.goto(B+"/tools/feet-inch-calculator/?atlas_test=1",wait_until="load");pg.wait_for_timeout(500)
    pg.tap("#ezi0");keys(pg,["5","'","7",'"',"3","/","8"]);want("ez feet-inch A",txt(pg,"#ma"),"5' 7 3/8\"");want("ez feet-inch A+B",txt(pg,"#ezv"),"8' 2 1/8\"")
    pg.click("#ezi2");pg.keyboard.type("1'");want("ez feet-inch hardware keys",txt(pg,"#mb"),"1'");want("ez feet-inch 5' 7 3/8 + 1'",txt(pg,"#ezv"),"6' 7 3/8\"")
    pg.tap('.ezchips button[aria-label="Multiply"]');pg.tap("#ezi2");keys(pg,["2"]);want("ez feet-inch x2",txt(pg,"#ezv"),"11' 2 3/4\"")
    if pg.evaluate("[...document.querySelectorAll('#ezpad button')].some(b=>b.dataset.k===\"'\")"):fails.append("ez feet-inch: × number should use the plain pad")
    pg.close()
    pg=mob.new_page();pg.goto(B+"/tools/area-calculator/?atlas_test=1",wait_until="load");pg.wait_for_timeout(500)
    pg.tap("#ezi0");keys(pg,["1","5"]);want("ez area 15x10",txt(pg,"#ezv"),"150.00");keys(pg,["'","6"]);want("ez area 15' 6 x 10",txt(pg,"#ezv"),"155.00")
    pg.tap('.ezf[data-i="0"] .ezseg button[data-u="1"]');pg.wait_for_timeout(100);want("ez area metric",txt(pg,"#ezv"),"129.17");pg.close()
    pg=mob.new_page();pg.goto(B+"/tools/area-calculator/?l=12'6\"&w=10'&atlas_test=1",wait_until="load");pg.wait_for_timeout(500)
    want("ez area prefill",txt(pg,"#ezi0"),"12'6\"");want("ez area prefill result",txt(pg,"#ezv"),"125.00");pg.close()
    pg=mob.new_page();pg.goto(B+"/tools/gravel-mulch-calculator/?atlas_test=1",wait_until="load");pg.wait_for_timeout(500)
    pg.tap('.ezchips button:has-text("Mulch")');want("ez gravel mulch chip",txt(pg,"#mat"),"mulch");want("ez mulch tons/yd",txt(pg,"#tpy"),"0.3")
    pg.tap("#ezi3");keys(pg,["6"]);want("ez gravel 10x10x6",txt(pg,"#ezv"),"1.85");pg.close()
    pg=mob.new_page();pg.goto(B+"/tools/paint-calculator/?atlas_test=1",wait_until="load");pg.wait_for_timeout(500)
    pg.tap("#ezi2");keys(pg,["9"]);want("ez paint 9ft walls",txt(pg,"#ezv"),"2");want("ez paint exact",txt(pg,"#rexact"),"1.98");pg.close()
    pg=mob.new_page();pg.goto(B+"/tools/tile-calculator/?atlas_test=1",wait_until="load");pg.wait_for_timeout(500)
    pg.tap('.ezchips button[aria-label="Tile 12 by 12 inches"]');want("ez tile 12x12",txt(pg,"#ezv"),"88")
    pg.tap("#ezi1");keys(pg,["1","0"]);want("ez tile 10x10 12x12",txt(pg,"#ezv"),"110");pg.close()
    mob.close()
    br.close()
print(json.dumps(res,indent=0))
subst=[k for k,v in res.items() if v>=300]
print(f"substantial pages (>=300 words outside the calculator): {len(subst)}")
print("FAILS:" if fails else "ALL CHECKS PASSED",*fails,sep="\n")
sys.exit(1 if fails else 0)
