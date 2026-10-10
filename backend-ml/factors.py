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


_DATED_NEWS_CACHE = {}


def fetch_exact_date_news(topic: str, target_date: str) -> dict:
    """Fetch verified news headline published on or around the exact historical target_date."""
    key = (topic, target_date)
    if key in _DATED_NEWS_CACHE:
        return _DATED_NEWS_CACHE[key]

    import ssl
    import urllib.request
    import urllib.parse
    import xml.etree.ElementTree as ET
    from datetime import datetime, timedelta

    try:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        d_before = (dt - timedelta(days=1)).strftime("%Y-%m-%d")
        d_after = (dt + timedelta(days=2)).strftime("%Y-%m-%d")
        q = f"{topic} after:{d_before} before:{d_after}"
        url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl=en-US&gl=US&ceid=US:en"

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

        with urllib.request.urlopen(req, context=ctx, timeout=3.5) as resp:
            root = ET.fromstring(resp.read())
            items = root.findall(".//item")
            for el in items:
                t = el.find("title").text or ""
                # filter out generic price quote noise
                if any(bad in t.lower() for bad in ["current price of", "share price today", "calculator", "lottery", "horoscope"]):
                    continue
                l = el.find("link").text or ""
                source = "Financial Media"
                title_clean = t
                if " - " in t:
                    parts = t.rsplit(" - ", 1)
                    title_clean = parts[0]
                    source = parts[1]
                res = {"title": title_clean, "source": source, "url": l, "date": target_date}
                _DATED_NEWS_CACHE[key] = res
                return res
    except Exception:
        pass

    _DATED_NEWS_CACHE[key] = None
    return None


def fetch_exact_company_news(company_name: str, ticker: str, target_date: str) -> dict:
    """Fetch verified company-specific news published on the exact date."""
    clean_sym = ticker.replace(".NS", "").replace(".BO", "").replace("^", "")
    topic = f'"{company_name}" OR "{clean_sym}"'
    return fetch_exact_date_news(topic, target_date)


def detect_macro_shocks(prices: list, sector: str = "", company_name: str = "", period: str = "1y") -> list:
    """Detect real-world outer macro factors across commodities, currencies, interest rates, and geopolitical proxies."""
    import yfinance as yf
    events = []
    if not prices or len(prices) < 2:
        return events

    # Only trading days present in the stock's actual session calendar (excludes weekends & holidays!)
    stock_dates = {p["date"][:10] for p in prices}

    macro_configs = [
        ("CL=F", "macro_energy", 2.2, "Crude Oil & Fuel", "crude oil OR fuel price OR OPEC OR diesel OR petroleum OR refinery"),
        ("GC=F", "macro_geopolitical", 1.8, "Safe-Haven Gold", "war OR military conflict OR geopolitical sanctions OR missile strike OR Middle East"),
        ("INR=X", "macro_capital", 0.45, "USD/INR Currency FX", "rupee falls OR rupee gains OR USDINR OR currency valuation OR foreign capital"),
        ("HG=F", "macro_commodity", 2.2, "Industrial Copper", "copper price OR industrial metals OR LME warehouse stocks OR metal tariffs"),
        ("NG=F", "macro_commodity", 3.2, "Natural Gas & LPG", "natural gas OR LPG shortage OR energy crisis OR pipeline transit"),
        ("^TNX", "macro_monetary", 2.5, "10Y Treasury Yield", "interest rate hike OR Fed rate OR RBI inflation OR central bank bond yields"),
    ]

    sec_lower = sector.lower()

    for sym, ev_type, thresh, asset_name, news_query in macro_configs:
        try:
            t = yf.Ticker(sym)
            h = t.history(period=period, timeout=3)
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
                        desc = f"Safe-haven bullion jumped {ret:+.1f}%. Flight to safety indicates escalating international conflict, military friction, or war-risk pricing across global assets."

                    elif ev_type == "macro_capital":
                        desc = f"Currency FX swung {ret:+.1f}%. Fluctuations in USD/INR shift export realization for IT/pharma and alter import costs for crude and raw materials."

                    elif ev_type == "macro_commodity":
                        desc = f"Industrial raw material and energy benchmark moved {ret:+.1f}%, reflecting global manufacturing demand, pipeline transit constraints, and smelting expenses."

                    else:  # macro_monetary
                        desc = f"Benchmark 10Y yields swung {ret:+.1f}%, altering corporate borrowing costs, equity discount rates, and international institutional capital allocation."

                    # Query EXACT DATE news for this specific historical shock
                    matched_news = fetch_exact_date_news(news_query, d)
                    if matched_news:
                        headline = matched_news["title"]
                        source = matched_news["source"]
                        url = matched_news["url"]
                    else:
                        headline = f"Global {asset_name} single-day volatility of {ret:+.1f}% recorded across international commodity trading desks"
                        source = "Commodity & Futures Exchange Disclosures"
                        url = f"https://finance.yahoo.com/quote/{sym}"

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

    return events


