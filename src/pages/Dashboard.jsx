import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getTopMovers, getForex, getCrypto, getBatchQuotes } from "@/components/api/marketDataClient";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MarketOverviewBar from "@/components/ui/MarketOverviewBar";
import NextSessionPredictions from "@/components/dashboard/NextSessionPredictions";
import StockCard from "@/components/ui/StockCard";
import MiniChart from "@/components/ui/MiniChart";
import DashboardCustomizer from "@/components/dashboard/DashboardCustomizer";
import { useDashboardLayout } from "@/components/dashboard/useDashboardLayout";
import {
  TrendingUp, TrendingDown, BarChart3, Activity, Flame, Brain, Sparkles, Target,
  CalendarDays, Globe2, DollarSign, Bitcoin
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

// Fallback static data (used only when API is unavailable)
const fallbackGainers = {
  saudi: [
    { symbol: "2222", name: "أرامكو", price: 32.50, change: 5.23, market: "saudi" },
    { symbol: "1120", name: "الراجحي", price: 95.40, change: 3.89, market: "saudi" },
    { symbol: "2010", name: "سابك", price: 87.20, change: 2.75, market: "saudi" },
    { symbol: "1180", name: "الأهلي", price: 44.10, change: 2.10, market: "saudi" },
  ],
  us: [
    { symbol: "NVDA", name: "NVIDIA", price: 875.30, change: 4.12, market: "us" },
    { symbol: "TSLA", name: "Tesla", price: 245.60, change: 3.45, market: "us" },
    { symbol: "AAPL", name: "Apple", price: 198.50, change: 2.80, market: "us" },
    { symbol: "MSFT", name: "Microsoft", price: 415.20, change: 1.95, market: "us" },
  ],
};
const fallbackLosers = {
  saudi: [
    { symbol: "2350", name: "كيان", price: 12.30, change: -4.56, market: "saudi" },
    { symbol: "2050", name: "صافولا", price: 28.90, change: -1.89, market: "saudi" },
    { symbol: "4030", name: "الدريس", price: 18.20, change: -1.50, market: "saudi" },
  ],
  us: [
    { symbol: "META", name: "Meta", price: 485.20, change: -2.34, market: "us" },
    { symbol: "NFLX", name: "Netflix", price: 612.40, change: -1.23, market: "us" },
    { symbol: "AMZN", name: "Amazon", price: 185.30, change: -0.98, market: "us" },
  ],
};

const aiInsightsByMarket = {
  saudi: "قطاع البنوك يظهر زخماً إيجابياً قوياً مع ارتفاع أحجام التداول. فرص واعدة في أسهم التقنية السعودية.",
  us: "قطاع التقنية يقود المؤشرات مع قوة أداء أسهم الذكاء الاصطناعي. فرص في القطاع الصحي وأسهم القيمة.",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { layout, market, loaded, toggleWidget, moveWidget, updateMarket } = useDashboardLayout();
  const [liveMovers, setLiveMovers] = useState(null);
  const [forex, setForex] = useState(null);
  const [crypto, setCrypto] = useState(null);
  const [liveStats, setLiveStats] = useState(null);

  // Fetch live data based on selected market
  useEffect(() => {
    const fetchAll = () => {
      getTopMovers(market).then(setLiveMovers).catch(() => {});
      getForex("USD", "SAR").then(setForex).catch(() => {});
      getCrypto("BTC", "USD").then(setCrypto).catch(() => {});
      getTopMovers(market).then(data => {
        if (data?.gainers && data?.losers) {
          const allStocks = [...(data.gainers || []), ...(data.losers || [])];
          const up = allStocks.filter(s => s.change > 0).length;
          const down = allStocks.filter(s => s.change < 0).length;
          setLiveStats({ up, down, total: allStocks.length });
        }
      }).catch(() => {});
    };
    fetchAll();
    const iv = setInterval(fetchAll, 3000);
    return () => clearInterval(iv);
  }, [market]);

  const gainers = liveMovers?.gainers?.length
    ? liveMovers.gainers.slice(0, 4)
    : fallbackGainers[market];
  const losers = liveMovers?.losers?.length
    ? liveMovers.losers.slice(0, 4)
    : fallbackLosers[market];
  const isLive = !!liveMovers?.gainers?.length;

  // Compute sentiment from real movers data
  const marketSentimentData = (() => {
    if (!liveMovers?.gainers) {
      return [
        { name: "إيجابي", value: 45, color: "#10b981" },
        { name: "محايد", value: 30, color: "#d4a843" },
        { name: "سلبي", value: 25, color: "#ef4444" },
      ];
    }
    const all = [...(liveMovers.gainers || []), ...(liveMovers.losers || [])];
    const up = all.filter(s => s.change > 0).length;
    const down = all.filter(s => s.change < 0).length;
    const neutral = all.length - up - down;
    const total = all.length || 1;
    return [
      { name: "إيجابي", value: Math.round((up / total) * 100), color: "#10b981" },
      { name: "محايد", value: Math.round((neutral / total) * 100), color: "#d4a843" },
      { name: "سلبي", value: Math.round((down / total) * 100), color: "#ef4444" },
    ];
  })();

  // Compute sector performance from movers (group by name pattern)
  const sectorPerformance = (() => {
    if (!liveMovers?.gainers) {
      return market === 'saudi'
        ? [{ sector: "البنوك", change: 2.3 }, { sector: "الطاقة", change: -0.5 }, { sector: "الاتصالات", change: 1.8 }]
        : [{ sector: "Technology", change: 1.8 }, { sector: "Financials", change: 2.5 }, { sector: "Healthcare", change: -0.7 }];
    }
    const all = [...(liveMovers.gainers || []), ...(liveMovers.losers || [])];
    return all.slice(0, 8).map(s => ({
      sector: s.name || s.symbol,
      change: s.change || 0,
    }));
  })();

  // Volume chart: use movers data as proxy
  const volumeData = (() => {
    const base = gainers?.concat(losers || []) || [];
    return base.slice(0, 10).map(s => ({
      month: s.name || s.symbol,
      [market]: Math.abs(s.change || 0) * 100,
    }));
  })();

  const handleStockClick = (stock) => {
    navigate(createPageUrl("StockAnalysis") + `?symbol=${stock.symbol}&market=${stock.market}`);
  };

  const isVisible = (id) => layout.find(w => w.id === id)?.enabled;

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[#d4a843] border-t-transparent animate-spin" />
      </div>
    );
  }

  // Render individual widgets
  const widgetMap = {
    market_overview: (
      <div key="market_overview" className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-4">
        <MarketOverviewBar />
      </div>
    ),

    live_rates: (forex || crypto) ? (
      <div key="live_rates" className="bg-[#0d1420] border border-[#1a2540] rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-6 text-sm">
        <span className="text-xs font-bold text-[#d4a843] flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          أسعار مباشرة
        </span>
        {forex && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-[#475569]">USD/SAR</p>
              <p className="text-sm font-black text-white">{forex.rate?.toFixed(4)}</p>
            </div>
          </div>
        )}
        {crypto && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center">
              <Bitcoin className="w-3.5 h-3.5 text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-[10px] text-[#475569]">BTC/USD</p>
              <p className="text-sm font-black text-white">${(crypto.price ?? crypto.rate)?.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
    ) : null,

    quick_stats: (
      <div key="quick_stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "أسهم صاعدة", value: liveStats ? String(liveStats.up) : "—", sub: liveStats ? `من ${liveStats.total} سهم` : "جاري التحميل", icon: TrendingUp, color: "#10b981", accent: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.15)" },
          { label: "أسهم هابطة", value: liveStats ? String(liveStats.down) : "—", sub: liveStats ? `من ${liveStats.total} سهم` : "جاري التحميل", icon: TrendingDown, color: "#ef4444", accent: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.15)" },
          { label: "الأكثر ارتفاعاً", value: gainers?.[0]?.symbol || "—", sub: gainers?.[0]?.name || "", icon: Activity, color: "#d4a843", accent: "rgba(212,168,67,0.08)", border: "rgba(212,168,67,0.15)" },
          { label: "الأكثر انخفاضاً", value: losers?.[0]?.symbol || "—", sub: losers?.[0]?.name || "", icon: BarChart3, color: "#3b82f6", accent: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02]"
            style={{ background: `linear-gradient(135deg, ${stat.accent} 0%, #0d1420 100%)`, border: `1px solid ${stat.border}` }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: stat.accent, border: `1px solid ${stat.border}` }}>
                <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
              </div>
              <MiniChart data={null} color={stat.color} height={28} />
            </div>
            <p className="text-3xl font-black text-white tracking-tight">{stat.value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: stat.color }}>{stat.sub}</p>
            <p className="text-[11px] text-[#475569] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    ),

    ai_insights: (
      <div key="ai_insights" className="relative overflow-hidden bg-gradient-to-l from-[#d4a843]/20 via-[#0d1420] to-[#0d1420] border border-[#d4a843]/25 rounded-2xl p-6">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#d4a843]/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="relative flex items-center gap-4 flex-wrap">
          <div className="p-3 rounded-xl bg-[#d4a843]/20 shrink-0">
            <Brain className="w-6 h-6 text-[#d4a843]" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              رؤى الذكاء الاصطناعي <Sparkles className="w-4 h-4 text-[#d4a843]" />
            </h3>
            <p className="text-sm text-[#94a3b8] mt-1">
              {aiInsightsByMarket[market]}
            </p>
          </div>
          <button
            onClick={() => navigate(createPageUrl("OpportunityRadar"))}
            className="px-5 py-2.5 bg-[#d4a843] hover:bg-[#e8c76a] text-black font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shrink-0"
          >
            <Target className="w-4 h-4" /> اكتشف الفرص
          </button>
        </div>
      </div>
    ),

    volume_chart: (
      <div key="volume_chart" className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">حجم التداول الشهري</h2>
          <div className="flex gap-2 bg-[#1e293b] rounded-xl p-1">
            {["saudi", "us"].map((tab) => (
              <button
                key={tab}
                onClick={() => updateMarket(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${market === tab ? 'bg-[#d4a843] text-black' : 'text-[#94a3b8] hover:text-white'}`}
              >
                {tab === "saudi" ? "السعودي" : "الأمريكي"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={volumeData}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4a843" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#d4a843" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
              <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0d1420', border: '1px solid #1a2540', borderRadius: '12px', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} itemStyle={{ color: '#d4a843' }} />
              <Area type="monotone" dataKey={market} stroke="#d4a843" strokeWidth={2} fill="url(#colorVolume)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    ),

    sentiment: (
      <div key="sentiment" className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">مشاعر السوق</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={marketSentimentData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" stroke="none">
                {marketSentimentData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0d1420', border: '1px solid #1a2540', borderRadius: '12px', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          {marketSentimentData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-[#94a3b8]">{item.name} {item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    ),

    top_gainers: (
      <div key="top_gainers" className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-emerald-400" /> الأكثر ارتفاعاً
          {isLive && <span className="text-xs font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center gap-1 mr-auto"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />مباشر</span>}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {gainers.map((stock) => <StockCard key={stock.symbol} {...stock} onClick={() => handleStockClick(stock)} />)}
        </div>
      </div>
    ),

    top_losers: (
      <div key="top_losers" className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-400" /> الأكثر انخفاضاً
          {isLive && <span className="text-xs font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center gap-1 mr-auto"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />مباشر</span>}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {losers.map((stock) => <StockCard key={stock.symbol} {...stock} onClick={() => handleStockClick(stock)} />)}
        </div>
      </div>
    ),

    next_session: (
      <div key="next_session">
        <NextSessionPredictions />
      </div>
    ),

    sector_performance: (
      <div key="sector_performance" className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">أداء القطاعات</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectorPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="sector" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ backgroundColor: '#0d1420', border: '1px solid #1a2540', borderRadius: '12px', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
              <Bar dataKey="change" radius={[0, 6, 6, 0]}>
                {sectorPerformance.map((entry, index) => <Cell key={index} fill={entry.change >= 0 ? '#10b981' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    ),
  };

  // Group volume+sentiment side by side
  const renderWidget = (id) => {
    if (!isVisible(id)) return null;
    return widgetMap[id] || null;
  };

  // Special grouped layout for volume_chart + sentiment
  const volumeVisible = isVisible("volume_chart");
  const sentimentVisible = isVisible("sentiment");
  const volumeOrder = layout.find(w => w.id === "volume_chart")?.order ?? 99;
  const sentimentOrder = layout.find(w => w.id === "sentiment")?.order ?? 99;

  // Build ordered list, merging volume+sentiment into one row
  const rendered = [];
  const usedGroup = { volume_chart: false, sentiment: false };

  for (const w of layout) {
    if (!w.enabled) continue;
    if (w.id === "volume_chart" || w.id === "sentiment") {
      if (!usedGroup.volume_chart && !usedGroup.sentiment) {
        // insert the group at the position of whichever comes first
        rendered.push(
          <div key="vol_sentiment" className="grid lg:grid-cols-3 gap-6">
            {volumeVisible && <div className="lg:col-span-2">{widgetMap["volume_chart"]}</div>}
            {sentimentVisible && <div>{widgetMap["sentiment"]}</div>}
          </div>
        );
        usedGroup.volume_chart = true;
        usedGroup.sentiment = true;
      }
      continue;
    }
    // Gainers + losers side by side
    if (w.id === "top_gainers" || w.id === "top_losers") {
      if (!usedGroup[w.id]) {
        const gainersVisible = isVisible("top_gainers");
        const losersVisible = isVisible("top_losers");
        if (!usedGroup.top_gainers_row) {
          rendered.push(
            <div key="movers_row" className="grid md:grid-cols-2 gap-6">
              {gainersVisible && widgetMap["top_gainers"]}
              {losersVisible && widgetMap["top_losers"]}
            </div>
          );
          usedGroup.top_gainers_row = true;
          usedGroup["top_gainers"] = true;
          usedGroup["top_losers"] = true;
        }
      }
      continue;
    }
    const node = widgetMap[w.id];
    if (node) rendered.push(node);
  }

  const today = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      {/* ── Professional Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            لوحة التحكم
          </h1>
          <p className="text-sm text-[#475569] mt-1 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {today}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Market Selector */}
          <div className="flex gap-1 bg-[#0d1420] border border-[#1a2540] rounded-xl p-1">
            {[
              { value: "saudi", label: "🇸🇦 السعودي" },
              { value: "us", label: "🇺🇸 الأمريكي" },
            ].map(m => (
              <button
                key={m.value}
                onClick={() => updateMarket(m.value)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  market === m.value
                    ? "bg-gradient-to-r from-[#d4a843] to-[#c9993a] text-black shadow-md shadow-[#d4a843]/20"
                    : "text-[#475569] hover:text-[#94a3b8]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <DashboardCustomizer
            layout={layout}
            market={market}
            onToggle={toggleWidget}
            onMove={moveWidget}
            onMarketChange={updateMarket}
          />
        </div>
      </div>

      {rendered}
    </div>
  );
}