import React, { useMemo } from "react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, AreaChart, Area
} from "recharts";

// ===== OBV =====
export const calcOBV = (data) => {
  let obv = 0;
  return data.map((d, i) => {
    if (i === 0) return { ...d, obv: 0 };
    const prev = data[i - 1];
    if (d.close > prev.close) obv += d.volume;
    else if (d.close < prev.close) obv -= d.volume;
    return { ...d, obv };
  });
};

// ===== A/D =====
export const calcAD = (data) => {
  let ad = 0;
  return data.map((d) => {
    const range = d.high - d.low;
    const mfm = range !== 0 ? ((d.close - d.low) - (d.high - d.close)) / range : 0;
    ad += mfm * d.volume;
    return { ...d, ad: parseFloat(ad.toFixed(0)) };
  });
};

// ===== MFI =====
export const calcMFI = (data, period = 14) => {
  return data.map((d, i) => {
    if (i < period) return { ...d, mfi: null };
    const slice = data.slice(i - period + 1, i + 1);
    let posFlow = 0, negFlow = 0;
    for (let j = 1; j < slice.length; j++) {
      const tp = (slice[j].high + slice[j].low + slice[j].close) / 3;
      const prevTp = (slice[j - 1].high + slice[j - 1].low + slice[j - 1].close) / 3;
      const mf = tp * slice[j].volume;
      if (tp > prevTp) posFlow += mf; else negFlow += mf;
    }
    const mfr = negFlow === 0 ? 100 : posFlow / negFlow;
    return { ...d, mfi: parseFloat((100 - 100 / (1 + mfr)).toFixed(1)) };
  });
};

// ===== CMF =====
export const calcCMF = (data, period = 20) => {
  return data.map((d, i) => {
    if (i < period - 1) return { ...d, cmf: null };
    const slice = data.slice(i - period + 1, i + 1);
    let adSum = 0, volSum = 0;
    slice.forEach(c => {
      const range = c.high - c.low;
      const mfm = range !== 0 ? ((c.close - c.low) - (c.high - c.close)) / range : 0;
      adSum += mfm * c.volume;
      volSum += c.volume;
    });
    return { ...d, cmf: volSum !== 0 ? parseFloat((adSum / volSum).toFixed(3)) : 0 };
  });
};

// ===== VSA =====
export const calcVSA = (data) => {
  const avgVol = data.reduce((s, d) => s + d.volume, 0) / data.length;
  return data.map((d, i) => {
    const spread = d.high - d.low;
    const avgSpread = i > 5
      ? data.slice(i - 5, i).reduce((s, c) => s + (c.high - c.low), 0) / 5
      : spread;
    const isHighVol = d.volume > avgVol * 1.5;
    const isVeryHighVol = d.volume > avgVol * 2.5;
    const isLowVol = d.volume < avgVol * 0.5;
    const isWideSpread = spread > avgSpread * 1.3;
    const isNarrowSpread = spread < avgSpread * 0.6;
    const closeRatio = spread > 0 ? (d.close - d.low) / spread : 0.5;
    const closeInTop = closeRatio > 0.7;
    const closeInBottom = closeRatio < 0.3;
    const closeInMid = closeRatio >= 0.3 && closeRatio <= 0.7;

    let vsaSignal = null;
    let vsaColor = null;
    let vsaStrength = 0; // 1=weak, 2=medium, 3=strong

    if (isVeryHighVol && isWideSpread && closeInTop && d.isBull) {
      vsaSignal = "🔥 دخول سيولة ضخمة شراء";
      vsaColor = "#10b981";
      vsaStrength = 3;
    } else if (isVeryHighVol && isWideSpread && closeInBottom && !d.isBull) {
      vsaSignal = "🔥 دخول سيولة ضخمة بيع";
      vsaColor = "#ef4444";
      vsaStrength = 3;
    } else if (isHighVol && isWideSpread && closeInTop && d.isBull) {
      vsaSignal = "✦ دخول سيولة شراء";
      vsaColor = "#10b981";
      vsaStrength = 2;
    } else if (isHighVol && isWideSpread && closeInBottom && !d.isBull) {
      vsaSignal = "✦ دخول سيولة بيع";
      vsaColor = "#ef4444";
      vsaStrength = 2;
    } else if (isHighVol && isNarrowSpread && closeInTop) {
      vsaSignal = "◆ تجميع خفي (Hidden Buying)";
      vsaColor = "#3b82f6";
      vsaStrength = 2;
    } else if (isHighVol && isNarrowSpread && closeInBottom) {
      vsaSignal = "◆ تصريف خفي (Hidden Selling)";
      vsaColor = "#f59e0b";
      vsaStrength = 2;
    } else if (isHighVol && isNarrowSpread && closeInMid) {
      vsaSignal = "◈ توازن القوى (Equilibrium)";
      vsaColor = "#8b5cf6";
      vsaStrength = 1;
    } else if (isLowVol && isNarrowSpread) {
      vsaSignal = "◇ لا طلب / لا عرض";
      vsaColor = "#64748b";
      vsaStrength = 1;
    } else if (isHighVol && !isWideSpread && i > 0 && !data[i - 1].isBull && d.isBull) {
      vsaSignal = "★ انعكاس صاعد (Reversal Up)";
      vsaColor = "#d4a843";
      vsaStrength = 2;
    } else if (isHighVol && !isWideSpread && i > 0 && data[i - 1].isBull && !d.isBull) {
      vsaSignal = "★ انعكاس هابط (Reversal Down)";
      vsaColor = "#f97316";
      vsaStrength = 2;
    } else if (isVeryHighVol && closeInMid) {
      vsaSignal = "⚡ صراع شراء/بيع (Climax)";
      vsaColor = "#a855f7";
      vsaStrength = 3;
    }

    return { ...d, vsaSignal, vsaColor, vsaStrength, isHighVol, isVeryHighVol, isLowVol, spread, closeRatio };
  });
};

