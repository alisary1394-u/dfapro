import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Trash2, TrendingUp, TrendingDown, ExternalLink, Briefcase } from "lucide-react";

const fmtPrice = (amount, market) =>
  market === "saudi"
    ? `${amount.toFixed(2)} ﷼`
    : `$${amount.toFixed(2)}`;

const fmtTotal = (amount, market) =>
  market === "saudi"
    ? `${amount.toLocaleString('ar-SA', { minimumFractionDigits: 0 })} ﷼`
    : `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

export default function HoldingsTable({ holdings, onDelete }) {
  const navigate = useNavigate();
  const totalValue = holdings.reduce((s, h) => s + h.shares * (h.current_price || h.avg_cost), 0);

  if (holdings.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#1e293b] flex items-center justify-center mx-auto mb-4">
          <Briefcase className="w-8 h-8 text-[#2d3a4f]" />
        </div>
        <p className="text-[#64748b] font-medium">المحفظة فارغة</p>
        <p className="text-xs text-[#3d4f63] mt-1">أضف أسهمك للبدء في التتبع</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-[#64748b] border-b border-[#1e293b]">
            <th className="text-right p-4 font-medium">السهم</th>
            <th className="text-right p-4 font-medium">الكمية</th>
            <th className="text-right p-4 font-medium">تكلفة الشراء</th>
            <th className="text-right p-4 font-medium">القيمة الحالية</th>
            <th className="text-right p-4 font-medium">الربح / الخسارة</th>
            <th className="text-right p-4 font-medium">الوزن</th>
            <th className="p-4" />
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const currentPrice = h.current_price || h.avg_cost;
            const value = h.shares * currentPrice;
            const cost = h.shares * h.avg_cost;
            const pnl = value - cost;
            const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
            const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;
            const isUp = pnl >= 0;

            return (
              <tr key={h.id}
                className="border-b border-[#1e293b] hover:bg-[#1a2235] transition-colors group">
                {/* Stock */}
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#d4a843]/10 border border-[#d4a843]/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-[#d4a843]">{h.symbol.slice(0, 2)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#e8c76a]">{h.symbol}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[#1e293b] text-[#64748b]">
                          {h.market === "saudi" ? "SA" : "US"}
                        </span>
                      </div>
                      <p className="text-xs text-[#94a3b8] mt-0.5 truncate max-w-[100px]">{h.name}</p>
                    </div>
                  </div>
                </td>
                {/* Shares */}
                <td className="p-4 text-white font-medium">{h.shares.toLocaleString()}</td>
                {/* Avg cost */}
                <td className="p-4">
                  <p className="text-white">{fmtPrice(h.avg_cost, h.market)}</p>
                  <p className="text-xs text-[#64748b]">{fmtTotal(cost, h.market)} إجمالي</p>
                </td>
                {/* Current value */}
                <td className="p-4">
                  <p className="text-white font-medium">{fmtPrice(currentPrice, h.market)}</p>
                  <p className="text-xs text-[#94a3b8]">{fmtTotal(value, h.market)}</p>
                </td>
                {/* PnL */}
                <td className="p-4">
                  <div className={`flex items-center gap-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span className="font-bold text-sm">{isUp ? "+" : ""}{fmtPrice(pnl, h.market)}</span>
                  </div>
                  <span className={`text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isUp ? "+" : ""}{pnlPct.toFixed(2)}%
                  </span>
                </td>
                {/* Weight */}
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#d4a843]" style={{ width: `${weight}%` }} />
                    </div>
                    <span className="text-xs text-[#94a3b8]">{weight.toFixed(1)}%</span>
                  </div>
                </td>
                {/* Actions */}
                <td className="p-4">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(createPageUrl("StockAnalysis") + `?symbol=${h.symbol}&market=${h.market}`)}
                      className="p-1.5 hover:bg-[#d4a843]/10 rounded-lg transition-colors"
                      title="تحليل السهم">
                      <ExternalLink className="w-3.5 h-3.5 text-[#d4a843]" />
                    </button>
                    <button
                      onClick={() => onDelete(h.id)}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="حذف">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}