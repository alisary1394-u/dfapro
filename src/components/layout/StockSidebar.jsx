import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Search, TrendingUp, ChevronDown, ChevronUp, FolderOpen } from "lucide-react";

const STOCKS = {
  us: [
    { symbol: "AAPL", name: "Apple" },
    { symbol: "MSFT", name: "Microsoft" },
    { symbol: "GOOGL", name: "Google" },
    { symbol: "AMZN", name: "Amazon" },
    { symbol: "NVDA", name: "NVIDIA" },
    { symbol: "TSLA", name: "Tesla" },
    { symbol: "META", name: "Meta" },
    { symbol: "NFLX", name: "Netflix" },
    { symbol: "AMD", name: "AMD" },
    { symbol: "INTC", name: "Intel" },
    { symbol: "JPM", name: "JPMorgan" },
    { symbol: "BAC", name: "Bank of America" },
    { symbol: "V", name: "Visa" },
    { symbol: "WMT", name: "Walmart" },
    { symbol: "DIS", name: "Disney" },
  ],
  saudi: [
    { symbol: "2222", name: "أرامكو" },
    { symbol: "1180", name: "الأهلي" },
    { symbol: "2010", name: "سابك" },
    { symbol: "1120", name: "الراجحي" },
    { symbol: "2350", name: "كيان" },
    { symbol: "1010", name: "الرياض" },
    { symbol: "2380", name: "بترو رابغ" },
    { symbol: "4200", name: "الاتصالات" },
    { symbol: "7010", name: "STC" },
    { symbol: "2330", name: "أدوا" },
    { symbol: "4030", name: "تبوك للزراعة" },
    { symbol: "4190", name: "جرير" },
    { symbol: "8010", name: "سلامة" },
    { symbol: "3010", name: "نماء" },
    { symbol: "1211", name: "معادن" },
  ],
};

// Pages that support stock selection via URL params
const SUPPORTED_PAGES = ["StockAnalysis", "Compare", "TradingBot", "Screener"];

function WatchlistItems({ collectionId, onSelectStock }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const watchlistItems = await base44.entities.WatchlistItem.filter({ watchlist_id: collectionId });
        setItems(watchlistItems || []);
      } catch (err) {
        console.error("Error fetching watchlist items:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [collectionId]);

  if (loading) return <div className="px-2 py-1 text-[10px] text-[#64748b]">جاري التحميل...</div>;

  return (
    <div className="space-y-0.5 pl-4">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelectStock({ symbol: item.symbol, name: item.name, market: item.market })}
          className="w-full text-right px-2 py-1.5 rounded-lg transition-all text-[11px] text-[#94a3b8] hover:bg-[#1e293b] hover:text-white"
        >
          <div className="font-bold">{item.symbol}</div>
          <div className="text-[9px] text-[#64748b] truncate">{item.name}</div>
        </button>
      ))}
    </div>
  );
}

