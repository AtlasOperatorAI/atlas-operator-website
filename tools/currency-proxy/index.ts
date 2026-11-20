/* Atlas currency proxy: hourly fxRatesAPI rates for https://atlasoperator.ai/tools/currency-calculator/.
   Railway Function (Bun, one file). The API key comes from the service variable FXRATESAPI_KEY, which is set to the
   reference ${{shared.FXRATESAPI_KEY}}. The key is only ever sent to api.fxratesapi.com in an Authorization header.
   It is never logged and never returned.

   Budget: at most ONE upstream call per rolling 60 minutes, whether it succeeds or fails, and only when someone asks
   for rates. That's 24/day, at most 744 in a 31-day month, against the free plan's 1,000/month and 60/hour.
   A daily cap (MAX_PER_DAY, default 26) is a second guard. When fxRatesAPI says the limit is reached (HTTP 429, or an
   error body about the limit/quota), the proxy makes NO further calls until the reset fxRatesAPI reports (Retry-After or
   a numeric X-RateLimit-Reset) or, if it reports none, the next UTC midnight; then it tries once and backs off again.
   State is in memory (no volume): restarts clear it, so the deploy requires 1 replica, sleep off and restart policy
   ON_FAILURE with max 10 retries (README "Post-deploy checks").
   Per-IP limit: 30 requests per 10 minutes per client IP (X-Real-IP) on /v1/rates -> 429. Kept in memory only, expired
   entries pruned on every request and every 60 s, IPs never logged.
   Every response carries X-Robots-Tag: noindex.

   GET /v1/rates -> {base:"USD", rates:{EUR:..}, timestamp:<provider unix s>, date:<provider ISO>, fetched_at:<ISO>, stale, source, attribution}
   CORS and access: only requests whose Origin is https://atlasoperator.ai get rates. Everything else gets 403, because
   fxRatesAPI's licence allows display to the app's end users, not redistribution. */
const FIAT = "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWL".split(" ");
export const HOUR = 3600_000;
type Snap = { base: "USD"; rates: Record<string, number>; timestamp: number; date: string; fetched_at: string };
export interface Opts { key?: string; origins?: string[]; upstream?: string; fetchFn?: typeof fetch; now?: () => number; maxPerDay?: number; log?: (m: string) => void; ipLimit?: number; ipWindowMs?: number }
const LIMIT_RE = /limit|quota|exceed|too many/i;
/* next 00:00 UTC after t */
export const nextUtcDay = (t: number) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
/* reset time fxRatesAPI reports, if any: Retry-After (seconds or HTTP date) or X-RateLimit-Reset (epoch s/ms or seconds from now). Capped at 32 days. */
export function reportedReset(h: Headers, t: number): number | null {
  const cands: number[] = [];
  const ra = h.get("retry-after"); if (ra) { const n = Number(ra); if (isFinite(n) && n > 0) cands.push(t + n * 1000); else { const d = Date.parse(ra); if (!isNaN(d)) cands.push(d); } }
  const xr = h.get("x-ratelimit-reset"); const n = Number(xr);
  if (xr && isFinite(n) && n > 0) cands.push(n > 1e12 ? n : n > 1e9 ? n * 1000 : t + n * 1000);
  const ok = cands.filter(x => x > t && x - t <= 32 * 86400_000);
  return ok.length ? Math.max(...ok) : null;
}

