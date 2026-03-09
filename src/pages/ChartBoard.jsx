import React, { useState, useEffect, useRef, useCallback } from "react";
import { createChart } from "lightweight-charts";
import { base44 } from "@/api/base44Client";
import { getQuote } from "@/components/api/marketDataClient";
import {
  Search, TrendingUp, TrendingDown, Brain, Zap, ChevronRight,
  ChevronLeft, RefreshCw, Loader2, BarChart3, Activity, Sparkles,
  ArrowUpRight, ArrowDownRight, FolderOpen, ChevronDown, X
} from "lucide-react";
import { calcEMA, calcSMA, calcRSI, calcMACD, calcBollingerBands } from "@/components/charts/indicatorUtils";

// ─── Saudi Market full list (grouped by sector) ───
const SAUDI_SECTORS = [
  { sector: "الرئيسي", items: [{ symbol: "TASI", name: "تاسي" }, { symbol: "MI30", name: "ام آي 30" }, { symbol: "TFNI", name: "تفني" }] },
  { sector: "الصناعة", items: [{ symbol: "2010", name: "سابك" }, { symbol: "2030", name: "سابك للبتر." }, { symbol: "2222", name: "أرامكو" }, { symbol: "2380", name: "بترو رابغ" }, { symbol: "2381", name: "الجحر العربية" }, { symbol: "2382", name: "أنيس" }] },
  { sector: "البنوك", items: [{ symbol: "1010", name: "الرياض" }, { symbol: "1020", name: "الجزيرة" }, { symbol: "1060", name: "البلاد" }, { symbol: "1120", name: "الراجحي" }, { symbol: "1140", name: "التنمية" }, { symbol: "1150", name: "البنك الأهلي" }, { symbol: "1180", name: "الأهلي" }, { symbol: "1201", name: "تكو" }] },
  { sector: "الاتصالات", items: [{ symbol: "7010", name: "الاتصالات" }, { symbol: "7020", name: "موبايلي" }, { symbol: "7030", name: "زين" }] },
  { sector: "الأسمنت", items: [{ symbol: "3010", name: "أسمنت يني" }, { symbol: "3020", name: "أسمنت الشرق" }, { symbol: "3030", name: "الحفر" }, { symbol: "3040", name: "أسمنت أم" }, { symbol: "3050", name: "الجنوبية" }] },
  { sector: "الحوافز الأساسية", items: [{ symbol: "TMT", name: "تي ام تي" }, { symbol: "1210", name: "بى إس بى ايه" }, { symbol: "1211", name: "معادن" }] },
  { sector: "التشييد والبناء", items: [{ symbol: "1301", name: "أملاك" }, { symbol: "1304", name: "الجامعة الدير" }] },
  { sector: "النقل", items: [{ symbol: "1320", name: "أنابيب السعودية" }, { symbol: "1321", name: "أنابيب الشرق" }, { symbol: "1322", name: "أملاك" }, { symbol: "1323", name: "بي ان اس اي" }, { symbol: "1324", name: "صالح الراشد" }] },
  { sector: "الكيماويات", items: [{ symbol: "2001", name: "كيماويات" }, { symbol: "2010", name: "سناء" }, { symbol: "2020", name: "سابر المعيات الزراعية" }, { symbol: "2060", name: "التصنيع" }, { symbol: "2090", name: "جسكو" }] },
  { sector: "الاحتكار", items: [{ symbol: "2150", name: "قرياء" }, { symbol: "2170", name: "التاجر" }, { symbol: "2190", name: "فيكو" }, { symbol: "2210", name: "أنابيت" }, { symbol: "2220", name: "مجتمع الكيماويات" }, { symbol: "2220", name: "معيرض" }] },
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

const TIMEFRAMES = [
  { label: "يوم",  value: "1D",  interval: "daily",   limit: 365 },
  { label: "أسبوع",value: "1W",  interval: "weekly",  limit: 260 },
  { label: "شهر",  value: "1MO", interval: "monthly", limit: 120 },
  { label: "1د",   value: "1M",  interval: "1min",    limit: 100 },
  { label: "5د",   value: "5M",  interval: "5min",    limit: 100 },
  { label: "15د",  value: "15M", interval: "15min",   limit: 100 },
  { label: "1س",   value: "1H",  interval: "60min",   limit: 200 },
];

const CHART_TYPES = [
  { value: "candlestick", label: "شموع" },
  { value: "line", label: "خط" },
  { value: "area", label: "منطقة" },
  { value: "bar", label: "أعمدة" },
];

// ─── AI Panel ───────────────────────────────────────────────────────────
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
    const last20 = candles.slice(-20);
    const prices = last20.map(c => c.close);
    const high = Math.max(...last20.map(c => c.high));
    const low = Math.min(...last20.map(c => c.low));
    const latest = candles[candles.length - 1];

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `أنت محلل فني خبير. حلل السهم ${symbol} بناءً على البيانات التالية:
- آخر 20 شمعة إغلاق: ${prices.join(", ")}
- أعلى سعر: ${high} | أدنى سعر: ${low}
- سعر الافتتاح: ${latest.open} | الإغلاق: ${latest.close}

قدم تحليلاً فنياً سريعاً يشمل:
1. اتجاه السوق الحالي (صاعد/هابط/جانبي)
2. أقرب دعم ومقاومة
3. إشارة RSI (تقديرية)
4. توصية واضحة (شراء/بيع/انتظار)
5. ملاحظة ذكية واحدة فقط`,
      add_context_from_internet: false,
      response_json_schema: {
        type: "object",
        properties: {
          trend: { type: "string" },
          support: { type: "number" },
          resistance: { type: "number" },
          rsi_estimate: { type: "number" },
          recommendation: { type: "string" },
          note: { type: "string" },
          confidence: { type: "number" }
        }
      }
    });
    setResult(res);
    setLoading(false);
  };

  const recColor = result?.recommendation?.includes("شراء") ? "#10b981"
    : result?.recommendation?.includes("بيع") ? "#ef4444" : "#d4a843";

  return (
    <div className="absolute top-14 left-2 w-64 bg-[#111827]/97 border border-[#d4a843]/30 rounded-xl shadow-2xl z-30 backdrop-blur-md">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e293b]">
        <div className="flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-[#d4a843]" />
          <span className="text-xs font-bold text-[#d4a843]">تحليل الذكاء الاصطناعي</span>
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-[#1e293b] rounded text-[#64748b]"><X className="w-3 h-3" /></button>
      </div>
      <div className="p-3 space-y-2.5">
        {loading ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <Loader2 className="w-6 h-6 text-[#d4a843] animate-spin" />
            <span className="text-xs text-[#64748b]">يحلل البيانات...</span>
          </div>
        ) : result ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#64748b]">التوصية</span>
              <span className="text-sm font-black" style={{ color: recColor }}>{result.recommendation}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#64748b]">الاتجاه</span>
              <span className="text-xs font-bold text-white">{result.trend}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
                <p className="text-[9px] text-[#64748b]">دعم</p>
                <p className="text-xs font-bold text-emerald-400">{result.support?.toFixed(2)}</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
                <p className="text-[9px] text-[#64748b]">مقاومة</p>
                <p className="text-xs font-bold text-red-400">{result.resistance?.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#64748b]">RSI (تقديري)</span>
              <span className={`text-xs font-bold ${result.rsi_estimate > 70 ? "text-red-400" : result.rsi_estimate < 30 ? "text-emerald-400" : "text-[#d4a843]"}`}>
                {result.rsi_estimate}
              </span>
            </div>
            {result.confidence && (
              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[9px] text-[#64748b]">ثقة التحليل</span>
                  <span className="text-[9px] text-white">{result.confidence}%</span>
                </div>
                <div className="h-1 bg-[#1e293b] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#d4a843]" style={{ width: `${result.confidence}%` }} />
                </div>
              </div>
            )}
            <div className="bg-[#0f1623] border border-[#1e293b] rounded-lg p-2">
              <p className="text-[10px] text-[#94a3b8] leading-relaxed">{result.note}</p>
            </div>
            <button onClick={analyze} className="w-full py-1.5 text-[10px] font-bold text-[#d4a843] border border-[#d4a843]/30 rounded-lg hover:bg-[#d4a843]/10 transition-all flex items-center justify-center gap-1">
              <RefreshCw className="w-3 h-3" /> إعادة التحليل
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Chart Area ─────────────────────────────────────────────────────
function MainChart({ symbol, market, timeframe, chartType, onCandlesLoaded }) {
  const containerRef = useRef(null);
  const volContainerRef = useRef(null);
  const chartRef = useRef(null);
  const volChartRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [currentBar, setCurrentBar] = useState(null);

  const selectedTf = TIMEFRAMES.find(t => t.value === timeframe) || TIMEFRAMES[0];

  useEffect(() => {
    if (!symbol) return;
    loadChart();
    return () => {
      if (chartRef.current) { try { chartRef.current.remove(); } catch (_) {} chartRef.current = null; }
      if (volChartRef.current) { try { volChartRef.current.remove(); } catch (_) {} volChartRef.current = null; }
    };
  }, [symbol, market, timeframe, chartType]);

  const loadChart = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke("marketData", {
        action: "candles", symbol, market,
        interval: selectedTf.interval,
        limit: selectedTf.limit,
      });
      const rawCandles = response.data?.candles || [];
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
      const candles = normalized.filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
        .sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));

      if (candles.length === 0) { setLoading(false); return; }
      onCandlesLoaded(candles);
      setCurrentBar(candles[candles.length - 1]);

      buildChart(candles);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const buildChart = (candles) => {
    if (!containerRef.current) return;
    if (chartRef.current) { try { chartRef.current.remove(); } catch (_) {} chartRef.current = null; }
    if (volChartRef.current) { try { volChartRef.current.remove(); } catch (_) {} volChartRef.current = null; }

    const opts = {
      layout: { background: { color: "#0a0e17" }, textColor: "#64748b" },
      grid: { vertLines: { color: "#111827" }, horzLines: { color: "#111827" } },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1e293b" },
      rightPriceScale: { borderColor: "#1e293b", textColor: "#94a3b8" },
      crosshair: { mode: 1 },
    };

    const chart = createChart(containerRef.current, opts);

    if (chartType === "candlestick") {
      const s = chart.addCandlestickSeries({ upColor: "#26a69a", downColor: "#ef5350", borderUpColor: "#26a69a", borderDownColor: "#ef5350", wickUpColor: "#26a69a", wickDownColor: "#ef5350" });
      s.setData(candles);
    } else if (chartType === "line") {
      const s = chart.addLineSeries({ color: "#d4a843", lineWidth: 2 });
      s.setData(candles.map(c => ({ time: c.time, value: c.close })));
    } else if (chartType === "area") {
      const s = chart.addAreaSeries({ lineColor: "#d4a843", topColor: "rgba(212,168,67,0.4)", bottomColor: "rgba(212,168,67,0.0)" });
      s.setData(candles.map(c => ({ time: c.time, value: c.close })));
    } else if (chartType === "bar") {
      const s = chart.addBarSeries({ upColor: "#26a69a", downColor: "#ef5350" });
      s.setData(candles);
    }

    // EMA 20 & 50 overlays
    const ema20 = calcEMA(candles, 20);
    const ema50 = calcEMA(candles, 50);
    const e20 = chart.addLineSeries({ color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    e20.setData(ema20);
    const e50 = chart.addLineSeries({ color: "#818cf8", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    e50.setData(ema50);

    chart.timeScale().fitContent();
    chartRef.current = chart;

    // Volume sub-chart
    if (volContainerRef.current) {
      const volChart = createChart(volContainerRef.current, {
        layout: { background: { color: "#0a0e17" }, textColor: "#64748b" },
        grid: { vertLines: { color: "#111827" }, horzLines: { color: "#111827" } },
        width: volContainerRef.current.clientWidth,
        height: volContainerRef.current.clientHeight,
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1e293b", visible: false },
        rightPriceScale: { borderColor: "#1e293b", textColor: "#64748b", scaleMargins: { top: 0.1, bottom: 0 } },
        crosshair: { mode: 1 },
      });
      const volSeries = volChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
      volSeries.setData(candles.map(c => ({
        time: c.time, value: c.volume || 0,
        color: c.close >= c.open ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)"
      })));
      volChart.timeScale().fitContent();
      volChartRef.current = volChart;
    }

    // sync timescales
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range && volChartRef.current) {
        try { volChartRef.current.timeScale().setVisibleLogicalRange(range); } catch (_) {}
      }
    });

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        try { chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }); } catch (_) {}
      }
      if (volContainerRef.current && volChartRef.current) {
        try { volChartRef.current.applyOptions({ width: volContainerRef.current.clientWidth }); } catch (_) {}
      }
    };
    window.addEventListener("resize", handleResize);
  };

  return (
    <div className="flex flex-col h-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e17]/70 z-10">
          <Loader2 className="w-8 h-8 text-[#d4a843] animate-spin" />
        </div>
      )}
      {/* OHLCV bar */}
      {currentBar && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-3 text-[10px] bg-[#0a0e17]/80 rounded px-2 py-1">
          <span className="text-[#64748b]">O <span className="text-white">{currentBar.open?.toFixed(2)}</span></span>
          <span className="text-[#64748b]">H <span className="text-[#26a69a]">{currentBar.high?.toFixed(2)}</span></span>
          <span className="text-[#64748b]">L <span className="text-[#ef5350]">{currentBar.low?.toFixed(2)}</span></span>
          <span className="text-[#64748b]">C <span className="text-white font-bold">{currentBar.close?.toFixed(2)}</span></span>
          <span className="text-[#64748b]">Vol <span className="text-[#94a3b8]">{currentBar.volume ? (currentBar.volume / 1e6).toFixed(2) + "M" : "-"}</span></span>
        </div>
      )}
      {/* Main chart */}
      <div ref={containerRef} className="flex-1 w-full min-h-0" />
      {/* Volume sub-chart */}
      <div ref={volContainerRef} className="w-full" style={{ height: "80px" }} />
    </div>
  );
}

