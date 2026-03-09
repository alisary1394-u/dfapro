/**
 * Interactive Brokers Client Portal API Client
 * 
 * Connects to IBKR Client Portal Gateway through our Express server proxy.
 * 
 * Prerequisites:
 * 1. Download IB Gateway / Client Portal Gateway from IBKR
 * 2. Run the gateway (default: https://localhost:5000)
 * 3. Authenticate via the gateway's web UI
 * 4. Configure the gateway URL in the app settings
 * 
 * API Docs: https://www.interactivebrokers.com/api/doc.html
 */

// ─── Configuration ───────────────────────────────────────────

const IBKR_STORAGE_KEY = 'ibkr_config';

const getConfig = () => {
  try {
    const raw = localStorage.getItem(IBKR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveConfig = (config) => {
  localStorage.setItem(IBKR_STORAGE_KEY, JSON.stringify(config));
};

const clearConfig = () => {
  localStorage.removeItem(IBKR_STORAGE_KEY);
};

// ─── API Helpers ─────────────────────────────────────────────

const ibkrFetch = async (endpoint, options = {}) => {
  const res = await fetch(`/api/ibkr${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(options.timeout || 10000),
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `IBKR API error: ${res.status}`);
  }
  return res.json();
};

// ─── Auth & Connection ───────────────────────────────────────

/** Check if IBKR gateway session is active */
export const checkAuthStatus = async () => {
  return ibkrFetch('/auth/status');
};

/** Re-authenticate / keep session alive */
export const reauthenticate = async () => {
  return ibkrFetch('/auth/reauthenticate', { method: 'POST' });
};

/** Tickle the session to keep it alive */
export const tickle = async () => {
  return ibkrFetch('/tickle', { method: 'POST' });
};

// ─── Account ─────────────────────────────────────────────────

/** Get portfolio accounts */
export const getAccounts = async () => {
  return ibkrFetch('/portfolio/accounts');
};

/** Get account summary */
export const getAccountSummary = async (accountId) => {
  return ibkrFetch(`/portfolio/${encodeURIComponent(accountId)}/summary`);
};

/** Get account positions */
export const getPositions = async (accountId) => {
  return ibkrFetch(`/portfolio/${encodeURIComponent(accountId)}/positions/0`);
};

// ─── Contract/Symbol Search ──────────────────────────────────

/** Search for a contract by symbol */
export const searchContract = async (symbol) => {
  return ibkrFetch('/iserver/secdef/search', {
    method: 'POST',
    body: JSON.stringify({ symbol, name: true }),
  });
};

/** Get contract details by conid */
export const getContractDetails = async (conid) => {
  return ibkrFetch(`/iserver/contract/${conid}/info`);
};

// ─── Market Data ─────────────────────────────────────────────

/**
 * Fields mapping (common):
 * 31 = Last Price, 70 = High, 71 = Low, 82 = Change, 83 = Change %,
 * 84 = Bid, 85 = Ask, 86 = Bid Size, 88 = Ask Size,
 * 87 = Volume, 7219 = Contract Description, 7762 = Open,
 * 7282 = 52W High, 7283 = 52W Low, 7284 = Previous Close,
 * 7288 = Avg Volume, 7289 = Market Cap
 */
const SNAPSHOT_FIELDS = '31,70,71,82,83,84,85,86,87,88,7219,7762,7282,7283,7284,7288';

/** Get market data snapshot for one or more conids */
export const getMarketSnapshot = async (conids) => {
  const ids = Array.isArray(conids) ? conids.join(',') : conids;
  // IBKR requires calling snapshot twice (first to subscribe, second to get data)
  await ibkrFetch(`/iserver/marketdata/snapshot?conids=${ids}&fields=${SNAPSHOT_FIELDS}`)
    .catch(() => null);
  // Wait briefly for data to populate
  await new Promise(r => setTimeout(r, 500));
  return ibkrFetch(`/iserver/marketdata/snapshot?conids=${ids}&fields=${SNAPSHOT_FIELDS}`);
};

/** Unsubscribe from market data */
export const unsubscribeMarketData = async (conid) => {
  return ibkrFetch(`/iserver/marketdata/${conid}/unsubscribe`, {
    method: 'DELETE',
  }).catch(() => {});
};

/** Unsubscribe from all market data */
export const unsubscribeAll = async () => {
  return ibkrFetch('/iserver/marketdata/unsubscribeall', {
    method: 'GET',
  }).catch(() => {});
};

// ─── Historical Data ─────────────────────────────────────────

const IBKR_BAR_MAP = {
  '1min': '1min', '5min': '5min', '15min': '15min', '30min': '30min',
  '60min': '1hour', 'daily': '1day', 'weekly': '1week', 'monthly': '1month',
};

const IBKR_PERIOD_MAP = {
  '1min': '1d', '5min': '2d', '15min': '1w', '30min': '1w',
  '60min': '1m', 'daily': '1y', 'weekly': '5y', 'monthly': '10y',
};

/**
 * Get historical market data (candles)
 * @param {number} conid - Contract ID
 * @param {string} interval - Interval key (daily, 1min, etc)
 * @param {string} period - Optional override (e.g., "1y", "6m")
 */
export const getHistoricalData = async (conid, interval = 'daily', period = null) => {
  const bar = IBKR_BAR_MAP[interval] || '1day';
  const queriedPeriod = period || IBKR_PERIOD_MAP[interval] || '1y';
  return ibkrFetch(
    `/iserver/marketdata/history?conid=${conid}&bar=${bar}&period=${queriedPeriod}&outsideRth=false`
  );
};

// ─── Orders ──────────────────────────────────────────────────

/** Place an order */
export const placeOrder = async (accountId, orders) => {
  return ibkrFetch(`/iserver/account/${encodeURIComponent(accountId)}/orders`, {
    method: 'POST',
    body: JSON.stringify({ orders }),
  });
};

/** Confirm an order (reply to order confirmation prompts) */
export const confirmOrder = async (replyId, confirmed = true) => {
  return ibkrFetch(`/iserver/reply/${replyId}`, {
    method: 'POST',
    body: JSON.stringify({ confirmed }),
  });
};

/** Get live orders */
export const getLiveOrders = async () => {
  return ibkrFetch('/iserver/account/orders');
};

// ─── Streaming WebSocket ─────────────────────────────────────

/**
 * Create a WebSocket connection for streaming market data.
 * The server proxies WebSocket to the IBKR gateway.
 * 
 * @param {Function} onMessage - Callback for incoming messages
 * @param {Function} onError - Callback for errors
 * @returns {{ ws, subscribe, unsubscribe, close }}
 */
export const createMarketDataStream = (onMessage, onError) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/api/ibkr/ws`);

  ws.onopen = () => {
    console.log('[IBKR WS] Connected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch {
      // Binary or non-JSON message
    }
  };

  ws.onerror = (err) => {
    console.error('[IBKR WS] Error:', err);
    onError?.(err);
  };

  ws.onclose = () => {
    console.log('[IBKR WS] Disconnected');
  };

  const subscribe = (conid, fields = SNAPSHOT_FIELDS) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`smd+${conid}+{"fields":["${fields.split(',').join('","')}"]}`);
    }
  };

  const unsubscribe = (conid) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`umd+${conid}+{}`);
    }
  };

  const close = () => {
    ws.close();
  };

  return { ws, subscribe, unsubscribe, close };
};

