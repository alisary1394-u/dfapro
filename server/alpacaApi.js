// ═══════════════════════════════════════════════════════════════
// ALPACA API Module - REST API + WebSocket Real-Time Streaming
// ═══════════════════════════════════════════════════════════════
import WebSocket from 'ws';

let config = {
  apiKey: '',
  secretKey: '',
  paper: true,
};

const PAPER_URL = 'https://paper-api.alpaca.markets';
const LIVE_URL  = 'https://api.alpaca.markets';
const DATA_URL  = 'https://data.alpaca.markets';
// IEX = free feed (paper), SIP = paid feed (live)
const WS_IEX = 'wss://stream.data.alpaca.markets/v2/iex';
const WS_SIP = 'wss://stream.data.alpaca.markets/v2/sip';

function getBaseUrl()  { return config.paper ? PAPER_URL : LIVE_URL; }
function getWsUrl()    { return config.paper ? WS_IEX : WS_SIP; }

function getHeaders() {
  return {
    'APCA-API-KEY-ID':     config.apiKey,
    'APCA-API-SECRET-KEY': config.secretKey,
    'Content-Type':        'application/json',
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
  config.apiKey    = apiKey;
  config.secretKey = secretKey;
  config.paper     = paper;
  _restartWs();   // (re)connect WebSocket stream immediately
}

export function disconnect() {
  _closeWs();
  config.apiKey    = '';
  config.secretKey = '';
  config.paper     = true;
}

export function isConnected() { return !!(config.apiKey && config.secretKey); }

export function getStatus() {
  return { connected: isConnected(), paper: config.paper };
}

// ═══════════════════════════════════════════════════════════════
// Real-Time WebSocket Stream
// Single shared WS connection → fan-out to SSE subscribers
// ═══════════════════════════════════════════════════════════════

let _ws        = null;
let _wsReady   = false;
let _wsRetry   = null;
let _subscribed = new Set();   // symbols currently subscribed on WS
const _listeners = new Map();  // symbol → Set of callbacks

// Last known snapshot per symbol (for new subscribers)
const _lastTick = new Map();

function _sendWs(msg) {
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify(msg));
  }
}

function _resubscribeAll() {
  const syms = [..._subscribed];
  if (syms.length) {
    _sendWs({ action: 'subscribe', trades: syms, quotes: syms });
  }
}

function _closeWs() {
  if (_wsRetry) { clearTimeout(_wsRetry); _wsRetry = null; }
  if (_ws) {
    try { _ws.close(); } catch {}
    _ws     = null;
    _wsReady = false;
  }
}

function _restartWs() {
  _closeWs();
  if (!isConnected()) return;

  const url = getWsUrl();
  console.log('[Alpaca WS] Connecting to', url);
  _ws = new WebSocket(url);

  _ws.on('open', () => {
    console.log('[Alpaca WS] Connected — authenticating');
    _wsReady = false;
    _ws.send(JSON.stringify({ action: 'auth', key: config.apiKey, secret: config.secretKey }));
  });

  _ws.on('message', (raw) => {
    let msgs;
    try { msgs = JSON.parse(raw.toString()); } catch { return; }
    if (!Array.isArray(msgs)) msgs = [msgs];

    for (const m of msgs) {
      // Auth / subscription ack
      if (m.T === 'success' && m.msg === 'authenticated') {
        console.log('[Alpaca WS] Authenticated ✓');
        _wsReady = true;
        _resubscribeAll();
        continue;
      }
      if (m.T === 'subscription') {
        console.log('[Alpaca WS] Subscribed:', JSON.stringify(m));
        continue;
      }
      if (m.T === 'error') {
        console.warn('[Alpaca WS] Error msg:', m.msg, m.code);
        continue;
      }

      // Trade update → T:"t"
      if (m.T === 't' && m.S) {
        const sym = m.S;
        const prevTick = _lastTick.get(sym) || {};
        const tick = {
          symbol:   sym,
          price:    m.p,
          size:     m.s,
          bid:      prevTick.bid   || 0,
          ask:      prevTick.ask   || 0,
          bidSize:  prevTick.bidSize || 0,
          askSize:  prevTick.askSize || 0,
          volume:   prevTick.volume || 0,
          high:     prevTick.high   || 0,
          low:      prevTick.low    || 0,
          open:     prevTick.open   || 0,
          prevClose:prevTick.prevClose || 0,
          ts:       m.t,
        };
        _lastTick.set(sym, tick);
        _emit(sym, tick);
        continue;
      }

      // Quote update → T:"q"
      if (m.T === 'q' && m.S) {
        const sym = m.S;
        const prev = _lastTick.get(sym) || {};
        const tick = {
          ...prev,
          symbol: sym,
          bid:    m.bp || prev.bid || 0,
          ask:    m.ap || prev.ask || 0,
          bidSize:m.bs || prev.bidSize || 0,
          askSize:m.as || prev.askSize || 0,
          ts:     m.t,
        };
        _lastTick.set(sym, tick);
        _emit(sym, tick);
        continue;
      }

      // Minute bar → T:"b"
      if (m.T === 'b' && m.S) {
        const sym = m.S;
        const prev = _lastTick.get(sym) || {};
        const tick = {
          ...prev,
          symbol:  sym,
          high:    m.h > (prev.high || 0)  ? m.h : (prev.high || 0),
          low:     m.l < (prev.low || 9e9) ? m.l : (prev.low || m.l),
          open:    prev.open || m.o,
          volume:  m.v,
          price:   m.c || prev.price || 0,
          ts:      m.t,
        };
        _lastTick.set(sym, tick);
        _emit(sym, tick);
        continue;
      }
    }
  });

  _ws.on('close', (code) => {
    console.warn('[Alpaca WS] Disconnected', code, '— retry in 5s');
    _wsReady = false;
    if (isConnected()) {
      _wsRetry = setTimeout(_restartWs, 5000);
    }
  });

  _ws.on('error', (err) => {
    console.error('[Alpaca WS] Error:', err.message);
    try { _ws.close(); } catch {}
  });
}

