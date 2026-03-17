import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { Server as SocketIO } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = process.env.DFA_DATA_DIR || path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'auth.json');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT || 8080);
const jwtSecret = process.env.JWT_SECRET || 'change-this-secret-in-production';
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const isProduction = process.env.NODE_ENV === 'production';
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || 'admin@dfapro.com');
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

await fs.mkdir(dataDir, { recursive: true });

const adapter = new JSONFile(dbPath);
const db = new Low(adapter, {
  users: [],
  verificationTokens: []
});

await db.read();
db.data ||= { users: [], verificationTokens: [] };
await db.write();

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// CORS – restrict origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : null; // null = allow all in dev
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isProduction && allowedOrigins) {
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  } else {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Rate Limiting (in-memory, per-IP) ──────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_AUTH = 10;      // auth endpoints
const RATE_LIMIT_MAX_API = 120;      // market data endpoints

const rateLimit = (category, maxReqs) => (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `${category}:${ip}`;
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    entry = { count: 0, start: now };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  if (entry.count > maxReqs) {
    return res.status(429).json({ error: 'طلبات كثيرة جداً، حاول لاحقاً' });
  }
  next();
};
// Evict stale rate-limit entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap) {
    if (now - v.start > RATE_LIMIT_WINDOW * 2) rateLimitMap.delete(k);
  }
}, 2 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════
// MARKET DATA PROXY (Yahoo Finance)
// ═══════════════════════════════════════════════════════════════
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YF_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';
const YF_QUOTE = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';
const YF_OPTIONS = 'https://query2.finance.yahoo.com/v7/finance/options';

const toYahooSymbol = (symbol, market) => {
  if (market === 'saudi') {
    if (['TASI', 'MI30', 'TFNI'].includes(symbol)) return `^TASI.SR`;
    return /^\d+$/.test(symbol) ? `${symbol}.SR` : symbol;
  }
  if (['SPX', 'SP500'].includes(symbol)) return '^GSPC';
  if (['NDX', 'NASDAQ'].includes(symbol)) return '^IXIC';
  if (['DJI', 'DJIA'].includes(symbol)) return '^DJI';
  return symbol;
};

// Maps requested interval → { yfInterval (what to fetch from Yahoo), aggregate (seconds per output bar, 0 = no aggregation) }
const intervalConfig = {
  '1sec':  { yf: '1m',  agg: 0 },  // no sub-minute in Yahoo, show 1m as-is
  '5sec':  { yf: '1m',  agg: 0 },
  '10sec': { yf: '1m',  agg: 0 },
  '15sec': { yf: '1m',  agg: 0 },
  '30sec': { yf: '1m',  agg: 0 },
  '45sec': { yf: '1m',  agg: 0 },
  '1min':  { yf: '1m',  agg: 0 },
  '2min':  { yf: '2m',  agg: 0 },
  '3min':  { yf: '1m',  agg: 180 },   // aggregate 1m bars into 3-min candles
  '5min':  { yf: '5m',  agg: 0 },
  '10min': { yf: '5m',  agg: 600 },   // aggregate 5m → 10m
  '15min': { yf: '15m', agg: 0 },
  '30min': { yf: '30m', agg: 0 },
  '45min': { yf: '15m', agg: 2700 },  // aggregate 15m → 45m
  '60min': { yf: '60m', agg: 0 },
  '2hour': { yf: '60m', agg: 7200 },  // aggregate 60m → 2h
  '3hour': { yf: '60m', agg: 10800 }, // aggregate 60m → 3h
  '4hour': { yf: '60m', agg: 14400 }, // aggregate 60m → 4h
  'daily':   { yf: '1d',  agg: 0 },
  'weekly':  { yf: '1wk', agg: 0 },
  'monthly': { yf: '1mo', agg: 0 },
};

// Aggregate fine candles into larger time-bucket candles
function aggregateCandles(candles, bucketSeconds) {
  if (!bucketSeconds || candles.length === 0) return candles;
  const buckets = new Map();
  for (const c of candles) {
    const t = typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time).getTime() / 1000);
    const key = Math.floor(t / bucketSeconds) * bucketSeconds;
    if (!buckets.has(key)) {
      buckets.set(key, { time: key, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 });
    } else {
      const b = buckets.get(key);
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close;
      b.volume += (c.volume || 0);
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

// Yahoo Finance free-tier limits: 1m→7d, intraday→60d, EOD→unlimited
const defaultRangeMap = {
  '1m': '5d', '2m': '5d', '5m': '1mo', '15m': '3mo', '30m': '6mo', '60m': '2y',
  '1d': '5y', '1wk': 'max', '1mo': 'max',
};
// Valid Yahoo Finance range values
const validRanges = new Set(['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','ytd','max']);

const yfFetch = async (url) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
  return res.json();
};

// ── In-memory cache ──────────────────────────────────────────
const cache = new Map();
const TTL = {
  quote:       15 * 1000,   // 15 seconds
  'batch-quotes': 15 * 1000,
  candles_intraday: 3 * 60 * 1000,   // 3 minutes
  candles_daily:   5 * 60 * 1000,    // 5 minutes
  indices:     60 * 1000,   // 60 seconds
  'top-movers': 2 * 60 * 1000,  // 2 minutes
  overview:    60 * 1000,
  news:        5 * 60 * 1000,
  forex:       60 * 1000,
  crypto:      30 * 1000,
  options_chain: 20 * 1000,
  market_pulse: 30 * 1000,
};

const cacheGet = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) { cache.delete(key); return null; }
  return entry.data;
};
const cacheSet = (key, data, ttlMs) => cache.set(key, { data, ts: Date.now(), ttl: ttlMs });
// Periodically evict stale entries to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) { if (now - v.ts > v.ttl) cache.delete(k); }
}, 5 * 60 * 1000);

// GET /api/market/quote?symbol=2222&market=saudi
app.get('/api/market/quote', async (req, res) => {
  try {
    const { symbol, market = 'saudi' } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    
    const cacheKey = `quote:${symbol}:${market}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const ySymbol = toYahooSymbol(symbol, market);
    const data = await yfFetch(`${YF_BASE}/${encodeURIComponent(ySymbol)}?interval=1d&range=2d`);
    const meta = data.chart?.result?.[0]?.meta;
    const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
    
    if (!meta) return res.json({ price: 0, change: 0, change_percent: 0, volume: 0 });
    
    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const change = +(price - prevClose).toFixed(2);
    const changePct = prevClose !== 0 ? +((change / prevClose) * 100).toFixed(2) : 0;
    
    const closePrices = quotes?.close?.filter(v => v != null) || [];
    const highPrices = quotes?.high?.filter(v => v != null) || [];
    const lowPrices = quotes?.low?.filter(v => v != null) || [];
    const volumes = quotes?.volume?.filter(v => v != null) || [];
    
    const result = {
      price,
      change,
      change_percent: changePct,
      volume: volumes.length > 0 ? volumes[volumes.length - 1] : 0,
      high: highPrices.length > 0 ? Math.max(...highPrices) : price,
      low: lowPrices.length > 0 ? Math.min(...lowPrices) : price,
      name: meta.shortName || meta.symbol || symbol,
      currency: meta.currency || (market === 'saudi' ? 'SAR' : 'USD'),
    };
    cacheSet(cacheKey, result, TTL.quote);
    res.json(result);
  } catch (err) {
    console.error('Quote error:', err.message);
    res.status(502).json({ error: 'Failed to fetch quote' });
  }
});

// GET /api/market/candles?symbol=2222&market=saudi&interval=daily[&range=5y]
app.get('/api/market/candles', async (req, res) => {
  try {
    const { symbol, market = 'saudi', interval = 'daily', range: reqRange } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const cfg = intervalConfig[interval] || { yf: '1d', agg: 0 };
    const yfInterval = cfg.yf;
    const range = (reqRange && validRanges.has(reqRange)) ? reqRange : (defaultRangeMap[yfInterval] || '5y');
    const cacheKey = `candles:${symbol}:${market}:${interval}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const ySymbol = toYahooSymbol(symbol, market);
    const data = await yfFetch(`${YF_BASE}/${encodeURIComponent(ySymbol)}?interval=${yfInterval}&range=${range}`);
    const result = data.chart?.result?.[0];
    
    if (!result?.timestamp) return res.json({ candles: [] });
    
    const timestamps = result.timestamp;
    const q = result.indicators.quote[0];
    const isIntraday = ['1m', '2m', '5m', '15m', '30m', '60m'].includes(yfInterval);
    
    let candles = timestamps.map((t, i) => {
      if (q.open[i] == null || q.close[i] == null) return null;
      return {
        time: isIntraday ? t : new Date(t * 1000).toISOString().substring(0, 10),
        open: +q.open[i].toFixed(2),
        high: +q.high[i].toFixed(2),
        low: +q.low[i].toFixed(2),
        close: +q.close[i].toFixed(2),
        volume: q.volume[i] || 0,
      };
    }).filter(Boolean);

    // Aggregate into larger buckets if needed
    if (cfg.agg > 0 && isIntraday) {
      candles = aggregateCandles(candles, cfg.agg);
    }

    const ttlMs = isIntraday ? TTL.candles_intraday : TTL.candles_daily;
    cacheSet(cacheKey, { candles }, ttlMs);
    res.json({ candles });
  } catch (err) {
    console.error('Candles error:', err.message);
    res.status(502).json({ error: 'Failed to fetch candles' });
  }
});

