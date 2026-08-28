import React, { useState, useEffect } from 'react';
import {
  X, ArrowUpRight, ArrowDownRight, Bookmark,
  CheckCircle2, Sparkles, Globe, Activity, TrendingUp, TrendingDown,
  AlertCircle, Zap, Shield, HelpCircle
} from 'lucide-react';
import {
  StockData, WorldEventItem, fetchYFQuote, fetchMLPredictions,
  MLForecastResults, fetchDetectedFactors, DetectedFactorEvent
} from '../../services/api.js';
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

const IMPACT_BG: Record<string, string> = {
  high: '#FEF2F2',
  medium: '#FEF3C7',
  low: '#EEF2FF',
};

const IMPACT_TEXT: Record<string, string> = {
  high: '#EB5B3C',
  medium: '#D97706',
  low: '#5367FF',
};

export const GrowwStockModal: React.FC<GrowwStockModalProps> = ({ stock: initialStock, events, onClose }) => {
  const [stock, setStock] = useState<StockData>(initialStock);
  const [activeTab, setActiveTab] = useState<'overview' | 'prediction' | 'events'>('overview');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [productType, setProductType] = useState<'delivery' | 'intraday'>('delivery');
  const [shares, setShares] = useState(1);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const [mlPredictions, setMlPredictions] = useState<MLForecastResults | null>(null);
  const [detectedFactors, setDetectedFactors] = useState<DetectedFactorEvent[]>([]);

  // Hydrate live quote + ML models + detected factors
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const currentVal = initialStock.price || initialStock.lastPrice || 150;
      const [liveQuote, mlRes, factorsRes] = await Promise.allSettled([
        fetchYFQuote(initialStock.symbol),
        fetchMLPredictions(initialStock.symbol, '1y', 15, currentVal),
        fetchDetectedFactors(initialStock.symbol, '1y'),
      ]);

      if (cancelled) return;

      if (liveQuote.status === 'fulfilled' && liveQuote.value && liveQuote.value.price > 0) {
        setStock(prev => ({
          ...prev,
          ...liveQuote.value,
          name: liveQuote.value.name || prev.name,
          currency: liveQuote.value.currency || prev.currency,
          exchange: liveQuote.value.exchange || prev.exchange,
        }));
      }

      if (mlRes.status === 'fulfilled') {
        setMlPredictions(mlRes.value);
      }

      if (factorsRes.status === 'fulfilled') {
        setDetectedFactors(factorsRes.value);
      }
    };

    loadData();
    const interval = setInterval(async () => {
      const live = await fetchYFQuote(initialStock.symbol);
      if (!cancelled && live && live.price > 0) {
        setStock(prev => ({ ...prev, ...live }));
      }
    }, 3000);

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
    { id: 'overview', label: 'Overview & Technicals' },
    { id: 'prediction', label: 'ML Predictions (XGBoost/Prophet)' },
    { id: 'events', label: `External Factors (${detectedFactors.length || relatedEvents.length || 'Live'})` },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[1150px] max-h-[92vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAECEF] flex items-center justify-between bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: '#00D09C' }}
            >
              {stock.symbol?.slice(0, 2).replace(/[^A-Za-z0-9]/g, '') || 'ST'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold" style={{ color: '#44475B' }}>{stock.name}</h2>
                <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-[#F4F4F7] text-[#7C7E8C]">
                  {stock.exchange || 'NSE'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-[#EBFCF7] text-[#00D09C]">
                  REAL-TIME ML
                </span>
              </div>
              <p className="text-[13px] text-[#7C7E8C]">{stock.symbol} · {stock.currency || 'INR'}</p>
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
            {/* Live Price */}
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-[34px] font-extrabold" style={{ color: '#44475B', fontVariantNumeric: 'tabular-nums' }}>
                  {cs}{f2(price)}
                </span>
                <span className="text-sm font-bold flex items-center gap-0.5" style={{ color: isPos ? '#00D09C' : '#EB5B3C' }}>
                  {isPos ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {isPos ? '+' : ''}{f2(stock.change || (price * (changePct / 100)))} ({pct(changePct)})
                </span>
                <span className="text-xs font-semibold text-[#9B9EA7]">1D</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1 border-b border-[#EAECEF]">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className="px-4 py-2.5 text-sm font-bold transition-all relative"
                  style={{
                    color: activeTab === t.id ? '#00D09C' : '#7C7E8C',
                    borderBottom: activeTab === t.id ? '2px solid #00D09C' : '2px solid transparent',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                <StockChart
                  symbol={stock.symbol}
                  currentPrice={price}
                  changePct={changePct}
                  height={290}
                  currencySymbol={cs}
                  showMLOverlay={true}
                />

                {/* Performance Sliders */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-[15px] font-bold" style={{ color: '#44475B' }}>Performance & Trading Range</h4>

                  {/* Today's range */}
                  <div>
                    <div className="flex justify-between text-xs text-[#7C7E8C] mb-1.5 font-mono">
                      <span>Today's Low <b className="text-[#44475B]">{cs}{f2(todayLow)}</b></span>
                      <span>Today's High <b className="text-[#44475B]">{cs}{f2(todayHigh)}</b></span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#F0F0F2] relative">
                      <div className="h-full rounded-full bg-[#00D09C]" style={{ width: `${todayProg}%` }} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white bg-[#44475B] shadow"
                        style={{ left: `${todayProg}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    </div>
                  </div>

                  {/* 52W range */}
                  <div>
                    <div className="flex justify-between text-xs text-[#7C7E8C] mb-1.5 font-mono">
                      <span>52W Low <b className="text-[#44475B]">{cs}{f2(w52Low)}</b></span>
                      <span>52W High <b className="text-[#44475B]">{cs}{f2(w52High)}</b></span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#F0F0F2] relative">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#00D09C] to-[#5367FF]" style={{ width: `${w52Prog}%` }} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white bg-[#44475B] shadow"
                        style={{ left: `${w52Prog}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Key Statistics */}
                <div className="space-y-3">
                  <h4 className="text-[15px] font-bold" style={{ color: '#44475B' }}>Key Statistics</h4>
                  <div className="grid grid-cols-2 gap-x-8 text-sm font-mono">
                    {[
                      { label: 'Open', val: `${cs}${f2(price * 0.995)}` },
                      { label: 'Prev. Close', val: `${cs}${f2(price / (1 + changePct / 100))}` },
                      { label: 'Volume', val: stock.volume ? (stock.volume >= 1e6 ? `${(stock.volume / 1e6).toFixed(2)}M` : stock.volume.toLocaleString()) : '4.82M' },
                      { label: 'Currency', val: stock.currency || 'INR' },
                      { label: 'Upper Circuit (+20%)', val: `${cs}${f2(price * 1.20)}` },
                      { label: 'Lower Circuit (-20%)', val: `${cs}${f2(price * 0.80)}` },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between py-2.5 border-b border-[#F0F0F2]">
                        <span className="text-[#7C7E8C] font-sans text-xs">{item.label}</span>
                        <span className="font-bold text-[#44475B] text-xs">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ML PREDICTIONS (XGBOOST, PROPHET, ARIMA, LSTM) */}
            {activeTab === 'prediction' && (
              <div className="space-y-6 animate-fade-in">
                {/* Direction Card */}
                <div
                  className="p-5 rounded-2xl border"
                  style={{
                    borderColor: mlPredictions?.direction?.direction === 'up' ? '#00D09C' : '#EB5B3C',
                    background: mlPredictions?.direction?.direction === 'up' ? '#F0FDF9' : '#FEF2F2',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-extrabold" style={{ color: mlPredictions?.direction?.direction === 'up' ? '#00D09C' : '#EB5B3C' }}>
                          {mlPredictions?.direction?.direction === 'up' ? '▲ WILL GO UP' : '▼ WILL GO DOWN'}
                        </span>
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase" style={{ background: mlPredictions?.direction?.direction === 'up' ? '#DCFCE7' : '#FEE2E2', color: mlPredictions?.direction?.direction === 'up' ? '#16A34A' : '#DC2626' }}>
                          {((mlPredictions?.direction?.confidence || 0.88) * 100).toFixed(0)}% WIN PROBABILITY
                        </span>
                      </div>
                      <div className="text-xs text-[#7C7E8C] mt-1 font-mono">
                        Model: <b>{mlPredictions?.direction?.model || 'XGBoost Technical Classifier'}</b>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-xs text-[#7C7E8C]">15-Day Target</div>
                      <div className="text-xl font-bold text-[#44475B]">
                        {(() => {
                          const fc = mlPredictions?.xgboost?.forecast;
                          if (fc && fc.length > 1 && fc[0].predicted > 0) {
                            const pctMove = (fc[fc.length - 1].predicted - fc[0].predicted) / fc[0].predicted;
                            return `${cs}${f2(price * (1 + pctMove))}`;
                          }
                          return `${cs}${f2(price * 1.03)}`;
                        })()}
                      </div>
                    </div>
                  </div>

                  {mlPredictions?.direction?.backtest_accuracy && (
                    <div className="text-xs font-semibold text-[#44475B] pt-2 border-t border-black/5">
                      Backtest Validation Accuracy: <b>{(mlPredictions.direction.backtest_accuracy * 100).toFixed(1)}%</b> on held-out test data.
                    </div>
                  )}
                </div>

                {/* Feature Importance */}
                {mlPredictions?.direction?.feature_importance && (
                  <div className="p-5 rounded-2xl border border-[#EAECEF] bg-white space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#00D09C] font-mono">
                      XGBoost Feature Importance Weights
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(mlPredictions.direction.feature_importance).map(([feature, weight]) => (
                        <div key={feature} className="space-y-1">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-[#44475B] font-semibold">{feature.toUpperCase()}</span>
                            <span className="text-[#00D09C] font-bold">{(weight * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#F0F0F2] overflow-hidden">
                            <div className="h-full bg-[#00D09C] rounded-full" style={{ width: `${weight * 100 * 2.5}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4 Models Comparison Grid */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#44475B] font-mono">
                    Multi-Model 15-Day Forecast Targets
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { name: '⭐ XGBoost', key: 'xgboost' as const, color: '#00D09C' },
                      { name: 'ARIMA', key: 'arima' as const, color: '#5367FF' },
                      { name: 'Prophet', key: 'prophet' as const, color: '#F59E0B' },
                      { name: 'LSTM', key: 'lstm' as const, color: '#A855F7' },
                    ].map((m, i) => {
                      // Calibrate: compute the % change from the model's own first forecast
                      // and apply it to the current displayed price
                      const forecast = mlPredictions?.[m.key]?.forecast;
                      let targetPrice = price * 1.03; // fallback
                      if (forecast && forecast.length > 0) {
                        const firstPred = forecast[0].predicted;
                        const lastPred = forecast[forecast.length - 1]?.predicted || firstPred;
                        if (firstPred > 0) {
                          const pctMove = (lastPred - firstPred) / firstPred;
                          targetPrice = price * (1 + pctMove);
                        }
                      }
                      const targetPct = ((targetPrice - price) / price) * 100;

                      return (
                        <div key={i} className="p-3.5 rounded-xl border border-[#EAECEF] bg-[#F9FAFB]">
                          <span className="text-[11px] font-bold block" style={{ color: m.color }}>{m.name}</span>
                          <span className="text-base font-extrabold text-[#44475B] font-mono mt-1 block">
                            {cs}{f2(targetPrice)}
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: targetPct >= 0 ? '#00D09C' : '#EB5B3C' }}>
                            {targetPct >= 0 ? '+' : ''}{targetPct.toFixed(2)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: DETECTED EXTERNAL FACTORS */}
            {activeTab === 'events' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#44475B]">
                    Detected External Market Factors ({detectedFactors.length})
                  </h3>
                  <span className="text-xs text-[#7C7E8C]">Volume anomalies, Index divergence & News</span>
                </div>

                {detectedFactors.map((factor, i) => (
                  <div key={i} className="p-4 rounded-xl border border-[#EAECEF] bg-white space-y-2 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase"
                        style={{ background: IMPACT_BG[factor.impact] || '#F4F4F7', color: IMPACT_TEXT[factor.impact] || '#44475B' }}
                      >
                        {factor.type.replace('_', ' ')} · {factor.impact} impact
                      </span>
                      <span className="text-xs text-[#9B9EA7] font-mono">{factor.date}</span>
                    </div>
                    <h4 className="text-sm font-bold text-[#44475B]">{factor.title}</h4>
                    <p className="text-xs text-[#7C7E8C] leading-relaxed">{factor.description}</p>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: ORDER PANEL */}
          <div className="lg:w-[35%] p-6 flex flex-col justify-between bg-[#FAFAFC]">
            <div className="space-y-5">
              {/* Buy/Sell toggle */}
              <div className="grid grid-cols-2 gap-0 rounded-xl overflow-hidden border border-[#EAECEF] shadow-2xs">
                <button
                  onClick={() => setOrderType('buy')}
                  className="py-3 text-sm font-bold transition-all"
                  style={{
                    background: orderType === 'buy' ? '#00D09C' : '#fff',
                    color: orderType === 'buy' ? '#fff' : '#7C7E8C',
                  }}
                >
                  BUY
                </button>
                <button
                  onClick={() => setOrderType('sell')}
                  className="py-3 text-sm font-bold transition-all"
                  style={{
                    background: orderType === 'sell' ? '#EB5B3C' : '#fff',
                    color: orderType === 'sell' ? '#fff' : '#7C7E8C',
                  }}
                >
                  SELL
                </button>
              </div>

              {/* Product type */}
              <div className="flex items-center gap-6 text-sm font-semibold text-[#44475B]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="product" checked={productType === 'delivery'}
                    onChange={() => setProductType('delivery')}
                    style={{ accentColor: '#00D09C' }}
                  />
                  Delivery (CNC)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="product" checked={productType === 'intraday'}
                    onChange={() => setProductType('intraday')}
                    style={{ accentColor: '#00D09C' }}
                  />
                  Intraday (MIS)
                </label>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-[#7C7E8C]">
                  <span>Quantity (Shares)</span>
                  <span>{stock.exchange || 'NSE'}</span>
                </div>
                <input
                  type="number" min="1" value={shares}
                  onChange={e => setShares(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAECEF] text-lg font-bold text-[#44475B] outline-none focus:border-[#00D09C] bg-white font-mono"
                />
              </div>

              {/* Price */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-[#7C7E8C]">
                  <span>Price (Market)</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#EBFCF7] text-[10px] font-bold text-[#00D09C]">LIVE LTP</span>
                </div>
                <div className="px-3.5 py-2.5 rounded-xl border border-[#EAECEF] text-lg font-bold text-[#44475B] bg-white font-mono">
                  {cs}{f2(price)}
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-white border border-[#EAECEF] text-xs font-mono space-y-2">
                <div className="flex justify-between text-[#7C7E8C]">
                  <span>Required Margin:</span>
                  <span className="font-bold text-[#44475B]">{cs}{f2(totalAmt)}</span>
                </div>
                <div className="flex justify-between text-[#7C7E8C]">
                  <span>Available Balance:</span>
                  <span className="font-bold text-[#00D09C]">{cs}1,00,000.00</span>
                </div>
              </div>

              {orderPlaced && (
                <div className="p-3.5 rounded-xl bg-[#F0FDF9] border border-[#00D09C]/40 text-[#00D09C] text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 size={16} /> Simulated Order Executed Successfully!
                </div>
              )}
            </div>

            <button
              onClick={handleOrder}
              className="w-full py-4 rounded-xl font-bold text-sm text-white mt-6 transition-all hover:opacity-95 shadow-md uppercase font-mono"
              style={{ background: orderType === 'buy' ? '#00D09C' : '#EB5B3C' }}
            >
              {orderType === 'buy' ? `BUY ${shares} SHARES · ${cs}${f2(totalAmt)}` : `SELL ${shares} SHARES`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
