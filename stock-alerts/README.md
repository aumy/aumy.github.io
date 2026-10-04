# Stock threshold alerts

A Cloudflare Worker checks prices every minute during US market hours
(Finnhub free API, 1 request/second) and sends you a Telegram message
when a threshold is crossed. Thresholds are edited
on the web page in this folder (`https://aumy.github.io/stock-alerts/`).
Each alert fires once, then re-arms when the price moves back across it.

## Deploy
1. Get a free API key at https://finnhub.io.
2. In Telegram, message @BotFather, send `/newbot`, and copy the bot token. Then open a chat
   with your new bot and send it any message. Get your chat id by visiting
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and reading `message.chat.id`.
3. From `worker/`:
   ```
   npm i -g wrangler && wrangler login
   wrangler kv namespace create STORE      # paste the id into wrangler.toml
   wrangler secret put FINNHUB_KEY
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put TELEGRAM_CHAT_ID
   wrangler secret put ADMIN_TOKEN         # any long random string
   wrangler deploy
   ```
4. Open the web page, enter the worker URL and admin token, add alerts, Save.

Limits: up to 40 distinct symbols (Cloudflare free subrequest cap; checks are spaced 1/sec).
Only your chat id receives alerts; keep the bot token secret.
