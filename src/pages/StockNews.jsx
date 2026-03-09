import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Newspaper, TrendingUp, TrendingDown, Minus, Loader2, Search, X,
  Brain, Radio, RefreshCw, ChevronDown, ChevronUp, Zap, BarChart3,
  Filter, Clock, ExternalLink, AlertTriangle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, ReferenceLine
} from "recharts";

const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple" }, { symbol: "TSLA", name: "Tesla" },
  { symbol: "NVDA", name: "NVIDIA" }, { symbol: "MSFT", name: "Microsoft" },
  { symbol: "AMZN", name: "Amazon" }, { symbol: "META", name: "Meta" },
  { symbol: "GOOGL", name: "Alphabet" }, { symbol: "AMD", name: "AMD" },
  { symbol: "NFLX", name: "Netflix" }, { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "JPM", name: "JPMorgan" }, { symbol: "BAC", name: "Bank of America" },
  { symbol: "COIN", name: "Coinbase" }, { symbol: "PLTR", name: "Palantir" },
  { symbol: "2222", name: "أرامكو السعودية" }, { symbol: "1120", name: "الراجحي" },
  { symbol: "2010", name: "سابك" }, { symbol: "7010", name: "الاتصالات السعودية" },
];

const sentimentConfig = {
  bullish: { label: "إيجابي جداً", color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: TrendingUp },
  slightly_bullish: { label: "إيجابي", color: "#34d399", bg: "bg-emerald-500/5", border: "border-emerald-500/10", icon: TrendingUp },
  neutral: { label: "محايد", color: "#d4a843", bg: "bg-[#d4a843]/10", border: "border-[#d4a843]/20", icon: Minus },
  slightly_bearish: { label: "سلبي", color: "#f87171", bg: "bg-red-500/5", border: "border-red-500/10", icon: TrendingDown },
  bearish: { label: "سلبي جداً", color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/20", icon: TrendingDown },
};

const FILTER_OPTIONS = [
  { key: "all", label: "الكل" },
  { key: "bullish", label: "إيجابي جداً" },
  { key: "slightly_bullish", label: "إيجابي" },
  { key: "neutral", label: "محايد" },
  { key: "slightly_bearish", label: "سلبي" },
  { key: "bearish", label: "سلبي جداً" },
];

function SentimentGauge({ score, color }) {
  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${score} 100`}
          strokeLinecap="round"
          className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color }}>{score}</span>
        <span className="text-[9px] text-[#64748b]">/ 100</span>
      </div>
    </div>
  );
}

function NewsCard({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = sentimentConfig[item.sentiment] || sentimentConfig.neutral;
  const Icon = cfg.icon;

  return (
    <div
      className={`rounded-xl border transition-all cursor-pointer ${cfg.bg} ${cfg.border} ${expanded ? "shadow-lg" : "hover:opacity-90"}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 shrink-0 p-1.5 rounded-lg" style={{ backgroundColor: cfg.color + "20" }}>
          <Icon className="w-4 h-4" style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-white font-medium leading-snug">{item.headline}</p>
            <div className="shrink-0 mt-0.5">
              {expanded ? <ChevronUp className="w-4 h-4 text-[#64748b]" /> : <ChevronDown className="w-4 h-4 text-[#64748b]" />}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
            <span className="font-bold px-2 py-0.5 rounded-full text-[10px]"
              style={{ backgroundColor: cfg.color + "20", color: cfg.color }}>
              {cfg.label}
            </span>
            {item.source && <span className="text-[#64748b] flex items-center gap-1"><ExternalLink className="w-3 h-3" />{item.source}</span>}
            {item.time_ago && <span className="text-[#475569] flex items-center gap-1"><Clock className="w-3 h-3" />{item.time_ago}</span>}
            <div className="flex items-center gap-1.5 mr-auto">
              <span className="text-[#64748b] text-[10px]">التأثير</span>
              <div className="w-16 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${item.impact_score}%`, backgroundColor: cfg.color }} />
              </div>
              <span className="font-bold text-[11px]" style={{ color: cfg.color }}>{item.impact_score}%</span>
            </div>
          </div>
        </div>
      </div>
      {expanded && item.analysis && (
        <div className="px-4 pb-4 border-t border-[#1e293b]/50 pt-3 mr-9">
          <p className="text-xs text-[#94a3b8] leading-relaxed">{item.analysis}</p>
          {item.price_effect && (
            <div className="mt-2 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-[#d4a843]" />
              <span className="text-xs text-[#d4a843] font-medium">{item.price_effect}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StockNews() {
  const [inputVal, setInputVal] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredSuggestions = inputVal.trim()
    ? POPULAR_STOCKS.filter(s => s.symbol.includes(inputVal.toUpperCase()) || s.name.includes(inputVal))
    : POPULAR_STOCKS.slice(0, 8);

  const selectStock = (stock) => {
    setSelectedStock(stock);
    setInputVal(`${stock.symbol} — ${stock.name}`);
    setShowDropdown(false);
    fetchNews(stock);
  };

  const fetchNews = async (stock) => {
    setLoading(true);
    setData(null);
    setFilter("all");
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `أنت محلل أخبار مالي متخصص. قم بجلب وتحليل آخر أخبار سهم ${stock.symbol} (${stock.name}) بشكل تفصيلي.

قدم تحليلاً شاملاً يتضمن:
1. المشاعر العامة للسوق تجاه هذا السهم الآن
2. قائمة من 6-8 أخبار/أحداث حديثة حقيقية ودقيقة مع تحليل تأثير كل منها
3. توزيع الأخبار بين إيجابية وسلبية ومحايدة
4. توقع حركة السعر خلال الأسبوع القادم
5. مستوى الضجيج الاجتماعي حول السهم
6. توصية تداول بناء على مجموع المشاعر`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          overall_sentiment: { type: "string", enum: ["bullish", "slightly_bullish", "neutral", "slightly_bearish", "bearish"] },
          sentiment_score: { type: "number" },
          confidence: { type: "number" },
          price_forecast_week: { type: "string" },
          social_buzz_level: { type: "string", enum: ["منخفض", "متوسط", "مرتفع", "مرتفع جداً"] },
          trading_signal: { type: "string" },
          summary: { type: "string" },
          news_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                headline: { type: "string" },
                sentiment: { type: "string", enum: ["bullish", "slightly_bullish", "neutral", "slightly_bearish", "bearish"] },
                impact_score: { type: "number" },
                source: { type: "string" },
                time_ago: { type: "string" },
                analysis: { type: "string" },
                price_effect: { type: "string" }
              }
            }
          },
          breakdown: {
            type: "object",
            properties: {
              positive: { type: "number" },
              neutral: { type: "number" },
              negative: { type: "number" },
              institutional_flow: { type: "string" },
              analyst_consensus: { type: "string" }
            }
          },
          weekly_sentiment_trend: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day: { type: "string" },
                score: { type: "number" }
              }
            }
          }
        }
      }
    });
    setData(result);
    setLoading(false);
  };

  const cfg = data ? (sentimentConfig[data.overall_sentiment] || sentimentConfig.neutral) : null;
  const filteredNews = data?.news_items?.filter(n => filter === "all" || n.sentiment === filter) || [];

  const chartData = data?.news_items?.map((n, i) => ({
    name: `${i + 1}`,
    score: n.impact_score,
    color: sentimentConfig[n.sentiment]?.color || "#d4a843",
    headline: n.headline.substring(0, 30) + "...",
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4a843] to-[#b8922f] flex items-center justify-center shadow-lg">
          <Newspaper className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">أخبار الأسهم وتحليل المشاعر</h1>
          <p className="text-xs text-[#94a3b8]">تحليل ذكي لأخبار السوق وتأثيرها على حركة الأسهم</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
        <label className="text-xs text-[#64748b] block mb-2">ابحث عن سهم</label>
        <div className="relative" ref={searchRef}>
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
          <input
            value={inputVal}
            onChange={e => { setInputVal(e.target.value); setShowDropdown(true); setSelectedStock(null); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="ابحث بالرمز أو الاسم: AAPL, TSLA, أرامكو..."
            className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl pr-10 pl-10 py-3 text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#d4a843]/50"
          />
          {inputVal && (
            <button onClick={() => { setInputVal(""); setSelectedStock(null); setData(null); setShowDropdown(false); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
          {showDropdown && filteredSuggestions.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-[#1a2235] border border-[#1e293b] rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto">
              <div className="p-2 text-[10px] text-[#64748b] border-b border-[#1e293b] px-3">أسهم مقترحة</div>
              {filteredSuggestions.map(stock => (
                <button key={stock.symbol} onMouseDown={() => selectStock(stock)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#d4a843]/10 transition-colors">
                  <span className="text-sm text-[#94a3b8]">{stock.name}</span>
                  <span className="text-sm font-bold text-white bg-[#0f1623] px-2 py-0.5 rounded-lg">{stock.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-[#1e293b] border-t-[#d4a843] animate-spin" />
            <Brain className="absolute inset-0 m-auto w-7 h-7 text-[#d4a843]" />
          </div>
          <p className="text-[#94a3b8]">يحلل الذكاء الاصطناعي أخبار {selectedStock?.symbol}...</p>
          <p className="text-xs text-[#64748b]">جلب الأخبار وتحليل المشاعر من الإنترنت</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-5">
          {/* Main Sentiment Banner */}
          <div className={`rounded-2xl border p-6 ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-5">
                <SentimentGauge score={data.sentiment_score} color={cfg.color} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <cfg.icon className="w-6 h-6" style={{ color: cfg.color }} />
                    <span className="text-2xl font-black" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <p className="text-sm text-[#94a3b8] mb-2">{data.price_forecast_week}</p>
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5 bg-[#0f1623] px-3 py-1.5 rounded-lg border border-[#1e293b]">
                      <Radio className="w-3 h-3 text-[#d4a843]" />
                      <span className="text-[#64748b]">ثقة:</span>
                      <span className="text-white font-bold">{data.confidence}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#0f1623] px-3 py-1.5 rounded-lg border border-[#1e293b]">
                      <Zap className="w-3 h-3 text-[#3b82f6]" />
                      <span className="text-[#64748b]">الضجيج:</span>
                      <span className="text-white font-bold">{data.social_buzz_level}</span>
                    </div>
                    {data.breakdown?.analyst_consensus && (
                      <div className="flex items-center gap-1.5 bg-[#0f1623] px-3 py-1.5 rounded-lg border border-[#1e293b]">
                        <BarChart3 className="w-3 h-3 text-[#10b981]" />
                        <span className="text-[#64748b]">المحللون:</span>
                        <span className="text-white font-bold">{data.breakdown.analyst_consensus}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Breakdown pills */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="text-[#94a3b8]">إيجابي</span>
                  <span className="font-bold text-white text-lg">{data.breakdown?.positive || 0}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-[#d4a843]" />
                  <span className="text-[#94a3b8]">محايد</span>
                  <span className="font-bold text-white text-lg">{data.breakdown?.neutral || 0}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-[#94a3b8]">سلبي</span>
                  <span className="font-bold text-white text-lg">{data.breakdown?.negative || 0}</span>
                </div>
              </div>
            </div>

            {/* Gradient scale bar */}
            <div className="mt-5">
              <div className="relative h-3 rounded-full overflow-hidden"
                style={{ background: "linear-gradient(to left, #ef4444, #f87171, #d4a843, #34d399, #10b981)" }}>
                <div className="absolute top-0 h-full w-1.5 bg-white rounded-full shadow-lg transition-all duration-700"
                  style={{ right: `${100 - data.sentiment_score}%`, transform: 'translateX(50%)' }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1 text-[#64748b]">
                <span>إيجابي جداً ↑</span>
                <span>محايد</span>
                <span>↓ سلبي جداً</span>
              </div>
            </div>
          </div>

          {/* Signal + Institutional */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-4">
              <h3 className="text-xs text-[#64748b] mb-2 font-bold">إشارة التداول</h3>
              <p className="text-white text-sm font-medium">{data.trading_signal}</p>
            </div>
            {data.breakdown?.institutional_flow && (
              <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-4">
                <h3 className="text-xs text-[#64748b] mb-2 font-bold">تدفق المؤسسات</h3>
                <p className="text-white text-sm font-medium">{data.breakdown.institutional_flow}</p>
              </div>
            )}
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* News impact bar chart */}
            {chartData.length > 0 && (
              <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#d4a843]" /> تأثير كل خبر
                </h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                        formatter={(v, _, p) => [p.payload.headline, `${v}%`]}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.85} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Weekly sentiment trend */}
            {data.weekly_sentiment_trend?.length > 0 && (
              <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#3b82f6]" /> اتجاه المشاعر الأسبوعي
                </h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.weekly_sentiment_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                      <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                      <ReferenceLine y={50} stroke="#1e293b" strokeDasharray="4 4" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px', color: '#fff' }} />
                      <Line type="monotone" dataKey="score" stroke="#d4a843" strokeWidth={2.5} dot={{ fill: '#d4a843', strokeWidth: 0, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* News Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-[#64748b]" />
            <span className="text-xs text-[#64748b]">فلترة:</span>
            {FILTER_OPTIONS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === f.key ? "bg-[#d4a843] text-black" : "bg-[#151c2c] border border-[#1e293b] text-[#94a3b8] hover:text-white"}`}>
                {f.label}
                {f.key !== "all" && (
                  <span className="mr-1 opacity-70">
                    ({data.news_items?.filter(n => n.sentiment === f.key).length || 0})
                  </span>
                )}
              </button>
            ))}
            <button onClick={() => fetchNews(selectedStock)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#151c2c] border border-[#1e293b] text-[#94a3b8] hover:text-white transition-all mr-auto">
              <RefreshCw className="w-3 h-3" /> تحديث
            </button>
          </div>

          {/* News List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-[#d4a843]" />
              الأخبار المؤثرة
              <span className="text-xs text-[#64748b] font-normal">({filteredNews.length} خبر)</span>
            </h3>
            {filteredNews.length === 0 ? (
              <p className="text-center text-[#64748b] text-sm py-6">لا توجد أخبار بهذا التصنيف</p>
            ) : (
              filteredNews.map((item, i) => <NewsCard key={i} item={item} index={i} />)
            )}
          </div>

          {/* AI Summary */}
          {data.summary && (
            <div className="bg-gradient-to-l from-[#d4a843]/10 to-[#151c2c] border border-[#d4a843]/20 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Brain className="w-5 h-5 text-[#d4a843] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white mb-1">ملخص تحليل الذكاء الاصطناعي</p>
                  <p className="text-sm text-[#94a3b8] leading-relaxed">{data.summary}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !data && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-20 h-20 rounded-3xl bg-[#151c2c] border border-[#1e293b] flex items-center justify-center">
            <Newspaper className="w-10 h-10 text-[#d4a843]" />
          </div>
          <h2 className="text-lg font-bold text-white">ابدأ بتحليل أخبار السهم</h2>
          <p className="text-sm text-[#94a3b8] max-w-sm">ابحث عن أي سهم واحصل على تحليل ذكي للأخبار الأخيرة وتأثيرها على حركة السعر</p>
        </div>
      )}
    </div>
  );
}