import React, { useMemo } from "react";
import { calcOBV, calcAD, calcMFI, calcCMF, calcVSA, calcVWAP, calcATR, detectCandlePatterns, detectWyckoffPhase } from "./SmartIndicators";
import { Target, TrendingUp, TrendingDown, Zap, Shield, AlertTriangle, ChevronRight } from "lucide-react";

// ===== Fibonacci Retracement =====
const calcFibLevels = (data) => {
  const prices = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const swingHigh = Math.max(...highs);
  const swingLow = Math.min(...lows);
  const range = swingHigh - swingLow;
  return {
    swingHigh, swingLow, range,
    fib236: parseFloat((swingHigh - range * 0.236).toFixed(2)),
    fib382: parseFloat((swingHigh - range * 0.382).toFixed(2)),
    fib500: parseFloat((swingHigh - range * 0.500).toFixed(2)),
    fib618: parseFloat((swingHigh - range * 0.618).toFixed(2)),
    fib786: parseFloat((swingHigh - range * 0.786).toFixed(2)),
    ext1272: parseFloat((swingHigh + range * 0.272).toFixed(2)),
    ext1618: parseFloat((swingHigh + range * 0.618).toFixed(2)),
    ext2618: parseFloat((swingHigh + range * 1.618).toFixed(2)),
  };
};

// ===== Pivot Points (Standard + Camarilla) =====
const calcPivots = (data) => {
  const recent = data.slice(-20);
  const h = Math.max(...recent.map(d => d.high));
  const l = Math.min(...recent.map(d => d.low));
  const c = recent[recent.length - 1].close;
  const pp = (h + l + c) / 3;
  const r1 = parseFloat((2 * pp - l).toFixed(2));
  const r2 = parseFloat((pp + (h - l)).toFixed(2));
  const r3 = parseFloat((h + 2 * (pp - l)).toFixed(2));
  const s1 = parseFloat((2 * pp - h).toFixed(2));
  const s2 = parseFloat((pp - (h - l)).toFixed(2));
  const s3 = parseFloat((l - 2 * (h - pp)).toFixed(2));
  // Camarilla
  const cr4 = parseFloat((c + (h - l) * 1.1 / 2).toFixed(2));
  const cr3 = parseFloat((c + (h - l) * 1.1 / 4).toFixed(2));
  const cs4 = parseFloat((c - (h - l) * 1.1 / 2).toFixed(2));
  const cs3 = parseFloat((c - (h - l) * 1.1 / 4).toFixed(2));
  return { pp: parseFloat(pp.toFixed(2)), r1, r2, r3, s1, s2, s3, cr4, cr3, cs4, cs3 };
};

// ===== EMA Targets =====
const calcEMATargets = (data) => {
  const calcEMA = (arr, period) => {
    const k = 2 / (period + 1);
    let ema = arr[0];
    return arr.map((v, i) => { if (i === 0) return ema; ema = v * k + ema * (1 - k); return ema; });
  };
  const closes = data.map(d => d.close);
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const ema100 = calcEMA(closes, 100);
  const ema200 = calcEMA(closes, 200);
  return {
    ema20: parseFloat(ema20[ema20.length - 1].toFixed(2)),
    ema50: parseFloat(ema50[ema50.length - 1].toFixed(2)),
    ema100: parseFloat(ema100[ema100.length - 1].toFixed(2)),
    ema200: parseFloat(ema200[ema200.length - 1].toFixed(2)),
  };
};

// ===== ATR-based targets =====
const calcATRTargets = (price, atr) => ({
  tp1: parseFloat((price + atr * 1.5).toFixed(2)),
  tp2: parseFloat((price + atr * 3).toFixed(2)),
  tp3: parseFloat((price + atr * 5).toFixed(2)),
  sl1: parseFloat((price - atr * 1).toFixed(2)),
  sl2: parseFloat((price - atr * 2).toFixed(2)),
});

// ===== Volume Profile / High Volume Nodes =====
const calcVolumeProfile = (data) => {
  const prices = data.map(d => d.close);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const buckets = 10;
  const step = (maxP - minP) / buckets;
  const profile = Array.from({ length: buckets }, (_, i) => ({
    priceLevel: parseFloat((minP + step * i + step / 2).toFixed(2)),
    volume: 0,
  }));
  data.forEach(d => {
    const idx = Math.min(buckets - 1, Math.floor((d.close - minP) / step));
    if (idx >= 0) profile[idx].volume += d.volume;
  });
  profile.sort((a, b) => b.volume - a.volume);
  return {
    hvn: profile[0].priceLevel, // High Volume Node
    hvn2: profile[1].priceLevel,
    lvn: profile[profile.length - 1].priceLevel, // Low Volume Node
  };
};

