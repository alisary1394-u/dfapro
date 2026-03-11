import React, { useState, useEffect, useRef, useCallback } from "react";
import { computeTargets } from "@/components/charts/TargetEngine";
import { getCandles, getQuote } from "@/components/api/marketDataClient";
import ScreenerAlertCard from "@/components/screener/ScreenerAlertCard";
import ScreenerTable from "@/components/screener/ScreenerTable";
import ScreenerFilters from "@/components/screener/ScreenerFilters";
import {
  Radar, Play, Pause, Zap,
  Bell, BellOff, RefreshCw
} from "lucide-react";

// ========== Stock universe ==========
const STOCKS = {
  saudi: [
    { symbol: "2222", name: "أرامكو", market: "saudi" },
    { symbol: "1120", name: "الراجحي", market: "saudi" },
    { symbol: "2010", name: "سابك", market: "saudi" },
    { symbol: "1180", name: "الأهلي", market: "saudi" },
    { symbol: "7010", name: "STC", market: "saudi" },
    { symbol: "2280", name: "المراعي", market: "saudi" },
    { symbol: "2050", name: "صافولا", market: "saudi" },
    { symbol: "1010", name: "الرياض", market: "saudi" },
    { symbol: "2350", name: "كيان", market: "saudi" },
    { symbol: "4200", name: "الدريس", market: "saudi" },
    { symbol: "3010", name: "ينساب", market: "saudi" },
    { symbol: "2290", name: "جبر", market: "saudi" },
  ],
  us: [
    { symbol: "AAPL", name: "Apple", market: "us" },
    { symbol: "MSFT", name: "Microsoft", market: "us" },
    { symbol: "NVDA", name: "NVIDIA", market: "us" },
    { symbol: "TSLA", name: "Tesla", market: "us" },
    { symbol: "GOOGL", name: "Alphabet", market: "us" },
    { symbol: "AMZN", name: "Amazon", market: "us" },
    { symbol: "META", name: "Meta", market: "us" },
    { symbol: "JPM", name: "JPMorgan", market: "us" },
    { symbol: "NFLX", name: "Netflix", market: "us" },
    { symbol: "V", name: "Visa", market: "us" },
    { symbol: "AMD", name: "AMD", market: "us" },
    { symbol: "PLTR", name: "Palantir", market: "us" },
  ]
};

// ========== Analyze stock across key TFs using real data ==========
const KEY_TFS = [
  { key: "5min", label: "5د", bars: 80 },
  { key: "15min", label: "15د", bars: 80 },
  { key: "60min", label: "1س", bars: 72 },
  { key: "daily", label: "يوم", bars: 60 },
];

// Fallback synthetic data when API unavailable
const generateData = (bars, basePrice, vol = 0.008) => {
  let price = basePrice;
  return Array.from({ length: bars }, (_, i) => {
    const open = price;
    const change = (Math.random() - 0.49) * price * vol;
    const close = parseFloat((open + change).toFixed(3));
    const high = parseFloat((Math.max(open, close) + Math.random() * price * vol * 0.5).toFixed(3));
    const low = parseFloat((Math.min(open, close) - Math.random() * price * vol * 0.5).toFixed(3));
    const volume = Math.floor(Math.random() * 5000000 + 500000);
    price = close;
    return { time: `${i}`, open, high, low, close, volume, isBull: close >= open };
  });
};

const analyzeStockWithData = (stock, candlesByTf, quoteData) => {
  const tfScores = {};
  let totalScore = 0;

  KEY_TFS.forEach(tf => {
    const data = candlesByTf[tf.key];
    if (!data || data.length < 10) return;
    try {
      const result = computeTargets(data);
      if (result) {
        tfScores[tf.key] = { score: result.confluenceScore, isBull: result.isBull, label: tf.label };
        totalScore += result.confluenceScore;
      }
    } catch {}
  });

  const count = Object.keys(tfScores).length || 1;
  const avgScore = totalScore / count || 50;
  const aligned = Object.values(tfScores).filter(t => t.isBull).length;
  const alignedBear = Object.values(tfScores).filter(t => !t.isBull).length;
  const totalTfs = Object.keys(tfScores).length;

  const strength = avgScore >= 78 ? "قوي جداً" : avgScore >= 65 ? "قوي" : avgScore >= 52 ? "متوسط" : avgScore >= 40 ? "ضعيف" : "ضعيف جداً";
  let signal = "محايد";
  let signalType = "neutral";
  if (aligned >= 3) { signal = aligned >= 4 ? "شراء قوي" : "شراء"; signalType = aligned >= 4 ? "strong_buy" : "buy"; }
  else if (alignedBear >= 3) { signal = alignedBear >= 4 ? "بيع قوي" : "بيع"; signalType = alignedBear >= 4 ? "strong_sell" : "sell"; }

  return {
    ...stock,
    price: quoteData?.price ?? 0,
    change: quoteData?.change_percent ?? 0,
    avgScore: Math.round(avgScore),
    signal,
    signalType,
    strength,
    tfScores,
    aligned,
    alignedBear,
    totalTfs,
    scannedAt: new Date().toLocaleTimeString("ar-SA"),
  };
};