export default function StockSidebar({ currentPageName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState("us");
  const [collapsed, setCollapsed] = useState(false);
  const [watchlists, setWatchlists] = useState([]);
  const [expandedWatchlist, setExpandedWatchlist] = useState(null);
  const [selectedWatchlist, setSelectedWatchlist] = useState(null);
  const [loadingWatchlists, setLoadingWatchlists] = useState(false);

  useEffect(() => {
    const fetchWatchlists = async () => {
      setLoadingWatchlists(true);
      try {
        const collections = await base44.entities.WatchlistCollection.list();
        setWatchlists(collections || []);
      } catch (err) {
        console.error("Error fetching watchlists:", err);
      } finally {
        setLoadingWatchlists(false);
      }
    };
    fetchWatchlists();
  }, []);

  const urlParams = new URLSearchParams(location.search);
  const activeSymbol = urlParams.get("symbol");

  const filtered = STOCKS[market].filter(
    (s) =>
      s.symbol.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (stock) => {
    const targetPage = SUPPORTED_PAGES.includes(currentPageName)
      ? currentPageName
      : "StockAnalysis";
    const basePath = createPageUrl(targetPage).split("?")[0];
    const newUrl = `${basePath}?symbol=${stock.symbol}&market=${market}&name=${encodeURIComponent(stock.name)}`;
    navigate(newUrl, { replace: false });
  };

  if (collapsed) {
    return (
      <div className="fixed top-0 left-0 h-full w-10 bg-[#111827]/95 border-r border-[#1e293b] z-40 flex flex-col items-center pt-4">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 hover:bg-[#1e293b] rounded-lg transition-colors text-[#94a3b8]"
          title="فتح قائمة الأسهم"
        >
          <TrendingUp className="w-4 h-4 text-[#d4a843]" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 h-full w-48 bg-[#111827]/95 backdrop-blur-xl border-r border-[#1e293b] z-40 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#d4a843]" />
          <span className="text-xs font-bold text-white">الأسهم</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 hover:bg-[#1e293b] rounded-lg text-[#94a3b8]"
        >
          <ChevronDown className="w-3 h-3 rotate-90" />
        </button>
      </div>

      {/* Market Toggle */}
      <div className="px-2 pt-2 flex gap-1">
        <button
          onClick={() => {
            setMarket("us");
            setSelectedWatchlist(null);
          }}
          className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${
            market === "us" && !selectedWatchlist
              ? "bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/30"
              : "text-[#94a3b8] hover:bg-[#1e293b]"
          }`}
        >
          🇺🇸 أمريكي
        </button>
        <button
          onClick={() => {
            setMarket("saudi");
            setSelectedWatchlist(null);
          }}
          className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${
            market === "saudi" && !selectedWatchlist
              ? "bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/30"
              : "text-[#94a3b8] hover:bg-[#1e293b]"
          }`}
        >
          🇸🇦 سعودي
        </button>
      </div>

      {/* Search */}
      <div className="px-2 pt-2">
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1e293b] border border-[#2d3748] rounded-lg pr-7 pl-2 py-1.5 text-xs text-white placeholder-[#64748b] outline-none focus:border-[#d4a843]/50"
          />
        </div>
      </div>

      {/* Stock List */}
      <div className="flex-1 overflow-y-auto mt-2 px-2 pb-4 space-y-4">
        {/* My Watchlists Section */}
        {watchlists.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-[#64748b] px-2 py-1 uppercase">قوائمي</div>
            <div className="space-y-1">
              {watchlists.map((list) => (
                <div key={list.id}>
                  <button
                    onClick={() => {
                      if (selectedWatchlist === list.id) {
                        setSelectedWatchlist(null);
                      } else {
                        setSelectedWatchlist(list.id);
                      }
                      setExpandedWatchlist(list.id);
                    }}
                    className={`w-full text-right px-2 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 ${
                      selectedWatchlist === list.id
                        ? "bg-[#d4a843]/15 border border-[#d4a843]/30 text-[#e8c76a]"
                        : "text-[#94a3b8] hover:bg-[#1e293b] hover:text-white"
                    }`}
                  >
                    <FolderOpen className="w-3 h-3 shrink-0" />
                    <span className="flex-1">{list.name}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${expandedWatchlist === list.id ? 'rotate-180' : ''}`} />
                  </button>
                  {selectedWatchlist === list.id && expandedWatchlist === list.id && (
                    <WatchlistItems collectionId={list.id} onSelectStock={handleSelect} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Popular Stocks Section */}
        {!selectedWatchlist && (
          <div>
            <div className="text-[10px] font-bold text-[#64748b] px-2 py-1 uppercase">الأسهم الشهيرة</div>
            <div className="space-y-0.5">
            {filtered.map((stock) => {
              const isActive = activeSymbol === stock.symbol;
              return (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelect(stock)}
                  className={`w-full text-right px-2 py-2 rounded-lg transition-all duration-150 flex items-center gap-2 ${
                    isActive
                      ? "bg-[#d4a843]/15 border border-[#d4a843]/30 text-[#e8c76a]"
                      : "text-[#94a3b8] hover:bg-[#1e293b] hover:text-white"
                  }`}
                >
                  <div className="flex-1 text-right">
                    <div className="text-xs font-bold">{stock.symbol}</div>
                    <div className="text-[10px] text-[#64748b] truncate">{stock.name}</div>
                  </div>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d4a843] shrink-0" />
                  )}
                </button>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}