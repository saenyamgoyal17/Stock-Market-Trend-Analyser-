import { useState, useCallback, useEffect } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, Legend,
} from "recharts";
import { Search, TrendingUp, TrendingDown, AlertCircle, Loader2, Newspaper, BarChart3, Activity } from "lucide-react";

const API_BASE = typeof window !== "undefined" && window.location.port === "8000"
  ? window.location.origin
  : "http://localhost:8000";

const IMPACT_COLOR = {
  high: "#e8542f",
  medium: "#d4a017",
  low: "#6b7280",
};

const FACTOR_ICON = {
  news_sentiment: Newspaper,
  volume_spike: BarChart3,
  index_divergence: Activity,
};

function useStockData() {
  const [ticker, setTicker] = useState("AAPL");
  const [period, setPeriod] = useState("1y");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchAll = useCallback(async (symbol, per) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/full/${encodeURIComponent(symbol)}?period=${per}&horizon=15`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(
        e.message.includes("Failed to fetch")
          ? "Can't reach the backend at localhost:8000. Make sure it's running (uvicorn main:app --reload --port 8000)."
          : e.message
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll("AAPL", "1y");
  }, [fetchAll]);

  return { ticker, setTicker, period, setPeriod, loading, error, data, fetchAll };
}

function formatMoney(val, symbol) {
  if (val === null || val === undefined) return "—";
  return `${symbol}${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function StockAnalyser() {
  const { ticker, setTicker, period, setPeriod, loading, error, data, fetchAll } = useStockData();
  const [activeModel, setActiveModel] = useState("xgboost");
  const [selectedFactorDate, setSelectedFactorDate] = useState(null);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    fetchAll(ticker.trim(), period);
  };

  const stock = data?.stock;
  const factors = data?.factors || [];
  const predictions = data?.predictions;

  useEffect(() => {
    if (predictions) {
      if (predictions.xgboost && !predictions.xgboost.error) {
        setActiveModel("xgboost");
      } else if (predictions.arima && !predictions.arima.error) {
        setActiveModel("arima");
      } else if (predictions.prophet && !predictions.prophet.error) {
        setActiveModel("prophet");
      } else if (predictions.lstm && !predictions.lstm.error) {
        setActiveModel("lstm");
      }
    }
  }, [predictions]);

  // Build merged chart data: historical + forecast overlay for the active model
  let chartData = [];
  if (stock) {
    chartData = stock.prices.map((p) => ({
      date: p.date.slice(0, 10),
      close: p.close,
      volume: p.volume,
    }));

    const fc = predictions?.[activeModel];
    if (fc && fc.forecast && fc.forecast.length && !fc.error) {
      const lastHist = chartData[chartData.length - 1];
      // bridge point so the forecast line connects visually to history
      chartData.push({ date: lastHist.date, predicted: lastHist.close, lower: lastHist.close, upper: lastHist.close });
      fc.forecast.forEach((f) => {
        chartData.push({ date: f.date, predicted: f.predicted, lower: f.lower, upper: f.upper });
      });
    }
  }

  const factorsByDate = {};
  factors.forEach((f) => {
    if (!factorsByDate[f.date]) factorsByDate[f.date] = [];
    factorsByDate[f.date].push(f);
  });
  const markerDates = Object.keys(factorsByDate);

  const scrollToFactor = (date) => {
    setSelectedFactorDate(date);
    const el = document.getElementById(`factor-${date}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui", background: "#0d1117", minHeight: "100vh", color: "#e6e8eb" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .card { background: #151b23; border: 1px solid #262d38; border-radius: 8px; }
        .btn { background: #1a2029; border: 1px solid #2d3542; color: #e6e8eb; border-radius: 6px; padding: 8px 14px; font-size: 13px; cursor: pointer; transition: all 0.15s; }
        .btn:hover { background: #212936; border-color: #3d4656; }
        .btn.active { background: #1f4d3d; border-color: #2f8f6b; color: #6ee7b7; font-weight: 600; }
        input:focus, select:focus { outline: none; border-color: #2f8f6b !important; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #2d3542; border-radius: 4px; }
        .factor-card { transition: all 0.2s; }
        .factor-card.highlighted { border-color: #2f8f6b !important; box-shadow: 0 0 0 1px #2f8f6b; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e2530", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Market Signal</div>
          <div className="mono" style={{ fontSize: 11, color: "#6b7685", marginTop: 2 }}>
            EDA-driven price analysis · external factor tracking · ML forecasting
          </div>
        </div>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "#6b7685" }} />
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="AAPL, TCS.NS, RELIANCE.NS..."
              className="mono"
              style={{ background: "#0d1117", border: "1px solid #2d3542", borderRadius: 6, padding: "8px 10px 8px 30px", color: "#e6e8eb", fontSize: 13, width: 220 }}
            />
          </div>
          <select value={period} onChange={(e) => { setPeriod(e.target.value); if (ticker) fetchAll(ticker, e.target.value); }} className="mono btn" style={{ padding: "8px 10px" }}>
            <option value="3mo">3M</option>
            <option value="6mo">6M</option>
            <option value="1y">1Y</option>
            <option value="2y">2Y</option>
            <option value="5y">5Y</option>
          </select>
          <button type="submit" className="btn" style={{ background: "#1f4d3d", borderColor: "#2f8f6b", color: "#6ee7b7", fontWeight: 600 }}>
            {loading ? <Loader2 size={14} className="mono" style={{ animation: "spin 1s linear infinite" }} /> : "Analyze"}
          </button>
        </form>
      </div>

      <div style={{ padding: "20px 28px 60px", maxWidth: 1280, margin: "0 auto" }}>
        {!data && !loading && !error && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#6b7685" }}>
            <div style={{ fontSize: 15 }}>Enter a ticker to begin.</div>
            <div className="mono" style={{ fontSize: 12, marginTop: 8 }}>
              Indian stocks: append <span style={{ color: "#8b93a1" }}>.NS</span> (NSE) or <span style={{ color: "#8b93a1" }}>.BO</span> (BSE) — e.g. TCS.NS, RELIANCE.NS<br />
              Foreign stocks: plain ticker — e.g. AAPL, MSFT, TSLA
            </div>
          </div>
        )}

        {error && (
          <div className="card" style={{ padding: 16, display: "flex", gap: 10, alignItems: "flex-start", borderColor: "#5c2a24", background: "#1f1310", marginBottom: 20 }}>
            <AlertCircle size={18} color="#e8542f" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: "#f0a794" }}>{error}</div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#6b7685" }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
            <div className="mono" style={{ fontSize: 12, marginTop: 12 }}>Fetching prices, detecting factors, training models…</div>
          </div>
        )}

        {stock && !loading && (
          <>
            {/* Stock header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 15, color: "#8b93a1" }}>{stock.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span className="mono" style={{ fontSize: 34, fontWeight: 700 }}>{formatMoney(stock.current_price, stock.currency_symbol)}</span>
                  <span className="mono" style={{ fontSize: 15, color: stock.change >= 0 ? "#4ade80" : "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
                    {stock.change >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                    {stock.change >= 0 ? "+" : ""}{stock.change} ({stock.change_pct}%)
                  </span>
                </div>
                <div className="mono" style={{ fontSize: 11, color: "#6b7685", marginTop: 4 }}>
                  {stock.ticker} · {stock.exchange} · {stock.currency} · {stock.sector !== "N/A" ? stock.sector : "Sector n/a"}
                </div>
              </div>

              {predictions?.direction && predictions.direction.direction !== "unknown" && (
                <div className="card" style={{ padding: "10px 16px", display: "flex", gap: 14, alignItems: "center" }}>
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: "#6b7685" }}>NEXT-DAY DIRECTION</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: predictions.direction.direction === "up" ? "#4ade80" : "#f87171" }}>
                      {predictions.direction.direction === "up" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      {predictions.direction.direction.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ width: 1, height: 30, background: "#262d38" }} />
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: "#6b7685" }}>CONFIDENCE</div>
                    <div className="mono" style={{ fontWeight: 600 }}>{(predictions.direction.confidence * 100).toFixed(0)}%</div>
                  </div>
                  {predictions.direction.backtest_accuracy != null && (
                    <>
                      <div style={{ width: 1, height: 30, background: "#262d38" }} />
                      <div>
                        <div className="mono" style={{ fontSize: 10, color: "#6b7685" }}>BACKTEST ACC.</div>
                        <div className="mono" style={{ fontWeight: 600 }}>{(predictions.direction.backtest_accuracy * 100).toFixed(0)}%</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Model selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {["xgboost", "arima", "prophet", "lstm"].map((m) => {
                const fc = predictions?.[m];
                const disabled = !fc || fc.error || !fc.forecast?.length;
                return (
                  <button
                    key={m}
                    disabled={disabled}
                    onClick={() => setActiveModel(m)}
                    className={`btn mono ${activeModel === m ? "active" : ""}`}
                    style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer", textTransform: "uppercase", fontSize: 11 }}
                    title={disabled ? (fc?.error || "unavailable") : `Forecast via ${m}`}
                  >
                    {m === "xgboost" ? "⭐ XGBOOST" : m}
                  </button>
                );
              })}
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#6b7685", display: "flex", alignItems: "center" }} className="mono">
                Shaded band = forecast confidence interval
              </div>
            </div>

            {/* Chart */}
            <div className="card" style={{ padding: 16, marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={420}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e2530" vertical={false} />
                  <XAxis dataKey="date" stroke="#4b5563" tick={{ fontSize: 10, fill: "#6b7685" }} minTickGap={40} />
                  <YAxis
                    stroke="#4b5563"
                    tick={{ fontSize: 10, fill: "#6b7685" }}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${stock.currency_symbol}${v}`}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{ background: "#151b23", border: "1px solid #262d38", borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: "#8b93a1" }}
                    formatter={(val, name) => [typeof val === "number" ? formatMoney(val, stock.currency_symbol) : val, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="upper" stroke="none" fill="#2f8f6b" fillOpacity={0.08} name="Upper bound" />
                  <Area type="monotone" dataKey="lower" stroke="none" fill="#0d1117" fillOpacity={1} name="Lower bound" />
                  <Line type="monotone" dataKey="close" stroke="#5b9dd9" strokeWidth={1.8} dot={false} name="Close price" connectNulls={false} />
                  <Line type="monotone" dataKey="predicted" stroke="#e8b34f" strokeWidth={1.8} strokeDasharray="5 3" dot={false} name={`${activeModel.toUpperCase()} forecast`} connectNulls />

                  {markerDates.map((date) => {
                    const pt = chartData.find((d) => d.date === date);
                    if (!pt) return null;
                    const worst = factorsByDate[date].reduce((a, b) => (a.impact === "high" ? a : b));
                    return (
                      <ReferenceDot
                        key={date}
                        x={date}
                        y={pt.close}
                        r={5}
                        fill={IMPACT_COLOR[worst.impact] || "#6b7280"}
                        stroke="#0d1117"
                        strokeWidth={1.5}
                        onClick={() => scrollToFactor(date)}
                        style={{ cursor: "pointer" }}
                      />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "#8b93a1" }} className="mono">
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: IMPACT_COLOR.high, display: "inline-block" }} />high impact</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: IMPACT_COLOR.medium, display: "inline-block" }} />medium impact</span>
                <span>· click a dot to jump to its factor below</span>
              </div>
            </div>

            {/* Factors list */}
            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: "#8b93a1" }}>
              External factors detected ({factors.length})
              {data.factors_note && <span className="mono" style={{ fontSize: 11, color: "#6b7685", fontWeight: 400 }}> — {data.factors_note}</span>}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {factors.length === 0 && (
                <div className="card mono" style={{ padding: 16, fontSize: 12, color: "#6b7685" }}>
                  No significant factors detected in this period — either a quiet stretch, or no NEWS_API_KEY/GNEWS_API_KEY set on the backend for news sentiment.
                </div>
              )}
              {factors.map((f, i) => {
                const Icon = FACTOR_ICON[f.type] || AlertCircle;
                return (
                  <div
                    key={i}
                    id={`factor-${f.date}`}
                    className={`card factor-card ${selectedFactorDate === f.date ? "highlighted" : ""}`}
                    style={{ padding: 14, display: "flex", gap: 12, cursor: "pointer" }}
                    onClick={() => scrollToFactor(f.date)}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: `${IMPACT_COLOR[f.impact]}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={15} color={IMPACT_COLOR[f.impact]} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</div>
                        <div className="mono" style={{ fontSize: 11, color: "#6b7685", whiteSpace: "nowrap" }}>{f.date}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "#8b93a1", marginTop: 2 }}>{f.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
