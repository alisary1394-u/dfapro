import React, { useMemo, useState } from "react";
import {
  calcOBV, calcAD, calcMFI, calcCMF, calcVSA, detectWyckoffPhase,
  detectCandlePatterns, calcVWAP, calcATR, calcLiquidityHeatmap
} from "./SmartIndicators";
import { Zap, Eye, AlertTriangle, Target, Activity, Droplets, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";

// ===== Strength Bar =====
const StrengthBar = ({ value, max = 100, color }) => (
  <div className="w-full bg-[#1e293b] rounded-full h-1.5 mt-1">
    <div className="h-1.5 rounded-full transition-all duration-700"
      style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
  </div>
);

// ===== Signal Card =====
const SignalCard = ({ signal, time, color, strength = 1 }) => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
    style={{ backgroundColor: color + '12', border: `1px solid ${color}35` }}>
    <div className="flex flex-col">
      <span className="text-xs font-bold leading-tight" style={{ color }}>{signal}</span>
      <span className="text-xs text-[#475569] mt-0.5">{time}</span>
    </div>
    <div className="flex gap-0.5 mr-auto">
      {[1, 2, 3].map(s => (
        <div key={s} className="w-1.5 h-3 rounded-sm"
          style={{ backgroundColor: s <= strength ? color : '#1e293b' }} />
      ))}
    </div>
  </div>
);

