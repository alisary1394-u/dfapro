import React, { useState, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar } from "recharts";
import { FlaskConical, AlertTriangle, CheckCircle2, XCircle, Activity, Loader2, ChevronDown, ChevronUp } from "lucide-react";

// ─── Generate historical OHLCV data ───────────────────────────────────────────
const generateHistoricalData = (bars, basePrice, volatility) => {
  let price = basePrice;
  return Array.from({ length: bars }, (_, i) => {
    const open = price;
    const change = (Math.random() - 0.49) * price * volatility;
    const close = parseFloat((open + change).toFixed(3));
    const high = parseFloat((Math.max(open, close) + Math.random() * price * volatility * 0.6).toFixed(3));
    const low = parseFloat((Math.min(open, close) - Math.random() * price * volatility * 0.6).toFixed(3));
    const volume = Math.floor(Math.random() * 8000000 + 500000);
    price = close;
    const date = new Date(Date.now() - (bars - i) * 86400000);
    return { i, date: date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }), open, high, low, close, volume, isBull: close >= open };
  });
};

// ─── Simple technical signals on historical data ───────────────────────────────
const calcEMA = (data, period) => {
  const k = 2 / (period + 1);
  let ema = data[0]?.close || 0;
  return data.map(d => {
    ema = d.close * k + ema * (1 - k);
    return parseFloat(ema.toFixed(4));
  });
};

