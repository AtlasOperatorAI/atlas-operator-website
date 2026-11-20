# Atlas currency proxy (hourly rates)

This is a one-file Railway Function (Bun) that serves hourly fxRatesAPI rates to the currency calculator at https://atlasoperator.ai/tools/currency-calculator/.

**What the calculator does with it:**
- It asks this proxy first (`cur.js` → `HOURLY.url`).
- It falls back to its daily chain (Banxico FIX for MXN, then fawazahmed0 CC0, then Frankfurter/ECB) when any of these is true:
  - the proxy fails
  - the proxy's data is more than 3 hours old
  - the proxy's rates are more than 10% away from the daily rates

## Endpoints
- **`GET /v1/rates`**
  - Returns `{base:"USD", rates:{EUR:…, MXN:…}, timestamp:<provider unix s>, date:<provider ISO>, fetched_at:<ISO>, stale, source:"fxRatesAPI", attribution:"https://fxratesapi.com"}`.
  - Only requests whose `Origin` is in `ALLOWED_ORIGINS` (default `https://atlasoperator.ai`) get the rates and the CORS header. Everything else gets 403.
  - Why the 403: fxRatesAPI's licence covers display to the end users of our app, not redistribution.
- **`GET /health`**
  - Returns `{ok, has_rates, age_s, upstream_calls_since_start}`. It has no rates and no key.

## Budget (free plan: 1,000 requests/month, 60/hour; current period resets Dec 20)
- **One call per hour at most.** Upstream is called at most once per rolling 60 minutes, whether the call succeeds or fails, and only when a visitor asks for rates.
- **Worst case:** 24 calls/day, at most 744 in a 31-day month (720 in a 30-day month). Each restart or redeploy can add one call because the cache is in memory.
- **Second guard:** `MAX_PER_DAY` (26, in code) caps calls per UTC day.
- **Tested:** the unit test simulates a request every minute for 31 days and stays at 744 calls and 1/hour.
- **Sleep mode should stay off.** Each wake-up restarts the function and clears the cache.

## Variables (on this service)
| Name | Value |
|---|---|
| `FXRATESAPI_KEY` | `${{shared.FXRATESAPI_KEY}}`, a reference only. Never paste the value. |
| `ALLOWED_ORIGINS` | `https://atlasoperator.ai` |

The key is sent only to `api.fxratesapi.com` in an `Authorization: Bearer` header. It is never in a URL, a log line or a response. Logs contain only status lines (`upstream ok …`, `upstream HTTP 500`).

## Deploy (after QG PASS)
Project `atlasoperator-analytics` (1cbc909d-1480-4d12-a42c-d88e268fefe4), env `production` (4af85b83-4e0c-4f69-aad1-804a47fd3569). These steps use the Railway MCP.

1. **`create-function`**
   - Arguments: `projectId`, `environmentId`, `name: "atlas-fx-proxy"`, `code` = the full text of `tools/currency-proxy/index.ts`.
   - It deploys immediately. With no key set, it answers 503 and makes no upstream calls.
2. **`set-variables`**
   - Arguments: `serviceId` = the new function, `variables: {"FXRATESAPI_KEY":"${{shared.FXRATESAPI_KEY}}","ALLOWED_ORIGINS":"https://atlasoperator.ai"}`.
   - This redeploys the function.
3. **`generate-domain`** for the new service, then **`update-domain`** with `subdomain: "atlas-fx-proxy"`. The result should be `https://atlas-fx-proxy.up.railway.app`.
   - If that name is taken, use the generated host instead. Change it in a follow-up commit on the PR in `cur.js` (`HOURLY.url`), `index.html` (preconnect), `sw.js` (`RATE_HOSTS`) and `privacy-policy.html`. The unit test checks that `sw.js` matches `cur.js`.
4. **Verify. None of these print the key.**
   - `curl -s -H 'Origin: https://atlasoperator.ai' https://atlas-fx-proxy.up.railway.app/v1/rates` should return 200 with `Access-Control-Allow-Origin: https://atlasoperator.ai`.
   - `curl -s -o /dev/null -w '%{http_code}' https://atlas-fx-proxy.up.railway.app/v1/rates` should return 403.
   - `/health` should show `upstream_calls_since_start: 1`.
   - `get-logs` should show status lines only.
   - Compare USD/MXN with Yahoo.
5. **Merge.** Merge the site PR only after the proxy answers at the host in `cur.js`. If the site goes out first, nothing breaks: the calculator just shows daily rates until the proxy is up.

## Rollback
- Delete the function or remove its domain. The calculator falls back to daily rates on its own.
- To turn the proxy off in the client, set `HOURLY.url` to `""` in `cur.js`.

## Tests
- `bun test tools/currency-proxy` uses a fake upstream, a fake clock and a dummy key.
- `node tests/currency.test.js` runs the client tests.
