import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createChart, CrosshairMode, LineStyle } from "lightweight-charts";
import { getQuote } from "@/components/api/marketDataClient";
import { useLivePrices } from "@/hooks/useLivePrices";
import {
  ibkrConfig,
  connectToGateway,
  disconnectFromGateway,
  getConnectionStatus,
  getAccounts,
  getAccountSummary,
  getPositions,
  searchContract,
  getMarketSnapshot,
  getHistoricalData,
  subscribeMarketData,
  parseSnapshotToQuote,
  parseHistoryToCandles,
  parseTickUpdate,
  unsubscribeAll,
} from "@/components/api/ibkrClient";
import {
  alpacaConfig,
  connectAlpaca,
  disconnectAlpaca,
  getAlpacaStatus,
  getAlpacaAccount,
  getAlpacaPositions,
  getAlpacaSnapshot,
  getAlpacaBars,
  searchAlpacaAsset,
  subscribeAlpacaQuotes,
  parseAlpacaQuote,
  parseAlpacaBars,
  parseAlpacaTick,
} from "@/components/api/alpacaClient";
import {
  Search, Brain, RefreshCw, Loader2, BarChart3,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, X,
  Maximize2, Minimize2, Layers, Settings, TrendingUp,
  Minus, Circle, Square, Triangle, Hash, Type,
  ArrowRight, Crosshair, MousePointer, Ruler, Percent,
  PenTool, Move, Trash2, Eye, EyeOff,
  Magnet, Camera, RotateCcw, ChevronLeft, ChevronRight,
  Activity, LineChart, BarChart2,
  Star, Plus, Volume2, Clock, Calendar, Globe, Info,
  Link2, Unlink2, Zap, CheckCircle2, AlertCircle, Wifi, WifiOff, Key
} from "lucide-react";
import {
  calcEMA, calcSMA, calcRSI, calcMACD, calcBollingerBands,
  calcStochastic, toHeikinAshi
} from "@/components/charts/indicatorUtils";

// ═══════════════════════════════════════════════════════════════
// MARKET DATA
// ═══════════════════════════════════════════════════════════════
const SAUDI_SECTORS = [
  { sector: "المؤشرات", items: [{ symbol: "TASI", name: "تاسي" }, { symbol: "MI30", name: "ام آي 30" }, { symbol: "TFNI", name: "تفني" }] },
  { sector: "الطاقة والصناعة", items: [{ symbol: "2222", name: "أرامكو" }, { symbol: "2010", name: "سابك" }, { symbol: "2030", name: "سابك للبتر." }, { symbol: "2380", name: "بترو رابغ" }, { symbol: "2381", name: "الحفر العربية" }, { symbol: "2382", name: "أديس" }] },
  { sector: "البنوك", items: [{ symbol: "1120", name: "الراجحي" }, { symbol: "1180", name: "الأهلي" }, { symbol: "1010", name: "الرياض" }, { symbol: "1020", name: "الجزيرة" }, { symbol: "1060", name: "البلاد" }, { symbol: "1150", name: "البنك الأهلي" }, { symbol: "1140", name: "التنمية" }] },
  { sector: "الاتصالات", items: [{ symbol: "7010", name: "الاتصالات" }, { symbol: "7020", name: "موبايلي" }, { symbol: "7030", name: "زين" }] },
  { sector: "الأسمنت", items: [{ symbol: "3010", name: "أسمنت يني" }, { symbol: "3020", name: "أسمنت الشرق" }, { symbol: "3030", name: "الحفر" }, { symbol: "3040", name: "أسمنت أم" }, { symbol: "3050", name: "الجنوبية" }] },
  { sector: "المواد الأساسية", items: [{ symbol: "1211", name: "معادن" }, { symbol: "2060", name: "التصنيع" }, { symbol: "2090", name: "جبسكو" }] },
  { sector: "التشييد والبناء", items: [{ symbol: "1301", name: "أملاك" }, { symbol: "1304", name: "الدار العقارية" }] },
  { sector: "النقل", items: [{ symbol: "1320", name: "أنابيب السعودية" }, { symbol: "1321", name: "أنابيب الشرق" }] },
  { sector: "الكيماويات", items: [{ symbol: "2001", name: "كيماويات" }, { symbol: "2020", name: "ساف" }, { symbol: "2210", name: "نماء" }] },
  { sector: "التجزئة", items: [{ symbol: "4001", name: "أسواق" }, { symbol: "4003", name: "إكسترا" }, { symbol: "4190", name: "جرير" }] },
];

const US_STOCKS = [
  { symbol: "SPX", name: "S&P 500" }, { symbol: "NDX", name: "ناسداك" }, { symbol: "DJI", name: "داو جونز" },
  { symbol: "AAPL", name: "Apple" }, { symbol: "MSFT", name: "Microsoft" }, { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "TSLA", name: "Tesla" }, { symbol: "AMZN", name: "Amazon" }, { symbol: "META", name: "Meta" },
  { symbol: "GOOGL", name: "Alphabet" }, { symbol: "AMD", name: "AMD" }, { symbol: "NFLX", name: "Netflix" },
  { symbol: "JPM", name: "JPMorgan" }, { symbol: "V", name: "Visa" }, { symbol: "BAC", name: "Bank of America" },
  { symbol: "WMT", name: "Walmart" }, { symbol: "DIS", name: "Disney" }, { symbol: "INTC", name: "Intel" },
  { symbol: "COIN", name: "Coinbase" }, { symbol: "PLTR", name: "Palantir" },
];

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
// Candle interval (size of each candle) — independent from range
const INTERVALS = [
  { label: "1د", value: "1M", interval: "1min" },
  { label: "5د", value: "5M", interval: "5min" },
  { label: "15د", value: "15M", interval: "15min" },
  { label: "30د", value: "30M", interval: "30min" },
  { label: "1س", value: "1H", interval: "60min" },
  { label: "يوم", value: "1D", interval: "daily" },
  { label: "أسبوع", value: "1W", interval: "weekly" },
  { label: "شهر", value: "1MO", interval: "monthly" },
];

// Time range (how far back to look) — fixed, always all options shown
const RANGES = [
  { label: "1ي", value: "1d" },
  { label: "5ي", value: "5d" },
  { label: "شهر", value: "1mo" },
  { label: "3ش", value: "3mo" },
  { label: "6ش", value: "6mo" },
  { label: "سنة", value: "1y" },
  { label: "2س", value: "2y" },
  { label: "5س", value: "5y" },
  { label: "10س", value: "10y" },
  { label: "YTD", value: "ytd" },
  { label: "كل", value: "max" },
];

// Yahoo Finance max range per interval (API hard limits)
// 1m→7d, 5m→60d, 15m→60d, 30m→60d, 60m→730d, daily/weekly/monthly→unlimited
const MAX_RANGE_FOR_INTERVAL = {
  '1min': ['1d', '5d'],
  '5min': ['1d', '5d', '1mo'],
  '15min': ['1d', '5d', '1mo'],
  '30min': ['1d', '5d', '1mo'],
  '60min': ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', 'ytd'],
  'daily': null, // all ranges
  'weekly': null,
  'monthly': null,
};

// Given a range, find the smallest interval that supports it
const RANGE_ORDER = ['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','ytd','max'];
function bestIntervalForRange(range) {
  if (!range) return null;
  const ri = RANGE_ORDER.indexOf(range);
  // ytd can be anything from a few days to 12 months
  if (ri <= 1) return null;                 // 1d, 5d → any interval works
  if (ri <= 3 || range === 'ytd') return '60min'; // 1mo, 3mo, ytd → at least 60min
  if (ri <= 5) return '60min';             // 6mo, 1y → 60min (730d limit)
  if (ri <= 6) return '60min';             // 2y → 60min (730d limit)
  return 'daily';                           // 5y, 10y, max → must be daily+
}

// Check if interval supports the given range
function isIntervalCompatible(interval, range) {
  if (!range) return true;
  const allowed = MAX_RANGE_FOR_INTERVAL[interval];
  if (allowed === null) return true; // daily, weekly, monthly support all ranges
  return allowed.includes(range);
}

const CHART_TYPES = [
  { value: "candlestick", label: "شموع يابانية" },
  { value: "heikinashi", label: "هيكن آشي" },
  { value: "line", label: "خطي" },
  { value: "area", label: "مساحة" },
  { value: "bar", label: "OHLC" },
];

const C = {
  bg: "#0c0e14", card: "#131722", surface: "#1e222d", border: "#2a2e39",
  up: "#26a69a", down: "#ef5350", gold: "#d4a843",
  text: "#d1d4dc", dim: "#787b86", muted: "#434651",
  blue: "#2962ff", purple: "#7b2ff7", orange: "#ff9800",
};

const DRAWING_TOOLS = [
  { id: "cursor", icon: MousePointer, label: "مؤشر", group: "pointer" },
  { id: "crosshair", icon: Crosshair, label: "تقاطع", group: "pointer" },
  { id: "trendline", icon: TrendingUp, label: "خط اتجاه", group: "lines" },
  { id: "horizontal", icon: Minus, label: "خط أفقي", group: "lines" },
  { id: "ray", icon: ArrowRight, label: "شعاع", group: "lines" },
  { id: "fib", icon: Percent, label: "فيبوناتشي", group: "fib" },
  { id: "rect", icon: Square, label: "مستطيل", group: "shapes" },
  { id: "circle", icon: Circle, label: "دائرة", group: "shapes" },
  { id: "triangle", icon: Triangle, label: "مثلث", group: "shapes" },
  { id: "text", icon: Type, label: "نص", group: "text" },
  { id: "note", icon: Hash, label: "ملاحظة", group: "text" },
  { id: "measure", icon: Ruler, label: "قياس", group: "measure" },
  { id: "pen", icon: PenTool, label: "رسم حر", group: "draw" },
];

const chartOpts = (container) => ({
  layout: { background: { color: C.card }, textColor: C.dim, fontFamily: "'Tajawal', sans-serif", fontSize: 11, attributionLogo: false },
  watermark: { visible: false },
  grid: { vertLines: { color: "#1e222d40" }, horzLines: { color: "#1e222d40" } },
  width: container.clientWidth,
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: "rgba(42,46,57,0.8)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: C.surface },
    horzLine: { color: "rgba(42,46,57,0.8)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: C.surface },
  },
  timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 8 },
  rightPriceScale: { borderColor: C.border, textColor: C.dim, scaleMargins: { top: 0.05, bottom: 0.18 } },
  handleScale: { axisPressedMouseMove: { time: true, price: true } },
  handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
});

// Remove TradingView attribution logo/link from a chart container
const removeTVLogo = (container) => {
  if (!container) return;
  const remove = () => {
    container.querySelectorAll('a[href*="tradingview"], #tv-attr-logo, [id*="tv-attr"]').forEach(el => el.remove());
    container.querySelectorAll('style').forEach(el => { if (el.innerText?.includes('tv-attr')) el.remove(); });
  };
  remove();
  // MutationObserver to catch dynamically added logos
  const obs = new MutationObserver(remove);
  obs.observe(container, { childList: true, subtree: true });
  return () => obs.disconnect();
};

const calcVWAP = (data) => {
  let cumVP = 0, cumVol = 0;
  return data.map(c => {
    const tp = (c.high + c.low + c.close) / 3;
    cumVP += tp * (c.volume || 0);
    cumVol += (c.volume || 0);
    return { time: c.time, value: cumVol > 0 ? parseFloat((cumVP / cumVol).toFixed(4)) : tp };
  });
};

const formatVol = (v) => {
  if (!v) return "-";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return v.toString();
};

