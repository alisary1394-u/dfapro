import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { base44 } from "@/api/base44Client";
import { ChevronDown } from "lucide-react";
import IndicatorPanel, { useIndicators } from "./IndicatorPanel";
import { calcEMA, calcSMA, calcRSI, calcMACD, calcBollingerBands } from "./indicatorUtils";

const CHART_TYPES = [
  { value: "candlestick", label: "🕯 شموع يابانية" },
  { value: "hollow_candlestick", label: "⬜ شموع مفرغة" },
  { value: "bar", label: "▮ أعمدة" },
  { value: "line", label: "╱ خط" },
  { value: "area", label: "◿ منطقة" },
  { value: "baseline", label: "⇅ خط أساس" },
];

const TIMEFRAMES = [
  { label: "1د",  value: "1M",  interval: "1min",    limit: 100, aggregateMinutes: null },
  { label: "5د",  value: "5M",  interval: "5min",    limit: 100, aggregateMinutes: null },
  { label: "15د", value: "15M", interval: "15min",   limit: 100, aggregateMinutes: null },
  { label: "30د", value: "30M", interval: "30min",   limit: 100, aggregateMinutes: null },
  { label: "1س",  value: "1H",  interval: "60min",   limit: 100, aggregateMinutes: null },
  { label: "4س",  value: "4H",  interval: "60min",   limit: 200, aggregateMinutes: 240 },
  { label: "1ي",  value: "1D",  interval: "daily",   limit: 100, aggregateMinutes: null },
  { label: "1أ",  value: "1W",  interval: "weekly",  limit: 500, aggregateMinutes: null },
  { label: "1ش",  value: "1MO", interval: "monthly", limit: 240, aggregateMinutes: null },
  { label: "1سن", value: "1Y",  interval: "monthly", limit: 600, aggregateMinutes: null, aggregateMonths: 12 },
];

