import React, { useMemo } from "react";
import { Target, Shield, TrendingUp, TrendingDown, ArrowDown, ArrowUp, Zap, AlertTriangle } from "lucide-react";

// ===== Pivot Points =====
const calcPivots = (data) => {
  if (data.length < 5) return null;
  const recent = data.slice(-20);
  const high = Math.max(...recent.map(d => d.high));
  const low = Math.min(...recent.map(d => d.low));
  const close = recent[recent.length - 1].close;
  const pp = (high + low + close) / 3;
  return {
    pp, r1: 2 * pp - low, r2: pp + (high - low), r3: high + 2 * (pp - low),
    s1: 2 * pp - high, s2: pp - (high - low), s3: low - 2 * (high - pp),
  };
};

// ===== Swing Levels =====
const findSwings = (data, lookback = 5) => {
  const highs = [], lows = [];
  for (let i = lookback; i < data.length - lookback; i++) {
    const window = data.slice(i - lookback, i + lookback + 1);
    if (data[i].high === Math.max(...window.map(d => d.high))) highs.push(data[i].high);
    if (data[i].low === Math.min(...window.map(d => d.low))) lows.push(data[i].low);
  }
  return { highs: [...new Set(highs)].sort((a, b) => b - a).slice(0, 4), lows: [...new Set(lows)].sort((a, b) => b - a).slice(0, 4) };
};

// ===== EMA =====
const calcEMA = (data, period) => {
  const k = 2 / (period + 1);
  let ema = data[0].close;
  for (let i = 1; i < data.length; i++) ema = data[i].close * k + ema * (1 - k);
  return ema;
};

// ===== ATR =====
const calcATR = (data, period = 14) => {
  const trs = data.map((d, i) => {
    if (i === 0) return d.high - d.low;
    return Math.max(d.high - d.low, Math.abs(d.high - data[i - 1].close), Math.abs(d.low - data[i - 1].close));
  });
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
};

