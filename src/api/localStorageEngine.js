/**
 * Local Storage Engine - replaces Base44 backend for offline use.
 * All entity data is persisted in localStorage.
 */

const generateId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const getStorageKey = (entityName) => `offline_entity_${entityName}`;

const readAll = (entityName) => {
  try {
    const raw = localStorage.getItem(getStorageKey(entityName));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeAll = (entityName, items) => {
  localStorage.setItem(getStorageKey(entityName), JSON.stringify(items));
};

const createEntityProxy = (entityName) => ({
  list: async (sortBy, limit) => {
    let items = readAll(entityName);
    if (sortBy) {
      const desc = sortBy.startsWith("-");
      const field = desc ? sortBy.slice(1) : sortBy;
      items.sort((a, b) => {
        if (desc) return (b[field] ?? 0) > (a[field] ?? 0) ? 1 : -1;
        return (a[field] ?? 0) > (b[field] ?? 0) ? 1 : -1;
      });
    }
    if (limit) items = items.slice(0, limit);
    return items;
  },

  filter: async (filters) => {
    const items = readAll(entityName);
    return items.filter((item) =>
      Object.entries(filters).every(([key, val]) => item[key] === val)
    );
  },

  create: async (data) => {
    const items = readAll(entityName);
    const newItem = {
      ...data,
      id: generateId(),
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    };
    items.push(newItem);
    writeAll(entityName, items);
    return newItem;
  },

  update: async (id, data) => {
    const items = readAll(entityName);
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error(`Entity ${entityName} with id ${id} not found`);
    items[idx] = { ...items[idx], ...data, updated_date: new Date().toISOString() };
    writeAll(entityName, items);
    return items[idx];
  },

  delete: async (id) => {
    const items = readAll(entityName);
    writeAll(entityName, items.filter((i) => i.id !== id));
    return { success: true };
  },
});

// ─── Real Market Data via Server API ──────

// Deployed server URL (Railway/Render/etc.) - update this when deployed
const DEPLOYED_API = import.meta.env.VITE_API_URL || '';

const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YF_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';

const toYahooSymbol = (symbol, market) => {
  if (market === 'saudi') {
    if (['TASI', 'MI30', 'TFNI'].includes(symbol)) return '^TASI.SR';
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

const parseQuoteFromYF = (data, symbol) => {
  const meta = data?.chart?.result?.[0]?.meta;
  const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0];
  if (!meta) return null;
  const price = meta.regularMarketPrice ?? 0;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
  const change = +(price - prevClose).toFixed(2);
  const changePct = prevClose !== 0 ? +((change / prevClose) * 100).toFixed(2) : 0;
  const highPrices = quotes?.high?.filter(v => v != null) || [];
  const lowPrices = quotes?.low?.filter(v => v != null) || [];
  const volumes = quotes?.volume?.filter(v => v != null) || [];
  return {
    price,
    change,
    change_percent: changePct,
    volume: volumes.length > 0 ? volumes[volumes.length - 1] : 0,
    high: highPrices.length > 0 ? Math.max(...highPrices) : price,
    low: lowPrices.length > 0 ? Math.min(...lowPrices) : price,
    name: meta.shortName || meta.symbol || symbol,
    currency: meta.currency || 'USD',
  };
};

const parseCandlesFromYF = (data) => {
  const result = data?.chart?.result?.[0];
  if (!result) return [];
  const timestamps = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  return timestamps.map((t, i) => ({
    time: t,
    open: q.open?.[i] ?? 0,
    high: q.high?.[i] ?? 0,
    low: q.low?.[i] ?? 0,
    close: q.close?.[i] ?? 0,
    volume: q.volume?.[i] ?? 0,
  })).filter(c => c.open && c.close);
};

// Build API URL for an action
const buildApiUrl = (baseUrl, params) => {
  const { action, symbol, market, interval, limit, from, to, coin, currency } = params;
  switch (action) {
    case 'quote':
      return `${baseUrl}/api/market/quote?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market || 'saudi')}`;
    case 'candles':
      return `${baseUrl}/api/market/candles?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market || 'saudi')}&interval=${encodeURIComponent(interval || 'daily')}&limit=${limit || 365}`;
    case 'overview':
      return `${baseUrl}/api/market/overview?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market || 'saudi')}`;
    case 'indices':
      return `${baseUrl}/api/market/indices`;
    case 'forex':
      return `${baseUrl}/api/market/forex?from=${encodeURIComponent(from || 'USD')}&to=${encodeURIComponent(to || 'SAR')}`;
    case 'crypto':
      return `${baseUrl}/api/market/crypto?coin=${encodeURIComponent(coin || 'BTC')}&currency=${encodeURIComponent(currency || 'USD')}`;
    case 'top_movers':
      return `${baseUrl}/api/market/top-movers?market=${encodeURIComponent(market || 'saudi')}`;
    case 'news':
      return `${baseUrl}/api/market/news?symbol=${encodeURIComponent(symbol || '')}&market=${encodeURIComponent(market || 'saudi')}`;
    case 'batch_quotes':
      return `${baseUrl}/api/market/batch-quotes?symbols=${encodeURIComponent(params.symbols || '')}&market=${encodeURIComponent(market || 'saudi')}`;
    default:
      return null;
  }
};

const wrapApiResponse = (action, data) => {
  switch (action) {
    case 'quote': return { data };
    case 'candles': return { data: { candles: data.candles || [] } };
    case 'news': return { data: { news: data.news || [] } };
    case 'batch_quotes': return { data };
    default: return { data };
  }
};

const tryFetchApi = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;
  return data;
};

// Try local server first, then deployed server
const fetchRealMarketData = async (params) => {
  const { action, symbol, market } = params;

  // 1) Try local server API (same-origin or Vite proxy)
  const localUrl = buildApiUrl('', params);
  if (localUrl) {
    try {
      const data = await tryFetchApi(localUrl);
      if (data) return wrapApiResponse(action, data);
    } catch { /* local server not available */ }
  }

  // 2) Try deployed server (Railway/Render) if configured
  if (DEPLOYED_API) {
    const deployedUrl = buildApiUrl(DEPLOYED_API, params);
    if (deployedUrl) {
      try {
        const data = await tryFetchApi(deployedUrl);
        if (data) return wrapApiResponse(action, data);
      } catch { /* deployed server not available */ }
    }
  }

  return null;
};

// ─── Mock Market Data (fallback) ──────────────────────────────────────────

const MOCK_STOCKS = {
  saudi: {
    "2222": { price: 32.50, change: 0.85, name: "أرامكو", high: 34.0, low: 31.0, volume: 12500000 },
    "1120": { price: 95.40, change: -1.20, name: "الراجحي", high: 97.0, low: 94.5, volume: 8200000 },
    "2010": { price: 87.20, change: 1.50, name: "سابك", high: 88.5, low: 86.0, volume: 5400000 },
    "7010": { price: 42.30, change: 0.35, name: "STC", high: 43.0, low: 41.8, volume: 3200000 },
    "1180": { price: 44.10, change: -0.60, name: "الأهلي", high: 45.0, low: 43.5, volume: 6100000 },
    "2380": { price: 15.20, change: 0.40, name: "بترو رابغ", high: 15.8, low: 14.9, volume: 2100000 },
    "1211": { price: 52.80, change: 1.10, name: "معادن", high: 53.5, low: 51.5, volume: 4300000 },
    "1010": { price: 28.60, change: -0.30, name: "بنك الرياض", high: 29.2, low: 28.0, volume: 3800000 },
    "4190": { price: 165.00, change: 2.50, name: "جرير", high: 167.0, low: 162.0, volume: 1200000 },
    "2350": { price: 12.30, change: -0.45, name: "كيان", high: 12.9, low: 12.0, volume: 9800000 },
    "2050": { price: 28.90, change: -0.90, name: "صافولا", high: 30.0, low: 28.5, volume: 1500000 },
    "4030": { price: 18.20, change: 0.20, name: "تبوك للزراعة", high: 18.8, low: 17.9, volume: 900000 },
    "1060": { price: 38.50, change: 0.70, name: "بنك البلاد", high: 39.0, low: 37.8, volume: 2800000 },
    "7020": { price: 55.60, change: -0.40, name: "موبايلي", high: 56.5, low: 55.0, volume: 2200000 },
    "7030": { price: 12.80, change: 0.15, name: "زين", high: 13.2, low: 12.5, volume: 4100000 },
  },
  us: {
    "AAPL":  { price: 198.50, change: 2.80, name: "Apple", high: 201.0, low: 196.0, volume: 52000000 },
    "MSFT":  { price: 415.20, change: 1.95, name: "Microsoft", high: 418.0, low: 412.0, volume: 22000000 },
    "NVDA":  { price: 875.30, change: 4.12, name: "NVIDIA", high: 885.0, low: 860.0, volume: 45000000 },
    "TSLA":  { price: 245.60, change: -3.45, name: "Tesla", high: 252.0, low: 242.0, volume: 38000000 },
    "AMZN":  { price: 185.40, change: 1.20, name: "Amazon", high: 187.0, low: 183.0, volume: 28000000 },
    "META":  { price: 502.30, change: 3.80, name: "Meta", high: 508.0, low: 498.0, volume: 18000000 },
    "GOOGL": { price: 156.20, change: -0.90, name: "Alphabet", high: 158.0, low: 155.0, volume: 24000000 },
    "AMD":   { price: 178.90, change: 2.10, name: "AMD", high: 182.0, low: 176.0, volume: 32000000 },
    "JPM":   { price: 198.50, change: 1.40, name: "JPMorgan", high: 200.0, low: 196.0, volume: 9000000 },
    "V":     { price: 282.30, change: 0.80, name: "Visa", high: 284.0, low: 280.0, volume: 7500000 },
  },
};

const randomNoise = (base, pct = 0.02) => +(base * (1 + (Math.random() - 0.5) * pct)).toFixed(2);

const buildMockCandles = (basePrice = 100, days = 100) => {
  const volatility = 0.012;
  return Array.from({ length: days }, (_, i) => {
    const t = (i / days) * 2 * Math.PI;
    const cycleFactor = Math.sin(t) * 0.04;
    const noise = (Math.random() - 0.5) * volatility * basePrice;
    const close = +(basePrice * (1 + cycleFactor * ((days - i) / days)) + noise).toFixed(2);
    const open = +(close * (1 + (Math.random() - 0.5) * 0.008)).toFixed(2);
    const high = +(Math.max(close, open) * (1 + Math.random() * 0.006)).toFixed(2);
    const low = +(Math.min(close, open) * (1 - Math.random() * 0.006)).toFixed(2);
    return {
      time: new Date(Date.now() - (days - i) * 86400000).toISOString().split("T")[0],
      open, high, low, close: Math.max(close, 0.1),
      volume: Math.floor(Math.random() * 5000000 + 500000),
    };
  });
};

const MOCK_NEWS = [
  { title: "تقرير: نمو أرباح الشركات السعودية بنسبة 15% في الربع الأخير", source: "أرقام", date: new Date().toISOString(), sentiment: "positive", url: "#" },
  { title: "البنك المركزي يثبت أسعار الفائدة عند المستويات الحالية", source: "رويترز", date: new Date().toISOString(), sentiment: "neutral", url: "#" },
  { title: "ارتفاع أسعار النفط يدعم أسهم قطاع الطاقة", source: "بلومبرج", date: new Date().toISOString(), sentiment: "positive", url: "#" },
  { title: "تراجع مؤشر الدولار يعزز شهية المخاطرة في الأسواق الناشئة", source: "CNBC", date: new Date().toISOString(), sentiment: "positive", url: "#" },
  { title: "تحذيرات من تباطؤ النمو الاقتصادي العالمي في 2026", source: "Financial Times", date: new Date().toISOString(), sentiment: "negative", url: "#" },
];

const handleMarketDataInvoke = (params) => {
  const { action, symbol, market, from, to, coin, currency } = params;
  const stockDb = MOCK_STOCKS[market] || MOCK_STOCKS.us;
  const stock = stockDb[symbol];

  switch (action) {
    case "quote":
      if (!stock) return { data: { price: randomNoise(100), change: randomNoise(0, 5), change_percent: randomNoise(1.5, 2), volume: 1000000, name: symbol } };
      return { data: { price: randomNoise(stock.price), change: randomNoise(stock.change, 0.3), change_percent: +((stock.change / stock.price) * 100).toFixed(2), volume: stock.volume, high: stock.high, low: stock.low, name: stock.name } };

    case "candles":
      return { data: { candles: buildMockCandles(stock?.price || 100) } };

    case "overview":
      return { data: { pe_ratio: randomNoise(18), eps: randomNoise(5.2), market_cap: "150B", dividend_yield: randomNoise(2.1), beta: randomNoise(1.1), high_52w: stock ? +(stock.price * 1.3).toFixed(2) : 130, low_52w: stock ? +(stock.price * 0.7).toFixed(2) : 70, sector: "—", description: "بيانات محلية - غير متصل بالإنترنت" } };

    case "news":
      return { data: { news: MOCK_NEWS } };

    case "top_movers":
      return { data: { gainers: Object.entries(MOCK_STOCKS.saudi).filter(([, v]) => v.change > 0).slice(0, 5).map(([s, v]) => ({ symbol: s, ...v })), losers: Object.entries(MOCK_STOCKS.saudi).filter(([, v]) => v.change < 0).slice(0, 5).map(([s, v]) => ({ symbol: s, ...v })) } };

    case "forex":
      return { data: { rate: from === "USD" && to === "SAR" ? 3.75 : 1.0, from: from || "USD", to: to || "SAR" } };

    case "crypto":
      return { data: { price: coin === "BTC" ? 67500 : coin === "ETH" ? 3450 : 100, change_24h: randomNoise(2.5, 2), coin: coin || "BTC", currency: currency || "USD" } };

    case "indices":
      return { data: { indices: [
        { name: "تاسي", value: 12450.30, change: 0.85 },
        { name: "نمو", value: 25890.10, change: -0.42 },
        { name: "S&P 500", value: 5320.40, change: 0.65 },
        { name: "Nasdaq", value: 16780.20, change: 1.12 },
        { name: "Dow Jones", value: 39250.80, change: 0.35 },
      ] } };

    default:
      return { data: {} };
  }
};

const handleBrokerInvoke = (params) => {
  const { action } = params;
  switch (action) {
    case "getSavedKeys":
      return { data: { hasKeys: false } };
    case "account":
      return { data: { buying_power: 100000, cash: 50000, portfolio_value: 150000, equity: 150000 } };
    case "order":
      return { data: { success: true, order_id: generateId(), message: "أمر تجريبي - وضع غير متصل" } };
    default:
      return { data: {} };
  }
};

// ─── Mock Auth ─────────────────────────────────────────────────────────────

const mockUser = {
  id: "local_user",
  name: "مستخدم محلي",
  email: "local@offline.app",
  dashboard_layout: null,
  dashboard_market: "saudi",
};

const mockAuth = {
  me: async () => {
    const saved = localStorage.getItem("offline_user");
    return saved ? JSON.parse(saved) : { ...mockUser };
  },
  updateMe: async (data) => {
    const current = await mockAuth.me();
    const updated = { ...current, ...data };
    localStorage.setItem("offline_user", JSON.stringify(updated));
    return updated;
  },
  logout: () => {},
  redirectToLogin: () => {},
};

// ─── Create Offline Client ─────────────────────────────────────────────────

export const createOfflineClient = () => {
  const entitiesProxy = new Proxy({}, {
    get: (_, entityName) => createEntityProxy(entityName),
  });

  return {
    entities: entitiesProxy,
    auth: mockAuth,
    functions: {
      invoke: async (funcName, params = {}) => {
        if (funcName === "marketData") {
          // Try real API first, fall back to mock
          const realResult = await fetchRealMarketData(params);
          if (realResult) return realResult;
          return handleMarketDataInvoke(params);
        }
        if (funcName === "brokerIntegration") return handleBrokerInvoke(params);
        return { data: {} };
      },
    },
  };
};
