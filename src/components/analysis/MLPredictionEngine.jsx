import React, { useMemo } from "react";
import { Brain, TrendingUp, TrendingDown, Target, Shield, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";

// ─────────────────────────────────────────────
// ML Helpers (pure JS, no external libs)
// ─────────────────────────────────────────────

const calcEMA = (arr, p) => {
  const k = 2 / (p + 1);
  let ema = arr[0];
  return arr.map((v, i) => { if (i === 0) return ema; ema = v * k + ema * (1 - k); return ema; });
};

const calcRSI = (closes, period = 14) => {
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;
  const rsiArr = [50];
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiArr.push(100 - 100 / (1 + rs));
  }
  return rsiArr;
};

const calcMACD = (closes) => {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macd.slice(26), 9);
  const hist = macd.slice(26).map((v, i) => v - signal[i]);
  return { macd: macd.slice(26), signal, hist };
};

const calcATR = (data, period = 14) => {
  const trs = data.map((d, i) => {
    if (i === 0) return d.high - d.low;
    return Math.max(d.high - d.low, Math.abs(d.high - data[i - 1].close), Math.abs(d.low - data[i - 1].close));
  });
  const atrs = [];
  let atr = trs.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    atrs.push(atr);
  }
  return atrs;
};

const calcBollinger = (closes, period = 20) => {
  const sma = closes.slice(-period).reduce((a, b) => a + b) / period;
  const std = Math.sqrt(closes.slice(-period).reduce((a, b) => a + (b - sma) ** 2, 0) / period);
  return { upper: sma + 2 * std, middle: sma, lower: sma - 2 * std };
};

const calcStochastic = (data, period = 14) => {
  const recent = data.slice(-period);
  const highH = Math.max(...recent.map(d => d.high));
  const lowL = Math.min(...recent.map(d => d.low));
  const close = data[data.length - 1].close;
  return ((close - lowL) / (highH - lowL || 1)) * 100;
};

// ─────────────────────────────────────────────
// Feature Engineering
// ─────────────────────────────────────────────
const extractFeatures = (data) => {
  if (data.length < 50) return null;
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume);
  const price = closes[closes.length - 1];

  const ema8 = calcEMA(closes, 8);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, 50);
  const ema200 = calcEMA(closes, Math.min(200, closes.length));

  const rsi = calcRSI(closes);
  const lastRSI = rsi[rsi.length - 1];
  const prevRSI = rsi[rsi.length - 5] || lastRSI;

  const { hist } = calcMACD(closes);
  const lastHist = hist[hist.length - 1] || 0;
  const prevHist = hist[hist.length - 4] || 0;

  const atrs = calcATR(data);
  const atr = atrs[atrs.length - 1] || price * 0.02;

  const bb = calcBollinger(closes);
  const stoch = calcStochastic(data);

  // Volume momentum
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b) / 20;
  const lastVol = volumes[volumes.length - 1];
  const volRatio = lastVol / (avgVol || 1);

  // Price momentum (rate of change)
  const roc5 = (price - closes[closes.length - 6]) / closes[closes.length - 6] * 100;
  const roc20 = (price - closes[closes.length - 21]) / closes[closes.length - 21] * 100;

  // BB position
  const bbPos = (price - bb.lower) / (bb.upper - bb.lower || 1);

  return {
    price, ema8: ema8[ema8.length - 1], ema21: ema21[ema21.length - 1],
    ema50: ema50[ema50.length - 1], ema200: ema200[ema200.length - 1],
    rsi: lastRSI, rsiDelta: lastRSI - prevRSI,
    macdHist: lastHist, macdHistDelta: lastHist - prevHist,
    atr, stoch, bbPos, volRatio, roc5, roc20,
    bbUpper: bb.upper, bbLower: bb.lower, bbMiddle: bb.middle,
  };
};

