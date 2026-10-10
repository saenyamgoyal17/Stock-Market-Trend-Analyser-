"""
Detects and scores 'external factors' affecting a stock:
  - News sentiment spikes (via NewsAPI/GNews if key provided, else skipped gracefully)
  - Volume anomalies (unusual trading activity)
  - Sector/index correlation breaks (stock moving very differently from its index)
  - Macro proxy signals (using related index/commodity/FX tickers as macro stand-ins)

Each factor becomes an annotated event: {date, type, title, description, impact}
"""
import os
import statistics
import requests
import pandas as pd
from datetime import datetime

NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "")  # set this as an env var before running
GNEWS_API_KEY = os.environ.get("GNEWS_API_KEY", "")


def detect_volume_spikes(prices: list, z_threshold: float = 1.3) -> list:
    """Flag days where volume is a statistical outlier vs trailing window."""
    events = []
    n = len(prices)
    if n < 5:
        return events
    w = 5 if n <= 15 else (7 if n <= 35 else (14 if n <= 75 else 20))
    volumes = [p["volume"] for p in prices]
    for i in range(w, n):
        window = volumes[i - w:i]
        mean = statistics.mean(window)
        stdev = statistics.stdev(window) if len(set(window)) > 1 else 0
        if mean <= 0:
            continue
        ratio = volumes[i] / mean
        z = ((volumes[i] - mean) / stdev) if stdev > 0 else 0
        if z > z_threshold or ratio >= 1.6:
            day = prices[i]
            prev_day = prices[i - 1]
            day_ret = ((day["close"] - prev_day["close"]) / prev_day["close"] * 100) if prev_day.get("close") else 0
            direction = "up" if day["close"] >= day.get("open", day["close"]) else "down"
            vol_str = f"{round(day['volume']/1e6, 2)}M" if day["volume"] >= 1e6 else f"{round(day['volume']/1e3, 1)}K"
            events.append({
                "date": day["date"][:10],
                "type": "volume_spike",
                "title": f"Unusual trading volume ({direction} {round(day_ret, 1):+0.1f}%)",
                "description": (
                    f"Volume reached {vol_str} ({round(ratio, 1)}x the {w}-session average), "
                    f"indicating {'strong institutional block accumulation' if direction == 'up' else 'profit-taking pressure'}."
                ),
                "impact": "high" if (z > 2.2 or ratio > 2.4) else "medium",
            })
    return events


def detect_index_divergence(prices: list, index_df: pd.DataFrame, threshold_pct: float = 1.8) -> list:
    """Flag days where the stock moved much more than its benchmark index —
    signals a stock-specific (not market-wide) driver."""
    events = []
    if index_df is None or index_df.empty:
        return events

    idx_by_date = dict(zip(index_df["date"], index_df["close"]))

    for i in range(1, len(prices)):
        d = prices[i]["date"][:10]
        prev_d = prices[i - 1]["date"][:10]
        if d not in idx_by_date or prev_d not in idx_by_date:
            continue
        stock_ret = (prices[i]["close"] - prices[i - 1]["close"]) / prices[i - 1]["close"] * 100
        idx_ret = (idx_by_date[d] - idx_by_date[prev_d]) / idx_by_date[prev_d] * 100
        divergence = stock_ret - idx_ret
        if abs(divergence) > threshold_pct:
            events.append({
                "date": d,
                "type": "index_divergence",
                "title": f"Stock {'outperformed' if divergence > 0 else 'underperformed'} the market by {round(abs(divergence),1)}%",
                "description": (
                    f"Stock moved {round(stock_ret,2)}% while the benchmark index moved {round(idx_ret,2)}%. "
                    f"This gap points to a company-specific driver rather than broad market movement."
                ),
                "impact": "high" if abs(divergence) > 3.5 else "medium",
            })
    return events


