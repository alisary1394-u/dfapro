import React, { useState, useEffect, useCallback } from "react";
import { entities } from "@/api/entities";
import { getQuote } from "@/components/api/marketDataClient";
import { getPollInterval } from "@/lib/brokerState";
import AddTradeModal from "@/components/virtualportfolio/AddTradeModal";
import TradeRow from "@/components/virtualportfolio/TradeRow";
import {
  Wallet, Plus, TrendingUp, TrendingDown, DollarSign, BarChart3,
  RefreshCw, Loader2, Activity, PieChart, Filter
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend
} from "recharts";

const COLORS = ["#d4a843", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4", "#ec4899"];

function StatCard({ icon: IconComp, label, value, sub, color }) {
  const Icon = IconComp;
  return (
    <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-xl" style={{ backgroundColor: color + "20" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs text-[#64748b]">{label}</span>
      </div>
      <p className="text-2xl font-black" style={{ color: color !== "#d4a843" && color !== "#3b82f6" ? color : "#f1f5f9" }}>{value}</p>
      {sub && <p className="text-xs text-[#64748b] mt-1">{sub}</p>}
    </div>
  );
}

export default function VirtualPortfolio() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("open");
  const [portfolioHistory, setPortfolioHistory] = useState([]);

  const fetchTrades = useCallback(async () => {
    const all = await entities.VirtualTrade.list("-created_date", 100);
    setTrades(all);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTrades(); }, []);

  // Update prices from market
  const refreshPrices = async () => {
    setRefreshing(true);
    const openTrades = trades.filter(t => t.status === "open");
    const updates = await Promise.all(
      openTrades.map(async (trade) => {
        const quote = await getQuote(trade.symbol, trade.market).catch(() => null);
        if (quote?.price) {
          await entities.VirtualTrade.update(trade.id, { current_price: quote.price });
          return { ...trade, current_price: quote.price };
        }
        return trade;
      })
    );
    await fetchTrades();
    setRefreshing(false);
  };

  // Build portfolio history from trades (simulated daily snapshots)
  useEffect(() => {
    if (trades.length === 0) return;
    const days = 14;
    const history = [];
    const now = Date.now();
    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * 86400000);
      const label = date.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
      let value = 10000; // starting capital
      trades.forEach(t => {
        if (new Date(t.created_date) <= date) {
          const price = t.current_price || t.entry_price;
          const variation = 1 + (Math.sin(i + t.entry_price) * 0.02);
          const dailyPrice = price * variation;
          const pnl = t.trade_type === "buy"
            ? (dailyPrice - t.entry_price) * t.shares
            : (t.entry_price - dailyPrice) * t.shares;
          value += pnl;
        }
      });
      history.push({ date: label, value: Math.max(0, Math.round(value)) });
    }
    setPortfolioHistory(history);
  }, [trades]);

  const openTrades = trades.filter(t => t.status === "open");
  const closedTrades = trades.filter(t => t.status === "closed");
  const displayedTrades = filter === "open" ? openTrades : filter === "closed" ? closedTrades : trades;

  // Stats
  const totalCost = openTrades.reduce((s, t) => s + t.shares * t.entry_price, 0);
  const totalValue = openTrades.reduce((s, t) => s + t.shares * (t.current_price || t.entry_price), 0);
  const unrealizedPnl = openTrades.reduce((s, t) => {
    const cp = t.current_price || t.entry_price;
    return s + (t.trade_type === "buy" ? (cp - t.entry_price) : (t.entry_price - cp)) * t.shares;
  }, 0);
  const realizedPnl = closedTrades.reduce((s, t) => {
    const cp = t.close_price || t.current_price || t.entry_price;
    return s + (t.trade_type === "buy" ? (cp - t.entry_price) : (t.entry_price - cp)) * t.shares;
  }, 0);
  const unrealizedPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

  // Pie chart data by symbol
  const symbolMap = {};
  openTrades.forEach(t => {
    const v = t.shares * (t.current_price || t.entry_price);
    symbolMap[t.symbol] = (symbolMap[t.symbol] || 0) + v;
  });
  const pieData = Object.entries(symbolMap).map(([name, value]) => ({ name, value: Math.round(value) }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-14 h-14 rounded-full border-2 border-[#d4a843] border-t-transparent animate-spin" />
        <p className="text-[#94a3b8]">جاري تحميل المحفظة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showModal && <AddTradeModal onClose={() => setShowModal(false)} onSave={fetchTrades} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4a843] to-[#b8922f] flex items-center justify-center shadow-lg">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">المحفظة الافتراضية</h1>
            <p className="text-xs text-[#94a3b8]">تداول تجريبي بدون مخاطرة حقيقية</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={refreshPrices} disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#151c2c] border border-[#1e293b] text-[#94a3b8] rounded-xl text-sm font-bold hover:text-white transition-all disabled:opacity-50">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            تحديث الأسعار
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#d4a843] hover:bg-[#e8c76a] text-black rounded-xl text-sm font-bold transition-all">
            <Plus className="w-4 h-4" /> صفقة جديدة
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="القيمة السوقية" value={`$${totalValue.toLocaleString("en", { minimumFractionDigits: 0 })}`} sub={`تكلفة: $${totalCost.toLocaleString("en", { minimumFractionDigits: 0 })}`} color="#d4a843" />
        <StatCard
          icon={unrealizedPnl >= 0 ? TrendingUp : TrendingDown}
          label="أرباح/خسائر غير محققة"
          value={`${unrealizedPnl >= 0 ? "+" : ""}$${unrealizedPnl.toFixed(0)}`}
          sub={`${unrealizedPct >= 0 ? "+" : ""}${unrealizedPct.toFixed(2)}%`}
          color={unrealizedPnl >= 0 ? "#10b981" : "#ef4444"}
        />
        <StatCard
          icon={realizedPnl >= 0 ? TrendingUp : TrendingDown}
          label="أرباح/خسائر محققة"
          value={`${realizedPnl >= 0 ? "+" : ""}$${realizedPnl.toFixed(0)}`}
          sub={`${closedTrades.length} صفقة مغلقة`}
          color={realizedPnl >= 0 ? "#10b981" : "#ef4444"}
        />
        <StatCard icon={Activity} label="الصفقات المفتوحة" value={openTrades.length} sub={`من أصل ${trades.length} صفقة`} color="#3b82f6" />
      </div>

      {/* Charts Row */}
      {trades.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Portfolio value over time */}
          <div className="lg:col-span-2 bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#d4a843]" />
              <h3 className="text-sm font-bold text-white">تطور قيمة المحفظة (14 يوم)</h3>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={portfolioHistory}>
                  <defs>
                    <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d4a843" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d4a843" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={55}
                    tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    formatter={v => [`$${v.toLocaleString()}`, "قيمة المحفظة"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#d4a843" strokeWidth={2.5}
                    fill="url(#portfolioGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Allocation pie */}
          {pieData.length > 0 && (
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-[#3b82f6]" />
                <h3 className="text-sm font-bold text-white">توزيع المحفظة</h3>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" nameKey="name" paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f1623', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      formatter={v => [`$${v.toLocaleString()}`, ""]}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trades List */}
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#d4a843]" /> الصفقات
          </h3>
          <div className="flex gap-1">
            {[{ key: "open", label: `مفتوحة (${openTrades.length})` }, { key: "closed", label: `مغلقة (${closedTrades.length})` }, { key: "all", label: "الكل" }].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === f.key ? "bg-[#d4a843] text-black" : "bg-[#0f1623] border border-[#1e293b] text-[#94a3b8] hover:text-white"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {displayedTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#0f1623] border border-[#1e293b] flex items-center justify-center">
              <Wallet className="w-8 h-8 text-[#d4a843]" />
            </div>
            <p className="text-white font-bold">لا توجد صفقات بعد</p>
            <p className="text-xs text-[#64748b]">ابدأ بإضافة صفقتك الأولى</p>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#d4a843] text-black rounded-xl text-sm font-bold hover:bg-[#e8c76a] transition-all">
              <Plus className="w-4 h-4" /> إضافة صفقة
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedTrades.map(trade => (
              <TradeRow key={trade.id} trade={trade} onUpdate={fetchTrades} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}