// ─── Data Transformers ───────────────────────────────────────

/**
 * Parse IBKR snapshot into our standard quote format
 */
export const parseSnapshotToQuote = (snapshot) => {
  if (!snapshot) return null;
  // Field IDs: 31=last, 70=high, 71=low, 82=change, 83=change%, 84=bid, 85=ask, 87=vol, 7762=open
  return {
    price: parseFloat(snapshot['31']) || snapshot.lastPrice || 0,
    change: parseFloat(snapshot['82']) || 0,
    change_percent: parseFloat(String(snapshot['83']).replace('%', '')) || 0,
    volume: parseInt(snapshot['87']) || 0,
    high: parseFloat(snapshot['70']) || 0,
    low: parseFloat(snapshot['71']) || 0,
    bid: parseFloat(snapshot['84']) || 0,
    ask: parseFloat(snapshot['85']) || 0,
    bidSize: parseInt(snapshot['86']) || 0,
    askSize: parseInt(snapshot['88']) || 0,
    open: parseFloat(snapshot['7762']) || 0,
    high52: parseFloat(snapshot['7282']) || 0,
    low52: parseFloat(snapshot['7283']) || 0,
    prevClose: parseFloat(snapshot['7284']) || 0,
    avgVolume: parseInt(snapshot['7288']) || 0,
    name: snapshot['7219'] || snapshot.conid || '',
    currency: snapshot.currency || 'USD',
    conid: snapshot.conid,
  };
};

/**
 * Parse IBKR historical data into our standard candle format
 */
export const parseHistoryToCandles = (historyResponse) => {
  if (!historyResponse?.data) return [];
  return historyResponse.data.map(bar => {
    // IBKR returns time as epoch milliseconds for intraday, YYYYMMDD strings for daily+
    let time;
    if (typeof bar.t === 'string') {
      // Format: "20240315" → "2024-03-15"
      time = bar.t.length === 8
        ? `${bar.t.slice(0, 4)}-${bar.t.slice(4, 6)}-${bar.t.slice(6, 8)}`
        : bar.t;
    } else {
      // Epoch milliseconds
      time = Math.floor(bar.t / 1000);
    }
    return {
      time,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v || 0,
    };
  }).filter(c => c.open && c.close);
};

/**
 * Parse streaming WebSocket data into quote update
 */
export const parseStreamUpdate = (data) => {
  if (!data || !data.conid) return null;
  return {
    conid: data.conid,
    price: parseFloat(data['31']) || null,
    change: parseFloat(data['82']) || null,
    change_percent: data['83'] ? parseFloat(String(data['83']).replace('%', '')) : null,
    volume: data['87'] ? parseInt(data['87']) : null,
    high: parseFloat(data['70']) || null,
    low: parseFloat(data['71']) || null,
    bid: parseFloat(data['84']) || null,
    ask: parseFloat(data['85']) || null,
    open: parseFloat(data['7762']) || null,
    timestamp: Date.now(),
  };
};

// ─── Exports ─────────────────────────────────────────────────

export const ibkrConfig = { getConfig, saveConfig, clearConfig };

export default {
  // Config
  config: ibkrConfig,
  // Auth
  checkAuthStatus,
  reauthenticate,
  tickle,
  // Account
  getAccounts,
  getAccountSummary,
  getPositions,
  // Contract
  searchContract,
  getContractDetails,
  // Market Data
  getMarketSnapshot,
  unsubscribeMarketData,
  unsubscribeAll,
  getHistoricalData,
  // Orders
  placeOrder,
  confirmOrder,
  getLiveOrders,
  // Streaming
  createMarketDataStream,
  // Transformers
  parseSnapshotToQuote,
  parseHistoryToCandles,
  parseStreamUpdate,
};
