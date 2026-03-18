/**
 * Polygon.io API Client
 * 
 * REST + SSE client matching alpacaClient.jsx patterns.
 * Supports: bars (including seconds!), snapshots, streaming, search, options.
 */

// ─── Configuration ───────────────────────────────────────────

const POLYGON_STORAGE_KEY = 'polygon_config';

const getConfig = () => {
  try {
    const raw = localStorage.getItem(POLYGON_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const saveConfig = (config) => {
  localStorage.setItem(POLYGON_STORAGE_KEY, JSON.stringify(config));
};

const clearConfig = () => {
  localStorage.removeItem(POLYGON_STORAGE_KEY);
};

// ─── API Helpers ─────────────────────────────────────────────

const polygonFetch = async (endpoint, options = {}) => {
  const res = await fetch(`/api/polygon${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(options.timeout || 15000),
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Polygon API error: ${res.status}`);
  }
  return res.json();
};

// ─── Connection ──────────────────────────────────────────────

/** Connect with API key */
export const connectPolygon = async (apiKey) => {
  return polygonFetch('/connect', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
};

/** Disconnect */
export const disconnectPolygon = async () => {
  return polygonFetch('/disconnect', { method: 'POST' });
};

/** Get connection status */
export const getPolygonStatus = async () => {
  return polygonFetch('/status');
};

// ─── Market Data ─────────────────────────────────────────────

/** Get market snapshot for a symbol */
export const getPolygonSnapshot = async (symbol) => {
  return polygonFetch(`/snapshot/${encodeURIComponent(symbol)}`);
};

/** Get historical bars (supports seconds!) */
export const getPolygonBars = async (symbol, interval = 'daily', range = '') => {
  const params = new URLSearchParams({ interval });
  if (range) params.set('range', range);
  return polygonFetch(`/bars/${encodeURIComponent(symbol)}?${params.toString()}`, { timeout: 20000 });
};

/** Search tickers */
export const searchPolygonTicker = async (query) => {
  return polygonFetch(`/search?q=${encodeURIComponent(query)}`);
};

/** Get ticker details */
export const getPolygonTickerDetails = async (symbol) => {
  return polygonFetch(`/ticker/${encodeURIComponent(symbol)}`);
};

/** Get movers (gainers/losers) */
export const getPolygonMovers = async (direction = 'gainers') => {
  return polygonFetch(`/movers?direction=${encodeURIComponent(direction)}`);
};

/** Get previous day data */
export const getPolygonPrevDay = async (symbol) => {
  return polygonFetch(`/prev/${encodeURIComponent(symbol)}`);
};

/** Get market status */
export const getPolygonMarketStatus = async () => {
  return polygonFetch('/market-status');
};

// ─── Options ─────────────────────────────────────────────────

/** Get options chain snapshot */
export const getPolygonOptionsChain = async (symbol, expiry = '') => {
  const params = expiry ? `?expiry=${encodeURIComponent(expiry)}` : '';
  return polygonFetch(`/options/${encodeURIComponent(symbol)}${params}`);
};

/** Get options expirations */
export const getPolygonOptionsExpirations = async (symbol) => {
  return polygonFetch(`/options-expirations/${encodeURIComponent(symbol)}`);
};

// ─── Streaming (SSE → server WebSocket → Polygon) ────────────

export const subscribePolygonQuotes = (symbol, onTick) => {
  let es = null;
  let closed = false;
  let reconnectTimer = null;

  const connect = () => {
    if (closed) return;
    es = new EventSource(`/api/polygon/stream/${encodeURIComponent(symbol)}`);

    es.onopen = () => {
      console.log('[Polygon SSE] Connected for', symbol);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onTick(data);
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      if (closed) return;
      console.warn('[Polygon SSE] Error for', symbol, '— reconnecting in 5s');
      try { es.close(); } catch {}
      reconnectTimer = setTimeout(connect, 5000);
    };
  };

  connect();

  return {
    close: () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) try { es.close(); } catch {}
    },
  };
};

// ─── Data Transformers ───────────────────────────────────────

/** Parse Polygon snapshot to standard quote format */
export const parsePolygonQuote = (snapshot) => {
  if (!snapshot) return null;
  const ticker = snapshot.ticker || snapshot;
  const trade = ticker.lastTrade || {};
  const quote = ticker.lastQuote || {};
  const day   = ticker.day || {};
  const prev  = ticker.prevDay || {};

  const price = trade.p || day.c || 0;
  const prevClose = prev.c || 0;
  const change = prevClose ? +(price - prevClose).toFixed(4) : 0;
  const changePct = prevClose ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0;

  return {
    price,
    change,
    change_percent: changePct,
    volume: day.v || 0,
    high: day.h || 0,
    low: day.l || 0,
    open: day.o || 0,
    bid: quote.P || 0,     // Polygon uses P for bid price
    ask: quote.p || 0,     // Polygon uses p for ask price
    bidSize: quote.S || 0,
    askSize: quote.s || 0,
    prevClose,
    vwap: day.vw || 0,
  };
};

/** Parse Polygon bars to candles */
export const parsePolygonBars = (bars) => {
  if (!Array.isArray(bars)) return [];
  return bars.filter(b => b.open && b.close);
};

/** Parse SSE tick update to partial quote */
export const parsePolygonTick = (tick) => {
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

export const polygonConfig = { getConfig, saveConfig, clearConfig };
