import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, BarChart, Bar,
} from 'recharts';
import { TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';
import { DetectedFactorEvent } from '../../services/api.js';

interface StockChartProps {
  symbol: string;
  currentPrice?: number;
  changePct?: number;
  height?: number;
  showMLOverlay?: boolean;
  currencySymbol?: string;
  onFactorClick?: (factor: DetectedFactorEvent) => void;
}

const RANGES = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
];

const IMPACT_COLOR: Record<string, string> = {
  high: '#EB5B3C',
  medium: '#D97706',
  low: '#5367FF',
};

const API_BASE = '/api';

export const StockChart: React.FC<StockChartProps> = ({
  symbol,
  currentPrice = 0,
  changePct = 0,
  height = 360,
  showMLOverlay = true,
  currencySymbol = '₹',
  onFactorClick,
}) => {
  const [range, setRange] = useState('1y');
  const [activeModel, setActiveModel] = useState<'xgboost' | 'arima' | 'prophet' | 'lstm'>('xgboost');
  const [loading, setLoading] = useState(true);
  const [isForecastVisible, setIsForecastVisible] = useState(true);

  const [stockData, setStockData] = useState<any>(null);
  const [factors, setFactors] = useState<DetectedFactorEvent[]>([]);
  const [predictions, setPredictions] = useState<any>(null);

  // Fetch complete data directly from FastAPI backend /api/full/{ticker}
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const period = range === '1d' ? '5d' : range;

    fetch(`${API_BASE}/full/${encodeURIComponent(symbol)}?period=${period}&horizon=15`)
      .then(res => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        setStockData(data.stock || null);
        setFactors(data.factors || []);
        setPredictions(data.predictions || null);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.warn(`Backend fetch failed for ${symbol}:`, err);
        // Fallback: fetch individual prediction endpoint
        fetch(`${API_BASE}/predict/${encodeURIComponent(symbol)}?period=1y&horizon=15`)
          .then(r => r.json())
          .then(p => {
            if (!cancelled) {
              setPredictions(p);
              setLoading(false);
            }
          })
          .catch(() => {
            if (!cancelled) setLoading(false);
          });
      });

    return () => { cancelled = true; };
  }, [symbol, range]);

  // Set default active model based on backend availability
  useEffect(() => {
    if (predictions) {
      if (predictions.xgboost && !predictions.xgboost.error && predictions.xgboost.forecast?.length) {
        setActiveModel('xgboost');
      } else if (predictions.arima && !predictions.arima.error && predictions.arima.forecast?.length) {
        setActiveModel('arima');
      } else if (predictions.prophet && !predictions.prophet.error && predictions.prophet.forecast?.length) {
        setActiveModel('prophet');
      } else if (predictions.lstm && !predictions.lstm.error && predictions.lstm.forecast?.length) {
        setActiveModel('lstm');
      }
    }
  }, [predictions]);

  // Build unified chart dataset with historical prices and seamless ML forecast overlay
  const chartData = useMemo(() => {
    const prices = stockData?.prices;
    if (!prices || prices.length === 0) return [];

    const pts: any[] = prices.map((p: any) => ({
      date: p.date.slice(0, 10),
      close: p.close,
      volume: p.volume,
      isForecast: false,
    }));

    if (isForecastVisible && predictions) {
      const fc = predictions[activeModel];
      if (fc && fc.forecast && fc.forecast.length > 0 && !fc.error) {
        const lastHist = pts[pts.length - 1];
        // Bridge point so forecast line connects continuously to historical close
        pts.push({
          date: lastHist.date,
          close: null,
          predicted: lastHist.close,
          lower: lastHist.close,
          upper: lastHist.close,
          isForecast: true,
          isBridge: true,
        });

        fc.forecast.forEach((f: any) => {
          pts.push({
            date: f.date,
            close: null,
            predicted: f.predicted,
            lower: f.lower,
            upper: f.upper,
            volume: 0,
            isForecast: true,
          });
        });
      }
    }

    return pts;
  }, [stockData, predictions, activeModel, isForecastVisible]);

  const historyPoints = chartData.filter(d => !d.isForecast);
  const isPositive = historyPoints.length >= 2
    ? historyPoints[historyPoints.length - 1].close >= historyPoints[0].close
    : (stockData?.change_pct ?? changePct) >= 0;
  const lineColor = isPositive ? '#00D09C' : '#EB5B3C';
  const currSym = stockData?.currency_symbol || currencySymbol;

  // Factor events indexed by date for reference dots
  const factorsByDate = useMemo(() => {
    const map: Record<string, DetectedFactorEvent[]> = {};
    factors.forEach(f => {
      if (!map[f.date]) map[f.date] = [];
      map[f.date].push(f);
    });
    return map;
  }, [factors]);
  const markerDates = Object.keys(factorsByDate);

  return (
    <div className="space-y-3">
      {/* Header controls: Range + ML Model Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Timeframe buttons */}
        <div className="flex gap-1 bg-[#F4F4F7] p-1 rounded-xl">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: range === r.value ? '#FFFFFF' : 'transparent',
                color: range === r.value ? '#44475B' : '#7C7E8C',
                boxShadow: range === r.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* ML Forecast Selector & Toggle */}
        {showMLOverlay && (
          <div className="flex items-center gap-1.5 bg-[#EBFCF7] p-1 rounded-xl border border-[#00D09C]/20 text-xs font-semibold">
            <button
              onClick={() => setIsForecastVisible(!isForecastVisible)}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-[#00D09C] flex items-center gap-1 hover:bg-[#00D09C]/10 transition-colors"
              title="Toggle Forecast Overlay"
            >
              {isForecastVisible ? <Eye size={12} /> : <EyeOff size={12} />}
              <span className="font-mono uppercase">AI Forecast:</span>
            </button>

            {(['xgboost', 'arima', 'prophet', 'lstm'] as const).map(m => {
              const fc = predictions?.[m];
              const disabled = !fc || fc.error || !fc.forecast?.length;
              return (
                <button
                  key={m}
                  disabled={disabled}
                  onClick={() => {
                    setActiveModel(m);
                    setIsForecastVisible(true);
                  }}
                  className="px-2.5 py-1 rounded-lg transition-all font-mono uppercase text-[11px]"
                  style={{
                    background: activeModel === m && isForecastVisible ? '#00D09C' : 'transparent',
                    color: activeModel === m && isForecastVisible ? '#FFFFFF' : disabled ? '#9B9EA7' : '#00D09C',
                    fontWeight: activeModel === m && isForecastVisible ? 700 : 500,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {m === 'xgboost' ? '⭐ XGBoost' : m}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Direction & Backtest Accuracy Signal */}
      {predictions?.direction && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#F9FAFB] border border-[#EAECEF] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#7C7E8C] font-semibold font-mono text-[11px]">AI SIGNAL:</span>
            <span
              className="px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 text-[11px]"
              style={{
                background: predictions.direction.direction === 'up' ? '#EBFCF7' : '#FEF2F2',
                color: predictions.direction.direction === 'up' ? '#00D09C' : '#EB5B3C',
              }}
            >
              {predictions.direction.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {predictions.direction.direction === 'up' ? '▲ WILL GO UP' : '▼ WILL GO DOWN'} ({(predictions.direction.confidence * 100).toFixed(0)}% Confidence)
            </span>
          </div>

          {predictions.direction.backtest_accuracy != null && (
            <span className="text-[#7C7E8C] font-mono text-[11px]">
              Backtest Accuracy: <b className="text-[#44475B]">{(predictions.direction.backtest_accuracy * 100).toFixed(1)}%</b>
            </span>
          )}
        </div>
      )}

      {/* Main Chart Canvas */}
      <div style={{ height, position: 'relative' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-2xl">
            <div className="text-sm font-semibold text-[#7C7E8C] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse" />
              Loading real market data & ML models...
            </div>
          </div>
        )}

        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id={`grad-${symbol}-${range}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F2" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9B9EA7', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#F0F0F2' }}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#9B9EA7', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${currSym}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                width={70}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const p = payload[0].payload;
                  const isFc = p.isForecast && !p.isBridge;
                  return (
                    <div className="px-3.5 py-2.5 rounded-xl shadow-xl text-xs bg-white border border-[#EAECEF] space-y-1">
                      <div className="font-bold text-sm text-[#44475B]">
                        {currSym}{(p.close ?? p.predicted)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[#9B9EA7] font-mono">{p.date}</div>
                      {isFc && (
                        <div className="text-[11px] font-semibold text-[#F59E0B] pt-1 border-t border-[#EAECEF]">
                          {activeModel.toUpperCase()} Forecast · Band: {currSym}{p.lower?.toFixed(2)} – {currSym}{p.upper?.toFixed(2)}
                        </div>
                      )}
                      {p.volume > 0 && (
                        <div className="text-[#7C7E8C]">
                          Volume: {(p.volume / 1e6).toFixed(2)}M
                        </div>
                      )}
                    </div>
                  );
                }}
              />

              {/* Confidence Interval Band */}
              {isForecastVisible && (
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="#00D09C"
                  fillOpacity={0.10}
                  name="Confidence Band"
                />
              )}

              {/* Historical Close Price Area */}
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2.2}
                fill={`url(#grad-${symbol}-${range})`}
                dot={false}
                name="Close Price"
                connectNulls={false}
                activeDot={{ r: 4, stroke: lineColor, strokeWidth: 2, fill: '#fff' }}
              />

              {/* ML Predicted Forecast Line */}
              {isForecastVisible && (
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#F59E0B"
                  strokeWidth={2.2}
                  strokeDasharray="5 3"
                  dot={false}
                  name={`${activeModel.toUpperCase()} Forecast`}
                  connectNulls
                />
              )}

              {/* Factor event reference dots on historical chart */}
              {markerDates.map((date) => {
                const pt = chartData.find(d => d.date === date);
                if (!pt || !pt.close) return null;
                const worst = factorsByDate[date].reduce((a, b) => (a.impact === 'high' ? a : b));
                const dotColor = IMPACT_COLOR[worst.impact] || '#5367FF';
                return (
                  <ReferenceDot
                    key={date}
                    x={date}
                    y={pt.close}
                    r={5}
                    fill={dotColor}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    onClick={() => onFactorClick && onFactorClick(worst)}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Volume Histogram */}
      {chartData.length > 0 && chartData.some(d => d.volume > 0 && !d.isForecast) && (
        <div style={{ height: 42 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.filter(d => !d.isForecast)} margin={{ top: 0, right: 15, left: 5, bottom: 0 }}>
              <Bar dataKey="volume" fill="#EAECEF" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
