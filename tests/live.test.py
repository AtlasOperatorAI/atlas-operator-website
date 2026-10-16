"""Browser test. Usage: python3 tests/live.test.py [base_url]  (default https://atlasoperator.ai)
Checks: zero console errors, calculator results, app mode (?src=twa) has no ad/affiliate slots or Stripe links, word counts."""
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
def q(u,extra):return u+("&" if "?" in u else "?")+extra
with sync_playwright() as p:
    br=p.chromium.launch();ctx=br.new_context()
    for path in PAGES:
        for mode in ("web","app"):
            pg=ctx.new_page();errs=[]
            pg.on("console",lambda m:errs.append(m.text) if m.type=="error" else None);pg.on("pageerror",lambda e:errs.append(str(e)))
            u=B+path; u=q(u,"atlas_test=1"); u=q(u,"src=twa") if mode=="app" else u
            r=pg.goto(u,wait_until="load");pg.wait_for_timeout(1200)
            if r.status!=200:fails.append(f"{mode} {path} HTTP {r.status}")
            if errs:fails.append(f"{mode} {path} console: {errs[:3]}")
            if mode=="app":
                bad=pg.evaluate("""()=>({slots:document.querySelectorAll('.ad-slot,.aff-slot,[data-ad],[data-affiliate],ins.adsbygoogle').length,stripe:[...document.querySelectorAll('a[href]')].filter(a=>/stripe\\.com|amazon\\.|amzn\\.to|tag=/.test(a.href)).length,pro:document.querySelectorAll('#gateB,[data-plan]').length,ads:document.querySelectorAll('script[src*="googlesyndication"],script[src*="adsbygoogle"]').length})""")
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
    br.close()
print(json.dumps(res,indent=0))
subst=[k for k,v in res.items() if v>=300]
print(f"substantial pages (>=300 words outside the calculator): {len(subst)}")
print("FAILS:" if fails else "ALL CHECKS PASSED",*fails,sep="\n")
sys.exit(1 if fails else 0)
