# Stock threshold alerts

A Cloudflare Worker checks prices every minute during US market hours
(Finnhub free API, 1 request/second) and pushes a notification to your phone
via [ntfy](https://ntfy.sh) when a threshold is crossed. Thresholds are edited
on the web page in this folder (`https://aumy.github.io/stock-alerts/`).
Each alert fires once, then re-arms when the price moves back across it.

## Deploy
1. Get a free API key at https://finnhub.io.
2. Install the ntfy app and subscribe to a long random topic, e.g. `aumy-stocks-7f3k9q2x`.
3. From `worker/`:
   ```
   npm i -g wrangler && wrangler login
   wrangler kv namespace create STORE      # paste the id into wrangler.toml
   wrangler secret put FINNHUB_KEY
   wrangler secret put NTFY_TOPIC
   wrangler secret put ADMIN_TOKEN         # any long random string
   wrangler deploy
   ```
4. Open the web page, enter the worker URL and admin token, add alerts, Save.

Limits: up to 40 distinct symbols (Cloudflare free subrequest cap; checks are spaced 1/sec).
Anyone who knows your ntfy topic can read it, so keep it random.
