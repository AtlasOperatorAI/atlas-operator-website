# Atlas currency proxy (hourly rates)

This is a one-file Railway Function (Bun) that serves hourly fxRatesAPI rates to the currency calculator at https://atlasoperator.ai/tools/currency-calculator/.

**What the calculator does with it:**
- It asks this proxy first (`cur.js` → `HOURLY.url`).
- It falls back to its daily chain (Banxico FIX for MXN, then fawazahmed0 CC0, then Frankfurter/ECB) when any of these is true:
  - the proxy fails or answers 429
  - the proxy's data is more than 3 hours old
  - the proxy's rates are more than 10% away from the daily rates

## Status: not deployed
- **Spend:** the new Railway service (about $0.25/month, with a $5/month ceiling) is approved by Atlas II under its spend band, row **QG-HELPERB-FXPROXY-1120**.
- **Gate:** deploy is still gated on a Quality Gate r2 PASS for this PR.
- **Rule:** no `create-function` before that PASS.

## Endpoints
- **`GET /v1/rates`**
  - Returns `{base:"USD", rates:{EUR:…, MXN:…}, timestamp:<provider unix s>, date:<provider ISO>, fetched_at:<ISO>, stale, source:"fxRatesAPI", attribution:"https://fxratesapi.com"}`.
  - Only requests whose `Origin` is in `ALLOWED_ORIGINS` (default `https://atlasoperator.ai`) get the rates and the CORS header. Everything else gets 403.
  - Why the 403: fxRatesAPI's licence covers display to the end users of our app, not redistribution.
- **`GET /health`**
  - Returns `{ok, has_rates, upstream_blocked_until, age_s, upstream_calls_since_start}`. It has no rates and no key.
- **Safeguards on every route:**
  - A per-IP limit of **30 requests per 10 minutes** on `/v1/rates` returns 429 with `Retry-After`. It is keyed on the first `X-Forwarded-For` entry, held in memory only, and IPs are never logged.
  - Every response carries `X-Robots-Tag: noindex`.

## Budget (free plan: 1,000 requests/month, 60/hour; current period resets Dec 20)
- **One call per hour at most.** Upstream is called at most once per rolling 60 minutes, whether the call succeeds or fails, and only when a visitor asks for rates.
- **Worst case:** 24 calls/day, at most 744 in a 31-day month (720 in a 30-day month).
- **Second guard:** `MAX_PER_DAY` (26) caps calls per UTC day.
- **When fxRatesAPI says the limit is reached:**
  - Triggers: HTTP 429, or an error body about the limit or quota.
  - The proxy makes **no further calls** until the reset fxRatesAPI reports (`Retry-After`, or a numeric `X-RateLimit-Reset`). If it reports none, it waits until the next UTC midnight.
  - Then it tries once, and backs off again if the limit is still reached. `/health` shows `upstream_blocked_until`.
  - The tests simulate the limit hitting on day 10: the month ends at 262 calls in total.
- **Restarts:** all of this state is in memory, with **no volume**. A restart, redeploy or wake-up clears it and can cost one extra call. That's why the post-deploy checks below are required.
  - Optional, not done: persisting `lastAttempt` and a month counter on a small Railway volume (about $0.075/month). That is new spend and would need its own approval.

## Variables (on this service)
| Name | Value |
|---|---|
| `FXRATESAPI_KEY` | `${{shared.FXRATESAPI_KEY}}`, a reference only. Never paste, print or read the value (don't use `list-variables`). |
| `ALLOWED_ORIGINS` | `https://atlasoperator.ai` |

The key is sent only to `api.fxratesapi.com` in an `Authorization: Bearer` header. It is never in a URL, a log line or a response. Logs contain status lines only.

## Deploy (only after QG r2 PASS; spend approved by Atlas II, row QG-HELPERB-FXPROXY-1120)
These steps use the Railway MCP, in project **atlasoperator-analytics**, environment **production**. The internal IDs are kept in Helper B's private notes, not here.

1. **Plan check (read-only).** Record the Railway plan tier.
   - **If the account is on the Free plan, which forces sleep, do not deploy.** Go back to QG.
2. **`create-function`** with `name: "atlas-fx-proxy"` and `code` = the full text of `tools/currency-proxy/index.ts` at the PASSed SHA.
   - With no key set yet, it answers 503 and makes no upstream calls.
3. **`set-variables`** on the new service: `{"FXRATESAPI_KEY":"${{shared.FXRATESAPI_KEY}}","ALLOWED_ORIGINS":"https://atlasoperator.ai"}`. This redeploys the function.
4. **`generate-domain`**, then **`update-domain`** with `subdomain: "atlas-fx-proxy"`. Our service must own **exactly** `atlas-fx-proxy.up.railway.app`, the host in `cur.js`.
   - If that name is not available, stop. Changing the host means a new commit to this PR (`cur.js`, `index.html` preconnect, `sw.js` `RATE_HOSTS`, `privacy-policy.html`) and another QG look.
5. **Post-deploy checks (required, read-only, none of them print the key):**
   - **`describe-service`** must show:
     - **1 replica**
     - **sleep/serverless off**
     - **restart policy ON_FAILURE with max retries ≤ 10**
   - If any setting differs, take the service down and report back. Don't fix it with an unreviewed change.
   - `curl -s -H 'Origin: https://atlasoperator.ai' https://atlas-fx-proxy.up.railway.app/v1/rates` should return 200 with `Access-Control-Allow-Origin: https://atlasoperator.ai` and `X-Robots-Tag: noindex`.
   - Without an Origin it should return 403.
   - `https://atlas-fx-proxy.up.railway.app/health` should answer from our service, with `upstream_calls_since_start: 1` and `upstream_blocked_until: null`.
   - `get-logs` should show status lines only.
   - Compare USD/MXN with Yahoo and log the result.

## Release order (security)
- **Never merge this PR until our own Railway service owns exactly `atlas-fx-proxy.up.railway.app` and `/health` answers from it.**
- Why: until then the host is unclaimed. If someone else claimed it, the live calculator would show their numbers, limited only by the 10% guard against the daily rates.
- Order: QG r2 PASS, then deploy steps 1–5, then merge.

## Rollback
- Delete the function. The calculator then falls back to daily rates on its own.
- Deleting the function also releases the host name, which the release-order risk above applies to again. So for a permanent removal, first ship a site commit that sets `HOURLY.url` to `""` in `cur.js` (and drops the host from `sw.js`/`index.html`), then delete the function.

## Tests
- `bun test tools/currency-proxy` uses a fake upstream, a fake clock and a dummy key.
- `node tests/currency.test.js` runs the client tests.
