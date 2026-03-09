/**
 * Client-side helper to call the marketData backend function.
 */
import { base44 } from "@/api/base44Client";

const invoke = (action, extra = {}) =>
  base44.functions.invoke("marketData", { action, ...extra });

export const getQuote = async (symbol, market) => {
  const res = await invoke("quote", { symbol, market });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
};

export const getCandles = async (symbol, market, interval = 'daily') => {
  const res = await invoke("candles", { symbol, market, interval });
  if (res.data?.error) return null;
  return res.data?.candles || null;
};

export const getOverview = async (symbol, market) => {
  const res = await invoke("overview", { symbol, market });
  if (res.data?.error) return null;
  return res.data;
};

export const getNews = async (symbol, market) => {
  const res = await invoke("news", { symbol, market });
  return res.data?.news || [];
};

export const getTopMovers = async (market = 'saudi') => {
  const res = await invoke("top_movers", { market });
  return res.data;
};

export const getForex = async (from = "USD", to = "SAR") => {
  const res = await invoke("forex", { from, to });
  if (res.data?.error) return null;
  return res.data;
};

export const getCrypto = async (coin = "BTC", currency = "USD") => {
  const res = await invoke("crypto", { coin, currency });
  if (res.data?.error) return null;
  return res.data;
};

export const getIndices = async () => {
  const res = await invoke("indices");
  if (res.data?.error) return null;
  return res.data?.indices || null;
};

export const getBatchQuotes = async (symbols, market) => {
  const res = await invoke("batch_quotes", { symbols: symbols.join(','), market });
  if (res.data?.error) return null;
  return res.data?.quotes || null;
};

// Simulated candles centred around a real price when API limit is hit
// Prices are anchored to basePrice and cannot drift far from it
export const buildFallbackCandles = (basePrice = 100, days = 100) => {
  const volatility = 0.012; // 1.2% daily volatility
  return Array.from({ length: days }, (_, i) => {
    // Use a mean-reverting random walk anchored to basePrice
    const t = (i / days) * 2 * Math.PI;
    const cycleFactor = Math.sin(t) * 0.04; // ±4% cycle
    const noise = (Math.random() - 0.5) * volatility * basePrice;
    const close = parseFloat((basePrice * (1 + cycleFactor * ((days - i) / days)) + noise).toFixed(2));
    const open = parseFloat((close * (1 + (Math.random() - 0.5) * 0.008)).toFixed(2));
    const high = parseFloat((Math.max(close, open) * (1 + Math.random() * 0.006)).toFixed(2));
    const low = parseFloat((Math.min(close, open) * (1 - Math.random() * 0.006)).toFixed(2));
    return {
      time: new Date(Date.now() - (days - i) * 86400000).toISOString().split("T")[0],
      open,
      high,
      low,
      close: Math.max(close, 0.1),
      volume: Math.floor(Math.random() * 5000000 + 500000),
    };
  });
};