// ===== Wyckoff Phases (Advanced) =====
export const detectWyckoffPhase = (data) => {
  if (data.length < 30) return null;
  const recent = data.slice(-30);
  const prices = recent.map(d => d.close);
  const vols = recent.map(d => d.volume);
  const avgVol = vols.reduce((s, v) => s + v, 0) / vols.length;
  const priceTrend = prices[prices.length - 1] - prices[0];
  const priceRange = Math.max(...prices) - Math.min(...prices);
  const highVols = vols.filter(v => v > avgVol * 1.5).length;
  const lowVols = vols.filter(v => v < avgVol * 0.6).length;
  const laterPrices = prices.slice(-10);
  const earlierPrices = prices.slice(0, 10);
  const laterAvg = laterPrices.reduce((s, p) => s + p, 0) / 10;
  const earlierAvg = earlierPrices.reduce((s, p) => s + p, 0) / 10;
  const laterVols = vols.slice(-10);
  const laterAvgVol = laterVols.reduce((s, v) => s + v, 0) / 10;

  // Phase E: Markup / Markdown
  if (priceTrend > priceRange * 0.6 && highVols > 8) return {
    phase: "E", name: "مرحلة الارتفاع (Markup)", color: "#10b981",
    desc: "تأكيد الاتجاه الصاعد - الأموال الكبيرة تقود السوق"
  };
  if (priceTrend < -priceRange * 0.6 && highVols > 8) return {
    phase: "E-", name: "مرحلة الهبوط (Markdown)", color: "#ef4444",
    desc: "تأكيد الاتجاه الهابط - بيع مؤسسي قوي"
  };
  // Phase C: Spring / Upthrust
  if (priceTrend < 0 && highVols > 5 && laterAvg > earlierAvg) return {
    phase: "C+", name: "ربيع وايكوف (Spring)", color: "#10b981",
    desc: "اختبار القاع برفقة حجم - نقطة انطلاق محتملة"
  };
  if (priceTrend > 0 && highVols > 5 && laterAvg < earlierAvg) return {
    phase: "C-", name: "اختبار القمة (Upthrust)", color: "#ef4444",
    desc: "اختبار القمة بحجم - تحذير من انعكاس هابط"
  };
  // Phase B: Accumulation / Distribution
  if (highVols > 6 && laterAvgVol > avgVol && Math.abs(priceTrend) < priceRange * 0.3) return {
    phase: "B", name: priceTrend >= 0 ? "تجميع وايكوف (Accumulation)" : "تصريف وايكوف (Distribution)",
    color: priceTrend >= 0 ? "#3b82f6" : "#f59e0b",
    desc: priceTrend >= 0 ? "تجميع مؤسسي في نطاق ضيق" : "توزيع مؤسسي على المستثمرين الأفراد"
  };
  // Phase A: Stopping
  if (lowVols > 15) return {
    phase: "A", name: "توقف الحركة (Stopping)", color: "#8b5cf6",
    desc: "ضعف حجم التداول - مرحلة انتظار قبل الحركة الكبيرة"
  };
  return null;
};

