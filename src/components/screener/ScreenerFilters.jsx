import React from "react";
import { Filter, Globe, TrendingUp } from "lucide-react";

const MARKETS = [
  { v: "all", l: "الكل" },
  { v: "saudi", l: "🇸🇦 السعودية" },
  { v: "us", l: "🇺🇸 الأمريكي" },
];

const SIGNALS = [
  { v: "all", l: "كل الإشارات" },
  { v: "strong_buy", l: "🔥 شراء قوي", color: "text-emerald-400" },
  { v: "buy", l: "▲ شراء", color: "text-emerald-300" },
  { v: "neutral", l: "◆ محايد", color: "text-[#d4a843]" },
  { v: "sell", l: "▼ بيع", color: "text-red-300" },
  { v: "strong_sell", l: "⚡ بيع قوي", color: "text-red-400" },
];

export default function ScreenerFilters({ market, setMarket, filter, setFilter, count, total }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Market filter */}
      <div className="flex gap-1 bg-[#0f1623] rounded-xl p-1 border border-[#1e293b]">
        {MARKETS.map(m => (
          <button key={m.v} onClick={() => setMarket(m.v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${market === m.v ? 'bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/30' : 'text-[#64748b] hover:text-white'}`}>
            {m.l}
          </button>
        ))}
      </div>

      {/* Signal filter */}
      <div className="flex gap-1 bg-[#0f1623] rounded-xl p-1 border border-[#1e293b] flex-wrap">
        {SIGNALS.map(s => (
          <button key={s.v} onClick={() => setFilter(s.v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === s.v ? 'bg-[#1e293b] text-white' : `${s.color || 'text-[#64748b]'} hover:text-white`}`}>
            {s.l}
          </button>
        ))}
      </div>

      {total > 0 && (
        <span className="text-xs text-[#64748b] mr-auto">
          عرض <span className="text-white font-bold">{count}</span> من <span className="text-white font-bold">{total}</span> سهم
        </span>
      )}
    </div>
  );
}