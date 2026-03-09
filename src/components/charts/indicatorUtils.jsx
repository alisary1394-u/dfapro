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