import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import AnalysisGauge from "@/components/ui/AnalysisGauge";
import {
  Radar, Search, Loader2, Brain, Sparkles, Filter,
  TrendingUp, Shield, Zap, Target, ArrowLeft, BarChart3
} from "lucide-react";

const strategies = [
  { id: "value", name: "القيمة المخفية", desc: "أسهم مقيمة بأقل من قيمتها الحقيقية", icon: Target, color: "#10b981" },
  { id: "momentum", name: "الزخم القوي", desc: "أسهم تظهر زخماً صعودياً قوياً", icon: Zap, color: "#3b82f6" },
  { id: "growth", name: "النمو المتسارع", desc: "شركات بمعدلات نمو استثنائية", icon: TrendingUp, color: "#d4a843" },
  { id: "dividend", name: "التوزيعات العالية", desc: "أسهم بعوائد توزيعات مجزية", icon: BarChart3, color: "#8b5cf6" },
  { id: "safe", name: "الملاذ الآمن", desc: "أسهم مستقرة ومنخفضة المخاطر", icon: Shield, color: "#06b6d4" },
];

export default function OpportunityRadar() {
  const navigate = useNavigate();
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [market, setMarket] = useState("saudi");
  const [loading, setLoading] = useState(false);
  const [opportunities, setOpportunities] = useState(null);

  const scanOpportunities = async (strategy) => {
    setSelectedStrategy(strategy);
    setLoading(true);
    setOpportunities(null);

    const strategyPrompts = {
      value: "ابحث عن أسهم مقيمة بأقل من قيمتها الحقيقية بناءً على مكرر الأرباح المنخفض والقيمة الدفترية",
      momentum: "ابحث عن أسهم تظهر زخماً صعودياً قوياً مع ارتفاع في أحجام التداول واختراق مقاومات",
      growth: "ابحث عن شركات بمعدلات نمو عالية في الإيرادات والأرباح",
      dividend: "ابحث عن أسهم بعوائد توزيعات نقدية عالية ومستدامة",
      safe: "ابحث عن أسهم مستقرة منخفضة التقلب مع أساسيات قوية"
    };

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `أنت محلل أسهم خبير. ${strategyPrompts[strategy.id]}
      
السوق: ${market === 'saudi' ? 'السوق السعودي (تداول)' : 'السوق الأمريكي'}
      
أعطني قائمة بأفضل 6 أسهم تحقق هذه الاستراتيجية مع تحليل مختصر لكل سهم.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          stocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                symbol: { type: "string" },
                name: { type: "string" },
                score: { type: "number" },
                current_price: { type: "number" },
                target_price: { type: "number" },
                reason: { type: "string" },
                key_metric: { type: "string" },
                key_value: { type: "string" },
                risk_level: { type: "string" }
              }
            }
          },
          market_insight: { type: "string" }
        }
      }
    });

    setOpportunities(result);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Radar className="w-7 h-7 text-[#d4a843]" />
        <div>
          <h1 className="text-2xl font-bold text-white">رادار الفرص</h1>
          <p className="text-sm text-[#94a3b8]">اكتشف فرص استثمارية ذكية</p>
        </div>
      </div>

      {/* Market Toggle */}
      <div className="flex gap-2 bg-[#151c2c] border border-[#1e293b] rounded-xl p-1 w-fit">
        {[
          { key: "saudi", label: "السعودي" },
          { key: "us", label: "الأمريكي" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => { setMarket(m.key); setOpportunities(null); setSelectedStrategy(null); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              market === m.key ? 'bg-[#d4a843] text-black' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Strategies */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {strategies.map((strategy) => {
          const isActive = selectedStrategy?.id === strategy.id;
          return (
            <button
              key={strategy.id}
              onClick={() => scanOpportunities(strategy)}
              className={`relative text-right p-5 rounded-2xl border transition-all duration-300 ${
                isActive
                  ? 'bg-[#1a2235] border-[#d4a843]/40'
                  : 'bg-[#151c2c] border-[#1e293b] hover:border-[#d4a843]/20 hover:bg-[#1a2235]'
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-br from-[#d4a843]/5 to-transparent rounded-2xl" />
              )}
              <div className="relative z-10">
                <div className="p-2.5 rounded-xl w-fit mb-3" style={{ backgroundColor: strategy.color + '15' }}>
                  <strategy.icon className="w-5 h-5" style={{ color: strategy.color }} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{strategy.name}</h3>
                <p className="text-xs text-[#64748b] leading-relaxed">{strategy.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-[#1e293b] border-t-[#d4a843] animate-spin" />
            <Radar className="absolute inset-0 m-auto w-8 h-8 text-[#d4a843]" />
          </div>
          <p className="text-[#94a3b8] mt-6 text-lg">جاري مسح السوق...</p>
          <p className="text-[#64748b] text-sm mt-2">تحليل الفرص بناءً على استراتيجية {selectedStrategy?.name}</p>
        </div>
      )}

      {opportunities && !loading && (
        <div className="space-y-6">
          {opportunities.market_insight && (
            <div className="bg-gradient-to-l from-[#d4a843]/10 to-[#151c2c] border border-[#d4a843]/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#d4a843]" />
                <span className="text-sm font-bold text-[#d4a843]">رؤية السوق</span>
              </div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">{opportunities.market_insight}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.stocks?.map((stock, i) => (
              <div
                key={i}
                onClick={() => navigate(createPageUrl("StockAnalysis") + `?symbol=${stock.symbol}&market=${market}`)}
                className="group bg-[#151c2c] border border-[#1e293b] hover:border-[#d4a843]/30 rounded-2xl p-5 cursor-pointer transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-lg font-bold text-[#e8c76a]">{stock.symbol}</span>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{stock.name}</p>
                  </div>
                  <AnalysisGauge score={stock.score || 70} size={60} />
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <span className="text-xs text-[#64748b]">السعر الحالي</span>
                    <p className="text-sm font-bold text-white">{stock.current_price}</p>
                  </div>
                  <div className="text-[#d4a843]">→</div>
                  <div>
                    <span className="text-xs text-[#64748b]">المستهدف</span>
                    <p className="text-sm font-bold text-emerald-400">{stock.target_price}</p>
                  </div>
                </div>

                <p className="text-xs text-[#94a3b8] leading-relaxed mb-3">{stock.reason}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-lg bg-[#1e293b] text-[#94a3b8]">{stock.key_metric}: {stock.key_value}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg ${
                    stock.risk_level === 'منخفض' ? 'bg-emerald-500/10 text-emerald-400' :
                    stock.risk_level === 'متوسط' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    مخاطر: {stock.risk_level}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedStrategy && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 rounded-3xl bg-[#d4a843]/10 flex items-center justify-center mb-6">
            <Target className="w-12 h-12 text-[#d4a843]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">اختر استراتيجية الاستثمار</h2>
          <p className="text-[#94a3b8] max-w-md">اختر إحدى الاستراتيجيات أعلاه وسيقوم الذكاء الاصطناعي بمسح السوق لاكتشاف أفضل الفرص</p>
        </div>
      )}
    </div>
  );
}