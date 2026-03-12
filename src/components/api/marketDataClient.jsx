/**
 * Client-side helper – calls Express /api/market/* endpoints (Yahoo Finance proxy).
 * When a live broker is active (Alpaca/IBKR), routes through it for real-time data.
 */

import { getActiveBroker } from '@/lib/brokerState';
import {
  getAlpacaSnapshot,
  getAlpacaBars,
  parseAlpacaQuote,
  getAlpacaMovers,
  getAlpacaUniverseStats,
} from '@/components/api/alpacaClient';

const apiFetch = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
};

export const getQuote = async (symbol, market) => {
  // US stocks → try active broker first for real-time price
  const broker = getActiveBroker();
  if (broker === 'alpaca' && (!market || market === 'us' || market === 'USA')) {
    try {
      const snap = await getAlpacaSnapshot(symbol);
      const parsed = parseAlpacaQuote(snap);
      if (parsed && parsed.price) return parsed;
    } catch { /* fall through to Yahoo */ }
  }
  return apiFetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market || 'us')}`);
};

export const getCandles = async (symbol, market, interval = 'daily') => {
  // US stocks → try active broker first for real-time candles
  const broker = getActiveBroker();
  if (broker === 'alpaca' && (!market || market === 'us' || market === 'USA')) {
    try {
      const bars = await getAlpacaBars(symbol, interval);
      if (bars && bars.length > 0) return bars;
    } catch { /* fall through to Yahoo */ }
  }
  const data = await apiFetch(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market || 'us')}&interval=${encodeURIComponent(interval)}`);
  return data?.candles || null;
};

export const getOverview = async (symbol, market) => {
  return apiFetch(`/api/market/overview?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market || 'us')}`);
};

export const getNews = async (symbol, market) => {
  try {
    const data = await apiFetch(`/api/market/news?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market || 'us')}`);
    return data?.news || [];
  } catch { return []; }
};

export const getTopMovers = async (market = 'saudi') => {
  const broker = getActiveBroker();
  if (broker === 'alpaca' && (market === 'us' || market === 'USA')) {
    try {
      // scanLimit=0 means full universe scan server-side (cached there)
      return await getAlpacaMovers({ limit: 10, scanLimit: 0 });
    } catch {
      // fall through to backend proxy
    }
  }

  try {
    const data = await apiFetch(`/api/market/top-movers?market=${encodeURIComponent(market)}`);
    return data;
  } catch { return null; }
};

export const getOptionsChain = async ({ symbol, type = 'call', offset = 0, expiry } = {}) => {
  if (!symbol) throw new Error('symbol required');
  const params = new URLSearchParams({
    symbol: String(symbol).toUpperCase(),
    type,
    offset: String(offset),
  });
  if (expiry) params.set('expiry', String(expiry));
  return apiFetch(`/api/market/options-chain?${params.toString()}`);
};

export const getMarketPulse = async () => {
  return apiFetch('/api/market/market-pulse');
};

export const getBrokerUniverseStats = async () => {
  const broker = getActiveBroker();
  if (broker === 'alpaca') {
    try {
      return await getAlpacaUniverseStats();
    } catch {
      return null;
    }
  }
  return null;
};

export const getForex = async (from = "USD", to = "SAR") => {
  return apiFetch(`/api/market/forex?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
};

export const getCrypto = async (coin = "BTC", currency = "USD") => {
  try {
    const data = await apiFetch(`/api/market/crypto?coin=${encodeURIComponent(coin)}&currency=${encodeURIComponent(currency)}`);
    return data;
  } catch { return null; }
};

export const getIndices = async () => {
  const data = await apiFetch('/api/market/indices');
  return data?.indices || null;
};

export const getBatchQuotes = async (symbols, market) => {
  if (!symbols?.length) return {};
  const data = await apiFetch(
    `/api/market/batch-quotes?symbols=${encodeURIComponent(symbols.join(','))}&market=${encodeURIComponent(market || 'saudi')}`
  );
  return data?.quotes || {};
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