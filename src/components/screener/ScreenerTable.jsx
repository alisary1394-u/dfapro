import React, { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { signalColor } from "@/pages/Screener";

const KEY_TF_ORDER = ["5m", "15m", "1h", "4h", "1d"];
const KEY_TF_LABELS = { "5m": "5د", "15m": "15د", "1h": "1س", "4h": "4س", "1d": "يوم" };

export default function ScreenerTable({ results }) {
  const [sortBy, setSortBy] = useState("avgScore");
  const [sortDir, setSortDir] = useState(-1); // -1 desc, 1 asc

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d * -1);
    else { setSortBy(col); setSortDir(-1); }
  };

  const sorted = [...results].sort((a, b) => {
    const av = a[sortBy] ?? 0;
    const bv = b[sortBy] ?? 0;
    return (av - bv) * sortDir;
  });

  const SortBtn = ({ col, label }) => (
    <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-white transition-colors">
      {label}
      {sortBy === col ? (sortDir === -1 ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null}
    </button>
  );

  return (
    <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e293b] bg-[#0f1623]">
              <th className="text-right py-3 px-4 text-[#64748b] font-medium">السهم</th>
              <th className="text-right py-3 px-3 text-[#64748b] font-medium"><SortBtn col="price" label="السعر" /></th>
              <th className="text-right py-3 px-3 text-[#64748b] font-medium"><SortBtn col="change" label="التغير" /></th>
              <th className="text-right py-3 px-3 text-[#64748b] font-medium">الإشارة</th>
              <th className="text-right py-3 px-3 text-[#64748b] font-medium"><SortBtn col="avgScore" label="القوة" /></th>
              {KEY_TF_ORDER.map(tf => (
                <th key={tf} className="text-center py-3 px-2 text-[#64748b] font-medium">{KEY_TF_LABELS[tf]}</th>
              ))}
              <th className="text-right py-3 px-3 text-[#64748b] font-medium"><SortBtn col="aligned" label="التوافق" /></th>
              <th className="text-right py-3 px-3 text-[#64748b] font-medium">آخر مسح</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const colors = signalColor(row.signalType);
              const isUp = row.change >= 0;
              return (
                <tr key={row.symbol} className="border-b border-[#1a2235] hover:bg-[#1e293b]/30 transition-colors">
                  {/* Symbol */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black"
                        style={{ backgroundColor: colors.bg + '20', color: colors.bg }}>
                        {row.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-white font-bold">{row.symbol}</p>
                        <p className="text-[#64748b] truncate max-w-[80px]">{row.name}</p>
                      </div>
                      <span className="text-[#475569] text-xs">{row.market === "saudi" ? "🇸🇦" : "🇺🇸"}</span>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-3 px-3 text-white font-semibold">{row.price.toFixed(2)}</td>

                  {/* Change */}
                  <td className="py-3 px-3">
                    <span className={`font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isUp ? '▲' : '▼'} {Math.abs(row.change).toFixed(2)}%
                    </span>
                  </td>

                  {/* Signal */}
                  <td className="py-3 px-3">
                    <span className={`px-2 py-1 rounded-lg font-bold ${colors.badgeBg} ${colors.badgeText} border ${colors.border}`}>
                      {row.signal}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${row.avgScore}%`, backgroundColor: colors.bg }} />
                      </div>
                      <span className="font-bold" style={{ color: colors.bg }}>{row.avgScore}%</span>
                    </div>
                  </td>

                  {/* TF mini badges */}
                  {KEY_TF_ORDER.map(tfKey => {
                    const tf = row.tfScores?.[tfKey];
                    if (!tf) return <td key={tfKey} className="py-3 px-2 text-center text-[#475569]">—</td>;
                    return (
                      <td key={tfKey} className="py-3 px-2 text-center">
                        <div className={`inline-flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg ${tf.isBull ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                          {tf.isBull
                            ? <TrendingUp className="w-3 h-3 text-emerald-400" />
                            : <TrendingDown className="w-3 h-3 text-red-400" />
                          }
                          <span className={`text-[10px] font-bold ${tf.isBull ? 'text-emerald-400' : 'text-red-400'}`}>{tf.score}</span>
                        </div>
                      </td>
                    );
                  })}

                  {/* Alignment */}
                  <td className="py-3 px-3">
                    <span className="text-white font-bold">{row.aligned}/{row.totalTfs}</span>
                    <span className="text-[#64748b] mr-1">أطر</span>
                  </td>

                  {/* Time */}
                  <td className="py-3 px-3 text-[#64748b]">{row.scannedAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}