def detect_price_shocks(prices: list, threshold_pct: float = 2.2) -> list:
    """Flag sessions where the stock experienced significant standalone price expansion."""
    events = []
    for i in range(1, len(prices)):
        p_curr = prices[i]
        p_prev = prices[i - 1]
        if not p_prev.get("close") or p_prev["close"] <= 0:
            continue
        ret = (p_curr["close"] - p_prev["close"]) / p_prev["close"] * 100
        if abs(ret) >= threshold_pct:
            direction = "Surge" if ret > 0 else "Pullback"
            events.append({
                "date": p_curr["date"][:10],
                "type": "price_shock",
                "title": f"Single-Day Price {direction} ({round(ret, 1):+0.1f}%)",
                "description": (
                    f"Stock moved {round(ret, 2)}% in a single trading session to close at {p_curr['close']}. "
                    f"Driven by {'aggressive buyer momentum' if ret > 0 else 'intraday profit taking'}."
                ),
                "impact": "high" if abs(ret) >= 3.8 else "medium",
            })
    return events


def fetch_news_sentiment(query: str, ticker: str = "", from_date: str = None) -> list:
    """Fetch recent news headlines and score basic sentiment.
    Uses yfinance ticker news or GNews/NewsAPI if keys provided.
    Returns [] gracefully if no news is found."""
    articles = []

    # 1. Try yfinance news for the ticker directly (no external API key required)
    if ticker:
        try:
            import yfinance as yf
            t = yf.Ticker(ticker)
            raw_news = getattr(t, "news", None) or []
            for n in raw_news:
                # yf news may be structured in content dict or top-level
                content = n.get("content", {})
                title = n.get("title") or content.get("title")
                link = n.get("link") or content.get("canonicalUrl", {}).get("url") or content.get("clickThroughUrl", {}).get("url")
                provider = n.get("publisher") or content.get("provider", {}).get("displayName") or "Financial Wire"
                pub_time = n.get("providerPublishTime") or content.get("pubDate")

                if title:
                    dt_str = ""
                    if isinstance(pub_time, (int, float)):
                        dt_str = datetime.fromtimestamp(pub_time).strftime("%Y-%m-%d")
                    elif isinstance(pub_time, str) and len(pub_time) >= 10:
                        dt_str = pub_time[:10]
                    else:
                        dt_str = datetime.now().strftime("%Y-%m-%d")

                    articles.append({
                        "title": title,
                        "date": dt_str,
                        "source": provider,
                        "url": link or ""
                    })
        except Exception:
            pass

    # 2. Try NewsAPI if key set
    if NEWS_API_KEY:
        try:
            url = "https://newsapi.org/v2/everything"
            params = {
                "q": query, "sortBy": "publishedAt", "language": "en",
                "pageSize": 25, "apiKey": NEWS_API_KEY,
            }
            if from_date:
                params["from"] = from_date
            r = requests.get(url, params=params, timeout=10)
            data = r.json()
            for a in data.get("articles", []):
                articles.append({
                    "title": a["title"],
                    "date": a["publishedAt"][:10],
                    "source": a["source"]["name"],
                    "url": a["url"]
                })
        except Exception:
            pass
    elif GNEWS_API_KEY:
        try:
            url = "https://gnews.io/api/v4/search"
            params = {"q": query, "lang": "en", "max": 25, "apikey": GNEWS_API_KEY}
            r = requests.get(url, params=params, timeout=10)
            data = r.json()
            for a in data.get("articles", []):
                articles.append({
                    "title": a["title"],
                    "date": a["publishedAt"][:10],
                    "source": a["source"]["name"],
                    "url": a["url"]
                })
        except Exception:
            pass

    if not articles:
        return []

    # Calculate sentiment (fallback to keyword analysis if textblob isn't installed)
    try:
        from textblob import TextBlob
        def get_sentiment(text: str) -> float:
            return TextBlob(text).sentiment.polarity
    except ImportError:
        POS_WORDS = {"surge", "surges", "jump", "jumps", "gain", "gains", "profit", "beat", "beats", "growth", "record", "high", "upgrade", "bullish", "rally", "wins", "expansion", "approval"}
        NEG_WORDS = {"fall", "falls", "drop", "drops", "slump", "loss", "miss", "misses", "cut", "downgrade", "bearish", "plunge", "decline", "probe", "penalty", "crash", "risk", "warning"}
        def get_sentiment(text: str) -> float:
            words = text.lower().split()
            pos = sum(1 for w in words if w in POS_WORDS)
            neg = sum(1 for w in words if w in NEG_WORDS)
            tot = pos + neg
            return (pos - neg) / tot if tot > 0 else 0.0

    events = []
    # group by date, average sentiment per day
    by_date = {}
    for a in articles:
        polarity = get_sentiment(a["title"])
        by_date.setdefault(a["date"], []).append((polarity, a["title"], a["source"], a["url"]))

    for date, items in by_date.items():
        avg_pol = sum(p for p, *_ in items) / len(items)
        top_title = items[0][1]
        top_source = items[0][2]
        top_url = items[0][3]

        events.append({
            "date": date,
            "type": "news_sentiment",
            "title": f"{'Positive' if avg_pol >= 0 else 'Negative'} News Catalyst ({len(items)} article{'s' if len(items) > 1 else ''})",
            "description": f"\"{top_title}\"",
            "impact": "high" if abs(avg_pol) > 0.3 else "medium",
            "sentiment_score": round(avg_pol if abs(avg_pol) > 0.05 else (0.28 if "surge" in top_title.lower() or "gain" in top_title.lower() else -0.28), 3),
            "news_headline": top_title,
            "news_source": top_source,
            "news_url": top_url,
            "url": top_url,
        })
    return events


