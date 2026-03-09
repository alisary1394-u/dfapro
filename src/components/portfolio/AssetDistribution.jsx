import React, { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { PieChart as PieIcon, BarChart3 } from "lucide-react";

const COLORS = ["#d4a843", "#10b981", "#3b82f6", "#8b5cf6", "#06b6d4", "#f43f5e", "#f97316", "#84cc16", "#a855f7", "#14b8a6"];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-xl p-3 text-xs">
        <p className="text-white font-bold">{payload[0].name}</p>
        <p className="text-[#d4a843]">{payload[0].value?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</p>
        <p className="text-[#94a3b8]">{payload[0].payload.pct?.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
};

export default function AssetDistribution({ holdings }) {
  const [view, setView] = useState("sector"); // "sector" | "market" | "stock"
  const totalValue = holdings.reduce((s, h) => s + h.shares * (h.current_price || h.avg_cost), 0);

  const buildData = () => {
    const map = {};
    holdings.forEach(h => {
      const val = h.shares * (h.current_price || h.avg_cost);
      const key = view === "sector" ? (h.sector || "أخرى") :
                  view === "market" ? (h.market === "saudi" ? "السوق السعودي" : "السوق الأمريكي") :
                  h.symbol;
      map[key] = (map[key] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({
      name, value: parseFloat(value.toFixed(2)),
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  };

  const data = buildData();

  if (holdings.length === 0) {
    return (
      <div className="py-12 text-center text-[#64748b] text-sm">
        أضف أسهماً لعرض توزيع الأصول
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Switcher */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "sector", label: "القطاع" },
          { key: "market", label: "السوق" },
          { key: "stock", label: "الأسهم" },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === v.key ? 'bg-[#d4a843] text-black' : 'bg-[#1e293b] text-[#94a3b8] hover:text-white'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Donut Chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
              dataKey="value" stroke="none" paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-xs text-[#94a3b8] flex-1 truncate">{item.name}</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
              </div>
              <span className="text-xs font-bold text-white w-10 text-left">{item.pct.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}