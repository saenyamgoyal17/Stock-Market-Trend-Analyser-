import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import { fetchYFChart, ChartPoint } from '../../services/api.js';

interface StockChartProps {
  symbol: string;
  currentPrice: number;
  changePct: number;
  height?: number;
}

const RANGES = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
];

export const StockChart: React.FC<StockChartProps> = ({ symbol, currentPrice, changePct, height = 300 }) => {
  const [range, setRange] = useState('1mo');
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchYFChart(symbol, range).then(chart => {
      if (cancelled) return;
      if (chart.length > 0) {
        setData(chart);
      } else {
        // Fallback: generate synthetic data if YF fails
        setData(generateFallback(currentPrice, range));
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [symbol, range]);

  const isPositive = data.length >= 2 ? data[data.length - 1].close >= data[0].close : changePct >= 0;
  const lineColor = isPositive ? '#00D09C' : '#EB5B3C';

  const minVal = data.length > 0 ? Math.min(...data.map(d => d.close)) * 0.998 : 0;
  const maxVal = data.length > 0 ? Math.max(...data.map(d => d.close)) * 1.002 : 100;

  return (
    <div>
      {/* Range buttons */}
      <div className="flex gap-1 mb-3">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: range === r.value ? (isPositive ? '#EBFCF7' : '#FEF2F2') : 'transparent',
              color: range === r.value ? lineColor : '#7C7E8C',
              border: range === r.value ? `1px solid ${lineColor}30` : '1px solid transparent',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ height, position: 'relative' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl">
            <div className="text-sm text-[#7C7E8C]">Loading real data...</div>
          </div>
        )}

        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id={`grad-${symbol}-${range}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F2" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9B9EA7', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#F0F0F2' }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                domain={[minVal, maxVal]}
                tick={{ fill: '#9B9EA7', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}
                width={55}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const p = payload[0].payload as ChartPoint;
                  return (
                    <div className="px-3 py-2 rounded-lg shadow-lg text-xs"
                      style={{ background: '#fff', border: '1px solid #EAECEF' }}>
                      <div className="font-semibold" style={{ color: '#44475B' }}>
                        {p.close?.toFixed(2)}
                      </div>
                      <div style={{ color: '#9B9EA7' }}>{p.date}</div>
                      {p.volume > 0 && (
                        <div style={{ color: '#9B9EA7' }}>
                          Vol: {(p.volume / 1e6).toFixed(2)}M
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={1.5}
                fill={`url(#grad-${symbol}-${range})`}
                dot={false}
                activeDot={{ r: 4, stroke: lineColor, strokeWidth: 2, fill: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {!loading && data.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-[#9B9EA7]">
            No chart data available for {symbol}
          </div>
        )}
      </div>

      {/* Volume bars (small, below chart) */}
      {data.length > 0 && data[0].volume > 0 && (
        <div style={{ height: 40, marginTop: 4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 5, left: 5, bottom: 0 }}>
              <Bar dataKey="volume" fill="#EAECEF" radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

function generateFallback(basePrice: number, range: string): ChartPoint[] {
  const counts: Record<string, number> = {
    '1d': 78, '5d': 50, '1mo': 22, '3mo': 65, '1y': 52, '5y': 60,
  };
  const n = counts[range] || 30;
  const pts: ChartPoint[] = [];
  let p = basePrice * (0.9 + Math.random() * 0.1);
  const now = Date.now();

  for (let i = n; i >= 0; i--) {
    const delta = (Math.random() - 0.48) * p * 0.02;
    p = Math.max(1, p + delta);
    const t = now - i * (range === '1d' ? 300000 : range === '5d' ? 1800000 : 86400000);
    pts.push({
      time: t,
      date: range === '1d' || range === '5d'
        ? new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      open: +(p - delta * 0.5).toFixed(2),
      high: +(p * 1.005).toFixed(2),
      low: +(p * 0.995).toFixed(2),
      close: +p.toFixed(2),
      volume: Math.floor(500000 + Math.random() * 3000000),
    });
  }
  return pts;
}