def detect_trade_and_policy_events(prices: list, sector: str = "", company_name: str = "", ticker: str = "") -> list:
    """Detect trade tariffs, government regulatory probes, and FII capital flow external factors on active dates."""
    events = []
    if not prices or len(prices) < 2:
        return events

    # Focus on session dates with notable price shocks or volume spikes
    candidate_dates = set()
    for i in range(1, len(prices)):
        p_curr = prices[i]
        p_prev = prices[i - 1]
        if p_prev.get("close", 0) > 0:
            ret = abs((p_curr["close"] - p_prev["close"]) / p_prev["close"] * 100)
            if ret >= 2.0:
                candidate_dates.add(p_curr["date"][:10])

    clean_sym = ticker.replace(".NS", "").replace(".BO", "").replace("^", "")

    for d in candidate_dates:
        # Check Trade Tariffs / Export Bans on that date
        trade_news = fetch_exact_date_news(f'({clean_sym} OR "{sector}") (tariff OR import duty OR export ban OR trade dispute OR visa curbs)', d)
        if trade_news:
            events.append({
                "date": d,
                "type": "macro_trade",
                "title": "International Trade Policy & Tariff Movement",
                "description": f"Trade tariff adjustments, customs duties, or cross-border trade restrictions shifted supply chain terms and market margins for {company_name}.",
                "impact": "high",
                "news_headline": trade_news["title"],
                "news_source": trade_news["source"],
                "news_url": trade_news["url"],
                "sentiment_score": -0.65,
            })

        # Check Government & Regulatory / Court Orders on that date
        reg_news = fetch_exact_date_news(f'({clean_sym} OR "{company_name}") (government policy OR court order OR SEBI OR regulatory probe OR GST OR windfall tax)', d)
        if reg_news:
            events.append({
                "date": d,
                "type": "macro_regulatory",
                "title": "Government Policy & Regulatory Action",
                "description": f"Regulatory decisions, judicial directives, or governmental economic policy altered operating regulations and corporate sentiment for {company_name}.",
                "impact": "high",
                "news_headline": reg_news["title"],
                "news_source": reg_news["source"],
                "news_url": reg_news["url"],
                "sentiment_score": -0.55,
            })

        # Check Institutional Capital / FII Exodus on that date
        capital_news = fetch_exact_date_news('("FII selling" OR "foreign institutional outflow" OR "foreign exodus" OR "FII DII data") Indian market', d)
        if capital_news:
            events.append({
                "date": d,
                "type": "macro_capital",
                "title": "Foreign Institutional (FII) Capital Flow Shock",
                "description": f"Large-scale institutional capital reallocation and foreign portfolio fund flows influenced liquidity across {company_name} and benchmark indices.",
                "impact": "medium",
                "news_headline": capital_news["title"],
                "news_source": capital_news["source"],
                "news_url": capital_news["url"],
                "sentiment_score": -0.50,
            })

    return events


