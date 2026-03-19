import React, { useState, useEffect, useRef, useMemo } from "react";
import { createChart } from "lightweight-charts";
import { base44 } from "@/api/base44Client";
import { getQuote } from "@/components/api/marketDataClient";
import {
  Search, Brain, RefreshCw, Loader2, BarChart3,
  ArrowUpRight, ArrowDownRight, ChevronDown, X,
  Maximize2, Minimize2, Layers,
  TrendingUp, TrendingDown, Minus, Crosshair,
  Type, RulerIcon, PenLine, Eraser, Circle,
  RectangleHorizontal, Hash, Activity
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
const TIMEFRAMES = [
  { label: "1د", value: "1M", interval: "1min", limit: 100 },
  { label: "2د", value: "2M", interval: "2min", limit: 100 },
  { label: "3د", value: "3M", interval: "3min", limit: 100 },
  { label: "5د", value: "5M", interval: "5min", limit: 100 },
  { label: "15د", value: "15M", interval: "15min", limit: 100 },
  { label: "30د", value: "30M", interval: "30min", limit: 150 },
  { label: "1س", value: "1H", interval: "60min", limit: 200 },
  { label: "2س", value: "2H", interval: "120min", limit: 200 },
  { label: "4س", value: "4H", interval: "240min", limit: 200 },
  { label: "يومي", value: "1D", interval: "daily", limit: 365 },
  { label: "أسبوعي", value: "1W", interval: "weekly", limit: 260 },
  { label: "شهري", value: "1MO", interval: "monthly", limit: 120 },
];

const CHART_TYPES = [
  { value: "candlestick", label: "شموع يابانية" },
  { value: "heikinashi", label: "هيكن آشي" },
  { value: "line", label: "خطي" },
  { value: "area", label: "مساحة" },
  { value: "bar", label: "OHLC" },
];

const C = {
  bg: "#060a11", card: "#0d1420", border: "#1a2540",
  up: "#00c087", down: "#ff4757", gold: "#d4a843",
  dim: "#475569", muted: "#64748b",
};

const chartOpts = (container) => ({
  layout: { background: { color: C.bg }, textColor: C.dim },
  grid: { vertLines: { color: "#0d1420" }, horzLines: { color: "#0d1420" } },
  width: container.clientWidth,
  crosshair: {
    mode: 0,
    vertLine: { color: "rgba(212,168,67,0.3)", labelBackgroundColor: C.gold },
    horzLine: { color: "rgba(212,168,67,0.3)", labelBackgroundColor: C.gold },
  },
  timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
  rightPriceScale: { borderColor: C.border, textColor: C.dim },
});

const calcVWAP = (data) => {
  let cumVP = 0, cumVol = 0;
  return data.map(c => {
    const tp = (c.high + c.low + c.close) / 3;
    cumVP += tp * (c.volume || 0);
    cumVol += (c.volume || 0);
    return { time: c.time, value: cumVol > 0 ? parseFloat((cumVP / cumVol).toFixed(4)) : tp };
  });
};

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
    const last30 = candles.slice(-30);
    const prices = last30.map(c => c.close);
    const high = Math.max(...last30.map(c => c.high));
    const low = Math.min(...last30.map(c => c.low));
    const latest = candles[candles.length - 1];
    const rsiData = calcRSI(candles, 14);
    const rsiValue = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : null;
    const macdResult = calcMACD(candles);
    const lastMacd = macdResult.macdLine.length > 0 ? macdResult.macdLine[macdResult.macdLine.length - 1].value : null;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `أنت محلل أسواق مالية محترف متخصص بالتحليل الفني. حلل السهم ${symbol} بناءً على البيانات التالية:
- آخر 30 شمعة إغلاق: ${prices.join(", ")}
- أعلى سعر: ${high} | أدنى سعر: ${low}
- سعر الافتتاح: ${latest.open} | الإغلاق: ${latest.close}
- RSI الحالي: ${rsiValue || 'غير متوفر'}
- MACD الحالي: ${lastMacd || 'غير متوفر'}

قدم تحليلاً فنياً شاملاً يتضمن:
1. الاتجاه العام (صاعد/هابط/جانبي) مع السبب
2. أقرب مستويات الدعم والمقاومة
3. قوة الزخم الحالية
4. نقاط الدخول والخروج المقترحة
5. التوصية النهائية (شراء قوي/شراء/انتظار/بيع/بيع قوي)
6. مستوى المخاطرة (منخفض/متوسط/عالي)
7. ملاحظة تحليلية مهمة`,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            trend: { type: "string" },
            trend_reason: { type: "string" },
            support: { type: "number" },
            resistance: { type: "number" },
            momentum: { type: "string" },
            entry_point: { type: "number" },
            exit_point: { type: "number" },
            recommendation: { type: "string" },
            risk_level: { type: "string" },
            note: { type: "string" },
            confidence: { type: "number" }
          }
        }
      });
      setResult(res);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const recColor = result?.recommendation?.includes("شراء") ? C.up
    : result?.recommendation?.includes("بيع") ? C.down : C.gold;
  const riskColor = result?.risk_level?.includes("عالي") ? C.down
    : result?.risk_level?.includes("منخفض") ? C.up : C.gold;

  return (
    <div className="absolute top-2 left-2 w-72 bg-[#0d1420]/98 border border-[#d4a843]/25 rounded-xl shadow-2xl z-30 backdrop-blur-xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a2540]">
        <div className="flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-[#d4a843]" />
          <span className="text-xs font-bold text-[#d4a843]">محلل الذكاء الاصطناعي</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[#1a2540] rounded text-[#64748b] transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <Loader2 className="w-7 h-7 text-[#d4a843] animate-spin" />
            <span className="text-xs text-[#64748b]">يحلل البيانات الفنية...</span>
          </div>
        ) : result ? (
          <>
            <div className="flex items-center justify-between bg-[#060a11] rounded-lg p-2.5">
              <span className="text-[10px] text-[#64748b]">التوصية</span>
              <span className="text-sm font-black px-3 py-0.5 rounded-full" style={{ color: recColor, backgroundColor: `${recColor}15`, border: `1px solid ${recColor}40` }}>
                {result.recommendation}
              </span>
            </div>
            <div className="bg-[#060a11] rounded-lg p-2.5">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] text-[#64748b]">الاتجاه</span>
                <span className="text-xs font-bold text-white">{result.trend}</span>
              </div>
              {result.trend_reason && <p className="text-[9px] text-[#475569] leading-relaxed">{result.trend_reason}</p>}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-[#00c087]/8 border border-[#00c087]/15 rounded-lg p-2 text-center">
                <p className="text-[8px] text-[#64748b]">دعم</p>
                <p className="text-xs font-bold text-[#00c087]">{result.support?.toFixed(2)}</p>
              </div>
              <div className="bg-[#ff4757]/8 border border-[#ff4757]/15 rounded-lg p-2 text-center">
                <p className="text-[8px] text-[#64748b]">مقاومة</p>
                <p className="text-xs font-bold text-[#ff4757]">{result.resistance?.toFixed(2)}</p>
              </div>
              {result.entry_point && (
                <div className="bg-[#3b82f6]/8 border border-[#3b82f6]/15 rounded-lg p-2 text-center">
                  <p className="text-[8px] text-[#64748b]">نقطة الدخول</p>
                  <p className="text-xs font-bold text-[#3b82f6]">{result.entry_point?.toFixed(2)}</p>
                </div>
              )}
              {result.exit_point && (
                <div className="bg-[#a855f7]/8 border border-[#a855f7]/15 rounded-lg p-2 text-center">
                  <p className="text-[8px] text-[#64748b]">نقطة الخروج</p>
                  <p className="text-xs font-bold text-[#a855f7]">{result.exit_point?.toFixed(2)}</p>
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              {result.momentum && (
                <div className="flex-1 bg-[#060a11] rounded-lg p-2 text-center">
                  <p className="text-[8px] text-[#64748b]">الزخم</p>
                  <p className="text-[10px] font-bold text-white">{result.momentum}</p>
                </div>
              )}
              {result.risk_level && (
                <div className="flex-1 bg-[#060a11] rounded-lg p-2 text-center">
                  <p className="text-[8px] text-[#64748b]">المخاطرة</p>
                  <p className="text-[10px] font-bold" style={{ color: riskColor }}>{result.risk_level}</p>
                </div>
              )}
            </div>
            {result.confidence && (
              <div className="bg-[#060a11] rounded-lg p-2">
                <div className="flex justify-between mb-1">
                  <span className="text-[9px] text-[#64748b]">ثقة التحليل</span>
                  <span className="text-[9px] text-white font-bold">{result.confidence}%</span>
                </div>
                <div className="h-1.5 bg-[#1a2540] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${result.confidence}%`, background: `linear-gradient(90deg, ${C.gold}, #f59e0b)` }} />
                </div>
              </div>
            )}
            {result.note && (
              <div className="bg-[#d4a843]/5 border border-[#d4a843]/15 rounded-lg p-2">
                <p className="text-[10px] text-[#94a3b8] leading-relaxed">💡 {result.note}</p>
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
// INDICATOR MENU
// ═══════════════════════════════════════════════════════════════
function IndicatorMenu({ overlays, setOverlays, subs, setSubs, onClose }) {
  const toggleOverlay = (key) => setOverlays(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  const toggleSub = (key) => setSubs(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));

  const Toggle = ({ label, color, enabled, onToggle }) => (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#1a2540]/50 transition-colors">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[11px] text-white">{label}</span>
      </div>
      <button onClick={onToggle}
        className={`w-8 h-4 rounded-full transition-all relative shrink-0 ${enabled ? "bg-[#d4a843]" : "bg-[#374151]"}`}>
        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow ${enabled ? "right-0.5" : "left-0.5"}`} />
      </button>
    </div>
  );

  return (
    <div className="absolute top-full right-0 mt-1 bg-[#0d1420] border border-[#1a2540] rounded-xl shadow-2xl z-40 w-64 backdrop-blur-xl">
      <div className="p-2.5 border-b border-[#1a2540] flex items-center justify-between">
        <span className="text-xs font-bold text-white">المؤشرات الفنية</span>
        <button onClick={onClose} className="p-0.5 hover:bg-[#1a2540] rounded text-[#64748b]"><X className="w-3 h-3" /></button>
      </div>
      <div className="p-2">
        <p className="text-[9px] text-[#64748b] font-bold mb-1 px-1 tracking-wider">المتوسطات والأشرطة</p>
        <Toggle label={`EMA ${overlays.ema20.period}`} color={overlays.ema20.color} enabled={overlays.ema20.enabled} onToggle={() => toggleOverlay("ema20")} />
        <Toggle label={`EMA ${overlays.ema50.period}`} color={overlays.ema50.color} enabled={overlays.ema50.enabled} onToggle={() => toggleOverlay("ema50")} />
        <Toggle label={`SMA ${overlays.sma200.period}`} color={overlays.sma200.color} enabled={overlays.sma200.enabled} onToggle={() => toggleOverlay("sma200")} />
        <Toggle label="Bollinger Bands" color={overlays.bb.color} enabled={overlays.bb.enabled} onToggle={() => toggleOverlay("bb")} />
        <Toggle label="VWAP" color={overlays.vwap.color} enabled={overlays.vwap.enabled} onToggle={() => toggleOverlay("vwap")} />
      </div>
      <div className="p-2 border-t border-[#1a2540]">
        <p className="text-[9px] text-[#64748b] font-bold mb-1 px-1 tracking-wider">المذبذبات (لوحات فرعية)</p>
        <Toggle label={`RSI (${subs.rsi.period})`} color="#22d3ee" enabled={subs.rsi.enabled} onToggle={() => toggleSub("rsi")} />
        <Toggle label={`MACD (${subs.macd.fast},${subs.macd.slow},${subs.macd.signal})`} color="#a78bfa" enabled={subs.macd.enabled} onToggle={() => toggleSub("macd")} />
        <Toggle label={`Stochastic (${subs.stochastic.kPeriod},${subs.stochastic.dPeriod})`} color="#f472b6" enabled={subs.stochastic.enabled} onToggle={() => toggleSub("stochastic")} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STOCK LIST
// ═══════════════════════════════════════════════════════════════
function StockRow({ stock, market, isActive, onSelect }) {
  const [quote, setQuote] = useState(null);
  useEffect(() => {
    const fetchQuote = () => getQuote(stock.symbol, market).then(q => setQuote(q)).catch(() => {});
    fetchQuote();
    const iv = setInterval(fetchQuote, 10000);
    return () => clearInterval(iv);
  }, [stock.symbol, market]);

  const change = quote?.change_percent;
  const isUp = change >= 0;

  return (
    <button onClick={() => onSelect(stock)}
      className={`w-full flex items-center justify-between px-3 py-2 border-b border-[#060a11] text-right transition-all ${
        isActive ? "bg-[#d4a843]/12 border-r-2 border-r-[#d4a843]" : "hover:bg-[#0d1420]"}`}>
      <div className="text-right flex-1 min-w-0">
        <div className={`text-[11px] font-black ${isActive ? "text-[#d4a843]" : "text-white"}`}>{stock.symbol}</div>
        <div className="text-[9px] text-[#475569] truncate">{stock.name}</div>
      </div>
      <div className="text-left ml-1 shrink-0">
        {quote ? (
          <>
            <div className="text-[11px] font-bold text-white">{quote.price?.toFixed(2)}</div>
            <div className={`text-[9px] font-bold ${isUp ? "text-[#00c087]" : "text-[#ff4757]"}`}>
              {isUp ? "▲" : "▼"} {Math.abs(change || 0).toFixed(2)}%
            </div>
          </>
        ) : <div className="w-8 h-3 bg-[#1a2540] rounded animate-pulse" />}
      </div>
    </button>
  );
}

function StockListPanel({ market, selectedSymbol, onSelect, search, setSearch }) {
  const sectors = market === "saudi" ? SAUDI_SECTORS : [{ sector: "الأسهم الأمريكية", items: US_STOCKS }];
  const [expanded, setExpanded] = useState(null);
  const allItems = sectors.flatMap(s => s.items);
  const filtered = search ? allItems.filter(s => s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.includes(search)) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 py-2 border-b border-[#1a2540]">
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث رمز أو اسم..."
            className="w-full bg-[#060a11] border border-[#1a2540] rounded-lg pr-7 pl-2 py-1.5 text-[11px] text-white placeholder-[#374151] outline-none focus:border-[#d4a843]/50 transition-colors" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered ? filtered.map(s => (
          <StockRow key={s.symbol} stock={s} market={market} isActive={selectedSymbol === s.symbol} onSelect={onSelect} />
        )) : sectors.map(sec => (
          <div key={sec.sector}>
            <button onClick={() => setExpanded(expanded === sec.sector ? null : sec.sector)}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-[#0a0f18] border-b border-[#060a11] text-[10px] font-bold text-[#475569] hover:text-[#d4a843] transition-colors">
              <span>{sec.sector}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded === sec.sector ? "rotate-180" : ""}`} />
            </button>
            {(expanded === sec.sector || expanded === null) && sec.items.map(s => (
              <StockRow key={s.symbol + sec.sector} stock={s} market={market} isActive={selectedSymbol === s.symbol} onSelect={onSelect} />
            ))}
          </div>
        ))}
      </div>
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
  const [chartType, setChartType] = useState("candlestick");
  const [candles, setCandles] = useState([]);
  const [showAI, setShowAI] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [search, setSearch] = useState("");
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentBar, setCurrentBar] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawingTool, setDrawingTool] = useState(null);

  // Overlay indicators (rendered on main chart)
  const [overlays, setOverlays] = useState({
    ema20: { enabled: true, period: 20, color: "#f59e0b" },
    ema50: { enabled: true, period: 50, color: "#818cf8" },
    sma200: { enabled: false, period: 200, color: "#fb923c" },
    bb: { enabled: false, period: 20, multiplier: 2, color: "#a78bfa" },
    vwap: { enabled: false, color: "#22d3ee" },
  });

  // Sub-panel oscillators
  const [subs, setSubs] = useState({
    rsi: { enabled: false, period: 14 },
    macd: { enabled: false, fast: 12, slow: 26, signal: 9 },
    stochastic: { enabled: false, kPeriod: 14, dPeriod: 3 },
  });

  // Drawing state
  const drawCanvasRef = useRef(null);
  const drawingsRef = useRef([]);
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef(null);
  const freehandPointsRef = useRef([]);

  // Chart refs
  const mainContainerRef = useRef(null);
  const mainChartRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const rsiChartRef = useRef(null);
  const macdContainerRef = useRef(null);
  const macdChartRef = useRef(null);
  const stochContainerRef = useRef(null);
  const stochChartRef = useRef(null);
  const savedRangeRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const overlaySeriesRef = useRef([]);
  const prevChartTypeRef = useRef(null);
  const prevOverlaysRef = useRef(null);
  const prevSubsRef = useRef(null);

  const selectedTf = useMemo(() => TIMEFRAMES.find(t => t.value === timeframe) || TIMEFRAMES[4], [timeframe]);

  // ── Fetch Quote ──
  useEffect(() => {
    if (!selectedStock) return;
    let first = true;
    const fetchQuote = () => {
      if (first) { setQuote(null); first = false; }
      getQuote(selectedStock.symbol, market).then(q => setQuote(q)).catch(() => {});
    };
    fetchQuote();
    const iv = setInterval(fetchQuote, 3000);
    return () => clearInterval(iv);
  }, [selectedStock, market]);

  // ── Fetch Candles ──
  useEffect(() => {
    if (!selectedStock) return;
    savedRangeRef.current = null;
    fetchCandles(true);
    const iv = setInterval(() => fetchCandles(false), 5000);
    return () => clearInterval(iv);
  }, [selectedStock, market, timeframe]);

  const fetchCandles = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await base44.functions.invoke("marketData", {
        action: "candles",
        symbol: selectedStock.symbol,
        market,
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
      const processed = normalized
        .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
        .sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));

      if (processed.length > 0) {
        // Only update state if data actually changed (compare last candle)
        setCandles(prev => {
          if (prev.length === processed.length) {
            const lastPrev = prev[prev.length - 1];
            const lastNew = processed[processed.length - 1];
            if (lastPrev && lastNew && 
                lastPrev.time === lastNew.time && 
                lastPrev.close === lastNew.close &&
                lastPrev.volume === lastNew.volume) {
              return prev; // same reference = no re-render
            }
          }
          return processed;
        });
        setCurrentBar(processed[processed.length - 1]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // ── Build All Charts ──
  // Determine if we need a full rebuild or just data update
  const needsRebuild = () => {
    if (!mainChartRef.current || !mainSeriesRef.current) return true;
    if (prevChartTypeRef.current !== chartType) return true;
    if (JSON.stringify(prevOverlaysRef.current) !== JSON.stringify(overlays)) return true;
    if (JSON.stringify(prevSubsRef.current) !== JSON.stringify(subs)) return true;
    return false;
  };

  useEffect(() => {
    if (!candles || candles.length === 0) return;

    // If only data changed, update existing series without rebuilding
    if (!needsRebuild()) {
      let displayData = candles;
      if (chartType === "heikinashi") displayData = toHeikinAshi(candles);

      // Update main series
      if (mainSeriesRef.current) {
        if (chartType === "candlestick" || chartType === "heikinashi" || chartType === "bar") {
          mainSeriesRef.current.setData(displayData);
        } else {
          mainSeriesRef.current.setData(displayData.map(c => ({ time: c.time, value: c.close })));
        }
      }
      // Update volume
      if (volSeriesRef.current) {
        volSeriesRef.current.setData(candles.map(c => ({
          time: c.time, value: c.volume || 0,
          color: c.close >= c.open ? "rgba(0,192,135,0.2)" : "rgba(255,71,87,0.2)",
        })));
      }
      // Update overlay series data
      let idx = 0;
      if (overlays.ema20.enabled && overlaySeriesRef.current[idx]) overlaySeriesRef.current[idx].setData(calcEMA(candles, overlays.ema20.period));
      if (overlays.ema20.enabled) idx++;
      if (overlays.ema50.enabled && overlaySeriesRef.current[idx]) overlaySeriesRef.current[idx].setData(calcEMA(candles, overlays.ema50.period));
      if (overlays.ema50.enabled) idx++;
      if (overlays.sma200.enabled && overlaySeriesRef.current[idx]) overlaySeriesRef.current[idx].setData(calcSMA(candles, overlays.sma200.period));
      if (overlays.sma200.enabled) idx++;
      if (overlays.bb.enabled) {
        const bb = calcBollingerBands(candles, overlays.bb.period, overlays.bb.multiplier);
        if (overlaySeriesRef.current[idx]) overlaySeriesRef.current[idx].setData(bb.upper);
        idx++;
        if (overlaySeriesRef.current[idx]) overlaySeriesRef.current[idx].setData(bb.middle);
        idx++;
        if (overlaySeriesRef.current[idx]) overlaySeriesRef.current[idx].setData(bb.lower);
        idx++;
      }
      if (overlays.vwap.enabled && overlaySeriesRef.current[idx]) overlaySeriesRef.current[idx].setData(calcVWAP(candles));

      // Update sub charts data only
      if (subs.rsi.enabled && rsiChartRef.current) {
        // RSI data update not easily done without series ref - skip, it's rarely changed
      }
      setCurrentBar(candles[candles.length - 1]);
      return; // no cleanup needed for data-only update
    }

    // Full rebuild
    const cleanups = [];
    prevChartTypeRef.current = chartType;
    prevOverlaysRef.current = JSON.parse(JSON.stringify(overlays));
    prevSubsRef.current = JSON.parse(JSON.stringify(subs));

    // === MAIN CHART ===
    const mainContainer = mainContainerRef.current;
    if (mainContainer) {
      // Save current visible range before destroying
      if (mainChartRef.current) {
        try { savedRangeRef.current = mainChartRef.current.timeScale().getVisibleLogicalRange(); } catch (_) {}
        try { mainChartRef.current.remove(); } catch (_) {}
      }

      const chart = createChart(mainContainer, {
        ...chartOpts(mainContainer),
        height: mainContainer.clientHeight,
      });

      // Determine data
      let displayData = candles;
      if (chartType === "heikinashi") displayData = toHeikinAshi(candles);

      // Main series
      let mainSeries;
      if (chartType === "candlestick" || chartType === "heikinashi") {
        mainSeries = chart.addCandlestickSeries({
          upColor: C.up, downColor: C.down,
          borderUpColor: C.up, borderDownColor: C.down,
          wickUpColor: C.up, wickDownColor: C.down,
        });
        mainSeries.setData(displayData);
      } else if (chartType === "line") {
        mainSeries = chart.addLineSeries({ color: C.gold, lineWidth: 2 });
        mainSeries.setData(displayData.map(c => ({ time: c.time, value: c.close })));
      } else if (chartType === "area") {
        mainSeries = chart.addAreaSeries({
          lineColor: C.gold, topColor: "rgba(212,168,67,0.3)", bottomColor: "rgba(212,168,67,0)",
          lineWidth: 2,
        });
        mainSeries.setData(displayData.map(c => ({ time: c.time, value: c.close })));
      } else if (chartType === "bar") {
        mainSeries = chart.addBarSeries({ upColor: C.up, downColor: C.down });
        mainSeries.setData(displayData);
      }
      mainSeriesRef.current = mainSeries;

      // Volume overlay (bottom 18% of main chart)
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volSeries.setData(candles.map(c => ({
        time: c.time, value: c.volume || 0,
        color: c.close >= c.open ? "rgba(0,192,135,0.2)" : "rgba(255,71,87,0.2)",
      })));
      volSeriesRef.current = volSeries;

      // Overlay indicators
      const lineOpts = { lineWidth: 1, priceLineVisible: false, lastValueVisible: false };
      const oSeries = [];

      if (overlays.ema20.enabled) {
        const s = chart.addLineSeries({ ...lineOpts, color: overlays.ema20.color });
        s.setData(calcEMA(candles, overlays.ema20.period));
        oSeries.push(s);
      }
      if (overlays.ema50.enabled) {
        const s = chart.addLineSeries({ ...lineOpts, color: overlays.ema50.color });
        s.setData(calcEMA(candles, overlays.ema50.period));
        oSeries.push(s);
      }
      if (overlays.sma200.enabled) {
        const s = chart.addLineSeries({ ...lineOpts, color: overlays.sma200.color });
        s.setData(calcSMA(candles, overlays.sma200.period));
        oSeries.push(s);
      }
      if (overlays.bb.enabled) {
        const bb = calcBollingerBands(candles, overlays.bb.period, overlays.bb.multiplier);
        const s1 = chart.addLineSeries({ ...lineOpts, color: overlays.bb.color, lineStyle: 2 }); s1.setData(bb.upper); oSeries.push(s1);
        const s2 = chart.addLineSeries({ ...lineOpts, color: overlays.bb.color, lineStyle: 1 }); s2.setData(bb.middle); oSeries.push(s2);
        const s3 = chart.addLineSeries({ ...lineOpts, color: overlays.bb.color, lineStyle: 2 }); s3.setData(bb.lower); oSeries.push(s3);
      }
      if (overlays.vwap.enabled) {
        const s = chart.addLineSeries({ ...lineOpts, color: overlays.vwap.color, lineWidth: 1.5, lineStyle: 4 });
        s.setData(calcVWAP(candles));
        oSeries.push(s);
      }
      overlaySeriesRef.current = oSeries;

      // Crosshair tracking
      chart.subscribeCrosshairMove(param => {
        if (param.time && mainSeries) {
          const data = param.seriesData.get(mainSeries);
          if (data) setCurrentBar({ time: param.time, ...data });
        }
      });

      // Restore scroll position or fit content on first load
      if (savedRangeRef.current) {
        try { chart.timeScale().setVisibleLogicalRange(savedRangeRef.current); } catch (_) { chart.timeScale().fitContent(); }
      } else {
        chart.timeScale().fitContent();
      }
      mainChartRef.current = chart;

      // Sync sub-charts on scroll
      chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (!range) return;
        [rsiChartRef, macdChartRef, stochChartRef].forEach(ref => {
          if (ref.current) try { ref.current.timeScale().setVisibleLogicalRange(range); } catch (_) {}
        });
      });

      // Resize observer
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

    // === RSI SUB-CHART ===
    if (subs.rsi.enabled && rsiContainerRef.current) {
      if (rsiChartRef.current) { try { rsiChartRef.current.remove(); } catch (_) {} }
      const container = rsiContainerRef.current;
      const chart = createChart(container, {
        ...chartOpts(container),
        height: 90,
        timeScale: { visible: false, borderColor: C.border },
        rightPriceScale: { borderColor: C.border, textColor: C.dim, scaleMargins: { top: 0.08, bottom: 0.08 } },
      });
      const rsiData = calcRSI(candles, subs.rsi.period);
      const series = chart.addLineSeries({ color: "#22d3ee", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
      series.setData(rsiData);
      series.createPriceLine({ price: 70, color: "#ff475780", lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      series.createPriceLine({ price: 30, color: "#00c08780", lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      series.createPriceLine({ price: 50, color: "#47556950", lineWidth: 1, lineStyle: 1, axisLabelVisible: false });
      chart.timeScale().fitContent();
      rsiChartRef.current = chart;
    } else {
      if (rsiChartRef.current) { try { rsiChartRef.current.remove(); } catch (_) {} rsiChartRef.current = null; }
    }

    // === MACD SUB-CHART ===
    if (subs.macd.enabled && macdContainerRef.current) {
      if (macdChartRef.current) { try { macdChartRef.current.remove(); } catch (_) {} }
      const container = macdContainerRef.current;
      const chart = createChart(container, {
        ...chartOpts(container),
        height: 100,
        timeScale: { visible: false, borderColor: C.border },
        rightPriceScale: { borderColor: C.border, textColor: C.dim, scaleMargins: { top: 0.08, bottom: 0.08 } },
      });
      const { macdLine, signalLine, histogram } = calcMACD(candles, subs.macd.fast, subs.macd.slow, subs.macd.signal);
      const histSeries = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false, priceScaleId: "macd" });
      histSeries.setData(histogram.map(d => ({
        time: d.time, value: d.value,
        color: d.value >= 0 ? "rgba(0,192,135,0.5)" : "rgba(255,71,87,0.5)",
      })));
      chart.addLineSeries({ color: "#3b82f6", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, priceScaleId: "macd" }).setData(macdLine);
      chart.addLineSeries({ color: "#f97316", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, priceScaleId: "macd" }).setData(signalLine);
      chart.timeScale().fitContent();
      macdChartRef.current = chart;
    } else {
      if (macdChartRef.current) { try { macdChartRef.current.remove(); } catch (_) {} macdChartRef.current = null; }
    }

    // === STOCHASTIC SUB-CHART ===
    if (subs.stochastic.enabled && stochContainerRef.current) {
      if (stochChartRef.current) { try { stochChartRef.current.remove(); } catch (_) {} }
      const container = stochContainerRef.current;
      const chart = createChart(container, {
        ...chartOpts(container),
        height: 90,
        timeScale: { visible: false, borderColor: C.border },
        rightPriceScale: { borderColor: C.border, textColor: C.dim, scaleMargins: { top: 0.08, bottom: 0.08 } },
      });
      const stochData = calcStochastic(candles, subs.stochastic.kPeriod, subs.stochastic.dPeriod);
      const kSeries = chart.addLineSeries({ color: "#f472b6", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
      kSeries.setData(stochData.map(d => ({ time: d.time, value: d.k })));
      chart.addLineSeries({ color: "#818cf8", lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        .setData(stochData.map(d => ({ time: d.time, value: d.d })));
      kSeries.createPriceLine({ price: 80, color: "#ff475780", lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      kSeries.createPriceLine({ price: 20, color: "#00c08780", lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      chart.timeScale().fitContent();
      stochChartRef.current = chart;
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

  // ── Drawing System ──
  const redrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingsRef.current.forEach(d => renderDrawing(ctx, d));
  };

  const renderDrawing = (ctx, d) => {
    ctx.strokeStyle = d.color || '#d4a843';
    ctx.lineWidth = d.lineWidth || 1.5;
    ctx.fillStyle = d.color || '#d4a843';
    ctx.setLineDash(d.dash || []);
    ctx.font = '13px Tajawal, sans-serif';

    switch (d.type) {
      case 'trendline':
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x2, d.y2);
        ctx.stroke();
        break;
      case 'hline':
        ctx.beginPath();
        ctx.moveTo(0, d.y);
        ctx.lineTo(ctx.canvas.width, d.y);
        ctx.stroke();
        // price label
        if (d.label) {
          ctx.fillStyle = '#060a11';
          ctx.fillRect(ctx.canvas.width - 70, d.y - 10, 65, 18);
          ctx.fillStyle = d.color || '#d4a843';
          ctx.textAlign = 'right';
          ctx.fillText(d.label, ctx.canvas.width - 10, d.y + 4);
        }
        break;
      case 'vline':
        ctx.beginPath();
        ctx.moveTo(d.x, 0);
        ctx.lineTo(d.x, ctx.canvas.height);
        ctx.stroke();
        break;
      case 'rect':
        ctx.strokeRect(d.x1, d.y1, d.x2 - d.x1, d.y2 - d.y1);
        ctx.fillStyle = (d.color || '#d4a843') + '10';
        ctx.fillRect(d.x1, d.y1, d.x2 - d.x1, d.y2 - d.y1);
        break;
      case 'circle': {
        const rx = Math.abs(d.x2 - d.x1) / 2;
        const ry = Math.abs(d.y2 - d.y1) / 2;
        const cx = (d.x1 + d.x2) / 2;
        const cy = (d.y1 + d.y2) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'freehand':
        if (d.points && d.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(d.points[0].x, d.points[0].y);
          d.points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }
        break;
      case 'text':
        ctx.fillStyle = d.color || '#d4a843';
        ctx.textAlign = 'right';
        ctx.fillText(d.text, d.x, d.y);
        break;
      case 'fib': {
        const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const fibColors = ['#ff4757', '#f59e0b', '#22d3ee', '#a78bfa', '#22d3ee', '#f59e0b', '#00c087'];
        const range = d.y2 - d.y1;
        fibLevels.forEach((lvl, i) => {
          const y = d.y1 + range * lvl;
          ctx.strokeStyle = fibColors[i];
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(d.x1, y);
          ctx.lineTo(d.x2, y);
          ctx.stroke();
          ctx.fillStyle = fibColors[i];
          ctx.textAlign = 'left';
          ctx.fillText(`${(lvl * 100).toFixed(1)}%`, d.x1 + 5, y - 3);
        });
        ctx.setLineDash([]);
        break;
      }
      case 'measure': {
        // dashed box
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(d.x1, d.y1, d.x2 - d.x1, d.y2 - d.y1);
        ctx.setLineDash([]);
        // label
        const dx = Math.abs(d.x2 - d.x1);
        const dy = Math.abs(d.y2 - d.y1);
        const midX = (d.x1 + d.x2) / 2;
        const midY = (d.y1 + d.y2) / 2;
        ctx.fillStyle = '#060a11cc';
        ctx.fillRect(midX - 35, midY - 10, 70, 20);
        ctx.fillStyle = '#d4a843';
        ctx.textAlign = 'center';
        ctx.fillText(`${dx.toFixed(0)}×${dy.toFixed(0)}`, midX, midY + 4);
        break;
      }
    }
    ctx.setLineDash([]);
  };

  // Resize drawing canvas to match chart container
  useEffect(() => {
    const container = mainContainerRef.current;
    const canvas = drawCanvasRef.current;
    if (!container || !canvas) return;
    const sync = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawCanvas();
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(container);
    return () => ro.disconnect();
  }, [candles]);

  // Mouse handlers for drawing
  const getCanvasPos = (e) => {
    const rect = drawCanvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDrawMouseDown = (e) => {
    if (!drawingTool || drawingTool === 'crosshair') return;
    const pos = getCanvasPos(e);
    isDrawingRef.current = true;
    drawStartRef.current = pos;

    if (drawingTool === 'freehand') {
      freehandPointsRef.current = [pos];
    }
    if (drawingTool === 'text') {
      const text = prompt('أدخل النص:');
      if (text) {
        drawingsRef.current.push({ type: 'text', x: pos.x, y: pos.y, text, color: '#d4a843' });
        redrawCanvas();
      }
      isDrawingRef.current = false;
    }
    if (drawingTool === 'hline') {
      // get price from chart coordinate
      let label = '';
      if (mainChartRef.current) {
        try {
          const price = mainChartRef.current.priceScale('right');
          label = pos.y.toFixed(0);
        } catch (_) {}
      }
      drawingsRef.current.push({ type: 'hline', y: pos.y, color: '#d4a843', dash: [6, 3], label });
      redrawCanvas();
      isDrawingRef.current = false;
    }
    if (drawingTool === 'vline') {
      drawingsRef.current.push({ type: 'vline', x: pos.x, color: '#d4a843', dash: [6, 3] });
      redrawCanvas();
      isDrawingRef.current = false;
    }
  };

  const handleDrawMouseMove = (e) => {
    if (!isDrawingRef.current || !drawStartRef.current) return;
    const pos = getCanvasPos(e);
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Redraw existing + live preview
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingsRef.current.forEach(d => renderDrawing(ctx, d));

    ctx.strokeStyle = '#d4a843';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    if (drawingTool === 'trendline') {
      ctx.beginPath();
      ctx.moveTo(drawStartRef.current.x, drawStartRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (drawingTool === 'rect') {
      ctx.strokeRect(drawStartRef.current.x, drawStartRef.current.y, pos.x - drawStartRef.current.x, pos.y - drawStartRef.current.y);
    } else if (drawingTool === 'circle') {
      const rx = Math.abs(pos.x - drawStartRef.current.x) / 2;
      const ry = Math.abs(pos.y - drawStartRef.current.y) / 2;
      const cx = (drawStartRef.current.x + pos.x) / 2;
      const cy = (drawStartRef.current.y + pos.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (drawingTool === 'freehand') {
      freehandPointsRef.current.push(pos);
      ctx.beginPath();
      ctx.moveTo(freehandPointsRef.current[0].x, freehandPointsRef.current[0].y);
      freehandPointsRef.current.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (drawingTool === 'fib' || drawingTool === 'measure') {
      renderDrawing(ctx, { type: drawingTool, x1: drawStartRef.current.x, y1: drawStartRef.current.y, x2: pos.x, y2: pos.y, color: '#d4a843' });
    }
  };

  const handleDrawMouseUp = (e) => {
    if (!isDrawingRef.current || !drawStartRef.current) return;
    const pos = getCanvasPos(e);
    isDrawingRef.current = false;

    if (drawingTool === 'trendline') {
      drawingsRef.current.push({ type: 'trendline', x1: drawStartRef.current.x, y1: drawStartRef.current.y, x2: pos.x, y2: pos.y, color: '#d4a843' });
    } else if (drawingTool === 'rect') {
      drawingsRef.current.push({ type: 'rect', x1: drawStartRef.current.x, y1: drawStartRef.current.y, x2: pos.x, y2: pos.y, color: '#d4a843' });
    } else if (drawingTool === 'circle') {
      drawingsRef.current.push({ type: 'circle', x1: drawStartRef.current.x, y1: drawStartRef.current.y, x2: pos.x, y2: pos.y, color: '#d4a843' });
    } else if (drawingTool === 'freehand') {
      drawingsRef.current.push({ type: 'freehand', points: [...freehandPointsRef.current], color: '#d4a843' });
      freehandPointsRef.current = [];
    } else if (drawingTool === 'fib') {
      drawingsRef.current.push({ type: 'fib', x1: drawStartRef.current.x, y1: drawStartRef.current.y, x2: pos.x, y2: pos.y, color: '#d4a843' });
    } else if (drawingTool === 'measure') {
      drawingsRef.current.push({ type: 'measure', x1: drawStartRef.current.x, y1: drawStartRef.current.y, x2: pos.x, y2: pos.y, color: '#d4a843' });
    }

    drawStartRef.current = null;
    redrawCanvas();
  };

  const clearDrawings = () => {
    drawingsRef.current = [];
    redrawCanvas();
    setDrawingTool(null);
  };

  // ── Handlers ──
  const handleSelect = (stock) => {
    setSelectedStock({ ...stock, market });
    setCandles([]);
    setShowAI(false);
    setCurrentBar(null);
    savedRangeRef.current = null;
  };

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

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-50px)] overflow-hidden bg-[#060a11] relative">

      {/* ── RIGHT SIDEBAR: Stocks ── */}
      <div className="w-48 shrink-0 bg-[#0d1420] border-l border-[#1a2540] flex flex-col overflow-hidden">
        <div className="flex border-b border-[#1a2540]">
          <button onClick={() => { setMarket("saudi"); handleSelect({ symbol: "TASI", name: "تاسي" }); }}
            className={`flex-1 py-2.5 text-[10px] font-bold transition-all ${market === "saudi" ? "bg-[#d4a843]/12 text-[#d4a843] border-b-2 border-b-[#d4a843]" : "text-[#475569] hover:text-white"}`}>
            🇸🇦 السعودي
          </button>
          <button onClick={() => { setMarket("us"); handleSelect({ symbol: "AAPL", name: "Apple" }); }}
            className={`flex-1 py-2.5 text-[10px] font-bold transition-all ${market === "us" ? "bg-[#d4a843]/12 text-[#d4a843] border-b-2 border-b-[#d4a843]" : "text-[#475569] hover:text-white"}`}>
            🇺🇸 الأمريكي
          </button>
        </div>
        <StockListPanel market={market} selectedSymbol={selectedStock?.symbol} onSelect={handleSelect} search={search} setSearch={setSearch} />
      </div>

      {/* ── CENTER ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── TOOLBAR ── */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1a2540] bg-[#0a0f18] shrink-0 flex-wrap">
          {/* Symbol info */}
          <div className="flex items-center gap-2 mr-2">
            <span className="text-base font-black text-white tracking-wide">{selectedStock?.symbol}</span>
            <span className="text-[11px] text-[#475569]">{selectedStock?.name}</span>
            {quote && (
              <>
                <span className="text-sm font-bold text-white ml-1">{quote.price?.toFixed(2)}</span>
                <span className={`text-xs font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded ${isUp ? "text-[#00c087] bg-[#00c087]/10" : "text-[#ff4757] bg-[#ff4757]/10"}`}>
                  {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(change || 0).toFixed(2)}%
                </span>
              </>
            )}
          </div>

          <div className="w-px h-5 bg-[#1a2540]" />

          {/* Chart type selector */}
          <div className="flex gap-0.5 bg-[#060a11] rounded-lg p-0.5">
            {CHART_TYPES.map(t => (
              <button key={t.value} onClick={() => setChartType(t.value)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${chartType === t.value ? "bg-[#d4a843] text-black shadow-lg shadow-[#d4a843]/20" : "text-[#64748b] hover:text-white"}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-[#1a2540]" />

          {/* Timeframe selector */}
          <div className="flex gap-0.5 bg-[#060a11] rounded-lg p-0.5">
            {TIMEFRAMES.map(tf => (
              <button key={tf.value} onClick={() => setTimeframe(tf.value)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${timeframe === tf.value ? "bg-[#d4a843] text-black shadow-lg shadow-[#d4a843]/20" : "text-[#64748b] hover:text-white"}`}>
                {tf.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Indicators dropdown */}
          <div className="relative">
            <button onClick={() => setShowIndicators(!showIndicators)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                activeCount > 0 ? "bg-[#d4a843]/12 border border-[#d4a843]/30 text-[#d4a843]" : "bg-[#0d1420] border border-[#1a2540] text-[#64748b] hover:text-white"}`}>
              <Layers className="w-3.5 h-3.5" />
              مؤشرات
              {activeCount > 0 && <span className="bg-[#d4a843] text-black rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black">{activeCount}</span>}
            </button>
            {showIndicators && <IndicatorMenu overlays={overlays} setOverlays={setOverlays} subs={subs} setSubs={setSubs} onClose={() => setShowIndicators(false)} />}
          </div>

          {/* AI button */}
          <button onClick={() => setShowAI(!showAI)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              showAI ? "bg-[#d4a843] text-black shadow-lg shadow-[#d4a843]/20" : "bg-[#d4a843]/12 border border-[#d4a843]/30 text-[#d4a843] hover:bg-[#d4a843]/20"}`}>
            <Brain className="w-3.5 h-3.5" />
            AI تحليل
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-[#0d1420] border border-[#1a2540] text-[#64748b] hover:text-white transition-colors">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* ── CHART AREA ── */}
        <div className="flex-1 min-h-0 flex flex-col relative">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#060a11]/80 z-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#d4a843] animate-spin" />
                <span className="text-xs text-[#64748b]">جاري تحميل البيانات...</span>
              </div>
            </div>
          )}

          {/* AI Panel */}
          {showAI && candles.length > 0 && (
            <AiPanel symbol={selectedStock?.symbol} market={market} candles={candles} onClose={() => setShowAI(false)} />
          )}

          {/* OHLCV Data bar */}
          {currentBar && (
            <div className="absolute top-2 right-2 z-10 flex items-center gap-3 text-[10px] bg-[#060a11]/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-[#1a2540]/50">
              <span className="text-[#475569]">O <span className="text-white font-medium">{currentBar.open?.toFixed(2)}</span></span>
              <span className="text-[#475569]">H <span className="text-[#00c087] font-medium">{currentBar.high?.toFixed(2)}</span></span>
              <span className="text-[#475569]">L <span className="text-[#ff4757] font-medium">{currentBar.low?.toFixed(2)}</span></span>
              <span className="text-[#475569]">C <span className="text-white font-bold">{currentBar.close?.toFixed(2)}</span></span>
              <span className="text-[#475569]">V <span className="text-[#94a3b8]">{
                currentBar.volume ? (currentBar.volume > 1e6 ? (currentBar.volume / 1e6).toFixed(1) + "M" : (currentBar.volume / 1e3).toFixed(0) + "K") : "-"
              }</span></span>
            </div>
          )}

          {selectedStock ? (
            <>
              {/* Main chart */}
              <div ref={mainContainerRef} className="flex-1 w-full min-h-0 relative">
                {/* Drawing overlay canvas */}
                <canvas
                  ref={drawCanvasRef}
                  className="absolute inset-0 z-10"
                  style={{ pointerEvents: (drawingTool && drawingTool !== 'crosshair') ? 'auto' : 'none', cursor: drawingTool === 'crosshair' || !drawingTool ? 'default' : 'crosshair' }}
                  onMouseDown={handleDrawMouseDown}
                  onMouseMove={handleDrawMouseMove}
                  onMouseUp={handleDrawMouseUp}
                  onMouseLeave={() => { if (isDrawingRef.current) { isDrawingRef.current = false; redrawCanvas(); } }}
                />
              </div>

              {/* RSI sub-panel */}
              {subs.rsi.enabled && (
                <div className="border-t border-[#1a2540] relative">
                  <span className="absolute top-1 left-2 z-10 text-[9px] text-[#22d3ee] font-bold bg-[#060a11]/80 px-1.5 py-0.5 rounded">RSI ({subs.rsi.period})</span>
                  <div ref={rsiContainerRef} className="w-full" style={{ height: 90 }} />
                </div>
              )}

              {/* MACD sub-panel */}
              {subs.macd.enabled && (
                <div className="border-t border-[#1a2540] relative">
                  <span className="absolute top-1 left-2 z-10 text-[9px] text-[#a78bfa] font-bold bg-[#060a11]/80 px-1.5 py-0.5 rounded">
                    MACD ({subs.macd.fast},{subs.macd.slow},{subs.macd.signal})
                  </span>
                  <div ref={macdContainerRef} className="w-full" style={{ height: 100 }} />
                </div>
              )}

              {/* Stochastic sub-panel */}
              {subs.stochastic.enabled && (
                <div className="border-t border-[#1a2540] relative">
                  <span className="absolute top-1 left-2 z-10 text-[9px] text-[#f472b6] font-bold bg-[#060a11]/80 px-1.5 py-0.5 rounded">
                    Stochastic ({subs.stochastic.kPeriod},{subs.stochastic.dPeriod})
                  </span>
                  <div ref={stochContainerRef} className="w-full" style={{ height: 90 }} />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <BarChart3 className="w-16 h-16 text-[#1a2540]" />
              <p className="text-[#64748b]">اختر سهماً من القائمة</p>
            </div>
          )}
        </div>

        {/* ── STATUS BAR ── */}
        <div className="flex items-center gap-3 px-3 py-1 border-t border-[#1a2540] bg-[#0a0f18] shrink-0 text-[9px]">
          {overlays.ema20.enabled && <span className="flex items-center gap-1 text-[#f59e0b]"><span className="w-3 h-0.5 bg-[#f59e0b] inline-block rounded" /> EMA 20</span>}
          {overlays.ema50.enabled && <span className="flex items-center gap-1 text-[#818cf8]"><span className="w-3 h-0.5 bg-[#818cf8] inline-block rounded" /> EMA 50</span>}
          {overlays.sma200.enabled && <span className="flex items-center gap-1 text-[#fb923c]"><span className="w-3 h-0.5 bg-[#fb923c] inline-block rounded" /> SMA 200</span>}
          {overlays.bb.enabled && <span className="flex items-center gap-1 text-[#a78bfa]"><span className="w-3 h-0.5 bg-[#a78bfa] inline-block rounded" /> BB</span>}
          {overlays.vwap.enabled && <span className="flex items-center gap-1 text-[#22d3ee]"><span className="w-3 h-0.5 bg-[#22d3ee] inline-block rounded" /> VWAP</span>}
          {subs.rsi.enabled && <span className="flex items-center gap-1 text-[#22d3ee]">◆ RSI</span>}
          {subs.macd.enabled && <span className="flex items-center gap-1 text-[#a78bfa]">◆ MACD</span>}
          {subs.stochastic.enabled && <span className="flex items-center gap-1 text-[#f472b6]">◆ Stoch</span>}
          <span className="flex items-center gap-1 text-[#00c087]">■ صعود</span>
          <span className="flex items-center gap-1 text-[#ff4757]">■ هبوط</span>
          <span className="flex-1" />
          <span className="text-[#475569]">DFA Pro · محلل الأسواق المالية المتقدم</span>
        </div>
      </div>

      {/* ── LEFT SIDEBAR: Drawing Tools & Info ── */}
      <div className="w-11 shrink-0 bg-[#0d1420] border-r border-[#1a2540] flex flex-col items-center py-2 gap-1 overflow-y-auto">
        {[
          { icon: Crosshair, label: "تحديد", tool: "crosshair" },
          { icon: TrendingUp, label: "خط اتجاه", tool: "trendline" },
          { icon: Minus, label: "خط أفقي", tool: "hline" },
          { icon: Activity, label: "خط عمودي", tool: "vline" },
          { icon: PenLine, label: "رسم حر", tool: "freehand" },
          { icon: RectangleHorizontal, label: "مستطيل", tool: "rect" },
          { icon: Circle, label: "دائرة", tool: "circle" },
          { icon: Type, label: "نص", tool: "text" },
          { icon: Hash, label: "فيبوناتشي", tool: "fib" },
          { icon: RulerIcon, label: "قياس", tool: "measure" },
        ].map(({ icon: Icon, label, tool }) => (
          <button
            key={tool}
            title={label}
            onClick={() => setDrawingTool(prev => prev === tool ? null : tool)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
              drawingTool === tool
                ? "bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/40"
                : "text-[#475569] hover:text-white hover:bg-[#1a2540]"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        <div className="w-6 border-t border-[#1a2540] my-1" />
        <button
          title="مسح الرسومات"
          onClick={clearDrawings}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#475569] hover:text-[#ff4757] hover:bg-[#ff4757]/10 transition-all"
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
