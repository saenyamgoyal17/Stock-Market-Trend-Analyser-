// PulseAI API Client — Real Market Data via Yahoo Finance

const API_BASE = '/v1';
const YF = '/yf';   // proxied to query1.finance.yahoo.com
const YF2 = '/yf2'; // proxied to query2.finance.yahoo.com

// ── Types ──────────────────────────────────────────────────────────
export interface UserProfile {
  id: string; email: string; name?: string;
  role: 'FREE' | 'PRO' | 'ENTERPRISE';
  currency?: string; country?: string; avatarUrl?: string;
}

export interface StockData {
  symbol: string; name: string; exchange: string; country: string; currency: string;
  price?: number; lastPrice?: number; pct?: number; lastChangePct?: number;
  change?: number; lastChange?: number;
  sector?: string; industry?: string; marketCap?: string | number;
  peRatio?: number; eps?: number; high52?: number; low52?: number; volume?: number;
  id?: string;
}

export interface OHLCVPoint {
  timestamp: string | number; open: number; high: number; low: number;
  close: number; volume: number; dateStr?: string;
}

export interface ChartPoint {
  time: number; date: string; open: number; high: number; low: number;
  close: number; volume: number;
}

export interface ImpactStock {
  sym: string; name: string; chg: number; price: number; before: number;
  confidence?: number; reason?: string;
}
export interface ImpactSector { sec: string; chg: number; }

export interface WorldEventItem {
  id: string; ago: string;
  cat: 'Political' | 'Military' | 'Economic' | 'Geopolitical' | 'Environmental';
  headline: string; body: string;
  signal: 'bearish' | 'bullish' | 'mixed';
  sentimentScore?: number; aiSummary?: string; sourceUrl?: string; sourceName?: string;
  publishedAt?: string;
  stocks: ImpactStock[]; sectors: ImpactSector[];
}

export interface AIAnalysisResult {
  overallSentiment: number; summary: string;
  affectedStocks: Array<{ symbol: string; name?: string; direction: 'bullish'|'bearish'; confidence: number; magnitude: number; reason: string }>;
  affectedSectors: Array<{ name: string; direction: 'bullish'|'bearish'; magnitude: number; reason: string }>;
  keyRisks: string[]; timeHorizon: string;
}

export interface MarketIndex {
  symbol: string; name: string; value: number; change: number;
  changePct: number; exchange: string; country: string;
}

export interface IndexData {
  name: string; value: number; change: number; changePct: number; currency: string;
}

// ═══════════════════════════════════════════════════════════════════
// YAHOO FINANCE — REAL DATA (search, quotes, charts, indices)
// ═══════════════════════════════════════════════════════════════════

/** Search any stock globally via Yahoo Finance */
export async function fetchStockSearch(query: string, _currency = 'USD'): Promise<StockData[]> {
  try {
    const res = await fetch(
      `${YF}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`
    );
    if (!res.ok) throw new Error(`YF search ${res.status}`);
    const data = await res.json();
    return (data.quotes || [])
      .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchDisp || q.exchange || '',
        country: '',
        currency: '',
        price: 0,
        pct: 0,
        sector: q.sector || q.industry || '',
      }));
  } catch (err) {
    console.warn('YF search failed, trying backend:', err);
    // Fallback to backend
    try {
      const res = await fetch(`${API_BASE}/stocks/search?q=${encodeURIComponent(query)}&limit=20`);
      const json = await res.json();
      return (json.data || []).map((s: any) => ({
        symbol: s.symbol, name: s.name, exchange: s.exchange,
        country: s.country, currency: s.currency,
        price: s.price ?? s.lastPrice ?? 0, pct: s.changePct ?? s.lastChangePct ?? 0,
        sector: s.sector ?? '',
      }));
    } catch { return []; }
  }
}

/** Fetch real-time quote for a single symbol via Yahoo Finance chart endpoint */
export async function fetchYFQuote(symbol: string): Promise<StockData | null> {
  try {
    const res = await fetch(`${YF}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`);
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.chart?.result?.[0];
    if (!r) return null;

    const meta = r.meta;
    const currentPrice = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? currentPrice;
    const changePct = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

    return {
      symbol: meta.symbol,
      name: meta.shortName || meta.longName || meta.symbol,
      exchange: meta.exchangeName || meta.fullExchangeName || '',
      country: '',
      currency: meta.currency || 'USD',
      price: currentPrice,
      pct: +changePct.toFixed(2),
      change: +(currentPrice - prevClose).toFixed(2),
      sector: '',
      high52: meta.fiftyTwoWeekHigh,
      low52: meta.fiftyTwoWeekLow,
      volume: meta.regularMarketVolume,
    };
  } catch {
    return null;
  }
}