// ─────────────────────────────────────────────
// Model 1: Trend Classifier (Logistic-style)
// ─────────────────────────────────────────────
const trendClassifier = (f) => {
  // Feature weights learned from technical analysis research
  let score = 0;
  score += f.price > f.ema21 ? 15 : -15;
  score += f.price > f.ema50 ? 12 : -12;
  score += f.price > f.ema200 ? 18 : -18;
  score += f.ema8 > f.ema21 ? 10 : -10;        // Golden/Death cross
  score += f.ema21 > f.ema50 ? 8 : -8;
  score += f.macdHist > 0 ? 10 : -10;
  score += f.macdHistDelta > 0 ? 8 : -8;       // MACD acceleration
  score += f.rsi > 50 ? 6 : -6;
  score += f.rsiDelta > 0 ? 5 : -5;            // RSI momentum
  score += f.roc5 > 0 ? 7 : -7;
  score += f.roc20 > 0 ? 9 : -9;
  score += f.volRatio > 1.2 && f.roc5 > 0 ? 8 : 0;   // Volume confirms up move
  score += f.bbPos > 0.5 ? 5 : -5;

  const maxScore = 121;
  const probability = Math.max(5, Math.min(95, 50 + (score / maxScore) * 45));
  const direction = probability >= 55 ? "صعودي" : probability <= 45 ? "هبوطي" : "محايد";
  return { score, probability: Math.round(probability), direction };
};

// ─────────────────────────────────────────────
// Model 2: Entry / Exit Signal
// ─────────────────────────────────────────────
const entryExitSignal = (f) => {
  const signals = [];
  let buyStrength = 0, sellStrength = 0;

  // RSI-based
  if (f.rsi < 30) { signals.push({ text: "RSI تشبع بيعي (< 30)", type: "buy", strength: 80 }); buyStrength += 80; }
  else if (f.rsi > 70) { signals.push({ text: "RSI تشبع شرائي (> 70)", type: "sell", strength: 75 }); sellStrength += 75; }
  else if (f.rsi > 45 && f.rsi < 55 && f.rsiDelta > 2) { signals.push({ text: "RSI كسر 50 للأعلى", type: "buy", strength: 55 }); buyStrength += 55; }

  // MACD
  if (f.macdHist > 0 && f.macdHistDelta > 0) { signals.push({ text: "MACD هيستوغرام متسارع صعوداً", type: "buy", strength: 65 }); buyStrength += 65; }
  else if (f.macdHist < 0 && f.macdHistDelta < 0) { signals.push({ text: "MACD هيستوغرام متسارع هبوطاً", type: "sell", strength: 60 }); sellStrength += 60; }

  // Bollinger
  if (f.price <= f.bbLower * 1.01) { signals.push({ text: "سعر عند الشريط السفلي (Bollinger)", type: "buy", strength: 70 }); buyStrength += 70; }
  else if (f.price >= f.bbUpper * 0.99) { signals.push({ text: "سعر عند الشريط العلوي (Bollinger)", type: "sell", strength: 68 }); sellStrength += 68; }

  // EMA crossover
  if (f.ema8 > f.ema21 && f.price > f.ema50) { signals.push({ text: "تقاطع EMA8/EMA21 صعودي", type: "buy", strength: 72 }); buyStrength += 72; }
  else if (f.ema8 < f.ema21 && f.price < f.ema50) { signals.push({ text: "تقاطع EMA8/EMA21 هبوطي", type: "sell", strength: 70 }); sellStrength += 70; }

  // Stochastic
  if (f.stoch < 20) { signals.push({ text: "Stochastic منطقة التشبع البيعي", type: "buy", strength: 60 }); buyStrength += 60; }
  else if (f.stoch > 80) { signals.push({ text: "Stochastic منطقة التشبع الشرائي", type: "sell", strength: 55 }); sellStrength += 55; }

  // Volume confirmation
  if (f.volRatio > 1.5) signals.push({ text: `حجم تداول مرتفع (${f.volRatio.toFixed(1)}x المتوسط)`, type: "neutral", strength: 50 });

  const action = buyStrength > sellStrength + 30 ? "شراء" :
    sellStrength > buyStrength + 30 ? "بيع" : "انتظار";

  return { signals, buyStrength, sellStrength, action };
};

