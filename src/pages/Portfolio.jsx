import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQuote } from "@/components/api/marketDataClient";
import { Briefcase, Plus, RefreshCw, PieChart, BarChart3 } from "lucide-react";
import PortfolioStats from "@/components/portfolio/PortfolioStats";
import HoldingsTable from "@/components/portfolio/HoldingsTable";
import AssetDistribution from "@/components/portfolio/AssetDistribution";
import AddStockModal from "@/components/portfolio/AddStockModal";

export default function Portfolio() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: holdings = [], isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => base44.entities.Portfolio.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Portfolio.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      setShowAdd(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Portfolio.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Portfolio.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
  });

  // Refresh live prices for all holdings
  const refreshPrices = async () => {
    if (holdings.length === 0 || refreshing) return;
    setRefreshing(true);
    await Promise.allSettled(
      holdings.map(async (h) => {
        try {
          const q = await getQuote(h.symbol, h.market);
          if (q?.price) {
            await updateMutation.mutateAsync({
              id: h.id,
              data: {
                current_price: q.price,
                day_change: q.change || 0,
              },
            });
          }
        } catch (_) {}
      })
    );
    setRefreshing(false);
  };

  // Auto-refresh prices every 30 seconds
  useEffect(() => {
    if (holdings.length === 0) return;
    const iv = setInterval(() => {
      if (!refreshing) refreshPrices();
    }, 30000);
    return () => clearInterval(iv);
  }, [holdings, refreshing]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#d4a843]/15 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-[#d4a843]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">محفظتي</h1>
            <p className="text-sm text-[#94a3b8]">تتبع أداء استثماراتك بشكل لحظي</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshPrices}
            disabled={refreshing || holdings.length === 0}
            className="px-4 py-2.5 bg-[#1e293b] hover:bg-[#2d3a4f] disabled:opacity-40 text-white rounded-xl transition-all flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#d4a843]" : "text-[#94a3b8]"}`} />
            {refreshing ? "تحديث..." : "تحديث الأسعار"}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 bg-[#d4a843] hover:bg-[#e8c76a] text-black font-bold rounded-xl transition-all flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            إضافة سهم
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 rounded-full border-2 border-[#1e293b] border-t-[#d4a843] animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <PortfolioStats holdings={holdings} />

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Holdings */}
            <div className="lg:col-span-2 bg-[#151c2c] border border-[#1e293b] rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-[#1e293b] flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#d4a843]" />
                  الأسهم
                  <span className="text-xs font-normal text-[#64748b] bg-[#1e293b] px-2 py-0.5 rounded-full">
                    {holdings.length}
                  </span>
                </h3>
              </div>
              <HoldingsTable holdings={holdings} onDelete={(id) => deleteMutation.mutate(id)} />
            </div>

            {/* Distribution */}
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#d4a843]" />
                توزيع الأصول
              </h3>
              <AssetDistribution holdings={holdings} />
            </div>
          </div>

          {/* Performance Summary per stock */}
          {holdings.length > 0 && (
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4">ملخص الأداء الفردي</h3>
              <div className="space-y-3">
                {[...holdings]
                  .map(h => {
                    const value = h.shares * (h.current_price || h.avg_cost);
                    const cost = h.shares * h.avg_cost;
                    const pnl = value - cost;
                    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                    return { ...h, pnl, pnlPct };
                  })
                  .sort((a, b) => b.pnlPct - a.pnlPct)
                  .map(h => (
                    <div key={h.id} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#e8c76a] w-20 shrink-0">{h.symbol}</span>
                      <div className="flex-1 h-5 bg-[#1e293b] rounded-full overflow-hidden relative">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.abs(h.pnlPct) * 3)}%`,
                            backgroundColor: h.pnl >= 0 ? "#10b981" : "#ef4444",
                          }}
                        />
                        <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-white">
                          {h.pnl >= 0 ? "+" : ""}{h.pnl.toFixed(2)} ({h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showAdd && (
        <AddStockModal
          onClose={() => setShowAdd(false)}
          onAdd={(data) => createMutation.mutate(data)}
          loading={createMutation.isPending}
        />
      )}
    </div>
  );
}