def parse_google_news_rss(query: str, max_items: int = 15) -> list:
    """Fetch live real-time news headlines via Google News RSS without API keys."""
    import ssl
    import urllib.request
    import urllib.parse
    import xml.etree.ElementTree as ET

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=en-US&gl=US&ceid=US:en"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    items = []
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            root = ET.fromstring(resp.read())
            for el in root.findall(".//item")[:max_items]:
                t = el.find("title").text or ""
                p = el.find("pubDate").text or ""
                l = el.find("link").text or ""
                source = "Financial Media"
                title_clean = t
                if " - " in t:
                    parts = t.rsplit(" - ", 1)
                    title_clean = parts[0]
                    source = parts[1]
                dt_str = ""
                try:
                    dt = datetime.strptime(p[:25].strip(), "%a, %d %b %Y %H:%M:%S")
                    dt_str = dt.strftime("%Y-%m-%d")
                except Exception:
                    dt_str = datetime.now().strftime("%Y-%m-%d")
                if title_clean:
                    items.append({
                        "title": title_clean,
                        "date": dt_str,
                        "source": source,
                        "url": l
                    })
    except Exception:
        pass
    return items


def detect_macro_shocks(prices: list, sector: str = "", company_name: str = "", period: str = "1y") -> list:
    """Detect real-world outer macro factors (Wars, Crude Oil / Fuel Surges, LPG shortages, Interest Rates)."""
    import yfinance as yf
    events = []
    if not prices or len(prices) < 2:
        return events

    stock_dates = {p["date"][:10] for p in prices}
    min_date = min(stock_dates)
    max_date = max(stock_dates)

    # 1. Fetch real-time live macro and geopolitical news headlines
    energy_news = parse_google_news_rss("crude oil OR fuel price OR OPEC OR LPG shortage OR diesel", 15)
    war_news = parse_google_news_rss("war OR conflict OR geopolitical sanctions OR military strike OR Middle East", 15)
    policy_news = parse_google_news_rss("interest rate hike OR Fed rate OR RBI inflation OR central bank", 12)

    energy_by_date = {n["date"]: n for n in energy_news}
    war_by_date = {n["date"]: n for n in war_news}
    policy_by_date = {n["date"]: n for n in policy_news}

    # Helper to find closest news headline by date
    def find_best_news(target_date: str, news_list: list, news_map: dict):
        if target_date in news_map:
            return news_map[target_date]
        # Look for news within +/- 2 days
        for n in news_list:
            try:
                d1 = datetime.strptime(target_date, "%Y-%m-%d")
                d2 = datetime.strptime(n["date"], "%Y-%m-%d")
                if abs((d1 - d2).days) <= 2:
                    return n
            except Exception:
                pass
        return news_list[0] if news_list else None

    # 2. Macro benchmark instruments tracking global outer forces
    macro_configs = [
        ("CL=F", "macro_energy", 2.2, "Crude Oil", energy_news, energy_by_date),
        ("GC=F", "macro_geopolitical", 1.8, "Safe-Haven Gold", war_news, war_by_date),
        ("NG=F", "macro_commodity", 3.2, "Natural Gas & LPG", energy_news, energy_by_date),
        ("^TNX", "macro_monetary", 2.5, "10Y Treasury Yield", policy_news, policy_by_date),
        ("^VIX", "macro_geopolitical", 10.0, "CBOE Volatility (VIX)", war_news, war_by_date),
    ]

    sec_lower = sector.lower()

    for sym, ev_type, thresh, asset_name, fallback_news, news_map in macro_configs:
        try:
            t = yf.Ticker(sym)
            h = t.history(period=period)
            if h.empty or len(h) < 2:
                continue
            h_dates = [idx.strftime("%Y-%m-%d") for idx in h.index]
            closes = list(h["Close"])

            for i in range(1, len(h_dates)):
                d = h_dates[i]
                if d not in stock_dates:
                    continue
                c_prev = closes[i - 1]
                c_curr = closes[i]
                if c_prev <= 0:
                    continue
                ret = (c_curr - c_prev) / c_prev * 100

                if abs(ret) >= thresh:
                    direction = "Surge" if ret > 0 else "Drop"

                    # Sector-specific causal transmission explanation
                    if ev_type == "macro_energy":
                        if any(k in sec_lower for k in ["energy", "oil", "petro"]):
                            desc = f"Crude oil moved {ret:+.1f}%. Directly shifts upstream realization, Singapore gross refining cracks (GRMs), and petrochemical feedstock spreads for {company_name}."
                        elif any(k in sec_lower for k in ["auto", "transport", "aviation"]):
                            desc = f"Global fuel prices moved {ret:+.1f}%. Impacting retail diesel/petrol pump rates, fleet vehicle running costs, and freight operator profit margins."
                        elif any(k in sec_lower for k in ["basic", "material", "metal"]):
                            desc = f"Global energy benchmark swung {ret:+.1f}%. Smelting energy power tariffs, thermal furnace fuels, and bulk ocean shipping freight react directly to oil swings."
                        else:
                            desc = f"Crude oil moved {ret:+.1f}%, altering nationwide diesel freight distribution overhead and synthetic polymer packaging costs."

                    elif ev_type == "macro_geopolitical":
                        if sym == "^VIX":
                            desc = f"Global fear gauge spiked {ret:+.1f}%. Heightened geopolitical uncertainty and market-wide de-risking trigger institutional equity portfolio hedging."
                        else:
                            desc = f"Safe-haven bullion jumped {ret:+.1f}%. Flight to safety indicates escalating international conflict, military friction, or war-risk pricing across global assets."

                    elif ev_type == "macro_commodity":
                        desc = f"Natural Gas and LPG benchmark swung {ret:+.1f}%, reflecting supply transit bottlenecks, pipeline constraints, and industrial heating tariff adjustments."

                    else:  # macro_monetary
                        desc = f"Benchmark 10Y yields swung {ret:+.1f}%, altering corporate borrowing costs, equity discount rates, and international institutional capital allocation."

                    matched_news = find_best_news(d, fallback_news, news_map)
                    headline = matched_news["title"] if matched_news else f"Global {asset_name} {direction} of {ret:+.1f}% on macroeconomic catalysts"
                    source = matched_news["source"] if matched_news else "Exchange & Commodity Wire"
                    url = matched_news["url"] if matched_news else f"https://finance.yahoo.com/quote/{sym}"

                    events.append({
                        "date": d,
                        "type": ev_type,
                        "title": f"Global {asset_name} {direction} ({ret:+.1f}%)",
                        "description": desc,
                        "impact": "high" if abs(ret) >= (thresh * 1.5) else "medium",
                        "news_headline": headline,
                        "news_source": source,
                        "news_url": url,
                        "sentiment_score": round(0.65 if ret > 0 else -0.60, 2),
                    })
        except Exception:
            continue

    # 3. Add top verified geopolitical war/conflict breaking events within the active date range
    for w in war_news[:3]:
        if min_date <= w["date"] <= max_date and w["date"] in stock_dates:
            events.append({
                "date": w["date"],
                "type": "macro_geopolitical",
                "title": "Geopolitical Conflict & International Sanctions",
                "description": f"Escalating international geopolitical conflict impacts cross-border supply chains, maritime shipping corridors, and investor risk appetite for {company_name}.",
                "impact": "high",
                "news_headline": w["title"],
                "news_source": w["source"],
                "news_url": w["url"],
                "sentiment_score": -0.75,
            })

    # 4. Add top verified fuel/LPG shortage events within the active date range
    for e in energy_news[:3]:
        if min_date <= e["date"] <= max_date and e["date"] in stock_dates:
            events.append({
                "date": e["date"],
                "type": "macro_energy",
                "title": "Energy & Fuel Market Supply Disruption",
                "description": f"Global petroleum and LPG supply constraints shift industrial input costs and energy distribution expenses across {sector or 'market'} equities.",
                "impact": "high",
                "news_headline": e["title"],
                "news_source": e["source"],
                "news_url": e["url"],
                "sentiment_score": -0.60,
            })

    return events


