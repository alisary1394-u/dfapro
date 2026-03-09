import React, { useState, useEffect, useRef } from "react";
import { Search, X, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

const popularStocks = {
  saudi: [
    { symbol: "2222", name: "أرامكو السعودية" },
    { symbol: "1120", name: "الراجحي" },
    { symbol: "2010", name: "سابك" },
    { symbol: "1180", name: "الأهلي" },
    { symbol: "2350", name: "كيان" },
    { symbol: "1010", name: "الرياض" },
    { symbol: "2280", name: "المراعي" },
    { symbol: "2050", name: "صافولا" },
    { symbol: "7010", name: "STC" },
    { symbol: "4200", name: "الدريس" },
  ],
  us: [
    { symbol: "AAPL", name: "Apple" },
    { symbol: "MSFT", name: "Microsoft" },
    { symbol: "GOOGL", name: "Alphabet" },
    { symbol: "AMZN", name: "Amazon" },
    { symbol: "NVDA", name: "NVIDIA" },
    { symbol: "TSLA", name: "Tesla" },
    { symbol: "META", name: "Meta" },
    { symbol: "NFLX", name: "Netflix" },
    { symbol: "JPM", name: "JPMorgan" },
    { symbol: "V", name: "Visa" },
  ]
};

export default function SearchStock({ onSelect, market = "all", placeholder = "ابحث عن سهم..." }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allStocks = [
    ...(market === "all" || market === "saudi" ? popularStocks.saudi.map(s => ({ ...s, market: "saudi" })) : []),
    ...(market === "all" || market === "us" ? popularStocks.us.map(s => ({ ...s, market: "us" })) : []),
  ];

  const filtered = query
    ? allStocks.filter(s => s.symbol.toLowerCase().includes(query.toLowerCase()) || s.name.toLowerCase().includes(query.toLowerCase()))
    : allStocks;

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-[#151c2c] border border-[#1e293b] rounded-xl pr-10 pl-10 py-3 text-sm text-white placeholder-[#64748b] focus:outline-none focus:border-[#d4a843]/50 focus:ring-1 focus:ring-[#d4a843]/20 transition-all"
        />
        {query && (
          <button onClick={() => { setQuery(""); setIsOpen(false); }} className="absolute left-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-[#94a3b8] hover:text-white transition-colors" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-[#151c2c] border border-[#1e293b] rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto">
          {filtered.length > 0 ? filtered.map((stock) => (
            <button
              key={`${stock.market}-${stock.symbol}`}
              onClick={() => {
                onSelect(stock);
                setQuery("");
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a2235] transition-colors text-right"
            >
              <div className="w-8 h-8 rounded-lg bg-[#1e293b] flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-[#d4a843]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{stock.symbol}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[#1e293b] text-[#64748b]">
                    {stock.market === "saudi" ? "تداول" : "US"}
                  </span>
                </div>
                <p className="text-xs text-[#94a3b8] truncate">{stock.name}</p>
              </div>
            </button>
          )) : (
            <div className="px-4 py-6 text-center text-sm text-[#64748b]">لا توجد نتائج</div>
          )}
        </div>
      )}
    </div>
  );
}