const calcRSI = (data, period = 14) => {
  const changes = data.map((d, i) => i === 0 ? 0 : d.close - data[i - 1].close);
  return data.map((_, i) => {
    if (i < period) return 50;
    const slice = changes.slice(i - period + 1, i + 1);
    const gains = slice.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
    const losses = Math.abs(slice.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
    if (losses === 0) return 100;
    const rs = gains / losses;
    return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
  });
};

const calcATR = (data, period = 14) => {
  const trs = data.map((d, i) => {
    if (i === 0) return d.high - d.low;
    const prev = data[i - 1].close;
    return Math.max(d.high - d.low, Math.abs(d.high - prev), Math.abs(d.low - prev));
  });
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  return trs.map((tr, i) => {
    if (i < period) return atr;
    atr = (atr * (period - 1) + tr) / period;
    return parseFloat(atr.toFixed(4));
  });
};

// ─── Strategy signal generator ─────────────────────────────────────────────────
const STRATEGIES = [
  {
    id: "ema_cross",
    label: "تقاطع المتوسطات EMA (20/50)",
    description: "شراء عند تقاطع EMA20 فوق EMA50 وبيع عند العكس",
    generate: (data) => {
      const ema20 = calcEMA(data, 20);
      const ema50 = calcEMA(data, 50);
      return data.map((d, i) => {
        if (i < 51) return null;
        const prev20 = ema20[i - 1], prev50 = ema50[i - 1];
        const curr20 = ema20[i], curr50 = ema50[i];
        if (prev20 <= prev50 && curr20 > curr50) return { signal: "buy", ema20: curr20, ema50: curr50 };
        if (prev20 >= prev50 && curr20 < curr50) return { signal: "sell", ema20: curr20, ema50: curr50 };
        return null;
      });
    }
  },
  {
    id: "rsi_oversold",
    label: "RSI ذروة شراء/بيع (30/70)",
    description: "شراء عند RSI < 30 وبيع عند RSI > 70",
    generate: (data) => {
      const rsi = calcRSI(data, 14);
      return data.map((d, i) => {
        if (i < 15) return null;
        const r = rsi[i], rPrev = rsi[i - 1];
        if (rPrev < 30 && r >= 30) return { signal: "buy", rsi: r };
        if (rPrev > 70 && r <= 70) return { signal: "sell", rsi: r };
        return null;
      });
    }
  },
  {
    id: "atr_breakout",
    label: "اختراق ATR (Volatility Breakout)",
    description: "شراء عند كسر أعلى سعر + ATR وبيع عند كسر أدنى سعر - ATR",
    generate: (data) => {
      const atr = calcATR(data, 14);
      return data.map((d, i) => {
        if (i < 20) return null;
        const recent = data.slice(i - 10, i);
        const highestHigh = Math.max(...recent.map(r => r.high));
        const lowestLow = Math.min(...recent.map(r => r.low));
        if (d.close > highestHigh + atr[i] * 0.3) return { signal: "buy", atr: atr[i] };
        if (d.close < lowestLow - atr[i] * 0.3) return { signal: "sell", atr: atr[i] };
        return null;
      });
    }
  },
  {
    id: "multi",
    label: "استراتيجية مركبة (EMA + RSI + ATR)",
    description: "يجمع المتوسطات مع RSI واختراق التقلب للحصول على إشارات عالية الدقة",
    generate: (data) => {
      const ema20 = calcEMA(data, 20);
      const ema50 = calcEMA(data, 50);
      const rsi = calcRSI(data, 14);
      const atr = calcATR(data, 14);
      return data.map((d, i) => {
        if (i < 52) return null;
        const bullEma = ema20[i] > ema50[i];
        const bullRsi = rsi[i] > 45 && rsi[i] < 65;
        const bearEma = ema20[i] < ema50[i];
        const bearRsi = rsi[i] > 55 && rsi[i] < 75;
        const atrOk = atr[i] > 0;
        if (bullEma && bullRsi && atrOk && ema20[i] > ema20[i - 1]) return { signal: "buy", ema20: ema20[i], rsi: rsi[i], atr: atr[i] };
        if (bearEma && bearRsi && atrOk && ema20[i] < ema20[i - 1]) return { signal: "sell", ema20: ema20[i], rsi: rsi[i], atr: atr[i] };
        return null;
      });
    }
  }
];

// ─── Run backtest engine ────────────────────────────────────────────────────────
const runBacktest = (data, signals, config) => {
  let equity = config.initialCapital;
  let position = null;
  const trades = [];
  const equityCurve = [{ i: 0, date: data[0]?.date, equity }];
  let peakEquity = equity;
  let maxDrawdown = 0;
  let totalDrawdown = 0;
  let drawdownCount = 0;

  for (let i = 0; i < data.length; i++) {
    const sig = signals[i];
    const bar = data[i];

    // Close existing position on opposite signal or stop/target hit
    if (position) {
      const pnlPct = (bar.close - position.entryPrice) / position.entryPrice * (position.side === "buy" ? 1 : -1);
      const hitSL = position.side === "buy" ? bar.low <= position.sl : bar.high >= position.sl;
      const hitTP = position.side === "buy" ? bar.high >= position.tp : bar.low <= position.tp;
      const oppositeSignal = sig && ((position.side === "buy" && sig.signal === "sell") || (position.side === "sell" && sig.signal === "buy"));

      if (hitSL || hitTP || oppositeSignal) {
        const exitPrice = hitSL ? position.sl : hitTP ? position.tp : bar.close;
        const realPnlPct = (exitPrice - position.entryPrice) / position.entryPrice * (position.side === "buy" ? 1 : -1);
        const pnl = parseFloat((equity * (config.riskPct / 100) * (hitTP ? config.rrRatio : hitSL ? -1 : realPnlPct * config.rrRatio)).toFixed(2));
        equity = parseFloat((equity + pnl).toFixed(2));

        trades.push({
          id: trades.length + 1,
          entry: position.entryDate,
          exit: bar.date,
          entryPrice: position.entryPrice,
          exitPrice,
          side: position.side,
          pnl,
          pnlPct: parseFloat((realPnlPct * 100).toFixed(2)),
          result: pnl >= 0 ? "win" : "loss",
          exitReason: hitTP ? "هدف TP" : hitSL ? "وقف SL" : "إشارة عكسية",
          duration: i - position.entryIdx,
        });

        if (equity > peakEquity) peakEquity = equity;
        const drawdown = (peakEquity - equity) / peakEquity * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        if (drawdown > 0) { totalDrawdown += drawdown; drawdownCount++; }

        position = null;
      }
    }

    // Open new position
    if (!position && sig) {
      const atrVal = calcATR(data.slice(Math.max(0, i - 20), i + 1), 14).slice(-1)[0] || bar.close * 0.01;
      const sl = sig.signal === "buy" ? parseFloat((bar.close - atrVal * 1.5).toFixed(3)) : parseFloat((bar.close + atrVal * 1.5).toFixed(3));
      const tp = sig.signal === "buy" ? parseFloat((bar.close + atrVal * 1.5 * config.rrRatio).toFixed(3)) : parseFloat((bar.close - atrVal * 1.5 * config.rrRatio).toFixed(3));
      position = { entryPrice: bar.close, entryDate: bar.date, side: sig.signal, sl, tp, entryIdx: i };
    }

    equityCurve.push({ i, date: bar.date, equity });
  }

  // Metrics
  const wins = trades.filter(t => t.result === "win");
  const losses = trades.filter(t => t.result === "loss");
  const winRate = trades.length > 0 ? (wins.length / trades.length * 100) : 0;
  const totalPnl = trades.reduce((a, t) => a + t.pnl, 0);
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, t) => a + t.pnl, 0) / losses.length : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs((avgWin * wins.length) / (avgLoss * losses.length)) : Infinity;
  const sharpe = equityCurve.length > 1 ? (() => {
    const returns = equityCurve.slice(1).map((e, i) => (e.equity - equityCurve[i].equity) / equityCurve[i].equity);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const std = Math.sqrt(returns.map(r => (r - mean) ** 2).reduce((a, b) => a + b, 0) / returns.length);
    return std > 0 ? parseFloat((mean / std * Math.sqrt(252)).toFixed(2)) : 0;
  })() : 0;

  return {
    trades, equityCurve, wins, losses,
    winRate: parseFloat(winRate.toFixed(1)),
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    finalEquity: parseFloat(equity.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    avgDrawdown: drawdownCount > 0 ? parseFloat((totalDrawdown / drawdownCount).toFixed(2)) : 0,
    profitFactor: isFinite(profitFactor) ? parseFloat(profitFactor.toFixed(2)) : 99,
    sharpe,
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    totalReturn: parseFloat(((equity - config.initialCapital) / config.initialCapital * 100).toFixed(2)),
  };
};