// ═══════════════════════════════════════════════════════════════
// IBKR CONNECTION PANEL
// ═══════════════════════════════════════════════════════════════
function IbkrConnectionPanel({ ibkrState, setIbkrState, onClose }) {
  const savedConfig = ibkrConfig.getConfig();
  const [host, setHost] = useState(savedConfig?.host || '127.0.0.1');
  const [port, setPort] = useState(savedConfig?.port || 4001);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountSummary, setAccountSummary] = useState(null);
  const [positions, setPositions] = useState([]);

  const doConnect = async () => {
    setChecking(true);
    setError('');
    try {
      const result = await connectToGateway(host, Number(port), 0);
      if (result.connected) {
        ibkrConfig.saveConfig({ host, port: Number(port), connected: true });
        setIbkrState(prev => ({ ...prev, connected: true, authenticated: true }));
        // Wait a moment for managedAccounts event
        await new Promise(r => setTimeout(r, 1500));
        try {
          const accts = await getAccounts();
          const acctList = Array.isArray(accts) ? accts : [];
          setAccounts(acctList);
          setIbkrState(prev => ({ ...prev, accounts: acctList }));
          if (acctList.length > 0) {
            const selectedAcct = acctList[0]?.id;
            setIbkrState(prev => ({ ...prev, selectedAccount: selectedAcct }));
            try {
              const summary = await getAccountSummary(selectedAcct);
              setAccountSummary(summary);
            } catch {}
            try {
              const pos = await getPositions();
              setPositions(Array.isArray(pos) ? pos : []);
            } catch {}
          }
        } catch {}
      }
    } catch (err) {
      setError('تعذر الاتصال بـ IB Gateway. تأكد من تشغيله على المنفذ ' + port);
    }
    setChecking(false);
  };

  const doDisconnect = async () => {
    try { await disconnectFromGateway(); } catch {}
    ibkrConfig.clearConfig();
    setIbkrState({ connected: false, authenticated: false, accounts: [], selectedAccount: null, useIbkr: false, conidCache: {} });
    setAccounts([]);
    setAccountSummary(null);
    setPositions([]);
  };

  const toggleDataSource = () => {
    setIbkrState(prev => ({ ...prev, useIbkr: !prev.useIbkr }));
  };

  return (
    <div className="absolute top-2 right-14 w-[320px] bg-[#131722]/98 border border-[#2a2e39] rounded-lg shadow-2xl z-30 backdrop-blur-xl overflow-hidden" dir="rtl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2e39] bg-[#1e222d]">
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-[#ff9800]" />
          <span className="text-xs font-bold text-[#ff9800]">Interactive Brokers</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[#2a2e39] rounded text-[#787b86] transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
        {/* Connection Status */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${ibkrState.connected ? 'bg-[#26a69a]/10 border-[#26a69a]/30' : 'bg-[#ef5350]/10 border-[#ef5350]/30'}`}>
          {ibkrState.connected ? <Wifi className="w-4 h-4 text-[#26a69a]" /> : <WifiOff className="w-4 h-4 text-[#ef5350]" />}
          <span className={`text-xs font-bold ${ibkrState.connected ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
            {ibkrState.connected ? 'متصل بـ IB Gateway' : 'غير متصل'}
          </span>
        </div>

        {/* Connection Settings */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-[#787b86] font-bold">عنوان IP</label>
              <input
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="127.0.0.1"
                className="w-full bg-[#0c0e14] border border-[#2a2e39] rounded px-3 py-1.5 text-[11px] text-[#d1d4dc] placeholder-[#434651] outline-none focus:border-[#ff9800]/50 transition-colors font-mono"
                dir="ltr"
              />
            </div>
            <div className="w-[90px] space-y-1">
              <label className="text-[10px] text-[#787b86] font-bold">المنفذ</label>
              <select
                value={port}
                onChange={e => setPort(Number(e.target.value))}
                className="w-full bg-[#0c0e14] border border-[#2a2e39] rounded px-2 py-1.5 text-[11px] text-[#d1d4dc] outline-none focus:border-[#ff9800]/50 transition-colors font-mono"
              >
                <option value={4001}>4001 حي</option>
                <option value={4002}>4002 ورقي</option>
                <option value={7496}>7496 TWS حي</option>
                <option value={7497}>7497 TWS ورقي</option>
              </select>
            </div>
          </div>
        </div>

        {/* Connect / Disconnect buttons */}
        {!ibkrState.connected ? (
          <button onClick={doConnect} disabled={checking}
            className="w-full py-2 text-[11px] font-bold text-white bg-[#ff9800] rounded-lg hover:bg-[#f57c00] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            {checking ? 'جاري الاتصال...' : 'اتصل بـ IB Gateway'}
          </button>
        ) : (
          <div className="space-y-2">
            {/* Data source toggle */}
            <div className="flex items-center justify-between bg-[#0c0e14] rounded-lg p-2.5 cursor-pointer" onClick={toggleDataSource}>
              <span className="text-[11px] text-[#d1d4dc]">استخدام بيانات IBKR</span>
              <div className={`w-9 h-[20px] rounded-full transition-all relative ${ibkrState.useIbkr ? 'bg-[#ff9800]' : 'bg-[#434651]'}`}>
                <span className={`absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full transition-all shadow-sm ${ibkrState.useIbkr ? 'right-[2px]' : 'left-[2px]'}`} />
              </div>
            </div>

            {/* Account info */}
            {accounts.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-[#787b86]">الحسابات</div>
                {accounts.map((acct, i) => (
                  <div key={i} className={`px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${
                    ibkrState.selectedAccount === acct.id
                      ? 'bg-[#ff9800]/10 border-[#ff9800]/30'
                      : 'bg-[#0c0e14] border-[#2a2e39] hover:border-[#434651]'
                  }`} onClick={() => setIbkrState(prev => ({ ...prev, selectedAccount: acct.id }))}>
                    <span className="text-[11px] font-bold text-[#d1d4dc] font-mono">{acct.id}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Account summary */}
            {accountSummary && (
              <div className="space-y-0">
                <div className="text-[10px] font-bold text-[#787b86] mb-1">ملخص الحساب</div>
                {Object.entries(accountSummary).map(([tag, info], i) => (
                  <div key={i} className="flex justify-between py-1 border-b border-[#2a2e39]/50">
                    <span className="text-[10px] text-[#787b86]">{tag}</span>
                    <span className="text-[10px] font-bold text-[#d1d4dc]">{info.currency} {Number(info.value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Positions */}
            {positions.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-[#787b86]">المراكز المفتوحة ({positions.length})</div>
                <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                  {positions.map((pos, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-[#0c0e14] text-[10px]">
                      <div>
                        <span className="font-bold text-[#d1d4dc]">{pos.contract?.symbol || '?'}</span>
                        <span className="text-[#787b86] mr-1">×{pos.position}</span>
                      </div>
                      <span className="text-[#787b86] font-mono">{pos.avgCost?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={doDisconnect}
              className="w-full py-2 text-[11px] font-bold text-[#ef5350] border border-[#ef5350]/30 rounded-lg hover:bg-[#ef5350]/10 transition-all flex items-center justify-center gap-2">
              <Unlink2 className="w-3.5 h-3.5" /> قطع الاتصال
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-[#ef5350]/10 border border-[#ef5350]/20">
            <AlertCircle className="w-3.5 h-3.5 text-[#ef5350] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#ef5350] leading-relaxed">{error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-[#0c0e14] rounded-lg p-2.5 space-y-1.5 border border-[#2a2e39]/50">
          <p className="text-[10px] font-bold text-[#787b86]">خطوات الإعداد:</p>
          <ol className="text-[9px] text-[#787b86] space-y-1 list-decimal pr-4 leading-relaxed">
            <li>قم بتشغيل <span className="text-[#ff9800] font-bold">IB Gateway</span></li>
            <li>اختر <span className="text-[#ff9800] font-bold">IB API</span> وسجّل الدخول</li>
            <li>المنفذ: 4001 (تداول حي) أو 4002 (تداول ورقي)</li>
            <li>ارجع هنا واضغط "اتصل بـ IB Gateway"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ALPACA CONNECTION PANEL
// ═══════════════════════════════════════════════════════════════
function AlpacaConnectionPanel({ alpacaState, setAlpacaState, onClose }) {
  const savedConfig = alpacaConfig.getConfig();
  const [apiKey, setApiKey] = useState(savedConfig?.apiKey || '');
  const [secretKey, setSecretKey] = useState(savedConfig?.secretKey || '');
  const [paper, setPaper] = useState(savedConfig?.paper !== false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);

  const doConnect = async () => {
    setChecking(true);
    setError('');
    try {
      const result = await connectAlpaca(apiKey, secretKey, paper);
      if (result.connected) {
        alpacaConfig.saveConfig({ apiKey, secretKey, paper, connected: true });
        setAlpacaState(prev => ({ ...prev, connected: true, useAlpaca: true }));
        try {
          const acct = await getAlpacaAccount();
          setAccount(acct);
          setAlpacaState(prev => ({ ...prev, accountId: acct.id }));
        } catch {}
        try {
          const pos = await getAlpacaPositions();
          setPositions(Array.isArray(pos) ? pos : []);
        } catch {}
      }
    } catch (err) {
      setError('مفاتيح API غير صحيحة أو فشل الاتصال');
    }
    setChecking(false);
  };

  const doDisconnect = async () => {
    try { await disconnectAlpaca(); } catch {}
    alpacaConfig.clearConfig();
    setAlpacaState({ connected: false, useAlpaca: false, accountId: null });
    setAccount(null);
    setPositions([]);
  };

  const toggleDataSource = () => {
    setAlpacaState(prev => ({ ...prev, useAlpaca: !prev.useAlpaca }));
  };

  return (
    <div className="absolute top-2 right-14 w-[320px] bg-[#131722]/98 border border-[#2a2e39] rounded-lg shadow-2xl z-30 backdrop-blur-xl overflow-hidden" dir="rtl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2e39] bg-[#1e222d]">
        <div className="flex items-center gap-1.5">
          <Key className="w-4 h-4 text-[#ffeb3b]" />
          <span className="text-xs font-bold text-[#ffeb3b]">Alpaca Markets</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[#2a2e39] rounded text-[#787b86] transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
        {/* Connection Status */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${alpacaState.connected ? 'bg-[#26a69a]/10 border-[#26a69a]/30' : 'bg-[#ef5350]/10 border-[#ef5350]/30'}`}>
          {alpacaState.connected ? <Wifi className="w-4 h-4 text-[#26a69a]" /> : <WifiOff className="w-4 h-4 text-[#ef5350]" />}
          <span className={`text-xs font-bold ${alpacaState.connected ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
            {alpacaState.connected ? (paper ? 'متصل (ورقي)' : 'متصل (حقيقي)') : 'غير متصل'}
          </span>
        </div>

        {/* API Keys */}
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-[10px] text-[#787b86] font-bold">API Key</label>
            <input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="PK..."
              className="w-full bg-[#0c0e14] border border-[#2a2e39] rounded px-3 py-1.5 text-[11px] text-[#d1d4dc] placeholder-[#434651] outline-none focus:border-[#ffeb3b]/50 transition-colors font-mono"
              dir="ltr"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-[#787b86] font-bold">Secret Key</label>
            <input
              type="password"
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#0c0e14] border border-[#2a2e39] rounded px-3 py-1.5 text-[11px] text-[#d1d4dc] placeholder-[#434651] outline-none focus:border-[#ffeb3b]/50 transition-colors font-mono"
              dir="ltr"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center justify-between bg-[#0c0e14] rounded-lg p-2 cursor-pointer" onClick={() => setPaper(!paper)}>
            <span className="text-[11px] text-[#d1d4dc]">تداول ورقي (Paper)</span>
            <div className={`w-9 h-[20px] rounded-full transition-all relative ${paper ? 'bg-[#ffeb3b]' : 'bg-[#434651]'}`}>
              <span className={`absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full transition-all shadow-sm ${paper ? 'right-[2px]' : 'left-[2px]'}`} />
            </div>
          </div>
        </div>

        {/* Connect / Disconnect */}
        {!alpacaState.connected ? (
          <button onClick={doConnect} disabled={checking || !apiKey || !secretKey}
            className="w-full py-2 text-[11px] font-bold text-[#131722] bg-[#ffeb3b] rounded-lg hover:bg-[#fdd835] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            {checking ? 'جاري الاتصال...' : 'اتصل بـ Alpaca'}
          </button>
        ) : (
          <div className="space-y-2">
            {/* Data source toggle */}
            <div className="flex items-center justify-between bg-[#0c0e14] rounded-lg p-2.5 cursor-pointer" onClick={toggleDataSource}>
              <span className="text-[11px] text-[#d1d4dc]">استخدام بيانات Alpaca</span>
              <div className={`w-9 h-[20px] rounded-full transition-all relative ${alpacaState.useAlpaca ? 'bg-[#ffeb3b]' : 'bg-[#434651]'}`}>
                <span className={`absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full transition-all shadow-sm ${alpacaState.useAlpaca ? 'right-[2px]' : 'left-[2px]'}`} />
              </div>
            </div>

            {/* Account info */}
            {account && (
              <div className="space-y-0">
                <div className="text-[10px] font-bold text-[#787b86] mb-1">معلومات الحساب</div>
                <div className="flex justify-between py-1 border-b border-[#2a2e39]/50">
                  <span className="text-[10px] text-[#787b86]">رقم الحساب</span>
                  <span className="text-[10px] font-bold text-[#d1d4dc] font-mono">{account.account_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2a2e39]/50">
                  <span className="text-[10px] text-[#787b86]">القوة الشرائية</span>
                  <span className="text-[10px] font-bold text-[#26a69a]">$ {Number(account.buying_power).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2a2e39]/50">
                  <span className="text-[10px] text-[#787b86]">القيمة الإجمالية</span>
                  <span className="text-[10px] font-bold text-[#d1d4dc]">$ {Number(account.equity).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2a2e39]/50">
                  <span className="text-[10px] text-[#787b86]">النقد المتاح</span>
                  <span className="text-[10px] font-bold text-[#d1d4dc]">$ {Number(account.cash).toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Positions */}
            {positions.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-[#787b86]">المراكز المفتوحة ({positions.length})</div>
                <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                  {positions.map((pos, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-[#0c0e14] text-[10px]">
                      <div>
                        <span className="font-bold text-[#d1d4dc]">{pos.symbol}</span>
                        <span className="text-[#787b86] mr-1">×{pos.qty}</span>
                      </div>
                      <div className="text-left">
                        <span className={`font-mono ${Number(pos.unrealized_pl) >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                          {Number(pos.unrealized_pl) >= 0 ? '+' : ''}{Number(pos.unrealized_pl).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={doDisconnect}
              className="w-full py-2 text-[11px] font-bold text-[#ef5350] border border-[#ef5350]/30 rounded-lg hover:bg-[#ef5350]/10 transition-all flex items-center justify-center gap-2">
              <Unlink2 className="w-3.5 h-3.5" /> قطع الاتصال
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-[#ef5350]/10 border border-[#ef5350]/20">
            <AlertCircle className="w-3.5 h-3.5 text-[#ef5350] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#ef5350] leading-relaxed">{error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-[#0c0e14] rounded-lg p-2.5 space-y-1.5 border border-[#2a2e39]/50">
          <p className="text-[10px] font-bold text-[#787b86]">خطوات الإعداد:</p>
          <ol className="text-[9px] text-[#787b86] space-y-1 list-decimal pr-4 leading-relaxed">
            <li>سجّل في <span className="text-[#ffeb3b] font-bold">alpaca.markets</span></li>
            <li>اذهب إلى <span className="text-[#ffeb3b] font-bold">API Keys</span> في لوحة التحكم</li>
            <li>أنشئ مفتاح API جديد</li>
            <li>انسخ API Key و Secret Key هنا</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI ANALYSIS PANEL
// ═══════════════════════════════════════════════════════════════
function AiPanel({ symbol, market, candles, onClose }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!symbol || candles.length === 0) return;
    analyze();
  }, [symbol]);

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    if (!candles || candles.length < 14) {
      setResult({ _unavailable: true });
      setLoading(false);
      return;
    }

    const last30 = candles.slice(-30);
    const latest = candles[candles.length - 1];

    // Calculate indicators
    const rsiData = calcRSI(candles, 14);
    const rsiValue = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : 50;
    const macdResult = calcMACD(candles);
    const lastMacd = macdResult.macdLine.length > 0 ? macdResult.macdLine[macdResult.macdLine.length - 1].value : 0;
    const lastSignal = macdResult.signalLine.length > 0 ? macdResult.signalLine[macdResult.signalLine.length - 1].value : 0;
    const lastHist = macdResult.histogram.length > 0 ? macdResult.histogram[macdResult.histogram.length - 1].value : 0;
    const sma20 = calcSMA(candles, 20);
    const sma50 = calcSMA(candles, Math.min(50, candles.length));
    const lastSma20 = sma20.length > 0 ? sma20[sma20.length - 1].value : latest.close;
    const lastSma50 = sma50.length > 0 ? sma50[sma50.length - 1].value : latest.close;

    // Trend detection
    const aboveSma20 = latest.close > lastSma20;
    const aboveSma50 = latest.close > lastSma50;
    const sma20Above50 = lastSma20 > lastSma50;

    let trend, trend_reason;
    if (aboveSma20 && aboveSma50 && sma20Above50) {
      trend = "صاعد قوي ↑↑";
      trend_reason = "السعر فوق SMA20 و SMA50 والمتوسط القصير فوق الطويل";
    } else if (aboveSma20 && aboveSma50) {
      trend = "صاعد ↑";
      trend_reason = "السعر فوق المتوسطات المتحركة الرئيسية";
    } else if (!aboveSma20 && !aboveSma50 && !sma20Above50) {
      trend = "هابط قوي ↓↓";
      trend_reason = "السعر تحت SMA20 و SMA50 والمتوسط القصير تحت الطويل";
    } else if (!aboveSma20 && !aboveSma50) {
      trend = "هابط ↓";
      trend_reason = "السعر تحت المتوسطات المتحركة";
    } else {
      trend = "محايد ↔";
      trend_reason = "إشارات مختلطة بين المتوسطات المتحركة";
    }

    // Support & Resistance
    const support = Math.min(...last30.map(c => c.low));
    const resistance = Math.max(...last30.map(c => c.high));

    // Scoring system
    let score = 0;
    if (rsiValue < 30) score += 2;
    else if (rsiValue > 70) score -= 2;
    else if (rsiValue < 45) score += 0.5;
    else if (rsiValue > 55) score -= 0.5;
    if (lastMacd > lastSignal) score += 1;
    else score -= 1;
    if (lastHist > 0) score += 0.5;
    else score -= 0.5;
    if (aboveSma20) score += 1;
    else score -= 1;
    if (aboveSma50) score += 1;
    else score -= 1;
    // Volume analysis
    const vols = candles.slice(-10).map(c => c.volume || 0);
    const avgVol = vols.reduce((a, b) => a + b, 0) / (vols.length || 1);
    const latVol = latest.volume || 0;
    if (latVol > avgVol * 1.5 && latest.close > latest.open) score += 1;
    else if (latVol > avgVol * 1.5 && latest.close < latest.open) score -= 1;

    let recommendation, momentum, risk_level;
    if (score >= 3) { recommendation = "شراء قوي"; momentum = "إيجابي قوي"; risk_level = "منخفض"; }
    else if (score >= 1) { recommendation = "شراء"; momentum = "إيجابي"; risk_level = "متوسط"; }
    else if (score <= -3) { recommendation = "بيع قوي"; momentum = "سلبي قوي"; risk_level = "منخفض"; }
    else if (score <= -1) { recommendation = "بيع"; momentum = "سلبي"; risk_level = "متوسط"; }
    else { recommendation = "انتظار"; momentum = "محايد"; risk_level = "عالي"; }

    const entry_point = score > 0 ? support * 1.005 : null;
    const exit_point = score > 0 ? resistance * 0.995 : null;
    const confidence = Math.min(92, Math.max(25, 50 + Math.abs(score) * 9));

    let note;
    if (rsiValue > 70) note = "⚠️ RSI في منطقة ذروة الشراء — احذر من التصحيح";
    else if (rsiValue < 30) note = "💡 RSI في منطقة ذروة البيع — فرصة شراء محتملة";
    else if (lastMacd > lastSignal && lastHist > 0) note = "📈 تقاطع MACD إيجابي يدعم الاتجاه الصاعد";
    else if (lastMacd < lastSignal && lastHist < 0) note = "📉 تقاطع MACD سلبي يدعم الاتجاه الهابط";
    else note = "📊 راقب مستويات الدعم والمقاومة القريبة";

    setResult({ recommendation, trend, trend_reason, support, resistance, entry_point, exit_point, momentum, risk_level, confidence, note });
    setLoading(false);
  };

  const recColor = result?.recommendation?.includes("شراء") ? C.up
    : result?.recommendation?.includes("بيع") ? C.down : C.gold;
  const riskColor = result?.risk_level?.includes("عالي") ? C.down
    : result?.risk_level?.includes("منخفض") ? C.up : C.gold;

  return (
    <div className="absolute top-2 left-14 w-[280px] bg-[#131722]/98 border border-[#2a2e39] rounded-lg shadow-2xl z-30 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2e39] bg-[#1e222d]">
        <div className="flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-[#d4a843]" />
          <span className="text-xs font-bold text-[#d4a843]">تحليل الذكاء الاصطناعي</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[#2a2e39] rounded text-[#787b86] transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="p-3 space-y-2 max-h-[65vh] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <Loader2 className="w-7 h-7 text-[#d4a843] animate-spin" />
            <span className="text-xs text-[#787b86]">يحلل البيانات الفنية...</span>
          </div>
        ) : result?._unavailable ? (
          <div className="flex flex-col items-center py-8 gap-2 text-center">
            <Brain className="w-7 h-7 text-[#434651]" />
            <p className="text-xs text-[#787b86]">تحليل الذكاء الاصطناعي غير متاح</p>
          </div>
        ) : result ? (
          <>
            <div className="flex items-center justify-between bg-[#0c0e14] rounded-lg p-2.5">
              <span className="text-[10px] text-[#787b86]">التوصية</span>
              <span className="text-sm font-black px-3 py-0.5 rounded-full" style={{ color: recColor, backgroundColor: `${recColor}15`, border: `1px solid ${recColor}40` }}>
                {result.recommendation}
              </span>
            </div>
            <div className="bg-[#0c0e14] rounded-lg p-2.5">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] text-[#787b86]">الاتجاه</span>
                <span className="text-xs font-bold text-[#d1d4dc]">{result.trend}</span>
              </div>
              {result.trend_reason && <p className="text-[9px] text-[#787b86] leading-relaxed">{result.trend_reason}</p>}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-[#26a69a]/10 border border-[#26a69a]/20 rounded-lg p-2 text-center">
                <p className="text-[8px] text-[#787b86]">دعم</p>
                <p className="text-xs font-bold text-[#26a69a]">{result.support?.toFixed(2)}</p>
              </div>
              <div className="bg-[#ef5350]/10 border border-[#ef5350]/20 rounded-lg p-2 text-center">
                <p className="text-[8px] text-[#787b86]">مقاومة</p>
                <p className="text-xs font-bold text-[#ef5350]">{result.resistance?.toFixed(2)}</p>
              </div>
              {result.entry_point && (
                <div className="bg-[#2962ff]/10 border border-[#2962ff]/20 rounded-lg p-2 text-center">
                  <p className="text-[8px] text-[#787b86]">نقطة الدخول</p>
                  <p className="text-xs font-bold text-[#2962ff]">{result.entry_point?.toFixed(2)}</p>
                </div>
              )}
              {result.exit_point && (
                <div className="bg-[#7b2ff7]/10 border border-[#7b2ff7]/20 rounded-lg p-2 text-center">
                  <p className="text-[8px] text-[#787b86]">نقطة الخروج</p>
                  <p className="text-xs font-bold text-[#7b2ff7]">{result.exit_point?.toFixed(2)}</p>
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              {result.momentum && (
                <div className="flex-1 bg-[#0c0e14] rounded-lg p-2 text-center">
                  <p className="text-[8px] text-[#787b86]">الزخم</p>
                  <p className="text-[10px] font-bold text-[#d1d4dc]">{result.momentum}</p>
                </div>
              )}
              {result.risk_level && (
                <div className="flex-1 bg-[#0c0e14] rounded-lg p-2 text-center">
                  <p className="text-[8px] text-[#787b86]">المخاطرة</p>
                  <p className="text-[10px] font-bold" style={{ color: riskColor }}>{result.risk_level}</p>
                </div>
              )}
            </div>
            {result.confidence != null && (
              <div className="bg-[#0c0e14] rounded-lg p-2">
                <div className="flex justify-between mb-1">
                  <span className="text-[9px] text-[#787b86]">ثقة التحليل</span>
                  <span className="text-[9px] text-[#d1d4dc] font-bold">{result.confidence}%</span>
                </div>
                <div className="h-1.5 bg-[#2a2e39] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${result.confidence}%`, background: `linear-gradient(90deg, ${C.gold}, #f59e0b)` }} />
                </div>
              </div>
            )}
            {result.note && (
              <div className="bg-[#d4a843]/5 border border-[#d4a843]/15 rounded-lg p-2">
                <p className="text-[10px] text-[#d1d4dc] leading-relaxed">💡 {result.note}</p>
              </div>
            )}
            <button onClick={analyze} className="w-full py-2 text-[10px] font-bold text-[#d4a843] border border-[#d4a843]/30 rounded-lg hover:bg-[#d4a843]/10 transition-all flex items-center justify-center gap-1.5">
              <RefreshCw className="w-3 h-3" /> إعادة التحليل
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DRAWING TOOLS SIDEBAR (LEFT - TradingView style)
// ═══════════════════════════════════════════════════════════════
function DrawingToolbar({ activeTool, setActiveTool, onClearAll, onUndo }) {
  const groups = {};
  DRAWING_TOOLS.forEach(t => {
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group].push(t);
  });

  return (
    <div className="w-[42px] shrink-0 bg-[#131722] border-r border-[#2a2e39] flex flex-col items-center py-1 gap-0.5 overflow-y-auto custom-scrollbar">
      {Object.entries(groups).map(([group, tools], gi) => (
        <React.Fragment key={group}>
          {gi > 0 && <div className="w-6 h-px bg-[#2a2e39] my-0.5" />}
          {tools.map(tool => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(isActive ? "cursor" : tool.id)}
                className={`w-[34px] h-[34px] flex items-center justify-center rounded transition-all group relative ${
                  isActive
                    ? "bg-[#2962ff]/20 text-[#2962ff]"
                    : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]"
                }`}
                title={tool.label}
              >
                <Icon className="w-[14px] h-[14px]" />
              </button>
            );
          })}
        </React.Fragment>
      ))}

      <div className="flex-1" />
      <div className="w-6 h-px bg-[#2a2e39] my-0.5" />

      <button onClick={onUndo} className="w-[34px] h-[34px] flex items-center justify-center rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-all" title="تراجع">
        <RotateCcw className="w-[14px] h-[14px]" />
      </button>
      <button onClick={onClearAll} className="w-[34px] h-[34px] flex items-center justify-center rounded text-[#787b86] hover:text-[#ef5350] hover:bg-[#ef5350]/10 transition-all" title="مسح الكل">
        <Trash2 className="w-[14px] h-[14px]" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INDICATOR MENU
// ═══════════════════════════════════════════════════════════════
function IndicatorMenu({ overlays, setOverlays, subs, setSubs, onClose }) {
  const toggleOverlay = (key) => setOverlays(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  const toggleSub = (key) => setSubs(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));

  const Toggle = ({ label, color, enabled, onToggle }) => (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#1e222d] transition-colors cursor-pointer" onClick={onToggle}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-[3px] rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[11px] text-[#d1d4dc]">{label}</span>
      </div>
      <div className={`w-8 h-[18px] rounded-full transition-all relative shrink-0 ${enabled ? "bg-[#2962ff]" : "bg-[#434651]"}`}>
        <span className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-all shadow-sm ${enabled ? "right-[2px]" : "left-[2px]"}`} />
      </div>
    </div>
  );

  return (
    <div className="absolute top-full left-0 mt-1 bg-[#131722] border border-[#2a2e39] rounded-lg shadow-2xl z-40 w-72 backdrop-blur-xl overflow-hidden">
      <div className="p-2.5 border-b border-[#2a2e39] flex items-center justify-between bg-[#1e222d]">
        <span className="text-xs font-bold text-[#d1d4dc]">المؤشرات الفنية</span>
        <button onClick={onClose} className="p-0.5 hover:bg-[#2a2e39] rounded text-[#787b86]"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="p-2 space-y-0.5">
        <p className="text-[9px] text-[#787b86] font-bold mb-1 px-2 tracking-wider uppercase">المتوسطات المتحركة</p>
        <Toggle label={`EMA ${overlays.ema9.period}`} color={overlays.ema9.color} enabled={overlays.ema9.enabled} onToggle={() => toggleOverlay("ema9")} />
        <Toggle label={`EMA ${overlays.ema20.period}`} color={overlays.ema20.color} enabled={overlays.ema20.enabled} onToggle={() => toggleOverlay("ema20")} />
        <Toggle label={`SMA ${overlays.sma50.period}`} color={overlays.sma50.color} enabled={overlays.sma50.enabled} onToggle={() => toggleOverlay("sma50")} />
        <Toggle label={`SMA ${overlays.sma200.period}`} color={overlays.sma200.color} enabled={overlays.sma200.enabled} onToggle={() => toggleOverlay("sma200")} />
      </div>
      <div className="p-2 border-t border-[#2a2e39] space-y-0.5">
        <p className="text-[9px] text-[#787b86] font-bold mb-1 px-2 tracking-wider uppercase">الأشرطة والمستويات</p>
        <Toggle label="Bollinger Bands" color={overlays.bb.color} enabled={overlays.bb.enabled} onToggle={() => toggleOverlay("bb")} />
        <Toggle label="VWAP" color={overlays.vwap.color} enabled={overlays.vwap.enabled} onToggle={() => toggleOverlay("vwap")} />
        <Toggle label="Ichimoku" color={overlays.ichimoku.color} enabled={overlays.ichimoku.enabled} onToggle={() => toggleOverlay("ichimoku")} />
      </div>
      <div className="p-2 border-t border-[#2a2e39] space-y-0.5">
        <p className="text-[9px] text-[#787b86] font-bold mb-1 px-2 tracking-wider uppercase">المذبذبات</p>
        <Toggle label={`RSI (${subs.rsi.period})`} color="#7b2ff7" enabled={subs.rsi.enabled} onToggle={() => toggleSub("rsi")} />
        <Toggle label={`MACD (${subs.macd.fast},${subs.macd.slow},${subs.macd.signal})`} color="#2962ff" enabled={subs.macd.enabled} onToggle={() => toggleSub("macd")} />
        <Toggle label={`Stochastic (${subs.stochastic.kPeriod},${subs.stochastic.dPeriod})`} color="#e040fb" enabled={subs.stochastic.enabled} onToggle={() => toggleSub("stochastic")} />
      </div>
      <div className="p-2 border-t border-[#2a2e39] space-y-0.5">
        <p className="text-[9px] text-[#787b86] font-bold mb-1 px-2 tracking-wider uppercase">الحجم</p>
        <Toggle label="حجم التداول" color="#434651" enabled={overlays.volume.enabled} onToggle={() => toggleOverlay("volume")} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STOCK ROW
// ═══════════════════════════════════════════════════════════════
function StockRow({ stock, market, isActive, onSelect, liveQuote, prevQuote }) {
  const [flashClass, setFlashClass] = useState("");
  const flashTimer = useRef(null);

  useEffect(() => {
    if (!liveQuote || !prevQuote) return;
    if (liveQuote.price === prevQuote.price) return;
    const cls = liveQuote.price > prevQuote.price ? "price-flash-up" : "price-flash-down";
    setFlashClass(cls);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashClass(""), 600);
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, [liveQuote?.price]);

  const quote = liveQuote;
  const change = quote?.change_percent;
  const isUp = change >= 0;

  return (
    <button onClick={() => onSelect(stock)}
      className={`w-full flex items-center justify-between px-2.5 py-[7px] text-right transition-all ${flashClass} ${
        isActive ? "bg-[#2962ff]/12 border-r-2 border-r-[#2962ff]" : "hover:bg-[#1e222d] border-r-2 border-r-transparent"}`}>
      <div className="text-right flex-1 min-w-0">
        <div className={`text-[11px] font-bold ${isActive ? "text-[#2962ff]" : "text-[#d1d4dc]"}`}>{stock.symbol}</div>
        <div className="text-[9px] text-[#787b86] truncate">{stock.name}</div>
      </div>
      <div className="text-left ml-1 shrink-0">
        {quote ? (
          <>
            <div className={`text-[11px] font-bold price-value ${isUp ? "text-[#26a69a]" : "text-[#ef5350]"}`}>{quote.price?.toFixed(2)}</div>
            <div className={`text-[9px] font-bold ${isUp ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
              {isUp ? "+" : ""}{(change || 0).toFixed(2)}%
            </div>
          </>
        ) : <div className="w-10 h-5 bg-[#1e222d] rounded animate-pulse" />}
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// RIGHT SIDEBAR (Watchlist + Stock Details)
// ═══════════════════════════════════════════════════════════════
function RightSidebar({ market, selectedStock, onSelect, quote, candles, search, setSearch, handleSelectMarket }) {
  const [tab, setTab] = useState("watchlist");
  const [expanded, setExpanded] = useState(null);

  const sectors = market === "saudi" ? SAUDI_SECTORS : [{ sector: "الأسهم الأمريكية", items: US_STOCKS }];
  const allItems = sectors.flatMap(s => s.items);
  const allSymbols = useMemo(() => allItems.map(s => s.symbol), [market]);
  const { prices: livePrices, prevPrices } = useLivePrices(allSymbols, market);
  const filtered = search ? allItems.filter(s => s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.includes(search)) : null;

  const change = quote?.change_percent;
  const isUp = change >= 0;

  const stats = useMemo(() => {
    if (!candles?.length) return null;
    const last = candles[candles.length - 1];
    const allHighs = candles.map(c => c.high);
    const allLows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume || 0);
    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const high52 = Math.max(...allHighs);
    const low52 = Math.min(...allLows);
    return { dayHigh: last.high, dayLow: last.low, high52, low52, avgVol, open: last.open };
  }, [candles]);

  return (
    <div className="w-[280px] shrink-0 bg-[#131722] border-l border-[#2a2e39] flex flex-col overflow-hidden">
      {/* Market tabs */}
      <div className="flex border-b border-[#2a2e39] shrink-0">
        <button onClick={() => handleSelectMarket("saudi")}
          className={`flex-1 py-2 text-[10px] font-bold transition-all ${market === "saudi" ? "text-[#2962ff] border-b-2 border-b-[#2962ff] bg-[#2962ff]/5" : "text-[#787b86] hover:text-[#d1d4dc]"}`}>
          🇸🇦 السعودي
        </button>
        <button onClick={() => handleSelectMarket("us")}
          className={`flex-1 py-2 text-[10px] font-bold transition-all ${market === "us" ? "text-[#2962ff] border-b-2 border-b-[#2962ff] bg-[#2962ff]/5" : "text-[#787b86] hover:text-[#d1d4dc]"}`}>
          🇺🇸 الأمريكي
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2e39] shrink-0">
        <button onClick={() => setTab("watchlist")}
          className={`flex-1 py-1.5 text-[10px] font-bold transition-all ${tab === "watchlist" ? "text-[#d1d4dc] border-b border-b-[#d1d4dc]" : "text-[#787b86]"}`}>
          متابعة
        </button>
        <button onClick={() => setTab("details")}
          className={`flex-1 py-1.5 text-[10px] font-bold transition-all ${tab === "details" ? "text-[#d1d4dc] border-b border-b-[#d1d4dc]" : "text-[#787b86]"}`}>
          تفاصيل
        </button>
      </div>

      {tab === "watchlist" ? (
        <>
          <div className="flex items-center justify-between px-2 py-1 border-b border-[#2a2e39] bg-[#1e222d]/50 text-[9px] text-[#787b86] shrink-0">
            <span>التغيير %</span>
            <span>آخر سعر</span>
            <span>الرمز</span>
          </div>
          <div className="px-2 py-1.5 border-b border-[#2a2e39] shrink-0">
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#787b86]" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="بحث..."
                className="w-full bg-[#0c0e14] border border-[#2a2e39] rounded pr-7 pl-2 py-1 text-[11px] text-[#d1d4dc] placeholder-[#434651] outline-none focus:border-[#2962ff]/50 transition-colors" dir="rtl" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filtered ? filtered.map(s => (
              <StockRow key={s.symbol} stock={s} market={market} isActive={selectedStock?.symbol === s.symbol} onSelect={onSelect} liveQuote={livePrices[s.symbol]} prevQuote={prevPrices[s.symbol]} />
            )) : sectors.map(sec => (
              <div key={sec.sector}>
                <button onClick={() => setExpanded(expanded === sec.sector ? null : sec.sector)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#1e222d]/50 border-b border-[#2a2e39] text-[10px] font-bold text-[#787b86] hover:text-[#d1d4dc] transition-colors">
                  <ChevronDown className={`w-3 h-3 transition-transform ${expanded === sec.sector ? "rotate-180" : ""}`} />
                  <span>{sec.sector}</span>
                </button>
                {(expanded === sec.sector || expanded === null) && sec.items.map(s => (
                  <StockRow key={s.symbol + sec.sector} stock={s} market={market} isActive={selectedStock?.symbol === s.symbol} onSelect={onSelect} liveQuote={livePrices[s.symbol]} prevQuote={prevPrices[s.symbol]} />
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3" dir="rtl">
          {/* Stock header */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#2962ff]/15 flex items-center justify-center text-[#2962ff] text-xs font-black">
                {selectedStock?.symbol?.substring(0, 2)}
              </div>
              <div>
                <div className="text-sm font-black text-[#d1d4dc]">{selectedStock?.symbol}</div>
                <div className="text-[10px] text-[#787b86]">{selectedStock?.name}</div>
              </div>
            </div>
            {quote && (
              <div className="space-y-0.5">
                <div className="text-2xl font-black text-[#d1d4dc]">{quote.price?.toFixed(2)} <span className="text-xs text-[#787b86]">{quote.currency || (market === "saudi" ? "SAR" : "USD")}</span></div>
                <div className={`text-sm font-bold ${isUp ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
                  {isUp ? "+" : ""}{quote.change?.toFixed(2)} ({isUp ? "+" : ""}{(change || 0).toFixed(2)}%)
                </div>
                <div className="flex items-center justify-center gap-1 text-[10px] text-[#26a69a]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#26a69a] animate-pulse" />
                  السوق مفتوح
                </div>
              </div>
            )}
          </div>

          {/* Range bars */}
          {stats && (
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#787b86]">{stats.dayLow?.toFixed(2)}</span>
                  <span className="text-[9px] text-[#787b86]">نطاق اليوم</span>
                  <span className="text-[#787b86]">{stats.dayHigh?.toFixed(2)}</span>
                </div>
                <div className="h-[4px] bg-[#2a2e39] rounded-full relative overflow-hidden">
                  {quote && stats.dayHigh !== stats.dayLow && (
                    <div className="absolute top-0 h-full w-full rounded-full" style={{ background: "linear-gradient(90deg, #ef5350, #d4a843, #26a69a)" }}>
                      <div className="absolute top-1/2 w-2 h-2 rounded-full bg-white shadow border border-[#2a2e39]"
                        style={{ left: `${Math.max(0, Math.min(100, ((quote.price - stats.dayLow) / (stats.dayHigh - stats.dayLow)) * 100))}%`, transform: "translate(-50%, -50%)" }} />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#787b86]">{stats.low52?.toFixed(2)}</span>
                  <span className="text-[9px] text-[#787b86]">نطاق 52 أسبوع</span>
                  <span className="text-[#787b86]">{stats.high52?.toFixed(2)}</span>
                </div>
                <div className="h-[4px] bg-[#2a2e39] rounded-full relative overflow-hidden">
                  {quote && stats.high52 !== stats.low52 && (
                    <div className="absolute top-0 h-full w-full rounded-full" style={{ background: "linear-gradient(90deg, #ef5350, #d4a843, #26a69a)" }}>
                      <div className="absolute top-1/2 w-2 h-2 rounded-full bg-white shadow border border-[#2a2e39]"
                        style={{ left: `${Math.max(0, Math.min(100, ((quote.price - stats.low52) / (stats.high52 - stats.low52)) * 100))}%`, transform: "translate(-50%, -50%)" }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Key stats */}
          <div className="space-y-0">
            <div className="text-[10px] font-bold text-[#d1d4dc] mb-1.5">الإحصائيات الرئيسية</div>
            {[
              { label: "حجم التداول", value: quote?.volume ? formatVol(quote.volume) : "-" },
              { label: "متوسط الحجم (30 يوم)", value: stats?.avgVol ? formatVol(stats.avgVol) : "-" },
              { label: "الافتتاح", value: stats?.open?.toFixed(2) || "-" },
              { label: "أعلى سعر", value: stats?.dayHigh?.toFixed(2) || "-" },
              { label: "أدنى سعر", value: stats?.dayLow?.toFixed(2) || "-" },
              { label: "أعلى 52 أسبوع", value: stats?.high52?.toFixed(2) || "-" },
              { label: "أدنى 52 أسبوع", value: stats?.low52?.toFixed(2) || "-" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#2a2e39]/50">
                <span className="text-[10px] text-[#787b86]">{item.label}</span>
                <span className="text-[11px] font-bold text-[#d1d4dc]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN CHART BOARD
// ═══════════════════════════════════════════════════════════════
export default function ChartBoard() {
  const [market, setMarket] = useState("saudi");
  const [selectedStock, setSelectedStock] = useState({ symbol: "2222", name: "أرامكو", market: "saudi" });
  const [timeframe, setTimeframe] = useState("1D");
  const [selectedRange, setSelectedRange] = useState(null); // null = auto (server default)
  const [chartType, setChartType] = useState("candlestick");
  const [candles, setCandles] = useState([]);
  const [showAI, setShowAI] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [search, setSearch] = useState("");
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentBar, setCurrentBar] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [activeTool, setActiveTool] = useState("cursor");
  const [drawings, setDrawings] = useState([]);
  const [showChartTypeMenu, setShowChartTypeMenu] = useState(false);
  const [showIbkr, setShowIbkr] = useState(false);
  const [ibkrState, setIbkrState] = useState({
    connected: false,
    authenticated: false,
    useIbkr: false,
    accounts: [],
    selectedAccount: null,
    conidCache: {}, // symbol -> { conid, exchange, currency, secType }
  });
  const [showAlpaca, setShowAlpaca] = useState(false);
  const [alpacaState, setAlpacaState] = useState({
    connected: false,
    useAlpaca: false,
    accountId: null,
  });

  // Overlays
  const [overlays, setOverlays] = useState({
    ema9: { enabled: false, period: 9, color: "#26a69a" },
    ema20: { enabled: true, period: 20, color: "#f59e0b" },
    sma50: { enabled: true, period: 50, color: "#2962ff" },
    sma200: { enabled: false, period: 200, color: "#ff9800" },
    bb: { enabled: false, period: 20, multiplier: 2, color: "#9c27b0" },
    vwap: { enabled: false, color: "#00bcd4" },
    ichimoku: { enabled: false, color: "#7b2ff7" },
    volume: { enabled: true },
  });

  // Sub-panels
  const [subs, setSubs] = useState({
    rsi: { enabled: false, period: 14 },
    macd: { enabled: false, fast: 12, slow: 26, signal: 9 },
    stochastic: { enabled: false, kPeriod: 14, dPeriod: 3 },
  });

  // Chart refs
  const mainContainerRef = useRef(null);
  const mainChartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const rsiChartRef = useRef(null);
  const macdContainerRef = useRef(null);
  const macdChartRef = useRef(null);
  const stochContainerRef = useRef(null);
  const stochChartRef = useRef(null);

  // Drawing tool refs
  const drawnPriceLinesRef = useRef([]);
  const pendingClickRef = useRef(null);
  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  const selectedTf = useMemo(() => INTERVALS.find(t => t.value === timeframe) || INTERVALS[5], [timeframe]);

  // ── Init IBKR from saved config ──
  useEffect(() => {
    const saved = ibkrConfig.getConfig();
    if (saved?.connected) {
      getConnectionStatus()
        .then(status => {
          if (status.connected) {
            setIbkrState(prev => ({ ...prev, connected: true, authenticated: true, useIbkr: true }));
            getAccounts().then(accts => {
              const list = Array.isArray(accts) ? accts : [];
              if (list.length > 0) {
                setIbkrState(prev => ({
                  ...prev,
                  accounts: list,
                  selectedAccount: list[0]?.id,
                }));
              }
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
    // Init Alpaca from saved config - auto-reconnect if needed
    const alpacaSaved = alpacaConfig.getConfig();
    if (alpacaSaved?.apiKey && alpacaSaved?.secretKey) {
      getAlpacaStatus()
        .then(status => {
          if (status.connected) {
            setAlpacaState(prev => ({ ...prev, connected: true, useAlpaca: true }));
          } else {
            // Auto-reconnect using saved keys
            connectAlpaca(alpacaSaved.apiKey, alpacaSaved.secretKey, alpacaSaved.paper !== false)
              .then(r => {
                if (r.connected) {
                  setAlpacaState(prev => ({ ...prev, connected: true, useAlpaca: true }));
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, []);

  // ── IBKR connection health check ──
  useEffect(() => {
    if (!ibkrState.connected) return;
    const iv = setInterval(() => {
      getConnectionStatus().catch(() => {
        setIbkrState(prev => ({ ...prev, connected: false, authenticated: false }));
      });
    }, 30000);
    return () => clearInterval(iv);
  }, [ibkrState.connected]);

  // ── Resolve symbol to IBKR conid ──
  const resolveConid = useCallback(async (symbol) => {
    if (ibkrState.conidCache[symbol]) return ibkrState.conidCache[symbol];
    try {
      const results = await searchContract(symbol);
      const contracts = Array.isArray(results) ? results : [];
      if (contracts.length === 0) return null;
      // Pick STK (stock) contract
      const stk = contracts.find(c => c.secType === 'STK') || contracts[0];
      const conid = stk.conid;
      if (conid) {
        setIbkrState(prev => ({
          ...prev,
          conidCache: { ...prev.conidCache, [symbol]: { conid, exchange: stk.exchange, currency: stk.currency, secType: stk.secType } },
        }));
      }
      return { conid, exchange: stk.exchange, currency: stk.currency, secType: stk.secType };
    } catch (err) {
      console.error('[IBKR] Contract search error:', err);
      return null;
    }
  }, [ibkrState.conidCache]);

  // ── Fetch Quote (IBKR / Alpaca / Yahoo) ──
  useEffect(() => {
    if (!selectedStock) return;
    setQuote(null);

    if (ibkrState.connected && ibkrState.useIbkr) {
      // IBKR real-time quote via snapshot + SSE streaming
      let cancelled = false;
      let sseSub = null;

      const setupIbkr = async () => {
        const info = await resolveConid(selectedStock.symbol);
        if (!info?.conid || cancelled) return;

        // Initial snapshot
        try {
          const snap = await getMarketSnapshot(info.conid, info.exchange, info.currency, info.secType);
          if (!cancelled && snap) setQuote(parseSnapshotToQuote(snap));
        } catch (err) {
          console.error('[IBKR] Snapshot error:', err);
        }

        // SSE streaming for real-time updates
        sseSub = subscribeMarketData(info.conid, (tick) => {
          const update = parseTickUpdate(tick);
          if (!update) return;
          setQuote(prev => {
            if (!prev) return prev;
            const updated = { ...prev };
            if (update.field === 'last') {
              updated.price = update.value;
              updated.change = +(update.value - (prev.prevClose || 0)).toFixed(4);
              updated.change_percent = prev.prevClose ? +(((update.value - prev.prevClose) / prev.prevClose) * 100).toFixed(2) : 0;
            } else {
              updated[update.field] = update.value;
            }
            return updated;
          });
        }, { exchange: info.exchange, currency: info.currency, secType: info.secType });
      };

      setupIbkr();

      return () => {
        cancelled = true;
        if (sseSub) sseSub.close();
      };
    } else if (alpacaState.connected && alpacaState.useAlpaca) {
      // Alpaca real-time quote via SSE polling
      let sseSub = null;

      const setupAlpaca = async () => {
        // Initial snapshot
        try {
          const snap = await getAlpacaSnapshot(selectedStock.symbol);
          if (snap) setQuote(parseAlpacaQuote(snap));
        } catch (err) {
          console.error('[Alpaca] Snapshot error:', err);
        }

        // SSE streaming
        sseSub = subscribeAlpacaQuotes(selectedStock.symbol, (tick) => {
          const q = parseAlpacaTick(tick);
          if (q) setQuote(q);
        });
      };

      setupAlpaca();

      return () => {
        if (sseSub) sseSub.close();
      };
    } else {
      // Standard Yahoo quote
      const fetchQ = () => getQuote(selectedStock.symbol, market).then(q => setQuote(q)).catch(() => {});
      fetchQ();
      const iv = setInterval(fetchQ, 5000);
      return () => clearInterval(iv);
    }
  }, [selectedStock, market, ibkrState.connected, ibkrState.useIbkr, alpacaState.connected, alpacaState.useAlpaca]);

  // ── Fetch Candles (IBKR / Alpaca / Yahoo) ──
  useEffect(() => {
    if (!selectedStock) return;
    fetchCandles();
    const useRealtime = ibkrState.useIbkr || alpacaState.useAlpaca;
    // Live brokers refresh every 60s; Yahoo refreshes every 5 minutes (large history, no need to hammer)
    const iv = setInterval(fetchCandles, useRealtime ? 60000 : 300000);
    return () => clearInterval(iv);
  }, [selectedStock, market, timeframe, selectedRange, ibkrState.connected, ibkrState.useIbkr, alpacaState.connected, alpacaState.useAlpaca]);

  // ── Live tick → update last candle bar directly (sub-second) ──
  useEffect(() => {
    if (!selectedStock || !alpacaState.connected || !alpacaState.useAlpaca) return;

    const sub = subscribeAlpacaQuotes(selectedStock.symbol, (tick) => {
      if (!tick.price) return;

      // 1. Update quote display
      const q = parseAlpacaTick(tick);
      if (q) setQuote(q);

      // 2. Push directly to chart series — no React re-render needed
      const series = mainSeriesRef.current;
      if (!series) return;
      const isIntraday = ["1min","5min","15min","30min","60min"].includes(selectedTf?.interval);
      const now = isIntraday
        ? Math.floor(Date.now() / 1000)
        : new Date().toISOString().substring(0, 10);

      try {
        if (chartType === 'line' || chartType === 'area') {
          series.update({ time: now, value: tick.price });
        } else {
          series.update({
            time:  now,
            open:  tick.open  || tick.price,
            high:  tick.high  || tick.price,
            low:   tick.low   || tick.price,
            close: tick.price,
          });
        }
      } catch { /* ignore time ordering errors */ }
    });

    return () => sub.close();
  }, [selectedStock, alpacaState.connected, alpacaState.useAlpaca, chartType, selectedTf]);

  const fetchCandles = async () => {
    setLoading(true);

    // ── IBKR candles ──
    if (ibkrState.connected && ibkrState.useIbkr) {
      try {
        const info = await resolveConid(selectedStock.symbol);
        if (!info?.conid) { setLoading(false); return; }
        const historyResponse = await getHistoricalData(info.conid, selectedTf.interval, info.exchange, info.currency, info.secType);
        const ibkrCandles = parseHistoryToCandles(historyResponse);

        if (ibkrCandles.length > 0) {
          // Normalize times
          const isIntraday = ["1min", "5min", "15min", "30min", "60min"].includes(selectedTf.interval);
          const normalized = ibkrCandles.map(c => {
            let t = c.time;
            if (!isIntraday && typeof t === 'number') {
              t = new Date(t * 1000).toISOString().substring(0, 10);
            }
            return { ...c, time: t };
          });
          const seen = new Set();
          const processed = normalized
            .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
            .sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
          if (processed.length > 0) {
            setCandles(processed);
            setCurrentBar(processed[processed.length - 1]);
          }
        }
      } catch (err) {
        console.error('[IBKR] History error:', err);
      }
      setLoading(false);
      return;
    }

    // ── Alpaca candles ──
    if (alpacaState.connected && alpacaState.useAlpaca) {
      try {
        const bars = await getAlpacaBars(selectedStock.symbol, selectedTf.interval);
        const alpacaCandles = parseAlpacaBars(bars);

        if (alpacaCandles.length > 0) {
          const isIntraday = ["1min", "5min", "15min", "30min", "60min"].includes(selectedTf.interval);
          const normalized = alpacaCandles.map(c => {
            let t = c.time;
            if (isIntraday) {
              t = typeof t === 'string' ? Math.floor(new Date(t).getTime() / 1000) : t;
            } else {
              t = typeof t === 'string' ? t.substring(0, 10) : new Date(t * 1000).toISOString().substring(0, 10);
            }
            return { time: t, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 };
          });
          const seen = new Set();
          const processed = normalized
            .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
            .sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
          if (processed.length > 0) {
            setCandles(processed);
            setCurrentBar(processed[processed.length - 1]);
          }
        }
      } catch (err) {
        console.error('[Alpaca] History error:', err);
      }
      setLoading(false);
      return;
    }

    // ── Standard Yahoo candles ──
    try {
      const rangeParam = selectedRange ? `&range=${encodeURIComponent(selectedRange)}` : '';
      const response = await fetch(`/api/market/candles?symbol=${encodeURIComponent(selectedStock.symbol)}&market=${encodeURIComponent(market)}&interval=${encodeURIComponent(selectedTf.interval)}${rangeParam}`);
      const data = await response.json();
      const rawCandles = data?.candles || [];
      if (rawCandles.length === 0) { setLoading(false); return; }

      const isIntraday = ["1min", "5min", "15min", "30min", "60min"].includes(selectedTf.interval);
      const normalized = rawCandles.map(c => {
        let t;
        if (isIntraday) {
          t = typeof c.time === "number" && c.time > 1e10 ? Math.floor(c.time / 1000) : (typeof c.time === "number" ? c.time : Math.floor(new Date(c.time).getTime() / 1000));
        } else {
          t = typeof c.time === "string" ? c.time.substring(0, 10) : typeof c.time === "number" && c.time > 1e10 ? new Date(c.time).toISOString().substring(0, 10) : new Date(c.time * 1000).toISOString().substring(0, 10);
        }
        return { time: t, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 };
      }).filter(c => c.time && c.open && c.close);

      const seen = new Set();
      const processed = normalized
        .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
        .sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));

      if (processed.length > 0) {
        setCandles(processed);
        setCurrentBar(processed[processed.length - 1]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // ── Ichimoku ──
  const calcIchimoku = useCallback((data) => {
    const tenkan = [], kijun = [], senkouA = [], senkouB = [], chikou = [];
    const calcHL = (arr, period, i) => {
      const slice = arr.slice(Math.max(0, i - period + 1), i + 1);
      return { high: Math.max(...slice.map(c => c.high)), low: Math.min(...slice.map(c => c.low)) };
    };
    for (let i = 0; i < data.length; i++) {
      const t9 = calcHL(data, 9, i);
      const t26 = calcHL(data, 26, i);
      const t52 = calcHL(data, 52, i);
      tenkan.push({ time: data[i].time, value: (t9.high + t9.low) / 2 });
      kijun.push({ time: data[i].time, value: (t26.high + t26.low) / 2 });
      if (i + 26 < data.length) {
        senkouA.push({ time: data[i + 26].time, value: ((t9.high + t9.low) / 2 + (t26.high + t26.low) / 2) / 2 });
        senkouB.push({ time: data[i + 26].time, value: (t52.high + t52.low) / 2 });
      }
      if (i >= 26) {
        chikou.push({ time: data[i - 26].time, value: data[i].close });
      }
    }
    return { tenkan, kijun, senkouA, senkouB, chikou };
  }, []);

  // ── Build Charts ──
  useEffect(() => {
    if (!candles || candles.length === 0) return;
    const cleanups = [];

    // === MAIN CHART ===
    const mainContainer = mainContainerRef.current;
    if (mainContainer) {
      if (mainChartRef.current) { try { mainChartRef.current.remove(); } catch (_) {} }

      const chart = createChart(mainContainer, {
        ...chartOpts(mainContainer),
        height: mainContainer.clientHeight,
        watermark: {
          visible: true,
          text: selectedStock?.symbol || '',
          fontSize: 64,
          color: 'rgba(120,123,134,0.06)',
          fontFamily: "'Tajawal', sans-serif",
          fontStyle: 'bold',
        },
      });

      let displayData = candles;
      if (chartType === "heikinashi") displayData = toHeikinAshi(candles);

      let mainSeries;
      if (chartType === "candlestick" || chartType === "heikinashi") {
        mainSeries = chart.addCandlestickSeries({
          upColor: C.up, downColor: C.down,
          borderUpColor: C.up, borderDownColor: C.down,
          wickUpColor: C.up, wickDownColor: C.down,
        });
        mainSeries.setData(displayData);
      } else if (chartType === "line") {
        mainSeries = chart.addLineSeries({ color: C.blue, lineWidth: 2 });
        mainSeries.setData(displayData.map(c => ({ time: c.time, value: c.close })));
      } else if (chartType === "area") {
        mainSeries = chart.addAreaSeries({
          lineColor: C.blue, topColor: "rgba(41,98,255,0.28)", bottomColor: "rgba(41,98,255,0.02)",
          lineWidth: 2,
        });
        mainSeries.setData(displayData.map(c => ({ time: c.time, value: c.close })));
      } else if (chartType === "bar") {
        mainSeries = chart.addBarSeries({ upColor: C.up, downColor: C.down });
        mainSeries.setData(displayData);
      }
      mainSeriesRef.current = mainSeries;

      // Volume
      if (overlays.volume.enabled) {
        const volSeries = chart.addHistogramSeries({
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        volSeries.setData(candles.map(c => ({
          time: c.time, value: c.volume || 0,
          color: c.close >= c.open ? "rgba(38,166,154,0.25)" : "rgba(239,83,80,0.25)",
        })));
      }

      // Overlays
      const lineOpts = { lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false };

      if (overlays.ema9.enabled) {
        chart.addLineSeries({ ...lineOpts, color: overlays.ema9.color }).setData(calcEMA(candles, overlays.ema9.period));
      }
      if (overlays.ema20.enabled) {
        chart.addLineSeries({ ...lineOpts, color: overlays.ema20.color }).setData(calcEMA(candles, overlays.ema20.period));
      }
      if (overlays.sma50.enabled) {
        chart.addLineSeries({ ...lineOpts, color: overlays.sma50.color }).setData(calcSMA(candles, overlays.sma50.period));
      }
      if (overlays.sma200.enabled) {
        chart.addLineSeries({ ...lineOpts, color: overlays.sma200.color }).setData(calcSMA(candles, overlays.sma200.period));
      }
      if (overlays.bb.enabled) {
        const bb = calcBollingerBands(candles, overlays.bb.period, overlays.bb.multiplier);
        chart.addLineSeries({ ...lineOpts, color: overlays.bb.color, lineStyle: LineStyle.Dashed, lineWidth: 1 }).setData(bb.upper);
        chart.addLineSeries({ ...lineOpts, color: overlays.bb.color }).setData(bb.middle);
        chart.addLineSeries({ ...lineOpts, color: overlays.bb.color, lineStyle: LineStyle.Dashed, lineWidth: 1 }).setData(bb.lower);
      }
      if (overlays.vwap.enabled) {
        chart.addLineSeries({ ...lineOpts, color: overlays.vwap.color, lineWidth: 2, lineStyle: LineStyle.Dotted }).setData(calcVWAP(candles));
      }
      if (overlays.ichimoku.enabled) {
        const ichi = calcIchimoku(candles);
        chart.addLineSeries({ ...lineOpts, color: "#0095ff", lineWidth: 1 }).setData(ichi.tenkan);
        chart.addLineSeries({ ...lineOpts, color: "#ff0000", lineWidth: 1 }).setData(ichi.kijun);
        if (ichi.senkouA.length > 0) chart.addLineSeries({ ...lineOpts, color: "#00c853", lineWidth: 1 }).setData(ichi.senkouA);
        if (ichi.senkouB.length > 0) chart.addLineSeries({ ...lineOpts, color: "#ff5252", lineWidth: 1 }).setData(ichi.senkouB);
        if (ichi.chikou.length > 0) chart.addLineSeries({ ...lineOpts, color: "#7b2ff7", lineWidth: 1, lineStyle: LineStyle.Dotted }).setData(ichi.chikou);
      }

      // Crosshair tracking
      chart.subscribeCrosshairMove(param => {
        if (param.time && mainSeries) {
          const data = param.seriesData.get(mainSeries);
          if (data) setCurrentBar({ time: param.time, ...data });
        }
      });

      // Drawing tools - chart click subscription
      chart.subscribeClick(param => {
        if (!param.point) return;
        const tool = activeToolRef.current;
        if (!tool || tool === 'cursor' || tool === 'crosshair') return;

        const price = mainSeries.coordinateToPrice(param.point.y);
        if (price == null || isNaN(price)) return;

        if (tool === 'horizontal') {
          setDrawings(prev => [...prev, { type: 'horizontal', price, color: '#2962ff', id: Date.now() }]);
          setActiveTool('cursor');
        } else if (tool === 'ray') {
          setDrawings(prev => [...prev, { type: 'horizontal', price, color: '#ff9800', id: Date.now() }]);
          setActiveTool('cursor');
        } else if (tool === 'fib') {
          if (!pendingClickRef.current) {
            pendingClickRef.current = { price };
            // Visual feedback: temporary price line for first click
            const tmpLine = mainSeries.createPriceLine({
              price, color: '#d4a843', lineWidth: 1, lineStyle: LineStyle.Dotted,
              axisLabelVisible: true, title: 'Fib start',
            });
            pendingClickRef.current.tmpLine = tmpLine;
            pendingClickRef.current.series = mainSeries;
          } else {
            const start = pendingClickRef.current;
            // Remove temp line
            if (start.tmpLine && start.series) {
              try { start.series.removePriceLine(start.tmpLine); } catch {}
            }
            setDrawings(prev => [...prev, {
              type: 'fib',
              high: Math.max(start.price, price),
              low: Math.min(start.price, price),
              id: Date.now(),
            }]);
            pendingClickRef.current = null;
            setActiveTool('cursor');
          }
        } else if (tool === 'trendline') {
          if (!pendingClickRef.current) {
            pendingClickRef.current = { price, time: param.time };
          } else {
            const start = pendingClickRef.current;
            // Use markers for trendline endpoints
            const markers = [
              { time: start.time, position: 'inBar', color: '#2962ff', shape: 'circle', text: '' },
              { time: param.time, position: 'inBar', color: '#2962ff', shape: 'circle', text: '' },
            ].sort((a, b) => (a.time > b.time ? 1 : -1));
            setDrawings(prev => [...prev, { type: 'trendline', markers, id: Date.now() }]);
            pendingClickRef.current = null;
            setActiveTool('cursor');
          }
        } else if (tool === 'measure') {
          if (!pendingClickRef.current) {
            pendingClickRef.current = { price, time: param.time };
          } else {
            const start = pendingClickRef.current;
            const priceDiff = price - start.price;
            const pctDiff = ((priceDiff / start.price) * 100).toFixed(2);
            const label = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pctDiff}%)`;
            setDrawings(prev => [...prev, {
              type: 'horizontal',
              price: start.price,
              color: priceDiff >= 0 ? '#26a69a' : '#ef5350',
              label,
              id: Date.now(),
            }, {
              type: 'horizontal',
              price,
              color: priceDiff >= 0 ? '#26a69a' : '#ef5350',
              label: `→ ${price.toFixed(2)}`,
              id: Date.now() + 1,
            }]);
            pendingClickRef.current = null;
            setActiveTool('cursor');
          }
        } else if (tool === 'text' || tool === 'note') {
          const text = tool === 'text' ? prompt('أدخل النص:') : prompt('أدخل الملاحظة:');
          if (text) {
            setDrawings(prev => [...prev, {
              type: 'marker',
              time: param.time,
              price,
              text,
              shape: tool === 'note' ? 'square' : 'arrowUp',
              color: '#d4a843',
              id: Date.now(),
            }]);
          }
          setActiveTool('cursor');
        }
      });

      // Apply saved drawings to chart
      // (initial application - subsequent updates handled by separate useEffect)
      const applyDrawings = () => {
        const series = mainSeriesRef.current;
        if (!series) return;
        // Remove old price lines
        drawnPriceLinesRef.current.forEach(pl => {
          try { series.removePriceLine(pl); } catch {}
        });
        drawnPriceLinesRef.current = [];
        const allMarkers = [];
        drawings.forEach(d => {
          if (d.type === 'horizontal') {
            const pl = series.createPriceLine({
              price: d.price,
              color: d.color || '#2962ff',
              lineWidth: 1,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: d.label || `${d.price.toFixed(2)}`,
            });
            drawnPriceLinesRef.current.push(pl);
          } else if (d.type === 'fib') {
            const diff = d.high - d.low;
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const colors = ['#787b86', '#ef5350', '#ff9800', '#2962ff', '#26a69a', '#9c27b0', '#787b86'];
            levels.forEach((level, i) => {
              const levelPrice = d.high - diff * level;
              const pl = series.createPriceLine({
                price: levelPrice,
                color: colors[i],
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: `${(level * 100).toFixed(1)}%`,
              });
              drawnPriceLinesRef.current.push(pl);
            });
          } else if (d.type === 'trendline' && d.markers) {
            allMarkers.push(...d.markers);
          } else if (d.type === 'marker') {
            allMarkers.push({
              time: d.time,
              position: 'aboveBar',
              color: d.color || '#d4a843',
              shape: d.shape || 'arrowUp',
              text: d.text || '',
            });
          }
        });
        if (allMarkers.length > 0) {
          const sorted = allMarkers.sort((a, b) => (a.time > b.time ? 1 : -1));
          series.setMarkers(sorted);
        } else {
          series.setMarkers([]);
        }
      };
      applyDrawings();

      chart.timeScale().fitContent();
      mainChartRef.current = chart;
      cleanups.push(removeTVLogo(mainContainer));

      // Sync sub-charts
      chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (!range) return;
        [rsiChartRef, macdChartRef, stochChartRef].forEach(ref => {
          if (ref.current) try { ref.current.timeScale().setVisibleLogicalRange(range); } catch (_) {}
        });
      });

      const ro = new ResizeObserver(() => {
        if (mainContainer && mainChartRef.current) {
          mainChartRef.current.applyOptions({ width: mainContainer.clientWidth, height: mainContainer.clientHeight });
        }
        [[rsiContainerRef, rsiChartRef], [macdContainerRef, macdChartRef], [stochContainerRef, stochChartRef]].forEach(([cRef, chRef]) => {
          if (cRef.current && chRef.current) chRef.current.applyOptions({ width: cRef.current.clientWidth });
        });
      });
      ro.observe(mainContainer);
      cleanups.push(() => ro.disconnect());
    }

    // === RSI ===
    if (subs.rsi.enabled && rsiContainerRef.current) {
      if (rsiChartRef.current) { try { rsiChartRef.current.remove(); } catch (_) {} }
      const container = rsiContainerRef.current;
      const chart = createChart(container, {
        layout: { background: { color: C.card }, textColor: C.dim, fontFamily: "'Tajawal', sans-serif", fontSize: 10, attributionLogo: false },
        watermark: { visible: false },
        grid: { vertLines: { color: "#1e222d30" }, horzLines: { color: "#1e222d30" } },
        width: container.clientWidth, height: 100,
        timeScale: { visible: false, borderColor: C.border },
        rightPriceScale: { borderColor: C.border, textColor: C.dim, scaleMargins: { top: 0.1, bottom: 0.1 } },
        crosshair: { mode: CrosshairMode.Normal },
      });
      const rsiData = calcRSI(candles, subs.rsi.period);
      const series = chart.addLineSeries({ color: "#7b2ff7", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
      series.setData(rsiData);
      series.createPriceLine({ price: 70, color: "rgba(239,83,80,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" });
      series.createPriceLine({ price: 30, color: "rgba(38,166,154,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" });
      series.createPriceLine({ price: 50, color: "rgba(120,123,134,0.2)", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });
      chart.timeScale().fitContent();
      rsiChartRef.current = chart;
      cleanups.push(removeTVLogo(container));
    } else {
      if (rsiChartRef.current) { try { rsiChartRef.current.remove(); } catch (_) {} rsiChartRef.current = null; }
    }

    // === MACD ===
    if (subs.macd.enabled && macdContainerRef.current) {
      if (macdChartRef.current) { try { macdChartRef.current.remove(); } catch (_) {} }
      const container = macdContainerRef.current;
      const chart = createChart(container, {
        layout: { background: { color: C.card }, textColor: C.dim, fontFamily: "'Tajawal', sans-serif", fontSize: 10, attributionLogo: false },
        watermark: { visible: false },
        grid: { vertLines: { color: "#1e222d30" }, horzLines: { color: "#1e222d30" } },
        width: container.clientWidth, height: 110,
        timeScale: { visible: false, borderColor: C.border },
        rightPriceScale: { borderColor: C.border, textColor: C.dim, scaleMargins: { top: 0.1, bottom: 0.1 } },
        crosshair: { mode: CrosshairMode.Normal },
      });
      const { macdLine, signalLine, histogram } = calcMACD(candles, subs.macd.fast, subs.macd.slow, subs.macd.signal);
      chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false, priceScaleId: "macd" })
        .setData(histogram.map(d => ({
          time: d.time, value: d.value,
          color: d.value >= 0 ? "rgba(38,166,154,0.6)" : "rgba(239,83,80,0.6)",
        })));
      chart.addLineSeries({ color: "#2962ff", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, priceScaleId: "macd" }).setData(macdLine);
      chart.addLineSeries({ color: "#ff9800", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, priceScaleId: "macd" }).setData(signalLine);
      chart.timeScale().fitContent();
      macdChartRef.current = chart;
      cleanups.push(removeTVLogo(container));
    } else {
      if (macdChartRef.current) { try { macdChartRef.current.remove(); } catch (_) {} macdChartRef.current = null; }
    }

    // === STOCHASTIC ===
    if (subs.stochastic.enabled && stochContainerRef.current) {
      if (stochChartRef.current) { try { stochChartRef.current.remove(); } catch (_) {} }
      const container = stochContainerRef.current;
      const chart = createChart(container, {
        layout: { background: { color: C.card }, textColor: C.dim, fontFamily: "'Tajawal', sans-serif", fontSize: 10, attributionLogo: false },
        watermark: { visible: false },
        grid: { vertLines: { color: "#1e222d30" }, horzLines: { color: "#1e222d30" } },
        width: container.clientWidth, height: 100,
        timeScale: { visible: false, borderColor: C.border },
        rightPriceScale: { borderColor: C.border, textColor: C.dim, scaleMargins: { top: 0.1, bottom: 0.1 } },
        crosshair: { mode: CrosshairMode.Normal },
      });
      const stochData = calcStochastic(candles, subs.stochastic.kPeriod, subs.stochastic.dPeriod);
      const kSeries = chart.addLineSeries({ color: "#2962ff", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
      kSeries.setData(stochData.map(d => ({ time: d.time, value: d.k })));
      chart.addLineSeries({ color: "#e040fb", lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        .setData(stochData.map(d => ({ time: d.time, value: d.d })));
      kSeries.createPriceLine({ price: 80, color: "rgba(239,83,80,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true });
      kSeries.createPriceLine({ price: 20, color: "rgba(38,166,154,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true });
      chart.timeScale().fitContent();
      stochChartRef.current = chart;
      cleanups.push(removeTVLogo(container));
    } else {
      if (stochChartRef.current) { try { stochChartRef.current.remove(); } catch (_) {} stochChartRef.current = null; }
    }

    return () => {
      cleanups.forEach(fn => fn());
      [mainChartRef, rsiChartRef, macdChartRef, stochChartRef].forEach(ref => {
        if (ref.current) { try { ref.current.remove(); } catch (_) {} ref.current = null; }
      });
    };
  }, [candles, chartType, overlays, subs]);

  // ── Separate drawings effect (does NOT rebuild the chart) ──
  useEffect(() => {
    const series = mainSeriesRef.current;
    if (!series) return;
    // Remove old price lines
    drawnPriceLinesRef.current.forEach(pl => {
      try { series.removePriceLine(pl); } catch {}
    });
    drawnPriceLinesRef.current = [];
    const allMarkers = [];
    drawings.forEach(d => {
      if (d.type === 'horizontal') {
        const pl = series.createPriceLine({
          price: d.price,
          color: d.color || '#2962ff',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: d.label || `${d.price.toFixed(2)}`,
        });
        drawnPriceLinesRef.current.push(pl);
      } else if (d.type === 'fib') {
        const diff = d.high - d.low;
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const colors = ['#787b86', '#ef5350', '#ff9800', '#2962ff', '#26a69a', '#9c27b0', '#787b86'];
        levels.forEach((level, i) => {
          const levelPrice = d.high - diff * level;
          const pl = series.createPriceLine({
            price: levelPrice,
            color: colors[i],
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `${(level * 100).toFixed(1)}%`,
          });
          drawnPriceLinesRef.current.push(pl);
        });
      } else if (d.type === 'trendline' && d.markers) {
        allMarkers.push(...d.markers);
      } else if (d.type === 'marker') {
        allMarkers.push({
          time: d.time,
          position: 'aboveBar',
          color: d.color || '#d4a843',
          shape: d.shape || 'arrowUp',
          text: d.text || '',
        });
      }
    });
    if (allMarkers.length > 0) {
      const sorted = allMarkers.sort((a, b) => (a.time > b.time ? 1 : -1));
      series.setMarkers(sorted);
    } else {
      series.setMarkers([]);
    }
  }, [drawings]);

  // ── Handlers ──
  const handleSelect = (stock) => {
    setSelectedStock({ ...stock, market });
    setCandles([]);
    setShowAI(false);
    setCurrentBar(null);
    setDrawings([]);
    pendingClickRef.current = null;
  };

  const handleSelectMarket = (m) => {
    setMarket(m);
    if (m === "saudi") handleSelect({ symbol: "2222", name: "أرامكو" });
    else handleSelect({ symbol: "AAPL", name: "Apple" });
  };

  // ── Screenshot ──
  const takeScreenshot = () => {
    const chart = mainChartRef.current;
    if (!chart) return;
    try {
      const canvas = chart.takeScreenshot();
      const link = document.createElement('a');
      link.download = `${selectedStock?.symbol || 'chart'}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {}
  };

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();

      if (e.ctrlKey && key === 'z') { e.preventDefault(); setDrawings(prev => prev.slice(0, -1)); }
      else if (key === 'escape') { setActiveTool('cursor'); setShowChartTypeMenu(false); setShowIndicators(false); setShowAI(false); setShowIbkr(false); setShowAlpaca(false); pendingClickRef.current = null; }
      else if (key === 'h') setActiveTool('horizontal');
      else if (key === 'f') setActiveTool('fib');
      else if (key === 't') setActiveTool('trendline');
      else if (key === 'm') setActiveTool('measure');
      else if (key === 'v') setActiveTool('cursor');
      else if (key === '+' || key === '=') setActiveTool('crosshair');
      else if (key === 'delete' || key === 'backspace') { if (e.ctrlKey) setDrawings([]); }
      else if (key === 's' && e.ctrlKey) { e.preventDefault(); takeScreenshot(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const change = quote?.change_percent;
  const isUp = change >= 0;
  const activeCount = Object.values(overlays).filter(i => i.enabled).length + Object.values(subs).filter(i => i.enabled).length;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Active overlay labels
  const overlayLabels = [];
  if (overlays.ema9.enabled) overlayLabels.push({ label: `EMA ${overlays.ema9.period}`, color: overlays.ema9.color });
  if (overlays.ema20.enabled) overlayLabels.push({ label: `EMA ${overlays.ema20.period}`, color: overlays.ema20.color });
  if (overlays.sma50.enabled) overlayLabels.push({ label: `SMA ${overlays.sma50.period}`, color: overlays.sma50.color });
  if (overlays.sma200.enabled) overlayLabels.push({ label: `SMA ${overlays.sma200.period}`, color: overlays.sma200.color });
  if (overlays.bb.enabled) overlayLabels.push({ label: "BB", color: overlays.bb.color });
  if (overlays.vwap.enabled) overlayLabels.push({ label: "VWAP", color: overlays.vwap.color });
  if (overlays.ichimoku.enabled) overlayLabels.push({ label: "Ichimoku", color: overlays.ichimoku.color });

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex overflow-hidden bg-[#0c0e14] relative select-none h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3rem)]" dir="ltr">

      {/* ── LEFT: Drawing Tools ── */}
      <DrawingToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onClearAll={() => setDrawings([])}
        onUndo={() => setDrawings(prev => prev.slice(0, -1))}
      />

      {/* ── CENTER ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ══════ ROW 1: Symbol + Intervals + Ranges ══════ */}
        <div className="flex items-center gap-1 px-2 py-[3px] border-b border-[#2a2e39] bg-[#131722] shrink-0 overflow-x-auto">

          {/* Symbol */}
          <div className="flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded hover:bg-[#1e222d] cursor-pointer transition-colors shrink-0">
            <span className="text-[13px] font-black text-[#d1d4dc]">{selectedStock?.symbol}</span>
            <span className="text-[10px] text-[#787b86] max-w-[80px] truncate">{selectedStock?.name}</span>
            {market === "saudi" ? <span className="text-[8px] text-[#787b86] bg-[#1e222d] px-1 rounded">تداول</span> : <span className="text-[8px] text-[#787b86] bg-[#1e222d] px-1 rounded">NYSE</span>}
          </div>

          <div className="w-px h-4 bg-[#2a2e39] mx-0.5 shrink-0" />

          {/* Intervals (candle size) */}
          <div className="flex items-center gap-0 shrink-0">
            {INTERVALS.map(tf => (
              <button key={tf.value} onClick={() => setTimeframe(tf.value)}
                className={`px-1.5 py-0.5 text-[11px] font-semibold transition-all rounded ${
                  timeframe === tf.value ? "text-[#d1d4dc] bg-[#2962ff]/20" : "text-[#787b86] hover:text-[#d1d4dc]"
                }`}>
                {tf.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-[#2a2e39] mx-0.5 shrink-0" />

          {/* Range (time period) */}
          <div className="flex items-center gap-0 shrink-0">
            {RANGES.map(r => (
              <button key={r.value} onClick={() => {
                if (selectedRange === r.value) { setSelectedRange(null); return; }
                setSelectedRange(r.value);
                if (!isIntervalCompatible(selectedTf?.interval, r.value)) {
                  const minInterval = bestIntervalForRange(r.value);
                  if (minInterval) {
                    const tf = INTERVALS.find(t => t.interval === minInterval);
                    if (tf) setTimeframe(tf.value);
                  }
                }
              }}
                className={`px-1.5 py-0.5 text-[10px] font-semibold transition-all rounded ${
                  selectedRange === r.value ? "text-[#d4a843] bg-[#d4a843]/15" : "text-[#787b86] hover:text-[#d1d4dc]"
                }`}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Price + Quote (right side of row 1) */}
          {quote && (
            <div className="flex items-center gap-1.5 text-[11px] shrink-0">
              <span className="font-bold text-[#d1d4dc]">{quote.price?.toFixed(2)}</span>
              <span className={`font-bold ${isUp ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
                {isUp ? "+" : ""}{quote.change?.toFixed(2)}
              </span>
              <span className={`font-bold px-1 py-0.5 rounded text-[10px] ${isUp ? "text-[#26a69a] bg-[#26a69a]/10" : "text-[#ef5350] bg-[#ef5350]/10"}`}>
                {isUp ? "+" : ""}{(change || 0).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* ══════ ROW 2: Chart Type + Indicators + Broker + Actions ══════ */}
        <div className="flex items-center gap-1 px-2 py-[3px] border-b border-[#2a2e39] bg-[#131722] shrink-0">

          {/* Chart type */}
          <div className="relative shrink-0">
            <button onClick={() => setShowChartTypeMenu(!showChartTypeMenu)}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[#787b86] hover:text-[#d1d4dc] rounded hover:bg-[#1e222d] transition-all text-[11px]">
              {chartType === "line" || chartType === "area" ? <LineChart className="w-3.5 h-3.5" /> : <BarChart2 className="w-3.5 h-3.5" />}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showChartTypeMenu && (
              <>
              <div className="fixed inset-0 z-40" onClick={() => setShowChartTypeMenu(false)} />
              <div className="absolute top-full left-0 mt-1 bg-[#131722] border border-[#2a2e39] rounded-lg shadow-2xl z-50 w-40 overflow-hidden">
                {CHART_TYPES.map(t => (
                  <button key={t.value} onClick={() => { setChartType(t.value); setShowChartTypeMenu(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-all ${
                      chartType === t.value ? "bg-[#2962ff]/15 text-[#2962ff]" : "text-[#d1d4dc] hover:bg-[#1e222d]"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
              </>
            )}
          </div>

          <div className="w-px h-4 bg-[#2a2e39] mx-0.5 shrink-0" />

          {/* Indicators */}
          <div className="relative shrink-0">
            <button onClick={() => setShowIndicators(!showIndicators)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold transition-all ${
                showIndicators ? "bg-[#2962ff]/20 text-[#2962ff]" : "text-[#787b86] hover:text-[#d1d4dc]"
              }`}>
              <Activity className="w-3.5 h-3.5" />
              <span>المؤشرات</span>
              {activeCount > 0 && <span className="bg-[#2962ff] text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black">{activeCount}</span>}
            </button>
            {showIndicators && <>
              <div className="fixed inset-0 z-30" onClick={() => setShowIndicators(false)} />
              <IndicatorMenu overlays={overlays} setOverlays={setOverlays} subs={subs} setSubs={setSubs} onClose={() => setShowIndicators(false)} />
            </>}
          </div>

          <div className="w-px h-4 bg-[#2a2e39] mx-0.5 shrink-0" />

          {/* AI */}
          <button onClick={() => setShowAI(!showAI)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold transition-all shrink-0 ${
              showAI ? "bg-[#d4a843]/20 text-[#d4a843]" : "text-[#787b86] hover:text-[#d4a843]"
            }`}>
            <Brain className="w-3.5 h-3.5" />
            AI
          </button>

          <div className="flex-1" />

          {/* IBKR Connection */}
          <button onClick={() => { setShowIbkr(!showIbkr); setShowAlpaca(false); }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all shrink-0 ${
              ibkrState.connected
                ? (showIbkr ? "bg-[#26a69a]/20 text-[#26a69a]" : "text-[#26a69a] hover:bg-[#26a69a]/10")
                : (showIbkr ? "bg-[#ff9800]/20 text-[#ff9800]" : "text-[#787b86] hover:text-[#ff9800]")
            }`}>
            {ibkrState.connected ? <Wifi className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            <span>IBKR</span>
            {ibkrState.useIbkr && <span className="w-1.5 h-1.5 rounded-full bg-[#26a69a] animate-pulse" />}
          </button>

          {/* Alpaca Connection */}
          <button onClick={() => { setShowAlpaca(!showAlpaca); setShowIbkr(false); }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all shrink-0 ${
              alpacaState.connected
                ? (showAlpaca ? "bg-[#26a69a]/20 text-[#26a69a]" : "text-[#26a69a] hover:bg-[#26a69a]/10")
                : (showAlpaca ? "bg-[#ffeb3b]/20 text-[#ffeb3b]" : "text-[#787b86] hover:text-[#ffeb3b]")
            }`}>
            {alpacaState.connected ? <Wifi className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
            <span>Alpaca</span>
            {alpacaState.useAlpaca && <span className="w-1.5 h-1.5 rounded-full bg-[#ffeb3b] animate-pulse" />}
          </button>

          <div className="w-px h-4 bg-[#2a2e39] mx-0.5 shrink-0" />

          {/* Screenshot */}
          <button onClick={takeScreenshot} title="لقطة شاشة (Ctrl+S)"
            className="p-1 rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-all shrink-0">
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen}
            className="p-1 rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-all shrink-0">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Toggle sidebar */}
          <button onClick={() => setShowRightSidebar(!showRightSidebar)}
            className="p-1 rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-all shrink-0">
            {showRightSidebar ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* ══════ INDICATOR LABELS ══════ */}
        {overlayLabels.length > 0 && (
          <div className="flex items-center gap-3 px-3 py-[3px] border-b border-[#2a2e39]/50 bg-[#131722] shrink-0 text-[10px]">
            {overlayLabels.map((ol, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="w-3 h-[2px] rounded inline-block" style={{ backgroundColor: ol.color }} />
                <span style={{ color: ol.color }}>{ol.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* ══════ CHART AREA ══════ */}
        <div className="flex-1 min-h-0 flex flex-col relative">
          {loading && candles.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#131722]/90 z-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#2962ff] animate-spin" />
                <span className="text-xs text-[#787b86]">جاري تحميل البيانات...</span>
              </div>
            </div>
          )}

          {showAI && candles.length > 0 && (
            <AiPanel symbol={selectedStock?.symbol} market={market} candles={candles} onClose={() => setShowAI(false)} />
          )}

          {showIbkr && (
            <IbkrConnectionPanel ibkrState={ibkrState} setIbkrState={setIbkrState} onClose={() => setShowIbkr(false)} />
          )}

          {showAlpaca && (
            <AlpacaConnectionPanel alpacaState={alpacaState} setAlpacaState={setAlpacaState} onClose={() => setShowAlpaca(false)} />
          )}

          {/* Active drawing tool indicator */}
          {activeTool !== 'cursor' && activeTool !== 'crosshair' && (
            <div className="absolute top-1 right-3 z-10 flex items-center gap-2 bg-[#2962ff]/15 border border-[#2962ff]/30 rounded-lg px-3 py-1.5 backdrop-blur-sm">
              <Crosshair className="w-3.5 h-3.5 text-[#2962ff]" />
              <span className="text-[11px] font-bold text-[#2962ff]">
                {DRAWING_TOOLS.find(t => t.id === activeTool)?.label || activeTool}
                {pendingClickRef.current ? ' — انقر للتحديد' : ' — انقر على الرسم'}
              </span>
              <button onClick={() => { setActiveTool('cursor'); pendingClickRef.current = null; }} className="text-[#787b86] hover:text-[#d1d4dc]">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* OHLCV */}
          {currentBar && (
            <div className="absolute top-1 left-12 z-10 flex items-center gap-3 text-[11px]" dir="ltr">
              <span className="text-[#787b86]">O <span className={`font-medium ${(currentBar.close || currentBar.value) >= (currentBar.open || 0) ? "text-[#26a69a]" : "text-[#ef5350]"}`}>{currentBar.open?.toFixed(2) || currentBar.value?.toFixed(2)}</span></span>
              {currentBar.high != null && <span className="text-[#787b86]">H <span className="text-[#26a69a] font-medium">{currentBar.high?.toFixed(2)}</span></span>}
              {currentBar.low != null && <span className="text-[#787b86]">L <span className="text-[#ef5350] font-medium">{currentBar.low?.toFixed(2)}</span></span>}
              <span className="text-[#787b86]">C <span className={`font-bold ${(currentBar.close || currentBar.value) >= (currentBar.open || 0) ? "text-[#26a69a]" : "text-[#ef5350]"}`}>{currentBar.close?.toFixed(2) || currentBar.value?.toFixed(2)}</span></span>
              {currentBar.volume > 0 && <span className="text-[#787b86]">V <span className="text-[#787b86]">{formatVol(currentBar.volume)}</span></span>}
            </div>
          )}

          {selectedStock ? (
            <>
              <div ref={mainContainerRef} className="flex-1 w-full min-h-0" style={{ cursor: activeTool !== 'cursor' && activeTool !== 'crosshair' ? 'crosshair' : 'default' }} />

              {subs.rsi.enabled && (
                <div className="border-t border-[#2a2e39] relative">
                  <span className="absolute top-1 left-2 z-10 text-[10px] text-[#7b2ff7] font-semibold px-1.5 py-0.5 rounded bg-[#131722]/90">RSI {subs.rsi.period}</span>
                  <div ref={rsiContainerRef} className="w-full" style={{ height: 100 }} />
                </div>
              )}

              {subs.macd.enabled && (
                <div className="border-t border-[#2a2e39] relative">
                  <span className="absolute top-1 left-2 z-10 text-[10px] text-[#2962ff] font-semibold px-1.5 py-0.5 rounded bg-[#131722]/90">
                    MACD {subs.macd.fast},{subs.macd.slow},{subs.macd.signal}
                  </span>
                  <div ref={macdContainerRef} className="w-full" style={{ height: 110 }} />
                </div>
              )}

              {subs.stochastic.enabled && (
                <div className="border-t border-[#2a2e39] relative">
                  <span className="absolute top-1 left-2 z-10 text-[10px] text-[#e040fb] font-semibold px-1.5 py-0.5 rounded bg-[#131722]/90">
                    Stoch {subs.stochastic.kPeriod},{subs.stochastic.dPeriod}
                  </span>
                  <div ref={stochContainerRef} className="w-full" style={{ height: 100 }} />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <BarChart3 className="w-16 h-16 text-[#2a2e39]" />
              <p className="text-[#787b86]">اختر سهماً من القائمة</p>
            </div>
          )}
        </div>

        {/* ══════ STATUS BAR ══════ */}
        <div className="flex items-center justify-between px-3 py-[3px] border-t border-[#2a2e39] bg-[#131722] shrink-0 text-[10px]" dir="rtl">
          <div className="flex items-center gap-3">
            {subs.rsi.enabled && <span className="text-[#7b2ff7]">◆ RSI</span>}
            {subs.macd.enabled && <span className="text-[#2962ff]">◆ MACD</span>}
            {subs.stochastic.enabled && <span className="text-[#e040fb]">◆ Stoch</span>}
            {drawings.length > 0 && <span className="text-[#d4a843]">✎ {drawings.length} رسم</span>}
          </div>
          <div className="flex items-center gap-3">
            {ibkrState.useIbkr && ibkrState.connected && (
              <span className="flex items-center gap-1 text-[#ff9800]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#26a69a] animate-pulse" />
                IBKR Live
              </span>
            )}
            {alpacaState.useAlpaca && alpacaState.connected && (
              <span className="flex items-center gap-1 text-[#ffeb3b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#26a69a] animate-pulse" />
                Alpaca Live
              </span>
            )}
            <span className="text-[#434651]">H خط | F فيبوناتشي | T ترند | Ctrl+Z تراجع</span>
            <span className="text-[#434651]">|</span>
            <span className="text-[#787b86]">DFA Pro</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT SIDEBAR ── */}
      {showRightSidebar && (
        <RightSidebar
          market={market}
          selectedStock={selectedStock}
          onSelect={handleSelect}
          quote={quote}
          candles={candles}
          search={search}
          setSearch={setSearch}
          handleSelectMarket={handleSelectMarket}
        />
      )}
    </div>
  );
}
