import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Brain, TrendingUp, TrendingDown, RefreshCw, Sparkles,
  ArrowUpRight, ArrowDownRight, ChevronRight
} from "lucide-react";

const STOCKS_TO_ANALYZE = [
  { symbol: "2222", name: "أرامكو", market: "saudi" },
  { symbol: "1120", name: "الراجحي", market: "saudi" },
  { symbol: "2010", name: "سابك", market: "saudi" },
  { symbol: "1180", name: "الأهلي", market: "saudi" },
  { symbol: "2350", name: "كيان", market: "saudi" },
  { symbol: "4280", name: "تمكين", market: "saudi" },
  { symbol: "AAPL", name: "Apple", market: "us" },
  { symbol: "NVDA", name: "NVIDIA", market: "us" },
  { symbol: "TSLA", name: "Tesla", market: "us" },
  { symbol: "MSFT", name: "Microsoft", market: "us" },
];

export default function NextSessionPredictions() {
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [market, setMarket] = useState("saudi");

  const fetchPredictions = async () => {
    setLoading(true);
    setPredictions(null);
    setLoading(false);
  };

  const upStocks = predictions?.predictions?.filter(p => p.direction === "up")
    .sort((a, b) => b.probability - a.probability) || [];
  const downStocks = predictions?.predictions?.filter(p => p.direction === "down")
    .sort((a, b) => b.probability - a.probability) || [];

  return (
    <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-[#1e293b] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4a843]/20 to-[#b8922f]/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-[#d4a843]" />
          </div>
          <div>
            <h2 className="font-bold text-white flex items-center gap-2">
              تنبؤات الجلسة القادمة
              <Sparkles className="w-4 h-4 text-[#d4a843]" />
            </h2>
            <p className="text-xs text-[#64748b]">توقعات مدعومة بالذكاء الاصطناعي وبيانات السوق الحية</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Market Toggle */}
          <div className="flex bg-[#1e293b] rounded-xl p-1 gap-1">
            {[{ key: "saudi", label: "سعودي" }, { key: "us", label: "أمريكي" }].map(m => (
              <button key={m.key} onClick={() => { setMarket(m.key); setPredictions(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${market === m.key ? 'bg-[#d4a843] text-black' : 'text-[#94a3b8] hover:text-white'}`}>
                {m.label}
              </button>
            ))}
          </div>
          <button onClick={fetchPredictions} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#d4a843] hover:bg-[#e8c76a] disabled:opacity-50 text-black font-semibold rounded-xl transition-all text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "جاري التحليل..." : predictions ? "تحديث" : "تحليل الآن"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {!predictions && !loading && (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1e293b] flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-[#2d3a4f]" />
            </div>
            <p className="text-[#64748b] font-medium">اضغط "تحليل الآن" للحصول على توقعات الجلسة القادمة</p>
            <p className="text-xs text-[#3d4f63] mt-1">يستخدم الذكاء الاصطناعي بيانات السوق الحية والأخبار الأخيرة</p>
          </div>
        )}

        {loading && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-2 border-[#1e293b] border-t-[#d4a843] animate-spin" />
              <Brain className="absolute inset-0 m-auto w-6 h-6 text-[#d4a843]" />
            </div>
            <p className="text-[#94a3b8] text-sm">يحلل الذكاء الاصطناعي بيانات السوق...</p>
          </div>
        )}

        {predictions && !loading && (
          <div className="space-y-5">
            {/* Market Summary */}
            {predictions.market_summary && (
              <div className="bg-gradient-to-l from-[#d4a843]/10 to-transparent border border-[#d4a843]/20 rounded-xl p-3 text-sm text-[#94a3b8] leading-relaxed">
                <span className="text-[#d4a843] font-semibold">ملخص السوق: </span>
                {predictions.market_summary}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-5">
              {/* UP predictions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-emerald-400">متوقع ارتفاعها ({upStocks.length})</h3>
                </div>
                <div className="space-y-2">
                  {upStocks.map((p) => (
                    <PredictionRow key={p.symbol} pred={p} onClick={() =>
                      navigate(createPageUrl("StockAnalysis") + `?symbol=${p.symbol}&market=${market}`)} />
                  ))}
                  {upStocks.length === 0 && <p className="text-xs text-[#64748b] py-3">لا توجد أسهم متوقع ارتفاعها</p>}
                </div>
              </div>

              {/* DOWN predictions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-bold text-red-400">متوقع انخفاضها ({downStocks.length})</h3>
                </div>
                <div className="space-y-2">
                  {downStocks.map((p) => (
                    <PredictionRow key={p.symbol} pred={p} onClick={() =>
                      navigate(createPageUrl("StockAnalysis") + `?symbol=${p.symbol}&market=${market}`)} />
                  ))}
                  {downStocks.length === 0 && <p className="text-xs text-[#64748b] py-3">لا توجد أسهم متوقع انخفاضها</p>}
                </div>
              </div>
            </div>

            <p className="text-xs text-[#3d4f63] text-center">⚠️ هذه توقعات تحليلية فقط وليست نصائح استثمارية. التداول ينطوي على مخاطر.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PredictionRow({ pred, onClick }) {
  const isUp = pred.direction === "up";
  const changePct = Math.abs(pred.expected_change_pct || 0);

  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1a2235] hover:bg-[#1e293b] transition-colors text-right group">

      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUp ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
        {isUp
          ? <TrendingUp className="w-4 h-4 text-emerald-400" />
          : <TrendingDown className="w-4 h-4 text-red-400" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-[#e8c76a]">{pred.symbol}</span>
          <span className="text-xs text-[#64748b] truncate">{pred.name}</span>
        </div>
        <p className="text-xs text-[#64748b] truncate mt-0.5">{pred.reason}</p>
      </div>

      {/* Stats */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-sm font-black ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? "+" : "-"}{changePct.toFixed(1)}%
        </span>
        {/* Probability bar */}
        <div className="flex items-center gap-1.5">
          <div className="w-14 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
            <div className="h-full rounded-full"
              style={{
                width: `${pred.probability}%`,
                backgroundColor: isUp ? "#10b981" : "#ef4444"
              }} />
          </div>
          <span className="text-xs text-[#94a3b8]">{pred.probability?.toFixed(0)}%</span>
        </div>
      </div>

      <ChevronRight className="w-3.5 h-3.5 text-[#2d3a4f] group-hover:text-[#d4a843] transition-colors shrink-0" />
    </button>
  );
}