import React, { useState, useEffect } from "react";
import {
  Newspaper, TrendingUp, TrendingDown, Minus, Loader2,
  Zap, Radio, MessageSquare, Brain
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const sentimentConfig = {
  bullish: { label: "إيجابي جداً", color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: TrendingUp, dot: "bg-emerald-400" },
  slightly_bullish: { label: "إيجابي", color: "#34d399", bg: "bg-emerald-500/5", border: "border-emerald-500/10", icon: TrendingUp, dot: "bg-emerald-300" },
  neutral: { label: "محايد", color: "#d4a843", bg: "bg-[#d4a843]/10", border: "border-[#d4a843]/20", icon: Minus, dot: "bg-[#d4a843]" },
  slightly_bearish: { label: "سلبي", color: "#f87171", bg: "bg-red-500/5", border: "border-red-500/10", icon: TrendingDown, dot: "bg-red-300" },
  bearish: { label: "سلبي جداً", color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/20", icon: TrendingDown, dot: "bg-red-400" },
};

const botImpact = (score) => {
  if (score >= 75) return { text: "يدعم قرار الشراء بقوة", color: "#10b981", icon: "🟢" };
  if (score >= 58) return { text: "يميل لتأييد الشراء", color: "#34d399", icon: "🟡" };
  if (score >= 42) return { text: "تأثير محايد على البوت", color: "#d4a843", icon: "⚪" };
  if (score >= 25) return { text: "يميل لتأييد البيع", color: "#f87171", icon: "🟠" };
  return { text: "يدعم قرار البيع بقوة", color: "#ef4444", icon: "🔴" };
};

export default function SentimentAnalysis({ stock, botSignal = null }) {
  const [loading, setLoading] = useState(false);
  const [sentiment, setSentiment] = useState(null);

  useEffect(() => {
    if (stock?.symbol) {
      fetchSentiment();
    }
  }, [stock?.symbol]);

  const fetchSentiment = async () => {
    setLoading(true);
    setSentiment(null);
    setSentiment(null);
    setLoading(false);
  };

  if (!stock) return null;

  const impact = sentiment ? botImpact(sentiment.sentiment_score) : null;
  const cfg = sentiment ? (sentimentConfig[sentiment.overall_sentiment] || sentimentConfig.neutral) : null;

  // Chart data
  const chartData = sentiment?.news_items?.map((n, i) => ({
    name: `خبر ${i + 1}`,
    score: n.impact_score,
    fill: sentimentConfig[n.sentiment]?.color || "#d4a843",
  })) || [];

  return (
    <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#d4a843]/10">
            <Newspaper className="w-5 h-5 text-[#d4a843]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">تحليل مشاعر الأخبار</h3>
            <p className="text-xs text-[#64748b]">تأثير الأخبار الحالية على حركة السعر المتوقعة</p>
          </div>
        </div>
        <button onClick={fetchSentiment} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e293b] text-[#94a3b8] text-xs font-bold hover:text-white transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
          تحديث
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="relative mb-4">
            <div className="w-14 h-14 rounded-full border-2 border-[#1e293b] border-t-[#d4a843] animate-spin" />
            <Brain className="absolute inset-0 m-auto w-6 h-6 text-[#d4a843]" />
          </div>
          <p className="text-[#94a3b8] text-sm">يحلل الذكاء الاصطناعي مشاعر الأخبار...</p>
        </div>
      )}

      {sentiment && !loading && (
        <>
          {/* Main Sentiment Meter */}
          <div className={`rounded-2xl border p-5 ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {/* Big score gauge */}
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      stroke={cfg.color} strokeWidth="3"
                      strokeDasharray={`${sentiment.sentiment_score} 100`}
                      strokeLinecap="round" className="transition-all duration-1000" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black" style={{ color: cfg.color }}>{sentiment.sentiment_score}</span>
                    <span className="text-[9px] text-[#64748b]">/ 100</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <cfg.icon className="w-5 h-5" style={{ color: cfg.color }} />
                    <span className="text-xl font-black" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-[#94a3b8]">{sentiment.price_impact_forecast}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
                    <span className="text-xs text-[#64748b]">ثقة التحليل: <span className="text-white font-bold">{sentiment.confidence}%</span></span>
                  </div>
                </div>
              </div>

              {/* Breakdown pills */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[#94a3b8]">إيجابي</span>
                    <span className="text-white font-bold">{sentiment.sentiment_breakdown?.positive_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#d4a843]" />
                    <span className="text-[#94a3b8]">محايد</span>
                    <span className="text-white font-bold">{sentiment.sentiment_breakdown?.neutral_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-[#94a3b8]">سلبي</span>
                    <span className="text-white font-bold">{sentiment.sentiment_breakdown?.negative_count || 0}</span>
                  </div>
                </div>
                {sentiment.sentiment_breakdown?.institutional_flow && (
                  <div className="text-xs bg-[#0f1623] rounded-lg px-3 py-1.5 border border-[#1e293b]">
                    <span className="text-[#64748b]">تدفق المؤسسات: </span>
                    <span className="text-white font-bold">{sentiment.sentiment_breakdown.institutional_flow}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sentiment bar scale */}
            <div className="mt-4">
              <div className="relative h-3 bg-[#0f1623] rounded-full overflow-hidden"
                style={{ background: "linear-gradient(to left, #ef4444, #f87171, #d4a843, #34d399, #10b981)" }}>
                <div className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg transition-all duration-700"
                  style={{ right: `${100 - sentiment.sentiment_score}%`, transform: 'translateX(50%)' }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1 text-[#64748b]">
                <span>إيجابي جداً</span>
                <span>محايد</span>
                <span>سلبي جداً</span>
              </div>
            </div>
          </div>

          {/* Bot Impact Card */}
          {(botSignal !== null) && (
            <div className="rounded-xl border border-[#1e293b] bg-[#0f1623] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-[#d4a843]" />
                <span className="text-sm font-bold text-white">تأثير المشاعر على قرار البوت</span>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{impact.icon}</span>
                  <div>
                    <p className="font-bold text-sm" style={{ color: impact.color }}>{impact.text}</p>
                    <p className="text-xs text-[#64748b] mt-0.5">{sentiment.trading_recommendation}</p>
                  </div>
                </div>
                {botSignal && (
                  <div className="text-xs bg-[#151c2c] rounded-lg px-3 py-2 border border-[#1e293b]">
                    <span className="text-[#64748b]">إشارة البوت: </span>
                    <span className="font-black text-white">{botSignal}</span>
                    <span className="mx-2 text-[#475569]">+</span>
                    <span className="text-[#64748b]">مشاعر الأخبار: </span>
                    <span className="font-black" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                )}
              </div>
              {/* Combined confidence bar */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-[#64748b]">
                  <span>نقاط المشاعر</span>
                  <span>{sentiment.sentiment_score}%</span>
                </div>
                <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${sentiment.sentiment_score}%`, backgroundColor: cfg.color }} />
                </div>
              </div>
            </div>
          )}

          {/* News Impact Chart */}
          {chartData.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart as="div" className="w-4 h-4 text-[#64748b]" />
                <span className="text-sm font-bold text-white">تأثير كل خبر على السعر</span>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={25} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      formatter={(v) => [`${v}%`, "تأثير"]}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* News Items */}
          {sentiment.news_items && sentiment.news_items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-[#64748b]" />
                <span className="text-sm font-bold text-white">الأخبار المؤثرة</span>
              </div>
              {sentiment.news_items.map((item, i) => {
                const itemCfg = sentimentConfig[item.sentiment] || sentimentConfig.neutral;
                const ItemIcon = itemCfg.icon;
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${itemCfg.bg} ${itemCfg.border} transition-all`}>
                    <div className="mt-0.5 shrink-0">
                      <ItemIcon className="w-4 h-4" style={{ color: itemCfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium leading-snug">{item.headline}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="font-bold" style={{ color: itemCfg.color }}>{itemCfg.label}</span>
                        {item.source && <span className="text-[#64748b]">{item.source}</span>}
                        {item.time_ago && <span className="text-[#475569]">{item.time_ago}</span>}
                        <div className="flex items-center gap-1 mr-auto">
                          <span className="text-[#64748b]">التأثير:</span>
                          <div className="w-12 h-1 bg-[#1e293b] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${item.impact_score}%`, backgroundColor: itemCfg.color }} />
                          </div>
                          <span className="font-bold" style={{ color: itemCfg.color }}>{item.impact_score}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {sentiment.sentiment_summary && (
            <div className="bg-gradient-to-l from-[#d4a843]/10 to-[#0f1623] border border-[#d4a843]/20 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-[#d4a843] mt-0.5 shrink-0" />
                <p className="text-xs text-[#94a3b8] leading-relaxed">{sentiment.sentiment_summary}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}