export function makeProxy(o: Opts = {}) {
  const key = o.key ?? "";
  const origins = new Set(o.origins ?? ["https://atlasoperator.ai"]);
  const upstream = o.upstream ?? "https://api.fxratesapi.com/latest";
  const f = o.fetchFn ?? fetch;
  const now = o.now ?? Date.now;
  const maxPerDay = o.maxPerDay ?? 26;
  const log = o.log ?? ((m: string) => console.log(m));
  let snap: Snap | null = null, lastAttempt = -Infinity, inflight: Promise<void> | null = null, blockedUntil = 0;
  const ipLimit = o.ipLimit ?? 30, ipWindow = o.ipWindowMs ?? 600_000;
  const hitsByIp = new Map<string, { start: number; n: number }>(); /* in memory only; never logged */
  /* drop every entry older than the window; runs on every request and on a 60 s timer, so no IP is held longer than 10 minutes (+ at most 60 s when idle) */
  function prune() { const t = now(); for (const [k, v] of hitsByIp) if (t - v.start >= ipWindow) hitsByIp.delete(k); }
  function limited(req: Request) {
    /* Railway's edge sets X-Real-IP to the client address (overwriting any client value); X-Forwarded-For only as a fallback */
    const ip = ((req.headers.get("x-real-ip") ?? "").trim() || (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown").slice(0, 64);
    const t = now();
    const e = hitsByIp.get(ip);
    if (!e || t - e.start >= ipWindow) { hitsByIp.set(ip, { start: t, n: 1 }); return 0; }
    e.n++;
    return e.n > ipLimit ? Math.ceil((e.start + ipWindow - t) / 1000) : 0;
  }
  let day = "", today = 0, calls = 0;
  const url = upstream + "?base=USD&resolution=1h&places=6&format=json&currencies=" + FIAT.filter(c => c !== "USD").join(",");

  function due() {
    const t = now(), d = new Date(t).toISOString().slice(0, 10);
    if (d !== day) { day = d; today = 0; }
    return t - lastAttempt >= HOUR && t >= blockedUntil && today < maxPerDay && !!key;
  }
  async function pull() {
    lastAttempt = now(); today++; calls++;
    try {
      const r = await f(url, { headers: { Authorization: "Bearer " + key, Accept: "application/json" } });
      let j: any = null; try { j = await r.json(); } catch { j = null; }
      const msg = j && typeof j === "object" ? String(j.error ?? "") + " " + String(j.message ?? "") + " " + String(j.description ?? "") : "";
      if (r.status === 429 || (j && j.success === false && LIMIT_RE.test(msg))) {
        blockedUntil = reportedReset(r.headers, now()) ?? nextUtcDay(now());
        log("upstream limit reached (HTTP " + r.status + "); no calls until " + new Date(blockedUntil).toISOString()); return;
      }
      if (!r.ok) { log("upstream HTTP " + r.status); return; } /* status only: never echo the upstream body */
      if (!j || j.success !== true || j.base !== "USD" || !j.rates || typeof j.timestamp !== "number") { log("upstream bad payload"); return; }
      const rates: Record<string, number> = { USD: 1 };
      for (const c of FIAT) { const v = j.rates[c]; if (typeof v === "number" && isFinite(v) && v > 0) rates[c] = v; }
      if (Object.keys(rates).length < 20) { log("upstream too few rates"); return; }
      snap = { base: "USD", rates, timestamp: j.timestamp, date: String(j.date ?? new Date(j.timestamp * 1000).toISOString()), fetched_at: new Date(now()).toISOString() };
      log("upstream ok " + Object.keys(rates).length + " rates, provider time " + snap.date);
    } catch (e) { log("upstream error " + ((e as Error)?.name ?? "error")); }
  }
  async function ensure() {
    if (due() && !inflight) inflight = pull().finally(() => { inflight = null; });
    if (inflight) await inflight;
  }
  function cors(req: Request, h: Headers) {
    const og = req.headers.get("origin") ?? "";
    h.set("Vary", "Origin");
    if (origins.has(og)) { h.set("Access-Control-Allow-Origin", og); h.set("Access-Control-Allow-Methods", "GET, OPTIONS"); h.set("Access-Control-Max-Age", "86400"); }
    return origins.has(og);
  }
  const json = (body: unknown, status: number, h: Headers) => { h.set("Content-Type", "application/json"); h.set("X-Content-Type-Options", "nosniff"); return new Response(JSON.stringify(body), { status, headers: h }); };

  async function handle(req: Request): Promise<Response> {
    prune();
    const u = new URL(req.url), h = new Headers();
    h.set("X-Robots-Tag", "noindex");
    if (u.pathname === "/health") { h.set("Cache-Control", "no-store"); return json({ ok: true, has_rates: !!snap, upstream_blocked_until: blockedUntil > now() ? new Date(blockedUntil).toISOString() : null, age_s: snap ? Math.round((now() - Date.parse(snap.fetched_at)) / 1000) : null, upstream_calls_since_start: calls }, 200, h); }
    if (u.pathname !== "/v1/rates") return json({ error: "not found" }, 404, h);
    const allowed = cors(req, h);
    if (req.method === "GET") { const wait = limited(req); if (wait) { h.set("Retry-After", String(wait)); h.set("Cache-Control", "no-store"); return json({ error: "too many requests" }, 429, h); } }
    if (req.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers: h });
    if (req.method !== "GET") return json({ error: "method not allowed" }, 405, h);
    if (!allowed) { h.set("Cache-Control", "no-store"); return json({ error: "forbidden" }, 403, h); }
    await ensure();
    if (!snap) { h.set("Cache-Control", "no-store"); return json({ error: "rates unavailable" }, 503, h); }
    h.set("Cache-Control", "private, max-age=300");
    return json({ ...snap, stale: now() - snap.timestamp * 1000 > 3 * HOUR, source: "fxRatesAPI", attribution: "https://fxratesapi.com" }, 200, h);
  }
  return { fetch: handle, prune, _state: () => ({ calls, today, hasSnap: !!snap, lastAttempt, blockedUntil, trackedIps: hitsByIp.size }) };
}

if (!Bun.env.FXPROXY_NO_SERVE) {
  const p = makeProxy({ key: Bun.env.FXRATESAPI_KEY, origins: (Bun.env.ALLOWED_ORIGINS ?? "https://atlasoperator.ai").split(",").map(s => s.trim()).filter(Boolean), upstream: Bun.env.FX_UPSTREAM || undefined });
  if (!Bun.env.FXRATESAPI_KEY) console.log("FXRATESAPI_KEY is not set: /v1/rates will answer 503");
  Bun.serve({ port: Number(Bun.env.PORT ?? 3000), fetch: p.fetch });
  setInterval(p.prune, 60_000); /* memory hygiene only (no upstream calls): expires idle IP entries */
  console.log("atlas currency proxy up");
}
