// ═══════════════════════════════════════════════════════════════
// ALPACA API Module - REST API client for Alpaca Markets
// ═══════════════════════════════════════════════════════════════
// Alpaca REST API: https://docs.alpaca.markets/reference

let config = {
  apiKey: '',
  secretKey: '',
  paper: true, // true = paper trading, false = live
};

const PAPER_URL = 'https://paper-api.alpaca.markets';
const LIVE_URL = 'https://api.alpaca.markets';
const DATA_URL = 'https://data.alpaca.markets';

function getBaseUrl() {
  return config.paper ? PAPER_URL : LIVE_URL;
}

function getHeaders() {
  return {
    'APCA-API-KEY-ID': config.apiKey,
    'APCA-API-SECRET-KEY': config.secretKey,
    'Content-Type': 'application/json',
  };
}

async function alpacaFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Alpaca API ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Connection ──
export function connect(apiKey, secretKey, paper = true) {
  config.apiKey = apiKey;
  config.secretKey = secretKey;
  config.paper = paper;
}

export function disconnect() {
  config.apiKey = '';
  config.secretKey = '';
  config.paper = true;
}

export function isConnected() {
  return !!(config.apiKey && config.secretKey);
}

export function getStatus() {
  return {
    connected: isConnected(),
    paper: config.paper,
  };
}

// ── Account ──
export async function getAccount() {
  return alpacaFetch(`${getBaseUrl()}/v2/account`);
}

// ── Positions ──
export async function getPositions() {
  return alpacaFetch(`${getBaseUrl()}/v2/positions`);
}

// ── Orders ──
export async function getOrders(status = 'open') {
  return alpacaFetch(`${getBaseUrl()}/v2/orders?status=${encodeURIComponent(status)}`);
}

export async function placeOrder(order) {
  return alpacaFetch(`${getBaseUrl()}/v2/orders`, {
    method: 'POST',
    body: JSON.stringify(order),
  });
}

// ── Market Data: Snapshot ──
export async function getSnapshot(symbol) {
  return alpacaFetch(
    `${DATA_URL}/v2/stocks/${encodeURIComponent(symbol)}/snapshot`,
  );
}

// ── Market Data: Latest Quote ──
export async function getLatestQuote(symbol) {
  return alpacaFetch(
    `${DATA_URL}/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`,
  );
}

// ── Market Data: Latest Trade ──
export async function getLatestTrade(symbol) {
  return alpacaFetch(
    `${DATA_URL}/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`,
  );
}

// ── Market Data: Historical Bars ──
const TF_MAP = {
  '1min': { timeframe: '1Min', limit: 390 },
  '5min': { timeframe: '5Min', limit: 390 },
  '15min': { timeframe: '15Min', limit: 300 },
  '30min': { timeframe: '30Min', limit: 200 },
  '60min': { timeframe: '1Hour', limit: 200 },
  'daily': { timeframe: '1Day', limit: 365 },
  'weekly': { timeframe: '1Week', limit: 200 },
  'monthly': { timeframe: '1Month', limit: 120 },
};

export async function getBars(symbol, interval = 'daily') {
  const tf = TF_MAP[interval] || TF_MAP.daily;
  const params = new URLSearchParams({
    timeframe: tf.timeframe,
    limit: String(tf.limit),
    adjustment: 'split',
    feed: 'iex',
  });
  const data = await alpacaFetch(
    `${DATA_URL}/v2/stocks/${encodeURIComponent(symbol)}/bars?${params}`,
  );
  return (data.bars || []).map(bar => ({
    time: bar.t,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }));
}

// ── Market Data: SSE Streaming (simulated via polling) ──
const streamIntervals = new Map();

export function subscribeQuotes(symbol, callback) {
  const id = symbol + '_' + Date.now();

  const poll = async () => {
    try {
      const snapshot = await getSnapshot(symbol);
      callback({
        symbol,
        price: snapshot.latestTrade?.p || snapshot.minuteBar?.c || 0,
        bid: snapshot.latestQuote?.bp || 0,
        ask: snapshot.latestQuote?.ap || 0,
        bidSize: snapshot.latestQuote?.bs || 0,
        askSize: snapshot.latestQuote?.as || 0,
        volume: snapshot.dailyBar?.v || 0,
        high: snapshot.dailyBar?.h || 0,
        low: snapshot.dailyBar?.l || 0,
        open: snapshot.dailyBar?.o || 0,
        prevClose: snapshot.prevDailyBar?.c || 0,
      });
    } catch (err) {
      console.error('[Alpaca] Polling error:', err.message);
    }
  };

  poll(); // immediate first call
  const iv = setInterval(poll, 3000); // poll every 3s
  streamIntervals.set(id, iv);

  return {
    id,
    unsubscribe: () => {
      clearInterval(iv);
      streamIntervals.delete(id);
    },
  };
}

export function unsubscribeAll() {
  for (const [id, iv] of streamIntervals) {
    clearInterval(iv);
  }
  streamIntervals.clear();
}

// ── Asset Search ──
export async function searchAssets(query) {
  const assets = await alpacaFetch(`${getBaseUrl()}/v2/assets?status=active`);
  const q = query.toUpperCase();
  return assets
    .filter(a => a.tradable && (a.symbol.includes(q) || a.name.toUpperCase().includes(q)))
    .slice(0, 20)
    .map(a => ({
      symbol: a.symbol,
      name: a.name,
      exchange: a.exchange,
      class: a.class,
    }));
}
