/* bun test tools/currency-proxy — fake upstream and clock; the real key is never used. */
import { expect, test } from "bun:test";
process.env.FXPROXY_NO_SERVE = "1";
const { makeProxy, HOUR, nextUtcDay, reportedReset } = await import("./index.ts");
const KEY = "test-key-not-real";
const OK = "https://atlasoperator.ai";
const body = (ts = 1795179600) => ({ success: true, terms: "https://fxratesapi.com/legal/terms-conditions", timestamp: ts, date: new Date(ts * 1000).toISOString(), base: "USD",
  rates: Object.fromEntries(["EUR", "GBP", "JPY", "MXN", "CAD", "AUD", "CHF", "CNY", "INR", "BRL", "KRW", "SEK", "NOK", "DKK", "PLN", "ZAR", "SGD", "HKD", "NZD", "TRY", "THB", "COP"].map((c, i) => [c, 0.5 + i])) });
function rig(opts: any = {}) {
  let t = Date.parse("2026-11-20T13:05:00Z"); const calls: any[] = []; const logs: string[] = [];
  let mode = opts.mode ?? "ok";
  const fetchFn: any = async (u: string, init: any) => { calls.push({ u, init }); await new Promise(r => setTimeout(r, 5));
    if (mode === "down") throw new Error("ECONNREFUSED"); if (mode === "500") return new Response("err " + KEY, { status: 500 });
    if (mode === "bad") return Response.json({ success: false, error: "invalid base" });
    if (mode === "429") return Response.json({ success: false, error: "too many requests" }, { status: 429 });
    if (mode === "429reset") return Response.json({ success: false }, { status: 429, headers: { "retry-after": "1800" } });
    if (mode === "quota") return Response.json({ success: false, error: "Your monthly usage limit has been reached" }, { status: 200 });
    if (mode === "quota403") return Response.json({ success: false, message: "Monthly quota exceeded" }, { status: 403 });
    return Response.json(body(Math.floor(t / 1000) - 300)); };
  /* per-IP limit off unless a test sets it (F3 tests below use the default 30/10 min) */
  const p = makeProxy({ key: KEY, fetchFn, now: () => t, log: (m: string) => logs.push(m), ipLimit: 1e9, ...opts.p });
  const get = (origin: string | null = OK, path = "/v1/rates", method = "GET", ip = "203.0.113.7") => p.fetch(new Request("https://px.test" + path, { method, headers: { ...(origin ? { origin } : {}), "x-forwarded-for": ip + ", 10.0.0.1" } }));
  return { p, calls, logs, get, tick: (ms: number) => { t += ms; }, set: (m: string) => { mode = m; }, now: () => t };
}
test("no Origin or a foreign Origin -> 403, no rates, no upstream call", async () => {
  const r = rig();
  for (const o of [null, "https://evil.example", "http://atlasoperator.ai", "https://www.atlasoperator.ai.evil.com"]) {
    const res = await r.get(o); expect(res.status).toBe(403); expect(res.headers.get("access-control-allow-origin")).toBeNull(); expect(await res.text()).not.toContain("rates\":");
  }
  expect(r.calls.length).toBe(0);
});
test("allowed Origin -> 200 {base, rates, timestamp, date, fetched_at}; CORS exact; key never in response", async () => {
  const r = rig(); const res = await r.get(); const txt = await res.text(); const j = JSON.parse(txt);
  expect(res.status).toBe(200); expect(res.headers.get("access-control-allow-origin")).toBe(OK); expect(res.headers.get("vary")).toBe("Origin");
  expect(j.base).toBe("USD"); expect(j.rates.USD).toBe(1); expect(j.rates.MXN).toBeGreaterThan(0); expect(typeof j.timestamp).toBe("number"); expect(j.fetched_at).toBe("2026-11-20T13:05:00.000Z"); expect(j.stale).toBe(false);
  expect(j.attribution).toBe("https://fxratesapi.com");
  expect(txt + JSON.stringify([...res.headers])).not.toContain(KEY); expect(j.terms).toBeUndefined();
});
test("upstream gets the key only in the Authorization header (not the URL); base USD, hourly, calculator symbols only", async () => {
  const r = rig(); await r.get(); const c = r.calls[0];
  expect(c.init.headers.Authorization).toBe("Bearer " + KEY); expect(c.u).not.toContain(KEY); expect(c.u).not.toContain("api_key");
  expect(c.u).toStartWith("https://api.fxratesapi.com/latest?base=USD&resolution=1h"); expect(c.u).toContain("currencies=AED,"); expect(c.u).toContain(",MXN,");
});
test("cache: many requests in the hour -> ONE upstream call; concurrent first requests share it", async () => {
  const r = rig(); await Promise.all(Array.from({ length: 20 }, () => r.get())); expect(r.calls.length).toBe(1);
  for (let i = 0; i < 59; i++) { r.tick(60_000); await r.get(); } expect(r.calls.length).toBe(1);
  r.tick(60_000); await r.get(); expect(r.calls.length).toBe(2);
});
test("upstream failure: serves the last good rates, retries no sooner than 60 min, never echoes upstream body", async () => {
  const r = rig(); await r.get(); r.tick(HOUR); r.set("500");
  let res = await r.get(); expect(res.status).toBe(200); expect(r.calls.length).toBe(2);
  for (let i = 0; i < 30; i++) { r.tick(60_000); await r.get(); } expect(r.calls.length).toBe(2);
  expect(r.logs.join("\n")).not.toContain(KEY); expect(r.logs).toContain("upstream HTTP 500");
  r.set("down"); r.tick(HOUR); res = await r.get(); expect(res.status).toBe(200); expect(r.calls.length).toBe(3);
});
test("old snapshot (provider time > 3h) is flagged stale:true", async () => {
  const r = rig(); await r.get(); r.set("down"); r.tick(3 * HOUR + 60_000); const j: any = await (await r.get()).json(); expect(j.stale).toBe(true);
});
test("no rates yet and upstream bad/down -> 503, no key", async () => {
  for (const m of ["bad", "down", "500"]) { const r = rig({ mode: m }); const res = await r.get(); expect(res.status).toBe(503); expect(await res.text()).not.toContain(KEY); }
});
test("no key configured -> 503 and zero upstream calls", async () => {
  const calls: any[] = []; const p = makeProxy({ key: "", fetchFn: (async (...a: any[]) => { calls.push(a); return Response.json(body()); }) as any, log: () => {} });
  const res = await p.fetch(new Request("https://px.test/v1/rates", { headers: { origin: OK } })); expect(res.status).toBe(503); expect(calls.length).toBe(0);
});
test("budget: a request every minute for 31 days stays <= 744 upstream calls (free plan 1,000/month, 60/hour)", async () => {
  const r = rig(); let maxHour = 0, hourCalls: Record<string, number> = {};
  for (let i = 0; i < 31 * 24 * 60; i++) { const before = r.calls.length; await r.p.fetch(new Request("https://px.test/v1/rates", { headers: { origin: OK } })); if (r.calls.length > before) { const k = String(Math.floor(i / 60)); hourCalls[k] = (hourCalls[k] ?? 0) + 1; } r.tick(60_000); }
  maxHour = Math.max(...Object.values(hourCalls)); expect(r.calls.length).toBeLessThanOrEqual(744); expect(maxHour).toBe(1);
  console.log("budget sim: " + r.calls.length + " upstream calls in 31 days, max " + maxHour + "/hour");
}, 60_000);
test("daily cap is a second guard", async () => {
  const r = rig({ p: { maxPerDay: 2 } }); await r.get(); r.tick(HOUR); await r.get(); r.tick(HOUR); await r.get(); expect(r.calls.length).toBe(2);
});
test("/health has no rates; unknown paths 404; POST 405; OPTIONS preflight only for the allowed origin", async () => {
  const r = rig(); const h: any = await (await r.get(null, "/health")).json(); expect(h.ok).toBe(true); expect(h.rates).toBeUndefined();
  expect((await r.get(OK, "/x")).status).toBe(404); expect((await r.get(OK, "/v1/rates", "POST")).status).toBe(405);
  expect((await r.get(OK, "/v1/rates", "OPTIONS")).status).toBe(204); expect((await r.get("https://evil.example", "/v1/rates", "OPTIONS")).status).toBe(403);
});
test("source has no hard-coded key and reads it only from FXRATESAPI_KEY", async () => {
  const src = await Bun.file(import.meta.dir + "/index.ts").text();
  expect(src).not.toMatch(/fxr_[A-Za-z0-9]/); expect(src).not.toMatch(/api_key=/); expect(src.match(/Bun\.env\.FXRATESAPI_KEY/g)?.length).toBe(2); expect(src).not.toMatch(/console\.log\([^)]*key\b/);
});