// GET /api/market/overview?symbol=2222&market=saudi
app.get('/api/market/overview', async (req, res) => {
  try {
    const { symbol, market = 'saudi' } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    
    const cacheKey = `overview:${symbol}:${market}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const ySymbol = toYahooSymbol(symbol, market);
    const data = await yfFetch(`${YF_BASE}/${encodeURIComponent(ySymbol)}?interval=1d&range=1y`);
    const meta = data.chart?.result?.[0]?.meta;
    const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
    
    if (!meta) return res.json({});
    
    const allHighs = quotes?.high?.filter(v => v != null) || [];
    const allLows = quotes?.low?.filter(v => v != null) || [];
    
    const result = {
      name: meta.shortName || symbol,
      exchange: meta.exchangeName || '',
      currency: meta.currency || '',
      high_52w: allHighs.length > 0 ? +Math.max(...allHighs).toFixed(2) : 0,
      low_52w: allLows.length > 0 ? +Math.min(...allLows).toFixed(2) : 0,
      market_cap: meta.marketCap || '',
    };
    cacheSet(cacheKey, result, TTL.overview);
    res.json(result);
  } catch (err) {
    console.error('Overview error:', err.message);
    res.status(502).json({ error: 'Failed to fetch overview' });
  }
});

// GET /api/market/search?q=aramco
app.get('/api/market/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json({ results: [] });
    
    const data = await yfFetch(`${YF_SEARCH}?q=${encodeURIComponent(q)}&newsCount=0&quotesCount=10`);
    const results = (data.quotes || []).map(item => ({
      symbol: item.symbol,
      name: item.shortname || item.longname || item.symbol,
      exchange: item.exchange,
      type: item.quoteType,
    }));
    
    res.json({ results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.json({ results: [] });
  }
});

// GET /api/market/indices
app.get('/api/market/indices', async (req, res) => {
  try {
    const cached = cacheGet('indices');
    if (cached) return res.json(cached);

    const symbols = ['^TASI.SR', '^GSPC', '^IXIC', '^DJI'];
    const names = ['تاسي', 'S&P 500', 'ناسداك', 'داو جونز'];
    const markets = ['saudi', 'us', 'us', 'us'];
    
    const results = await Promise.allSettled(
      symbols.map(s => yfFetch(`${YF_BASE}/${encodeURIComponent(s)}?interval=1d&range=2d`))
    );
    
    const indices = results.map((r, i) => {
      if (r.status !== 'fulfilled') {
        return {
          name: names[i],
          market: markets[i],
          value: 0,
          change: 0,
          change_percent: 0,
          market_state: 'UNKNOWN',
          is_open: false,
          source: 'Yahoo Finance',
        };
      }
      const meta = r.value.chart?.result?.[0]?.meta;
      if (!meta) {
        return {
          name: names[i],
          market: markets[i],
          value: 0,
          change: 0,
          change_percent: 0,
          market_state: 'UNKNOWN',
          is_open: false,
          source: 'Yahoo Finance',
        };
      }
      const price = meta.regularMarketPrice ?? 0;
      const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
      const changePercent = prev !== 0 ? +(((price - prev) / prev) * 100).toFixed(2) : 0;
      const marketState = String(meta.marketState || 'UNKNOWN').toUpperCase();
      const isOpen = ['REGULAR', 'PRE', 'POST'].includes(marketState);
      return {
        name: names[i],
        market: markets[i],
        value: +price.toFixed(2),
        change: changePercent,
        change_percent: changePercent,
        market_state: marketState,
        is_open: isOpen,
        source: 'Yahoo Finance',
      };
    });
    
    cacheSet('indices', { indices }, TTL.indices);
    res.json({ indices });
  } catch (err) {
    console.error('Indices error:', err.message);
    res.json({ indices: [] });
  }
});

// GET /api/market/forex?from=USD&to=SAR
app.get('/api/market/forex', async (req, res) => {
  try {
    const { from = 'USD', to = 'SAR' } = req.query;
    const cacheKey = `forex:${from}:${to}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const symbol = `${from}${to}=X`;
    const data = await yfFetch(`${YF_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=2d`);
    const meta = data.chart?.result?.[0]?.meta;
    const result = { rate: meta?.regularMarketPrice ?? 0, from, to };
    cacheSet(cacheKey, result, TTL.forex);
    res.json(result);
  } catch (err) {
    console.error('Forex error:', err.message);
    res.json({ rate: from === 'USD' && to === 'SAR' ? 3.75 : 1.0, from: req.query.from, to: req.query.to });
  }
});

