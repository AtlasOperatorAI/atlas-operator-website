/* bun test tools/currency-proxy — fake upstream and clock; the real key is never used. */
import { expect, test } from "bun:test";
process.env.FXPROXY_NO_SERVE = "1";
const { makeProxy, HOUR } = await import("./index.ts");
const KEY = "test-key-not-real";
const OK = "https://atlasoperator.ai";
const body = (ts = 1795179600) => ({ success: true, terms: "https://fxratesapi.com/legal/terms-conditions", timestamp: ts, date: new Date(ts * 1000).toISOString(), base: "USD",
  rates: Object.fromEntries(["EUR", "GBP", "JPY", "MXN", "CAD", "AUD", "CHF", "CNY", "INR", "BRL", "KRW", "SEK", "NOK", "DKK", "PLN", "ZAR", "SGD", "HKD", "NZD", "TRY", "THB", "COP"].map((c, i) => [c, 0.5 + i])) });
function rig(opts: any = {}) {
  let t = Date.parse("2026-11-20T13:05:00Z"); const calls: any[] = []; const logs: string[] = [];
  let mode = opts.mode ?? "ok";
  const fetchFn: any = async (u: string, init: any) => { calls.push({ u, init }); await new Promise(r => setTimeout(r, 5));
    if (mode === "down") throw new Error("ECONNREFUSED"); if (mode === "500") return new Response("err " + KEY, { status: 500 });
    if (mode === "bad") return Response.json({ success: false, error: "quota" }); return Response.json(body(Math.floor(t / 1000) - 300)); };
  const p = makeProxy({ key: KEY, fetchFn, now: () => t, log: (m: string) => logs.push(m), ...opts.p });
  const get = (origin: string | null = OK, path = "/v1/rates", method = "GET") => p.fetch(new Request("https://px.test" + path, { method, headers: origin ? { origin } : {} }));
  return { p, calls, logs, get, tick: (ms: number) => { t += ms; }, set: (m: string) => { mode = m; } };
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