export default function TradingViewChart({ symbol, market = "us" }) {
  const containerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const macdContainerRef = useRef(null);
  const chartRef = useRef(null);
  const rsiChartRef = useRef(null);
  const macdChartRef = useRef(null);

  const [chartType, setChartType] = useState("candlestick");
  const [timeframe, setTimeframe] = useState("1D");
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allCandles, setAllCandles] = useState([]);
  const [chartData, setChartData] = useState([]);

  const { indicators, toggle, update } = useIndicators();

  const selectedTf = TIMEFRAMES.find(t => t.value === timeframe) || TIMEFRAMES[6];
  const selectedType = CHART_TYPES.find(t => t.value === chartType);

  // Build/destroy sub-charts when RSI/MACD toggles
  useEffect(() => {
    if (chartData.length === 0) return;
    renderIndicatorSubCharts(chartData, indicators);
  }, [indicators.RSI.enabled, indicators.RSI.period, indicators.MACD.enabled, indicators.MACD.fast, indicators.MACD.slow, indicators.MACD.signal, chartData]);

  // Re-apply MA overlays on main chart when MA settings change
  useEffect(() => {
    if (chartRef.current && chartData.length > 0) {
      applyOverlays(chartRef.current, chartData, indicators);
    }
  }, [
    indicators.MA.enabled, indicators.MA.type, indicators.MA.period, indicators.MA.color,
    indicators.MA2.enabled, indicators.MA2.type, indicators.MA2.period, indicators.MA2.color,
    indicators.MA3.enabled, indicators.MA3.type, indicators.MA3.period, indicators.MA3.color,
    indicators.BB.enabled, indicators.BB.period, indicators.BB.multiplier, indicators.BB.color,
    chartData,
  ]);

  function applyOverlays(chart, data, ind) {
    // We rebuild the main chart series to avoid keeping stale series references.
    // Instead, we store overlay series refs and remove/add them.
    // Since lightweight-charts v4 doesn't have removeSeries, we use chart.remove() and recreate.
    // The easiest approach: rebuild the whole chart (already handled in loadChart).
    // For overlay-only changes we do a lightweight rebuild via a dedicated ref.
    buildMainChart(data, ind);
  }

  function buildMainChart(data, ind) {
    if (!containerRef.current) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch (_) {}
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#0a0e17" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      width: containerRef.current.clientWidth,
      height: 420,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1e293b" },
      rightPriceScale: { borderColor: "#1e293b" },
      crosshair: { mode: 1 },
    });

    // Main series
    if (chartType === "candlestick") {
      const s = chart.addCandlestickSeries({ upColor: "#10b981", downColor: "#ef4444", borderUpColor: "#10b981", borderDownColor: "#ef4444", wickUpColor: "#10b981", wickDownColor: "#ef4444" });
      s.setData(data);
    } else if (chartType === "hollow_candlestick") {
      const s = chart.addCandlestickSeries({ upColor: "transparent", downColor: "#ef4444", borderUpColor: "#10b981", borderDownColor: "#ef4444", wickUpColor: "#10b981", wickDownColor: "#ef4444" });
      s.setData(data);
    } else if (chartType === "bar") {
      const s = chart.addBarSeries({ upColor: "#10b981", downColor: "#ef4444" });
      s.setData(data);
    } else if (chartType === "line") {
      const s = chart.addLineSeries({ color: "#d4a843", lineWidth: 2 });
      s.setData(data.map(d => ({ time: d.time, value: d.close })));
    } else if (chartType === "area") {
      const s = chart.addAreaSeries({ lineColor: "#d4a843", topColor: "rgba(212,168,67,0.35)", bottomColor: "rgba(212,168,67,0.02)" });
      s.setData(data.map(d => ({ time: d.time, value: d.close })));
    } else if (chartType === "baseline") {
      const baseValue = data[Math.floor(data.length / 2)]?.close || data[0]?.close;
      const s = chart.addBaselineSeries({ baseValue: { type: "price", price: baseValue }, topLineColor: "#10b981", topFillColor1: "rgba(16,185,129,0.2)", topFillColor2: "rgba(16,185,129,0.02)", bottomLineColor: "#ef4444", bottomFillColor1: "rgba(239,68,68,0.02)", bottomFillColor2: "rgba(239,68,68,0.2)" });
      s.setData(data.map(d => ({ time: d.time, value: d.close })));
    }

    // MA overlays
    ["MA", "MA2", "MA3"].forEach((key) => {
      const cfg = ind[key];
      if (!cfg.enabled) return;
      const maData = cfg.type === "EMA" ? calcEMA(data, cfg.period) : calcSMA(data, cfg.period);
      const s = chart.addLineSeries({ color: cfg.color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
      s.setData(maData);
    });

    // Bollinger Bands
    if (ind.BB.enabled) {
      const { upper, middle, lower } = calcBollingerBands(data, ind.BB.period, ind.BB.multiplier);
      const alpha = "40";
      const colAlpha = ind.BB.color + alpha;
      const uSeries = chart.addLineSeries({ color: ind.BB.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2 });
      const mSeries = chart.addLineSeries({ color: ind.BB.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const lSeries = chart.addLineSeries({ color: ind.BB.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2 });
      uSeries.setData(upper);
      mSeries.setData(middle);
      lSeries.setData(lower);
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        try { chartRef.current.applyOptions({ width: containerRef.current.clientWidth }); } catch (_) {}
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }

  function renderIndicatorSubCharts(data, ind) {
    // RSI
    if (rsiContainerRef.current) {
      if (rsiChartRef.current) { try { rsiChartRef.current.remove(); } catch (_) {} rsiChartRef.current = null; }
      if (ind.RSI.enabled) {
        const rsiChart = createChart(rsiContainerRef.current, {
          layout: { background: { color: "#0a0e17" }, textColor: "#94a3b8" },
          grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
          width: rsiContainerRef.current.clientWidth,
          height: 120,
          timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1e293b" },
          rightPriceScale: { borderColor: "#1e293b", scaleMargins: { top: 0.1, bottom: 0.1 } },
          crosshair: { mode: 1 },
        });
        const rsiData = calcRSI(data, ind.RSI.period);
        const rsiSeries = rsiChart.addLineSeries({ color: "#22d3ee", lineWidth: 1.5, priceLineVisible: false });
        rsiSeries.setData(rsiData);
        // Overbought/oversold lines
        const obSeries = rsiChart.addLineSeries({ color: "rgba(239,68,68,0.5)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 1 });
        const osSeries = rsiChart.addLineSeries({ color: "rgba(16,185,129,0.5)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 1 });
        if (rsiData.length > 0) {
          obSeries.setData(rsiData.map(d => ({ time: d.time, value: 70 })));
          osSeries.setData(rsiData.map(d => ({ time: d.time, value: 30 })));
        }
        rsiChart.timeScale().fitContent();
        rsiChartRef.current = rsiChart;

        const handleResize = () => {
          if (rsiContainerRef.current && rsiChartRef.current) {
            try { rsiChartRef.current.applyOptions({ width: rsiContainerRef.current.clientWidth }); } catch (_) {}
          }
        };
        window.addEventListener("resize", handleResize);
      }
    }

    // MACD
    if (macdContainerRef.current) {
      if (macdChartRef.current) { try { macdChartRef.current.remove(); } catch (_) {} macdChartRef.current = null; }
      if (ind.MACD.enabled) {
        const macdChart = createChart(macdContainerRef.current, {
          layout: { background: { color: "#0a0e17" }, textColor: "#94a3b8" },
          grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
          width: macdContainerRef.current.clientWidth,
          height: 120,
          timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1e293b" },
          rightPriceScale: { borderColor: "#1e293b", scaleMargins: { top: 0.1, bottom: 0.1 } },
          crosshair: { mode: 1 },
        });
        const { macdLine, signalLine, histogram } = calcMACD(data, ind.MACD.fast, ind.MACD.slow, ind.MACD.signal);
        const histSeries = macdChart.addHistogramSeries({
          color: "#a78bfa",
          priceLineVisible: false,
        });
        histSeries.setData(histogram.map(d => ({ time: d.time, value: d.value, color: d.value >= 0 ? "rgba(16,185,129,0.6)" : "rgba(239,68,68,0.6)" })));

        const macdSeries = macdChart.addLineSeries({ color: "#818cf8", lineWidth: 1.5, priceLineVisible: false });
        macdSeries.setData(macdLine);
        const signalSeries = macdChart.addLineSeries({ color: "#f59e0b", lineWidth: 1.5, priceLineVisible: false });
        signalSeries.setData(signalLine);
        macdChart.timeScale().fitContent();
        macdChartRef.current = macdChart;

        const handleResize = () => {
          if (macdContainerRef.current && macdChartRef.current) {
            try { macdChartRef.current.applyOptions({ width: macdContainerRef.current.clientWidth }); } catch (_) {}
          }
        };
        window.addEventListener("resize", handleResize);
      }
    }
  }

  useEffect(() => {
    if (!symbol || !containerRef.current) return;

    const loadChart = async () => {
      setLoading(true);
      try {
        if (chartRef.current) { try { chartRef.current.remove(); } catch (_) {} chartRef.current = null; }

        const response = await base44.functions.invoke("marketData", {
          action: "candles", symbol, market,
          interval: selectedTf.interval,
          limit: selectedTf.limit,
        });

        const rawCandles = response.data?.candles || [];
        if (rawCandles.length === 0) { setLoading(false); return; }

        const isIntraday = ["1min","5min","15min","30min","60min"].includes(selectedTf.interval);

        const normalized = rawCandles
          .map((c) => {
            let timeVal;
            if (isIntraday) {
              if (typeof c.time === "number" && c.time > 1e10) timeVal = Math.floor(c.time / 1000);
              else if (typeof c.time === "number") timeVal = c.time;
              else timeVal = Math.floor(new Date(c.time).getTime() / 1000);
            } else {
              if (typeof c.time === "string") timeVal = c.time.substring(0, 10);
              else if (typeof c.time === "number" && c.time > 1e10) timeVal = new Date(c.time).toISOString().substring(0, 10);
              else timeVal = new Date(c.time * 1000).toISOString().substring(0, 10);
            }
            return { time: timeVal, open: c.open, high: c.high, low: c.low, close: c.close };
          })
          .filter(c => c.time && c.open && c.close)
          .sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));

        let processedCandles = normalized;
        if (selectedTf.aggregateMonths) {
          const groups = {};
          normalized.forEach(c => {
            const year = c.time.substring(0, 4);
            if (!groups[year]) groups[year] = [];
            groups[year].push(c);
          });
          processedCandles = Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([year, g]) => ({ time: `${year}-01-01`, open: g[0].open, high: Math.max(...g.map(c => c.high)), low: Math.min(...g.map(c => c.low)), close: g[g.length - 1].close }));
        } else if (selectedTf.aggregateMinutes) {
          const groups = {};
          normalized.forEach(c => {
            const ts = typeof c.time === "number" ? c.time : Math.floor(new Date(c.time).getTime() / 1000);
            const key = Math.floor(ts / (selectedTf.aggregateMinutes * 60));
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
          });
          processedCandles = Object.entries(groups)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([key, g]) => ({ time: Number(key) * selectedTf.aggregateMinutes * 60, open: g[0].open, high: Math.max(...g.map(c => c.high)), low: Math.min(...g.map(c => c.low)), close: g[g.length - 1].close }));
        }

        const seen = new Set();
        const uniqueChartData = processedCandles.filter(c => {
          if (seen.has(c.time)) return false;
          seen.add(c.time);
          return true;
        });

        setAllCandles(uniqueChartData);
        setChartData(uniqueChartData);
        buildMainChart(uniqueChartData, indicators);
        renderIndicatorSubCharts(uniqueChartData, indicators);
        setLoading(false);

      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    loadChart();

    return () => {
      if (chartRef.current) { try { chartRef.current.remove(); } catch (_) {} chartRef.current = null; }
      if (rsiChartRef.current) { try { rsiChartRef.current.remove(); } catch (_) {} rsiChartRef.current = null; }
      if (macdChartRef.current) { try { macdChartRef.current.remove(); } catch (_) {} macdChartRef.current = null; }
    };
  }, [symbol, market, timeframe, chartType]);

  return (
    <div className="w-full bg-[#0a0e17] rounded-xl border border-[#1e293b] overflow-hidden">
      {/* Toolbar */}
      <div className="p-3 border-b border-[#1e293b] flex flex-wrap items-center gap-3">

        {/* Chart Type Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#111827] hover:bg-[#1e293b] rounded-lg border border-[#1e293b] text-xs text-white transition-colors"
          >
            {selectedType?.label}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showTypeMenu && (
            <div className="absolute top-full right-0 mt-1 bg-[#111827] border border-[#1e293b] rounded-lg shadow-xl z-20 min-w-[150px]">
              {CHART_TYPES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => { setChartType(option.value); setShowTypeMenu(false); }}
                  className={`w-full text-right px-4 py-2 text-xs transition-colors ${chartType === option.value ? "bg-[#d4a843]/20 text-[#d4a843]" : "text-white hover:bg-[#1e293b]"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Timeframe Buttons */}
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                timeframe === tf.value ? "bg-[#d4a843] text-black font-bold" : "bg-[#1e293b] text-[#94a3b8] hover:text-white hover:bg-[#2d3748]"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Indicator Panel */}
        <IndicatorPanel indicators={indicators} onToggle={toggle} onUpdate={update} />

        {loading && (
          <div className="mr-auto flex items-center gap-1.5 text-xs text-[#94a3b8]">
            <div className="w-3 h-3 rounded-full border-2 border-[#d4a843] border-t-transparent animate-spin" />
            جاري التحميل...
          </div>
        )}
      </div>

      {/* Main Chart */}
      <div ref={containerRef} className="w-full" style={{ height: "420px" }} />

      {/* RSI Sub-chart */}
      {indicators.RSI.enabled && (
        <div className="border-t border-[#1e293b]">
          <div className="px-3 py-1 flex items-center gap-2 bg-[#0d1117]">
            <span className="text-[10px] text-[#22d3ee] font-bold">RSI ({indicators.RSI.period})</span>
            <span className="text-[10px] text-[#94a3b8]">— خط 70 أحمر | خط 30 أخضر</span>
          </div>
          <div ref={rsiContainerRef} className="w-full" style={{ height: "120px" }} />
        </div>
      )}

      {/* MACD Sub-chart */}
      {indicators.MACD.enabled && (
        <div className="border-t border-[#1e293b]">
          <div className="px-3 py-1 flex items-center gap-3 bg-[#0d1117]">
            <span className="text-[10px] text-[#818cf8] font-bold">MACD ({indicators.MACD.fast},{indicators.MACD.slow},{indicators.MACD.signal})</span>
            <span className="flex items-center gap-1 text-[10px] text-[#818cf8]">■ خط MACD</span>
            <span className="flex items-center gap-1 text-[10px] text-[#f59e0b]">■ خط الإشارة</span>
          </div>
          <div ref={macdContainerRef} className="w-full" style={{ height: "120px" }} />
        </div>
      )}

      {/* Stats Bar */}
      {allCandles.length > 0 && <CandleStatsBar candles={allCandles} />}
    </div>
  );
}

function CandleStatsBar({ candles }) {
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const monthStr = now.toISOString().substring(0, 7);
  const yearStr = now.toISOString().substring(0, 4);

  const filterAndAggregate = (filterFn) => {
    const filtered = candles.filter(c => {
      const d = typeof c.time === "number" ? new Date(c.time * 1000) : new Date(c.time);
      return filterFn(d);
    });
    if (filtered.length === 0) return null;
    return {
      open: filtered[0].open,
      high: Math.max(...filtered.map(c => c.high)),
      low: Math.min(...filtered.map(c => c.low)),
      close: filtered[filtered.length - 1].close,
      volume: filtered.reduce((s, c) => s + (c.volume || 0), 0),
    };
  };

  const last = candles[candles.length - 1];
  const fallback = { open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume || 0 };

  const sections = [
    { label: "اليوم",   data: filterAndAggregate(d => d.toISOString().substring(0, 10) === todayStr) || fallback },
    { label: "الأسبوع", data: filterAndAggregate(d => d >= weekStart) || fallback },
    { label: "الشهر",   data: filterAndAggregate(d => d.toISOString().substring(0, 7) === monthStr) || fallback },
    { label: "السنة",   data: filterAndAggregate(d => d.toISOString().substring(0, 4) === yearStr) || fallback },
  ];

  const fmt = (n) => n == null ? "-" : n >= 1e9 ? (n/1e9).toFixed(2)+"B" : n >= 1e6 ? (n/1e6).toFixed(2)+"M" : n >= 1e3 ? (n/1e3).toFixed(1)+"K" : n.toFixed(2);

  return (
    <div className="border-t border-[#1e293b] grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1e293b]">
      {sections.map(({ label, data }) => {
        const change = data.close - data.open;
        const changePct = (change / data.open) * 100;
        const isUp = change >= 0;
        return (
          <div key={label} className="bg-[#0a0e17] px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-[#94a3b8] font-medium">{label}</span>
              <span className={`text-[10px] font-bold ${isUp ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                {isUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
              <span className="text-[#64748b]">فتح</span><span className="text-[#f1f5f9] text-left">{fmt(data.open)}</span>
              <span className="text-[#64748b]">أعلى</span><span className="text-[#10b981] text-left">{fmt(data.high)}</span>
              <span className="text-[#64748b]">أدنى</span><span className="text-[#ef4444] text-left">{fmt(data.low)}</span>
              <span className="text-[#64748b]">إغلاق</span><span className={`text-left font-bold ${isUp ? "text-[#10b981]" : "text-[#ef4444]"}`}>{fmt(data.close)}</span>
              <span className="text-[#64748b]">حجم</span><span className="text-[#94a3b8] text-left">{fmt(data.volume)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}