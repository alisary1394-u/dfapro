import React from "react";
import { TrendingUp, TrendingDown, DollarSign, Briefcase, Percent, BarChart3 } from "lucide-react";

// Helper: format amount with currency symbol based on market mix
const fmt = (amount, currency) =>
  currency === "SAR"
    ? `${amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ﷼`
    : `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function PortfolioStats({ holdings }) {
  // Split by market
  const saudiHoldings = holdings.filter(h => h.market === "saudi");
  const usHoldings = holdings.filter(h => h.market !== "saudi");

  const calcGroup = (group) => {
    const value = group.reduce((s, h) => s + h.shares * (h.current_price || h.avg_cost), 0);
    const cost = group.reduce((s, h) => s + h.shares * h.avg_cost, 0);
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    const day = group.reduce((s, h) => s + (h.day_change || 0) * h.shares, 0);
    return { value, cost, pnl, pnlPct, day };
  };

  const sa = calcGroup(saudiHoldings);
  const us = calcGroup(usHoldings);

  // Build stat rows: show per-market if both exist, otherwise just one
  const hasBoth = saudiHoldings.length > 0 && usHoldings.length > 0;
  const hasSA = saudiHoldings.length > 0;
  const hasUS = usHoldings.length > 0;

  // For single-market, use that currency; for both, show 2 rows
  const makeStats = (data, currency, label) => [
    {
      label: `قيمة المحفظة ${label}`,
      value: fmt(data.value, currency),
      sub: `${(currency === "SAR" ? saudiHoldings : usHoldings).length} سهم`,
      icon: Briefcase, color: "#d4a843", bg: "#d4a84315",
    },
    {
      label: `التكلفة ${label}`,
      value: fmt(data.cost, currency),
      sub: "رأس المال المستثمر",
      icon: DollarSign, color: "#3b82f6", bg: "#3b82f615",
    },
    {
      label: `الربح/الخسارة ${label}`,
      value: `${data.pnl >= 0 ? "+" : ""}${fmt(data.pnl, currency)}`,
      sub: `${data.pnlPct >= 0 ? "+" : ""}${data.pnlPct.toFixed(2)}% إجمالي`,
      icon: data.pnl >= 0 ? TrendingUp : TrendingDown,
      color: data.pnl >= 0 ? "#10b981" : "#ef4444",
      bg: data.pnl >= 0 ? "#10b98115" : "#ef444415",
    },
    {
      label: `تغيير اليوم ${label}`,
      value: `${data.day >= 0 ? "+" : ""}${fmt(data.day, currency)}`,
      sub: data.value > 0 ? `${((data.day / data.value) * 100).toFixed(2)}%` : "—",
      icon: data.day >= 0 ? TrendingUp : TrendingDown,
      color: data.day >= 0 ? "#10b981" : "#ef4444",
      bg: data.day >= 0 ? "#10b98115" : "#ef444415",
    },
  ];

  const saStats = hasSA ? makeStats(sa, "SAR", "🇸🇦") : [];
  const usStats = hasUS ? makeStats(us, "USD", "🇺🇸") : [];
  const stats = hasBoth ? [...saStats, ...usStats] : (hasSA ? saStats : usStats);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-[#1e293b] p-5"
          style={{ backgroundColor: s.bg }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: s.color + "25" }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <span className="text-xs text-[#94a3b8]">{s.label}</span>
          </div>
          <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
          <p className="text-xs text-[#64748b] mt-1">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}