// ===== Candlestick Patterns (Advanced) =====
export const detectCandlePatterns = (data) => {
  return data.map((d, i) => {
    if (i < 3) return { ...d, candlePattern: null, patternColor: null, patternType: null, patternStrength: 0 };
    const prev = data[i - 1];
    const prev2 = data[i - 2];
    const prev3 = data[i - 3];
    const body = Math.abs(d.close - d.open);
    const range = d.high - d.low;
    const upperWick = d.high - Math.max(d.open, d.close);
    const lowerWick = Math.min(d.open, d.close) - d.low;
    const prevBody = Math.abs(prev.close - prev.open);
    const prev2Body = Math.abs(prev2.close - prev2.open);

    let pattern = null, patternColor = null, patternType = null, patternStrength = 0;

    // === REVERSAL BEARISH ===
    if (upperWick > body * 2.5 && lowerWick < body * 0.5 && range > 0 && !d.isBull) {
      pattern = "⭐ نجمة هابطة"; patternColor = "#ef4444"; patternType = "bearish"; patternStrength = 3;
    }
    else if (upperWick > body * 2.5 && lowerWick < body * 0.5 && range > 0 && d.isBull) {
      pattern = "🪂 مظلة هابطة"; patternColor = "#f97316"; patternType = "bearish"; patternStrength = 2;
    }
    else if (!d.isBull && prev.isBull && body > prevBody * 1.2 && d.open >= prev.close && d.close <= prev.open) {
      pattern = "↓ ابتلاع هابط قوي"; patternColor = "#ef4444"; patternType = "bearish"; patternStrength = 3;
    }
    else if (prev2.isBull && !d.isBull && body > prev2Body * 1.5 && d.close < prev2.open) {
      pattern = "☁️ غطاء السحابة الداكنة"; patternColor = "#ef4444"; patternType = "bearish"; patternStrength = 2;
    }
    else if (prev2.isBull && Math.abs(prev.close - prev.open) < prev2Body * 0.2 && !d.isBull && d.close < (prev2.open + prev2.close) / 2) {
      pattern = "⚰️ نجمة المساء"; patternColor = "#ef4444"; patternType = "bearish"; patternStrength = 3;
    }
    else if (!d.isBull && !prev.isBull && !prev2.isBull && d.close < prev.close && prev.close < prev2.close) {
      pattern = "🦅 ثلاثة غربان سوداء"; patternColor = "#ef4444"; patternType = "bearish"; patternStrength = 3;
    }

    // === REVERSAL BULLISH ===
    else if (lowerWick > body * 2.5 && upperWick < body * 0.5 && range > 0) {
      pattern = "🔨 مطرقة انعكاسية"; patternColor = "#10b981"; patternType = "bullish"; patternStrength = 3;
    }
    else if (lowerWick > body * 2.5 && upperWick < body * 0.5 && range > 0 && d.isBull) {
      pattern = "🔨 مطرقة صاعدة"; patternColor = "#10b981"; patternType = "bullish"; patternStrength = 3;
    }
    else if (d.isBull && !prev.isBull && body > prevBody * 1.2 && d.open <= prev.close && d.close >= prev.open) {
      pattern = "↑ ابتلاع صاعد قوي"; patternColor = "#10b981"; patternType = "bullish"; patternStrength = 3;
    }
    else if (!prev2.isBull && Math.abs(prev.close - prev.open) < prev2Body * 0.2 && d.isBull && d.close > (prev2.open + prev2.close) / 2) {
      pattern = "🌟 نجمة الصباح"; patternColor = "#10b981"; patternType = "bullish"; patternStrength = 3;
    }
    else if (d.isBull && prev.isBull && prev2.isBull && d.close > prev.close * 1.002 && prev.close > prev2.close * 1.002) {
      pattern = "⚔️ ثلاثة جنود بيض"; patternColor = "#10b981"; patternType = "bullish"; patternStrength = 3;
    }
    else if (lowerWick > range * 0.6 && body < range * 0.2 && d.low < prev.low && d.low < prev2.low) {
      pattern = "📌 قاع دبوس"; patternColor = "#10b981"; patternType = "bullish"; patternStrength = 3;
    }

    // === CONTINUATION / INDECISION ===
    else if (body < range * 0.08 && range > 0) {
      if (Math.abs(upperWick - lowerWick) < range * 0.1) {
        pattern = "✚ دوجي متماثل"; patternColor = "#d4a843"; patternType = "reversal"; patternStrength = 2;
      } else if (upperWick > lowerWick * 2) {
        pattern = "☂ دوجي قمة"; patternColor = "#ef4444"; patternType = "bearish"; patternStrength = 1;
      } else {
        pattern = "☃ دوجي قاع"; patternColor = "#10b981"; patternType = "bullish"; patternStrength = 1;
      }
    }
    else if (body > range * 0.9) {
      if (d.isBull) {
        pattern = "◾ ماروبوزو صاعد (قوة)"; patternColor = "#10b981"; patternType = "strong_bullish"; patternStrength = 3;
      } else {
        pattern = "◾ ماروبوزو هابط (ضغط)"; patternColor = "#ef4444"; patternType = "strong_bearish"; patternStrength = 3;
      }
    }
    else if (d.high < prev.high && d.low > prev.low) {
      pattern = "◻ شمعة داخلية (توقف)"; patternColor = "#8b5cf6"; patternType = "consolidation"; patternStrength = 1;
    }
    else if (d.high > prev.high && d.low < prev.low) {
      pattern = "⊕ ابتلاع خارجي (تذبذب)"; patternColor = "#a855f7"; patternType = "reversal"; patternStrength = 2;
    }
    // Tweezer Top/Bottom
    else if (Math.abs(d.high - prev.high) < d.high * 0.001 && d.isBull && !prev.isBull) {
      pattern = "🔀 قمتان توأم (Tweezer Top)"; patternColor = "#ef4444"; patternType = "bearish"; patternStrength = 2;
    }
    else if (Math.abs(d.low - prev.low) < d.low * 0.001 && !d.isBull && prev.isBull) {
      pattern = "🔀 قاعان توأم (Tweezer Bottom)"; patternColor = "#10b981"; patternType = "bullish"; patternStrength = 2;
    }

    return { ...d, candlePattern: pattern, patternColor, patternType, patternStrength };
  });
};

