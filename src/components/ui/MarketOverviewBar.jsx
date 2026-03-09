import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { getIndices } from "@/components/api/marketDataClient";

const FALLBACK = [
  { name: "تاسي", value: 12456.78, change_percent: 1.23, market: "saudi" },
  { name: "S&P 500", value: 5234.56, change_percent: 0.89, market: "us" },
  { name: "ناسداك", value: 16789.12, change_percent: 1.56, market: "us" },
  { name: "داو جونز", value: 39456.78, change_percent: -0.12, market: "us" },
];

export default function MarketOverviewBar() {
  const [indices, setIndices] = useState(FALLBACK);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getIndices();
      if (data && data.length > 0) {
        setIndices(data);
        setLive(true);
      }
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Live badge */}
      <div className="flex items-center gap-1.5 ml-3 shrink-0">
        {loading ? (
          <RefreshCw className="w-3 h-3 text-[#64748b] animate-spin" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-[#64748b]"}`} />
        )}
        <span className={`text-xs font-bold ${live ? "text-emerald-400" : "text-[#64748b]"}`}>
          {live ? "مباشر" : "محاكاة"}
        </span>
      </div>

      <div className="w-px h-4 bg-[#1e293b] mx-1" />

      <div className="flex items-center gap-6 overflow-x-auto pb-1 scrollbar-none flex-1">
        {indices.map((idx, i) => {
          const isUp = (idx.change_percent ?? 0) >= 0;
          return (
            <div key={idx.name ?? i} className="flex items-center gap-3 shrink-0">
              <div>
                <span className="text-xs text-[#64748b] font-medium block leading-none mb-0.5">{idx.name}</span>
                <span className="text-sm font-black text-white">{idx.value?.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isUp ? "+" : ""}{idx.change_percent?.toFixed(2)}%
              </div>
              {i < indices.length - 1 && <div className="w-px h-6 bg-[#1e293b]" />}
            </div>
          );
        })}
      </div>

      {/* Refresh button */}
      <button onClick={fetchData} disabled={loading}
        className="p-1.5 rounded-lg hover:bg-[#1e293b] transition-colors shrink-0 disabled:opacity-40 mr-1">
        <RefreshCw className={`w-3.5 h-3.5 text-[#64748b] ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}