// ===== UNIFIED TARGET ENGINE =====
export const computeTargets = (data) => {
  if (!data || data.length < 20) return null;

  const last = data[data.length - 1];
  const price = last.close;

  // All indicator values
  const obv = calcOBV(data);
  const ad = calcAD(data);
  const mfi = calcMFI(data);
  const cmf = calcCMF(data);
  const vsa = calcVSA(data);
  const patterns = detectCandlePatterns(vsa);
  const vwap = calcVWAP(data);
  const atrData = calcATR(data);
  const wyckoff = detectWyckoffPhase(data);
  const fib = calcFibLevels(data);
  const pivots = calcPivots(data);
  const emaT = calcEMATargets(data);
  const volProfile = calcVolumeProfile(data);

  const atr = atrData[atrData.length - 1]?.atr ?? price * 0.02;
  const vwapVal = vwap[vwap.length - 1]?.vwap;
  const lastMFI = mfi[mfi.length - 1]?.mfi ?? 50;
  const lastCMF = cmf[cmf.length - 1]?.cmf ?? 0;
  const lastOBV = obv[obv.length - 1]?.obv ?? 0;
  const prevOBV = obv[Math.max(0, obv.length - 6)]?.obv ?? 0;
  const lastAD = ad[ad.length - 1]?.ad ?? 0;
  const prevAD = ad[Math.max(0, ad.length - 6)]?.ad ?? 0;
  const lastCandle = patterns[patterns.length - 1];
  const atrTargets = calcATRTargets(price, atr);

  // === CONFLUENCE SCORING for direction ===
  let bullScore = 0, bearScore = 0;
  const signals = [];

  // OBV
  if (lastOBV > prevOBV) { bullScore += 15; signals.push({ text: "OBV صاعد", dir: "bull", weight: 15 }); }
  else { bearScore += 15; signals.push({ text: "OBV هابط", dir: "bear", weight: 15 }); }

  // A/D
  if (lastAD > prevAD) { bullScore += 12; signals.push({ text: "A/D: تجميع", dir: "bull", weight: 12 }); }
  else { bearScore += 12; signals.push({ text: "A/D: تصريف", dir: "bear", weight: 12 }); }

  // CMF
  if (lastCMF > 0.1) { bullScore += 15; signals.push({ text: `CMF ${lastCMF.toFixed(2)} (شراء)`, dir: "bull", weight: 15 }); }
  else if (lastCMF < -0.1) { bearScore += 15; signals.push({ text: `CMF ${lastCMF.toFixed(2)} (بيع)`, dir: "bear", weight: 15 }); }

  // MFI
  if (lastMFI < 20) { bullScore += 18; signals.push({ text: `MFI ${lastMFI.toFixed(0)} (فرصة شراء)`, dir: "bull", weight: 18 }); }
  else if (lastMFI > 80) { bearScore += 18; signals.push({ text: `MFI ${lastMFI.toFixed(0)} (تشبع بيعي)`, dir: "bear", weight: 18 }); }

  // Price vs VWAP
  if (price > vwapVal) { bullScore += 8; signals.push({ text: "فوق VWAP", dir: "bull", weight: 8 }); }
  else { bearScore += 8; signals.push({ text: "تحت VWAP", dir: "bear", weight: 8 }); }

  // Price vs EMA
  if (price > emaT.ema50) { bullScore += 10; signals.push({ text: "فوق EMA 50", dir: "bull", weight: 10 }); }
  else { bearScore += 10; signals.push({ text: "تحت EMA 50", dir: "bear", weight: 10 }); }
  if (price > emaT.ema200) { bullScore += 12; signals.push({ text: "فوق EMA 200 (صاعد طويل)", dir: "bull", weight: 12 }); }
  else { bearScore += 12; signals.push({ text: "تحت EMA 200 (هابط طويل)", dir: "bear", weight: 12 }); }

  // Candle pattern
  if (lastCandle?.patternType?.includes("bullish") || lastCandle?.patternType === "strong_bullish") {
    bullScore += 15; signals.push({ text: lastCandle.candlePattern, dir: "bull", weight: 15 });
  } else if (lastCandle?.patternType?.includes("bearish") || lastCandle?.patternType === "strong_bearish") {
    bearScore += 15; signals.push({ text: lastCandle.candlePattern, dir: "bear", weight: 15 });
  }

  // Wyckoff
  if (wyckoff?.phase === "E" || wyckoff?.phase === "C+") { bullScore += 20; signals.push({ text: wyckoff.name, dir: "bull", weight: 20 }); }
  if (wyckoff?.phase === "E-" || wyckoff?.phase === "C-") { bearScore += 20; signals.push({ text: wyckoff.name, dir: "bear", weight: 20 }); }

  // VSA on last candle
  if (lastCandle?.vsaSignal) {
    if (lastCandle.vsaColor === "#10b981" || lastCandle.vsaColor === "#3b82f6") {
      bullScore += 10; signals.push({ text: lastCandle.vsaSignal, dir: "bull", weight: 10 });
    } else if (lastCandle.vsaColor === "#ef4444" || lastCandle.vsaColor === "#f59e0b") {
      bearScore += 10; signals.push({ text: lastCandle.vsaSignal, dir: "bear", weight: 10 });
    }
  }

  const totalScore = bullScore + bearScore;
  const confluenceScore = Math.round(bullScore / (totalScore || 1) * 100);
  const isBull = confluenceScore >= 50;

  // === TARGET LEVELS (merged from Fib + Pivot + ATR + EMA + Volume Profile) ===
  const upTargets = [
    { level: pivots.r1, label: "R1 محور", source: "Pivot", confidence: 70 },
    { level: pivots.r2, label: "R2 محور", source: "Pivot", confidence: 60 },
    { level: pivots.r3, label: "R3 محور", source: "Pivot", confidence: 45 },
    { level: fib.fib236, label: "Fib 23.6%", source: "Fibonacci", confidence: 65 },
    { level: fib.ext1272, label: "Fib Ext 127%", source: "Fibonacci", confidence: 75 },
    { level: fib.ext1618, label: "Fib Ext 161.8%", source: "Fibonacci", confidence: 80 },
    { level: fib.ext2618, label: "Fib Ext 261.8%", source: "Fibonacci", confidence: 55 },
    { level: emaT.ema50, label: "EMA 50", source: "EMA", confidence: 70 },
    { level: emaT.ema100, label: "EMA 100", source: "EMA", confidence: 65 },
    { level: emaT.ema200, label: "EMA 200", source: "EMA", confidence: 85 },
    { level: atrTargets.tp1, label: "TP1 (ATR×1.5)", source: "ATR", confidence: 72 },
    { level: atrTargets.tp2, label: "TP2 (ATR×3)", source: "ATR", confidence: 65 },
    { level: atrTargets.tp3, label: "TP3 (ATR×5)", source: "ATR", confidence: 55 },
    { level: volProfile.hvn, label: "HVN (عقدة حجم)", source: "Volume", confidence: 78 },
    { level: vwapVal, label: "VWAP", source: "VWAP", confidence: 68 },
    { level: pivots.cr4, label: "Camarilla R4", source: "Camarilla", confidence: 62 },
  ].filter(t => t.level > price).sort((a, b) => a.level - b.level).slice(0, 5);

  const downTargets = [
    { level: pivots.s1, label: "S1 محور", source: "Pivot", confidence: 70 },
    { level: pivots.s2, label: "S2 محور", source: "Pivot", confidence: 60 },
    { level: pivots.s3, label: "S3 محور", source: "Pivot", confidence: 45 },
    { level: fib.fib382, label: "Fib 38.2%", source: "Fibonacci", confidence: 75 },
    { level: fib.fib500, label: "Fib 50%", source: "Fibonacci", confidence: 70 },
    { level: fib.fib618, label: "Fib 61.8%", source: "Fibonacci", confidence: 82 },
    { level: fib.fib786, label: "Fib 78.6%", source: "Fibonacci", confidence: 65 },
    { level: emaT.ema20, label: "EMA 20", source: "EMA", confidence: 68 },
    { level: emaT.ema50, label: "EMA 50", source: "EMA", confidence: 72 },
    { level: atrTargets.sl1, label: "SL1 (ATR×1)", source: "ATR", confidence: 75 },
    { level: atrTargets.sl2, label: "SL2 (ATR×2)", source: "ATR", confidence: 65 },
    { level: volProfile.hvn2, label: "HVN2 (عقدة حجم2)", source: "Volume", confidence: 72 },
    { level: pivots.cs4, label: "Camarilla S4", source: "Camarilla", confidence: 62 },
  ].filter(t => t.level < price).sort((a, b) => b.level - a.level).slice(0, 5);

  // Best unified targets (top 3 by confidence)
  const primaryTargets = isBull ? upTargets.slice(0, 3) : downTargets.slice(0, 3);
  const stopLoss = isBull ? atrTargets.sl1 : atrTargets.tp1;
  const riskReward = primaryTargets[0]
    ? Math.abs(primaryTargets[0].level - price) / Math.abs(stopLoss - price)
    : 0;

  return {
    price, confluenceScore, isBull, signals,
    bullScore, bearScore,
    upTargets, downTargets, primaryTargets,
    stopLoss, riskReward: parseFloat(riskReward.toFixed(2)),
    fib, pivots, emaT, atrTargets, vwapVal, atr, wyckoff,
  };
};

