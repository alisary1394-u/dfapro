import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { entities } from "@/api/entities";
import { getQuote, getCandles, getOverview, buildFallbackCandles } from "@/components/api/marketDataClient";
import SearchStock from "@/components/ui/SearchStock";
import AnalysisGauge from "@/components/ui/AnalysisGauge";
import SmartAnalysisPanel from "@/components/charts/SmartAnalysisPanel";
import TargetEngine from "@/components/charts/TargetEngine";
import SentimentAnalysis from "@/components/analysis/SentimentAnalysis";
import SupportResistancePanel from "@/components/analysis/SupportResistancePanel";
import MLPredictionEngine from "@/components/analysis/MLPredictionEngine";
import MultiStockComparison from "@/components/analysis/MultiStockComparison";
import {
  Brain, BarChart3, Shield, Sparkles,
  DollarSign, ArrowUpRight, ArrowDownRight, GitCompare,
  Search, TrendingUp, ChevronDown, FolderOpen
} from "lucide-react";
import { ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from "recharts";

// ─── Stock list data ─────────────────────────────────────────────────────────
const STOCKS_LIST = {
  us: [
    { symbol: "AAPL", name: "Apple" },
    { symbol: "MSFT", name: "Microsoft" },
    { symbol: "GOOGL", name: "Google" },
    { symbol: "AMZN", name: "Amazon" },
    { symbol: "NVDA", name: "NVIDIA" },
    { symbol: "TSLA", name: "Tesla" },
    { symbol: "META", name: "Meta" },
    { symbol: "NFLX", name: "Netflix" },
    { symbol: "AMD", name: "AMD" },
    { symbol: "INTC", name: "Intel" },
    { symbol: "JPM", name: "JPMorgan" },
    { symbol: "BAC", name: "Bank of America" },
    { symbol: "V", name: "Visa" },
    { symbol: "WMT", name: "Walmart" },
    { symbol: "DIS", name: "Disney" },
  ],
  saudi: [
    { symbol: "2222", name: "أرامكو" },
    { symbol: "1180", name: "الأهلي" },
    { symbol: "2010", name: "سابك" },
    { symbol: "1120", name: "الراجحي" },
    { symbol: "2350", name: "كيان" },
    { symbol: "1010", name: "الرياض" },
    { symbol: "2380", name: "بترو رابغ" },
    { symbol: "4200", name: "الاتصالات" },
    { symbol: "7010", name: "STC" },
    { symbol: "2330", name: "أدوا" },
    { symbol: "4030", name: "تبوك للزراعة" },
    { symbol: "4190", name: "جرير" },
    { symbol: "8010", name: "سلامة" },
    { symbol: "3010", name: "نماء" },
    { symbol: "1211", name: "معادن" },
  ],
};

function WatchlistItemsInline({ collectionId, onSelectStock }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const watchlistItems = await entities.WatchlistItem.filter({ watchlist_id: collectionId });
        setItems(watchlistItems || []);
      } catch (err) {
        console.error("Error fetching watchlist items:", err);
      }
      setLoading(false);
    };
    fetchItems();
  }, [collectionId]);

  if (loading) return <div className="px-2 py-1 text-[10px] text-[#64748b]">جاري التحميل...</div>;
  return (
    <div className="space-y-0.5 pr-3">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelectStock({ symbol: item.symbol, name: item.name, market: item.market })}
          className="w-full text-right px-2 py-1.5 rounded-lg transition-all text-[11px] text-[#94a3b8] hover:bg-[#1e293b] hover:text-white"
        >
          <div className="font-bold">{item.symbol}</div>
          <div className="text-[9px] text-[#64748b] truncate">{item.name}</div>
        </button>
      ))}
    </div>
  );
}

// Height offset accounts for the sticky top bar (~3rem) + page padding (~3rem)
const STOCK_PANEL_MAX_HEIGHT = 'calc(100vh - 6rem)';

