import React, { useState } from "react";
import { entities } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SearchStock from "@/components/ui/SearchStock";
import WatchlistTabs from "@/components/watchlist/WatchlistTabs";
import { Star, Plus, Trash2, X, Brain, Eye } from "lucide-react";

export default function WatchlistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [activeCollectionId, setActiveCollectionId] = useState(null);
  const [form, setForm] = useState({ symbol: "", name: "", market: "saudi", target_price: "", notes: "" });

  const { data: collections = [] } = useQuery({
    queryKey: ['watchlistCollections'],
    queryFn: () => entities.WatchlistCollection.list(),
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['watchlistItems', activeCollectionId],
    queryFn: () => activeCollectionId 
      ? entities.WatchlistItem.filter({ watchlist_id: activeCollectionId })
      : Promise.resolve([]),
    enabled: !!activeCollectionId,
  });

  const createItemMutation = useMutation({
    mutationFn: (data) => entities.WatchlistItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlistItems', activeCollectionId] });
      setShowAdd(false);
      setForm({ symbol: "", name: "", market: "saudi", target_price: "", notes: "" });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => entities.WatchlistItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlistItems', activeCollectionId] }),
  });

  const handleSelect = (stock) => {
    setForm({ ...form, symbol: stock.symbol, name: stock.name, market: stock.market });
  };

  const activeCollection = collections.find(c => c.id === activeCollectionId);

  React.useEffect(() => {
    if (collections.length > 0 && !activeCollectionId) {
      setActiveCollectionId(collections[0].id);
    }
  }, [collections]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Star className="w-7 h-7 text-[#d4a843]" />
          <div>
            <h1 className="text-2xl font-bold text-white">قوائم المراقبة</h1>
            <p className="text-sm text-[#94a3b8]">أدِر قوائم المراقبة الخاصة بك</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          disabled={!activeCollectionId}
          className="px-5 py-2.5 bg-[#d4a843] hover:bg-[#e8c76a] disabled:opacity-40 text-black font-semibold rounded-xl transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          إضافة سهم
        </button>
      </div>

      {/* Tabs - Always show to allow creating first list */}
      {collections.length > 0 && (
        <WatchlistTabs
          collections={collections}
          activeCollectionId={activeCollectionId}
          onSelectCollection={setActiveCollectionId}
        />
      )}

      {/* Content */}
      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div className="w-24 h-24 rounded-3xl bg-[#d4a843]/10 flex items-center justify-center">
            <Star className="w-12 h-12 text-[#d4a843]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">لا توجد قوائم مراقبة</h2>
            <p className="text-[#94a3b8] max-w-md mb-6">أنشئ قائمة مراقبة جديدة للبدء في تتبع الأسهم</p>
            <WatchlistTabs
              collections={[]}
              activeCollectionId={null}
              onSelectCollection={setActiveCollectionId}
            />
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group bg-[#151c2c] border border-[#1e293b] hover:border-[#d4a843]/30 rounded-2xl p-5 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-[#e8c76a]">{item.symbol}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e293b] text-[#64748b]">
                      {item.market === "saudi" ? "تداول" : "US"}
                    </span>
                  </div>
                  <p className="text-sm text-[#94a3b8]">{item.name}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => navigate(createPageUrl("StockAnalysis") + `?symbol=${item.symbol}&market=${item.market}`)}
                    className="p-2 hover:bg-[#d4a843]/10 rounded-lg transition-colors"
                  >
                    <Brain className="w-4 h-4 text-[#d4a843]" />
                  </button>
                  <button
                    onClick={() => deleteItemMutation.mutate(item.id)}
                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              {item.target_price && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-[#64748b]">السعر المستهدف:</span>
                  <span className="text-sm font-bold text-emerald-400">{item.target_price}</span>
                </div>
              )}

              {item.notes && (
                <p className="text-xs text-[#64748b] bg-[#1e293b] rounded-lg p-3 mt-2">{item.notes}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 rounded-3xl bg-[#d4a843]/10 flex items-center justify-center mb-6">
            <Eye className="w-12 h-12 text-[#d4a843]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">القائمة فارغة</h2>
          <p className="text-[#94a3b8] max-w-md">أضف أسهماً لمراقبتها في {activeCollection?.name}</p>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">إضافة سهم إلى {activeCollection?.name}</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-[#1e293b] rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#94a3b8] mb-2 block font-semibold">اختر السوق</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setForm({ ...form, market: "saudi" })}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${
                      form.market === "saudi"
                        ? "bg-[#d4a843] text-black"
                        : "bg-[#1e293b] text-[#94a3b8] hover:bg-[#2d3a4f]"
                    }`}
                  >
                    🇸🇦 تداول السعودية
                  </button>
                  <button
                    onClick={() => setForm({ ...form, market: "us" })}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${
                      form.market === "us"
                        ? "bg-[#d4a843] text-black"
                        : "bg-[#1e293b] text-[#94a3b8] hover:bg-[#2d3a4f]"
                    }`}
                  >
                    🇺🇸 السوق الأمريكي
                  </button>
                </div>
              </div>
              <SearchStock onSelect={handleSelect} market={form.market} />
              {form.symbol && (
                <div className="bg-[#1e293b] rounded-xl p-3 flex items-center gap-2">
                  <span className="text-sm font-bold text-[#e8c76a]">{form.symbol}</span>
                  <span className="text-xs text-[#94a3b8]">{form.name}</span>
                </div>
              )}
              <div>
                <label className="text-xs text-[#94a3b8] mb-1 block">السعر المستهدف (اختياري)</label>
                <input
                  type="number"
                  value={form.target_price}
                  onChange={(e) => setForm({ ...form, target_price: e.target.value })}
                  className="w-full bg-[#1e293b] border border-[#2d3a4f] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/50"
                  placeholder="50.00"
                />
              </div>
              <div>
                <label className="text-xs text-[#94a3b8] mb-1 block">ملاحظات (اختياري)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-[#1e293b] border border-[#2d3a4f] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/50 h-20 resize-none"
                  placeholder="أسباب المراقبة..."
                />
              </div>
              <button
                onClick={() => {
                  if (form.symbol && activeCollectionId) {
                    createItemMutation.mutate({
                      ...form,
                      watchlist_id: activeCollectionId,
                      target_price: form.target_price ? parseFloat(form.target_price) : undefined,
                    });
                  }
                }}
                disabled={!form.symbol}
                className="w-full py-3 bg-[#d4a843] hover:bg-[#e8c76a] disabled:opacity-40 text-black font-semibold rounded-xl transition-all"
              >
                إضافة للمراقبة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}