// GET /api/market/crypto?coin=BTC&currency=USD
app.get('/api/market/crypto', async (req, res) => {
  try {
    const { coin = 'BTC', currency = 'USD' } = req.query;
    const cacheKey = `crypto:${coin}:${currency}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const symbol = `${coin}-${currency}`;
    const data = await yfFetch(`${YF_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=2d`);
    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice ?? 0;
    const prev = meta?.previousClose ?? meta?.chartPreviousClose ?? price;
    const change24h = prev !== 0 ? +(((price - prev) / prev) * 100).toFixed(2) : 0;
    const result = { price, change_24h: change24h, coin, currency };
    cacheSet(cacheKey, result, TTL.crypto);
    res.json(result);
  } catch (err) {
    console.error('Crypto error:', err.message);
    res.json({ price: 0, change_24h: 0, coin: req.query.coin, currency: req.query.currency });
  }
});

// GET /api/market/top-movers?market=saudi
app.get('/api/market/top-movers', async (req, res) => {
  try {
    const { market = 'saudi' } = req.query;
    const cacheKey = `top-movers:${market}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const symbols = market === 'saudi'
      ? ['2222.SR','1120.SR','2010.SR','7010.SR','1180.SR','2380.SR','1211.SR','1010.SR','4190.SR','2350.SR','2050.SR','1060.SR','7020.SR','7030.SR','2280.SR','4200.SR','3010.SR','8010.SR','2082.SR','4030.SR']
      : ['AAPL','MSFT','NVDA','TSLA','AMZN','META','GOOGL','AMD','NFLX','JPM','BAC','V','WMT','DIS','INTC','COIN','PLTR','SOFI','CRM','ORCL'];
    
    const results = await Promise.allSettled(
      symbols.map(s => yfFetch(`${YF_BASE}/${encodeURIComponent(s)}?interval=1d&range=2d`))
    );
    
    const stocks = results.map((r, i) => {
      if (r.status !== 'fulfilled') return null;
      const meta = r.value.chart?.result?.[0]?.meta;
      if (!meta) return null;
      const price = meta.regularMarketPrice ?? 0;
      const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
      const change = +(price - prev).toFixed(2);
      const changePct = prev !== 0 ? +((change / prev) * 100).toFixed(2) : 0;
      const rawSymbol = symbols[i].replace('.SR', '');
      return {
        symbol: rawSymbol,
        name: meta.shortName || rawSymbol,
        price: +price.toFixed(2),
        change: changePct,
        market,
      };
    }).filter(Boolean);
    
    const sorted = [...stocks].sort((a, b) => b.change - a.change);
    const result = {
      gainers: sorted.filter(s => s.change > 0).slice(0, 10),
      losers: sorted.filter(s => s.change < 0).sort((a, b) => a.change - b.change).slice(0, 10),
    };
    cacheSet(cacheKey, result, TTL['top-movers']);
    res.json(result);
  } catch (err) {
    console.error('Top movers error:', err.message);
    res.json({ gainers: [], losers: [] });
  }
});

// Backward compatibility for old client path
app.get('/api/market/top_movers', async (req, res) => {
  const market = req.query.market || 'saudi';
  return res.redirect(307, `/api/market/top-movers?market=${encodeURIComponent(market)}`);
});

// GET /api/market/news?symbol=2222&market=saudi
app.get('/api/market/news', async (req, res) => {
  try {
    const { symbol, market = 'saudi' } = req.query;
    const cacheKey = `news:${symbol}:${market}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const ySymbol = symbol ? toYahooSymbol(symbol, market) : (market === 'saudi' ? '^TASI.SR' : '^GSPC');
    
    const data = await yfFetch(`${YF_SEARCH}?q=${encodeURIComponent(ySymbol)}&newsCount=10&quotesCount=0`);
    const news = (data.news || []).map(item => ({
      title: item.title || '',
      source: item.publisher || '',
      date: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toISOString() : new Date().toISOString(),
      url: item.link || '#',
      thumbnail: item.thumbnail?.resolutions?.[0]?.url || '',
    }));
    
    cacheSet(cacheKey, { news }, TTL.news);
    res.json({ news });
  } catch (err) {
    console.error('News error:', err.message);
    res.json({ news: [] });
  }
});

// GET /api/market/options-chain?symbol=AAPL&type=call&offset=0[&expiry=unix]
app.get('/api/market/options-chain', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').trim().toUpperCase();
    const type = String(req.query.type || 'call').toLowerCase() === 'put' ? 'put' : 'call';
    const offset = Number(req.query.offset || 0);
    const expiry = req.query.expiry ? Number(req.query.expiry) : null;

    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const expiryKey = expiry ? String(expiry) : 'auto';
    const cacheKey = `options-chain:${symbol}:${type}:${offset}:${expiryKey}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const first = await yfFetch(`${YF_OPTIONS}/${encodeURIComponent(symbol)}`);
    const firstResult = first?.optionChain?.result?.[0];
    const expirations = firstResult?.expirationDates || [];
    if (!firstResult || expirations.length === 0) {
      return res.status(404).json({ error: 'No options data for symbol' });
    }

    let selectedExpiry = expiry && expirations.includes(expiry) ? expiry : expirations[0];
    if (!selectedExpiry) selectedExpiry = expirations[0];

    const chainData = await yfFetch(`${YF_OPTIONS}/${encodeURIComponent(symbol)}?date=${selectedExpiry}`);
    const result = chainData?.optionChain?.result?.[0];
    const quote = result?.quote;
    const optionsBlock = result?.options?.[0] || {};
    const optionRows = type === 'put' ? (optionsBlock.puts || []) : (optionsBlock.calls || []);
    if (!quote || optionRows.length === 0) {
      return res.status(404).json({ error: 'No options contracts returned' });
    }

    const underlying = Number(quote.regularMarketPrice || quote.postMarketPrice || 0);
    const sortedByDistance = [...optionRows].sort((a, b) => {
      const da = Math.abs(Number(a.strike || 0) - underlying);
      const db = Math.abs(Number(b.strike || 0) - underlying);
      return da - db;
    });

    const atmIndex = sortedByDistance.findIndex((c) => Number(c.strike || 0) > 0);
    let pickIndex = Math.max(0, atmIndex);
    if (offset === -1) pickIndex = Math.min(sortedByDistance.length - 1, atmIndex + (type === 'call' ? -1 : 1));
    if (offset === 1) pickIndex = Math.min(sortedByDistance.length - 1, atmIndex + (type === 'call' ? 1 : -1));
    if (offset === 2) pickIndex = Math.max(0, atmIndex);

    const contract = sortedByDistance[pickIndex] || sortedByDistance[0];

    const rawMark = contract.lastPrice ?? ((Number(contract.bid || 0) + Number(contract.ask || 0)) / 2);
    const mark = Number.isFinite(Number(rawMark)) ? Number(rawMark) : 0;
    const strike = Number(contract.strike || 0);
    const iv = Number(contract.impliedVolatility || 0) * 100;
    const breakEven = type === 'call' ? strike + mark : strike - mark;

    const dteMs = Number(selectedExpiry) * 1000 - Date.now();
    const dte = Math.max(1, Math.round(dteMs / (24 * 60 * 60 * 1000)));

    const sentimentScore = (() => {
      const oi = Number(contract.openInterest || 0);
      const vol = Number(contract.volume || 0);
      const liq = Math.min(1, (oi + vol) / 5000);
      const moneyness = Math.max(0, 1 - Math.abs(strike - underlying) / Math.max(underlying, 1));
      const ivPenalty = iv > 70 ? -0.2 : iv < 20 ? 0.15 : 0;
      const base = 0.45 + (liq * 0.3) + (moneyness * 0.2) + ivPenalty;
      return Math.max(0, Math.min(1, base));
    })();

    const recommendation = sentimentScore >= 0.75
      ? 'شراء قوي'
      : sentimentScore >= 0.6
        ? 'شراء'
        : sentimentScore >= 0.45
          ? 'محايد'
          : sentimentScore >= 0.3
            ? 'تجنب'
            : 'بيع';

    const scenarios = [
      { scenario: 'ارتفاع قوي', move: 0.06, probability: '25%' },
      { scenario: 'ارتفاع معتدل', move: 0.03, probability: '30%' },
      { scenario: 'ثبات', move: 0.0, probability: '20%' },
      { scenario: 'هبوط معتدل', move: -0.03, probability: '15%' },
      { scenario: 'هبوط قوي', move: -0.06, probability: '10%' },
    ].map((s) => {
      const future = underlying * (1 + s.move);
      const intrinsic = type === 'call' ? Math.max(0, future - strike) : Math.max(0, strike - future);
      const pnl = +(intrinsic - mark).toFixed(2);
      return {
        scenario: s.scenario,
        price_change: `${(s.move * 100).toFixed(0)}%`,
        pnl: pnl > 0 ? `+$${pnl}` : pnl < 0 ? `-$${Math.abs(pnl)}` : '$0.00',
        probability: s.probability,
      };
    });

    const payload = {
      symbol,
      selected_type: type,
      current_price: underlying,
      strike_price: strike,
      premium: mark,
      breakeven: +breakEven.toFixed(2),
      iv_percent: +iv.toFixed(2),
      dte,
      expiration: selectedExpiry,
      expiration_dates: expirations,
      open_interest: Number(contract.openInterest || 0),
      volume: Number(contract.volume || 0),
      bid: Number(contract.bid || 0),
      ask: Number(contract.ask || 0),
      in_the_money: Boolean(contract.inTheMoney),
      recommendation,
      recommendation_reason: `السيولة ${Number(contract.openInterest || 0) > 1000 ? 'مرتفعة' : 'متوسطة'} و IV عند ${iv.toFixed(1)}% مع DTE ${dte} يوم.`,
      greeks: {
        delta: type === 'call' ? Math.max(0.05, Math.min(0.95, 0.5 + (underlying - strike) / Math.max(underlying, 1))) : -Math.max(0.05, Math.min(0.95, 0.5 + (strike - underlying) / Math.max(underlying, 1))),
        gamma: +(Math.max(0.01, 0.18 - Math.abs(strike - underlying) / Math.max(underlying, 1)).toFixed(4)),
        theta: +(-Math.max(0.005, mark / Math.max(dte, 1) / 2).toFixed(4)),
        vega: +(Math.max(0.02, iv / 100 / 6).toFixed(4)),
        rho: +((type === 'call' ? 1 : -1) * Math.max(0.01, dte / 365 / 8)).toFixed(4),
      },
      profit_scenarios: scenarios,
      max_profit: type === 'call' ? 'غير محدود' : `$${(strike - mark).toFixed(2)}`,
      max_loss: `$${mark.toFixed(2)}`,
      strengths: [
        'بيانات مباشرة من سلسلة الخيارات الأمريكية.',
        `سيولة العقد: حجم ${Number(contract.volume || 0)} و OI ${Number(contract.openInterest || 0)}.`,
        `IV = ${iv.toFixed(1)}% مع تقييم توصية لحظي.`,
      ],
      risks: [
        'حساسية عالية لتغيرات التقلب الضمني (IV).',
        'تآكل زمني يومي (Theta) قبل تاريخ الانتهاء.',
        'مخاطر فجوات سعرية وقت الأخبار والافتتاح.',
      ],
      summary: `تم تحليل ${symbol} (${type.toUpperCase()}) على انتهاء ${new Date(selectedExpiry * 1000).toLocaleDateString('en-CA')}. السعر الحالي ${underlying.toFixed(2)} وسعر الإضراب ${strike.toFixed(2)} والقسط ${mark.toFixed(2)}.`,
    };

    cacheSet(cacheKey, payload, TTL.options_chain);
    return res.json(payload);
  } catch (err) {
    console.error('Options chain error:', err.message);
    return res.status(502).json({ error: 'Failed to fetch options chain' });
  }
});

// GET /api/market/market-pulse
app.get('/api/market/market-pulse', async (_req, res) => {
  try {
    const cached = cacheGet('market-pulse');
    if (cached) return res.json(cached);

    const trackers = [
      { key: 'tasi', name: 'تاسي', symbol: '^TASI.SR' },
      { key: 'spx', name: 'S&P 500', symbol: '^GSPC' },
      { key: 'ndx', name: 'Nasdaq 100', symbol: '^NDX' },
      { key: 'vix', name: 'VIX', symbol: '^VIX' },
      { key: 'rut', name: 'Russell 2000', symbol: '^RUT' },
    ];

    const results = await Promise.allSettled(
      trackers.map((t) => yfFetch(`${YF_BASE}/${encodeURIComponent(t.symbol)}?interval=1d&range=2d`))
    );

    const items = trackers.map((t, i) => {
      const r = results[i];
      if (r.status !== 'fulfilled') return { key: t.key, name: t.name, value: 0, change_percent: 0 };
      const meta = r.value.chart?.result?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice || 0);
      const prev = Number(meta?.previousClose || meta?.chartPreviousClose || price || 1);
      return {
        key: t.key,
        name: t.name,
        value: +price.toFixed(2),
        change_percent: +(((price - prev) / prev) * 100).toFixed(2),
      };
    });

    const advancers = items.filter((x) => x.change_percent > 0).length;
    const decliners = items.filter((x) => x.change_percent < 0).length;
    const marketRegime = advancers >= 3 ? 'Risk-On' : decliners >= 3 ? 'Risk-Off' : 'Neutral';

    const payload = {
      timestamp: Date.now(),
      regime: marketRegime,
      breadth: {
        advancers,
        decliners,
        ratio: decliners === 0 ? advancers : +(advancers / decliners).toFixed(2),
      },
      indicators: items,
    };

    cacheSet('market-pulse', payload, TTL.market_pulse);
    return res.json(payload);
  } catch (err) {
    console.error('Market pulse error:', err.message);
    return res.status(502).json({ error: 'Failed to fetch market pulse' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADVANCED ANALYTICS ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// GET /api/market/fear-greed — Composite Fear & Greed Index
app.get('/api/market/fear-greed', async (_req, res) => {
  try {
    const cached = cacheGet('fear-greed');
    if (cached) return res.json(cached);

    const symbols = ['^GSPC', '^VIX', '^TNX', 'GLD', 'HYG', 'TLT'];
    const results = await Promise.allSettled(
      symbols.map(s => yfFetch(`${YF_BASE}/${encodeURIComponent(s)}?interval=1d&range=3mo`))
    );

    const getData = (idx) => {
      if (results[idx]?.status !== 'fulfilled') return null;
      return results[idx].value.chart?.result?.[0];
    };

    const spx = getData(0);
    const vix = getData(1);
    const bonds = getData(2);
    const gold = getData(3);

    // 1. Market Momentum (S&P 500 vs 125-day MA) => 0-100
    let momentumScore = 50;
    if (spx?.indicators?.quote?.[0]?.close) {
      const closes = spx.indicators.quote[0].close.filter(v => v != null);
      const current = closes[closes.length - 1];
      const ma125 = closes.length >= 125
        ? closes.slice(-125).reduce((a, b) => a + b, 0) / 125
        : closes.reduce((a, b) => a + b, 0) / closes.length;
      momentumScore = Math.max(0, Math.min(100, 50 + ((current - ma125) / ma125) * 500));
    }

    // 2. VIX Level => inverted score (low VIX = greed)
    let vixScore = 50;
    if (vix?.meta?.regularMarketPrice) {
      const vixPrice = vix.meta.regularMarketPrice;
      // VIX 10=extreme greed(95), 20=neutral(50), 35=extreme fear(5)
      vixScore = Math.max(0, Math.min(100, 100 - ((vixPrice - 10) / 25) * 100));
    }

    // 3. Market Breadth (from advancers/decliners within S&P returns)
    let breadthScore = 50;
    if (spx?.indicators?.quote?.[0]?.close) {
      const closes = spx.indicators.quote[0].close.filter(v => v != null);
      const recent = closes.slice(-20);
      const upDays = recent.filter((c, i) => i > 0 && c > recent[i - 1]).length;
      breadthScore = Math.max(0, Math.min(100, (upDays / 19) * 100));
    }

    // 4. Safe Haven Demand (gold vs bonds ratio proxy)
    let safeHavenScore = 50;
    if (gold?.meta?.regularMarketPrice && bonds?.meta?.regularMarketPrice) {
      const goldChange = ((gold.meta.regularMarketPrice - (gold.meta.previousClose || gold.meta.regularMarketPrice)) / (gold.meta.previousClose || 1)) * 100;
      // High gold demand = fear
      safeHavenScore = Math.max(0, Math.min(100, 50 - goldChange * 15));
    }

    // 5. Put/Call Ratio approximation via volatility trend
    let pcScore = 50;
    if (vix?.indicators?.quote?.[0]?.close) {
      const vixCloses = vix.indicators.quote[0].close.filter(v => v != null);
      if (vixCloses.length >= 5) {
        const recent5 = vixCloses.slice(-5);
        const avg5 = recent5.reduce((a, b) => a + b, 0) / 5;
        const avg20 = vixCloses.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, vixCloses.length);
        pcScore = Math.max(0, Math.min(100, 50 - ((avg5 - avg20) / avg20) * 200));
      }
    }

    const composite = Math.round(
      momentumScore * 0.25 +
      vixScore * 0.25 +
      breadthScore * 0.20 +
      safeHavenScore * 0.15 +
      pcScore * 0.15
    );

    const getLabel = (score) => {
      if (score >= 80) return { label: 'طمع شديد', label_en: 'Extreme Greed', color: '#22c55e' };
      if (score >= 60) return { label: 'طمع', label_en: 'Greed', color: '#84cc16' };
      if (score >= 40) return { label: 'محايد', label_en: 'Neutral', color: '#eab308' };
      if (score >= 20) return { label: 'خوف', label_en: 'Fear', color: '#f97316' };
      return { label: 'خوف شديد', label_en: 'Extreme Fear', color: '#ef4444' };
    };

    const info = getLabel(composite);

    const payload = {
      score: composite,
      label: info.label,
      label_en: info.label_en,
      color: info.color,
      components: {
        market_momentum: { score: Math.round(momentumScore), label: 'زخم السوق' },
        volatility: { score: Math.round(vixScore), label: 'التقلب (VIX)' },
        market_breadth: { score: Math.round(breadthScore), label: 'اتساع السوق' },
        safe_haven: { score: Math.round(safeHavenScore), label: 'طلب الملاذات الآمنة' },
        put_call: { score: Math.round(pcScore), label: 'نسبة البيع/الشراء' },
      },
      timestamp: Date.now(),
    };

    cacheSet('fear-greed', payload, 60 * 1000);
    return res.json(payload);
  } catch (err) {
    console.error('Fear & Greed error:', err.message);
    return res.status(502).json({ error: 'Failed to compute fear & greed index' });
  }
});

// GET /api/market/sector-heatmap?market=us|saudi
app.get('/api/market/sector-heatmap', async (req, res) => {
  try {
    const { market = 'us' } = req.query;
    const cacheKey = `sector-heatmap:${market}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const sectors = market === 'saudi' ? {
      'البنوك': ['1120.SR', '1180.SR', '1010.SR', '1060.SR', '1050.SR'],
      'الطاقة': ['2222.SR', '2030.SR', '4030.SR'],
      'المواد الأساسية': ['2010.SR', '2350.SR', '2020.SR', '2050.SR'],
      'الاتصالات': ['7010.SR', '7020.SR', '7030.SR'],
      'التأمين': ['8010.SR', '8020.SR', '8030.SR'],
      'التجزئة': ['4190.SR', '4200.SR', '4003.SR'],
      'العقارات': ['4300.SR', '4320.SR', '4310.SR'],
      'الرعاية الصحية': ['4002.SR', '4004.SR', '4005.SR'],
    } : {
      'Technology': ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMD', 'CRM', 'ADBE'],
      'Financial': ['JPM', 'BAC', 'GS', 'V', 'MA', 'BRK-B', 'C'],
      'Healthcare': ['UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'LLY'],
      'Consumer': ['AMZN', 'TSLA', 'WMT', 'HD', 'NKE', 'MCD'],
      'Energy': ['XOM', 'CVX', 'COP', 'SLB', 'EOG'],
      'Communication': ['NFLX', 'DIS', 'CMCSA', 'T', 'VZ'],
      'Industrial': ['CAT', 'BA', 'HON', 'UPS', 'GE'],
      'Real Estate': ['AMT', 'PLD', 'CCI', 'SPG', 'O'],
    };

    const allSymbols = Object.values(sectors).flat();
    const results = await Promise.allSettled(
      allSymbols.map(s => yfFetch(`${YF_BASE}/${encodeURIComponent(s)}?interval=1d&range=5d`))
    );

    const symbolMap = {};
    results.forEach((r, i) => {
      const sym = allSymbols[i];
      if (r.status !== 'fulfilled') { symbolMap[sym] = null; return; }
      const meta = r.value.chart?.result?.[0]?.meta;
      const quotes = r.value.chart?.result?.[0]?.indicators?.quote?.[0];
      if (!meta) { symbolMap[sym] = null; return; }
      const price = meta.regularMarketPrice ?? 0;
      const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
      const changePct = prev !== 0 ? +((price - prev) / prev * 100).toFixed(2) : 0;
      const volumes = quotes?.volume?.filter(v => v != null) || [];
      symbolMap[sym] = {
        price: +price.toFixed(2),
        change: changePct,
        volume: volumes.length > 0 ? volumes[volumes.length - 1] : 0,
        name: meta.shortName || sym.replace('.SR', ''),
      };
    });

    const sectorData = Object.entries(sectors).map(([sectorName, syms]) => {
      const stocks = syms.map(s => {
        const rawSym = s.replace('.SR', '');
        return symbolMap[s] ? { symbol: rawSym, ...symbolMap[s] } : null;
      }).filter(Boolean);

      const avgChange = stocks.length > 0
        ? +(stocks.reduce((sum, s) => sum + s.change, 0) / stocks.length).toFixed(2)
        : 0;
      const totalVolume = stocks.reduce((sum, s) => sum + (s.volume || 0), 0);

      return {
        sector: sectorName,
        change: avgChange,
        volume: totalVolume,
        stocks,
        stock_count: stocks.length,
      };
    }).sort((a, b) => b.change - a.change);

    const payload = {
      market,
      sectors: sectorData,
      timestamp: Date.now(),
    };
    cacheSet(cacheKey, payload, 2 * 60 * 1000);
    return res.json(payload);
  } catch (err) {
    console.error('Sector heatmap error:', err.message);
    return res.status(502).json({ error: 'Failed to fetch sector heatmap' });
  }
});

// GET /api/market/correlation?symbols=AAPL,MSFT,NVDA,GOOGL&market=us
app.get('/api/market/correlation', async (req, res) => {
  try {
    const { symbols: symbolsStr, market = 'us' } = req.query;
    if (!symbolsStr) return res.status(400).json({ error: 'symbols required' });

    const symbolList = symbolsStr.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
    if (symbolList.length < 2) return res.status(400).json({ error: 'at least 2 symbols required' });

    const cacheKey = `correlation:${symbolList.join(',')}:${market}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const results = await Promise.allSettled(
      symbolList.map(s => {
        const ySymbol = toYahooSymbol(s, market);
        return yfFetch(`${YF_BASE}/${encodeURIComponent(ySymbol)}?interval=1d&range=6mo`);
      })
    );

    // Extract daily returns for each symbol
    const priceArrays = {};
    results.forEach((r, i) => {
      const sym = symbolList[i];
      if (r.status !== 'fulfilled') return;
      const closes = r.value.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      if (!closes) return;
      const clean = closes.filter(v => v != null);
      // Compute daily returns
      const returns = [];
      for (let j = 1; j < clean.length; j++) {
        returns.push((clean[j] - clean[j - 1]) / clean[j - 1]);
      }
      priceArrays[sym] = returns;
    });

    // Pearson correlation between two return arrays
    const pearson = (x, y) => {
      const n = Math.min(x.length, y.length);
      if (n < 10) return 0;
      const xa = x.slice(-n), ya = y.slice(-n);
      const meanX = xa.reduce((a, b) => a + b, 0) / n;
      const meanY = ya.reduce((a, b) => a + b, 0) / n;
      let num = 0, denX = 0, denY = 0;
      for (let i = 0; i < n; i++) {
        const dx = xa[i] - meanX;
        const dy = ya[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      const den = Math.sqrt(denX * denY);
      return den === 0 ? 0 : +(num / den).toFixed(4);
    };

    const matrix = {};
    const availableSymbols = symbolList.filter(s => priceArrays[s]);

    for (const s1 of availableSymbols) {
      matrix[s1] = {};
      for (const s2 of availableSymbols) {
        matrix[s1][s2] = s1 === s2 ? 1 : pearson(priceArrays[s1], priceArrays[s2]);
      }
    }

    // Find strongly correlated / inversely correlated pairs
    const insights = [];
    for (let i = 0; i < availableSymbols.length; i++) {
      for (let j = i + 1; j < availableSymbols.length; j++) {
        const corr = matrix[availableSymbols[i]][availableSymbols[j]];
        if (corr > 0.8) insights.push({ pair: `${availableSymbols[i]}/${availableSymbols[j]}`, correlation: corr, type: 'ارتباط قوي', type_en: 'Strong Positive' });
        else if (corr < -0.3) insights.push({ pair: `${availableSymbols[i]}/${availableSymbols[j]}`, correlation: corr, type: 'ارتباط عكسي', type_en: 'Negative' });
      }
    }

    const payload = {
      symbols: availableSymbols,
      matrix,
      insights,
      period: '6 أشهر',
      timestamp: Date.now(),
    };

    cacheSet(cacheKey, payload, 5 * 60 * 1000);
    return res.json(payload);
  } catch (err) {
    console.error('Correlation error:', err.message);
    return res.status(502).json({ error: 'Failed to compute correlation matrix' });
  }
});

// GET /api/market/smart-screener?market=us|saudi&strategy=momentum|value|breakout|oversold
app.get('/api/market/smart-screener', async (req, res) => {
  try {
    const { market = 'saudi', strategy = 'momentum' } = req.query;
    const cacheKey = `smart-screener:${market}:${strategy}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const symbols = market === 'saudi'
      ? ['2222.SR','1120.SR','2010.SR','7010.SR','1180.SR','2380.SR','1211.SR','1010.SR','4190.SR','2350.SR','2050.SR','1060.SR','7020.SR','7030.SR','2280.SR','4200.SR','3010.SR','8010.SR','2082.SR','4030.SR','2020.SR','1050.SR','2030.SR','4003.SR','4002.SR']
      : ['AAPL','MSFT','NVDA','TSLA','AMZN','META','GOOGL','AMD','NFLX','JPM','BAC','V','WMT','DIS','INTC','COIN','PLTR','SOFI','CRM','ORCL','UNH','JNJ','PFE','XOM','CVX'];

    const results = await Promise.allSettled(
      symbols.map(s => yfFetch(`${YF_BASE}/${encodeURIComponent(s)}?interval=1d&range=3mo`))
    );

    const analyzed = [];
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      const result = r.value.chart?.result?.[0];
      if (!result?.indicators?.quote?.[0]?.close) return;

      const meta = result.meta;
      const closes = result.indicators.quote[0].close.filter(v => v != null);
      const volumes = result.indicators.quote[0].volume?.filter(v => v != null) || [];
      const highs = result.indicators.quote[0].high?.filter(v => v != null) || [];
      const lows = result.indicators.quote[0].low?.filter(v => v != null) || [];
      if (closes.length < 20) return;

      const price = closes[closes.length - 1];
      const prev = meta.previousClose ?? closes[closes.length - 2] ?? price;
      const changePct = prev !== 0 ? +((price - prev) / prev * 100).toFixed(2) : 0;

      // RSI calculation
      const gains = [], losses = [];
      for (let j = 1; j < closes.length; j++) {
        const diff = closes[j] - closes[j - 1];
        gains.push(Math.max(0, diff));
        losses.push(Math.max(0, -diff));
      }
      const period = 14;
      const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = +(100 - 100 / (1 + rs)).toFixed(2);

      // Moving averages
      const sma20 = +(closes.slice(-20).reduce((a, b) => a + b, 0) / 20).toFixed(2);
      const sma50 = closes.length >= 50
        ? +(closes.slice(-50).reduce((a, b) => a + b, 0) / 50).toFixed(2)
        : sma20;

      // Volume trend
      const avgVol = volumes.length >= 20
        ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
        : (volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0);
      const currentVol = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
      const volRatio = avgVol > 0 ? +(currentVol / avgVol).toFixed(2) : 1;

      // 52-week high/low distance
      const high52 = Math.max(...highs);
      const low52 = Math.min(...lows);
      const distFromHigh = high52 > 0 ? +((price - high52) / high52 * 100).toFixed(2) : 0;
      const distFromLow = low52 > 0 ? +((price - low52) / low52 * 100).toFixed(2) : 0;

      const rawSymbol = symbols[i].replace('.SR', '');

      // Strategy-specific scoring
      let score = 0;
      let signals = [];
      if (strategy === 'momentum') {
        if (rsi > 50 && rsi < 70) score += 30;
        if (price > sma20) score += 25;
        if (price > sma50) score += 20;
        if (volRatio > 1.2) score += 15;
        if (changePct > 0) score += 10;
        if (price > sma20) signals.push('فوق المتوسط 20');
        if (rsi > 50) signals.push(`RSI ${rsi}`);
        if (volRatio > 1.5) signals.push('حجم مرتفع');
      } else if (strategy === 'value') {
        if (distFromHigh < -20) score += 35;
        if (rsi < 40) score += 25;
        if (distFromLow < 15) score += 20;
        if (price < sma50) score += 20;
        if (rsi < 35) signals.push(`RSI منخفض ${rsi}`);
        if (distFromHigh < -25) signals.push('بعيد عن القمة');
      } else if (strategy === 'breakout') {
        if (distFromHigh > -3) score += 40;
        if (volRatio > 1.5) score += 25;
        if (rsi > 55 && rsi < 75) score += 20;
        if (changePct > 1) score += 15;
        if (distFromHigh > -2) signals.push('قرب القمة');
        if (volRatio > 2) signals.push('حجم اختراق');
      } else if (strategy === 'oversold') {
        if (rsi < 30) score += 40;
        else if (rsi < 40) score += 20;
        if (distFromHigh < -30) score += 25;
        if (price < sma50 * 0.95) score += 20;
        if (volRatio > 1.3) score += 15;
        if (rsi < 30) signals.push('تشبع بيعي');
        if (distFromHigh < -30) signals.push('هبوط كبير');
      }

      analyzed.push({
        symbol: rawSymbol,
        name: meta.shortName || rawSymbol,
        price: +price.toFixed(2),
        change: changePct,
        rsi,
        sma20,
        sma50,
        volume_ratio: volRatio,
        dist_from_high: distFromHigh,
        dist_from_low: distFromLow,
        score,
        signals,
        market,
      });
    });

    analyzed.sort((a, b) => b.score - a.score);

    const strategyLabels = {
      momentum: 'الزخم',
      value: 'القيمة',
      breakout: 'الاختراق',
      oversold: 'التشبع البيعي',
    };

    const payload = {
      strategy,
      strategy_label: strategyLabels[strategy] || strategy,
      market,
      results: analyzed.slice(0, 15),
      scanned: analyzed.length,
      timestamp: Date.now(),
    };

    cacheSet(cacheKey, payload, 3 * 60 * 1000);
    return res.json(payload);
  } catch (err) {
    console.error('Smart screener error:', err.message);
    return res.status(502).json({ error: 'Failed to run smart screener' });
  }
});

// GET /api/market/batch-quotes?symbols=AAPL,MSFT,NVDA&market=us
app.get('/api/market/batch-quotes', async (req, res) => {
  try {
    const { symbols: symbolsStr, market = 'saudi' } = req.query;
    if (!symbolsStr) return res.json({ quotes: {} });
    
    const symbolList = symbolsStr.split(',').map(s => s.trim()).slice(0, 30);

    const quotes = {};
    const toFetch = [];

    // Serve cached individual quotes first, only fetch uncached symbols
    for (const sym of symbolList) {
      const hit = cacheGet(`quote:${sym}:${market}`);
      if (hit) { quotes[sym] = hit; }
      else { toFetch.push(sym); }
    }

    if (toFetch.length > 0) {
      const results = await Promise.allSettled(
        toFetch.map(s => {
          const ySymbol = toYahooSymbol(s, market);
          return yfFetch(`${YF_BASE}/${encodeURIComponent(ySymbol)}?interval=1d&range=2d`);
        })
      );
      results.forEach((r, i) => {
        const sym = toFetch[i];
        if (r.status !== 'fulfilled') { quotes[sym] = null; return; }
        const meta = r.value.chart?.result?.[0]?.meta;
        const q = r.value.chart?.result?.[0]?.indicators?.quote?.[0];
        if (!meta) { quotes[sym] = null; return; }
        const price = meta.regularMarketPrice ?? 0;
        const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
        const change = +(price - prev).toFixed(2);
        const changePct = prev !== 0 ? +((change / prev) * 100).toFixed(2) : 0;
        const volumes = q?.volume?.filter(v => v != null) || [];
        const highs = q?.high?.filter(v => v != null) || [];
        const lows = q?.low?.filter(v => v != null) || [];
        const quoteData = {
          price: +price.toFixed(2),
          change,
          change_percent: changePct,
          volume: volumes.length > 0 ? volumes[volumes.length - 1] : 0,
          high: highs.length > 0 ? Math.max(...highs) : price,
          low: lows.length > 0 ? Math.min(...lows) : price,
          open: prev,
          name: meta.shortName || sym,
          currency: meta.currency || (market === 'saudi' ? 'SAR' : 'USD'),
        };
        quotes[sym] = quoteData;
        cacheSet(`quote:${sym}:${market}`, quoteData, TTL.quote);
      });
    }
  
    res.json({ quotes });
  } catch (err) {
    console.error('Batch quotes error:', err.message);
    res.json({ quotes: {} });
  }
});

// ═══════════════════════════════════════════════════════════════

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role || 'user',
  email_verified: Boolean(user.email_verified),
  dashboard_layout: user.dashboard_layout ?? null,
  dashboard_market: user.dashboard_market ?? 'saudi',
  alpaca_api_key: user.alpaca_api_key ?? '',
  alpaca_secret_key: user.alpaca_secret_key ?? '',
  alpaca_base_url: user.alpaca_base_url ?? '',
  market_data_provider: user.market_data_provider ?? 'yahoo',
  polygon_api_key: user.polygon_api_key ?? '',
  tradier_api_key: user.tradier_api_key ?? '',
  tadawul_api_key: user.tadawul_api_key ?? ''
});

const ensureAdminUser = async () => {
  const existingAdmin = db.data.users.find((user) => user.email === adminEmail);
  if (existingAdmin) {
    existingAdmin.role = 'admin';
    existingAdmin.email_verified = true;
    await db.write();
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  db.data.users.push({
    id: nanoid(),
    name: 'Admin',
    email: adminEmail,
    passwordHash,
    role: 'admin',
    email_verified: true,
    dashboard_layout: null,
    dashboard_market: 'saudi',
    created_at: new Date().toISOString(),
    alpaca_api_key: '',
    alpaca_secret_key: '',
    alpaca_base_url: '',
    market_data_provider: 'yahoo',
    polygon_api_key: '',
    tradier_api_key: '',
    tadawul_api_key: ''
  });
  await db.write();
};

await ensureAdminUser();

const createSessionToken = (userId) => jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '30d' });

const setSessionCookie = (res, token) => {
  res.cookie('dfa_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: '/'
  });
};

const clearSessionCookie = (res) => {
  res.clearCookie('dfa_session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/'
  });
};

const getSessionUser = async (req) => {
  const token = req.cookies?.dfa_session;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret);
    return db.data.users.find((user) => user.id === payload.sub) || null;
  } catch {
    return null;
  }
};

const authRequired = async (req, res, next) => {
  const user = await getSessionUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  req.user = user;
  next();
};

const createVerificationRecord = async (userId) => {
  const token = nanoid(40);
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24;
  db.data.verificationTokens = db.data.verificationTokens.filter((item) => item.userId !== userId);
  db.data.verificationTokens.push({ token, userId, expiresAt, createdAt: new Date().toISOString() });
  await db.write();
  return token;
};

const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`Verification link for ${user.email}: ${verifyUrl}`);
    return { previewUrl: verifyUrl, sent: false };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Verify your email address',
    html: `<div style="font-family: Arial, sans-serif; direction: ltr; line-height:1.6"><h2>Verify your email</h2><p>Hello ${user.name},</p><p>Click the link below to activate your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p></div>`
  });

  return { previewUrl: null, sent: true };
};

// ═══════════════════════════════════════════════════════════════
// INTERACTIVE BROKERS - TWS API (via @stoqey/ib)
// ═══════════════════════════════════════════════════════════════
// Connects to IB Gateway via TWS protocol on port 4001 (live) or 4002 (paper).

import * as ibkrTws from './ibkrTws.js';

// Streaming subscriptions for SSE clients
const sseClients = new Set();

// IBKR Connect
app.post('/api/ibkr/connect', async (req, res) => {
  try {
    const { host = '127.0.0.1', port = 4001, clientId = 0 } = req.body || {};
    // Validate port to expected range
    if (![4001, 4002, 7496, 7497].includes(Number(port))) {
      return res.status(400).json({ error: 'Invalid port. Use 4001 (live) or 4002 (paper)' });
    }
    const result = await ibkrTws.connect(host, Number(port), Number(clientId));
    res.json(result);
  } catch (err) {
    console.error('IBKR connect error:', err.message);
    res.status(502).json({ error: 'Cannot connect to IB Gateway', details: err.message, connected: false });
  }
});

// IBKR Disconnect
app.post('/api/ibkr/disconnect', (req, res) => {
  const result = ibkrTws.disconnect();
  res.json(result);
});

// IBKR Connection Status
app.get('/api/ibkr/status', (req, res) => {
  res.json(ibkrTws.getStatus());
});

// IBKR Accounts
app.get('/api/ibkr/accounts', (req, res) => {
  try {
    const accounts = ibkrTws.getAccounts();
    res.json(accounts);
  } catch (err) {
    res.status(502).json({ error: 'Failed to get accounts', details: err.message });
  }
});

// IBKR Account Summary
app.get('/api/ibkr/account/:accountId/summary', async (req, res) => {
  try {
    const data = await ibkrTws.getAccountSummary(req.params.accountId);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to get account summary', details: err.message });
  }
});

// IBKR Positions
app.get('/api/ibkr/positions', async (req, res) => {
  try {
    const data = await ibkrTws.getPositionsData();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to get positions', details: err.message });
  }
});

// IBKR Symbol Search
app.post('/api/ibkr/search', async (req, res) => {
  try {
    const { symbol } = req.body || {};
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    const results = await ibkrTws.searchSymbol(String(symbol));
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Symbol search failed', details: err.message });
  }
});

// IBKR Contract Details
app.get('/api/ibkr/contract/:conid', async (req, res) => {
  try {
    const data = await ibkrTws.getContractDetails(Number(req.params.conid));
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Contract details failed', details: err.message });
  }
});

// IBKR Market Data Snapshot
app.get('/api/ibkr/quote/:conid', async (req, res) => {
  try {
    const { exchange = 'SMART', currency = 'USD', secType = 'STK' } = req.query;
    const data = await ibkrTws.getMarketSnapshot(
      Number(req.params.conid), exchange, currency, secType
    );
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Market data snapshot failed', details: err.message });
  }
});

// IBKR Historical Data
app.get('/api/ibkr/history/:conid', async (req, res) => {
  try {
    const { interval = 'daily', exchange = 'SMART', currency = 'USD', secType = 'STK' } = req.query;
    const data = await ibkrTws.getHistoricalData(
      Number(req.params.conid), interval, exchange, currency, secType
    );
    res.json({ data });
  } catch (err) {
    console.error('IBKR history error:', err.message);
    res.status(502).json({ error: 'Historical data failed', details: err.message });
  }
});

// IBKR Streaming Market Data (SSE)
app.get('/api/ibkr/stream/:conid', (req, res) => {
  if (!ibkrTws.isConnected()) {
    return res.status(502).json({ error: 'Not connected to IBKR' });
  }

  const conid = Number(req.params.conid);
  const { exchange = 'SMART', currency = 'USD', secType = 'STK' } = req.query;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sub = ibkrTws.subscribeMarketData(conid, exchange, currency, secType, (tick) => {
    res.write(`data: ${JSON.stringify(tick)}\n\n`);
  });

  req.on('close', () => {
    sub.unsubscribe();
  });
});

// IBKR Unsubscribe All
app.post('/api/ibkr/unsubscribe-all', (req, res) => {
  ibkrTws.unsubscribeAllMarketData();
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
// ALPACA MARKETS - REST API
// ═══════════════════════════════════════════════════════════════

import * as alpacaApi from './alpacaApi.js';

// Alpaca Connect
app.post('/api/alpaca/connect', async (req, res) => {
  try {
    const { apiKey, secretKey, paper = true } = req.body || {};
    if (!apiKey || !secretKey) {
      return res.status(400).json({ error: 'API Key and Secret Key required' });
    }
    alpacaApi.connect(apiKey, secretKey, paper);
    // Validate by fetching account
    const account = await alpacaApi.getAccount();
    res.json({ connected: true, account: { id: account.id, status: account.status, buying_power: account.buying_power, equity: account.equity } });
  } catch (err) {
    alpacaApi.disconnect();
    res.status(401).json({ error: 'Invalid API keys or connection failed', details: err.message, connected: false });
  }
});

// Alpaca Disconnect
app.post('/api/alpaca/disconnect', (req, res) => {
  alpacaApi.disconnect();
  res.json({ connected: false });
});

// Alpaca Status
app.get('/api/alpaca/status', (req, res) => {
  res.json(alpacaApi.getStatus());
});

// Alpaca Account
app.get('/api/alpaca/account', async (req, res) => {
  try {
    const data = await alpacaApi.getAccount();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to get account', details: err.message });
  }
});

// Alpaca Positions
app.get('/api/alpaca/positions', async (req, res) => {
  try {
    const data = await alpacaApi.getPositions();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to get positions', details: err.message });
  }
});

// Alpaca Orders
app.get('/api/alpaca/orders', async (req, res) => {
  try {
    const { status = 'open' } = req.query;
    const data = await alpacaApi.getOrders(status);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to get orders', details: err.message });
  }
});

// Alpaca Snapshot
app.get('/api/alpaca/snapshot/:symbol', async (req, res) => {
  try {
    const data = await alpacaApi.getSnapshot(req.params.symbol);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Snapshot failed', details: err.message });
  }
});

// Alpaca Historical Bars
app.get('/api/alpaca/bars/:symbol', async (req, res) => {
  try {
    const { interval = 'daily', range = '' } = req.query;
    const data = await alpacaApi.getBars(req.params.symbol, interval, range);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Historical data failed', details: err.message });
  }
});

// Alpaca Asset Search
app.get('/api/alpaca/search', async (req, res) => {
  try {
    const { q = '', limit = 500 } = req.query;
    const results = await alpacaApi.searchAssets(q, Number(limit || 500));
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Search failed', details: err.message });
  }
});

// Alpaca full assets universe (paginated)
app.get('/api/alpaca/assets', async (req, res) => {
  try {
    const { q = '', page = 1, limit = 500 } = req.query;
    const data = await alpacaApi.listAssets({
      query: String(q || ''),
      page: Number(page || 1),
      limit: Number(limit || 500),
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Assets fetch failed', details: err.message });
  }
});

// Alpaca universe stats for dashboard coverage/cockpit
app.get('/api/alpaca/universe-stats', async (_req, res) => {
  try {
    const cacheKey = 'alpaca:universe-stats';
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const data = await alpacaApi.listAssets({ page: 1, limit: 5000 });
    const byExchange = (data.assets || []).reduce((acc, row) => {
      const key = row.exchange || 'OTHER';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const payload = {
      total: data.total || 0,
      exchanges: byExchange,
      fetched: data.assets?.length || 0,
      source: 'alpaca',
      ts: Date.now(),
    };
    cacheSet(cacheKey, payload, 60 * 1000);
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: 'Universe stats failed', details: err.message });
  }
});

// Alpaca broad movers scan (not limited to fixed 20 symbols)
app.get('/api/alpaca/movers', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const scanLimitRaw = Number(req.query.scanLimit || 1000);
    const scanLimit = scanLimitRaw === 0 ? 100000 : Math.max(100, Math.min(100000, scanLimitRaw));
    const cacheKey = `alpaca:movers:${limit}:${scanLimit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const universe = await alpacaApi.listAssets({ page: 1, limit: scanLimit });
    const symbols = (universe.assets || []).map((a) => a.symbol).filter(Boolean);
    if (symbols.length === 0) return res.json({ gainers: [], losers: [], scanned: 0, total: 0, source: 'alpaca' });

    const snapshots = await alpacaApi.getSnapshots(symbols);
    const rows = symbols.map((sym) => {
      const snap = snapshots[sym];
      if (!snap) return null;
      const trade = snap.latestTrade || {};
      const daily = snap.dailyBar || {};
      const prev = snap.prevDailyBar || {};
      const price = Number(trade.p || daily.c || 0);
      const prevClose = Number(prev.c || 0);
      if (!price || !prevClose) return null;
      const change = +(((price - prevClose) / prevClose) * 100).toFixed(2);
      return {
        symbol: sym,
        name: sym,
        price: +price.toFixed(2),
        change,
        market: 'us',
      };
    }).filter(Boolean);

    const sorted = rows.sort((a, b) => b.change - a.change);
    const payload = {
      gainers: sorted.filter((s) => s.change > 0).slice(0, limit),
      losers: sorted.filter((s) => s.change < 0).sort((a, b) => a.change - b.change).slice(0, limit),
      scanned: rows.length,
      total: universe.total || rows.length,
      source: 'alpaca',
    };

    cacheSet(cacheKey, payload, 30 * 1000);
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: 'Movers scan failed', details: err.message });
  }
});

// Alpaca SSE — real-time from WebSocket stream
app.get('/api/alpaca/stream/:symbol', (req, res) => {
  if (!alpacaApi.isConnected()) {
    return res.status(502).json({ error: 'Not connected to Alpaca' });
  }

  const symbol = req.params.symbol;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sub = alpacaApi.subscribeQuotes(symbol, (tick) => {
    res.write(`data: ${JSON.stringify(tick)}\n\n`);
  });

  req.on('close', () => {
    sub.unsubscribe();
  });
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Apply rate limiting to auth endpoints
app.use('/api/auth/login', rateLimit('auth', RATE_LIMIT_MAX_AUTH));
app.use('/api/auth/register', rateLimit('auth', RATE_LIMIT_MAX_AUTH));
// Apply rate limiting to market data endpoints
app.use('/api/market', rateLimit('api', RATE_LIMIT_MAX_API));

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!name || name.length > 100) {
    return res.status(400).json({ message: 'الاسم مطلوب (100 حرف كحد أقصى)' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ message: 'بريد إلكتروني غير صالح' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ message: 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم' });
  }

  const exists = db.data.users.find((user) => user.email === email);
  if (exists) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(),
    name,
    email,
    passwordHash,
    role: 'user',
    email_verified: true,
    dashboard_layout: null,
    dashboard_market: 'saudi',
    created_at: new Date().toISOString(),
    alpaca_api_key: '',
    alpaca_secret_key: '',
    alpaca_base_url: '',
    market_data_provider: 'yahoo',
    polygon_api_key: '',
    tradier_api_key: '',
    tadawul_api_key: ''
  };

  db.data.users.push(user);
  await db.write();

  const token = createSessionToken(user.id);
  setSessionCookie(res, token);

  res.status(201).json({
    message: 'Account created successfully.',
    user: publicUser(user)
  });
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const user = db.data.users.find((item) => item.email === email);

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = createSessionToken(user.id);
  setSessionCookie(res, token);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (_, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

app.post('/api/auth/resend-verification', async (req, res) => {
  res.json({ success: true, message: 'Email verification is currently disabled' });
});

app.post('/api/auth/verify-email', async (req, res) => {
  res.json({ success: true, message: 'Email verification is currently disabled' });
});

app.patch('/api/auth/me', authRequired, async (req, res) => {
  const allowedFields = [
    'name',
    'dashboard_layout',
    'dashboard_market',
    'alpaca_api_key',
    'alpaca_secret_key',
    'alpaca_base_url',
    'market_data_provider',
    'polygon_api_key',
    'tradier_api_key',
    'tadawul_api_key'
  ];

  for (const field of allowedFields) {
    if (field in req.body) {
      req.user[field] = req.body[field];
    }
  }

  await db.write();
  res.json({ user: publicUser(req.user) });
});

app.use(express.static(distDir, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    // HTML files should never be cached (they reference hashed assets)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(distDir, 'index.html'));
});

const server = createServer(app);

// ── Socket.IO for live price streaming ──────────────────────
const io = new SocketIO(server, { cors: { origin: '*' } });

// Track which symbols each client is watching
const clientSubs = new Map(); // socketId → { symbols: Set, market: string }

io.on('connection', (socket) => {
  socket.on('subscribe', ({ symbols, market }) => {
    if (!Array.isArray(symbols) || !market) return;
    const clean = symbols.map(s => String(s).trim()).filter(Boolean).slice(0, 50);
    clientSubs.set(socket.id, { symbols: new Set(clean), market });
  });
  socket.on('unsubscribe', () => clientSubs.delete(socket.id));
  socket.on('disconnect', () => clientSubs.delete(socket.id));
});

// Aggregate all watched symbols and broadcast prices every 3 seconds
let livePriceTimer = null;
const startLivePrices = () => {
  if (livePriceTimer) return;
  livePriceTimer = setInterval(async () => {
    // Collect all unique symbols per market
    const byMarket = {};
    for (const [, sub] of clientSubs) {
      if (!byMarket[sub.market]) byMarket[sub.market] = new Set();
      for (const sym of sub.symbols) byMarket[sub.market].add(sym);
    }
    // Fetch quotes for each market
    for (const [market, symbolSet] of Object.entries(byMarket)) {
      const symbols = [...symbolSet];
      if (symbols.length === 0) continue;

      const quotes = {};
      const toFetch = [];
      // Use cache first
      for (const sym of symbols) {
        const hit = cacheGet(`quote:${sym}:${market}`);
        if (hit) quotes[sym] = hit;
        else toFetch.push(sym);
      }
      // Fetch uncached (in batches of 10 to avoid overload)
      for (let i = 0; i < toFetch.length; i += 10) {
        const batch = toFetch.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map(s => {
            const ySymbol = toYahooSymbol(s, market);
            return yfFetch(`${YF_BASE}/${encodeURIComponent(ySymbol)}?interval=1d&range=2d`);
          })
        );
        results.forEach((r, idx) => {
          const sym = batch[idx];
          if (r.status !== 'fulfilled') return;
          const meta = r.value.chart?.result?.[0]?.meta;
          const q = r.value.chart?.result?.[0]?.indicators?.quote?.[0];
          if (!meta) return;
          const price = meta.regularMarketPrice ?? 0;
          const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
          const change = +(price - prev).toFixed(2);
          const changePct = prev !== 0 ? +((change / prev) * 100).toFixed(2) : 0;
          const volumes = q?.volume?.filter(v => v != null) || [];
          const quoteData = {
            price: +price.toFixed(2), change, change_percent: changePct,
            volume: volumes.length > 0 ? volumes[volumes.length - 1] : 0,
            name: meta.shortName || sym,
          };
          quotes[sym] = quoteData;
          cacheSet(`quote:${sym}:${market}`, quoteData, TTL.quote);
        });
      }
      // Emit to each socket that watches this market
      for (const [socketId, sub] of clientSubs) {
        if (sub.market !== market) continue;
        const payload = {};
        for (const sym of sub.symbols) {
          if (quotes[sym]) payload[sym] = quotes[sym];
        }
        if (Object.keys(payload).length > 0) {
          io.to(socketId).emit('prices', payload);
        }
      }
    }
  }, 3000);
};
startLivePrices();

server.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on ${port}`);
});
