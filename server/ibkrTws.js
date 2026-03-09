/**
 * IBKR TWS API Connection Manager
 * 
 * Manages a persistent connection to IB Gateway via TWS API protocol.
 * Uses @stoqey/ib for the TWS socket connection on port 4001 (live) or 4002 (paper).
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { IBApi, EventName, SecType, BarSizeSetting } = require('@stoqey/ib');

// ─── Connection State ────────────────────────────────────────
let ib = null;
let connected = false;
let nextOrderId = 0;
let nextReqId = 1000;
const pendingRequests = new Map(); // reqId → { resolve, reject, data, timer }
const marketDataSubscriptions = new Map(); // reqId → { conid, callback }
const accountSummaryData = new Map(); // tag → value
const positions = []; // current positions

const getNextReqId = () => nextReqId++;

// ─── Connect / Disconnect ────────────────────────────────────

export const connect = (host = '127.0.0.1', port = 4001, clientId = 0) => {
  return new Promise((resolve, reject) => {
    if (connected && ib) {
      resolve({ connected: true, message: 'Already connected' });
      return;
    }

    // Disconnect if there's a leftover connection
    if (ib) {
      try { ib.disconnect(); } catch (_) {}
      ib = null;
    }

    ib = new IBApi({ host, port, clientId });

    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
      try { ib.disconnect(); } catch (_) {}
      ib = null;
    }, 10000);

    ib.on(EventName.connected, () => {
      connected = true;
      clearTimeout(timeout);
      console.log(`[IBKR TWS] Connected to ${host}:${port}`);
      resolve({ connected: true });
    });

    ib.on(EventName.disconnected, () => {
      connected = false;
      console.log('[IBKR TWS] Disconnected');
      // Clean up pending requests
      pendingRequests.forEach((req) => {
        clearTimeout(req.timer);
        req.reject(new Error('Disconnected'));
      });
      pendingRequests.clear();
      marketDataSubscriptions.clear();
    });

    ib.on(EventName.error, (err, code, reqId) => {
      const msg = typeof err === 'string' ? err : err?.message || 'Unknown error';
      // Non-fatal errors: code 2104, 2106, 2158 are info messages
      if ([2104, 2106, 2158, 2119].includes(code)) {
        return;
      }
      console.error(`[IBKR TWS] Error: ${msg} (code=${code}, reqId=${reqId})`);
      if (reqId > 0 && pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        clearTimeout(req.timer);
        pendingRequests.delete(reqId);
        req.reject(new Error(msg));
      }
    });

    ib.on(EventName.nextValidId, (orderId) => {
      nextOrderId = orderId;
    });

    // ── Account Summary Events ──
    ib.on(EventName.accountSummary, (reqId, account, tag, value, currency) => {
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        if (!req.data) req.data = {};
        req.data[tag] = { value, currency, account };
      }
    });

    ib.on(EventName.accountSummaryEnd, (reqId) => {
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        clearTimeout(req.timer);
        pendingRequests.delete(reqId);
        req.resolve(req.data || {});
      }
    });

    // ── Managed Accounts Event ──
    ib.on(EventName.managedAccounts, (accountsList) => {
      accountSummaryData.set('managedAccounts', accountsList);
    });

    // ── Position Events ──
    ib.on(EventName.position, (account, contract, pos, avgCost) => {
      positions.push({ account, contract, position: pos, avgCost });
    });

    ib.on(EventName.positionEnd, () => {
      if (pendingRequests.has('positions')) {
        const req = pendingRequests.get('positions');
        clearTimeout(req.timer);
        pendingRequests.delete('positions');
        req.resolve([...positions]);
      }
    });

    // ── Contract Details Events ──
    ib.on(EventName.contractDetails, (reqId, contractDetails) => {
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        if (!req.data) req.data = [];
        req.data.push(contractDetails);
      }
    });

    ib.on(EventName.contractDetailsEnd, (reqId) => {
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        clearTimeout(req.timer);
        pendingRequests.delete(reqId);
        req.resolve(req.data || []);
      }
    });

    // ── Symbol Search Events ──
    ib.on(EventName.symbolSamples, (reqId, contractDescriptions) => {
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        clearTimeout(req.timer);
        pendingRequests.delete(reqId);
        req.resolve(contractDescriptions || []);
      }
    });

    // ── Historical Data Events ──
    ib.on(EventName.historicalData, (reqId, bar) => {
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        if (!req.data) req.data = [];
        // bar with date === '' marks end of data in some versions
        if (bar && bar.date) {
          req.data.push(bar);
        }
      }
    });

    const handleHistoricalEnd = (reqId) => {
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        clearTimeout(req.timer);
        pendingRequests.delete(reqId);
        req.resolve(req.data || []);
      }
    };

    // historicalDataEnd may or may not fire depending on version
    if (EventName.historicalDataEnd) {
      ib.on(EventName.historicalDataEnd, handleHistoricalEnd);
    }

    // ── Market Data (Tick) Events ──
    ib.on(EventName.tickPrice, (reqId, tickType, value, attribs) => {
      if (marketDataSubscriptions.has(reqId)) {
        const sub = marketDataSubscriptions.get(reqId);
        sub.callback({ reqId, type: 'price', tickType, value });
      }
      // Also handle snapshot requests
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        if (!req.data) req.data = {};
        req.data[`price_${tickType}`] = value;
      }
    });

    ib.on(EventName.tickSize, (reqId, tickType, value) => {
      if (marketDataSubscriptions.has(reqId)) {
        const sub = marketDataSubscriptions.get(reqId);
        sub.callback({ reqId, type: 'size', tickType, value });
      }
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        if (!req.data) req.data = {};
        req.data[`size_${tickType}`] = value;
      }
    });

    ib.on(EventName.tickString, (reqId, tickType, value) => {
      if (marketDataSubscriptions.has(reqId)) {
        const sub = marketDataSubscriptions.get(reqId);
        sub.callback({ reqId, type: 'string', tickType, value });
      }
    });

    ib.on(EventName.tickGeneric, (reqId, tickType, value) => {
      if (marketDataSubscriptions.has(reqId)) {
        const sub = marketDataSubscriptions.get(reqId);
        sub.callback({ reqId, type: 'generic', tickType, value });
      }
    });

    ib.on(EventName.tickSnapshotEnd, (reqId) => {
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        clearTimeout(req.timer);
        pendingRequests.delete(reqId);
        req.resolve(req.data || {});
      }
    });

    ib.connect();
  });
};

export const disconnect = () => {
  if (ib) {
    try { ib.disconnect(); } catch (_) {}
    ib = null;
    connected = false;
    pendingRequests.clear();
    marketDataSubscriptions.clear();
  }
  return { connected: false };
};

export const isConnected = () => connected;

// ─── Helper: Create pending request ─────────────────────────

const createRequest = (reqId, timeoutMs = 15000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingRequests.has(reqId)) {
        const req = pendingRequests.get(reqId);
        pendingRequests.delete(reqId);
        // If we have partial data, return it
        if (req.data && (Array.isArray(req.data) ? req.data.length > 0 : Object.keys(req.data).length > 0)) {
          resolve(req.data);
        } else {
          reject(new Error(`Request ${reqId} timed out`));
        }
      }
    }, timeoutMs);
    pendingRequests.set(reqId, { resolve, reject, data: null, timer });
  });
};

// ─── Accounts ────────────────────────────────────────────────

export const getAccounts = () => {
  const accounts = accountSummaryData.get('managedAccounts');
  if (accounts) {
    return accounts.split(',').filter(Boolean).map(id => ({ id: id.trim() }));
  }
  // If no cached accounts, request them
  if (ib && connected) {
    ib.reqManagedAccts();
    return [];
  }
  return [];
};

export const getAccountSummary = async (accountId) => {
  if (!ib || !connected) throw new Error('Not connected');
  const reqId = getNextReqId();
  const promise = createRequest(reqId, 10000);
  ib.reqAccountSummary(
    reqId,
    accountId || 'All',
    'NetLiquidation,TotalCashValue,BuyingPower,UnrealizedPnL,RealizedPnL,GrossPositionValue'
  );
  const result = await promise;
  ib.cancelAccountSummary(reqId);
  return result;
};

export const getPositionsData = async () => {
  if (!ib || !connected) throw new Error('Not connected');
  positions.length = 0; // Clear previous positions
  const reqId = 'positions';
  const promise = createRequest(reqId, 10000);
  ib.reqPositions();
  const result = await promise;
  ib.cancelPositions();
  return result;
};

// ─── Contract/Symbol Search ──────────────────────────────────

export const searchSymbol = async (pattern) => {
  if (!ib || !connected) throw new Error('Not connected');
  const reqId = getNextReqId();
  const promise = createRequest(reqId, 10000);
  ib.reqMatchingSymbols(reqId, pattern);
  const results = await promise;
  return results.map(cd => ({
    conid: cd.contract?.conId,
    symbol: cd.contract?.symbol,
    secType: cd.contract?.secType,
    exchange: cd.contract?.primaryExch || cd.contract?.exchange,
    currency: cd.contract?.currency,
    description: cd.derivativeSecTypes?.join(', ') || '',
  }));
};

export const getContractDetails = async (conid) => {
  if (!ib || !connected) throw new Error('Not connected');
  const reqId = getNextReqId();
  const promise = createRequest(reqId, 10000);
  ib.reqContractDetails(reqId, { conId: conid });
  return promise;
};

// ─── Market Data (Snapshot) ──────────────────────────────────

// TWS TickType mapping
const TICK_FIELDS = {
  1: 'bid', 2: 'ask', 4: 'last', 6: 'high', 7: 'low', 9: 'close',
  14: 'open', 0: 'bidSize', 3: 'askSize', 5: 'lastSize', 8: 'volume',
};

export const getMarketSnapshot = async (conid, exchange = 'SMART', currency = 'USD', secType = 'STK') => {
  if (!ib || !connected) throw new Error('Not connected');
  const reqId = getNextReqId();
  const contract = { conId: conid, secType, exchange, currency };
  const promise = createRequest(reqId, 12000);
  ib.reqMktData(reqId, contract, '', true, false); // snapshot=true
  const rawData = await promise;
  
  // Transform tick data to our format
  const quote = { conid };
  Object.entries(rawData).forEach(([key, value]) => {
    const [kind, tickTypeStr] = key.split('_');
    const tickType = parseInt(tickTypeStr);
    const field = TICK_FIELDS[tickType];
    if (field) quote[field] = value;
  });

  return {
    price: quote.last || quote.close || 0,
    change: quote.last && quote.close ? +(quote.last - quote.close).toFixed(4) : 0,
    change_percent: quote.last && quote.close ? +(((quote.last - quote.close) / quote.close) * 100).toFixed(2) : 0,
    volume: quote.volume || 0,
    high: quote.high || 0,
    low: quote.low || 0,
    bid: quote.bid || 0,
    ask: quote.ask || 0,
    bidSize: quote.bidSize || 0,
    askSize: quote.askSize || 0,
    open: quote.open || 0,
    prevClose: quote.close || 0,
    conid,
  };
};

// ─── Market Data (Streaming) ─────────────────────────────────

export const subscribeMarketData = (conid, exchange = 'SMART', currency = 'USD', secType = 'STK', callback) => {
  if (!ib || !connected) throw new Error('Not connected');
  const reqId = getNextReqId();
  const contract = { conId: conid, secType, exchange, currency };
  
  marketDataSubscriptions.set(reqId, { conid, callback });
  ib.reqMktData(reqId, contract, '', false, false); // streaming
  
  return {
    reqId,
    unsubscribe: () => {
      try { ib.cancelMktData(reqId); } catch (_) {}
      marketDataSubscriptions.delete(reqId);
    },
  };
};

export const unsubscribeAllMarketData = () => {
  marketDataSubscriptions.forEach((sub, reqId) => {
    try { ib?.cancelMktData(reqId); } catch (_) {}
  });
  marketDataSubscriptions.clear();
};

// ─── Historical Data ─────────────────────────────────────────

const BAR_SIZE_MAP = {
  '1min': BarSizeSetting.MINUTES_ONE,
  '5min': BarSizeSetting.MINUTES_FIVE,
  '15min': BarSizeSetting.MINUTES_FIFTEEN,
  '30min': BarSizeSetting.MINUTES_THIRTY,
  '60min': BarSizeSetting.HOURS_ONE,
  'daily': BarSizeSetting.DAYS_ONE,
  'weekly': BarSizeSetting.WEEKS_ONE,
  'monthly': BarSizeSetting.MONTHS_ONE,
};

const DURATION_MAP = {
  '1min': '1 D',
  '5min': '2 D',
  '15min': '1 W',
  '30min': '1 W',
  '60min': '1 M',
  'daily': '1 Y',
  'weekly': '5 Y',
  'monthly': '10 Y',
};

export const getHistoricalData = async (conid, interval = 'daily', exchange = 'SMART', currency = 'USD', secType = 'STK') => {
  if (!ib || !connected) throw new Error('Not connected');
  const reqId = getNextReqId();
  const contract = { conId: conid, secType, exchange, currency };
  const barSize = BAR_SIZE_MAP[interval] || BarSizeSetting.DAYS_ONE;
  const duration = DURATION_MAP[interval] || '1 Y';
  
  const promise = createRequest(reqId, 30000);
  
  // endDateTime = '' means "up to now"
  ib.reqHistoricalData(
    reqId, contract, '', duration, barSize,
    'TRADES', 1, 1, false
  );

  const bars = await promise;
  
  return bars.map(bar => {
    let time;
    if (bar.date && bar.date.length === 8) {
      // Format: "20240315" → "2024-03-15"
      time = `${bar.date.slice(0, 4)}-${bar.date.slice(4, 6)}-${bar.date.slice(6, 8)}`;
    } else if (bar.date && bar.date.includes(' ')) {
      // Intraday: "20240315 09:30:00" → unix timestamp
      const d = new Date(bar.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
      time = Math.floor(d.getTime() / 1000);
    } else if (bar.date) {
      time = bar.date;
    } else {
      return null;
    }
    return {
      time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume || 0,
    };
  }).filter(Boolean);
};

// ─── Orders ──────────────────────────────────────────────────

export const placeNewOrder = async (accountId, contract, order) => {
  if (!ib || !connected) throw new Error('Not connected');
  const orderId = nextOrderId++;
  ib.placeOrder(orderId, contract, order);
  return { orderId, status: 'submitted' };
};

export const getStatus = () => ({
  connected,
  nextOrderId,
  activeSubscriptions: marketDataSubscriptions.size,
});