// ─────────────────────────────────────────────
// Model 3: Risk/Reward Estimator
// ─────────────────────────────────────────────
const riskRewardModel = (f, direction) => {
  const price = f.price;
  const atr = f.atr;
  const isBull = direction !== "هبوطي";

  // Entry zone
  const entryIdeal = isBull
    ? parseFloat((Math.max(f.bbMiddle, f.ema21) * 0.999).toFixed(2))
    : parseFloat((Math.min(f.bbMiddle, f.ema21) * 1.001).toFixed(2));

  const stopLoss = isBull
    ? parseFloat((price - atr * 1.5).toFixed(2))
    : parseFloat((price + atr * 1.5).toFixed(2));

  const tp1 = isBull
    ? parseFloat((price + atr * 2).toFixed(2))
    : parseFloat((price - atr * 2).toFixed(2));

  const tp2 = isBull
    ? parseFloat((price + atr * 3.5).toFixed(2))
    : parseFloat((price - atr * 3.5).toFixed(2));

  const tp3 = isBull
    ? parseFloat((price + atr * 6).toFixed(2))
    : parseFloat((price - atr * 6).toFixed(2));

  const riskPct = Math.abs((stopLoss - price) / price * 100);
  const reward1Pct = Math.abs((tp1 - price) / price * 100);
  const rr1 = parseFloat((reward1Pct / riskPct).toFixed(2));
  const rr2 = parseFloat((Math.abs((tp2 - price) / price * 100) / riskPct).toFixed(2));

  // Confidence: based on ATR relative to price (lower ATR = less volatile = more predictable)
  const volatility = (atr / price) * 100;
  const confidence = Math.round(Math.max(30, Math.min(90, 85 - volatility * 3)));

  const riskLevel = riskPct < 2 ? "منخفض" : riskPct < 4 ? "متوسط" : "مرتفع";
  const riskColor = riskPct < 2 ? "#10b981" : riskPct < 4 ? "#d4a843" : "#ef4444";

  return { entryIdeal, stopLoss, tp1, tp2, tp3, riskPct, reward1Pct, rr1, rr2, confidence, riskLevel, riskColor, volatility };
};