// ─── Inline stock list panel ────────────────────────────────────────────────
function StockListPanel({ activeSymbol, onSelect }) {
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState("us");
  const [watchlists, setWatchlists] = useState([]);
  const [expandedWatchlist, setExpandedWatchlist] = useState(null);
  const [selectedWatchlist, setSelectedWatchlist] = useState(null);

  useEffect(() => {
    entities.WatchlistCollection.list()
      .then((cols) => setWatchlists(cols || []))
      .catch(() => {});
  }, []);

  const filtered = STOCKS_LIST[market].filter(
    (s) =>
      s.symbol.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-52 shrink-0 bg-[#0a0e18]/80 border border-[#1a2540] rounded-2xl flex flex-col overflow-hidden" style={{ maxHeight: STOCK_PANEL_MAX_HEIGHT }}>
      {/* Header */}
      <div className="px-3 py-3 border-b border-[#1a2540] flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-[#d4a843]/15 border border-[#d4a843]/25 flex items-center justify-center shrink-0">
          <TrendingUp className="w-3.5 h-3.5 text-[#d4a843]" />
        </div>
        <span className="text-xs font-black text-white">قائمة الأسهم</span>
      </div>

      {/* Market Toggle */}
      <div className="px-2 pt-2.5 flex gap-1">
        <button
          onClick={() => { setMarket("us"); setSelectedWatchlist(null); }}
          className={`flex-1 text-[11px] py-1.5 rounded-lg font-bold transition-all ${
            market === "us" && !selectedWatchlist
              ? "bg-[#d4a843]/15 text-[#d4a843] border border-[#d4a843]/25"
              : "text-[#475569] hover:bg-[#1a2540] hover:text-[#64748b]"
          }`}
        >
          🇺🇸 أمريكي
        </button>
        <button
          onClick={() => { setMarket("saudi"); setSelectedWatchlist(null); }}
          className={`flex-1 text-[11px] py-1.5 rounded-lg font-bold transition-all ${
            market === "saudi" && !selectedWatchlist
              ? "bg-[#d4a843]/15 text-[#d4a843] border border-[#d4a843]/25"
              : "text-[#475569] hover:bg-[#1a2540] hover:text-[#64748b]"
          }`}
        >
          🇸🇦 سعودي
        </button>
      </div>

      {/* Search */}
      <div className="px-2 pt-2">
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#475569]" />
          <input
            type="text"
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0d1420] border border-[#1a2540] rounded-xl pr-7 pl-2 py-1.5 text-xs text-white placeholder-[#334155] outline-none focus:border-[#d4a843]/40 transition-colors"
          />
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto mt-2 px-2 pb-4 space-y-3">
        {/* Watchlists */}
        {watchlists.length > 0 && (
          <div>
            <div className="text-[9px] font-black text-[#334155] px-2 py-1 uppercase tracking-widest">قوائمي</div>
            <div className="space-y-0.5">
              {watchlists.map((list) => (
                <div key={list.id}>
                  <button
                    onClick={() => {
                      setSelectedWatchlist(selectedWatchlist === list.id ? null : list.id);
                      setExpandedWatchlist(list.id);
                    }}
                    className={`w-full text-right px-2.5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 ${
                      selectedWatchlist === list.id
                        ? "bg-[#d4a843]/12 border border-[#d4a843]/25 text-[#e8c76a]"
                        : "text-[#475569] hover:bg-[#1a2540] hover:text-[#94a3b8]"
                    }`}
                  >
                    <FolderOpen className="w-3 h-3 shrink-0" />
                    <span className="flex-1 truncate text-[11px] font-medium">{list.name}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedWatchlist === list.id ? 'rotate-180' : ''}`} />
                  </button>
                  {selectedWatchlist === list.id && expandedWatchlist === list.id && (
                    <WatchlistItemsInline collectionId={list.id} onSelectStock={onSelect} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Popular Stocks */}
        {!selectedWatchlist && (
          <div>
            <div className="text-[9px] font-black text-[#334155] px-2 py-1 uppercase tracking-widest">الأسهم الشهيرة</div>
            <div className="space-y-0.5">
              {filtered.map((stock) => {
                const isActive = activeSymbol === stock.symbol;
                return (
                  <button
                    key={stock.symbol}
                    onClick={() => onSelect({ ...stock, market })}
                    className={`w-full text-right px-2.5 py-2 rounded-xl transition-all duration-150 flex items-center gap-2 group ${
                      isActive
                        ? "bg-[#d4a843]/12 border border-[#d4a843]/25 text-[#e8c76a]"
                        : "text-[#475569] hover:bg-[#1a2540] hover:text-[#94a3b8]"
                    }`}
                  >
                    <div className="flex-1 text-right min-w-0">
                      <div className={`text-[11px] font-black leading-tight ${isActive ? 'text-[#e8c76a]' : 'text-[#94a3b8] group-hover:text-white'}`}>{stock.symbol}</div>
                      <div className="text-[9px] text-[#334155] truncate mt-0.5">{stock.name}</div>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#d4a843] shrink-0 animate-pulse" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const radarData = [
  { indicator: "الربحية", score: 85, fullMark: 100 },
  { indicator: "النمو", score: 72, fullMark: 100 },
  { indicator: "السيولة", score: 90, fullMark: 100 },
  { indicator: "الاستقرار", score: 68, fullMark: 100 },
  { indicator: "القيمة", score: 78, fullMark: 100 },
  { indicator: "الزخم", score: 82, fullMark: 100 },
];

export default function StockAnalysis() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("single"); // "single" | "compare"
  const [selectedStock, setSelectedStock] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [priceData, setPriceData] = useState([]);
  const [realQuote, setRealQuote] = useState(null);
  const [dataSource, setDataSource] = useState("simulated"); // "live" | "simulated"

  const runAnalysis = async (stock) => {
    setAnalyzing(true);
    setRealQuote(null);
    setDataSource("simulated");

    // Fetch real market data in parallel
    let quote = null, candles = null, overview = null;
    try {
      [quote, candles, overview] = await Promise.all([
        getQuote(stock.symbol, stock.market).catch(() => null),
        getCandles(stock.symbol, stock.market).catch(() => null),
        getOverview(stock.symbol, stock.market).catch(() => null),
      ]);
    } catch (_) {}

    if (quote) {
      setRealQuote(quote);
      setDataSource("live");
    }

    // Build candle data for charts
    const basePrice = quote?.price || 100;
    const candleData = (candles && candles.length > 10) ? candles : buildFallbackCandles(basePrice, 100);
    setPriceData(candleData);

    // Build enriched context for AI
    const realDataContext = quote ? `
بيانات السوق الحقيقية (لحظية):
- السعر الحالي: ${quote.price}
- التغيير: ${quote.change} (${quote.change_percent?.toFixed(2)}%)
- حجم التداول: ${quote.volume?.toLocaleString()}
- أعلى اليوم: ${quote.high} | أدنى اليوم: ${quote.low}
- آخر تحديث: ${quote.latest_day}
${overview ? `
البيانات الأساسية:
- القطاع: ${overview.sector || "غير متاح"}
- مكرر الأرباح P/E: ${overview.pe_ratio || "غير متاح"}
- ربحية السهم EPS: ${overview.eps || "غير متاح"}
- هامش الربح: ${overview.profit_margin || "غير متاح"}
- بيتا: ${overview.beta || "غير متاح"}
- هدف المحللين: ${overview.analyst_target || "غير متاح"}
- 52 أسبوع أعلى: ${overview.high_52w} | أدنى: ${overview.low_52w}` : ""}
` : "لا تتوفر بيانات سوق حقيقية، استخدم معرفتك المتاحة.";

    setAnalysis(null);
    setAnalyzing(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const symbol = params.get("symbol");
    const market = params.get("market");
    const name = params.get("name") || symbol;
    if (symbol && market) {
      const stock = { symbol, market, name };
      setSelectedStock(stock);
      runAnalysis(stock);
    }
  }, [location.search]);

  const handleSelect = (stock) => {
    setSelectedStock(stock);
    setAnalysis(null);
    runAnalysis(stock);
  };

  const getRecommendationColor = (rec) => {
    if (!rec) return "#94a3b8";
    if (rec.includes("شراء قوي")) return "#10b981";
    if (rec.includes("شراء")) return "#34d399";
    if (rec.includes("محايد")) return "#d4a843";
    if (rec.includes("بيع قوي")) return "#ef4444";
    if (rec.includes("بيع")) return "#f87171";
    return "#94a3b8";
  };

  return (
    <div className="flex gap-5 items-start">
      {/* ── Stock List Panel (right side in RTL) ── */}
      <div className="hidden lg:block shrink-0 sticky top-16">
        <StockListPanel activeSymbol={selectedStock?.symbol} onSelect={handleSelect} />
      </div>

      {/* ── Main Analysis Content ── */}
      <div className="flex-1 min-w-0 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Brain className="w-7 h-7 text-[#d4a843]" />
          <div>
            <h1 className="text-2xl font-bold text-white">تحليل ذكي للأسهم</h1>
            <p className="text-sm text-[#94a3b8]">تحليل شامل مدعوم بالذكاء الاصطناعي</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 bg-[#151c2c] border border-[#1e293b] rounded-xl p-1">
          <button
            onClick={() => setActiveTab("single")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "single" ? "bg-[#d4a843] text-black" : "text-[#94a3b8] hover:text-white"}`}
          >
            <Brain className="w-4 h-4" /> تحليل سهم
          </button>
          <button
            onClick={() => setActiveTab("compare")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "compare" ? "bg-[#d4a843] text-black" : "text-[#94a3b8] hover:text-white"}`}
          >
            <GitCompare className="w-4 h-4" /> مقارنة أسهم
          </button>
        </div>
      </div>

      {activeTab === "compare" && (
        <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
          <MultiStockComparison />
        </div>
      )}

      {activeTab === "single" && <div className="max-w-xl">
        <SearchStock onSelect={handleSelect} />
      </div>}

      {activeTab === "single" && analyzing && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-[#1e293b] border-t-[#d4a843] animate-spin" />
            <Brain className="absolute inset-0 m-auto w-8 h-8 text-[#d4a843]" />
          </div>
          <p className="text-[#94a3b8] mt-6 text-lg">جاري التحليل العميق...</p>
          <p className="text-[#64748b] text-sm mt-2">تحليل فني وأساسي شامل لـ {selectedStock?.symbol}</p>
        </div>
      )}

      {activeTab === "single" && analysis && !analyzing && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-bold text-[#e8c76a]">{selectedStock?.symbol}</span>
                  <span className="px-3 py-1 rounded-full bg-[#1e293b] text-xs text-[#94a3b8] font-medium">
                    {selectedStock?.market === "saudi" ? "السوق السعودي" : "السوق الأمريكي"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${dataSource === "live" ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1e293b] text-[#64748b]"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dataSource === "live" ? "bg-emerald-400 animate-pulse" : "bg-[#64748b]"}`} />
                    {dataSource === "live" ? "بيانات حقيقية" : "بيانات محاكاة"}
                  </span>
                </div>
                <p className="text-[#94a3b8] text-sm">{selectedStock?.name}</p>
                <div className="flex items-center gap-4 mt-4">
                  <span className="text-3xl font-bold text-white">
                    {analysis.current_price?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-lg font-semibold text-[#d4a843]">
                    → {analysis.target_price?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <AnalysisGauge score={analysis.overall_score || 50} label="التقييم الشامل" />
                <div className="text-center">
                  <div
                    className="px-6 py-3 rounded-xl font-bold text-lg"
                    style={{
                      backgroundColor: getRecommendationColor(analysis.recommendation) + '20',
                      color: getRecommendationColor(analysis.recommendation)
                    }}
                  >
                    {analysis.recommendation}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ML Prediction Engine */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 rounded-xl bg-[#d4a843]/10">
                <span className="text-lg">🤖</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">تنبؤات التعلم الآلي</h3>
                <p className="text-xs text-[#94a3b8]">3 نماذج · تصنيف الاتجاه · إشارات الدخول/الخروج · تقييم المخاطر والعائد</p>
              </div>
            </div>
            <MLPredictionEngine data={priceData} />
          </div>

          {/* Price Chart */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[#3b82f6]" />
              <h3 className="text-lg font-bold text-white">الرسم البياني الاحترافي</h3>
            </div>
            <div className="flex items-center justify-center h-40 text-[#64748b] text-sm">الرسم البياني الاحترافي غير متاح في هذه الصفحة</div>
          </div>

          {/* Target Engine */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 rounded-xl bg-[#d4a843]/10">
                <span className="text-lg">🎯</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">محرك الأهداف الذكي</h3>
                <p className="text-xs text-[#94a3b8]">فيبوناتشي · محاور · EMA · ATR · حجم · تقاطع موحد</p>
              </div>
            </div>
            <TargetEngine data={priceData} />
          </div>

          {/* Support & Resistance + Entry/Exit */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 rounded-xl bg-[#d4a843]/10">
                <span className="text-lg">📍</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">الدعم والمقاومة · نقاط الدخول والخروج</h3>
                <p className="text-xs text-[#94a3b8]">Pivot · Swing · EMA · ATR · إعدادات Long/Short</p>
              </div>
            </div>
            <SupportResistancePanel data={priceData} />
          </div>

          {/* Smart Money Analysis Panel */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 rounded-xl bg-[#d4a843]/10">
                <span className="text-lg">🧠</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">تحليل السيولة والشموع المتقدم</h3>
                <p className="text-xs text-[#94a3b8]">VSA · OBV · A/D · MFI · CMF · وايكوف · أنماط الشموع</p>
              </div>
            </div>
            <SmartAnalysisPanel data={priceData} />
          </div>

          {/* Analysis Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Technical */}
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-[#3b82f6]" />
                <h3 className="text-base font-bold text-white">التحليل الفني</h3>
              </div>
              <AnalysisGauge score={analysis.technical?.score || 50} label="النقاط الفنية" size={100} />
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                  <span className="text-xs text-[#94a3b8]">الاتجاه</span>
                  <span className="text-sm font-semibold text-white">{analysis.technical?.trend}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                  <span className="text-xs text-[#94a3b8]">الدعم</span>
                  <span className="text-sm font-semibold text-emerald-400">{analysis.technical?.support}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                  <span className="text-xs text-[#94a3b8]">المقاومة</span>
                  <span className="text-sm font-semibold text-red-400">{analysis.technical?.resistance}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                  <span className="text-xs text-[#94a3b8]">RSI</span>
                  <span className={`text-sm font-semibold ${(analysis.technical?.rsi || 50) > 70 ? 'text-red-400' : (analysis.technical?.rsi || 50) < 30 ? 'text-emerald-400' : 'text-[#d4a843]'}`}>
                    {analysis.technical?.rsi}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-[#94a3b8]">MACD</span>
                  <span className="text-sm font-semibold text-white">{analysis.technical?.macd_signal}</span>
                </div>
              </div>
            </div>

            {/* Fundamental */}
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-base font-bold text-white">التحليل الأساسي</h3>
              </div>
              <AnalysisGauge score={analysis.fundamental?.score || 50} label="النقاط الأساسية" size={100} />
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                  <span className="text-xs text-[#94a3b8]">مكرر الأرباح</span>
                  <span className="text-sm font-semibold text-white">{analysis.fundamental?.pe_ratio}x</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                  <span className="text-xs text-[#94a3b8]">ربحية السهم</span>
                  <span className="text-sm font-semibold text-emerald-400">{analysis.fundamental?.eps}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                  <span className="text-xs text-[#94a3b8]">نمو الإيرادات</span>
                  <span className="text-sm font-semibold text-[#d4a843]">{analysis.fundamental?.revenue_growth}%</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-[#94a3b8]">هامش الربح</span>
                  <span className="text-sm font-semibold text-white">{analysis.fundamental?.profit_margin}%</span>
                </div>
              </div>
            </div>

            {/* Risk & Radar */}
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-[#d4a843]" />
                <h3 className="text-base font-bold text-white">تحليل المخاطر</h3>
              </div>
              <div className="h-48 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="indicator" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                    <Radar name="Score" dataKey="score" stroke="#d4a843" fill="#d4a843" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2">
                {analysis.risk?.factors?.slice(0, 3).map((factor, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <span className="text-xs text-[#94a3b8]">{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>



          {/* Strengths & Weaknesses */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                نقاط القوة
              </h3>
              <div className="space-y-3">
                {analysis.strengths?.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-emerald-400">{i + 1}</span>
                    </div>
                    <p className="text-sm text-[#94a3b8]">{s}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-red-400" />
                نقاط الضعف
              </h3>
              <div className="space-y-3">
                {analysis.weaknesses?.map((w, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-red-400">{i + 1}</span>
                    </div>
                    <p className="text-sm text-[#94a3b8]">{w}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Summary */}
          <div className="bg-gradient-to-l from-[#d4a843]/10 to-[#151c2c] border border-[#d4a843]/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#d4a843]" />
              <h3 className="text-base font-bold text-white">ملخص الذكاء الاصطناعي</h3>
            </div>
            <p className="text-sm text-[#94a3b8] leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Sentiment Analysis */}
          <SentimentAnalysis
            stock={selectedStock}
            botSignal={analysis.recommendation}
          />

          {/* Latest News */}
          {analysis.news && analysis.news.length > 0 && (
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-4">آخر الأخبار المؤثرة</h3>
              <div className="space-y-3">
                {analysis.news.map((n, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-[#1a2235] rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-[#d4a843] mt-2 shrink-0" />
                    <p className="text-sm text-[#94a3b8]">{n}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "single" && !selectedStock && !analyzing && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 rounded-3xl bg-[#d4a843]/10 flex items-center justify-center mb-6">
            <Brain className="w-12 h-12 text-[#d4a843]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">ابدأ التحليل الذكي</h2>
          <p className="text-[#94a3b8] max-w-md">ابحث عن أي سهم في السوق السعودي أو الأمريكي واحصل على تحليل شامل مدعوم بالذكاء الاصطناعي</p>
        </div>
      )}
      </div>{/* end main content */}
    </div>
  );
}