// ===== Main computation =====
const computeSRLevels = (data) => {
  if (!data || data.length < 20) return null;

  const last = data[data.length - 1];
  const price = last.close;
  const pivots = calcPivots(data);
  const { highs: swingHighs, lows: swingLows } = findSwings(data);
  const atr = calcATR(data);
  const ema20 = calcEMA(data, 20);
  const ema50 = calcEMA(data.length >= 50 ? data : data, Math.min(50, data.length));
  const ema200 = calcEMA(data.length >= 200 ? data : data, Math.min(200, data.length));

  // Resistances: all levels above price
  const resistanceLevels = [
    ...swingHighs.filter(h => h > price).map(h => ({ level: h, source: "Swing High", color: "#ef4444", strength: 2 })),
    pivots?.r1 && pivots.r1 > price ? { level: pivots.r1, source: "R1 Pivot", color: "#f87171", strength: 2 } : null,
    pivots?.r2 && pivots.r2 > price ? { level: pivots.r2, source: "R2 Pivot", color: "#ef4444", strength: 3 } : null,
    ema20 > price ? { level: ema20, source: "EMA 20", color: "#f59e0b", strength: 1 } : null,
    ema50 > price ? { level: ema50, source: "EMA 50", color: "#f97316", strength: 2 } : null,
    ema200 > price ? { level: ema200, source: "EMA 200", color: "#ef4444", strength: 3 } : null,
  ].filter(Boolean).sort((a, b) => a.level - b.level).slice(0, 4);

  // Supports: all levels below price
  const supportLevels = [
    ...swingLows.filter(l => l < price).map(l => ({ level: l, source: "Swing Low", color: "#10b981", strength: 2 })),
    pivots?.s1 && pivots.s1 < price ? { level: pivots.s1, source: "S1 Pivot", color: "#34d399", strength: 2 } : null,
    pivots?.s2 && pivots.s2 < price ? { level: pivots.s2, source: "S2 Pivot", color: "#10b981", strength: 3 } : null,
    ema20 < price ? { level: ema20, source: "EMA 20", color: "#a78bfa", strength: 1 } : null,
    ema50 < price ? { level: ema50, source: "EMA 50", color: "#8b5cf6", strength: 2 } : null,
    ema200 < price ? { level: ema200, source: "EMA 200", color: "#6d28d9", strength: 3 } : null,
  ].filter(Boolean).sort((a, b) => b.level - a.level).slice(0, 4);

  // Entry / Exit zones
  const nearestResistance = resistanceLevels[0]?.level;
  const nearestSupport = supportLevels[0]?.level;

  // Entry: long near strong support, short near strong resistance
  const distToSupport = nearestSupport ? ((price - nearestSupport) / price * 100) : 999;
  const distToResistance = nearestResistance ? ((nearestResistance - price) / price * 100) : 999;

  const isNearSupport = distToSupport < 2.5;
  const isNearResistance = distToResistance < 2.5;

  // Long setup
  const longEntry = nearestSupport ? parseFloat((nearestSupport * 1.001).toFixed(2)) : null;
  const longSL = nearestSupport ? parseFloat((nearestSupport * (1 - atr / price)).toFixed(2)) : null;
  const longTP1 = nearestResistance ? parseFloat((nearestResistance * 0.99).toFixed(2)) : null;
  const longTP2 = resistanceLevels[1]?.level ? parseFloat((resistanceLevels[1].level * 0.99).toFixed(2)) : null;
  const longRR = longEntry && longSL && longTP1 ? parseFloat(((longTP1 - longEntry) / (longEntry - longSL)).toFixed(2)) : null;

  // Short setup
  const shortEntry = nearestResistance ? parseFloat((nearestResistance * 0.999).toFixed(2)) : null;
  const shortSL = nearestResistance ? parseFloat((nearestResistance * (1 + atr / price)).toFixed(2)) : null;
  const shortTP1 = nearestSupport ? parseFloat((nearestSupport * 1.01).toFixed(2)) : null;
  const shortRR = shortEntry && shortSL && shortTP1 ? parseFloat(((shortEntry - shortTP1) / (shortSL - shortEntry)).toFixed(2)) : null;

  // Zone quality
  const zoneQuality = isNearSupport ? "قرب دعم قوي — فرصة شراء محتملة" :
    isNearResistance ? "قرب مقاومة قوية — احذر / فرصة بيع" :
      distToSupport < 5 ? "قريب من دعم — ترقب الدخول" : "منتصف المنطقة — انتظر الوضوح";

  return {
    price, pivots, resistanceLevels, supportLevels,
    nearestResistance, nearestSupport, distToSupport, distToResistance,
    isNearSupport, isNearResistance, zoneQuality, atr,
    longEntry, longSL, longTP1, longTP2, longRR,
    shortEntry, shortSL, shortTP1, shortRR,
    ema20, ema50, ema200,
  };
};