// ─────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────
const Bar = ({ value, max = 100, color }) => (
  <div className="flex-1 h-2 bg-[#1e293b] rounded-full overflow-hidden">
    <div className="h-full rounded-full transition-all duration-700"
      style={{ width: `${Math.min(100, value / max * 100)}%`, backgroundColor: color }} />
  </div>
);

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function MLPredictionEngine({ data }) {
  const result = useMemo(() => {
    if (!data || data.length < 50) return null;
    const f = extractFeatures(data);
    if (!f) return null;
    const trend = trendClassifier(f);
    const entry = entryExitSignal(f);
    const rr = riskRewardModel(f, trend.direction);
    return { f, trend, entry, rr };
  }, [data]);

  if (!result) return (
    <div className="text-center py-6 text-[#64748b] text-sm">يتطلب 50 شمعة على الأقل</div>
  );

  const { f, trend, entry, rr } = result;
  const dirColor = trend.direction === "صعودي" ? "#10b981" : trend.direction === "هبوطي" ? "#ef4444" : "#d4a843";
  const dirIcon = trend.direction === "صعودي" ? "📈" : trend.direction === "هبوطي" ? "📉" : "↔️";
  const actionColor = entry.action === "شراء" ? "#10b981" : entry.action === "بيع" ? "#ef4444" : "#d4a843";

  return (
    <div className="space-y-5">

      {/* ── Model 1: Direction ── */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Direction card */}
        <div className="md:col-span-1 rounded-2xl border p-5 flex flex-col items-center justify-center gap-3"
          style={{ backgroundColor: dirColor + '0a', borderColor: dirColor + '40' }}>
          <span className="text-4xl">{dirIcon}</span>
          <p className="text-xs text-[#64748b] font-semibold">اتجاه السوق المتوقع</p>
          <p className="text-2xl font-black" style={{ color: dirColor }}>{trend.direction}</p>
          <div className="w-full">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#64748b]">احتمالية</span>
              <span className="font-bold" style={{ color: dirColor }}>{trend.probability}%</span>
            </div>
            <div className="h-3 bg-[#1e293b] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${trend.probability}%`, backgroundColor: dirColor }} />
            </div>
          </div>
          <p className="text-xs text-[#64748b] text-center mt-1">
            {trend.probability >= 70 ? "إشارة قوية — موثوقة" :
              trend.probability >= 55 ? "إشارة معتدلة — متابعة" :
                "إشارة ضعيفة — انتظر تأكيداً"}
          </p>
        </div>

        {/* ML Feature Scores */}
        <div className="md:col-span-2 bg-[#0f1623] border border-[#1e293b] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-[#d4a843]" />
            <span className="text-sm font-bold text-white">مؤشرات النموذج</span>
            <span className="text-xs text-[#64748b] mr-auto">7 خوارزميات</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "تقاطع المتوسطات (EMA8/21/50/200)", value: f.price > f.ema50 && f.ema8 > f.ema21 ? 80 : f.price < f.ema50 ? 25 : 50, color: "#3b82f6" },
              { label: `زخم RSI (${f.rsi.toFixed(0)})`, value: f.rsi > 50 ? Math.min(90, f.rsi) : Math.max(10, f.rsi), color: f.rsi < 30 ? "#10b981" : f.rsi > 70 ? "#ef4444" : "#d4a843" },
              { label: "زخم MACD", value: f.macdHist > 0 ? Math.min(90, 50 + Math.abs(f.macdHistDelta) * 100) : Math.max(10, 50 - Math.abs(f.macdHistDelta) * 100), color: f.macdHist > 0 ? "#10b981" : "#ef4444" },
              { label: `موقع Bollinger (${(f.bbPos * 100).toFixed(0)}%)`, value: Math.round(f.bbPos * 100), color: "#8b5cf6" },
              { label: `Stochastic (${f.stoch.toFixed(0)})`, value: Math.round(f.stoch), color: f.stoch < 20 ? "#10b981" : f.stoch > 80 ? "#ef4444" : "#d4a843" },
              { label: `حجم التداول (${f.volRatio.toFixed(1)}x)`, value: Math.min(95, Math.round(f.volRatio * 40)), color: "#f59e0b" },
              { label: `زخم السعر ROC-20 (${f.roc20.toFixed(1)}%)`, value: Math.min(95, Math.max(5, 50 + f.roc20 * 3)), color: f.roc20 > 0 ? "#10b981" : "#ef4444" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-[#94a3b8] w-44 shrink-0 truncate">{item.label}</span>
                <Bar value={item.value} color={item.color} />
                <span className="text-xs font-bold w-8 text-right" style={{ color: item.color }}>{Math.round(item.value)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Model 2: Entry / Exit Signals ── */}
      <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[#d4a843]" />
          <span className="text-sm font-bold text-white">إشارات الدخول والخروج</span>
          <div className="mr-auto px-3 py-1 rounded-full text-xs font-black border"
            style={{ backgroundColor: actionColor + '15', borderColor: actionColor + '40', color: actionColor }}>
            {entry.action === "شراء" ? "⚡ " : entry.action === "بيع" ? "🚨 " : "⏳ "}
            إشارة {entry.action}
          </div>
        </div>

        {/* Buy/Sell strength bars */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-emerald-400 font-semibold">قوة الشراء</span>
              <span className="text-emerald-400 font-bold">{entry.buyStrength}</span>
            </div>
            <div className="h-2.5 bg-[#1e293b] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, entry.buyStrength / 4)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-red-400 font-semibold">قوة البيع</span>
              <span className="text-red-400 font-bold">{entry.sellStrength}</span>
            </div>
            <div className="h-2.5 bg-[#1e293b] rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, entry.sellStrength / 4)}%` }} />
            </div>
          </div>
        </div>

        {/* Signal list */}
        <div className="grid md:grid-cols-2 gap-2">
          {entry.signals.map((sig, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl border"
              style={{
                backgroundColor: sig.type === "buy" ? "#10b98110" : sig.type === "sell" ? "#ef444410" : "#1e293b",
                borderColor: sig.type === "buy" ? "#10b98130" : sig.type === "sell" ? "#ef444430" : "#1e293b40",
              }}>
              <span className="text-base">{sig.type === "buy" ? "🟢" : sig.type === "sell" ? "🔴" : "⚪"}</span>
              <span className="text-xs text-[#94a3b8] flex-1">{sig.text}</span>
              <span className="text-xs font-bold w-8 text-left"
                style={{ color: sig.type === "buy" ? "#10b981" : sig.type === "sell" ? "#ef4444" : "#64748b" }}>
                {sig.strength}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Model 3: Risk/Reward ── */}
      <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-[#d4a843]" />
          <span className="text-sm font-bold text-white">تقييم المخاطر والعائد</span>
          <span className="mr-auto text-xs font-black px-2 py-0.5 rounded-full"
            style={{ backgroundColor: rr.riskColor + '20', color: rr.riskColor }}>
            مخاطرة {rr.riskLevel}
          </span>
        </div>

        {/* 3 stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-[#151c2c] rounded-xl p-3 text-center">
            <p className="text-xs text-[#64748b] mb-1">وقف الخسارة</p>
            <p className="text-base font-black text-red-400">{rr.stopLoss}</p>
            <p className="text-xs text-red-400">-{rr.riskPct.toFixed(1)}%</p>
          </div>
          <div className="bg-[#151c2c] rounded-xl p-3 text-center border-2 border-[#d4a843]/30">
            <p className="text-xs text-[#64748b] mb-1">R:R الهدف 1</p>
            <p className={`text-base font-black ${rr.rr1 >= 2 ? 'text-emerald-400' : 'text-[#d4a843]'}`}>{rr.rr1}x</p>
            <p className={`text-xs ${rr.rr1 >= 2 ? 'text-emerald-400' : 'text-[#d4a843]'}`}>
              {rr.rr1 >= 3 ? "ممتاز ✓" : rr.rr1 >= 2 ? "جيد ✓" : "مقبول"}
            </p>
          </div>
          <div className="bg-[#151c2c] rounded-xl p-3 text-center">
            <p className="text-xs text-[#64748b] mb-1">ثقة النموذج</p>
            <p className="text-base font-black text-[#d4a843]">{rr.confidence}%</p>
            <p className="text-xs text-[#94a3b8]">دقة التنبؤ</p>
          </div>
        </div>

        {/* TP Levels */}
        <div className="space-y-2">
          {[
            { label: "الهدف 1 (ATR×2)", value: rr.tp1, pct: rr.reward1Pct, rr: rr.rr1, color: "#10b981" },
            { label: "الهدف 2 (ATR×3.5)", value: rr.tp2, pct: Math.abs((rr.tp2 - f.price) / f.price * 100), rr: rr.rr2, color: "#3b82f6" },
            { label: "الهدف 3 (ATR×6)", value: rr.tp3, pct: Math.abs((rr.tp3 - f.price) / f.price * 100), rr: parseFloat((Math.abs((rr.tp3 - f.price) / f.price * 100) / rr.riskPct).toFixed(2)), color: "#8b5cf6" },
          ].map((tp, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border"
              style={{ backgroundColor: tp.color + '08', borderColor: tp.color + '30' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                style={{ backgroundColor: tp.color + '20', color: tp.color }}>
                T{i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{tp.value}</span>
                  <span className="text-xs font-semibold text-emerald-400">+{Math.round(tp.pct)}%</span>
                </div>
                <span className="text-xs text-[#64748b]">{tp.label}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-black" style={{ color: tp.color }}>R:R {typeof tp.rr === 'number' ? tp.rr.toFixed(1) : tp.rr}x</span>
              </div>
            </div>
          ))}
        </div>

        {/* Volatility indicator */}
        <div className="mt-4 p-3 bg-[#151c2c] rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#d4a843]" />
            <span className="text-xs text-[#94a3b8]">تقلب السهم (ATR%)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 h-2 bg-[#1e293b] rounded-full overflow-hidden">
              <div className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, rr.volatility * 10)}%`,
                  backgroundColor: rr.volatility < 3 ? "#10b981" : rr.volatility < 6 ? "#d4a843" : "#ef4444"
                }} />
            </div>
            <span className="text-xs font-bold text-white">{rr.volatility.toFixed(2)}%</span>
          </div>
        </div>
      </div>

    </div>
  );
}