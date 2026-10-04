#!/usr/bin/env python3
"""Check stock prices against thresholds in alerts.json and push a phone
notification through ntfy.sh when one is crossed.

An alert fires once when the condition becomes true, then re-arms after the
price moves back to the other side of the threshold (tracked in state.json).
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
ALERTS = HERE / "alerts.json"
STATE = HERE / "state.json"
NTFY_TOPIC = os.environ.get("NTFY_TOPIC")
NTFY_SERVER = os.environ.get("NTFY_SERVER", "https://ntfy.sh")


def fetch_price(symbol):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        meta = json.load(r)["chart"]["result"][0]["meta"]
    return float(meta["regularMarketPrice"])


def notify(title, message):
    if not NTFY_TOPIC:
        print(f"[no NTFY_TOPIC set] {title}: {message}")
        return
    req = urllib.request.Request(
        f"{NTFY_SERVER}/{NTFY_TOPIC}",
        data=message.encode(),
        headers={"Title": title, "Priority": "high", "Tags": "chart_with_upwards_trend"},
    )
    urllib.request.urlopen(req, timeout=20).read()


def main():
    alerts = json.loads(ALERTS.read_text())
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    prices = {}
    failed = False

    for a in alerts:
        sym = a["symbol"].upper()
        if sym not in prices:
            try:
                prices[sym] = fetch_price(sym)
            except Exception as e:
                print(f"{sym}: fetch failed: {e}", file=sys.stderr)
                prices[sym] = None
                failed = True
        price = prices[sym]
        if price is None:
            continue

        key = f"{sym}:{a['direction']}:{a['price']}"
        hit = price >= a["price"] if a["direction"] == "above" else price <= a["price"]
        print(f"{sym} {price:.2f} ({a['direction']} {a['price']}): {'HIT' if hit else 'ok'}")

        if hit and not state.get(key):
            notify(f"{sym} crossed {a['direction']} {a['price']}",
                   f"{sym} is now {price:.2f} (threshold: {a['direction']} {a['price']})")
            state[key] = True
        elif not hit and state.get(key):
            state[key] = False  # re-arm

    STATE.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")
    return 1 if failed and not prices else 0


if __name__ == "__main__":
    sys.exit(main())