// ─── Metric Card ───────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, color = "white", highlight }) => (
  <div className={`bg-[#0f1623] border rounded-2xl p-4 ${highlight ? 'border-[#d4a843]/40' : 'border-[#1e293b]'}`}>
    <p className="text-xs text-[#64748b] mb-1">{label}</p>
    <p className={`text-xl font-black`} style={{ color }}>{value}</p>
    {sub && <p className="text-xs text-[#475569] mt-0.5">{sub}</p>}
  </div>
);

// ─── Main Backtesting Component ────────────────────────────────────────────────
export default function Backtesting({ stock }) {
  const [strategyId, setStrategyId] = useState("multi");
  const [bars, setBars] = useState(365);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [riskPct, setRiskPct] = useState(2);
  const [rrRatio, setRrRatio] = useState(2);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [showTrades, setShowTrades] = useState(false);

  const strategy = STRATEGIES.find(s => s.id === strategyId);
  const basePrice = stock?.market === "us" ? 100 + Math.random() * 300 : 30 + Math.random() * 80;

  const handleRun = useCallback(() => {
    setRunning(true);
    setResult(null);
    // slight async delay for UX
    setTimeout(() => {
      const volatility = stock?.market === "us" ? 0.015 : 0.012;
      const data = generateHistoricalData(bars, basePrice, volatility);
      const signals = strategy.generate(data);
      const res = runBacktest(data, signals, { initialCapital, riskPct, rrRatio });
      res.data = data;
      res.signals = signals;
      setResult(res);
      setRunning(false);
    }, 600);
  }, [bars, initialCapital, riskPct, rrRatio, strategy, stock, basePrice]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-purple-500/10">
          <FlaskConical className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Backtesting — اختبار الاستراتيجية</h2>
          <p className="text-xs text-[#64748b]">اختبر استراتيجيتك على بيانات تاريخية محاكاة لـ {stock?.symbol}</p>
        </div>
      </div>

      {/* Config */}
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">إعدادات الاختبار</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Strategy */}
          <div className="lg:col-span-2">
            <label className="text-xs text-[#64748b] block mb-1">الاستراتيجية</label>
            <select value={strategyId} onChange={e => setStrategyId(e.target.value)}
              className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50">
              {STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <p className="text-xs text-[#475569] mt-1">{strategy?.description}</p>
          </div>
          {/* Bars */}
          <div>
            <label className="text-xs text-[#64748b] block mb-1">عدد الأيام</label>
            <select value={bars} onChange={e => setBars(parseInt(e.target.value))}
              className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50">
              {[90, 180, 365, 730, 1095].map(b => <option key={b} value={b}>{b} يوم</option>)}
            </select>
          </div>
          {/* Capital */}
          <div>
            <label className="text-xs text-[#64748b] block mb-1">رأس المال الابتدائي ($)</label>
            <input type="number" value={initialCapital} min={1000} step={1000} onChange={e => setInitialCapital(parseInt(e.target.value))}
              className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50" />
          </div>
          {/* Risk */}
          <div>
            <label className="text-xs text-[#64748b] block mb-1">نسبة المخاطرة/صفقة (%)</label>
            <input type="number" value={riskPct} min={0.5} max={20} step={0.5} onChange={e => setRiskPct(parseFloat(e.target.value))}
              className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50" />
          </div>
          {/* R:R */}
          <div>
            <label className="text-xs text-[#64748b] block mb-1">نسبة R:R</label>
            <div className="flex gap-1">
              {[1.5, 2, 3, 4].map(r => (
                <button key={r} onClick={() => setRrRatio(r)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${rrRatio === r ? 'bg-[#d4a843]/20 border-[#d4a843]/60 text-[#d4a843]' : 'border-[#1e293b] text-[#64748b] hover:text-white'}`}>
                  {r}x
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleRun} disabled={running}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-sm hover:bg-purple-500/30 disabled:opacity-50 transition-all">
            {running ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الاختبار...</> : <><FlaskConical className="w-4 h-4" /> تشغيل الـ Backtest</>}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="صافي الربح" value={`${result.totalPnl >= 0 ? '+' : ''}$${result.totalPnl.toLocaleString()}`}
              color={result.totalPnl >= 0 ? "#10b981" : "#ef4444"}
              sub={`${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn}%`} highlight />
            <MetricCard label="نسبة الفوز" value={`${result.winRate}%`}
              color={result.winRate >= 55 ? "#10b981" : result.winRate >= 45 ? "#d4a843" : "#ef4444"}
              sub={`${result.wins.length} فوز / ${result.losses.length} خسارة`} />
            <MetricCard label="أقصى تراجع" value={`-${result.maxDrawdown}%`}
              color={result.maxDrawdown > 20 ? "#ef4444" : result.maxDrawdown > 10 ? "#f59e0b" : "#10b981"}
              sub={`متوسط ${result.avgDrawdown}%`} />
            <MetricCard label="Profit Factor" value={result.profitFactor === 99 ? "∞" : result.profitFactor}
              color={result.profitFactor >= 1.5 ? "#10b981" : result.profitFactor >= 1 ? "#d4a843" : "#ef4444"}
              sub={result.profitFactor >= 1.5 ? "ممتاز" : result.profitFactor >= 1 ? "مقبول" : "سلبي"} />
            <MetricCard label="Sharpe Ratio" value={result.sharpe}
              color={result.sharpe >= 1 ? "#10b981" : result.sharpe >= 0 ? "#d4a843" : "#ef4444"}
              sub={result.sharpe >= 1 ? "جيد" : result.sharpe >= 0 ? "مقبول" : "سيئ"} />
            <MetricCard label="عدد الصفقات" value={result.trades.length}
              color="#94a3b8"
              sub={`رأس المال النهائي $${result.finalEquity.toLocaleString()}`} />
          </div>

          {/* Win/Loss quick metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0f1623] border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs text-[#64748b]">متوسط الصفقة الرابحة</p>
                <p className="text-xl font-black text-emerald-400">+${result.avgWin}</p>
              </div>
            </div>
            <div className="bg-[#0f1623] border border-red-500/20 rounded-2xl p-4 flex items-center gap-4">
              <XCircle className="w-8 h-8 text-red-400 shrink-0" />
              <div>
                <p className="text-xs text-[#64748b]">متوسط الصفقة الخاسرة</p>
                <p className="text-xl font-black text-red-400">${result.avgLoss}</p>
              </div>
            </div>
          </div>

          {/* Equity Curve */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">منحنى الأداء التاريخي للمحفظة</h3>
              <span className={`mr-auto text-sm font-bold ${result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn}%
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.equityCurve.filter((_, i) => i % 3 === 0)}>
                  <defs>
                    <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={result.totalReturn >= 0 ? "#a855f7" : "#ef4444"} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={result.totalReturn >= 0 ? "#a855f7" : "#ef4444"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={70} tickFormatter={v => `$${v.toLocaleString()}`} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={v => [`$${v?.toLocaleString()}`, "رأس المال"]} />
                  <ReferenceLine y={initialCapital} stroke="#475569" strokeDasharray="4 4" label={{ value: "رأس المال الابتدائي", fill: '#475569', fontSize: 9 }} />
                  <Area type="monotone" dataKey="equity" stroke={result.totalReturn >= 0 ? "#a855f7" : "#ef4444"} strokeWidth={2} fill="url(#btGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly PnL Bar Chart */}
          {(() => {
            const monthly = {};
            result.trades.forEach(t => {
              const key = t.exit?.split('/').slice(1).join('/') || `م${t.id % 12}`;
              monthly[key] = (monthly[key] || 0) + t.pnl;
            });
            const monthlyData = Object.entries(monthly).map(([k, v]) => ({ month: k, pnl: parseFloat(v.toFixed(2)) }));
            return monthlyData.length > 1 ? (
              <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">توزيع الأرباح والخسائر</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                        formatter={v => [`$${v}`, "ربح/خسارة"]} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}
                        fill="#a855f7"
                        label={false}
                        isAnimationActive
                        // color per bar
                        background={{ fill: '#0f1623' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null;
          })()}

          {/* Drawdown Analysis */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">تحليل التراجع (Drawdown)</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#0f1623] rounded-xl p-4 text-center border border-[#1e293b]">
                <p className="text-2xl font-black text-red-400">-{result.maxDrawdown}%</p>
                <p className="text-xs text-[#64748b] mt-1">أقصى تراجع</p>
                <div className="mt-2 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(result.maxDrawdown * 2, 100)}%` }} />
                </div>
              </div>
              <div className="bg-[#0f1623] rounded-xl p-4 text-center border border-[#1e293b]">
                <p className="text-2xl font-black text-amber-400">-{result.avgDrawdown}%</p>
                <p className="text-xs text-[#64748b] mt-1">متوسط التراجع</p>
                <div className="mt-2 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(result.avgDrawdown * 2, 100)}%` }} />
                </div>
              </div>
              <div className="bg-[#0f1623] rounded-xl p-4 text-center border border-[#1e293b]">
                <p className={`text-2xl font-black ${result.maxDrawdown <= 10 ? 'text-emerald-400' : result.maxDrawdown <= 20 ? 'text-amber-400' : 'text-red-400'}`}>
                  {result.maxDrawdown <= 10 ? "منخفض" : result.maxDrawdown <= 20 ? "متوسط" : "مرتفع"}
                </p>
                <p className="text-xs text-[#64748b] mt-1">مستوى المخاطرة</p>
              </div>
            </div>
          </div>

          {/* Trade Log Toggle */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl overflow-hidden">
            <button onClick={() => setShowTrades(!showTrades)}
              className="w-full flex items-center justify-between p-5 hover:bg-[#1a2235] transition-colors">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#d4a843]" />
                <span className="text-sm font-bold text-white">سجل الصفقات التاريخية</span>
                <span className="text-xs text-[#64748b]">({result.trades.length} صفقة)</span>
              </div>
              {showTrades ? <ChevronUp className="w-4 h-4 text-[#64748b]" /> : <ChevronDown className="w-4 h-4 text-[#64748b]" />}
            </button>
            {showTrades && (
              <div className="overflow-x-auto border-t border-[#1e293b]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e293b] bg-[#0f1623]">
                      {["#", "دخول", "خروج", "نوع", "سعر الدخول", "سعر الخروج", "مدة", "سبب الخروج", "ربح/خسارة", "النتيجة"].map(h => (
                        <th key={h} className="py-2.5 px-3 text-right text-[#64748b] font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 50).map(t => (
                      <tr key={t.id} className="border-b border-[#1a2235] hover:bg-[#1e293b]/30 transition-colors">
                        <td className="py-2 px-3 text-[#64748b]">{t.id}</td>
                        <td className="py-2 px-3 text-[#94a3b8]">{t.entry}</td>
                        <td className="py-2 px-3 text-[#94a3b8]">{t.exit}</td>
                        <td className="py-2 px-3">
                          <span className={`font-bold ${t.side === "buy" ? "text-emerald-400" : "text-red-400"}`}>
                            {t.side === "buy" ? "▲ شراء" : "▼ بيع"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-white font-semibold">{t.entryPrice}</td>
                        <td className="py-2 px-3 text-white font-semibold">{t.exitPrice?.toFixed(3)}</td>
                        <td className="py-2 px-3 text-[#94a3b8]">{t.duration} يوم</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.exitReason === "هدف TP" ? "bg-emerald-500/20 text-emerald-400" : t.exitReason === "وقف SL" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                            {t.exitReason}
                          </span>
                        </td>
                        <td className={`py-2 px-3 font-black ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-lg ${t.result === "win" ? "text-emerald-400" : "text-red-400"}`}>
                            {t.result === "win" ? "✓" : "✗"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.trades.length > 50 && (
                  <p className="text-xs text-center text-[#475569] py-3">يُعرض أول 50 صفقة فقط من أصل {result.trades.length}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!result && !running && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
            <FlaskConical className="w-8 h-8 text-purple-400" />
          </div>
          <p className="text-white font-bold mb-1">جاهز للاختبار</p>
          <p className="text-sm text-[#64748b]">اضبط الإعدادات ثم اضغط "تشغيل الـ Backtest"</p>
        </div>
      )}
    </div>
  );
}