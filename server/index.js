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

app.use(express.json());
app.use(cookieParser());

// CORS - allow requests from GitHub Pages and any origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

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

const intervalMap = {
  '1min': '1m', '5min': '5m', '15min': '15m', '30min': '30m', '60min': '60m',
  'daily': '1d', 'weekly': '1wk', 'monthly': '1mo',
};

// Yahoo Finance free-tier limits: 1m→7d, intraday→60d, EOD→unlimited
const defaultRangeMap = {
  '1m': '5d', '5m': '1mo', '15m': '3mo', '30m': '6mo', '60m': '2y',
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

    const yfInterval = intervalMap[interval] || '1d';
    const range = (reqRange && validRanges.has(reqRange)) ? reqRange : (defaultRangeMap[yfInterval] || '5y');
    const cacheKey = `candles:${symbol}:${market}:${yfInterval}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const ySymbol = toYahooSymbol(symbol, market);
    const data = await yfFetch(`${YF_BASE}/${encodeURIComponent(ySymbol)}?interval=${yfInterval}&range=${range}`);
    const result = data.chart?.result?.[0];
    
    if (!result?.timestamp) return res.json({ candles: [] });
    
    const timestamps = result.timestamp;
    const q = result.indicators.quote[0];
    const isIntraday = ['1m', '5m', '15m', '30m', '60m'].includes(yfInterval);
    
    const candles = timestamps.map((t, i) => {
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
    
    const results = await Promise.allSettled(
      symbols.map(s => yfFetch(`${YF_BASE}/${encodeURIComponent(s)}?interval=1d&range=2d`))
    );
    
    const indices = results.map((r, i) => {
      if (r.status !== 'fulfilled') return { name: names[i], value: 0, change: 0 };
      const meta = r.value.chart?.result?.[0]?.meta;
      if (!meta) return { name: names[i], value: 0, change: 0 };
      const price = meta.regularMarketPrice ?? 0;
      const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
      return {
        name: names[i],
        value: +price.toFixed(2),
        change: prev !== 0 ? +(((price - prev) / prev) * 100).toFixed(2) : 0,
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
    const { interval = 'daily' } = req.query;
    const data = await alpacaApi.getBars(req.params.symbol, interval);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Historical data failed', details: err.message });
  }
});

// Alpaca Asset Search
app.get('/api/alpaca/search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const results = await alpacaApi.searchAssets(q);
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Search failed', details: err.message });
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

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ message: 'Invalid registration data' });
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
