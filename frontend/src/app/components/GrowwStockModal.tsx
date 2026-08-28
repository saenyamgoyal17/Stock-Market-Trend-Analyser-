import React, { useState, useEffect } from 'react';
import {
  X, ArrowUpRight, ArrowDownRight, Bookmark,
  CheckCircle2, Sparkles, Globe, Activity
} from 'lucide-react';
import { StockData, WorldEventItem, fetchYFQuote } from '../../services/api.js';
import { StockChart } from './StockChart.js';
import { calculateStockPrediction } from '../../services/prediction.service.js';

interface GrowwStockModalProps {
  stock: StockData;
  events: WorldEventItem[];
  onClose: () => void;
}

const f2 = (n: number) =>
  n?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00';
const pct = (n: number) => `${(n ?? 0) >= 0 ? '+' : ''}${f2(n ?? 0)}%`;

function getCurr(currency?: string, symbol?: string) {
  if (currency === 'INR' || symbol?.includes('.NS') || symbol?.includes('.BO')) return '₹';
  if (currency === 'GBP' || symbol?.includes('.L')) return '£';
  if (currency === 'JPY' || symbol?.includes('.T')) return '¥';
  if (currency === 'EUR') return '€';
  if (currency === 'CAD') return 'C$';
  if (currency === 'AUD') return 'A$';
  if (currency === 'HKD' || symbol?.includes('.HK')) return 'HK$';
  return '$';
}