/* F1: limit reached -> no calls until the next UTC day (or the reset fxRatesAPI reports) */
for (const m of ["429", "quota", "quota403"]) test("F1 limit reached (" + m + "): no upstream calls until next UTC midnight, then one try", async () => {
  const r = rig(); await r.get(); r.tick(HOUR); r.set(m);
  let res = await r.get(); expect(res.status).toBe(200); expect(r.calls.length).toBe(2); /* last good rates still served */
  const until = nextUtcDay(r.now()); expect(r.p._state().blockedUntil).toBe(until);
  const h: any = await (await r.get(null, "/health")).json(); expect(h.upstream_blocked_until).toBe(new Date(until).toISOString());
  while (r.now() + HOUR < until) { r.tick(HOUR); await r.get(); } expect(r.calls.length).toBe(2);
  r.tick(until - r.now()); await r.get(); expect(r.calls.length).toBe(3); /* next UTC day: exactly one try */
  r.tick(HOUR); await r.get(); expect(r.calls.length).toBe(3); /* still limited -> blocked again until the following midnight */
  expect(r.p._state().blockedUntil).toBe(nextUtcDay(until));
  expect(r.logs.join("\n")).not.toContain(KEY); expect(r.logs.some(l => l.startsWith("upstream limit reached"))).toBe(true);
});
test("F1 limit reached with a reported reset (Retry-After 1800 s): waits exactly until then", async () => {
  const r = rig(); await r.get(); r.tick(HOUR); r.set("429reset"); await r.get(); const t0 = r.now(); expect(r.p._state().blockedUntil).toBe(t0 + 1800_000);
  r.set("ok"); r.tick(HOUR); await r.get(); expect(r.calls.length).toBe(3);
});
test("F1 reportedReset parses Retry-After / X-RateLimit-Reset and ignores junk", () => {
  const t = Date.parse("2026-11-20T14:00:00Z");
  expect(reportedReset(new Headers({ "retry-after": "60" }), t)).toBe(t + 60_000);
  expect(reportedReset(new Headers({ "x-ratelimit-reset": String(Date.parse("2026-12-20T00:00:00Z") / 1000) }), t)).toBe(Date.parse("2026-12-20T00:00:00Z"));
  expect(reportedReset(new Headers({ "x-ratelimit-reset": "undefined" }), t)).toBeNull();
  expect(reportedReset(new Headers({ "x-ratelimit-reset": String(t / 1000 + 90 * 86400) }), t)).toBeNull(); /* > 32 days: ignored */
  expect(nextUtcDay(t)).toBe(Date.parse("2026-11-21T00:00:00Z"));
});
test("F1 budget with a limit hit mid-month: a request every minute for 31 days stays <= 744 and stops after the limit", async () => {
  const r = rig(); for (let i = 0; i < 31 * 24 * 60; i++) { if (i === 10 * 24 * 60) r.set("quota"); await r.get(); r.tick(60_000); }
  expect(r.calls.length).toBeLessThanOrEqual(10 * 24 + 1 + 21); /* hourly for 10 days, then one try per UTC day */
  console.log("budget sim with limit on day 10: " + r.calls.length + " upstream calls in 31 days");
}, 60_000);
/* F3: per-IP limit + noindex */
test("F3 per-IP limit: 30 requests / 10 min per client IP -> 31st gets 429 + Retry-After; other IPs unaffected; window resets", async () => {
  const r = rig({ p: { ipLimit: 30 } });
  for (let i = 0; i < 30; i++) expect((await r.get(OK, "/v1/rates", "GET", "198.51.100.1")).status).toBe(200);
  const res = await r.get(OK, "/v1/rates", "GET", "198.51.100.1"); expect(res.status).toBe(429); expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(res.headers.get("access-control-allow-origin")).toBe(OK); /* the page can read the 429 and fall back */
  expect((await r.get(OK, "/v1/rates", "GET", "198.51.100.2")).status).toBe(200);
  r.tick(600_000); expect((await r.get(OK, "/v1/rates", "GET", "198.51.100.1")).status).toBe(200);
  expect(r.calls.length).toBe(1); expect(r.logs.join("\n")).not.toContain("198.51.100");
});
test("F3 per-IP limit uses the first X-Forwarded-For entry and counts forbidden-origin requests too", async () => {
  const r = rig({ p: { ipLimit: 30 } });
  for (let i = 0; i < 30; i++) await r.get("https://evil.example", "/v1/rates", "GET", "192.0.2.9");
  expect((await r.get(OK, "/v1/rates", "GET", "192.0.2.9")).status).toBe(429);
});
test("F3 default limit is 30 per 10 minutes", async () => {
  const p = makeProxy({ key: KEY, fetchFn: (async () => Response.json(body())) as any, log: () => {} });
  const req = () => p.fetch(new Request("https://px.test/v1/rates", { headers: { origin: OK, "x-forwarded-for": "203.0.113.50" } }));
  for (let i = 0; i < 30; i++) expect((await req()).status).not.toBe(429); expect((await req()).status).toBe(429);
});
test("F3 X-Robots-Tag: noindex on every response (200, 403, 404, 405, 429, 503, OPTIONS, /health)", async () => {
  const r = rig({ p: { ipLimit: 2 } }); const rs: Response[] = [];
  rs.push(await r.get(), await r.get(null), await r.get(OK, "/x"), await r.get(OK, "/v1/rates", "POST"), await r.get(OK, "/v1/rates", "OPTIONS"), await r.get(null, "/health"), await r.get(OK, "/v1/rates", "GET", "203.0.113.7"));
  expect(rs.map(x => x.status)).toEqual([200, 403, 404, 405, 204, 200, 429]);
  const r2 = rig({ mode: "down" }); rs.push(await r2.get()); expect(rs[rs.length - 1].status).toBe(503);
  for (const x of rs) expect(x.headers.get("x-robots-tag")).toBe("noindex");
});