const sourceColors = {
  Fibonacci: "#d4a843",
  Pivot: "#3b82f6",
  EMA: "#8b5cf6",
  ATR: "#10b981",
  Volume: "#f59e0b",
  VWAP: "#06b6d4",
  Camarilla: "#a855f7",
};

const ConfidenceBar = ({ value, color }) => (
  <div className="flex items-center gap-1.5 flex-1">
    <div className="flex-1 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
    <span className="text-xs text-[#64748b] w-8 text-left">{value}%</span>
  </div>
);

export default function TargetEngine({ data }) {
  const result = useMemo(() => computeTargets(data), [data]);

  if (!result) return null;

  const { price, confluenceScore, isBull, signals, bullScore, bearScore,
    upTargets, downTargets, primaryTargets, stopLoss, riskReward,
    fib, pivots, emaT, atrTargets, vwapVal, atr } = result;

  const dirColor = isBull ? "#10b981" : "#ef4444";
  const dirLabel = confluenceScore >= 80 ? "صاعد قوي جداً" : confluenceScore >= 65 ? "صاعد" : confluenceScore >= 55 ? "صاعد خفيف" : confluenceScore >= 45 ? "هابط خفيف" : confluenceScore >= 35 ? "هابط" : "هابط قوي جداً";
  const bullSignals = signals.filter(s => s.dir === "bull");
  const bearSignals = signals.filter(s => s.dir === "bear");

  return (
    <div className="space-y-4">

      {/* === CONFLUENCE METER === */}
      <div className="bg-gradient-to-l from-[#0f1623] to-[#111827] border border-[#1e293b] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-[#d4a843]" />
          <h3 className="text-base font-bold text-white">محرك الأهداف الموحد</h3>
          <span className="text-xs text-[#64748b] mr-auto">تقاطع {signals.length} مؤشر</span>
        </div>

        {/* Bull/Bear tug of war bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-emerald-400 font-bold">شراء {bullScore}%</span>
            <span className="text-sm font-black" style={{ color: dirColor }}>{dirLabel}</span>
            <span className="text-red-400 font-bold">بيع {bearScore}%</span>
          </div>
          <div className="relative h-5 bg-[#1e293b] rounded-full overflow-hidden">
            {/* Bear side */}
            <div className="absolute inset-y-0 right-0 rounded-full"
              style={{ width: `${bearScore}%`, background: 'linear-gradient(270deg, #ef4444, #f87171)' }} />
            {/* Bull side */}
            <div className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${bullScore}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
            {/* Center line */}
            <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-black text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {confluenceScore}% {isBull ? "▲" : "▼"}
              </span>
            </div>
          </div>
        </div>

        {/* Signals grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <p className="text-xs text-emerald-400 font-bold mb-2">إشارات الشراء ({bullSignals.length})</p>
            {bullSignals.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[#94a3b8] truncate">{s.text}</span>
                <span className="text-emerald-400 text-xs mr-auto shrink-0">+{s.weight}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-red-400 font-bold mb-2">إشارات البيع ({bearSignals.length})</p>
            {bearSignals.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="text-[#94a3b8] truncate">{s.text}</span>
                <span className="text-red-400 text-xs mr-auto shrink-0">+{s.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === PRIMARY TARGETS === */}
      <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-[#d4a843]" />
          <h3 className="text-base font-bold text-white">الأهداف الرئيسية الموصى بها</h3>
        </div>

        {/* Entry + SL + RR */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-500/8 border border-blue-500/25 rounded-xl p-3 text-center">
            <p className="text-xs text-[#64748b]">سعر الدخول</p>
            <p className="text-lg font-black text-blue-400">{price.toFixed(2)}</p>
            <p className="text-xs text-[#64748b] mt-0.5">السعر الحالي</p>
          </div>
          <div className="bg-red-500/8 border border-red-500/25 rounded-xl p-3 text-center">
            <p className="text-xs text-[#64748b]">وقف الخسارة</p>
            <p className="text-lg font-black text-red-400">{stopLoss.toFixed(2)}</p>
            <p className="text-xs text-red-400 mt-0.5">-{Math.abs((stopLoss - price) / price * 100).toFixed(1)}%</p>
          </div>
          <div className={`border rounded-xl p-3 text-center ${riskReward >= 2 ? 'bg-emerald-500/8 border-emerald-500/25' : 'bg-amber-500/8 border-amber-500/25'}`}>
            <p className="text-xs text-[#64748b]">نسبة R:R</p>
            <p className={`text-lg font-black ${riskReward >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>{riskReward}x</p>
            <p className={`text-xs mt-0.5 ${riskReward >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {riskReward >= 3 ? "ممتاز ✓" : riskReward >= 2 ? "جيد ✓" : "مقبول"}
            </p>
          </div>
        </div>

        {/* TP Targets */}
        <div className="space-y-2">
          {primaryTargets.map((t, i) => {
            const pct = ((t.level - price) / price * 100);
            const sc = sourceColors[t.source] || "#94a3b8";
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ backgroundColor: sc + '08', borderColor: sc + '30' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0"
                  style={{ backgroundColor: sc + '20', color: sc }}>
                  T{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{t.level.toFixed(2)}</span>
                    <span className="text-xs font-semibold" style={{ color: isBull ? "#10b981" : "#ef4444" }}>
                      {isBull ? "+" : ""}{pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#64748b]">{t.label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: sc + '20', color: sc }}>{t.source}</span>
                  </div>
                </div>
                <ConfidenceBar value={t.confidence} color={sc} />
              </div>
            );
          })}
        </div>
      </div>

      {/* === FULL LEVELS MAP === */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Up targets */}
        <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">مستويات المقاومة والأهداف</h4>
          </div>
          <div className="space-y-1.5">
            {upTargets.map((t, i) => {
              const sc = sourceColors[t.source] || "#94a3b8";
              const pct = ((t.level - price) / price * 100).toFixed(1);
              return (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#1a2235] last:border-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc }} />
                  <span className="text-xs text-[#64748b] flex-1 truncate">{t.label}</span>
                  <span className="text-xs text-emerald-400 font-semibold">+{pct}%</span>
                  <span className="text-xs font-bold text-white w-16 text-left">{t.level.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Down targets */}
        <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <h4 className="text-sm font-bold text-white">مستويات الدعم ووقف الخسارة</h4>
          </div>
          <div className="space-y-1.5">
            {downTargets.map((t, i) => {
              const sc = sourceColors[t.source] || "#94a3b8";
              const pct = ((t.level - price) / price * 100).toFixed(1);
              return (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#1a2235] last:border-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc }} />
                  <span className="text-xs text-[#64748b] flex-1 truncate">{t.label}</span>
                  <span className="text-xs text-red-400 font-semibold">{pct}%</span>
                  <span className="text-xs font-bold text-white w-16 text-left">{t.level.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* === KEY LEVEL SUMMARY (Fib + Pivot + EMA) === */}
      <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-[#8b5cf6]" />
          <h4 className="text-sm font-bold text-white">خريطة المستويات الكاملة</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Fib 61.8%", value: fib.fib618, color: "#d4a843", type: "دعم قوي" },
            { label: "Pivot PP", value: pivots.pp, color: "#3b82f6", type: "محور" },
            { label: "EMA 200", value: emaT.ema200, color: "#8b5cf6", type: "دعم/مقاومة" },
            { label: "VWAP", value: vwapVal, color: "#06b6d4", type: "متوسط الحجم" },
            { label: "Pivot R1", value: pivots.r1, color: "#10b981", type: "مقاومة 1" },
            { label: "Pivot S1", value: pivots.s1, color: "#ef4444", type: "دعم 1" },
            { label: "Fib Ext 161.8%", value: fib.ext1618, color: "#f59e0b", type: "هدف بعيد" },
            { label: "ATR × 1.5", value: atrTargets.tp1, color: "#a855f7", type: "هدف قريب" },
          ].map((item) => {
            const diff = ((item.value - price) / price * 100);
            return (
              <div key={item.label} className="bg-[#151c2c] rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#64748b]">{item.label}</span>
                  <span className="text-xs font-semibold"
                    style={{ color: diff >= 0 ? "#10b981" : "#ef4444" }}>
                    {diff >= 0 ? "+" : ""}{diff.toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm font-bold text-white">{item.value?.toFixed(2)}</p>
                <div className="mt-1 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs" style={{ color: item.color }}>{item.type}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}