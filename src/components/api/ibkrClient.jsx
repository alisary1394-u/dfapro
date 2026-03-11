/**
 * Interactive Brokers TWS API Client
 * 
 * Connects to IB Gateway via TWS protocol through our Express server.
 * IB Gateway runs on port 4001 (live) or 4002 (paper).
 */

// ─── Configuration ───────────────────────────────────────────

const IBKR_STORAGE_KEY = 'ibkr_config';

const getConfig = () => {
  try {
    const raw = sessionStorage.getItem(IBKR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveConfig = (config) => {
  sessionStorage.setItem(IBKR_STORAGE_KEY, JSON.stringify(config));
};

const clearConfig = () => {
  sessionStorage.removeItem(IBKR_STORAGE_KEY);
};

// ─── API Helpers ─────────────────────────────────────────────

const ibkrFetch = async (endpoint, options = {}) => {
  const res = await fetch(`/api/ibkr${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(options.timeout || 15000),
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `IBKR API error: ${res.status}`);
  }
  return res.json();
};

// ─── Connection ──────────────────────────────────────────────

/** Connect to IB Gateway via TWS API */
export const connectToGateway = async (host = '127.0.0.1', port = 4001, clientId = 0) => {
  return ibkrFetch('/connect', {
    method: 'POST',
    body: JSON.stringify({ host, port, clientId }),
  });
};

/** Disconnect from IB Gateway */
export const disconnectFromGateway = async () => {
  return ibkrFetch('/disconnect', { method: 'POST' });
};

/** Get connection status */
export const getConnectionStatus = async () => {
  return ibkrFetch('/status');
};

// ─── Account ─────────────────────────────────────────────────

/** Get managed accounts */
export const getAccounts = async () => {
  return ibkrFetch('/accounts');
};

/** Get account summary */
export const getAccountSummary = async (accountId) => {
  return ibkrFetch(`/account/${encodeURIComponent(accountId)}/summary`);
};

/** Get positions */
export const getPositions = async () => {
  return ibkrFetch('/positions');
};

// ─── Contract/Symbol Search ──────────────────────────────────

/** Search for a contract by symbol */
export const searchContract = async (symbol) => {
  return ibkrFetch('/search', {
    method: 'POST',
    body: JSON.stringify({ symbol }),
  });
};

/** Get contract details by conid */
export const getContractDetails = async (conid) => {
  return ibkrFetch(`/contract/${conid}`);
};

// ─── Market Data ─────────────────────────────────────────────

/** Get market data snapshot */
export const getMarketSnapshot = async (conid, exchange = 'SMART', currency = 'USD', secType = 'STK') => {
  const qs = new URLSearchParams({ exchange, currency, secType }).toString();
  return ibkrFetch(`/quote/${conid}?${qs}`, { timeout: 15000 });
};

/** Get historical data (candles) */
export const getHistoricalData = async (conid, interval = 'daily', exchange = 'SMART', currency = 'USD', secType = 'STK') => {
  const qs = new URLSearchParams({ interval, exchange, currency, secType }).toString();
  return ibkrFetch(`/history/${conid}?${qs}`, { timeout: 35000 });
};

// ─── Streaming (SSE) ─────────────────────────────────────────

/**
 * Subscribe to real-time market data via Server-Sent Events (SSE).
 */
export const subscribeMarketData = (conid, onTick, opts = {}) => {
  const { exchange = 'SMART', currency = 'USD', secType = 'STK' } = opts;
  const qs = new URLSearchParams({ exchange, currency, secType }).toString();
  const es = new EventSource(`/api/ibkr/stream/${conid}?${qs}`);

  es.onmessage = (event) => {
    try {
      const tick = JSON.parse(event.data);
      onTick(tick);
    } catch { /* ignore parse errors */ }
  };

  es.onerror = () => {
    // EventSource auto-reconnects
  };

  return {
    close: () => es.close(),
  };
};

/** Unsubscribe all market data */
export const unsubscribeAll = async () => {
  return ibkrFetch('/unsubscribe-all', { method: 'POST' }).catch(() => {});
};

// ─── Data Transformers ───────────────────────────────────────

const TICK_FIELDS = {
  1: 'bid', 2: 'ask', 4: 'last', 6: 'high', 7: 'low', 9: 'close',
  14: 'open', 0: 'bidSize', 3: 'askSize', 5: 'lastSize', 8: 'volume',
};

/** Parse SSE tick update into partial quote update */
export const parseTickUpdate = (tick) => {
  if (!tick) return null;
  const field = TICK_FIELDS[tick.tickType];
  if (!field) return null;
  return { field, value: tick.value, type: tick.type, timestamp: Date.now() };
};

/** Parse snapshot response (already formatted by server) */
export const parseSnapshotToQuote = (snapshot) => {
  if (!snapshot) return null;
  return {
    price: snapshot.price || 0,
    change: snapshot.change || 0,
    change_percent: snapshot.change_percent || 0,
    volume: snapshot.volume || 0,
    high: snapshot.high || 0,
    low: snapshot.low || 0,
    bid: snapshot.bid || 0,
    ask: snapshot.ask || 0,
    bidSize: snapshot.bidSize || 0,
    askSize: snapshot.askSize || 0,
    open: snapshot.open || 0,
    prevClose: snapshot.prevClose || 0,
    conid: snapshot.conid,
  };
};

/** Parse historical data into candles */
export const parseHistoryToCandles = (historyResponse) => {
  if (!historyResponse?.data) return [];
  return historyResponse.data.filter(c => c.open && c.close);
};

// ─── Config Exports ──────────────────────────────────────────

export const ibkrConfig = { getConfig, saveConfig, clearConfig };