function _emit(symbol, tick) {
  const cbs = _listeners.get(symbol);
  if (cbs) cbs.forEach(cb => { try { cb(tick); } catch {} });
}

// ── Snapshot fallback for initial data (before WS ticks arrive) ──
async function _seedFromSnapshot(symbol) {
  try {
    const snap = await getSnapshot(symbol);
    const trade  = snap.latestTrade  || {};
    const quote  = snap.latestQuote  || {};
    const daily  = snap.dailyBar     || {};
    const prev   = snap.prevDailyBar || {};
    const tick = {
      symbol,
      price:    trade.p  || daily.c  || 0,
      bid:      quote.bp || 0,
      ask:      quote.ap || 0,
      bidSize:  quote.bs || 0,
      askSize:  quote.as || 0,
      volume:   daily.v  || 0,
      high:     daily.h  || 0,
      low:      daily.l  || 0,
      open:     daily.o  || 0,
      prevClose:prev.c   || 0,
    };
    _lastTick.set(symbol, tick);
    _emit(symbol, tick);
  } catch {}
}

// ── Public subscribe/unsubscribe ──
export function subscribeQuotes(symbol, callback) {
  if (!_listeners.has(symbol)) _listeners.set(symbol, new Set());
  _listeners.get(symbol).add(callback);

  // Send last known tick immediately if available
  const last = _lastTick.get(symbol);
  if (last) { try { callback(last); } catch {} }

  // Subscribe on WebSocket if not already
  if (!_subscribed.has(symbol)) {
    _subscribed.add(symbol);
    if (_wsReady) {
      _sendWs({ action: 'subscribe', trades: [symbol], quotes: [symbol] });
    }
    // Seed with snapshot for instant initial price
    _seedFromSnapshot(symbol);
  }

  return {
    id: symbol + '_' + Date.now(),
    unsubscribe: () => {
      const cbs = _listeners.get(symbol);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          _listeners.delete(symbol);
          _subscribed.delete(symbol);
          if (_wsReady) {
            _sendWs({ action: 'unsubscribe', trades: [symbol], quotes: [symbol] });
          }
        }
      }
    },
  };
}

export function unsubscribeAll() {
  _subscribed.clear();
  _listeners.clear();
  _lastTick.clear();
  if (_wsReady) {
    _sendWs({ action: 'unsubscribe', trades: ['*'], quotes: ['*'] });
  }
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
  '1min': { timeframe: '1Min' },
  '2min': { timeframe: '2Min' },
  '3min': { timeframe: '3Min' },
  '5min': { timeframe: '5Min' },
  '10min': { timeframe: '10Min' },
  '15min': { timeframe: '15Min' },
  '30min': { timeframe: '30Min' },
  '45min': { timeframe: '45Min' },
  '60min': { timeframe: '1Hour' },
  '2hour': { timeframe: '2Hour' },
  '3hour': { timeframe: '3Hour' },
  '4hour': { timeframe: '4Hour' },
  'daily': { timeframe: '1Day' },
  'weekly': { timeframe: '1Week' },
  'monthly': { timeframe: '1Month' },
};

