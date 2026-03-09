import React, { useEffect, useState, useRef } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { getIndices } from "@/components/api/marketDataClient";

const FALLBACK = [
  { name: "تاسي", value: 12456.78, change_percent: 1.23, market: "saudi" },
  { name: "S&P 500", value: 5234.56, change_percent: 0.89, market: "us" },
  { name: "ناسداك", value: 16789.12, change_percent: 1.56, market: "us" },
  { name: "داو جونز", value: 39456.78, change_percent: -0.12, market: "us" },
];

export default function MarketOverviewBar({ compact = false }) {
  const [indices, setIndices] = useState(FALLBACK);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flashes, setFlashes] = useState({});
  const prevRef = useRef({});

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getIndices();
      if (data && data.length > 0) {
        // Detect changes and trigger flashes
        const newFlashes = {};
        data.forEach(idx => {
          const prev = prevRef.current[idx.name];
          if (prev != null && idx.value !== prev) {
            newFlashes[idx.name] = idx.value > prev ? "up" : "down";
          }
          prevRef.current[idx.name] = idx.value;
        });
        if (Object.keys(newFlashes).length > 0) {
          setFlashes(newFlashes);
          setTimeout(() => setFlashes({}), 800);
        }
        setIndices(data);
        setLive(true);
      }
    } catch (_) {}
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex items-center gap-1 flex-nowrap overflow-hidden">
      {/* Live badge */}
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {loading ? (
          <RefreshCw className="w-3 h-3 text-[#475569] animate-spin" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${live ? "bg-emerald-400 animate-pulse" : "bg-[#475569]"}`} />
        )}
        {!compact && (
          <span className={`text-[11px] font-bold ${live ? "text-emerald-400" : "text-[#475569]"}`}>
            {live ? "مباشر" : "محاكاة"}
          </span>
        )}
      </div>

      <div className="w-px h-4 bg-[#1a2540] mx-2 shrink-0" />

      <div className="flex items-center gap-4 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
        {indices.map((idx, i) => {
          const isUp = (idx.change_percent ?? 0) >= 0;
          return (
            <div key={idx.name ?? i} className={`flex items-center gap-2.5 shrink-0 px-1.5 py-0.5 rounded-md transition-all ${flashes[idx.name] === "up" ? "price-flash-up" : flashes[idx.name] === "down" ? "price-flash-down" : ""}`}>
              <div>
                <span className="text-[10px] text-[#475569] font-medium block leading-none mb-0.5">{idx.name}</span>
                <span className={`${compact ? 'text-xs' : 'text-sm'} font-black text-white ${flashes[idx.name] === "up" ? "price-tick-up" : flashes[idx.name] === "down" ? "price-tick-down" : ""}`}>
                  {idx.value?.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {isUp ? "+" : ""}{idx.change_percent?.toFixed(2)}%
              </div>
              {i < indices.length - 1 && <div className="w-px h-5 bg-[#1a2540] shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Refresh button */}
      <button onClick={fetchData} disabled={loading}
        className="p-1.5 rounded-lg hover:bg-[#1a2540] transition-colors shrink-0 disabled:opacity-40 ml-1">
        <RefreshCw className={`w-3 h-3 text-[#475569] ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}