// ===== VWAP =====
export const calcVWAP = (data) => {
  let cumVP = 0, cumVol = 0;
  return data.map((d) => {
    const tp = (d.high + d.low + d.close) / 3;
    cumVP += tp * d.volume;
    cumVol += d.volume;
    return { ...d, vwap: parseFloat((cumVP / cumVol).toFixed(2)) };
  });
};

// ===== ATR =====
export const calcATR = (data, period = 14) => {
  return data.map((d, i) => {
    if (i === 0) return { ...d, atr: d.high - d.low };
    const prev = data[i - 1];
    const tr = Math.max(d.high - d.low, Math.abs(d.high - prev.close), Math.abs(d.low - prev.close));
    if (i < period) return { ...d, atr: parseFloat(tr.toFixed(2)) };
    const slice = data.slice(i - period + 1, i + 1);
    const atr = slice.reduce((s, c, ci) => {
      const pc = ci > 0 ? slice[ci - 1] : data[i - period];
      return s + Math.max(c.high - c.low, Math.abs(c.high - (pc?.close || c.open)), Math.abs(c.low - (pc?.close || c.open)));
    }, 0) / period;
    return { ...d, atr: parseFloat(atr.toFixed(2)) };
  });
};

// ===== Liquidity Heatmap =====
export const calcLiquidityHeatmap = (data) => {
  const avgVol = data.reduce((s, d) => s + d.volume, 0) / data.length;
  return data.map((d) => {
    const relVol = d.volume / avgVol;
    const closePos = d.high !== d.low ? (d.close - d.low) / (d.high - d.low) : 0.5;
    // Buying pressure = high volume + close near top
    const buyPressure = relVol * closePos * 100;
    // Selling pressure = high volume + close near bottom
    const sellPressure = relVol * (1 - closePos) * 100;
    const netFlow = buyPressure - sellPressure;
    return { ...d, buyPressure: parseFloat(buyPressure.toFixed(1)), sellPressure: parseFloat(sellPressure.toFixed(1)), netFlow: parseFloat(netFlow.toFixed(1)) };
  });
};

