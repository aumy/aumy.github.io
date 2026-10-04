// Stock threshold alerts: cron-triggered price check (Finnhub) -> push via ntfy.
// Secrets: FINNHUB_KEY, NTFY_TOPIC, ADMIN_TOKEN. KV binding: STORE.

const MAX_SYMBOLS = 40; // free-plan subrequest limit is 50 per invocation
const SYMBOL_RE = /^[A-Z0-9.\-]{1,12}$/;

export function isHit(alert, price) {
  return alert.direction === "above" ? price >= alert.price : price <= alert.price;
}

// Returns { notifications, state } given alerts, current prices and previous state.
// An alert fires once when it becomes true and re-arms when it turns false.
export function evaluate(alerts, prices, prevState) {
  const state = { ...prevState };
  const notifications = [];
  for (const a of alerts) {
    const price = prices[a.symbol];
    if (price == null) continue;
    const key = `${a.symbol}:${a.direction}:${a.price}`;
    const hit = isHit(a, price);
    if (hit && !state[key]) {
      notifications.push({
        title: `${a.symbol} crossed ${a.direction} ${a.price}`,
        message: `${a.symbol} is now ${price.toFixed(2)} (threshold: ${a.direction} ${a.price})`,
      });
      state[key] = true;
    } else if (!hit && state[key]) {
      state[key] = false;
    }
  }
  return { notifications, state };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPrice(symbol, key) {
  const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`);
  if (!r.ok) throw new Error(`${symbol}: HTTP ${r.status}`);
  const c = (await r.json()).c;
  if (!c) throw new Error(`${symbol}: no price`);
  return c;
}

async function notify(env, { title, message }) {
  await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
    method: "POST",
    body: message,
    headers: { Title: title, Priority: "high", Tags: "chart_with_upwards_trend" },
  });
}

async function runCheck(env) {
  const alerts = JSON.parse((await env.STORE.get("alerts")) || "[]");
  const state = JSON.parse((await env.STORE.get("state")) || "{}");
  const symbols = [...new Set(alerts.map(a => a.symbol))].slice(0, MAX_SYMBOLS);

  const prices = {};
  for (const [i, s] of symbols.entries()) {
    if (i > 0) await sleep(1000); // stay within 1 request/second
    try { prices[s] = await fetchPrice(s, env.FINNHUB_KEY); }
    catch (e) { console.error(e.message); }
  }

  const result = evaluate(alerts, prices, state);
  for (const n of result.notifications) await notify(env, n);
  await env.STORE.put("state", JSON.stringify(result.state));
}

function validate(list) {
  if (!Array.isArray(list) || list.length > 200) return null;
  const out = [];
  for (const a of list) {
    const symbol = String(a?.symbol || "").toUpperCase();
    const price = Number(a?.price);
    if (!SYMBOL_RE.test(symbol) || !(price > 0) || !["above", "below"].includes(a.direction)) return null;
    out.push({ symbol, direction: a.direction, price });
  }
  return out;
}

async function handleApi(request, env) {
  const cors = {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.headers.get("Authorization") !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: "unauthorized" }, 401);

  if (request.method === "GET") return json(JSON.parse((await env.STORE.get("alerts")) || "[]"));
  if (request.method === "PUT") {
    const list = validate(await request.json().catch(() => null));
    if (!list) return json({ error: "invalid alerts" }, 400);
    await env.STORE.put("alerts", JSON.stringify(list));
    return json(list);
  }
  return json({ error: "method not allowed" }, 405);
}

export default {
  fetch: handleApi,
  scheduled: (event, env, ctx) => ctx.waitUntil(runCheck(env)),
};