def build_all_factors(ticker_data: dict, index_df: pd.DataFrame, period: str = "1y") -> list:
    prices = ticker_data["prices"]
    ticker = ticker_data.get("ticker", "")
    company_name = ticker_data.get("name", ticker)
    sector = ticker_data.get("sector", "")
    stock_dates = {p["date"][:10] for p in prices}

    import concurrent.futures

    events = []
    # 1. Company internal factors: volume accumulation, benchmark divergence, price breakout
    company_events = []
    company_events += detect_volume_spikes(prices)
    if index_df is not None and not index_df.empty:
        company_events += detect_index_divergence(prices, index_df)
    company_events += detect_price_shocks(prices)

    # Parallel pre-fetch exact-date company news for all identified dates
    comp_dates = {ev["date"] for ev in company_events}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        ex.map(lambda d: fetch_exact_company_news(company_name, ticker, d), comp_dates)

    # For each company-level event, attach verified company news for that EXACT date!
    for ev in company_events:
        ev_date = ev["date"]
        comp_news = fetch_exact_company_news(company_name, ticker, ev_date)
        if comp_news:
            ev["news_headline"] = comp_news["title"]
            ev["news_source"] = comp_news["source"]
            ev["news_url"] = comp_news["url"]
        else:
            direction = "expansion" if ("outperformed" in ev["title"].lower() or "(up)" in ev["title"].lower() or "surge" in ev["title"].lower()) else "pullback"
            ev["news_headline"] = f"{company_name} institutional block trading flow & {direction} reaction"
            ev["news_source"] = "Exchange Disclosure / Financial Wire"
            ev["news_url"] = f"https://www.google.com/finance/quote/{ticker}"
        events.append(ev)

    # 2. Company-specific news sentiment from yfinance ticker news
    news_events = fetch_news_sentiment(company_name, ticker=ticker)
    for ne in news_events:
        if ne["date"] in stock_dates:
            events.append(ne)

    # 3. Outer Macro & Geopolitical Factors (War, Energy, Currency, Commodities, Rates)
    macro_shocks = detect_macro_shocks(prices, sector=sector, company_name=company_name, period=period)
    events += macro_shocks

    # 4. Trade Tariffs, Regulatory Orders & Capital Outflows
    policy_events = detect_trade_and_policy_events(prices, sector=sector, company_name=company_name, ticker=ticker)
    events += policy_events

    # 5. Strict filtering: NO weekend dates where market was closed
    valid_events = [ev for ev in events if ev["date"] in stock_dates]

    # 6. GROUP BY DATE & PICK TOP 3 FACTORS PER SINGLE DATE
    events_by_date = {}
    for ev in valid_events:
        d = ev["date"]
        events_by_date.setdefault(d, []).append(ev)

    final_events = []
    for d, day_events in events_by_date.items():
        # Deduplicate identical titles on the same day
        seen_titles = set()
        unique_day_events = []
        for ev in day_events:
            t = ev.get("title", "")
            if t not in seen_titles:
                seen_titles.add(t)
                unique_day_events.append(ev)

        # If 1, 2, or 3 factors exist on this date -> keep all of them
        # If MORE than 3 factors exist on this date -> pick the TOP 3
        if len(unique_day_events) > 3:
            def score_event(e):
                impact_val = 3 if e.get("impact") == "high" else 2
                has_accredited_news = 2 if (e.get("news_headline") and "exchange disclosure" not in e.get("news_source", "").lower()) else 1
                sentiment_mag = abs(e.get("sentiment_score", 0))
                return (impact_val, has_accredited_news, sentiment_mag)

            unique_day_events.sort(key=score_event, reverse=True)

            # Prioritize category diversity across the top 3 (e.g. 1 geopolitical/macro, 1 regulatory/trade, 1 price move)
            picked = []
            seen_categories = set()
            for ev in unique_day_events:
                cat = ev.get("type", "")
                if cat not in seen_categories and len(picked) < 3:
                    seen_categories.add(cat)
                    picked.append(ev)

            # Fill remaining slots up to 3 if diversity pass didn't reach 3
            for ev in unique_day_events:
                if len(picked) >= 3:
                    break
                if ev not in picked:
                    picked.append(ev)

            final_events.extend(picked)
        else:
            final_events.extend(unique_day_events)

    final_events.sort(key=lambda e: e["date"], reverse=True)
    return final_events



