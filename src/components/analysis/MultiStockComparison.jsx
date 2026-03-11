import React, { useState } from "react";
import { getQuote, getOverview } from "@/components/api/marketDataClient";
import { X, Plus, Loader2, Trophy, TrendingUp, TrendingDown, Minus, Star } from "lucide-react";
import SearchStock from "@/components/ui/SearchStock";

const recColor = {
  "شراء قوي": "#10b981",
  "شراء": "#34d399",
  "محايد": "#d4a843",
  "تجنب": "#f97316",
  "بيع قوي": "#ef4444",
  "بيع": "#f87171",
};

const recIcon = (rec) => {
  if (!rec) return <Minus className="w-4 h-4" />;
  if (rec.includes("شراء قوي")) return <TrendingUp className="w-4 h-4" />;
  if (rec.includes("شراء")) return <TrendingUp className="w-4 h-4" />;
  if (rec.includes("بيع")) return <TrendingDown className="w-4 h-4" />;
  return <Minus className="w-4 h-4" />;
};

// Preset groups for quick comparison
const PRESET_GROUPS = [
  { label: "عمالقة التقنية الأمريكية", stocks: [
    { symbol: "AAPL", name: "Apple", market: "us" },
    { symbol: "MSFT", name: "Microsoft", market: "us" },
    { symbol: "NVDA", name: "NVIDIA", market: "us" },
    { symbol: "GOOGL", name: "Alphabet", market: "us" },
  ]},
  { label: "بنوك السوق السعودي", stocks: [
    { symbol: "1120", name: "الراجحي", market: "saudi" },
    { symbol: "1180", name: "الأهلي", market: "saudi" },
    { symbol: "1050", name: "البنك السعودي الفرنسي", market: "saudi" },
    { symbol: "1140", name: "البنك العربي الوطني", market: "saudi" },
  ]},
  { label: "أسهم الذكاء الاصطناعي", stocks: [
    { symbol: "NVDA", name: "NVIDIA", market: "us" },
    { symbol: "MSFT", name: "Microsoft", market: "us" },
    { symbol: "AMD", name: "AMD", market: "us" },
    { symbol: "PLTR", name: "Palantir", market: "us" },
  ]},
  { label: "أرامكو والطاقة", stocks: [
    { symbol: "2222", name: "أرامكو", market: "saudi" },
    { symbol: "XOM", name: "ExxonMobil", market: "us" },
    { symbol: "CVX", name: "Chevron", market: "us" },
    { symbol: "2010", name: "سابك", market: "saudi" },
  ]},
];

async function analyzeStock(stock) {
  const [quote, overview] = await Promise.all([
    getQuote(stock.symbol, stock.market).catch(() => null),
    getOverview(stock.symbol, stock.market).catch(() => null),
  ]);

  const ctx = quote
    ? `السعر: ${quote.price}, التغيير: ${quote.change_percent?.toFixed(2)}%, الحجم: ${quote.volume}`
    : "لا توجد بيانات حية";
  const ovCtx = overview
    ? `P/E: ${overview.pe_ratio}, EPS: ${overview.eps}, نمو: ${overview.revenue_growth}, بيتا: ${overview.beta}`
    : "";

  return { stock, result: null };
}

