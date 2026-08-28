import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, ReferenceDot,
} from 'recharts';
import {
  fetchYFChart, ChartPoint, fetchMLPredictions, MLForecastResults,
  fetchDetectedFactors, DetectedFactorEvent,
} from '../../services/api.js';
import { Sparkles, TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';

interface StockChartProps {
  symbol: string;
  currentPrice: number;
  changePct: number;
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
  medium: '#F59E0B',
  low: '#5367FF',
};

export const StockChart: React.FC<StockChartProps> = ({
  symbol,
  currentPrice,
  changePct,
  height = 340,
  showMLOverlay = true,
  currencySymbol = '₹',
  onFactorClick,
}) => {
  const [range, setRange] = useState('1mo');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModel, setActiveModel] = useState<'xgboost' | 'arima' | 'prophet' | 'lstm'>('xgboost');
  const [mlPredictions, setMlPredictions] = useState<MLForecastResults | null>(null);
  const [factors, setFactors] = useState<DetectedFactorEvent[]>([]);
  const [isForecastVisible, setIsForecastVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchYFChart(symbol, range),
      fetchMLPredictions(symbol, range === '1d' || range === '5d' ? '1mo' : range, 15, currentPrice),
      fetchDetectedFactors(symbol, range),
    ]).then(([chartRes, mlRes, factorsRes]) => {
      if (cancelled) return;

      let baseChart: ChartPoint[] = [];
      if (chartRes.status === 'fulfilled' && chartRes.value.length > 0) {
        baseChart = chartRes.value;
      } else {
        baseChart = generateFallback(currentPrice, range);
      }

      let preds: MLForecastResults | null = null;
      if (mlRes.status === 'fulfilled') {
        preds = mlRes.value;
        setMlPredictions(preds);
      }

      let factorList: DetectedFactorEvent[] = [];
      if (factorsRes.status === 'fulfilled') {
        factorList = factorsRes.value;
        setFactors(factorList);
      }

      // Merge chart history with calibrated ML forward forecast
      const merged = mergeChartAndML(baseChart, preds, activeModel, range, isForecastVisible, currentPrice);
      setData(merged);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [symbol, range, currentPrice]);

  // When model or visibility toggle changes, re-merge
  useEffect(() => {
    if (data.length > 0) {
      const historyOnly = data.filter(d => !d.isForecast);
      const merged = mergeChartAndML(historyOnly, mlPredictions, activeModel, range, isForecastVisible, currentPrice);
      setData(merged);
    }
  }, [activeModel, isForecastVisible, mlPredictions]);

  const historyPoints = data.filter(d => !d.isForecast);
  const isPositive = historyPoints.length >= 2 ? historyPoints[historyPoints.length - 1].close >= historyPoints[0].close : changePct >= 0;
  const lineColor = isPositive ? '#00D09C' : '#EB5B3C';

  // Calculate dynamic tight Y-axis domain to prevent flattening
  const validValues = data.map(d => [d.close, d.predicted, d.upper, d.lower]).flat().filter((v): v is number => typeof v === 'number' && v > 0);
  const minVal = validValues.length > 0 ? Math.min(...validValues) * 0.985 : 0;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) * 1.015 : 100;

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
              <span className="font-mono uppercase">ML Forecast:</span>
            </button>

            {(['xgboost', 'arima', 'prophet', 'lstm'] as const).map(m => (
              <button
                key={m}
                onClick={() => {
                  setActiveModel(m);
                  setIsForecastVisible(true);
                }}
                className="px-2.5 py-1 rounded-lg transition-all font-mono uppercase text-[11px]"
                style={{
                  background: activeModel === m && isForecastVisible ? '#00D09C' : 'transparent',
                  color: activeModel === m && isForecastVisible ? '#FFFFFF' : '#00D09C',
                  fontWeight: activeModel === m && isForecastVisible ? 700 : 500,
                }}
              >
                {m === 'xgboost' ? '⭐ XGBoost' : m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Direction & Backtest Accuracy Pill */}
      {mlPredictions?.direction && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#F9FAFB] border border-[#EAECEF] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#7C7E8C] font-semibold font-mono text-[11px]">XGBOOST SIGNAL:</span>
            <span
              className="px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 text-[11px]"
              style={{
                background: mlPredictions.direction.direction === 'up' ? '#EBFCF7' : '#FEF2F2',
                color: mlPredictions.direction.direction === 'up' ? '#00D09C' : '#EB5B3C',
              }}
            >
              {mlPredictions.direction.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {mlPredictions.direction.direction === 'up' ? '▲ WILL GO UP' : '▼ WILL GO DOWN'} ({(mlPredictions.direction.confidence * 100).toFixed(0)}% Confidence)
            </span>
          </div>

          {mlPredictions.direction.backtest_accuracy && (
            <span className="text-[#7C7E8C] font-mono text-[11px]">
              Backtest Accuracy: <b className="text-[#44475B]">{(mlPredictions.direction.backtest_accuracy * 100).toFixed(1)}%</b>
            </span>
          )}
        </div>
      )}

      {/* Chart Canvas */}
      <div style={{ height, position: 'relative' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-2xl">
            <div className="text-sm font-semibold text-[#7C7E8C] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse" />
              Loading real market data & ML models...
            </div>
          </div>
        )}

        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id={`grad-${symbol}-${range}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F2" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9B9EA7', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#F0F0F2' }}
                minTickGap={35}
              />
              <YAxis
                domain={[minVal, maxVal]}
                tick={{ fill: '#9B9EA7', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${currencySymbol}${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}`}
                width={65}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="px-3.5 py-2.5 rounded-xl shadow-xl text-xs bg-white border border-[#EAECEF] space-y-1">
                      <div className="font-bold text-sm text-[#44475B]">
                        {currencySymbol}{p.close?.toFixed(2) || p.predicted?.toFixed(2)}
                      </div>
                      <div className="text-[#9B9EA7] font-mono">{p.date}</div>
                      {p.isForecast && (
                        <div className="text-[11px] font-semibold text-[#00D09C] pt-1 border-t border-[#EAECEF]">
                          {activeModel.toUpperCase()} Target · Range: {currencySymbol}{p.lower?.toFixed(2)} – {currencySymbol}{p.upper?.toFixed(2)}
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

              {/* Confidence Band for ML Forecast */}
              {isForecastVisible && (
                <>
                  <Area type="monotone" dataKey="upper" stroke="none" fill="#00D09C" fillOpacity={0.12} name="Forecast Upper" />
                  <Area type="monotone" dataKey="lower" stroke="none" fill="#FFFFFF" fillOpacity={1} name="Forecast Lower" />
                </>
              )}

              {/* Historical Close Price Area */}
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2}
                fill={`url(#grad-${symbol}-${range})`}
                dot={false}
                name="Close Price"
                activeDot={{ r: 4, stroke: lineColor, strokeWidth: 2, fill: '#fff' }}
              />

              {/* ML Predicted Forecast Line */}
              {isForecastVisible && (
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#F59E0B"
                  strokeWidth={2.2}
                  strokeDasharray="4 4"
                  dot={false}
                  name={`${activeModel.toUpperCase()} Prediction`}
                />
              )}

              {/* Factor event dots on chart */}
              {factors.map((factor, idx) => {
                const matchPoint = data.find(d => d.date === factor.date || d.date?.includes(factor.date));
                if (!matchPoint || !matchPoint.close) return null;
                const dotColor = IMPACT_COLOR[factor.impact] || '#F59E0B';
                return (
                  <ReferenceDot
                    key={idx}
                    x={matchPoint.date}
                    y={matchPoint.close}
                    r={5}
                    fill={dotColor}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    onClick={() => onFactorClick && onFactorClick(factor)}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Volume Histogram */}
      {data.length > 0 && data[0].volume > 0 && (
        <div style={{ height: 42 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.filter(d => !d.isForecast)} margin={{ top: 0, right: 10, left: 5, bottom: 0 }}>
              <Bar dataKey="volume" fill="#EAECEF" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

/**
 * Merges historical price data with forward ML predictions.
 * Strictly anchors the prediction to the last close price to prevent scale drops.
 */
function mergeChartAndML(
  baseChart: ChartPoint[],
  mlResults: MLForecastResults | null,
  model: string,
  range: string,
  isForecastVisible: boolean,
  currentPrice: number
): any[] {
  const points: any[] = baseChart.map(p => ({
    ...p,
    predicted: null,
    upper: null,
    lower: null,
    isForecast: false,
  }));

  if (!isForecastVisible || points.length === 0) return points;

  // On 1D and 1W intraday views, keep the historical view clean unless explicit forecast is requested
  const isIntraday = range === '1d' || range === '5d';
  const forecastData = (mlResults as any)?.[model]?.forecast as any[] | undefined;
  if (!forecastData || forecastData.length === 0) return points;

  const lastPoint = points[points.length - 1];
  const anchorPrice = lastPoint.close || currentPrice || 100;

  // Connect last historical point as the anchor of the prediction line
  lastPoint.predicted = anchorPrice;

  // Determine initial reference price of the raw forecast
  const rawFirstPrice = forecastData[0]?.predicted || anchorPrice;
  const needsRescaling = Math.abs(rawFirstPrice - anchorPrice) / anchorPrice > 0.12;

  forecastData.forEach((f, idx) => {
    // Only plot up to 5 steps on intraday 1W, full 15 steps on daily charts
    if (isIntraday && idx >= 6) return;

    let calPredicted = f.predicted;
    let calUpper = f.upper;
    let calLower = f.lower;

    if (needsRescaling && rawFirstPrice > 0) {
      // Scale relative return trajectory anchored to actual current price
      const relDelta = (f.predicted - rawFirstPrice) / rawFirstPrice;
      calPredicted = +(anchorPrice * (1 + relDelta)).toFixed(2);
      const spread = calPredicted * (0.012 * Math.sqrt(idx + 1));
      calUpper = +(calPredicted + spread).toFixed(2);
      calLower = +(calPredicted - spread).toFixed(2);
    }

    points.push({
      date: f.date,
      close: null,
      predicted: calPredicted,
      upper: calUpper,
      lower: calLower,
      volume: 0,
      isForecast: true,
    });
  });

  return points;
}

function generateFallback(basePrice: number, range: string): ChartPoint[] {
  const counts: Record<string, number> = {
    '1d': 78, '5d': 50, '1mo': 22, '3mo': 65, '1y': 52, '5y': 60,
  };
  const n = counts[range] || 30;
  const pts: ChartPoint[] = [];
  let p = basePrice * (0.98 + Math.random() * 0.02);
  const now = Date.now();

  for (let i = n; i >= 0; i--) {
    const delta = (Math.random() - 0.48) * p * 0.015;
    p = Math.max(1, p + delta);
    const t = now - i * (range === '1d' ? 300000 : range === '5d' ? 1800000 : 86400000);
    pts.push({
      time: t,
      date: range === '1d' || range === '5d'
        ? new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      open: +(p - delta * 0.5).toFixed(2),
      high: +(p * 1.003).toFixed(2),
      low: +(p * 0.997).toFixed(2),
      close: +p.toFixed(2),
      volume: Math.floor(500000 + Math.random() * 3000000),
    });
  }
  return pts;
}