// Convert range string (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max) to a start date
function rangeToStartDate(range) {
  const now = new Date();
  switch (range) {
    case '1d': now.setDate(now.getDate() - 1); break;
    case '5d': now.setDate(now.getDate() - 5); break;
    case '1mo': now.setMonth(now.getMonth() - 1); break;
    case '3mo': now.setMonth(now.getMonth() - 3); break;
    case '6mo': now.setMonth(now.getMonth() - 6); break;
    case '1y': now.setFullYear(now.getFullYear() - 1); break;
    case '2y': now.setFullYear(now.getFullYear() - 2); break;
    case '5y': now.setFullYear(now.getFullYear() - 5); break;
    case '10y': now.setFullYear(now.getFullYear() - 10); break;
    case 'ytd': now.setMonth(0); now.setDate(1); break;
    case 'max': now.setFullYear(now.getFullYear() - 20); break;
    default: return null;
  }
  return now.toISOString();
}

// Default range per interval if none specified
const DEFAULT_RANGE = {
  '1min': '1d', '2min': '1d', '3min': '5d', '5min': '5d',
  '10min': '1mo', '15min': '1mo', '30min': '1mo', '45min': '3mo',
  '60min': '3mo', '2hour': '6mo', '3hour': '6mo', '4hour': '1y',
  'daily': '5y', 'weekly': 'max', 'monthly': 'max',
};

export async function getBars(symbol, interval = 'daily', range = '') {
  const tf = TF_MAP[interval] || TF_MAP.daily;
  const effectiveRange = range || DEFAULT_RANGE[interval] || '5y';
  const start = rangeToStartDate(effectiveRange);
  const params = new URLSearchParams({
    timeframe: tf.timeframe,
    limit: '10000',
    adjustment: 'split',
    feed: 'iex',
  });
  if (start) params.set('start', start);

  // Alpaca paginates via next_page_token – collect all pages
  let allBars = [];
  let url = `${DATA_URL}/v2/stocks/${encodeURIComponent(symbol)}/bars?${params}`;
  while (url) {
    const data = await alpacaFetch(url);
    const bars = data.bars || [];
    allBars = allBars.concat(bars);
    if (data.next_page_token) {
      const p = new URLSearchParams(params);
      p.set('page_token', data.next_page_token);
      url = `${DATA_URL}/v2/stocks/${encodeURIComponent(symbol)}/bars?${p}`;
    } else {
      url = null;
    }
  }
  return allBars.map(bar => ({
    time: bar.t,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }));
}

// ── Asset Search ──
export async function listAssets({ query = '', page = 1, limit = 200 } = {}) {
  const assets = await alpacaFetch(`${getBaseUrl()}/v2/assets?status=active`);
  const q = String(query || '').trim().toUpperCase();
  const filtered = assets.filter((a) => {
    if (!a.tradable) return false;
    if (!q) return true;
    return a.symbol.includes(q) || String(a.name || '').toUpperCase().includes(q);
  });

  const safeLimit = Math.max(1, Math.min(5000, Number(limit || 200)));
  const safePage = Math.max(1, Number(page || 1));
  const start = (safePage - 1) * safeLimit;
  const rows = filtered.slice(start, start + safeLimit).map((a) => ({
    symbol: a.symbol,
    name: a.name,
    exchange: a.exchange,
    class: a.class,
  }));

  return {
    page: safePage,
    limit: safeLimit,
    total: filtered.length,
    hasMore: start + safeLimit < filtered.length,
    assets: rows,
  };
}

export async function searchAssets(query, limit = 500) {
  const data = await listAssets({ query, page: 1, limit });
  return data.assets;
}

// ── Batch snapshots for large universes ──
export async function getSnapshots(symbols = []) {
  const clean = [...new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))];
  if (clean.length === 0) return {};

  const chunks = [];
  for (let i = 0; i < clean.length; i += 200) chunks.push(clean.slice(i, i + 200));

  const out = {};
  for (const chunk of chunks) {
    const params = new URLSearchParams({ symbols: chunk.join(',') }).toString();
    const data = await alpacaFetch(`${DATA_URL}/v2/stocks/snapshots?${params}`);
    Object.assign(out, data?.snapshots || {});
  }
  return out;
}