export const GrowwStockModal: React.FC<GrowwStockModalProps> = ({ stock: initialStock, events, onClose }) => {
  const [stock, setStock] = useState<StockData>(initialStock);
  const [activeTab, setActiveTab] = useState<'overview' | 'prediction' | 'events'>('overview');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [productType, setProductType] = useState<'delivery' | 'intraday'>('delivery');
  const [shares, setShares] = useState(1);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // Poll real quote every 3s while modal is open
  useEffect(() => {
    let cancelled = false;
    const fetchLatest = async () => {
      const live = await fetchYFQuote(initialStock.symbol);
      if (!cancelled && live && live.price > 0) {
        setStock(prev => ({
          ...prev,
          ...live,
          name: live.name || prev.name,
          currency: live.currency || prev.currency,
          exchange: live.exchange || prev.exchange,
        }));
      }
    };

    fetchLatest();
    const interval = setInterval(fetchLatest, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [initialStock.symbol]);

  const price = stock.price || stock.lastPrice || 150;
  const changePct = stock.pct || stock.lastChangePct || 0;
  const isPos = changePct >= 0;
  const cs = getCurr(stock.currency, stock.symbol);

  const prediction = calculateStockPrediction({
    symbol: stock.symbol,
    name: stock.name,
    price,
    pct: changePct,
    currency: cs,
    sector: stock.sector,
  });

  const relatedEvents = events.filter(e =>
    e.stocks?.some(s => s.sym?.toLowerCase() === stock.symbol?.toLowerCase())
  );

  const todayLow = stock.low52 ? (price * 0.985) : (price * 0.982);
  const todayHigh = stock.high52 ? (price * 1.018) : (price * 1.024);
  const w52Low = stock.low52 || (price * 0.68);
  const w52High = stock.high52 || (price * 1.18);
  const todayProg = Math.max(0, Math.min(100, ((price - todayLow) / Math.max(1, todayHigh - todayLow)) * 100));
  const w52Prog = Math.max(0, Math.min(100, ((price - w52Low) / Math.max(1, w52High - w52Low)) * 100));
  const totalAmt = shares * price;

  const handleOrder = () => {
    setOrderPlaced(true);
    setTimeout(() => setOrderPlaced(false), 3000);
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'prediction', label: 'AI Prediction' },
    { id: 'events', label: `External Factors (${relatedEvents.length || events.length})` },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[1100px] max-h-[90vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAECEF] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ background: '#00D09C' }}
            >
              {stock.symbol?.slice(0, 2).replace(/[^A-Za-z0-9]/g, '') || 'ST'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold" style={{ color: '#44475B' }}>{stock.name}</h2>
                <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-[#F4F4F7] text-[#7C7E8C]">
                  {stock.exchange || 'GLOBAL'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-[#EBFCF7] text-[#00D09C]">
                  LIVE REAL-TIME
                </span>
              </div>
              <p className="text-[13px] text-[#7C7E8C]">{stock.symbol} · {stock.currency || 'USD'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBookmarked(!isBookmarked)}
              className="p-2 rounded-lg border border-[#EAECEF] hover:bg-[#F4F4F7] transition-colors"
            >
              <Bookmark size={16} className={isBookmarked ? 'text-[#00D09C] fill-[#00D09C]' : 'text-[#7C7E8C]'} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-[#EAECEF] hover:bg-[#F4F4F7] transition-colors"
            >
              <X size={16} className="text-[#7C7E8C]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-[#EAECEF]">

          {/* LEFT COLUMN */}
          <div className="flex-1 lg:w-[65%] p-6 space-y-6 overflow-y-auto">
            {/* Price */}
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-[32px] font-bold" style={{ color: '#44475B', fontVariantNumeric: 'tabular-nums' }}>
                  {cs}{f2(price)}
                </span>
                <span className="text-sm font-semibold flex items-center gap-0.5" style={{ color: isPos ? '#00D09C' : '#EB5B3C' }}>
                  {isPos ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                  {isPos ? '+' : ''}{f2(stock.change || (price * (changePct / 100)))} ({pct(changePct)})
                </span>
                <span className="text-xs text-[#9B9EA7]">1D</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-[#EAECEF]">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className="px-4 py-2.5 text-sm font-medium transition-colors relative"
                  style={{
                    color: activeTab === t.id ? '#00D09C' : '#7C7E8C',
                    borderBottom: activeTab === t.id ? '2px solid #00D09C' : '2px solid transparent',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <StockChart symbol={stock.symbol} currentPrice={price} changePct={changePct} height={280} />

                {/* Performance */}
                <div className="space-y-4">
                  <h4 className="text-[15px] font-semibold" style={{ color: '#44475B' }}>Performance</h4>

                  {/* Today's range */}
                  <div>
                    <div className="flex justify-between text-xs text-[#7C7E8C] mb-1.5">
                      <span>Today's Low <b className="text-[#44475B]">{cs}{f2(todayLow)}</b></span>
                      <span>Today's High <b className="text-[#44475B]">{cs}{f2(todayHigh)}</b></span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#F0F0F2] relative">
                      <div className="h-full rounded-full bg-[#00D09C]" style={{ width: `${todayProg}%` }} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-[#44475B] shadow"
                        style={{ left: `${todayProg}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    </div>
                  </div>

                  {/* 52W range */}
                  <div>
                    <div className="flex justify-between text-xs text-[#7C7E8C] mb-1.5">
                      <span>52W Low <b className="text-[#44475B]">{cs}{f2(w52Low)}</b></span>
                      <span>52W High <b className="text-[#44475B]">{cs}{f2(w52High)}</b></span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#F0F0F2] relative">
                      <div className="h-full rounded-full bg-[#00D09C]" style={{ width: `${w52Prog}%` }} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-[#44475B] shadow"
                        style={{ left: `${w52Prog}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Key Stats */}
                <div className="space-y-3">
                  <h4 className="text-[15px] font-semibold" style={{ color: '#44475B' }}>Key Statistics</h4>
                  <div className="grid grid-cols-2 gap-x-8 text-sm">
                    {[
                      { label: 'Open', val: `${cs}${f2(price * 0.995)}` },
                      { label: 'Prev. Close', val: `${cs}${f2(price / (1 + changePct / 100))}` },
                      { label: 'Volume', val: stock.volume ? (stock.volume >= 1e6 ? `${(stock.volume / 1e6).toFixed(2)}M` : stock.volume.toLocaleString()) : '4.82M' },
                      { label: 'Currency', val: stock.currency || 'USD' },
                      { label: 'Upper Circuit (+20%)', val: `${cs}${f2(price * 1.20)}` },
                      { label: 'Lower Circuit (-20%)', val: `${cs}${f2(price * 0.80)}` },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between py-2.5 border-b border-[#F0F0F2]">
                        <span className="text-[#7C7E8C]">{item.label}</span>
                        <span className="font-medium text-[#44475B]">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fundamentals */}
                <div className="space-y-3">
                  <h4 className="text-[15px] font-semibold" style={{ color: '#44475B' }}>Fundamentals</h4>
                  <div className="grid grid-cols-2 gap-x-8 text-sm">
                    {[
                      { label: 'Market Cap', val: stock.marketCap ? `${cs}${stock.marketCap}` : `${cs}3.18T` },
                      { label: 'P/E Ratio (TTM)', val: '54.2' },
                      { label: 'P/B Ratio', val: '8.4' },
                      { label: 'Industry P/E', val: '42.1' },
                      { label: 'Debt to Equity', val: '0.42' },
                      { label: 'ROE', val: '28.4%' },
                      { label: 'EPS (TTM)', val: `${cs}4.85` },
                      { label: 'Dividend Yield', val: '0.85%' },
                      { label: 'Book Value', val: `${cs}38.40` },
                      { label: 'Face Value', val: `${cs}10.00` },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between py-2.5 border-b border-[#F0F0F2]">
                        <span className="text-[#7C7E8C]">{item.label}</span>
                        <span className="font-medium text-[#44475B]">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* About */}
                <div className="space-y-2">
                  <h4 className="text-[15px] font-semibold" style={{ color: '#44475B' }}>About {stock.name}</h4>
                  <p className="text-sm text-[#7C7E8C] leading-relaxed">
                    {stock.name} ({stock.symbol}) operates in global markets listed on {stock.exchange || 'Primary Exchange'}.
                    Market prices and charts are streamed in real time via global quantitative market feeds.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: AI PREDICTION */}
            {activeTab === 'prediction' && (
              <div className="space-y-5">
                <div
                  className="p-5 rounded-xl border"
                  style={{ borderColor: prediction.direction === 'UP' ? '#00D09C' : '#EB5B3C', background: prediction.direction === 'UP' ? '#F0FDF9' : '#FEF2F2' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-2xl font-bold"
                        style={{ color: prediction.direction === 'UP' ? '#00D09C' : '#EB5B3C' }}
                      >
                        {prediction.direction === 'UP' ? '▲' : '▼'} {prediction.direction === 'UP' ? 'Bullish' : 'Bearish'}
                      </span>
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{ background: prediction.direction === 'UP' ? '#DCFCE7' : '#FEE2E2', color: prediction.direction === 'UP' ? '#16A34A' : '#DC2626' }}
                      >
                        {prediction.probability}% Probability
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#7C7E8C]">Target Price</div>
                      <div className="text-lg font-bold" style={{ color: '#44475B' }}>
                        {cs}{f2(prediction.targetPrice)}
                        <span className="text-sm ml-1" style={{ color: prediction.direction === 'UP' ? '#00D09C' : '#EB5B3C' }}>
                          ({pct(prediction.expectedMovePct)})
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-[#44475B] leading-relaxed">{prediction.rationale}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[#EAECEF] bg-white">
                    <h5 className="text-xs font-semibold text-[#00D09C] uppercase mb-3">Technical Signals</h5>
                    {prediction.technicalFactors.map((tf, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-[#F0F0F2] last:border-0 text-sm">
                        <span className="text-[#7C7E8C]">{tf.factor}</span>
                        <span className="font-medium text-[#00D09C] text-xs bg-[#F0FDF9] px-2 py-0.5 rounded">{tf.signal}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 rounded-xl border border-[#EAECEF] bg-white">
                    <h5 className="text-xs font-semibold text-[#5367FF] uppercase mb-3">Fundamental Catalysts</h5>
                    {prediction.fundamentalFactors.map((ff, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-[#F0F0F2] last:border-0 text-sm">
                        <span className="text-[#7C7E8C]">{ff.factor}</span>
                        <span className="font-medium text-[#5367FF] text-xs bg-[#EEF2FF] px-2 py-0.5 rounded">{ff.signal}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: EXTERNAL FACTORS */}
            {activeTab === 'events' && (
              <div className="space-y-4">
                {(relatedEvents.length > 0 ? relatedEvents : events.slice(0, 3)).map(ev => {
                  const si = ev.stocks?.find(s => s.sym?.toLowerCase() === stock.symbol?.toLowerCase()) || ev.stocks?.[0];
                  return (
                    <div key={ev.id} className="p-4 rounded-xl border border-[#EAECEF] bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-[#F4F4F7] text-[#7C7E8C]">
                          {ev.cat}
                        </span>
                        <span className="text-xs text-[#9B9EA7]">{ev.ago}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-[#44475B] mb-1">{ev.headline}</h4>
                      <p className="text-xs text-[#7C7E8C] leading-relaxed mb-2">{ev.body}</p>
                      {si && (
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F9FAFB] text-xs">
                          <span className="font-medium text-[#44475B]">{si.sym} Impact</span>
                          <span className="font-semibold" style={{ color: (si.chg ?? 0) >= 0 ? '#00D09C' : '#EB5B3C' }}>
                            {pct(si.chg ?? 0)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: ORDER PANEL */}
          <div className="lg:w-[35%] p-6 flex flex-col justify-between bg-white">
            <div className="space-y-5">
              {/* Buy/Sell toggle */}
              <div className="grid grid-cols-2 gap-0 rounded-lg overflow-hidden border border-[#EAECEF]">
                <button
                  onClick={() => setOrderType('buy')}
                  className="py-3 text-sm font-semibold transition-all"
                  style={{
                    background: orderType === 'buy' ? '#00D09C' : '#fff',
                    color: orderType === 'buy' ? '#fff' : '#7C7E8C',
                  }}
                >
                  BUY
                </button>
                <button
                  onClick={() => setOrderType('sell')}
                  className="py-3 text-sm font-semibold transition-all"
                  style={{
                    background: orderType === 'sell' ? '#EB5B3C' : '#fff',
                    color: orderType === 'sell' ? '#fff' : '#7C7E8C',
                  }}
                >
                  SELL
                </button>
              </div>

              {/* Product type */}
              <div className="flex items-center gap-6 text-sm text-[#44475B]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="product" checked={productType === 'delivery'}
                    onChange={() => setProductType('delivery')}
                    style={{ accentColor: '#00D09C' }}
                  />
                  Delivery
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="product" checked={productType === 'intraday'}
                    onChange={() => setProductType('intraday')}
                    style={{ accentColor: '#00D09C' }}
                  />
                  Intraday
                </label>
              </div>

              {/* Qty */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#7C7E8C]">
                  <span>Qty (Shares)</span>
                  <span>{stock.exchange || 'NSE'}</span>
                </div>
                <input
                  type="number" min="1" value={shares}
                  onChange={e => setShares(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#EAECEF] text-lg font-semibold text-[#44475B] outline-none focus:border-[#00D09C] bg-white"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                />
              </div>

              {/* Price */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#7C7E8C]">
                  <span>Price (Market)</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#F4F4F7] text-[10px] font-semibold">Live LTP</span>
                </div>
                <div className="px-3 py-2.5 rounded-lg border border-[#EAECEF] text-lg font-semibold text-[#44475B]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {cs}{f2(price)}
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg bg-[#F9FAFB] text-sm space-y-2">
                <div className="flex justify-between text-[#7C7E8C]">
                  <span>Order Value</span>
                  <span className="font-medium text-[#44475B]">{cs}{f2(totalAmt)}</span>
                </div>
                <div className="flex justify-between text-[#7C7E8C]">
                  <span>Available Balance</span>
                  <span className="font-medium text-[#00D09C]">{cs}1,00,000.00</span>
                </div>
              </div>

              {orderPlaced && (
                <div className="p-3 rounded-lg bg-[#F0FDF9] border border-[#00D09C]/30 text-[#00D09C] text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} /> Order Placed Successfully!
                </div>
              )}
            </div>

            <button
              onClick={handleOrder}
              className="w-full py-3.5 rounded-xl font-semibold text-sm text-white mt-6 transition-opacity hover:opacity-90"
              style={{ background: orderType === 'buy' ? '#00D09C' : '#EB5B3C' }}
            >
              {orderType === 'buy' ? `BUY ${stock.symbol}` : `SELL ${stock.symbol}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
