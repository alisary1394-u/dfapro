import React, { useState, useEffect } from "react";
import SearchStock from "@/components/ui/SearchStock";
import AnalysisGauge from "@/components/ui/AnalysisGauge";
import {
  GitCompare, X, Plus, Loader2, Sparkles, Scale, ArrowLeftRight
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from "recharts";

const COLORS = ["#d4a843", "#3b82f6", "#10b981"];

export default function Compare() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const symbol = params.get("symbol");
    const market = params.get("market");
    const name = params.get("name") || symbol;
    if (symbol && market) {
      setStocks(prev => {
        if (prev.find(s => s.symbol === symbol)) return prev;
        return [...prev, { symbol, market, name }].slice(0, 3);
      });
    }
  }, [window.location.search]);

  const addStock = (stock) => {
    if (stocks.length < 3 && !stocks.find(s => s.symbol === stock.symbol)) {
      setStocks([...stocks, stock]);
    }
  };

  const removeStock = (symbol) => {
    setStocks(stocks.filter(s => s.symbol !== symbol));
    setComparison(null);
  };

  const runComparison = async () => {
    if (stocks.length < 2) return;
    setLoading(true);

    const stockList = stocks.map(s => `${s.symbol} (${s.name}) - السوق: ${s.market === 'saudi' ? 'السعودي' : 'الأمريكي'}`).join('\n');

    setComparison(null);
    setLoading(false);
  };

  const radarMetrics = comparison?.stocks?.map(s => s.radar) || [];
  const radarData = radarMetrics.length > 0 ? [
    { metric: "الربحية", ...Object.fromEntries(comparison.stocks.map((s, i) => [s.symbol, s.radar?.profitability])) },
    { metric: "النمو", ...Object.fromEntries(comparison.stocks.map((s, i) => [s.symbol, s.radar?.growth])) },
    { metric: "السيولة", ...Object.fromEntries(comparison.stocks.map((s, i) => [s.symbol, s.radar?.liquidity])) },
    { metric: "الاستقرار", ...Object.fromEntries(comparison.stocks.map((s, i) => [s.symbol, s.radar?.stability])) },
    { metric: "القيمة", ...Object.fromEntries(comparison.stocks.map((s, i) => [s.symbol, s.radar?.value])) },
    { metric: "الزخم", ...Object.fromEntries(comparison.stocks.map((s, i) => [s.symbol, s.radar?.momentum])) },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <GitCompare className="w-7 h-7 text-[#d4a843]" />
        <div>
          <h1 className="text-2xl font-bold text-white">مقارنة الأسهم</h1>
          <p className="text-sm text-[#94a3b8]">قارن بين أسهم مختلفة (حتى 3 أسهم)</p>
        </div>
      </div>

      {/* Stock Selector */}
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
        <div className="max-w-xl mb-4">
          <SearchStock onSelect={addStock} placeholder="ابحث وأضف سهماً للمقارنة..." />
        </div>

        <div className="flex flex-wrap gap-3">
          {stocks.map((stock, i) => (
            <div key={stock.symbol} className="flex items-center gap-2 px-4 py-2 rounded-xl border" style={{ borderColor: COLORS[i] + '50', backgroundColor: COLORS[i] + '10' }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
              <span className="text-sm font-bold text-white">{stock.symbol}</span>
              <span className="text-xs text-[#94a3b8]">{stock.name}</span>
              <button onClick={() => removeStock(stock.symbol)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-3 h-3 text-[#94a3b8]" />
              </button>
            </div>
          ))}
          {stocks.length < 3 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-[#1e293b] text-[#64748b] text-sm">
              <Plus className="w-4 h-4" />
              {stocks.length === 0 ? "أضف أسهماً للمقارنة" : "أضف سهماً آخر"}
            </div>
          )}
        </div>

        {stocks.length >= 2 && (
          <button
            onClick={runComparison}
            disabled={loading}
            className="mt-4 px-6 py-3 bg-[#d4a843] hover:bg-[#e8c76a] disabled:opacity-50 text-black font-semibold rounded-xl transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
            {loading ? "جاري المقارنة..." : "ابدأ المقارنة"}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full border-4 border-[#1e293b] border-t-[#d4a843] animate-spin" />
          <p className="text-[#94a3b8] mt-6 text-lg">جاري المقارنة الشاملة...</p>
        </div>
      )}

      {comparison && !loading && (
        <div className="space-y-6">
          {/* Scores */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {comparison.stocks?.map((stock, i) => (
              <div key={stock.symbol} className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6 text-center">
                <div className="w-4 h-4 rounded-full mx-auto mb-3" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-xl font-bold text-[#e8c76a]">{stock.symbol}</span>
                <div className="mt-4">
                  <AnalysisGauge score={stock.overall_score || 50} />
                </div>
              </div>
            ))}
          </div>

          {/* Radar Chart */}
          {radarData.length > 0 && (
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">المقارنة الشاملة</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                    {comparison.stocks?.map((stock, i) => (
                      <Radar
                        key={stock.symbol}
                        name={stock.symbol}
                        dataKey={stock.symbol}
                        stroke={COLORS[i]}
                        fill={COLORS[i]}
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    ))}
                    <Tooltip contentStyle={{ backgroundColor: '#151c2c', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-3">
                {comparison.stocks?.map((stock, i) => (
                  <div key={stock.symbol} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs text-[#94a3b8]">{stock.symbol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial Comparison */}
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-[#1e293b]">
              <h3 className="font-bold text-white">المؤشرات المالية</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-[#64748b] border-b border-[#1e293b]">
                    <th className="text-right p-4">المؤشر</th>
                    {comparison.stocks?.map((s, i) => (
                      <th key={s.symbol} className="text-right p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                          {s.symbol}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "مكرر الأرباح", key: "pe_ratio", suffix: "x" },
                    { label: "القيمة السوقية", key: "market_cap" },
                    { label: "نمو الإيرادات", key: "revenue_growth", suffix: "%" },
                    { label: "هامش الربح", key: "profit_margin", suffix: "%" },
                    { label: "عائد التوزيعات", key: "dividend_yield", suffix: "%" },
                  ].map((metric) => (
                    <tr key={metric.key} className="border-b border-[#1e293b]">
                      <td className="p-4 text-sm text-[#94a3b8]">{metric.label}</td>
                      {comparison.stocks?.map((s) => (
                        <td key={s.symbol} className="p-4 text-sm font-semibold text-white">
                          {s[metric.key]}{metric.suffix || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-gradient-to-l from-[#d4a843]/10 to-[#151c2c] border border-[#d4a843]/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#d4a843]" />
              <h3 className="text-base font-bold text-white">توصية الذكاء الاصطناعي</h3>
            </div>
            <p className="text-sm text-[#d4a843] font-semibold mb-2">{comparison.recommendation}</p>
            <p className="text-sm text-[#94a3b8] leading-relaxed">{comparison.summary}</p>
          </div>
        </div>
      )}

      {stocks.length < 2 && !loading && !comparison && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 rounded-3xl bg-[#d4a843]/10 flex items-center justify-center mb-6">
            <ArrowLeftRight className="w-12 h-12 text-[#d4a843]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">قارن بين الأسهم</h2>
          <p className="text-[#94a3b8] max-w-md">أضف سهمين على الأقل لبدء المقارنة الشاملة</p>
        </div>
      )}
    </div>
  );
}