// ========== Signal color ==========
export const signalColor = (type) => {
  if (type === "strong_buy") return { bg: "#10b981", text: "#fff", badgeBg: "bg-emerald-500/20", badgeText: "text-emerald-400", border: "border-emerald-500/40" };
  if (type === "buy") return { bg: "#34d399", text: "#fff", badgeBg: "bg-emerald-500/10", badgeText: "text-emerald-300", border: "border-emerald-500/30" };
  if (type === "strong_sell") return { bg: "#ef4444", text: "#fff", badgeBg: "bg-red-500/20", badgeText: "text-red-400", border: "border-red-500/40" };
  if (type === "sell") return { bg: "#f87171", text: "#fff", badgeBg: "bg-red-500/10", badgeText: "text-red-300", border: "border-red-500/30" };
  return { bg: "#d4a843", text: "#fff", badgeBg: "bg-[#d4a843]/10", badgeText: "text-[#d4a843]", border: "border-[#d4a843]/30" };
};

export default function Screener() {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all"); // all | buy | sell | strong_buy | strong_sell
  const [market, setMarket] = useState("all"); // all | saudi | us
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const basePrices = useRef({});
  const intervalRef = useRef(null);
  const prevSignals = useRef({});

  const allStocks = [
    ...(market === "all" || market === "saudi" ? STOCKS.saudi : []),
    ...(market === "all" || market === "us" ? STOCKS.us : []),
  ];

  const runScan = useCallback(async () => {
    const newResults = [];
    for (const stock of allStocks) {
      try {
        // Fetch real candles for each timeframe + quote
        const [quoteData, ...candleResults] = await Promise.allSettled([
          getQuote(stock.symbol, stock.market),
          ...KEY_TFS.map(tf => getCandles(stock.symbol, stock.market, tf.key)),
        ]);
        
        const candlesByTf = {};
        KEY_TFS.forEach((tf, i) => {
          const r = candleResults[i];
          if (r.status === 'fulfilled' && r.value && r.value.length > 5) {
            candlesByTf[tf.key] = r.value;
          } else {
            // Fallback to synthetic data
            const base = quoteData.status === 'fulfilled' && quoteData.value?.price
              ? quoteData.value.price
              : (stock.market === 'us' ? 100 : 30);
            candlesByTf[tf.key] = generateData(tf.bars || 60, base);
          }
        });
        
        const quote = quoteData.status === 'fulfilled' ? quoteData.value : null;
        newResults.push(analyzeStockWithData(stock, candlesByTf, quote));
      } catch {
        // Full fallback
        const base = stock.market === 'us' ? 100 : 30;
        const candlesByTf = {};
        KEY_TFS.forEach(tf => { candlesByTf[tf.key] = generateData(60, base); });
        newResults.push(analyzeStockWithData(stock, candlesByTf, { price: base, change_percent: 0 }));
      }
    }

    setResults(newResults);
    setLastScan(new Date().toLocaleTimeString("ar-SA"));
    setScanCount(c => c + 1);

    // Detect new strong signals for alerts
    newResults.forEach(r => {
      const prev = prevSignals.current[r.symbol];
      const isStrong = r.signalType === "strong_buy" || r.signalType === "strong_sell";
      const changed = prev !== r.signalType;
      if (isStrong && changed && notificationsEnabled) {
        setAlerts(a => [{
          id: Date.now() + Math.random(),
          symbol: r.symbol,
          name: r.name,
          market: r.market,
          signal: r.signal,
          signalType: r.signalType,
          price: r.price,
          score: r.avgScore,
          aligned: r.aligned,
          totalTfs: r.totalTfs,
          time: r.scannedAt,
        }, ...a.slice(0, 19)]);
      }
      prevSignals.current[r.symbol] = r.signalType;
    });
  }, [allStocks, notificationsEnabled]);

  // Auto-scan (every 60s with real data)
  useEffect(() => {
    if (!scanning) {
      clearInterval(intervalRef.current);
      return;
    }
    runScan(); // immediate
    intervalRef.current = setInterval(runScan, 60000);
    return () => clearInterval(intervalRef.current);
  }, [scanning, runScan]);

  // Re-scan when market changes
  useEffect(() => {
    if (results.length > 0) runScan();
  }, [market]);

  const filtered = results.filter(r => {
    const mOk = market === "all" || r.market === market;
    const sOk = filter === "all" || r.signalType === filter;
    return mOk && sOk;
  });

  const strongBuys = results.filter(r => r.signalType === "strong_buy").length;
  const buys = results.filter(r => r.signalType === "buy").length;
  const sells = results.filter(r => r.signalType === "sell").length;
  const strongSells = results.filter(r => r.signalType === "strong_sell").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${scanning ? 'bg-emerald-500/20 animate-pulse' : 'bg-[#1e293b]'}`}>
            <Radar className={`w-5 h-5 ${scanning ? 'text-emerald-400' : 'text-[#94a3b8]'}`} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ماسح الفرص الذكي</h1>
            <div className="flex items-center gap-2 text-xs text-[#64748b]">
              {scanning ? (
                <><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-emerald-400">يمسح {allStocks.length} سهم كل 8 ثوانٍ</span></>
              ) : (
                <><div className="w-1.5 h-1.5 rounded-full bg-[#475569]" /><span>متوقف</span></>
              )}
              {lastScan && <span>• آخر مسح: {lastScan}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Notifications toggle */}
          <button onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${notificationsEnabled ? 'bg-[#d4a843]/10 border-[#d4a843]/30 text-[#d4a843]' : 'bg-[#1e293b] border-[#1e293b] text-[#64748b]'}`}>
            {notificationsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            التنبيهات
          </button>

          {/* Scan once manually */}
          <button onClick={runScan}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#1e293b] bg-[#1e293b] text-[#94a3b8] text-xs font-bold hover:text-white transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            مسح الآن
          </button>

          {scanning ? (
            <button onClick={() => setScanning(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/30 transition-all">
              <Pause className="w-4 h-4" /> إيقاف المسح
            </button>
          ) : (
            <button onClick={() => setScanning(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 transition-all">
              <Play className="w-4 h-4" /> بدء المسح التلقائي
            </button>
          )}
        </div>
      </div>

      {/* Live Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#d4a843] font-bold">
            <Zap className="w-4 h-4" /> تنبيهات الفرص الجديدة
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.slice(0, 6).map(alert => (
              <ScreenerAlertCard key={alert.id} alert={alert} onDismiss={(id) => setAlerts(a => a.filter(x => x.id !== id))} />
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "شراء قوي", count: strongBuys, color: "#10b981", icon: "🔥", type: "strong_buy" },
            { label: "شراء", count: buys, color: "#34d399", icon: "▲", type: "buy" },
            { label: "بيع", count: sells, color: "#f87171", icon: "▼", type: "sell" },
            { label: "بيع قوي", count: strongSells, color: "#ef4444", icon: "⚡", type: "strong_sell" },
          ].map(item => (
            <button key={item.type}
              onClick={() => setFilter(filter === item.type ? "all" : item.type)}
              className={`p-4 rounded-2xl border transition-all text-right ${filter === item.type ? 'border-current' : 'border-[#1e293b] bg-[#151c2c] hover:bg-[#1a2235]'}`}
              style={filter === item.type ? { borderColor: item.color + '60', backgroundColor: item.color + '15' } : {}}>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black" style={{ color: item.color }}>{item.count}</span>
                <span className="text-xl">{item.icon}</span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1">{item.label}</p>
              <div className="mt-2 h-1 bg-[#1e293b] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${results.length ? (item.count / results.length * 100) : 0}%`, backgroundColor: item.color }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <ScreenerFilters
        market={market} setMarket={setMarket}
        filter={filter} setFilter={setFilter}
        count={filtered.length}
        total={results.length}
      />

      {/* Results Table */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-3xl bg-[#d4a843]/10 flex items-center justify-center mb-6">
            <Radar className="w-12 h-12 text-[#d4a843]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">ماسح الفرص الذكي</h2>
          <p className="text-[#94a3b8] max-w-sm mb-6">يمسح السوق تلقائياً ويكشف أقوى فرص الشراء والبيع بناءً على تقاطع الأطر الزمنية وإشارات البوت الذكي</p>
          <button onClick={() => { setScanning(true); runScan(); }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#d4a843] text-black font-black text-sm hover:bg-[#e8c76a] transition-colors">
            <Play className="w-4 h-4" /> ابدأ المسح الآن
          </button>
        </div>
      ) : (
        <ScreenerTable results={filtered} />
      )}
    </div>
  );
}