/** Fetch real-time quotes for multiple symbols in parallel */
export async function fetchYFQuotes(symbols: string[]): Promise<StockData[]> {
  const results = await Promise.allSettled(symbols.map(s => fetchYFQuote(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<StockData | null> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value!);
}

/** Fetch real chart data from Yahoo Finance */
export async function fetchYFChart(symbol: string, range: string = '1d'): Promise<ChartPoint[]> {
  const intervalMap: Record<string, string> = {
    '1d': '2m', '5d': '15m', '1mo': '1d', '3mo': '1d',
    '6mo': '1d', '1y': '1wk', '5y': '1mo', 'max': '3mo',
  };
  const interval = intervalMap[range] || '5m';

  try {
    const res = await fetch(`${YF}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`);
    if (!res.ok) throw new Error(`Chart ${res.status}`);
    const data = await res.json();
    const r = data.chart?.result?.[0];
    if (!r || !r.timestamp) return [];

    const ts = r.timestamp as number[];
    const q = r.indicators?.quote?.[0] || {};

    return ts.map((t: number, i: number) => ({
      time: t * 1000,
      date: formatChartDate(t * 1000, range),
      open: q.open?.[i] ?? 0,
      high: q.high?.[i] ?? 0,
      low: q.low?.[i] ?? 0,
      close: q.close?.[i] ?? 0,
      volume: q.volume?.[i] ?? 0,
    })).filter((p: ChartPoint) => p.close > 0 && p.close !== null);
  } catch (err) {
    console.warn(`YF chart failed for ${symbol}:`, err);
    return [];
  }
}

function formatChartDate(ms: number, range: string): string {
  const d = new Date(ms);
  if (range === '1d' || range === '5d') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (range === '1mo' || range === '3mo' || range === '6mo') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/** Fetch real market index data */
export async function fetchYFIndices(): Promise<IndexData[]> {
  const syms = ['^NSEI', '^BSESN', '^NSEBANK', '^GSPC', '^IXIC', '^FTSE'];
  const names: Record<string,string> = {
    '^NSEI':'NIFTY 50', '^BSESN':'SENSEX', '^NSEBANK':'BANK NIFTY',
    '^GSPC':'S&P 500', '^IXIC':'NASDAQ', '^FTSE':'FTSE 100',
  };
  const currs: Record<string,string> = {
    '^NSEI':'₹', '^BSESN':'₹', '^NSEBANK':'₹', '^GSPC':'$', '^IXIC':'$', '^FTSE':'£',
  };

  const results = await Promise.allSettled(syms.map(async sym => {
    const q = await fetchYFQuote(sym);
    if (!q) return null;
    return {
      name: names[sym] || sym,
      value: q.price || 0,
      change: q.change || 0,
      changePct: q.pct || 0,
      currency: currs[sym] || '$',
    };
  }));

  return results
    .filter((r): r is PromiseFulfilledResult<IndexData | null> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value!);
}

// ═══════════════════════════════════════════════════════════════════
// POLLING ENGINE — auto-refresh prices every N seconds
// ═══════════════════════════════════════════════════════════════════

let _pollInterval: ReturnType<typeof setInterval> | null = null;
let _pollSymbols: string[] = [];
let _pollCallback: ((stocks: StockData[]) => void) | null = null;

/** Start polling real-time quotes for given symbols. Call stopPricePolling() to stop. */
export function startPricePolling(
  symbols: string[],
  callback: (updated: StockData[]) => void,
  intervalMs = 5000
) {
  stopPricePolling();
  _pollSymbols = symbols;
  _pollCallback = callback;

  const poll = async () => {
    if (_pollSymbols.length === 0) return;
    const fresh = await fetchYFQuotes(_pollSymbols);
    if (fresh.length > 0 && _pollCallback) _pollCallback(fresh);
  };

  // Initial fetch
  poll();
  _pollInterval = setInterval(poll, intervalMs);
}

export function stopPricePolling() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
  _pollCallback = null;
}

export function updatePollSymbols(symbols: string[]) {
  _pollSymbols = symbols;
}

// ═══════════════════════════════════════════════════════════════════
// LEGACY API COMPAT — keep old function signatures working
// ═══════════════════════════════════════════════════════════════════

export async function fetchMarketMovers(type: 'gainers'|'losers'|'volatile' = 'gainers'): Promise<StockData[]> {
  try {
    const res = await fetch(`${API_BASE}/stocks/movers/${type}?limit=12`);
    const json = await res.json();
    if (json.data?.length) return json.data.map((s: any) => ({
      symbol: s.symbol, name: s.name, exchange: s.exchange,
      country: s.country, currency: s.currency,
      price: s.lastPrice ?? s.price ?? 0, pct: s.lastChangePct ?? s.changePct ?? 0,
      sector: s.sector ?? '', marketCap: s.marketCap,
    }));
  } catch {}
  return [];
}

export async function fetchMarketSummary(): Promise<MarketIndex[]> {
  try {
    const res = await fetch(`${API_BASE}/stocks/market-summary`);
    const json = await res.json();
    if (json.data?.length) return json.data;
  } catch {}
  return [];
}

export async function fetchStockHistory(symbol: string, period = '1m', interval = '1d'): Promise<OHLCVPoint[]> {
  const chart = await fetchYFChart(symbol, period === '1d' ? '1d' : period === '1w' ? '5d' : period === '1m' ? '1mo' : period === '1y' ? '1y' : '3mo');
  if (chart.length > 0) {
    return chart.map(c => ({
      timestamp: c.time, open: c.open, high: c.high, low: c.low,
      close: c.close, volume: c.volume, dateStr: c.date,
    }));
  }
  return [];
}

export async function fetchLatestEvents(): Promise<WorldEventItem[]> {
  try {
    const res = await fetch(`${API_BASE}/events/latest?limit=15`);
    const json = await res.json();
    if (json.data?.length) {
      return json.data.map((ev: any) => {
        const sentiment = ev.sentiment ?? 0;
        const signal: 'bullish'|'bearish'|'mixed' = sentiment > 0.15 ? 'bullish' : sentiment < -0.15 ? 'bearish' : 'mixed';
        const stocks: ImpactStock[] = (ev.stockEvents || []).map((se: any) => ({
          sym: se.stock?.symbol || 'TICKER', name: se.stock?.name || '',
          chg: se.changeAfter24h ?? se.changeAfter1h ?? (sentiment > 0 ? 3.2 : -4.1),
          price: se.priceAtEvent ?? 150, before: se.priceBefore ?? 155,
          confidence: se.aiConfidence ?? 0.85, reason: se.aiImpactReason || 'Causal transmission analyzed.',
        }));
        return {
          id: ev.id, ago: getRelativeTime(ev.publishedAt || ev.detectedAt),
          cat: (ev.category?.charAt(0).toUpperCase() + ev.category?.slice(1).toLowerCase()) as any || 'Economic',
          headline: ev.title, body: ev.aiSummary || ev.body, signal,
          sentimentScore: sentiment, sourceName: ev.sourceName,
          stocks: stocks.length > 0 ? stocks : [],
          sectors: (ev.sectorImpacts || []).map((si: any) => ({ sec: si.sector, chg: si.changeAvg })),
        };
      });
    }
  } catch {}
  return [];
}

export async function analyzeHeadlineWithClaude(headline: string, targetSymbols?: string[]): Promise<AIAnalysisResult | null> {
  try {
    const res = await fetch(`${API_BASE}/events/analyze`, {
      method: 'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ text: headline, targetSymbols }),
    });
    const json = await res.json();
    if (json.data?.affectedStocks) return json.data;
  } catch {}
  return null;
}

// ── Auth ───────────────────────────────────────────────────────────
export function getAuthToken(): string | null { return localStorage.getItem('pulseai_token'); }
export function setAuthToken(token: string) { localStorage.setItem('pulseai_token', token); }
export function removeAuthToken() { localStorage.removeItem('pulseai_token'); }
function getAuthHeaders() {
  const token = getAuthToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function loginUser(email: string, password: string) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (data.success && data.data?.session?.access_token) setAuthToken(data.data.session.access_token);
    return data;
  } catch { return { success: false }; }
}
export async function registerUser(email: string, password: string, name?: string) {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name }) });
    const data = await res.json();
    if (data.success && data.data?.session?.access_token) setAuthToken(data.data.session.access_token);
    return data;
  } catch { return { success: false }; }
}
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const token = getAuthToken(); if (!token) return null;
  try { const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() }); const data = await res.json(); return data.success ? data.data : null; } catch { return null; }
}
export async function logoutUser() {
  try { await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: getAuthHeaders() }); } finally { removeAuthToken(); }
}

// ── WebSocket (legacy compat — keeps working if backend is up) ────
export function connectPulseWebSocket(
  onPriceUpdate: (data: { symbol: string; price: number; change: number; changePct: number; currency: string }) => void,
  onNewEvent: (event: any) => void
) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  let ws: WebSocket | null = null;
  try {
    ws = new WebSocket(wsUrl);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'price:update' && msg.data) onPriceUpdate(msg.data);
        else if (msg.type === 'event:new' && msg.data) onNewEvent(msg.data);
      } catch {}
    };
    ws.onerror = () => {}; // silently fail, polling handles real-time
  } catch {}
  return () => { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); };
}

function getRelativeTime(dateStr: string): string {
  if (!dateStr) return 'Just now';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
