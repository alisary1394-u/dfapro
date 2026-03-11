// Indicator calculation utilities

export function calcEMA(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = null;
  for (const d of data) {
    if (ema === null) {
      ema = d.close;
    } else {
      ema = d.close * k + ema * (1 - k);
    }
    result.push({ time: d.time, value: parseFloat(ema.toFixed(4)) });
  }
  return result;
}

export function calcSMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, c) => s + c.close, 0) / period;
    result.push({ time: data[i].time, value: parseFloat(avg.toFixed(4)) });
  }
  return result;
}

export function calcRSI(data, period = 14) {
  const result = [];
  if (data.length < period + 1) return result;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period; i < data.length; i++) {
    if (i > period) {
      const diff = data[i].close - data[i - 1].close;
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    result.push({ time: data[i].time, value: parseFloat(rsi.toFixed(2)) });
  }
  return result;
}

export function calcMACD(data, fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);

  // align by time
  const slowMap = new Map(emaSlow.map(d => [d.time, d.value]));
  const macdLine = emaFast
    .filter(d => slowMap.has(d.time))
    .map(d => ({ time: d.time, value: parseFloat((d.value - slowMap.get(d.time)).toFixed(4)) }));

  // signal line (EMA of macd)
  const k = 2 / (signal + 1);
  let sig = null;
  const signalLine = [];
  const histogram = [];

  for (const d of macdLine) {
    if (sig === null) sig = d.value;
    else sig = d.value * k + sig * (1 - k);
    signalLine.push({ time: d.time, value: parseFloat(sig.toFixed(4)) });
    histogram.push({ time: d.time, value: parseFloat((d.value - sig).toFixed(4)) });
  }

  return { macdLine, signalLine, histogram };
}

export function calcStochastic(data, kPeriod = 14, dPeriod = 3) {
  const result = [];
  for (let i = kPeriod - 1; i < data.length; i++) {
    const slice = data.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map(d => d.high));
    const lowest = Math.min(...slice.map(d => d.low));
    const k = highest !== lowest ? ((data[i].close - lowest) / (highest - lowest)) * 100 : 50;
    result.push({ time: data[i].time, k: parseFloat(k.toFixed(2)), d: 0 });
  }
  for (let i = 0; i < result.length; i++) {
    if (i < dPeriod - 1) {
      result[i].d = result[i].k;
    } else {
      const avg = result.slice(i - dPeriod + 1, i + 1).reduce((s, c) => s + c.k, 0) / dPeriod;
      result[i].d = parseFloat(avg.toFixed(2));
    }
  }
  return result;
}

export function toHeikinAshi(data) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? (c.open + c.close) / 2 : (result[i - 1].open + result[i - 1].close) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    result.push({
      time: c.time,
      open: parseFloat(haOpen.toFixed(4)),
      high: parseFloat(haHigh.toFixed(4)),
      low: parseFloat(haLow.toFixed(4)),
      close: parseFloat(haClose.toFixed(4)),
      volume: c.volume,
    });
  }
  return result;
}

export function calcBollingerBands(data, period = 20, multiplier = 2) {
  const upper = [], middle = [], lower = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, c) => s + c.close, 0) / period;
    const std = Math.sqrt(slice.reduce((s, c) => s + Math.pow(c.close - avg, 2), 0) / period);
    const t = data[i].time;
    upper.push({ time: t, value: parseFloat((avg + multiplier * std).toFixed(4)) });
    middle.push({ time: t, value: parseFloat(avg.toFixed(4)) });
    lower.push({ time: t, value: parseFloat((avg - multiplier * std).toFixed(4)) });
  }
  return { upper, middle, lower };
}

/** ATR – Wilder's Average True Range */
export function calcATR(data, period = 14) {
  if (!data || data.length < period + 1) return [];
  const trs = [];
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low  - data[i - 1].close),
    );
    trs.push({ time: data[i].time, tr });
  }
  const result = [];
  let atr = trs.slice(0, period).reduce((s, v) => s + v.tr, 0) / period;
  result.push({ time: trs[period - 1].time, value: parseFloat(atr.toFixed(4)) });
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i].tr) / period;
    result.push({ time: trs[i].time, value: parseFloat(atr.toFixed(4)) });
  }
  return result;
}

/**
 * Candlestick pattern detection.
 * Returns array of { time, pattern, color, shape, position }
 * shape: 'arrowUp' | 'arrowDown' | 'circle'  (lightweight-charts marker shapes)
 * position: 'belowBar' | 'aboveBar'
 */
export function detectPatterns(data) {
  const patterns = [];
  if (!data || data.length < 3) return patterns;

  for (let i = 2; i < data.length; i++) {
    const c  = data[i];
    const p  = data[i - 1];
    const pp = data[i - 2];

    const body       = Math.abs(c.close - c.open);
    const range      = c.high - c.low;
    const upperWick  = c.high - Math.max(c.open, c.close);
    const lowerWick  = Math.min(c.open, c.close) - c.low;
    const isGreen    = c.close > c.open;
    const isRed      = c.close < c.open;

    if (range < 1e-9) continue;

    // Doji – very small body
    if (body / range < 0.08) {
      patterns.push({ time: c.time, pattern: 'Doji', color: '#ffeb3b', shape: 'circle', position: 'belowBar' });
      continue;
    }
    // Hammer – long lower wick, small upper wick, small body near top
    if (lowerWick > body * 2 && upperWick < body * 0.5 && body > 0) {
      patterns.push({ time: c.time, pattern: 'Hammer', color: '#26a69a', shape: 'arrowUp', position: 'belowBar' });
      continue;
    }
    // Shooting Star – long upper wick, small lower wick
    if (upperWick > body * 2 && lowerWick < body * 0.5 && body > 0) {
      patterns.push({ time: c.time, pattern: 'Shooting Star', color: '#ef5350', shape: 'arrowDown', position: 'aboveBar' });
      continue;
    }
    // Bullish Engulfing
    if (isGreen && p.close < p.open && c.open <= p.close && c.close >= p.open) {
      patterns.push({ time: c.time, pattern: 'Engulfing ↑', color: '#26a69a', shape: 'arrowUp', position: 'belowBar' });
      continue;
    }
    // Bearish Engulfing
    if (isRed && p.close > p.open && c.open >= p.close && c.close <= p.open) {
      patterns.push({ time: c.time, pattern: 'Engulfing ↓', color: '#ef5350', shape: 'arrowDown', position: 'aboveBar' });
      continue;
    }
    // Morning Star – down candle, small body, then green reversal past midpoint
    if (pp.close < pp.open && Math.abs(p.close - p.open) < (p.high - p.low) * 0.35 && isGreen && c.close > (pp.open + pp.close) / 2) {
      patterns.push({ time: c.time, pattern: 'Morning Star', color: '#26a69a', shape: 'arrowUp', position: 'belowBar' });
      continue;
    }
    // Evening Star – up candle, small body, then red reversal past midpoint
    if (pp.close > pp.open && Math.abs(p.close - p.open) < (p.high - p.low) * 0.35 && isRed && c.close < (pp.open + pp.close) / 2) {
      patterns.push({ time: c.time, pattern: 'Evening Star', color: '#ef5350', shape: 'arrowDown', position: 'aboveBar' });
      continue;
    }
    // Spinning Top – small body, wicks on both sides
    if (body / range < 0.25 && upperWick > body && lowerWick > body) {
      patterns.push({ time: c.time, pattern: 'Spinning Top', color: '#d4a843', shape: 'circle', position: 'belowBar' });
    }
  }
  return patterns;
}