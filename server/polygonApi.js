// ═══════════════════════════════════════════════════════════════
// POLYGON.IO API Module - REST API + WebSocket Real-Time Streaming
// Supports: Stocks, Options, Indices, Forex, Crypto
// Real sub-minute (seconds) candles + tick-by-tick streaming
// ═══════════════════════════════════════════════════════════════
import WebSocket from 'ws';

let config = { apiKey: '' };

const REST_URL = 'https://api.polygon.io';
const WS_URL   = 'wss://socket.polygon.io/stocks';

// ── Helpers ──

function polygonFetch(url) {
  const sep = url.includes('?') ? '&' : '?';
  return fetch(`${url}${sep}apiKey=${encodeURIComponent(config.apiKey)}`)
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Polygon API ${res.status}: ${text}`);
      }
      return res.json();
    });
}

// ── Connection ──

export function connect(apiKey) {
  config.apiKey = apiKey;
  _restartWs();
}

export function disconnect() {
  _closeWs();
  config.apiKey = '';
}

export function isConnected() { return !!config.apiKey; }

export function getStatus() {
  return { connected: isConnected() };
}

// ═══════════════════════════════════════════════════════════════
// Real-Time WebSocket Stream (Polygon Stocks WS)
// Single shared WS → fan-out to SSE subscribers
// ═══════════════════════════════════════════════════════════════

let _ws        = null;
let _wsReady   = false;
let _wsRetry   = null;
let _subscribed = new Set();
const _listeners = new Map();
const _lastTick  = new Map();

function _sendWs(msg) {
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify(msg));
  }
}

function _resubscribeAll() {
  const syms = [..._subscribed];
  if (syms.length) {
    // T.* = trades, Q.* = quotes, A.* = second aggregates
    const params = syms.flatMap(s => [`T.${s}`, `Q.${s}`, `A.${s}`]).join(',');
    _sendWs({ action: 'subscribe', params });
  }
}

function _closeWs() {
  if (_wsRetry) { clearTimeout(_wsRetry); _wsRetry = null; }
  if (_ws) {
    try { _ws.close(); } catch {}
    _ws = null;
    _wsReady = false;
  }
}

function _restartWs() {
  _closeWs();
  if (!isConnected()) return;

  console.log('[Polygon WS] Connecting...');
  _ws = new WebSocket(WS_URL);

  _ws.on('open', () => {
    console.log('[Polygon WS] Connected — authenticating');
    _ws.send(JSON.stringify({ action: 'auth', params: config.apiKey }));
  });

  _ws.on('message', (raw) => {
    let msgs;
    try { msgs = JSON.parse(raw.toString()); } catch { return; }
    if (!Array.isArray(msgs)) msgs = [msgs];

    for (const m of msgs) {
      // Auth success
      if (m.ev === 'status' && m.status === 'auth_success') {
        console.log('[Polygon WS] Authenticated ✓');
        _wsReady = true;
        _resubscribeAll();
        continue;
      }
      if (m.ev === 'status') continue;

      // Trade: ev = "T"
      if (m.ev === 'T' && m.sym) {
        const sym = m.sym;
        const prev = _lastTick.get(sym) || {};
        const tick = {
          ...prev,
          symbol: sym,
          price:  m.p,
          size:   m.s,
          volume: (prev.volume || 0) + (m.s || 0),
          ts:     m.t,
        };
        _lastTick.set(sym, tick);
        _emit(sym, tick);
        continue;
      }

      // Quote: ev = "Q"
      if (m.ev === 'Q' && m.sym) {
        const sym = m.sym;
        const prev = _lastTick.get(sym) || {};
        const tick = {
          ...prev,
          symbol:  sym,
          bid:     m.bp || prev.bid || 0,
          ask:     m.ap || prev.ask || 0,
          bidSize: m.bs || prev.bidSize || 0,
          askSize: m.as || prev.askSize || 0,
          ts:      m.t,
        };
        _lastTick.set(sym, tick);
        _emit(sym, tick);
        continue;
      }

      // Second Aggregate: ev = "A"
      if (m.ev === 'A' && m.sym) {
        const sym = m.sym;
        const prev = _lastTick.get(sym) || {};
        const tick = {
          ...prev,
          symbol: sym,
          price:  m.c || prev.price || 0,
          open:   prev.open || m.o,
          high:   Math.max(m.h || 0, prev.high || 0),
          low:    Math.min(m.l || (prev.low || 9e9), prev.low || (m.l || 9e9)),
          volume: m.v || prev.volume || 0,
          ts:     m.e,
        };
        _lastTick.set(sym, tick);
        _emit(sym, tick);
        continue;
      }
    }
  });

  _ws.on('close', (code) => {
    console.warn('[Polygon WS] Disconnected', code, '— retry in 5s');
    _wsReady = false;
    if (isConnected()) {
      _wsRetry = setTimeout(_restartWs, 5000);
    }
  });

  _ws.on('error', (err) => {
    console.error('[Polygon WS] Error:', err.message);
    try { _ws.close(); } catch {}
  });
}

function _emit(symbol, tick) {
  const cbs = _listeners.get(symbol);
  if (cbs) cbs.forEach(cb => { try { cb(tick); } catch {} });
}

// Seed from REST snapshot
async function _seedFromSnapshot(symbol) {
  try {
    const snap = await getSnapshot(symbol);
    if (!snap) return;
    const tick = {
      symbol,
      price:    snap.ticker?.lastTrade?.p || snap.ticker?.day?.c || 0,
      bid:      snap.ticker?.lastQuote?.P || 0,
      ask:      snap.ticker?.lastQuote?.p || 0,
      bidSize:  snap.ticker?.lastQuote?.S || 0,
      askSize:  snap.ticker?.lastQuote?.s || 0,
      volume:   snap.ticker?.day?.v || 0,
      high:     snap.ticker?.day?.h || 0,
      low:      snap.ticker?.day?.l || 0,
      open:     snap.ticker?.day?.o || 0,
      prevClose:snap.ticker?.prevDay?.c || 0,
    };
    _lastTick.set(symbol, tick);
    _emit(symbol, tick);
  } catch {}
}

// Public subscribe
export function subscribeQuotes(symbol, callback) {
  if (!_listeners.has(symbol)) _listeners.set(symbol, new Set());
  _listeners.get(symbol).add(callback);

  const last = _lastTick.get(symbol);
  if (last) { try { callback(last); } catch {} }

  if (!_subscribed.has(symbol)) {
    _subscribed.add(symbol);
    if (_wsReady) {
      _sendWs({ action: 'subscribe', params: `T.${symbol},Q.${symbol},A.${symbol}` });
    }
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
            _sendWs({ action: 'unsubscribe', params: `T.${symbol},Q.${symbol},A.${symbol}` });
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
}

// ═══════════════════════════════════════════════════════════════
// REST API — Market Data
// ═══════════════════════════════════════════════════════════════

// ── Snapshot ──
export async function getSnapshot(symbol) {
  return polygonFetch(`${REST_URL}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}`);
}

// ── Batch Snapshots ──
export async function getSnapshots(symbols = []) {
  const clean = [...new Set(symbols.map(s => String(s).trim().toUpperCase()).filter(Boolean))];
  if (clean.length === 0) return {};
  const data = await polygonFetch(`${REST_URL}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${clean.join(',')}`);
  const out = {};
  for (const t of (data?.tickers || [])) {
    out[t.ticker] = t;
  }
  return out;
}

// ── Previous Day ──
export async function getPrevDay(symbol) {
  return polygonFetch(`${REST_URL}/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev`);
}

// ── Historical Bars (Aggregates) ──
// Polygon supports: second, minute, hour, day, week, month, quarter, year
const TF_MAP = {
  '1sec':    { multiplier: 1,  span: 'second', agg: 0 },
  '5sec':    { multiplier: 5,  span: 'second', agg: 0 },
  '10sec':   { multiplier: 10, span: 'second', agg: 0 },
  '15sec':   { multiplier: 15, span: 'second', agg: 0 },
  '30sec':   { multiplier: 30, span: 'second', agg: 0 },
  '45sec':   { multiplier: 45, span: 'second', agg: 0 },
  '1min':    { multiplier: 1,  span: 'minute', agg: 0 },
  '2min':    { multiplier: 2,  span: 'minute', agg: 0 },
  '3min':    { multiplier: 3,  span: 'minute', agg: 0 },
  '5min':    { multiplier: 5,  span: 'minute', agg: 0 },
  '10min':   { multiplier: 10, span: 'minute', agg: 0 },
  '15min':   { multiplier: 15, span: 'minute', agg: 0 },
  '30min':   { multiplier: 30, span: 'minute', agg: 0 },
  '45min':   { multiplier: 45, span: 'minute', agg: 0 },
  '60min':   { multiplier: 1,  span: 'hour',   agg: 0 },
  '2hour':   { multiplier: 2,  span: 'hour',   agg: 0 },
  '3hour':   { multiplier: 3,  span: 'hour',   agg: 0 },
  '4hour':   { multiplier: 4,  span: 'hour',   agg: 0 },
  'daily':   { multiplier: 1,  span: 'day',    agg: 0 },
  'weekly':  { multiplier: 1,  span: 'week',   agg: 0 },
  'monthly': { multiplier: 1,  span: 'month',  agg: 0 },
};

const DEFAULT_RANGE = {
  '1sec': '1d', '5sec': '1d', '10sec': '1d', '15sec': '1d', '30sec': '1d', '45sec': '1d',
  '1min': '1d', '2min': '1d', '3min': '5d', '5min': '5d',
  '10min': '1mo', '15min': '1mo', '30min': '1mo', '45min': '3mo',
  '60min': '3mo', '2hour': '6mo', '3hour': '6mo', '4hour': '1y',
  'daily': '5y', 'weekly': 'max', 'monthly': 'max',
};

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
    case 'max': now.setFullYear(now.getFullYear() - 50); break;
    default: return null;
  }
  return now;
}

export async function getBars(symbol, interval = 'daily', range = '') {
  const tf = TF_MAP[interval] || TF_MAP.daily;
  const effectiveRange = range || DEFAULT_RANGE[interval] || '5y';
  const startDate = rangeToStartDate(effectiveRange);
  const endDate = new Date();

  const from = startDate.toISOString().substring(0, 10);
  const to   = endDate.toISOString().substring(0, 10);

  // Polygon aggregates endpoint: /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
  let allResults = [];
  let url = `${REST_URL}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${tf.multiplier}/${tf.span}/${from}/${to}?adjusted=true&sort=asc&limit=50000`;

  while (url) {
    const data = await polygonFetch(url);
    const results = data?.results || [];
    allResults = allResults.concat(results);
    // Polygon uses next_url for pagination
    url = data?.next_url || null;
  }

  return allResults.map(bar => ({
    time: bar.t ? new Date(bar.t).toISOString() : null,
    open:   bar.o,
    high:   bar.h,
    low:    bar.l,
    close:  bar.c,
    volume: bar.v || 0,
    vwap:   bar.vw || 0,
    trades: bar.n || 0,
  })).filter(b => b.time);
}

// ── Options Chain ──
export async function getOptionsChain(symbol, expDate = '') {
  const params = new URLSearchParams({
    'underlying_ticker': symbol,
    limit: '250',
    order: 'asc',
    sort: 'strike_price',
  });
  if (expDate) params.set('expiration_date', expDate);
  return polygonFetch(`${REST_URL}/v3/snapshot/options/${encodeURIComponent(symbol)}?${params}`);
}

// ── Options Expirations ──
export async function getOptionsExpirations(symbol) {
  return polygonFetch(`${REST_URL}/v3/reference/options/contracts?underlying_ticker=${encodeURIComponent(symbol)}&limit=1000&order=asc&sort=expiration_date`);
}

// ── Ticker Search ──
export async function searchTickers(query, limit = 50) {
  const params = new URLSearchParams({
    search: query,
    active: 'true',
    limit: String(limit),
    market: 'stocks',
  });
  const data = await polygonFetch(`${REST_URL}/v3/reference/tickers?${params}`);
  return (data?.results || []).map(t => ({
    symbol:   t.ticker,
    name:     t.name,
    exchange: t.primary_exchange,
    type:     t.type,
    market:   t.market,
  }));
}

// ── Ticker Details ──
export async function getTickerDetails(symbol) {
  return polygonFetch(`${REST_URL}/v3/reference/tickers/${encodeURIComponent(symbol)}`);
}

// ── Market Status ──
export async function getMarketStatus() {
  return polygonFetch(`${REST_URL}/v1/marketstatus/now`);
}

// ── Movers (Top Gainers/Losers) ──
export async function getMovers(direction = 'gainers') {
  return polygonFetch(`${REST_URL}/v2/snapshot/locale/us/markets/stocks/${direction}`);
}
