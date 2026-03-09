import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
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

// ═══════════════════════════════════════════════════════════════
// MARKET DATA PROXY (Yahoo Finance)
// ═══════════════════════════════════════════════════════════════
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YF_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';
const YF_QUOTE = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';

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

const rangeMap = {
  '1m': '1d', '5m': '5d', '15m': '5d', '30m': '1mo', '60m': '1mo',
  '1d': '1y', '1wk': '5y', '1mo': 'max',
};

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

// GET /api/market/quote?symbol=2222&market=saudi
app.get('/api/market/quote', async (req, res) => {
  try {
    const { symbol, market = 'saudi' } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    
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
    
    res.json({
      price,
      change,
      change_percent: changePct,
      volume: volumes.length > 0 ? volumes[volumes.length - 1] : 0,
      high: highPrices.length > 0 ? Math.max(...highPrices) : price,
      low: lowPrices.length > 0 ? Math.min(...lowPrices) : price,
      name: meta.shortName || meta.symbol || symbol,
      currency: meta.currency || (market === 'saudi' ? 'SAR' : 'USD'),
    });
  } catch (err) {
    console.error('Quote error:', err.message);
    res.status(502).json({ error: 'Failed to fetch quote' });
  }
});

// GET /api/market/candles?symbol=2222&market=saudi&interval=daily&limit=365
app.get('/api/market/candles', async (req, res) => {
  try {
    const { symbol, market = 'saudi', interval = 'daily' } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    
    const ySymbol = toYahooSymbol(symbol, market);
    const yfInterval = intervalMap[interval] || '1d';
    const range = rangeMap[yfInterval] || '1y';
    
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
    
    const ySymbol = toYahooSymbol(symbol, market);
    const data = await yfFetch(`${YF_BASE}/${encodeURIComponent(ySymbol)}?interval=1d&range=1y`);
    const meta = data.chart?.result?.[0]?.meta;
    const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
    
    if (!meta) return res.json({});
    
    const allHighs = quotes?.high?.filter(v => v != null) || [];
    const allLows = quotes?.low?.filter(v => v != null) || [];
    
    res.json({
      name: meta.shortName || symbol,
      exchange: meta.exchangeName || '',
      currency: meta.currency || '',
      high_52w: allHighs.length > 0 ? +Math.max(...allHighs).toFixed(2) : 0,
      low_52w: allLows.length > 0 ? +Math.min(...allLows).toFixed(2) : 0,
      market_cap: meta.marketCap || '',
    });
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
    const symbol = `${from}${to}=X`;
    const data = await yfFetch(`${YF_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=2d`);
    const meta = data.chart?.result?.[0]?.meta;
    res.json({ rate: meta?.regularMarketPrice ?? 0, from, to });
  } catch (err) {
    console.error('Forex error:', err.message);
    res.json({ rate: from === 'USD' && to === 'SAR' ? 3.75 : 1.0, from: req.query.from, to: req.query.to });
  }
});

// GET /api/market/crypto?coin=BTC&currency=USD
app.get('/api/market/crypto', async (req, res) => {
  try {
    const { coin = 'BTC', currency = 'USD' } = req.query;
    const symbol = `${coin}-${currency}`;
    const data = await yfFetch(`${YF_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=2d`);
    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice ?? 0;
    const prev = meta?.previousClose ?? meta?.chartPreviousClose ?? price;
    const change24h = prev !== 0 ? +(((price - prev) / prev) * 100).toFixed(2) : 0;
    res.json({ price, change_24h: change24h, coin, currency });
  } catch (err) {
    console.error('Crypto error:', err.message);
    res.json({ price: 0, change_24h: 0, coin: req.query.coin, currency: req.query.currency });
  }
});

// GET /api/market/top-movers?market=saudi
app.get('/api/market/top-movers', async (req, res) => {
  try {
    const { market = 'saudi' } = req.query;
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
    res.json({
      gainers: sorted.filter(s => s.change > 0).slice(0, 10),
      losers: sorted.filter(s => s.change < 0).sort((a, b) => a.change - b.change).slice(0, 10),
    });
  } catch (err) {
    console.error('Top movers error:', err.message);
    res.json({ gainers: [], losers: [] });
  }
});

// GET /api/market/news?symbol=2222&market=saudi
app.get('/api/market/news', async (req, res) => {
  try {
    const { symbol, market = 'saudi' } = req.query;
    const ySymbol = symbol ? toYahooSymbol(symbol, market) : (market === 'saudi' ? '^TASI.SR' : '^GSPC');
    
    const data = await yfFetch(`${YF_SEARCH}?q=${encodeURIComponent(ySymbol)}&newsCount=10&quotesCount=0`);
    const news = (data.news || []).map(item => ({
      title: item.title || '',
      source: item.publisher || '',
      date: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toISOString() : new Date().toISOString(),
      url: item.link || '#',
      thumbnail: item.thumbnail?.resolutions?.[0]?.url || '',
    }));
    
    res.json({ news });
  } catch (err) {
    console.error('News error:', err.message);
    res.json({ news: [] });
  }
});

// GET /api/market/batch-quotes?symbols=AAPL,MSFT,NVDA&market=us
app.get('/api/market/batch-quotes', async (req, res) => {
  try {
    const { symbols: symbolsStr, market = 'saudi' } = req.query;
    if (!symbolsStr) return res.json({ quotes: {} });
    
    const symbolList = symbolsStr.split(',').slice(0, 30);
    const results = await Promise.allSettled(
      symbolList.map(s => {
        const ySymbol = toYahooSymbol(s.trim(), market);
        return yfFetch(`${YF_BASE}/${encodeURIComponent(ySymbol)}?interval=1d&range=2d`);
      })
    );
    
    const quotes = {};
    results.forEach((r, i) => {
      const sym = symbolList[i].trim();
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
      quotes[sym] = {
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
    });
    
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
  alpaca_base_url: user.alpaca_base_url ?? ''
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
    alpaca_base_url: ''
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
    alpaca_base_url: ''
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
    'alpaca_base_url'
  ];

  for (const field of allowedFields) {
    if (field in req.body) {
      req.user[field] = req.body[field];
    }
  }

  await db.write();
  res.json({ user: publicUser(req.user) });
});

app.use(express.static(distDir));

app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on ${port}`);
});