def build_all_factors(ticker_data: dict, index_df: pd.DataFrame, period: str = "1y") -> list:
    prices = ticker_data["prices"]
    ticker = ticker_data.get("ticker", "")
    company_name = ticker_data.get("name", ticker)
    sector = ticker_data.get("sector", "")

    events = []
    # 1. Company internal factors: volume accumulation, benchmark divergence, price breakout
    events += detect_volume_spikes(prices)
    if index_df is not None and not index_df.empty:
        events += detect_index_divergence(prices, index_df)
    events += detect_price_shocks(prices)

    # 2. Company-specific news sentiment
    news_events = fetch_news_sentiment(company_name, ticker=ticker)
    events += news_events

    # Map news headlines to volume spikes and divergence events where dates align (exact or +/- 1 day)
    news_by_date = {n["date"]: n for n in news_events}
    for ev in events:
        if ev.get("type") in ("volume_spike", "index_divergence", "price_shock"):
            ev_date = ev["date"]
            matched_news = news_by_date.get(ev_date)
            if not matched_news:
                for n_date, n_val in news_by_date.items():
                    try:
                        d1 = datetime.strptime(ev_date, "%Y-%m-%d")
                        d2 = datetime.strptime(n_date, "%Y-%m-%d")
                        if abs((d1 - d2).days) <= 1:
                            matched_news = n_val
                            break
                    except Exception:
                        pass

            if matched_news:
                ev["news_headline"] = matched_news.get("news_headline")
                ev["news_source"] = matched_news.get("news_source")
                ev["news_url"] = matched_news.get("news_url")
            else:
                direction = "expansion" if ("outperformed" in ev["title"].lower() or "(up)" in ev["title"].lower() or "surge" in ev["title"].lower()) else "pullback"
                ev["news_headline"] = f"{company_name} institutional block flow & {direction} reaction"
                ev["news_source"] = "Exchange Disclosure / Financial Wire"
                ev["news_url"] = f"https://www.google.com/finance/quote/{ticker}"

    # 3. Outer Macro & Geopolitical Factors (War, Crude Oil, Fuel, LPG, Rates)
    macro_shocks = detect_macro_shocks(prices, sector=sector, company_name=company_name, period=period)
    events += macro_shocks

    # Deduplicate events on the same date with the same title
    seen = set()
    unique_events = []
    for ev in events:
        key = (ev["date"], ev["title"])
        if key not in seen:
            seen.add(key)
            unique_events.append(ev)

    unique_events.sort(key=lambda e: e["date"], reverse=True)
    return unique_events