// ===== CHART COMPONENTS =====
const TS = { backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' };

export function OBVChart({ data }) {
  const d = useMemo(() => calcOBV(data), [data]);
  const isUp = d[d.length - 1]?.obv > d[Math.max(0, d.length - 6)]?.obv;
  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={d}>
          <defs>
            <linearGradient id="obvG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? "#3b82f6" : "#ef4444"} stopOpacity={0.3} />
              <stop offset="100%" stopColor={isUp ? "#3b82f6" : "#ef4444"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
          <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
          <Tooltip contentStyle={TS} formatter={(v) => [v.toLocaleString(), 'OBV']} />
          <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
          <Area type="monotone" dataKey="obv" stroke={isUp ? "#3b82f6" : "#ef4444"} strokeWidth={2} fill="url(#obvG)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ADChart({ data }) {
  const d = useMemo(() => calcAD(data), [data]);
  const isUp = d[d.length - 1]?.ad > d[Math.max(0, d.length - 6)]?.ad;
  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={d}>
          <defs>
            <linearGradient id="adG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
              <stop offset="100%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
          <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
          <Tooltip contentStyle={TS} formatter={(v) => [v.toLocaleString(), 'A/D']} />
          <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
          <Area type="monotone" dataKey="ad" stroke={isUp ? "#10b981" : "#ef4444"} strokeWidth={2} fill="url(#adG)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MFIChart({ data }) {
  const d = useMemo(() => calcMFI(data), [data]);
  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={d}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
          <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={TS} />
          <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} label={{ value: "80", fill: '#ef4444', fontSize: 9 }} />
          <ReferenceLine y={20} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} label={{ value: "20", fill: '#10b981', fontSize: 9 }} />
          <Line type="monotone" dataKey="mfi" stroke="#d4a843" strokeWidth={2} dot={false} name="MFI" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CMFChart({ data }) {
  const d = useMemo(() => calcCMF(data), [data]);
  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={d}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
          <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={[-1, 1]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={35} />
          <Tooltip contentStyle={TS} />
          <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
          <ReferenceLine y={0.1} stroke="#10b981" strokeDasharray="3 2" strokeWidth={1} />
          <ReferenceLine y={-0.1} stroke="#ef4444" strokeDasharray="3 2" strokeWidth={1} />
          <Bar dataKey="cmf" radius={[2, 2, 0, 0]} name="CMF">
            {d.map((item, i) => <Cell key={i} fill={item.cmf >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.7} />)}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VSAVolumeChart({ data }) {
  const d = useMemo(() => calcVSA(data), [data]);
  const avgVol = d.reduce((s, x) => s + x.volume, 0) / d.length;
  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={d}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
          <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
          <Tooltip contentStyle={TS} formatter={(v, name, p) => [v.toLocaleString(), p.payload.vsaSignal || 'حجم']} />
          <ReferenceLine y={avgVol} stroke="#d4a843" strokeDasharray="4 2" strokeWidth={1} label={{ value: "متوسط", fill: '#d4a843', fontSize: 9, position: 'insideRight' }} />
          <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
            {d.map((item, i) => (
              <Cell key={i}
                fill={item.vsaColor || (item.isHighVol && item.isBull ? '#10b981' : item.isHighVol && !item.isBull ? '#ef4444' : item.isBull ? '#10b98160' : '#ef444460')}
                fillOpacity={item.isVeryHighVol ? 1 : item.isHighVol ? 0.8 : 0.4}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LiquidityFlowChart({ data }) {
  const d = useMemo(() => calcLiquidityHeatmap(data), [data]);
  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={d}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
          <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={TS} />
          <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
          <Bar dataKey="netFlow" radius={[2, 2, 0, 0]} name="صافي السيولة">
            {d.map((item, i) => <Cell key={i} fill={item.netFlow >= 0 ? '#10b981' : '#ef4444'} fillOpacity={Math.min(1, Math.abs(item.netFlow) / 100)} />)}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}