/**
 * Alpaca Markets API Client
 * 
 * REST API client for Alpaca - works directly from Codespace (cloud).
 * No local gateway needed - just API keys.
 */

// ─── Configuration ───────────────────────────────────────────

const ALPACA_STORAGE_KEY = 'alpaca_config';

const getConfig = () => {
  try {
    const raw = localStorage.getItem(ALPACA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveConfig = (config) => {
  localStorage.setItem(ALPACA_STORAGE_KEY, JSON.stringify(config));
};

const clearConfig = () => {
  localStorage.removeItem(ALPACA_STORAGE_KEY);
};

// ─── API Helpers ─────────────────────────────────────────────

const alpacaFetch = async (endpoint, options = {}) => {
  const res = await fetch(`/api/alpaca${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(options.timeout || 15000),
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Alpaca API error: ${res.status}`);
  }
  return res.json();
};

// ─── Connection ──────────────────────────────────────────────

/** Connect with API keys */
export const connectAlpaca = async (apiKey, secretKey, paper = true) => {
  return alpacaFetch('/connect', {
    method: 'POST',
    body: JSON.stringify({ apiKey, secretKey, paper }),
  });
};

/** Disconnect */
export const disconnectAlpaca = async () => {
  return alpacaFetch('/disconnect', { method: 'POST' });
};

/** Get connection status */
export const getAlpacaStatus = async () => {
  return alpacaFetch('/status');
};

// ─── Account ─────────────────────────────────────────────────

/** Get account info */
export const getAlpacaAccount = async () => {
  return alpacaFetch('/account');
};

/** Get positions */
export const getAlpacaPositions = async () => {
  return alpacaFetch('/positions');
};

/** Get orders */
export const getAlpacaOrders = async (status = 'open') => {
  return alpacaFetch(`/orders?status=${encodeURIComponent(status)}`);
};

// ─── Market Data ─────────────────────────────────────────────

/** Get market snapshot for a symbol */
export const getAlpacaSnapshot = async (symbol) => {
  return alpacaFetch(`/snapshot/${encodeURIComponent(symbol)}`);
};

/** Get historical bars */
export const getAlpacaBars = async (symbol, interval = 'daily') => {
  const qs = new URLSearchParams({ interval }).toString();
  return alpacaFetch(`/bars/${encodeURIComponent(symbol)}?${qs}`, { timeout: 20000 });
};

/** Search assets */
export const searchAlpacaAsset = async (query) => {
  return alpacaFetch(`/search?q=${encodeURIComponent(query)}`);
};

// ─── Streaming (SSE) ─────────────────────────────────────────

/** Subscribe to real-time quotes via SSE (server polls Alpaca) */
export const subscribeAlpacaQuotes = (symbol, onTick) => {
  const es = new EventSource(`/api/alpaca/stream/${encodeURIComponent(symbol)}`);

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onTick(data);
    } catch { /* ignore */ }
  };

  es.onerror = () => {};

  return { close: () => es.close() };
};

// ─── Data Transformers ───────────────────────────────────────

/** Parse Alpaca snapshot to standard quote format */
export const parseAlpacaQuote = (snapshot) => {
  if (!snapshot) return null;
  const trade = snapshot.latestTrade || {};
  const quote = snapshot.latestQuote || {};
  const daily = snapshot.dailyBar || {};
  const prev = snapshot.prevDailyBar || {};
  const price = trade.p || daily.c || 0;
  const prevClose = prev.c || 0;
  const change = prevClose ? +(price - prevClose).toFixed(4) : 0;
  const changePct = prevClose ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0;

  return {
    price,
    change,
    change_percent: changePct,
    volume: daily.v || 0,
    high: daily.h || 0,
    low: daily.l || 0,
    open: daily.o || 0,
    bid: quote.bp || 0,
    ask: quote.ap || 0,
    bidSize: quote.bs || 0,
    askSize: quote.as || 0,
    prevClose,
  };
};

/** Parse Alpaca bars to candles */
export const parseAlpacaBars = (bars) => {
  if (!Array.isArray(bars)) return [];
  return bars.filter(b => b.open && b.close);
};

/** Parse SSE tick update to partial quote */
export const parseAlpacaTick = (tick) => {
  if (!tick) return null;
  return {
    price: tick.price || 0,
    change: tick.price && tick.prevClose ? +(tick.price - tick.prevClose).toFixed(4) : 0,
    change_percent: tick.price && tick.prevClose ? +(((tick.price - tick.prevClose) / tick.prevClose) * 100).toFixed(2) : 0,
    volume: tick.volume || 0,
    high: tick.high || 0,
    low: tick.low || 0,
    open: tick.open || 0,
    bid: tick.bid || 0,
    ask: tick.ask || 0,
    bidSize: tick.bidSize || 0,
    askSize: tick.askSize || 0,
    prevClose: tick.prevClose || 0,
  };
};

// ─── Config Exports ──────────────────────────────────────────

export const alpacaConfig = { getConfig, saveConfig, clearConfig };
