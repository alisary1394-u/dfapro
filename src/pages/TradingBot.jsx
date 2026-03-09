import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import SearchStock from "@/components/ui/SearchStock";
import { computeTargets } from "@/components/charts/TargetEngine";
import { calcOBV, calcAD, calcMFI, calcCMF, calcVSA, calcATR, detectCandlePatterns, detectWyckoffPhase, calcVWAP } from "@/components/charts/SmartIndicators";
import Backtesting from "@/components/charts/Backtesting";
import SentimentAnalysis from "@/components/analysis/SentimentAnalysis";
import ContractScanner from "@/components/trading/ContractScanner";
import BrokerManager from "@/components/trading/BrokerManager";
import OrderExecutor from "@/components/trading/OrderExecutor";
import {
  Bot, Play, Pause, Square, TrendingUp, TrendingDown,
  Zap, Shield, Target, Activity, Clock, DollarSign,
  BarChart2, Settings, ChevronRight, AlertTriangle, Wifi, WifiOff, FlaskConical, Radar
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ===== Timeframe definitions =====
const TIMEFRAMES = [
  { key: "1s", label: "1 ثا", ms: 1000, bars: 120 },
  { key: "5s", label: "5 ثا", ms: 5000, bars: 120 },
  { key: "30s", label: "30 ثا", ms: 30000, bars: 100 },
  { key: "1m", label: "1 د", ms: 60000, bars: 100 },
  { key: "5m", label: "5 د", ms: 300000, bars: 90 },
  { key: "15m", label: "15 د", ms: 900000, bars: 80 },
  { key: "1h", label: "1 س", ms: 3600000, bars: 72 },
  { key: "4h", label: "4 س", ms: 14400000, bars: 60 },
  { key: "1d", label: "يوم", ms: 86400000, bars: 60 },
  { key: "1w", label: "أسبوع", ms: 604800000, bars: 52 },
  { key: "1mo", label: "شهر", ms: 2592000000, bars: 36 },
];

// ===== Simulated live price data generator =====
const generateInitialData = (bars, basePrice, volatility = 0.008) => {
  let price = basePrice;
  const data = [];
  for (let i = 0; i < bars; i++) {
    const open = price;
    const change = (Math.random() - 0.49) * price * volatility;
    const close = parseFloat((open + change).toFixed(3));
    const high = parseFloat((Math.max(open, close) + Math.random() * price * volatility * 0.5).toFixed(3));
    const low = parseFloat((Math.min(open, close) - Math.random() * price * volatility * 0.5).toFixed(3));
    const volume = Math.floor(Math.random() * 5000000 + 500000);
    data.push({ time: `${i}`, open, high, low, close, volume, isBull: close >= open });
    price = close;
  }
  return data;
};

// ===== Core Engine: Analyze all timeframes and produce unified signal =====
const analyzeTimeframe = (data) => {
  if (!data || data.length < 20) return null;
  try {
    const result = computeTargets(data);
    if (!result) return null;
    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const momentum = last.close > prev?.close ? 1 : -1;
    return {
      score: result.confluenceScore,
      isBull: result.isBull,
      primaryTarget: result.primaryTargets?.[0]?.level,
      stopLoss: result.stopLoss,
      rr: result.riskReward,
      momentum,
      signals: result.signals?.length || 0,
      atr: result.atr,
    };
  } catch { return null; }
};

// ===== Unified multi-timeframe decision engine =====
const WEIGHTS = {
  "1s": 3, "5s": 4, "30s": 5, "1m": 8, "5m": 10, "15m": 12,
  "1h": 15, "4h": 15, "1d": 14, "1w": 10, "1mo": 4,
};

const computeUnifiedSignal = (tfResults) => {
  let bullW = 0, bearW = 0, totalW = 0;
  const details = [];
  TIMEFRAMES.forEach(tf => {
    const r = tfResults[tf.key];
    const w = WEIGHTS[tf.key] || 5;
    if (!r) return;
    totalW += w;
    if (r.isBull) bullW += w * (r.score / 100);
    else bearW += w * ((100 - r.score) / 100);
    details.push({ ...tf, ...r });
  });
  if (totalW === 0) return null;
  const score = Math.round(bullW / (bullW + bearW) * 100);
  const isBull = score >= 50;
  const strength = score >= 80 ? "قوي جداً" : score >= 65 ? "قوي" : score >= 55 ? "متوسط" : score >= 45 ? "متوسط" : score >= 35 ? "ضعيف" : "ضعيف جداً";
  const action = score >= 70 ? "شراء قوي" : score >= 58 ? "شراء" : score >= 48 ? "انتظار" : score >= 38 ? "بيع" : "بيع قوي";
  const actionColor = score >= 70 ? "#10b981" : score >= 58 ? "#34d399" : score >= 48 ? "#d4a843" : score >= 38 ? "#f87171" : "#ef4444";
  return { score, isBull, strength, action, actionColor, details, bullW, bearW };
};

// ===== Trade Log Entry =====
let tradeIdCounter = 1;
const makeTrade = (signal, price, tf) => ({
  id: tradeIdCounter++,
  time: new Date().toLocaleTimeString('ar-SA'),
  type: signal.action.includes("شراء") ? "شراء" : "بيع",
  symbol: "SYM",
  price: parseFloat(price.toFixed(3)),
  target: signal.details?.find(d => d.key === tf)?.primaryTarget || null,
  sl: signal.details?.find(d => d.key === tf)?.stopLoss || null,
  rr: signal.details?.find(d => d.key === tf)?.rr || 0,
  score: signal.score,
  status: "مفتوح",
  pnl: 0,
});

export default function TradingBot() {
  const [stock, setStock] = useState(null);
  const [running, setRunning] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState("5m");
  const [tfData, setTfData] = useState({});
  const [tfResults, setTfResults] = useState({});
  const [unifiedSignal, setUnifiedSignal] = useState(null);
  const [trades, setTrades] = useState([]);
  const [equity, setEquity] = useState(10000);
  const [totalPnl, setTotalPnl] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [equityHistory, setEquityHistory] = useState([{ t: 0, v: 10000 }]);
  const [riskPerTrade, setRiskPerTrade] = useState(2);
  const [autoTrade, setAutoTrade] = useState(false);
  const [settings, setSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("live"); // "live" | "backtest" | "scanner"
  const [tradeMode, setTradeMode] = useState("cfd"); // "cfd" | "spot" | "options"
  const [leverage, setLeverage] = useState(10);
  const [contractSize, setContractSize] = useState(1);
  const [contractType, setContractType] = useState("long"); // "long" | "short"
  const [optionType, setOptionType] = useState("call"); // "call" | "put"
  const [optionStrike, setOptionStrike] = useState(null); // strike price
  const [optionExpiry, setOptionExpiry] = useState("weekly"); // "weekly" | "monthly"
  const [ticker, setTicker] = useState(0);
  const [tradingMode, setTradingMode] = useState("paper"); // "paper" | "live"
  const intervalRefs = useRef({});
  const basePrice = useRef(150);

  const location = useLocation();

  // Load stock from URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const symbol = params.get("symbol");
    const market = params.get("market");
    const name = params.get("name") || symbol;
    if (symbol && market) {
      const s = { symbol, market, name };
      basePrice.current = market === "us" ? 50 + Math.random() * 400 : 20 + Math.random() * 100;
      setStock(s);
      setTfData({});
      setTfResults({});
      setUnifiedSignal(null);
    }
  }, [location.search]);

  // Initialize data for all timeframes when stock selected
  const initAllData = useCallback((sym) => {
    const initData = {};
    TIMEFRAMES.forEach(tf => {
      const vol = tf.key.includes("mo") ? 0.04 : tf.key.includes("w") ? 0.025 : tf.key.includes("d") ? 0.015 : tf.key.includes("h") ? 0.01 : 0.005;
      initData[tf.key] = generateInitialData(tf.bars, basePrice.current, vol);
    });
    setTfData(initData);
    // Initial analysis
    const results = {};
    TIMEFRAMES.forEach(tf => {
      results[tf.key] = analyzeTimeframe(initData[tf.key]);
    });
    setTfResults(results);
    setUnifiedSignal(computeUnifiedSignal(results));
  }, []);

  // Live tick: add new bar to a timeframe and re-analyze
  const tickTimeframe = useCallback((tfKey, vol) => {
    setTfData(prev => {
      const arr = prev[tfKey] || [];
      if (!arr.length) return prev;
      const lastClose = arr[arr.length - 1].close;
      const open = lastClose;
      const change = (Math.random() - 0.49) * lastClose * vol;
      const close = parseFloat((open + change).toFixed(3));
      const high = parseFloat((Math.max(open, close) + Math.random() * lastClose * vol * 0.4).toFixed(3));
      const low = parseFloat((Math.min(open, close) - Math.random() * lastClose * vol * 0.4).toFixed(3));
      const volume = Math.floor(Math.random() * 5000000 + 500000);
      const newBar = { time: `${arr.length}`, open, high, low, close, volume, isBull: close >= open };
      const newArr = [...arr.slice(-149), newBar];
      basePrice.current = close;

      // Re-analyze this TF
      const res = analyzeTimeframe(newArr);
      setTfResults(pResults => {
        const updated = { ...pResults, [tfKey]: res };
        const uni = computeUnifiedSignal(updated);
        setUnifiedSignal(uni);
        // Auto trade trigger
        if (autoTrade && uni && Math.abs(uni.score - 50) > 18) {
          const actionIsNew = uni.score >= 58 || uni.score <= 42;
          if (actionIsNew) {
            const trade = makeTrade(uni, close, tfKey);
            trade.symbol = stock?.symbol || "BOT";
            trade.mode = tradeMode;
            trade.leverage = tradeMode === "cfd" ? leverage : tradeMode === "options" ? 100 : 1;
            trade.contracts = contractSize;
            trade.direction = tradeMode === "options" ? optionType : (uni.isBull ? "long" : "short");
            const notional = tradeMode === "options" 
              ? (close * 0.02 * 100 * contractSize)
              : close * contractSize * (tradeMode === "cfd" ? leverage : 1);
            trade.notional = parseFloat(notional.toFixed(2));
            setTrades(prev => [trade, ...prev.slice(0, 49)]);
            // Simulate close after some ticks
            setTimeout(() => {
              setTrades(prev => prev.map(t => {
                if (t.id !== trade.id || t.status !== "مفتوح") return t;
                const exitPrice = close * (uni.isBull ? (1 + Math.random() * 0.015) : (1 - Math.random() * 0.015));
                let pnl;
                if (tradeMode === "cfd") {
                  pnl = calcCFDPnl(t.price, exitPrice, contractSize, leverage, uni.isBull);
                } else if (tradeMode === "options") {
                  const premium = close * 0.02;
                  const exitPremium = exitPrice * 0.02;
                  const optionPnl = optionType === "call" 
                    ? (exitPremium - premium) * 100 * contractSize
                    : (premium - exitPremium) * 100 * contractSize;
                  pnl = parseFloat(optionPnl.toFixed(2));
                } else {
                  pnl = parseFloat(((exitPrice - t.price) / t.price * (equity * riskPerTrade / 100) * (uni.isBull ? 1 : -1)).toFixed(2));
                }
                setTotalPnl(p => parseFloat((p + pnl).toFixed(2)));
                setEquity(e => parseFloat((e + pnl).toFixed(2)));
                setEquityHistory(h => [...h.slice(-99), { t: h.length, v: parseFloat((equity + pnl).toFixed(2)) }]);
                if (pnl >= 0) setWins(w => w + 1); else setLosses(l => l + 1);
                return { ...t, status: pnl >= 0 ? "ربح ✓" : "خسارة ✗", pnl };
              }));
            }, 5000 + Math.random() * 10000);
          }
        }
        return updated;
      });

      return { ...prev, [tfKey]: newArr };
    });
    setTicker(t => t + 1);
  }, [autoTrade, equity, riskPerTrade]);

  // Init data when stock loaded from URL
  useEffect(() => {
    if (stock && Object.keys(tfData).length === 0) {
      initAllData(stock.symbol);
    }
  }, [stock]);

  // Start/stop bot
  useEffect(() => {
    if (!running || !stock) return;
    // Start ticks for each timeframe based on real intervals (compressed for demo)
    const intervals = {
      "1s": 400, "5s": 800, "30s": 1500,
      "1m": 2000, "5m": 3000, "15m": 4000,
      "1h": 5000, "4h": 7000, "1d": 9000,
      "1w": 12000, "1mo": 18000,
    };
    TIMEFRAMES.forEach(tf => {
      const vol = tf.key.includes("mo") ? 0.04 : tf.key.includes("w") ? 0.025 : tf.key.includes("d") ? 0.015 : tf.key.includes("h") ? 0.01 : 0.005;
      intervalRefs.current[tf.key] = setInterval(() => tickTimeframe(tf.key, vol), intervals[tf.key]);
    });
    return () => {
      Object.values(intervalRefs.current).forEach(clearInterval);
      intervalRefs.current = {};
    };
  }, [running, stock, tickTimeframe]);

  // CFD position size (contracts) and PnL calculator
  const calcCFDPnl = (entry, exit, size, lev, isLong) => {
    const notional = entry * size * lev;
    const pctMove = (exit - entry) / entry;
    return parseFloat((notional * pctMove * (isLong ? 1 : -1)).toFixed(2));
  };

  const handleSelect = (s) => {
    setStock(s);
    // US stocks: higher base price range; Saudi: lower
    basePrice.current = s.market === "us" ? 50 + Math.random() * 400 : 20 + Math.random() * 100;
    initAllData(s.symbol);
    setTrades([]);
    setEquity(10000);
    setTotalPnl(0);
    setWins(0);
    setLosses(0);
    setEquityHistory([{ t: 0, v: 10000 }]);
  };

  const start = () => { if (stock) setRunning(true); };
  const pause = () => setRunning(false);
  const stop = () => { setRunning(false); Object.values(intervalRefs.current).forEach(clearInterval); intervalRefs.current = {}; };

  const currentData = tfData[activeTimeframe] || [];
  const lastPrice = currentData[currentData.length - 1]?.close || 0;
  const prevPrice = currentData[currentData.length - 2]?.close || lastPrice;
  const priceChange = lastPrice ? ((lastPrice - prevPrice) / prevPrice * 100) : 0;
  const winRate = wins + losses > 0 ? Math.round(wins / (wins + losses) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${running ? 'bg-emerald-500/20 animate-pulse' : 'bg-[#1e293b]'}`}>
            <Bot className={`w-5 h-5 ${running ? 'text-emerald-400' : 'text-[#94a3b8]'}`} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">بوت التداول الذكي</h1>
            <div className="flex items-center gap-2">
              {running ? (
                <><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-xs text-emerald-400">يعمل على {TIMEFRAMES.length} إطار زمني</span></>
              ) : (
                <><div className="w-1.5 h-1.5 rounded-full bg-[#475569]" /><span className="text-xs text-[#64748b]">متوقف</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-[#0f1623] rounded-xl p-1 border border-[#1e293b]">
            <button onClick={() => setActiveTab("live")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "live" ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-[#64748b] hover:text-white'}`}>
              <Bot className="w-3.5 h-3.5" /> تداول مباشر
            </button>
            <button onClick={() => setActiveTab("backtest")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "backtest" ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-[#64748b] hover:text-white'}`}>
              <FlaskConical className="w-3.5 h-3.5" /> Backtesting
            </button>
            <button onClick={() => setActiveTab("scanner")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "scanner" ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-[#64748b] hover:text-white'}`}>
              <Radar className="w-3.5 h-3.5" /> ماسح العقود
            </button>
          </div>
          <button onClick={() => setSettings(!settings)}
            className="p-2 rounded-xl bg-[#1e293b] hover:bg-[#293548] transition-colors">
            <Settings className="w-4 h-4 text-[#94a3b8]" />
          </button>
          <div className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ backgroundColor: tradingMode === 'live' ? '#dc2626/20' : '#3b82f6/20', color: tradingMode === 'live' ? '#ef4444' : '#3b82f6' }}>
            {tradingMode === 'live' ? '⚡ تداول حقيقي' : '📊 تجريبي'}
          </div>
          <button onClick={start} disabled={!stock || running || activeTab === "backtest"}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 disabled:opacity-40 transition-all">
            <Play className="w-4 h-4" /> تشغيل
          </button>
          <button onClick={pause} disabled={!running}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/30 disabled:opacity-40 transition-all">
            <Pause className="w-4 h-4" /> إيقاف مؤقت
          </button>
          <button onClick={stop}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-all">
            <Square className="w-4 h-4" /> إيقاف
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {settings && (
        <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">إعدادات البوت</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Trade Mode */}
            <div>
              <label className="text-xs text-[#64748b] block mb-1">نوع التداول</label>
              <div className="flex gap-1 bg-[#0f1623] rounded-xl p-1 border border-[#1e293b]">
                {[{ v: "spot", l: "أسهم عادي" }, { v: "cfd", l: "عقود CFD" }, { v: "options", l: "عقود أمريكية" }].map(m => (
                  <button key={m.v} onClick={() => setTradeMode(m.v)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${tradeMode === m.v ? 'bg-[#d4a843] text-black' : 'text-[#64748b] hover:text-white'}`}>
                    {m.l}
                  </button>
                ))}
              </div>
            </div>
            {/* Leverage (CFD only) */}
            {tradeMode === "cfd" && (
              <div>
                <label className="text-xs text-[#64748b] block mb-1">الرافعة المالية (1:{leverage})</label>
                <div className="flex gap-1 flex-wrap">
                  {[2, 5, 10, 20, 50, 100].map(lev => (
                    <button key={lev} onClick={() => setLeverage(lev)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${leverage === lev ? 'bg-[#d4a843]/20 border-[#d4a843]/60 text-[#d4a843]' : 'border-[#1e293b] text-[#64748b] hover:text-white'}`}>
                      1:{lev}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Options settings */}
            {tradeMode === "options" && (
              <>
                <div>
                  <label className="text-xs text-[#64748b] block mb-1">نوع العقد</label>
                  <div className="flex gap-1 bg-[#0f1623] rounded-xl p-1 border border-[#1e293b]">
                    <button onClick={() => setOptionType("call")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${optionType === "call" ? 'bg-emerald-500/20 text-emerald-400' : 'text-[#64748b]'}`}>
                      Call ▲
                    </button>
                    <button onClick={() => setOptionType("put")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${optionType === "put" ? 'bg-red-500/20 text-red-400' : 'text-[#64748b]'}`}>
                      Put ▼
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#64748b] block mb-1">الانتهاء</label>
                  <div className="flex gap-1 bg-[#0f1623] rounded-xl p-1 border border-[#1e293b]">
                    <button onClick={() => setOptionExpiry("weekly")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${optionExpiry === "weekly" ? 'bg-[#d4a843]/20 text-[#d4a843]' : 'text-[#64748b]'}`}>
                      أسبوعي
                    </button>
                    <button onClick={() => setOptionExpiry("monthly")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${optionExpiry === "monthly" ? 'bg-[#d4a843]/20 text-[#d4a843]' : 'text-[#64748b]'}`}>
                      شهري
                    </button>
                  </div>
                </div>
              </>
            )}
            {/* Contract size */}
            <div>
              <label className="text-xs text-[#64748b] block mb-1">
                {tradeMode === "cfd" ? "عدد العقود" : tradeMode === "options" ? "عدد العقود" : "نسبة المخاطرة (%)"}
              </label>
              <input type="number" 
                min={tradeMode === "spot" ? 0.5 : 1} 
                max={tradeMode === "spot" ? 10 : 100}
                step={tradeMode === "spot" ? 0.5 : 1}
                value={tradeMode === "spot" ? riskPerTrade : contractSize}
                onChange={e => tradeMode === "spot" ? setRiskPerTrade(parseFloat(e.target.value)) : setContractSize(parseInt(e.target.value))}
                className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50" />
            </div>
            {/* Direction override (CFD) */}
            {tradeMode === "cfd" && (
              <div>
                <label className="text-xs text-[#64748b] block mb-1">اتجاه العقد (يدوي)</label>
                <div className="flex gap-1 bg-[#0f1623] rounded-xl p-1 border border-[#1e293b]">
                  <button onClick={() => setContractType("long")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${contractType === "long" ? 'bg-emerald-500/20 text-emerald-400' : 'text-[#64748b]'}`}>
                    ▲ Long
                  </button>
                  <button onClick={() => setContractType("short")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${contractType === "short" ? 'bg-red-500/20 text-red-400' : 'text-[#64748b]'}`}>
                    ▼ Short
                  </button>
                </div>
              </div>
            )}
            {/* Auto Trade */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`w-10 h-5 rounded-full transition-colors relative ${autoTrade ? 'bg-emerald-500' : 'bg-[#1e293b]'}`}
                  onClick={() => setAutoTrade(!autoTrade)}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${autoTrade ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-xs text-[#94a3b8]">تداول تلقائي</span>
              </label>
            </div>
          </div>
          {tradeMode === "cfd" && lastPrice > 0 && (
            <div className="mt-3 p-3 bg-[#0f1623] rounded-xl border border-[#1e293b] flex flex-wrap gap-4 text-xs">
              <div><span className="text-[#64748b]">القيمة الاسمية للعقد: </span><span className="text-white font-bold">${(lastPrice * contractSize * leverage).toFixed(2)}</span></div>
              <div><span className="text-[#64748b]">الهامش المطلوب: </span><span className="text-[#d4a843] font-bold">${(lastPrice * contractSize).toFixed(2)}</span></div>
              <div><span className="text-[#64748b]">حركة 1% = </span><span className="text-emerald-400 font-bold">±${(lastPrice * contractSize * leverage * 0.01).toFixed(2)}</span></div>
            </div>
          )}
          {tradeMode === "options" && lastPrice > 0 && (
            <div className="mt-3 p-3 bg-[#0f1623] rounded-xl border border-[#1e293b] flex flex-wrap gap-4 text-xs">
              <div><span className="text-[#64748b]">نوع العقد: </span><span className="text-white font-bold">{optionType === "call" ? "Call (شراء)" : "Put (بيع)"}</span></div>
              <div><span className="text-[#64748b]">الانتهاء: </span><span className="text-[#d4a843] font-bold">{optionExpiry === "weekly" ? "أسبوعي" : "شهري"}</span></div>
              <div><span className="text-[#64748b]">سعر العقد الواحد: </span><span className="text-emerald-400 font-bold">${(lastPrice * 0.02).toFixed(2)} (تقريبي)</span></div>
              <div><span className="text-[#64748b]">الاستثمار الكلي: </span><span className="text-purple-400 font-bold">${(lastPrice * 0.02 * 100 * contractSize).toFixed(2)}</span></div>
            </div>
          )}
        </div>
      )}

      {/* Stock Search */}
      <div className="max-w-md space-y-2">
        <SearchStock onSelect={handleSelect} placeholder="ابحث عن سهم أمريكي أو سعودي..." />
        {stock && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#0f1623] border border-[#1e293b] rounded-xl text-xs flex-wrap">
            <span className="font-bold text-white">{stock.symbol}</span>
            <span className={`px-2 py-0.5 rounded-full font-semibold ${stock.market === "us" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}`}>
              {stock.market === "us" ? "🇺🇸 US Stock" : "🇸🇦 سعودي"}
            </span>
            {tradeMode === "cfd" && <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">CFD رافعة 1:{leverage}</span>}
            {tradeMode === "options" && <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-semibold">{optionType === "call" ? "📈 Call" : "📉 Put"} {optionExpiry === "weekly" ? "أسبوعي" : "شهري"}</span>}
            <span className="text-[#64748b]">{stock.name}</span>
          </div>
        )}
      </div>

      {/* Contract Scanner Tab */}
      {activeTab === "scanner" && (
        <ContractScanner onSelect={(s) => { handleSelect(s); setActiveTab("live"); }} />
      )}

      {/* Backtest Tab */}
      {stock && activeTab === "backtest" && (
        <Backtesting stock={stock} />
      )}

      {/* Broker Manager - always visible */}
      {activeTab === "live" && <BrokerManager />}

      {stock && activeTab === "live" && (
        <>
          {/* Order Executor */}

          <OrderExecutor
            symbol={stock.symbol}
            currentPrice={lastPrice}
            mode={tradingMode}
          />

          {/* Unified Signal Card */}
          <div className="bg-gradient-to-l from-[#0f1623] to-[#111827] border border-[#1e293b] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-[#d4a843]" />
              <h2 className="text-base font-bold text-white">الإشارة الموحدة — تقاطع كل الأطر الزمنية</h2>
              {running && <div className="mr-auto w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
            </div>
            {unifiedSignal ? (
              <div className="space-y-4">
                {/* Big action badge */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="px-8 py-4 rounded-2xl font-black text-2xl border-2"
                    style={{ backgroundColor: unifiedSignal.actionColor + '20', borderColor: unifiedSignal.actionColor + '60', color: unifiedSignal.actionColor }}>
                    {unifiedSignal.action}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-[#64748b]">قوة الإشارة</p>
                      <p className="text-2xl font-black text-white">{unifiedSignal.score}%</p>
                      <p className="text-xs" style={{ color: unifiedSignal.actionColor }}>{unifiedSignal.strength}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-[#64748b]">السعر</p>
                      <p className="text-xl font-black text-white">{lastPrice.toFixed(2)}</p>
                      <p className={`text-xs ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bull vs Bear bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-400 font-semibold">شراء {Math.round(unifiedSignal.bullW)}%</span>
                    <span className="text-red-400 font-semibold">بيع {Math.round(unifiedSignal.bearW)}%</span>
                  </div>
                  <div className="relative h-4 bg-[#1e293b] rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${unifiedSignal.score}%`, background: `linear-gradient(90deg, #10b981, ${unifiedSignal.actionColor})` }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                        {unifiedSignal.score}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[#64748b] text-sm">في انتظار البيانات...</p>
            )}
          </div>

          {/* Multi-Timeframe Grid */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-[#d4a843]" />
              <h3 className="text-sm font-bold text-white">تحليل كل الأطر الزمنية</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-1.5">
              {TIMEFRAMES.map(tf => {
                const r = tfResults[tf.key];
                const isActive = activeTimeframe === tf.key;
                const bullColor = r?.isBull ? "#10b981" : "#ef4444";
                const score = r?.score || 50;
                return (
                  <button key={tf.key} onClick={() => setActiveTimeframe(tf.key)}
                    className={`p-2 rounded-xl border text-center transition-all ${isActive ? 'border-[#d4a843]/60 bg-[#d4a843]/10' : 'border-[#1e293b] bg-[#0f1623] hover:border-[#1e293b]'}`}>
                    <p className={`text-xs font-bold mb-1 ${isActive ? 'text-[#d4a843]' : 'text-[#94a3b8]'}`}>{tf.label}</p>
                    {r ? (
                      <>
                        <div className="w-full h-1 bg-[#1e293b] rounded-full mb-1 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: bullColor }} />
                        </div>
                        <p className="text-xs font-black" style={{ color: bullColor }}>
                          {r.isBull ? "▲" : "▼"} {score}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-[#475569]">—</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Chart + Stats */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Chart */}
            <div className="md:col-span-2 bg-[#0f1623] border border-[#1e293b] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className={`w-4 h-4 ${running ? 'text-emerald-400' : 'text-[#64748b]'}`} />
                  <span className="text-sm font-bold text-white">{stock.symbol} — {TIMEFRAMES.find(t => t.key === activeTimeframe)?.label}</span>
                </div>
                {unifiedSignal && (
                  <span className="text-xs px-2 py-1 rounded-lg font-bold"
                    style={{ backgroundColor: unifiedSignal.actionColor + '20', color: unifiedSignal.actionColor }}>
                    {unifiedSignal.action}
                  </span>
                )}
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={currentData.slice(-60)}>
                    <defs>
                      <linearGradient id="botGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={unifiedSignal?.isBull ? "#10b981" : "#ef4444"} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={unifiedSignal?.isBull ? "#10b981" : "#ef4444"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                    <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={50} domain={['auto', 'auto']} tickFormatter={v => v.toFixed(1)} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                    {tfResults[activeTimeframe]?.primaryTarget && (
                      <ReferenceLine y={tfResults[activeTimeframe].primaryTarget} stroke="#d4a843" strokeDasharray="5 3" label={{ value: "هدف", fill: '#d4a843', fontSize: 9, position: 'insideRight' }} />
                    )}
                    {tfResults[activeTimeframe]?.stopLoss && (
                      <ReferenceLine y={tfResults[activeTimeframe].stopLoss} stroke="#ef4444" strokeDasharray="5 3" label={{ value: "SL", fill: '#ef4444', fontSize: 9, position: 'insideRight' }} />
                    )}
                    <Area type="monotone" dataKey="close" stroke={unifiedSignal?.isBull ? "#10b981" : "#ef4444"} strokeWidth={2} fill="url(#botGrad)" dot={false} name="السعر" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-3">
              <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-4">
                <p className="text-xs text-[#64748b] mb-1">رأس المال</p>
                <p className="text-2xl font-black text-white">${equity.toLocaleString()}</p>
                <p className={`text-sm font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl} $ ({((totalPnl / 10000) * 100).toFixed(2)}%)
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-emerald-400">{wins}</p>
                  <p className="text-xs text-[#64748b]">ربح</p>
                </div>
                <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-red-400">{losses}</p>
                  <p className="text-xs text-[#64748b]">خسارة</p>
                </div>
                <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-[#d4a843]">{winRate}%</p>
                  <p className="text-xs text-[#64748b]">فوز</p>
                </div>
              </div>
              {/* Equity curve */}
              <div className="bg-[#0f1623] border border-[#1e293b] rounded-2xl p-3">
                <p className="text-xs text-[#64748b] mb-2">منحنى رأس المال</p>
                <div className="h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={equityHistory}>
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={totalPnl >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={totalPnl >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="t" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Area type="monotone" dataKey="v" stroke={totalPnl >= 0 ? "#10b981" : "#ef4444"} strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Sentiment Analysis */}
          <SentimentAnalysis
            stock={stock}
            botSignal={unifiedSignal?.action || null}
          />

          {/* Trade Log */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-[#d4a843]" />
              <h3 className="text-sm font-bold text-white">سجل الصفقات</h3>
              <span className="text-xs text-[#64748b] mr-auto">{trades.length} صفقة</span>
              {!autoTrade && stock && (
                <button onClick={() => {
                  if (!unifiedSignal) return;
                  const trade = makeTrade(unifiedSignal, lastPrice, activeTimeframe);
                  trade.symbol = stock.symbol;
                  setTrades(prev => [trade, ...prev.slice(0, 49)]);
                }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/30 hover:bg-[#d4a843]/30 transition-colors font-bold">
                  + صفقة يدوية
                </button>
              )}
            </div>
            {trades.length === 0 ? (
              <div className="text-center py-8 text-[#475569] text-sm">
                {autoTrade ? "سيبدأ البوت بالتداول عند اكتشاف إشارة قوية..." : "لا توجد صفقات. شغّل التداول التلقائي أو أضف صفقة يدوياً"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e293b]">
                      {["الوقت", "النوع", "السهم", "السعر", "الهدف", "SL", "R:R", "العقد", "قوة", "الحالة", "ربح/خسارة"].map(h => (
                        <th key={h} className="text-right py-2 px-2 text-[#64748b] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map(t => (
                      <tr key={t.id} className="border-b border-[#1a2235] hover:bg-[#1e293b]/30 transition-colors">
                        <td className="py-2 px-2 text-[#94a3b8]">{t.time}</td>
                        <td className="py-2 px-2">
                          <span className={`font-bold ${t.type === "شراء" ? "text-emerald-400" : "text-red-400"}`}>
                            {t.type === "شراء" ? "▲" : "▼"} {t.type}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <span className="text-white font-bold">{t.symbol}</span>
                          {t.mode === "cfd" && <span className="text-purple-400 text-xs mr-1">CFD</span>}
                          {t.mode === "options" && <span className="text-violet-400 text-xs mr-1">{t.direction === "call" ? "Call" : "Put"}</span>}
                        </td>
                        <td className="py-2 px-2 text-white font-semibold">{t.price}</td>
                        <td className="py-2 px-2 text-[#d4a843]">{t.target?.toFixed(2) || "—"}</td>
                        <td className="py-2 px-2 text-red-400">{t.sl?.toFixed(2) || "—"}</td>
                        <td className="py-2 px-2 text-[#94a3b8]">{t.rr}x</td>
                        <td className="py-2 px-2">
                          {t.mode === "cfd" ? (
                            <span className="text-[#94a3b8]">{t.contracts}x (1:{t.leverage})</span>
                          ) : <span className="text-[#64748b]">—</span>}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <div className="w-8 h-1 bg-[#1e293b] rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#d4a843]" style={{ width: `${t.score}%` }} />
                            </div>
                            <span className="text-[#94a3b8]">{t.score}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.status === "مفتوح" ? "bg-blue-500/20 text-blue-400" : t.status.includes("ربح") ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className={`py-2 px-2 font-bold ${t.pnl > 0 ? 'text-emerald-400' : t.pnl < 0 ? 'text-red-400' : 'text-[#64748b]'}`}>
                          {t.pnl !== 0 ? `${t.pnl > 0 ? '+' : ''}${t.pnl}$` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </>
      )}

      {!stock && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-3xl bg-[#d4a843]/10 flex items-center justify-center mb-6">
            <Bot className="w-12 h-12 text-[#d4a843]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">بوت التداول الذكي</h2>
          <p className="text-[#94a3b8] max-w-sm">ابحث عن أي سهم أمريكي (AAPL, TSLA, NVDA...) أو سعودي (2222, 1120...) وابدأ التداول بعقود CFD أو أسهم عادية على كل الأطر الزمنية</p>
        </div>
      )}
    </div>
  );
}