// ─── Stock List Panel (right sidebar) ────────────────────────────────────
function StockListPanel({ market, selectedSymbol, onSelect, search, setSearch }) {
  const sectors = market === "saudi" ? SAUDI_SECTORS : [{ sector: "الأسهم الأمريكية", items: US_STOCKS }];
  const [expanded, setExpanded] = useState(null);

  const allItems = sectors.flatMap(s => s.items);
  const filtered = search
    ? allItems.filter(s => s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.includes(search))
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="px-2 py-2 border-b border-[#1e293b]">
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#64748b]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث رمز/اسم..."
            className="w-full bg-[#0f1623] border border-[#1e293b] rounded-lg pr-6 pl-2 py-1.5 text-[11px] text-white placeholder-[#374151] outline-none focus:border-[#d4a843]/50" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered ? (
          <div>
            {filtered.map(s => (
              <StockRow key={s.symbol} stock={s} market={market} isActive={selectedSymbol === s.symbol} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          sectors.map(sec => (
            <div key={sec.sector}>
              <button onClick={() => setExpanded(expanded === sec.sector ? null : sec.sector)}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-[#111827] border-b border-[#0a0e17] text-[10px] font-bold text-[#64748b] hover:text-[#d4a843] transition-colors">
                <span>{sec.sector}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${expanded === sec.sector ? "rotate-180" : ""}`} />
              </button>
              {(expanded === sec.sector || expanded === null) && sec.items.map(s => (
                <StockRow key={s.symbol + sec.sector} stock={s} market={market} isActive={selectedSymbol === s.symbol} onSelect={onSelect} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StockRow({ stock, market, isActive, onSelect }) {
  const [quote, setQuote] = useState(null);
  useEffect(() => {
    getQuote(stock.symbol, market).then(q => setQuote(q)).catch(() => {});
  }, [stock.symbol, market]);

  const change = quote?.change_percent;
  const isUp = change >= 0;

  return (
    <button onClick={() => onSelect(stock)}
      className={`w-full flex items-center justify-between px-3 py-2 border-b border-[#0a0e17] text-right transition-all ${isActive ? "bg-[#d4a843]/15 border-r-2 border-r-[#d4a843]" : "hover:bg-[#1e293b]"}`}>
      <div className="text-right flex-1 min-w-0">
        <div className={`text-[11px] font-black ${isActive ? "text-[#e8c76a]" : "text-white"}`}>{stock.symbol}</div>
        <div className="text-[9px] text-[#64748b] truncate">{stock.name}</div>
      </div>
      <div className="text-left ml-1 shrink-0">
        {quote ? (
          <>
            <div className="text-[11px] font-bold text-white">{quote.price?.toFixed(2)}</div>
            <div className={`text-[9px] font-bold ${isUp ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
              {isUp ? "▲" : "▼"} {Math.abs(change || 0).toFixed(2)}%
            </div>
          </>
        ) : <div className="w-8 h-3 bg-[#1e293b] rounded animate-pulse" />}
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function ChartBoard() {
  const [market, setMarket] = useState("saudi");
  const [selectedStock, setSelectedStock] = useState({ symbol: "2222", name: "أرامكو", market: "saudi" });
  const [timeframe, setTimeframe] = useState("1D");
  const [chartType, setChartType] = useState("candlestick");
  const [candles, setCandles] = useState([]);
  const [showAI, setShowAI] = useState(false);
  const [search, setSearch] = useState("");
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    if (!selectedStock) return;
    setQuote(null);
    getQuote(selectedStock.symbol, market).then(q => setQuote(q)).catch(() => {});
  }, [selectedStock]);

  const handleSelect = (stock) => {
    setSelectedStock({ ...stock, market });
    setCandles([]);
    setShowAI(false);
  };

  const change = quote?.change_percent;
  const isUp = change >= 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0e17] -m-4 md:-m-6 lg:-m-8 relative">

      {/* ── RIGHT: Stock list ────────────────────── */}
      <div className="w-44 shrink-0 bg-[#111827] border-l border-[#1e293b] flex flex-col overflow-hidden">
        {/* Market tabs */}
        <div className="flex border-b border-[#1e293b]">
          <button onClick={() => { setMarket("saudi"); handleSelect({ symbol: "TASI", name: "تاسي" }); }}
            className={`flex-1 py-2 text-[10px] font-bold transition-all ${market === "saudi" ? "bg-[#d4a843]/20 text-[#d4a843]" : "text-[#64748b] hover:text-white"}`}>
            🇸🇦 سعودي
          </button>
          <button onClick={() => { setMarket("us"); handleSelect({ symbol: "AAPL", name: "Apple" }); }}
            className={`flex-1 py-2 text-[10px] font-bold transition-all ${market === "us" ? "bg-[#d4a843]/20 text-[#d4a843]" : "text-[#64748b] hover:text-white"}`}>
            🇺🇸 أمريكي
          </button>
        </div>

        {/* Header labels */}
        <div className="flex items-center justify-between px-3 py-1 border-b border-[#0a0e17]">
          <span className="text-[9px] text-[#64748b] font-bold">الاسم</span>
          <span className="text-[9px] text-[#64748b] font-bold">الرمز</span>
        </div>

        <StockListPanel
          market={market}
          selectedSymbol={selectedStock?.symbol}
          onSelect={handleSelect}
          search={search}
          setSearch={setSearch}
        />
      </div>

      {/* ── CENTER: Chart ────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-[#1e293b] bg-[#0d1117] shrink-0 flex-wrap">
          {/* Symbol info */}
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white">{selectedStock?.symbol}</span>
                <span className="text-xs text-[#64748b]">{selectedStock?.name}</span>
                {quote && (
                  <>
                    <span className="text-sm font-bold text-white">{quote.price?.toFixed(2)}</span>
                    <span className={`text-xs font-bold flex items-center gap-0.5 ${isUp ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
                      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(change || 0).toFixed(2)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Chart type */}
          <div className="flex gap-1">
            {CHART_TYPES.map(t => (
              <button key={t.value} onClick={() => setChartType(t.value)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${chartType === t.value ? "bg-[#d4a843] text-black" : "bg-[#1e293b] text-[#94a3b8] hover:text-white"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Timeframe */}
          <div className="flex gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button key={tf.value} onClick={() => setTimeframe(tf.value)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${timeframe === tf.value ? "bg-[#d4a843] text-black" : "bg-[#1e293b] text-[#94a3b8] hover:text-white"}`}>
                {tf.label}
              </button>
            ))}
          </div>

          {/* AI button */}
          <button onClick={() => setShowAI(!showAI)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showAI ? "bg-[#d4a843] text-black" : "bg-[#d4a843]/15 border border-[#d4a843]/40 text-[#d4a843] hover:bg-[#d4a843]/25"}`}>
            <Brain className="w-3.5 h-3.5" />
            ذكاء اصطناعي
          </button>
        </div>

        {/* AI Panel overlay */}
        {showAI && candles.length > 0 && (
          <div className="relative">
            <AiPanel symbol={selectedStock?.symbol} market={market} candles={candles} onClose={() => setShowAI(false)} />
          </div>
        )}

        {/* Chart area */}
        <div className="flex-1 min-h-0 relative">
          {selectedStock ? (
            <MainChart
              symbol={selectedStock.symbol}
              market={market}
              timeframe={timeframe}
              chartType={chartType}
              onCandlesLoaded={setCandles}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <BarChart3 className="w-16 h-16 text-[#1e293b]" />
              <p className="text-[#64748b]">اختر سهماً من القائمة</p>
            </div>
          )}
        </div>

        {/* Bottom legend */}
        <div className="flex items-center gap-4 px-3 py-1.5 border-t border-[#1e293b] bg-[#0d1117] shrink-0 text-[9px]">
          <span className="flex items-center gap-1 text-[#f59e0b]"><span className="w-4 h-0.5 bg-[#f59e0b] inline-block" /> EMA 20</span>
          <span className="flex items-center gap-1 text-[#818cf8]"><span className="w-4 h-0.5 bg-[#818cf8] inline-block" /> EMA 50</span>
          <span className="flex items-center gap-1 text-[#26a69a]">■ صعود</span>
          <span className="flex items-center gap-1 text-[#ef5350]">■ هبوط</span>
          <span className="flex-1" />
          <span className="text-[#64748b]">الرسم البياني المتقدم · مدعوم بالذكاء الاصطناعي</span>
        </div>
      </div>
    </div>
  );
}