export default function MultiStockComparison() {
  const [stocks, setStocks] = useState([]);
  const [results, setResults] = useState([]);
  const [loadingMap, setLoadingMap] = useState({});
  const [bestPick, setBestPick] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [analyzingAll, setAnalyzingAll] = useState(false);

  const addStock = (stock) => {
    if (stocks.find(s => s.symbol === stock.symbol)) return;
    if (stocks.length >= 5) return;
    setStocks(prev => [...prev, stock]);
    setShowSearch(false);
  };

  const removeStock = (symbol) => {
    setStocks(prev => prev.filter(s => s.symbol !== symbol));
    setResults(prev => prev.filter(r => r.stock.symbol !== symbol));
    setBestPick(null);
  };

  const loadPreset = (preset) => {
    setStocks(preset.stocks);
    setResults([]);
    setBestPick(null);
  };

  const runAll = async () => {
    if (stocks.length === 0) return;
    setAnalyzingAll(true);
    setResults([]);
    setBestPick(null);

    const newLoading = {};
    stocks.forEach(s => newLoading[s.symbol] = true);
    setLoadingMap(newLoading);

    const allResults = await Promise.all(
      stocks.map(async (stock) => {
        const r = await analyzeStock(stock).catch(() => ({ stock, result: null }));
        setLoadingMap(prev => ({ ...prev, [stock.symbol]: false }));
        return r;
      })
    );

    setResults(allResults.filter(r => r.result));

    // Find best pick by overall_score
    const best = allResults
      .filter(r => r.result)
      .sort((a, b) => (b.result.overall_score || 0) - (a.result.overall_score || 0))[0];
    setBestPick(best?.stock?.symbol);
    setAnalyzingAll(false);
  };

  const scoreColor = (score) => {
    if (score >= 75) return "#10b981";
    if (score >= 55) return "#d4a843";
    return "#ef4444";
  };

  const ScoreBar = ({ value, max = 100 }) => (
    <div className="w-full h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${(value / max) * 100}%`, backgroundColor: scoreColor(value) }}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Preset Groups */}
      <div>
        <p className="text-xs text-[#64748b] mb-2">مجموعات جاهزة للمقارنة</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_GROUPS.map(g => (
            <button
              key={g.label}
              onClick={() => loadPreset(g)}
              className="px-3 py-1.5 text-xs bg-[#1e293b] hover:bg-[#252f42] text-[#94a3b8] hover:text-white rounded-lg transition-all border border-[#1e293b] hover:border-[#d4a843]/30"
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Stocks */}
      <div className="flex flex-wrap gap-2 items-center">
        {stocks.map(s => (
          <div
            key={s.symbol}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
              bestPick === s.symbol
                ? "bg-[#d4a843]/20 border-[#d4a843]/50 text-[#d4a843]"
                : "bg-[#151c2c] border-[#1e293b] text-white"
            }`}
          >
            {bestPick === s.symbol && <Star className="w-3 h-3 fill-current" />}
            <span>{s.symbol}</span>
            {loadingMap[s.symbol] && <Loader2 className="w-3 h-3 animate-spin" />}
            <button onClick={() => removeStock(s.symbol)} className="text-[#64748b] hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {stocks.length < 5 && (
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[#1e293b] text-[#64748b] hover:text-white hover:border-[#d4a843]/40 text-sm transition-all"
          >
            <Plus className="w-3 h-3" /> إضافة سهم
          </button>
        )}

        {stocks.length >= 2 && (
          <button
            onClick={runAll}
            disabled={analyzingAll}
            className="mr-auto flex items-center gap-2 px-4 py-1.5 bg-[#d4a843] hover:bg-[#e8c76a] disabled:opacity-50 text-black font-bold rounded-xl text-sm transition-all"
          >
            {analyzingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
            {analyzingAll ? "جاري المقارنة..." : "قارن الآن"}
          </button>
        )}
      </div>

      {showSearch && (
        <div className="max-w-sm">
          <SearchStock onSelect={addStock} />
        </div>
      )}

      {/* Best Pick Banner */}
      {bestPick && (
        <div className="flex items-center gap-3 p-4 bg-[#d4a843]/10 border border-[#d4a843]/30 rounded-xl">
          <Trophy className="w-6 h-6 text-[#d4a843] shrink-0" />
          <div>
            <p className="text-sm font-bold text-[#d4a843]">
              الأفضل للاستثمار: {bestPick} — {stocks.find(s => s.symbol === bestPick)?.name}
            </p>
            <p className="text-xs text-[#94a3b8]">
              {results.find(r => r.stock.symbol === bestPick)?.result?.recommendation} ·
              تقييم: {results.find(r => r.stock.symbol === bestPick)?.result?.overall_score}/100
            </p>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e293b]">
                <th className="text-right py-3 px-3 text-xs text-[#64748b] font-medium">السهم</th>
                <th className="text-center py-3 px-3 text-xs text-[#64748b] font-medium">التقييم</th>
                <th className="text-center py-3 px-3 text-xs text-[#64748b] font-medium">التوصية</th>
                <th className="text-center py-3 px-3 text-xs text-[#64748b] font-medium">السعر</th>
                <th className="text-center py-3 px-3 text-xs text-[#64748b] font-medium">الهدف</th>
                <th className="text-center py-3 px-3 text-xs text-[#64748b] font-medium">فني</th>
                <th className="text-center py-3 px-3 text-xs text-[#64748b] font-medium">أساسي</th>
                <th className="text-center py-3 px-3 text-xs text-[#64748b] font-medium">المخاطرة</th>
              </tr>
            </thead>
            <tbody>
              {results
                .sort((a, b) => (b.result?.overall_score || 0) - (a.result?.overall_score || 0))
                .map(({ stock, result }, idx) => (
                <tr
                  key={stock.symbol}
                  className={`border-b border-[#1e293b] transition-colors ${
                    bestPick === stock.symbol ? "bg-[#d4a843]/5" : "hover:bg-[#1a2235]"
                  }`}
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      {idx === 0 && <Trophy className="w-3.5 h-3.5 text-[#d4a843]" />}
                      <div>
                        <p className="font-bold text-white">{stock.symbol}</p>
                        <p className="text-[10px] text-[#64748b]">{stock.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-center">
                      <p className="font-bold text-base" style={{ color: scoreColor(result.overall_score || 0) }}>
                        {result.overall_score || "—"}
                      </p>
                      <ScoreBar value={result.overall_score || 0} />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: (recColor[result.recommendation] || "#94a3b8") + "20", color: recColor[result.recommendation] || "#94a3b8" }}
                    >
                      {recIcon(result.recommendation)}
                      {result.recommendation || "—"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-white font-mono text-xs">
                    {result.current_price ? `$${result.current_price.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {result.target_price && result.current_price ? (
                      <span className={`text-xs font-bold ${result.target_price > result.current_price ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                        ${result.target_price.toFixed(2)}
                        <span className="text-[10px] block">
                          ({result.target_price > result.current_price ? "+" : ""}
                          {(((result.target_price - result.current_price) / result.current_price) * 100).toFixed(1)}%)
                        </span>
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-center">
                      <p className="text-xs font-bold" style={{ color: scoreColor(result.technical_score || 0) }}>{result.technical_score || "—"}</p>
                      <ScoreBar value={result.technical_score || 0} />
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-center">
                      <p className="text-xs font-bold" style={{ color: scoreColor(result.fundamental_score || 0) }}>{result.fundamental_score || "—"}</p>
                      <ScoreBar value={result.fundamental_score || 0} />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-xs font-medium ${
                      result.risk_level?.includes("منخفض") ? "text-[#10b981]" :
                      result.risk_level?.includes("عالي") ? "text-[#ef4444]" : "text-[#d4a843]"
                    }`}>
                      {result.risk_level || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Strengths / Weaknesses per stock */}
      {results.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(({ stock, result }) => (
            <div key={stock.symbol} className={`bg-[#151c2c] border rounded-xl p-4 ${bestPick === stock.symbol ? "border-[#d4a843]/40" : "border-[#1e293b]"}`}>
              <div className="flex items-center gap-2 mb-3">
                {bestPick === stock.symbol && <Star className="w-3.5 h-3.5 text-[#d4a843] fill-current" />}
                <span className="font-bold text-white text-sm">{stock.symbol}</span>
                <span className="text-[10px] text-[#64748b]">{stock.name}</span>
              </div>
              {result.main_strength && (
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-[#10b981] text-xs shrink-0">✓</span>
                  <p className="text-xs text-[#94a3b8]">{result.main_strength}</p>
                </div>
              )}
              {result.main_weakness && (
                <div className="flex items-start gap-2">
                  <span className="text-[#ef4444] text-xs shrink-0">✗</span>
                  <p className="text-xs text-[#94a3b8]">{result.main_weakness}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {stocks.length === 0 && (
        <div className="text-center py-10 text-[#64748b] text-sm">
          اختر مجموعة جاهزة أو أضف أسهماً للمقارنة بينها
        </div>
      )}
    </div>
  );
}