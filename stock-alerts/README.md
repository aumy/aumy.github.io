# Stock threshold alerts

A scheduled GitHub Action checks prices every 5 minutes during US market hours
and pushes a notification to your phone via [ntfy](https://ntfy.sh) when a
threshold is crossed.

## Setup
1. Install the **ntfy** app (iOS/Android) and subscribe to a long, random topic name,
   e.g. `aumy-stocks-7f3k9q2x`.
2. In the repo: Settings → Secrets and variables → Actions → new secret
   `NTFY_TOPIC` with that topic name.
3. Edit `alerts.json` (`direction` is `above` or `below`) and merge to the default branch
   (scheduled workflows only run from the default branch).
4. Test: Actions tab → "Stock alerts" → Run workflow.

Each alert fires once, then re-arms when the price returns to the other side.
Prices come from Yahoo Finance's unofficial endpoint (may be ~15 min delayed; no API key).
Note: GitHub cron can lag a few minutes, and anyone who knows your topic can read/post to it.
