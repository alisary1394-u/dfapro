import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Area, AreaChart, BarChart, Cell
} from "recharts";
import {
  TrendingUp, TrendingDown, Settings, Eye, EyeOff, ZoomIn, Maximize2
} from "lucide-react";
import {
  calcOBV, calcAD, calcMFI, calcCMF, calcVSA,
  OBVChart, ADChart, MFIChart, CMFChart, VSAVolumeChart, LiquidityFlowChart
} from "./SmartIndicators";

// ===== DATA GENERATORS =====
const generateOHLC = (count, basePrice, volatility = 1) => {
  let price = basePrice;
  const data = [];
  const now = new Date();

  for (let i = count; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.49) * volatility * price * 0.02;
    const close = parseFloat((open + change).toFixed(2));
    const high = parseFloat((Math.max(open, close) + Math.random() * volatility * price * 0.01).toFixed(2));
    const low = parseFloat((Math.min(open, close) - Math.random() * volatility * price * 0.01).toFixed(2));
    const volume = Math.floor(Math.random() * 5000000 + 500000);
    price = close;

    const d = new Date(now);
    d.setDate(d.getDate() - i);

    data.push({
      time: d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
      open, high, low, close, volume,
      isBull: close >= open,
    });
  }
  return data;
};

const generateMinute = (count, basePrice) => {
  let price = basePrice;
  const data = [];
  const now = new Date();

  for (let i = count; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.49) * price * 0.003;
    const close = parseFloat((open + change).toFixed(2));
    const high = parseFloat((Math.max(open, close) + Math.random() * price * 0.001).toFixed(2));
    const low = parseFloat((Math.min(open, close) - Math.random() * price * 0.001).toFixed(2));
    const volume = Math.floor(Math.random() * 200000 + 50000);
    price = close;

    const d = new Date(now);
    d.setMinutes(d.getMinutes() - i);

    data.push({
      time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`,
      open, high, low, close, volume,
      isBull: close >= open,
    });
  }
  return data;
};

// ===== INDICATORS =====
const calcSMA = (data, period, key = 'close') => {
  return data.map((d, i) => {
    if (i < period - 1) return { ...d, [`sma${period}`]: null };
    const sum = data.slice(i - period + 1, i + 1).reduce((s, x) => s + x[key], 0);
    return { ...d, [`sma${period}`]: parseFloat((sum / period).toFixed(2)) };
  });
};

const calcEMA = (data, period, key = 'close') => {
  const k = 2 / (period + 1);
  let ema = data[0]?.[key] || 0;
  return data.map((d, i) => {
    if (i === 0) { ema = d[key]; return { ...d, [`ema${period}`]: ema }; }
    ema = d[key] * k + ema * (1 - k);
    return { ...d, [`ema${period}`]: parseFloat(ema.toFixed(2)) };
  });
};

const calcRSI = (data, period = 14) => {
  const rsiData = [...data];
  for (let i = 0; i < rsiData.length; i++) {
    if (i < period) { rsiData[i].rsi = null; continue; }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = rsiData[j].close - rsiData[j - 1]?.close || 0;
      if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiData[i].rsi = parseFloat((100 - 100 / (1 + rs)).toFixed(1));
  }
  return rsiData;
};

const calcMACD = (data) => {
  const ema12Data = calcEMA(data, 12);
  const ema26Data = calcEMA(data, 26);
  return data.map((d, i) => ({
    ...d,
    macd: ema12Data[i].ema12 && ema26Data[i].ema26
      ? parseFloat((ema12Data[i].ema12 - ema26Data[i].ema26).toFixed(2))
      : null,
    signal: null,
    histogram: null,
  }));
};

const calcBollinger = (data, period = 20, stdDev = 2) => {
  return data.map((d, i) => {
    if (i < period - 1) return { ...d, bb_upper: null, bb_mid: null, bb_lower: null };
    const slice = data.slice(i - period + 1, i + 1).map(x => x.close);
    const mean = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    return {
      ...d,
      bb_upper: parseFloat((mean + stdDev * std).toFixed(2)),
      bb_mid: parseFloat(mean.toFixed(2)),
      bb_lower: parseFloat((mean - stdDev * std).toFixed(2)),
    };
  });
};

const calcStochastic = (data, period = 14) => {
  return data.map((d, i) => {
    if (i < period - 1) return { ...d, stoch_k: null, stoch_d: null };
    const slice = data.slice(i - period + 1, i + 1);
    const highest = Math.max(...slice.map(x => x.high));
    const lowest = Math.min(...slice.map(x => x.low));
    const k = lowest === highest ? 50 : parseFloat(((d.close - lowest) / (highest - lowest) * 100).toFixed(1));
    return { ...d, stoch_k: k, stoch_d: null };
  });
};

// ===== CUSTOM CANDLE COMPONENT =====
const CandlestickBar = (props) => {
  const { x, y, width, height, open, high, low, close, isBull, chartHeight, yMin, yRange } = props;
  if (!x || !y || !width) return null;

  const color = isBull ? "#10b981" : "#ef4444";
  const wickX = x + width / 2;

  const toY = (price) => {
    if (!yRange || !chartHeight) return 0;
    return chartHeight - ((price - yMin) / yRange) * chartHeight;
  };

  const bodyTop = toY(Math.max(open, close));
  const bodyBottom = toY(Math.min(open, close));
  const wickTop = toY(high);
  const wickBottom = toY(low);
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);

  return (
    <g>
      <line x1={wickX} y1={wickTop} x2={wickX} y2={wickBottom} stroke={color} strokeWidth={1} />
      <rect x={x + 1} y={bodyTop} width={Math.max(1, width - 2)} height={bodyHeight} fill={color} fillOpacity={0.9} rx={1} />
    </g>
  );
};

// ===== CUSTOM TOOLTIP =====
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-[#94a3b8] mb-2 font-medium">{label}</p>
      {d?.open !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-[#64748b]">فتح:</span>
            <span className="text-white font-semibold">{d.open}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748b]">أعلى:</span>
            <span className="text-emerald-400 font-semibold">{d.high}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748b]">أقل:</span>
            <span className="text-red-400 font-semibold">{d.low}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748b]">إغلاق:</span>
            <span className={`font-bold ${d.close >= d.open ? 'text-emerald-400' : 'text-red-400'}`}>{d.close}</span>
          </div>
          <div className="flex justify-between gap-4 pt-1 border-t border-[#1e293b]">
            <span className="text-[#64748b]">حجم:</span>
            <span className="text-[#d4a843] font-semibold">{d.volume?.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== BUY/SELL ZONES =====
const BuySellZones = ({ data, support, resistance }) => {
  const prices = data.map(d => d.close).filter(Boolean);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const mid = (minPrice + maxPrice) / 2;

  return {
    buyZoneY: support || minPrice * 1.01,
    sellZoneY: resistance || maxPrice * 0.99,
  };
};

// ===== TIMEFRAMES =====
const TIMEFRAMES = [
  { key: "1m", label: "1د" },
  { key: "5m", label: "5د" },
  { key: "15m", label: "15د" },
  { key: "30m", label: "30د" },
  { key: "1H", label: "1س" },
  { key: "4H", label: "4س" },
  { key: "1D", label: "يومي" },
  { key: "1W", label: "أسبوعي" },
  { key: "1M", label: "شهري" },
];

const CHART_TYPES = [
  { key: "candle", label: "شموع" },
  { key: "area", label: "منطقة" },
  { key: "line", label: "خط" },
  { key: "bar", label: "أعمدة" },
];

const INDICATORS_LIST = [
  { key: "sma20", label: "SMA 20", color: "#3b82f6" },
  { key: "sma50", label: "SMA 50", color: "#8b5cf6" },
  { key: "ema20", label: "EMA 20", color: "#06b6d4" },
  { key: "bb", label: "Bollinger Bands", color: "#d4a843" },
];

const SUB_INDICATORS = [
  { key: "rsi", label: "RSI" },
  { key: "macd", label: "MACD" },
  { key: "volume", label: "الحجم" },
  { key: "stoch", label: "Stochastic" },
  { key: "obv", label: "OBV" },
  { key: "ad", label: "A/D" },
  { key: "mfi", label: "MFI" },
  { key: "cmf", label: "CMF" },
  { key: "vsa", label: "VSA" },
  { key: "liq", label: "السيولة" },
];

export default function AdvancedChart({ symbol, market, support, resistance, basePrice = 120 }) {
  const [timeframe, setTimeframe] = useState("1D");
  const [chartType, setChartType] = useState("candle");
  const [activeIndicators, setActiveIndicators] = useState(["sma20", "bb"]);
  const [activeSubIndicator, setActiveSubIndicator] = useState("rsi");
  const [showBuySell, setShowBuySell] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const rawData = useMemo(() => {
    const isIntraday = ["1m", "5m", "15m", "30m", "1H", "4H"].includes(timeframe);
    const count = isIntraday ? 120 : timeframe === "1W" ? 52 : timeframe === "1M" ? 24 : 90;
    const vol = timeframe === "1M" ? 3 : timeframe === "1W" ? 2 : 1;
    if (isIntraday) return generateMinute(count, basePrice);
    return generateOHLC(count, basePrice, vol);
  }, [timeframe, symbol, basePrice]);

  const chartData = useMemo(() => {
    let data = rawData;
    if (activeIndicators.includes("sma20")) data = calcSMA(data, 20);
    if (activeIndicators.includes("sma50")) data = calcSMA(data, 50);
    if (activeIndicators.includes("ema20")) data = calcEMA(data, 20);
    if (activeIndicators.includes("bb")) data = calcBollinger(data);
    data = calcRSI(data);
    data = calcMACD(data);
    data = calcStochastic(data);
    return data;
  }, [rawData, activeIndicators]);

  const prices = chartData.map(d => d.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  const buyZone = support || minPrice * 0.99;
  const sellZone = resistance || maxPrice * 1.01;
  
  const minP = Math.min(minPrice, buyZone) * 0.99;
  const maxP = Math.max(maxPrice, sellZone) * 1.01;
  const priceRange = maxP - minP;

  const lastPrice = chartData[chartData.length - 1]?.close;
  const firstPrice = chartData[0]?.close;
  const priceChange = lastPrice && firstPrice ? ((lastPrice - firstPrice) / firstPrice * 100) : 0;
  const isPositive = priceChange >= 0;

  const toggleIndicator = (key) => {
    setActiveIndicators(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const rsiData = chartData.filter(d => d.rsi !== null);
  const currentRSI = chartData[chartData.length - 1]?.rsi;
  const rsiSignal = currentRSI > 70 ? { text: "تشبع شرائي - انتبه", color: "text-red-400" }
    : currentRSI < 30 ? { text: "تشبع بيعي - فرصة", color: "text-emerald-400" }
    : { text: "منطقة محايدة", color: "text-[#d4a843]" };

  return (
    <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl overflow-hidden">
      {/* Chart Header */}
      <div className="border-b border-[#1e293b] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-lg font-bold text-white">{symbol}</span>
              <span className={`mr-3 text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {lastPrice?.toFixed(2)} {isPositive ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex gap-0.5 bg-[#151c2c] rounded-lg p-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  onClick={() => setTimeframe(tf.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    timeframe === tf.key
                      ? 'bg-[#d4a843] text-black'
                      : 'text-[#94a3b8] hover:text-white hover:bg-[#1e293b]'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Type & Indicators */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="flex gap-0.5 bg-[#151c2c] rounded-lg p-1">
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.key}
                onClick={() => setChartType(ct.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  chartType === ct.key ? 'bg-[#1e293b] text-[#d4a843]' : 'text-[#64748b] hover:text-white'
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {INDICATORS_LIST.map((ind) => (
              <button
                key={ind.key}
                onClick={() => toggleIndicator(ind.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                  activeIndicators.includes(ind.key)
                    ? 'border-opacity-50 text-white'
                    : 'border-[#1e293b] text-[#64748b] hover:text-white'
                }`}
                style={activeIndicators.includes(ind.key) ? {
                  borderColor: ind.color + '80',
                  backgroundColor: ind.color + '15',
                  color: ind.color
                } : {}}
              >
                {ind.label}
              </button>
            ))}

            <button
              onClick={() => setShowBuySell(!showBuySell)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                showBuySell
                  ? 'border-[#10b981]/50 bg-[#10b981]/10 text-[#10b981]'
                  : 'border-[#1e293b] text-[#64748b] hover:text-white'
              }`}
            >
              مناطق الشراء/البيع
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="p-4">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "area" ? (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[minP, maxP]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip content={<CustomTooltip />} />
                {showBuySell && (
                  <>
                    <ReferenceLine y={buyZone} stroke="#10b981" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "🟢 شراء", fill: '#10b981', fontSize: 10 }} />
                    <ReferenceLine y={sellZone} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "🔴 بيع", fill: '#ef4444', fontSize: 10 }} />
                  </>
                )}
                {activeIndicators.includes("sma20") && <Line type="monotone" dataKey="sma20" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="SMA 20" />}
                {activeIndicators.includes("sma50") && <Line type="monotone" dataKey="sma50" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="SMA 50" />}
                {activeIndicators.includes("ema20") && <Line type="monotone" dataKey="ema20" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="EMA 20" />}
                {activeIndicators.includes("bb") && (
                  <>
                    <Line type="monotone" dataKey="bb_upper" stroke="#d4a843" strokeWidth={1} strokeDasharray="4 2" dot={false} name="BB Upper" />
                    <Line type="monotone" dataKey="bb_lower" stroke="#d4a843" strokeWidth={1} strokeDasharray="4 2" dot={false} name="BB Lower" />
                  </>
                )}
                <Area type="monotone" dataKey="close" stroke={isPositive ? "#10b981" : "#ef4444"} strokeWidth={2} fill="url(#chartGrad)" name="السعر" />
              </AreaChart>
            ) : chartType === "candle" || chartType === "bar" ? (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[minP, maxP]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip content={<CustomTooltip />} />
                {showBuySell && (
                   <>
                     <ReferenceLine y={buyZone} stroke="#10b981" strokeDasharray="6 3" strokeWidth={2} label={{ value: "🟢 شراء", fill: '#10b981', fontSize: 11, fontWeight: 'bold', position: 'right', offset: 10 }} />
                     <ReferenceLine y={sellZone} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={2} label={{ value: "🔴 بيع", fill: '#ef4444', fontSize: 11, fontWeight: 'bold', position: 'right', offset: 10 }} />
                   </>
                )}
                {activeIndicators.includes("sma20") && <Line type="monotone" dataKey="sma20" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="SMA 20" />}
                {activeIndicators.includes("sma50") && <Line type="monotone" dataKey="sma50" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="SMA 50" />}
                {activeIndicators.includes("ema20") && <Line type="monotone" dataKey="ema20" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="EMA 20" />}
                {activeIndicators.includes("bb") && (
                  <>
                    <Line type="monotone" dataKey="bb_upper" stroke="#d4a843" strokeWidth={1} strokeDasharray="4 2" dot={false} name="BB Upper" />
                    <Line type="monotone" dataKey="bb_lower" stroke="#d4a843" strokeWidth={1} strokeDasharray="4 2" dot={false} name="BB Lower" />
                  </>
                )}
                <Bar dataKey="close" shape={(props) => {
                   const { x, y, width, height, payload } = props;
                   if (!x || !y || !width) return null;

                   const color = payload?.isBull ? "#10b981" : "#ef4444";
                   const wickX = x + width / 2;
                   const closePrice = payload?.close;
                   const openPrice = payload?.open;
                   const highPrice = payload?.high;
                   const lowPrice = payload?.low;

                   const prices = chartData.map(d => d.close);
                   const minPrice = Math.min(...prices);
                   const maxPrice = Math.max(...prices);
                   const range = maxPrice - minPrice;

                   const toY = (price) => y + height - ((price - minPrice) / range) * height;

                   const bodyTop = toY(Math.max(openPrice, closePrice));
                   const bodyBottom = toY(Math.min(openPrice, closePrice));
                   const wickTop = toY(highPrice);
                   const wickBottom = toY(lowPrice);
                   const bodyHeight = Math.max(1, bodyBottom - bodyTop);

                   return (
                     <g key={`candle-${x}`}>
                       <line x1={wickX} y1={wickTop} x2={wickX} y2={wickBottom} stroke={color} strokeWidth={1} />
                       <rect x={x + 1} y={bodyTop} width={Math.max(1, width - 2)} height={bodyHeight} fill={color} fillOpacity={0.9} rx={1} />
                     </g>
                   );
                 }} />
              </ComposedChart>
            ) : (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[minP, maxP]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip content={<CustomTooltip />} />
                {showBuySell && (
                  <>
                    <ReferenceLine y={buyZone} stroke="#10b981" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "شراء", fill: '#10b981', fontSize: 10 }} />
                    <ReferenceLine y={sellZone} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "بيع", fill: '#ef4444', fontSize: 10 }} />
                  </>
                )}
                {activeIndicators.includes("sma20") && <Line type="monotone" dataKey="sma20" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="SMA 20" />}
                {activeIndicators.includes("sma50") && <Line type="monotone" dataKey="sma50" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="SMA 50" />}
                {activeIndicators.includes("ema20") && <Line type="monotone" dataKey="ema20" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="EMA 20" />}
                {activeIndicators.includes("bb") && (
                  <>
                    <Line type="monotone" dataKey="bb_upper" stroke="#d4a843" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                    <Line type="monotone" dataKey="bb_lower" stroke="#d4a843" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                  </>
                )}
                <Line type="monotone" dataKey="close" stroke={isPositive ? "#10b981" : "#ef4444"} strokeWidth={2} dot={false} name="السعر" />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Sub Indicators Tabs */}
        <div className="flex gap-1 mt-4 bg-[#0a0e17] rounded-lg p-1 w-fit">
          {SUB_INDICATORS.map((si) => (
            <button
              key={si.key}
              onClick={() => setActiveSubIndicator(si.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeSubIndicator === si.key
                  ? 'bg-[#1e293b] text-[#d4a843]'
                  : 'text-[#64748b] hover:text-white'
              }`}
            >
              {si.label}
            </button>
          ))}
        </div>

        {/* Sub Chart */}
        <div className="h-28 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            {activeSubIndicator === "rsi" ? (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
                <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} />
                <ReferenceLine y={50} stroke="#475569" strokeDasharray="2 2" strokeWidth={1} />
                <Line type="monotone" dataKey="rsi" stroke="#d4a843" strokeWidth={2} dot={false} name="RSI" />
              </ComposedChart>
            ) : activeSubIndicator === "macd" ? (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                <Bar dataKey="macd" fill="#3b82f6" fillOpacity={0.6} name="MACD" radius={[2, 2, 0, 0]} />
              </ComposedChart>
            ) : activeSubIndicator === "stoch" ? (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
                <ReferenceLine y={20} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} />
                <Line type="monotone" dataKey="stoch_k" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Stoch %K" />
              </ComposedChart>
            ) : activeSubIndicator === "obv" ? (
              <OBVChart data={chartData} />
            ) : activeSubIndicator === "ad" ? (
              <ADChart data={chartData} />
            ) : activeSubIndicator === "mfi" ? (
              <MFIChart data={chartData} />
            ) : activeSubIndicator === "cmf" ? (
              <CMFChart data={chartData} />
            ) : activeSubIndicator === "vsa" ? (
              <VSAVolumeChart data={chartData} />
            ) : activeSubIndicator === "liq" ? (
              <LiquidityFlowChart data={chartData} />
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }} formatter={(v) => [v.toLocaleString(), 'الحجم']} />
                <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.isBull ? "#10b981" : "#ef4444"} fillOpacity={0.6} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Buy/Sell Signals Summary */}
        {showBuySell && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
              <p className="text-xs text-[#64748b] mb-1">منطقة الشراء</p>
              <p className="text-sm font-bold text-emerald-400">{buyZone.toFixed(2)}</p>
              <p className="text-xs text-[#64748b] mt-1">دعم قوي</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
              <p className="text-xs text-[#64748b] mb-1">منطقة البيع</p>
              <p className="text-sm font-bold text-red-400">{sellZone.toFixed(2)}</p>
              <p className="text-xs text-[#64748b] mt-1">مقاومة قوية</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-3">
              <p className="text-xs text-[#64748b] mb-1">RSI الحالي</p>
              <p className={`text-sm font-bold ${rsiSignal.color}`}>{currentRSI?.toFixed(0)}</p>
              <p className={`text-xs mt-1 ${rsiSignal.color}`}>{rsiSignal.text}</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-3">
              <p className="text-xs text-[#64748b] mb-1">إشارة الاتجاه</p>
              <p className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? '▲ صاعد' : '▼ هابط'}
              </p>
              <p className="text-xs text-[#64748b] mt-1">{Math.abs(priceChange).toFixed(2)}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}