export default function SmartAnalysisPanel({ data }) {
  const [expandVSA, setExpandVSA] = useState(false);
  const [expandPatterns, setExpandPatterns] = useState(false);

  const analysis = useMemo(() => {
    if (!data || data.length < 15) return null;

    // Run all calculations
    const obv = calcOBV(data);
    const ad = calcAD(data);
    const mfi = calcMFI(data);
    const cmf = calcCMF(data);
    const vsaRaw = calcVSA(data);
    const withPatterns = detectCandlePatterns(vsaRaw);
    const vwap = calcVWAP(data);
    const atr = calcATR(data);
    const liq = calcLiquidityHeatmap(data);
    const wyckoff = detectWyckoffPhase(data);

    const last = withPatterns[withPatterns.length - 1];
    const n = data.length;

    // OBV slope (last 5 candles)
    const obvNow = obv[n - 1]?.obv;
    const obvPrev5 = obv[n - 6]?.obv ?? 0;
    const obvPrev15 = obv[n - 16]?.obv ?? 0;
    const obvTrend = obvNow > obvPrev5 ? "صاعد" : "هابط";
    const obvDivergence = (() => {
      const priceUp = data[n - 1].close > data[n - 6]?.close;
      const obvUp = obvNow > obvPrev5;
      if (priceUp && !obvUp) return { text: "تباعد هبوطي ⚠️", color: "#ef4444" };
      if (!priceUp && obvUp) return { text: "تباعد صعودي 🚀", color: "#10b981" };
      return null;
    })();

    // AD slope
    const adNow = ad[n - 1]?.ad;
    const adPrev = ad[n - 6]?.ad ?? 0;
    const adFlow = adNow > adPrev ? "تجميع" : "تصريف";
    const adMomentum = Math.abs(adNow - adPrev) / (Math.abs(adPrev) || 1) * 100;

    // MFI
    const lastMFI = mfi[n - 1]?.mfi;
    const mfiTrend = lastMFI > (mfi[n - 6]?.mfi ?? 50) ? "صاعد" : "هابط";

    // CMF
    const lastCMF = cmf[n - 1]?.cmf ?? 0;
    const cmfSignal = lastCMF > 0.15 ? "ضغط شراء قوي" : lastCMF > 0 ? "ضغط شراء خفيف" : lastCMF < -0.15 ? "ضغط بيع قوي" : "ضغط بيع خفيف";

    // VWAP
    const lastVWAP = vwap[n - 1]?.vwap;
    const lastATR = atr[n - 1]?.atr;
    const volatility = lastATR && last?.close ? (lastATR / last.close * 100) : 0;

    // Liquidity summary (last 10)
    const recentLiq = liq.slice(-10);
    const totalBuy = recentLiq.reduce((s, d) => s + d.buyPressure, 0);
    const totalSell = recentLiq.reduce((s, d) => s + d.sellPressure, 0);
    const buyPercent = Math.round(totalBuy / (totalBuy + totalSell) * 100) || 50;

    // Liquidity consensus
    const liquidityIn = (obvNow > obvPrev5) && (adNow > adPrev) && (lastCMF > 0);
    const liquidityOut = (obvNow < obvPrev5) && (adNow < adPrev) && (lastCMF < 0);

    // Smart Money Score (multi-factor)
    let smartScore = 50;
    if (obvNow > obvPrev5) smartScore += 8;
    if (obvNow > obvPrev15) smartScore += 5;
    if (adNow > adPrev) smartScore += 8;
    if (lastCMF > 0.1) smartScore += 12;
    else if (lastCMF < -0.1) smartScore -= 12;
    if (lastMFI < 25) smartScore += 12;
    else if (lastMFI > 75) smartScore -= 12;
    if (buyPercent > 60) smartScore += 8;
    else if (buyPercent < 40) smartScore -= 8;
    if (last?.isBull) smartScore += 5;
    if (obvDivergence?.color === "#10b981") smartScore += 10;
    if (obvDivergence?.color === "#ef4444") smartScore -= 10;
    smartScore = Math.max(0, Math.min(100, Math.round(smartScore)));

    // VSA signals
    const allVSA = withPatterns.filter(d => d.vsaSignal);
    const recentVSA = allVSA.slice(-8);

    // Candle patterns
    const allPatterns = withPatterns.filter(d => d.candlePattern);
    const recentPatterns = allPatterns.slice(-8);

    // Pattern counts
    const bullPatterns = recentPatterns.filter(p => p.patternType?.includes('bullish') || p.patternType === 'strong_bullish').length;
    const bearPatterns = recentPatterns.filter(p => p.patternType?.includes('bearish') || p.patternType === 'strong_bearish').length;
    const neutralPatterns = recentPatterns.filter(p => p.patternType === 'reversal' || p.patternType === 'consolidation').length;

    return {
      last, wyckoff, recentVSA, recentPatterns,
      obvTrend, obvDivergence, adFlow, adMomentum,
      lastMFI, mfiTrend, lastCMF, cmfSignal,
      liquidityIn, liquidityOut, buyPercent,
      smartScore, lastVWAP, lastATR, volatility,
      bullPatterns, bearPatterns, neutralPatterns,
    };
  }, [data]);

  if (!analysis) return (
    <div className="flex items-center justify-center py-10 text-[#64748b] text-sm">
      يتطلب 15 شمعة على الأقل للتحليل
    </div>
  );

  const { last, wyckoff, recentVSA, recentPatterns, obvTrend, obvDivergence, adFlow,
    lastMFI, lastCMF, cmfSignal, liquidityIn, liquidityOut, buyPercent, smartScore,
    lastVWAP, lastATR, volatility, bullPatterns, bearPatterns, neutralPatterns } = analysis;

  const scoreColor = smartScore >= 65 ? "#10b981" : smartScore >= 40 ? "#d4a843" : "#ef4444";
  const scoreLabel = smartScore >= 80 ? "إشارة شراء قوية جداً" : smartScore >= 65 ? "إشارة شراء" : smartScore >= 50 ? "ميل صاعد خفيف" : smartScore >= 35 ? "ميل هابط خفيف" : smartScore >= 20 ? "إشارة بيع" : "إشارة بيع قوية جداً";

  return (
    <div className="space-y-4">

      {/* === SMART MONEY DASHBOARD === */}
      <div className="bg-gradient-to-l from-[#0f1623] to-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-[#d4a843]" />
          <h3 className="text-base font-bold text-white">لوحة الأموال الذكية</h3>
          <span className="text-xs text-[#64748b] mr-auto">تحليل حي متكامل</span>
        </div>

        <div className="flex items-start gap-6 flex-wrap">
          {/* Score Gauge */}
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="38" fill="none" stroke="#1e293b" strokeWidth="10" />
              <circle cx="50" cy="50" r="38" fill="none" stroke={scoreColor} strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(smartScore / 100) * 238.7} 238.7`}
                style={{ transition: 'stroke-dasharray 1s ease', filter: `drop-shadow(0 0 8px ${scoreColor}50)` }}
              />
              {/* Inner ring */}
              <circle cx="50" cy="50" r="28" fill="none" stroke={scoreColor + '20'} strokeWidth="2" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-white leading-none">{smartScore}</span>
              <span className="text-xs text-[#64748b]">/ 100</span>
            </div>
          </div>

          {/* Score Details */}
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <span className="text-lg font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
              {obvDivergence && (
                <div className="mt-1 flex items-center gap-1.5 px-2 py-1 rounded-lg w-fit"
                  style={{ backgroundColor: obvDivergence.color + '15', border: `1px solid ${obvDivergence.color}30` }}>
                  <span className="text-xs font-semibold" style={{ color: obvDivergence.color }}>
                    تباعد OBV: {obvDivergence.text}
                  </span>
                </div>
              )}
            </div>

            {/* Mini indicators grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: "OBV اتجاه", value: obvTrend, color: obvTrend === "صاعد" ? "#10b981" : "#ef4444" },
                { label: "A/D تدفق", value: adFlow, color: adFlow === "تجميع" ? "#3b82f6" : "#f59e0b" },
                { label: "CMF", value: cmfSignal, color: lastCMF > 0 ? "#10b981" : "#ef4444" },
                { label: "MFI", value: `${lastMFI?.toFixed(0)} ${lastMFI > 75 ? "(تشبع)" : lastMFI < 25 ? "(فرصة)" : ""}`, color: lastMFI > 75 ? "#ef4444" : lastMFI < 25 ? "#10b981" : "#d4a843" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-[#64748b]">{item.label}:</span>
                  <span className="text-xs font-semibold truncate" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* === LIQUIDITY METER === */}
      <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Droplets className="w-4 h-4 text-[#3b82f6]" />
          <h4 className="text-sm font-bold text-white">عداد السيولة</h4>
          <div className={`mr-auto px-3 py-1 rounded-full text-xs font-bold ${liquidityIn ? 'bg-emerald-500/15 text-emerald-400' : liquidityOut ? 'bg-red-500/15 text-red-400' : 'bg-[#1e293b] text-[#94a3b8]'}`}>
            {liquidityIn ? "🟢 دخول سيولة" : liquidityOut ? "🔴 خروج سيولة" : "⚪ محايد"}
          </div>
        </div>

        {/* Buy/Sell pressure bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-[#64748b] mb-1.5">
            <span>ضغط الشراء {buyPercent}%</span>
            <span>ضغط البيع {100 - buyPercent}%</span>
          </div>
          <div className="relative h-4 bg-[#1e293b] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${buyPercent}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white" style={{ textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>
                {buyPercent > 50 ? `شراء +${buyPercent - 50}%` : `بيع +${50 - buyPercent}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "VWAP",
              value: lastVWAP?.toFixed(2),
              sub: last?.close > lastVWAP ? "فوق (إيجابي)" : "تحت (سلبي)",
              color: last?.close > lastVWAP ? "#10b981" : "#ef4444"
            },
            {
              label: "ATR التقلب",
              value: lastATR?.toFixed(2),
              sub: volatility > 3 ? "تقلب عالٍ ⚡" : volatility > 1.5 ? "متوسط" : "منخفض ✓",
              color: volatility > 3 ? "#ef4444" : volatility > 1.5 ? "#f59e0b" : "#10b981"
            },
            {
              label: "CMF",
              value: lastCMF?.toFixed(3),
              sub: lastCMF > 0.1 ? "شراء قوي" : lastCMF < -0.1 ? "بيع قوي" : "محايد",
              color: lastCMF > 0.1 ? "#10b981" : lastCMF < -0.1 ? "#ef4444" : "#d4a843"
            },
            {
              label: "MFI",
              value: lastMFI?.toFixed(1),
              sub: lastMFI > 80 ? "تشبع شرائي" : lastMFI < 20 ? "تشبع بيعي" : "منطقة آمنة",
              color: lastMFI > 80 ? "#ef4444" : lastMFI < 20 ? "#10b981" : "#d4a843"
            },
          ].map(item => (
            <div key={item.label} className="bg-[#151c2c] rounded-xl p-3">
              <p className="text-xs text-[#64748b] mb-1">{item.label}</p>
              <p className="text-sm font-bold text-white">{item.value}</p>
              <p className="text-xs mt-0.5" style={{ color: item.color }}>{item.sub}</p>
              <StrengthBar value={item.value} max={item.label === "MFI" ? 100 : item.label === "CMF" ? 1 : item.value * 2} color={item.color} />
            </div>
          ))}
        </div>
      </div>

      {/* === WYCKOFF === */}
      {wyckoff && (
        <div className="rounded-2xl p-4 border flex items-start gap-4"
          style={{ borderColor: wyckoff.color + '40', background: wyckoff.color + '08' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-black border"
            style={{ borderColor: wyckoff.color + '60', backgroundColor: wyckoff.color + '20', color: wyckoff.color }}>
            {wyckoff.phase}
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: wyckoff.color }}>{wyckoff.name}</p>
            <p className="text-xs text-[#94a3b8] mt-0.5">{wyckoff.desc}</p>
          </div>
        </div>
      )}

      {/* === VSA SIGNALS === */}
      {recentVSA.length > 0 && (
        <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-5">
          <button
            className="w-full flex items-center gap-2 mb-3"
            onClick={() => setExpandVSA(!expandVSA)}
          >
            <Activity className="w-4 h-4 text-[#3b82f6]" />
            <h4 className="text-sm font-bold text-white">إشارات VSA — تحليل السيولة والانتشار</h4>
            <div className="mr-auto flex items-center gap-2">
              <span className="text-xs bg-[#1e293b] text-[#94a3b8] px-2 py-0.5 rounded-full">{recentVSA.length}</span>
              {expandVSA ? <ChevronUp className="w-4 h-4 text-[#64748b]" /> : <ChevronDown className="w-4 h-4 text-[#64748b]" />}
            </div>
          </button>

          {/* Always show last 3, expand for all */}
          <div className="grid grid-cols-1 gap-2">
            {(expandVSA ? recentVSA : recentVSA.slice(-3)).map((s, i) => (
              <SignalCard key={i} signal={s.vsaSignal} time={s.time} color={s.vsaColor} strength={s.vsaStrength} />
            ))}
          </div>

          {!expandVSA && recentVSA.length > 3 && (
            <button onClick={() => setExpandVSA(true)}
              className="mt-2 text-xs text-[#3b82f6] hover:text-blue-300 transition-colors">
              + {recentVSA.length - 3} إشارات أخرى...
            </button>
          )}
        </div>
      )}

      {/* === CANDLE PATTERNS === */}
      {recentPatterns.length > 0 && (
        <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-5">
          <button
            className="w-full flex items-center gap-2 mb-3"
            onClick={() => setExpandPatterns(!expandPatterns)}
          >
            <Eye className="w-4 h-4 text-[#d4a843]" />
            <h4 className="text-sm font-bold text-white">أنماط الشموع المكتشفة</h4>
            <div className="mr-auto flex items-center gap-2">
              <span className="text-xs bg-[#1e293b] text-[#94a3b8] px-2 py-0.5 rounded-full">{recentPatterns.length}</span>
              {expandPatterns ? <ChevronUp className="w-4 h-4 text-[#64748b]" /> : <ChevronDown className="w-4 h-4 text-[#64748b]" />}
            </div>
          </button>

          <div className="grid grid-cols-1 gap-2">
            {(expandPatterns ? recentPatterns : recentPatterns.slice(-3)).map((p, i) => (
              <SignalCard key={i} signal={p.candlePattern} time={p.time} color={p.patternColor} strength={p.patternStrength} />
            ))}
          </div>

          {!expandPatterns && recentPatterns.length > 3 && (
            <button onClick={() => setExpandPatterns(true)}
              className="mt-2 text-xs text-[#d4a843] hover:text-yellow-300 transition-colors">
              + {recentPatterns.length - 3} أنماط أخرى...
            </button>
          )}

          {/* Pattern summary bar */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="text-center p-2.5 bg-emerald-500/8 rounded-xl border border-emerald-500/20">
              <p className="text-emerald-400 font-black text-xl">{bullPatterns}</p>
              <p className="text-xs text-[#64748b]">صاعدة</p>
            </div>
            <div className="text-center p-2.5 bg-red-500/8 rounded-xl border border-red-500/20">
              <p className="text-red-400 font-black text-xl">{bearPatterns}</p>
              <p className="text-xs text-[#64748b]">هابطة</p>
            </div>
            <div className="text-center p-2.5 bg-[#1e293b] rounded-xl">
              <p className="text-[#d4a843] font-black text-xl">{neutralPatterns}</p>
              <p className="text-xs text-[#64748b]">انعكاس</p>
            </div>
          </div>
        </div>
      )}

      {/* === LAST CANDLE BREAKDOWN === */}
      {last && (
        <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#d4a843]" />
            <h4 className="text-sm font-bold text-white">تشريح آخر شمعة</h4>
            <div className={`mr-auto px-2 py-0.5 rounded-full text-xs font-bold ${last.isBull ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {last.isBull ? "▲ صاعدة" : "▼ هابطة"}
            </div>
          </div>

          {/* OHLCV */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
            {[
              { label: "فتح", value: last.open, color: "text-white" },
              { label: "أعلى", value: last.high, color: "text-emerald-400" },
              { label: "أقل", value: last.low, color: "text-red-400" },
              { label: "إغلاق", value: last.close, color: last.isBull ? "text-emerald-400" : "text-red-400" },
              { label: "حجم", value: (last.volume / 1000000).toFixed(2) + "M", color: last.isVeryHighVol ? "text-[#d4a843]" : last.isHighVol ? "text-blue-400" : "text-[#94a3b8]" },
            ].map(item => (
              <div key={item.label} className="bg-[#151c2c] rounded-xl p-3 text-center">
                <p className="text-xs text-[#64748b]">{item.label}</p>
                <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Close position in range */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-[#64748b] mb-1">
              <span>أقل: {last.low?.toFixed(2)}</span>
              <span className="text-[#94a3b8]">موقع الإغلاق: {Math.round((last.closeRatio ?? 0.5) * 100)}%</span>
              <span>أعلى: {last.high?.toFixed(2)}</span>
            </div>
            <div className="relative h-3 bg-[#1e293b] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{
                width: `${Math.round((last.closeRatio ?? 0.5) * 100)}%`,
                background: (last.closeRatio ?? 0.5) > 0.6 ? 'linear-gradient(90deg,#10b981,#34d399)' : (last.closeRatio ?? 0.5) < 0.4 ? 'linear-gradient(90deg,#ef4444,#f87171)' : 'linear-gradient(90deg,#d4a843,#e8c76a)'
              }} />
            </div>
          </div>

          {/* Detected signals on last candle */}
          <div className="space-y-2">
            {last.candlePattern && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: last.patternColor + '10', border: `1px solid ${last.patternColor}30` }}>
                <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: last.patternColor }} />
                <span className="text-sm font-bold" style={{ color: last.patternColor }}>
                  نمط: {last.candlePattern}
                </span>
                <div className="flex gap-0.5 mr-auto">
                  {[1, 2, 3].map(s => (
                    <div key={s} className="w-1.5 h-3 rounded-sm"
                      style={{ backgroundColor: s <= (last.patternStrength || 1) ? last.patternColor : '#1e293b' }} />
                  ))}
                </div>
              </div>
            )}
            {last.vsaSignal && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: last.vsaColor + '10', border: `1px solid ${last.vsaColor}30` }}>
                <Activity className="w-3.5 h-3.5 shrink-0" style={{ color: last.vsaColor }} />
                <span className="text-sm font-bold" style={{ color: last.vsaColor }}>
                  VSA: {last.vsaSignal}
                </span>
                <div className="flex gap-0.5 mr-auto">
                  {[1, 2, 3].map(s => (
                    <div key={s} className="w-1.5 h-3 rounded-sm"
                      style={{ backgroundColor: s <= (last.vsaStrength || 1) ? last.vsaColor : '#1e293b' }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}