// ===== Level Row =====
const LevelRow = ({ level, source, color, strength, price }) => {
  const pct = ((level - price) / price * 100);
  const isAbove = level > price;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#1a2235] last:border-0">
      <div className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#94a3b8]">{source}</span>
          <span className="text-xs font-bold" style={{ color }}>
            {isAbove ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm font-black text-white">{level.toFixed(2)}</span>
          <div className="flex gap-0.5">
            {[1, 2, 3].map(s => (
              <div key={s} className="w-2 h-2 rounded-sm" style={{ backgroundColor: s <= strength ? color : '#1e293b' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SupportResistancePanel({ data }) {
  const sr = useMemo(() => computeSRLevels(data), [data]);

  if (!sr) return (
    <div className="flex items-center justify-center py-8 text-[#64748b] text-sm">
      يتطلب 20 شمعة على الأقل
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Zone Quality Banner */}
      <div className={`rounded-xl p-4 border flex items-center gap-3 ${sr.isNearSupport ? 'bg-emerald-500/10 border-emerald-500/30' : sr.isNearResistance ? 'bg-red-500/10 border-red-500/30' : 'bg-[#d4a843]/10 border-[#d4a843]/30'}`}>
        <div className="text-2xl">{sr.isNearSupport ? "🟢" : sr.isNearResistance ? "🔴" : "🟡"}</div>
        <div>
          <p className={`text-sm font-bold ${sr.isNearSupport ? 'text-emerald-400' : sr.isNearResistance ? 'text-red-400' : 'text-[#d4a843]'}`}>
            {sr.zoneQuality}
          </p>
          <p className="text-xs text-[#64748b] mt-0.5">
            السعر الحالي: <span className="text-white font-bold">{sr.price.toFixed(2)}</span>
            {sr.nearestSupport && <> • دعم: <span className="text-emerald-400 font-bold">{sr.nearestSupport.toFixed(2)}</span></>}
            {sr.nearestResistance && <> • مقاومة: <span className="text-red-400 font-bold">{sr.nearestResistance.toFixed(2)}</span></>}
          </p>
        </div>
      </div>

      {/* Price Map Visual */}
      <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-4">
        <p className="text-xs font-bold text-[#64748b] mb-3">خريطة المستويات السعرية</p>
        <div className="relative">
          {/* Resistance levels */}
          {sr.resistanceLevels.map((r, i) => {
            const pct = Math.min(90, Math.max(5, ((r.level - sr.price) / (sr.atr * 15)) * 50 + 50));
            return (
              <div key={i} className="flex items-center gap-2 mb-1.5" style={{ marginRight: `${Math.min(i * 8, 20)}px` }}>
                <div className="text-xs font-bold w-20 text-right shrink-0" style={{ color: r.color }}>{r.level.toFixed(2)}</div>
                <div className="flex-1 h-5 rounded-lg flex items-center px-2 text-[10px] font-bold text-white relative overflow-hidden"
                  style={{ backgroundColor: r.color + '20', border: `1px solid ${r.color}40` }}>
                  <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(90deg, ${r.color}00, ${r.color}40)` }} />
                  <span style={{ color: r.color }}>{r.source}</span>
                  <span className="mr-auto opacity-60">▲ {((r.level - sr.price) / sr.price * 100).toFixed(1)}%</span>
                </div>
              </div>
            );
          })}

          {/* Current Price */}
          <div className="flex items-center gap-2 my-3">
            <div className="text-xs font-black w-20 text-right text-white">{sr.price.toFixed(2)}</div>
            <div className="flex-1 h-6 rounded-lg flex items-center px-2 bg-[#d4a843]/20 border-2 border-[#d4a843] text-[10px] font-black text-[#d4a843]">
              ← السعر الحالي
              <div className="mr-auto flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4a843] animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4a843] animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4a843] animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>

          {/* Support levels */}
          {sr.supportLevels.map((s, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5" style={{ marginRight: `${Math.min(i * 8, 20)}px` }}>
              <div className="text-xs font-bold w-20 text-right shrink-0" style={{ color: s.color }}>{s.level.toFixed(2)}</div>
              <div className="flex-1 h-5 rounded-lg flex items-center px-2 text-[10px] font-bold text-white relative overflow-hidden"
                style={{ backgroundColor: s.color + '20', border: `1px solid ${s.color}40` }}>
                <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(90deg, ${s.color}00, ${s.color}40)` }} />
                <span style={{ color: s.color }}>{s.source}</span>
                <span className="mr-auto opacity-60">▼ {((sr.price - s.level) / sr.price * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resistance & Support Tables */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Resistances */}
        <div className="bg-[#0f1623] border border-red-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-red-400" />
            <h4 className="text-sm font-bold text-white">مستويات المقاومة</h4>
          </div>
          {sr.resistanceLevels.length > 0 ? sr.resistanceLevels.map((r, i) => (
            <LevelRow key={i} {...r} price={sr.price} />
          )) : <p className="text-xs text-[#64748b]">لا توجد مقاومات فوق السعر</p>}
        </div>

        {/* Supports */}
        <div className="bg-[#0f1623] border border-emerald-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">مستويات الدعم</h4>
          </div>
          {sr.supportLevels.length > 0 ? sr.supportLevels.map((s, i) => (
            <LevelRow key={i} {...s} price={sr.price} />
          )) : <p className="text-xs text-[#64748b]">لا توجد دعوم تحت السعر</p>}
        </div>
      </div>

      {/* Entry / Exit Zones */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Long Setup */}
        <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUp className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-emerald-400">إعداد الشراء (Long)</h4>
            {sr.longRR && (
              <span className={`mr-auto text-xs font-black px-2 py-0.5 rounded-full ${sr.longRR >= 2 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-[#1e293b] text-[#94a3b8]'}`}>
                R:R {sr.longRR}x
              </span>
            )}
          </div>
          <div className="space-y-2">
            {[
              { label: "نقطة الدخول", value: sr.longEntry, color: "text-white", icon: "⚡" },
              { label: "وقف الخسارة (SL)", value: sr.longSL, color: "text-red-400", icon: "🛑" },
              { label: "هدف 1 (TP1)", value: sr.longTP1, color: "text-emerald-400", icon: "🎯" },
              { label: "هدف 2 (TP2)", value: sr.longTP2, color: "text-emerald-300", icon: "🎯" },
            ].map(item => item.value && (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-emerald-500/10 last:border-0">
                <span className="text-xs text-[#94a3b8]">{item.icon} {item.label}</span>
                <span className={`text-sm font-black ${item.color}`}>{item.value}</span>
              </div>
            ))}
            {sr.distToSupport !== undefined && (
              <div className="mt-2 pt-2 border-t border-emerald-500/10 text-xs text-[#64748b] flex items-center justify-between">
                <span>بُعد الدخول عن السعر</span>
                <span className={`font-bold ${sr.isNearSupport ? 'text-emerald-400' : 'text-[#d4a843]'}`}>
                  {sr.distToSupport.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Short Setup */}
        <div className="bg-red-500/5 border border-red-500/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDown className="w-4 h-4 text-red-400" />
            <h4 className="text-sm font-bold text-red-400">إعداد البيع (Short)</h4>
            {sr.shortRR && (
              <span className={`mr-auto text-xs font-black px-2 py-0.5 rounded-full ${sr.shortRR >= 2 ? 'bg-red-500/20 text-red-300' : 'bg-[#1e293b] text-[#94a3b8]'}`}>
                R:R {sr.shortRR}x
              </span>
            )}
          </div>
          <div className="space-y-2">
            {[
              { label: "نقطة الدخول", value: sr.shortEntry, color: "text-white", icon: "⚡" },
              { label: "وقف الخسارة (SL)", value: sr.shortSL, color: "text-red-400", icon: "🛑" },
              { label: "هدف 1 (TP1)", value: sr.shortTP1, color: "text-emerald-400", icon: "🎯" },
            ].map(item => item.value && (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-red-500/10 last:border-0">
                <span className="text-xs text-[#94a3b8]">{item.icon} {item.label}</span>
                <span className={`text-sm font-black ${item.color}`}>{item.value}</span>
              </div>
            ))}
            {sr.distToResistance !== undefined && (
              <div className="mt-2 pt-2 border-t border-red-500/10 text-xs text-[#64748b] flex items-center justify-between">
                <span>بُعد المقاومة عن السعر</span>
                <span className={`font-bold ${sr.isNearResistance ? 'text-red-400' : 'text-[#d4a843]'}`}>
                  {sr.distToResistance.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EMAs quick view */}
      <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-4">
        <p className="text-xs font-bold text-[#64748b] mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#d4a843]" /> المتوسطات المتحركة كدعم/مقاومة
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "EMA 20", value: sr.ema20, period: 20, color: "#f59e0b" },
            { label: "EMA 50", value: sr.ema50, period: 50, color: "#f97316" },
            { label: "EMA 200", value: sr.ema200, period: 200, color: "#ef4444" },
          ].map(ema => {
            const isAbove = ema.value > sr.price;
            return (
              <div key={ema.label} className="text-center p-3 rounded-xl border"
                style={{ borderColor: ema.color + '40', backgroundColor: ema.color + '10' }}>
                <p className="text-xs font-bold mb-1" style={{ color: ema.color }}>{ema.label}</p>
                <p className="text-sm font-black text-white">{ema.value.toFixed(2)}</p>
                <p className="text-xs mt-1" style={{ color: isAbove ? "#ef4444" : "#10b981" }}>
                  {isAbove ? "↑ مقاومة" : "↓ دعم"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}