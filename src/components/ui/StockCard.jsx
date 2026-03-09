import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function StockCard({ symbol, name, price, change, market, onClick }) {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <div
      onClick={onClick}
      className="group relative bg-[#151c2c] hover:bg-[#1a2235] border border-[#1e293b] hover:border-[#d4a843]/30 rounded-2xl p-5 cursor-pointer transition-all duration-300 overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-[#d4a843]/5 to-transparent" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e293b] text-[#94a3b8] font-medium">
                {market === "saudi" ? "تداول" : "US"}
              </span>
              <span className="text-sm font-bold text-[#e8c76a]">{symbol}</span>
            </div>
            <p className="text-sm text-[#94a3b8] truncate max-w-[140px]">{name}</p>
          </div>
          <div className={`p-2 rounded-xl ${isPositive ? 'bg-emerald-500/10' : isNeutral ? 'bg-slate-500/10' : 'bg-red-500/10'}`}>
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : isNeutral ? (
              <Minus className="w-4 h-4 text-slate-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>

        <div className="flex items-end justify-between">
          <span className="text-xl font-bold text-white">
            {price?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
          </span>
          <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : isNeutral ? 'text-slate-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{change?.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}