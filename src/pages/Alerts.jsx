import React, { useState } from "react";
import { entities } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SearchStock from "@/components/ui/SearchStock";
import {
  Bell, Plus, Trash2, X, BellRing, BellOff, TrendingUp, TrendingDown,
  ArrowUpCircle, ArrowDownCircle
} from "lucide-react";

const conditionLabels = {
  above: "عند ارتفاع السعر فوق",
  below: "عند انخفاض السعر تحت",
  change_up: "عند ارتفاع بنسبة",
  change_down: "عند انخفاض بنسبة",
};

const conditionIcons = {
  above: ArrowUpCircle,
  below: ArrowDownCircle,
  change_up: TrendingUp,
  change_down: TrendingDown,
};

export default function Alerts() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: "", name: "", market: "saudi", condition: "above", price: "" });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => entities.Alert.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => entities.Alert.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alerts'] }); setShowAdd(false); setForm({ symbol: "", name: "", market: "saudi", condition: "above", price: "" }); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => entities.Alert.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => entities.Alert.update(id, { is_active: !is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const handleSelect = (stock) => {
    setForm({ ...form, symbol: stock.symbol, name: stock.name, market: stock.market });
  };

  const activeAlerts = alerts.filter(a => a.is_active);
  const inactiveAlerts = alerts.filter(a => !a.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Bell className="w-7 h-7 text-[#d4a843]" />
          <div>
            <h1 className="text-2xl font-bold text-white">التنبيهات</h1>
            <p className="text-sm text-[#94a3b8]">تنبيهات أسعار الأسهم</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-5 py-2.5 bg-[#d4a843] hover:bg-[#e8c76a] text-black font-semibold rounded-xl transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          إضافة تنبيه
        </button>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#94a3b8] mb-3 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-emerald-400" />
            تنبيهات فعالة ({activeAlerts.length})
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAlerts.map((alert) => {
              const Icon = conditionIcons[alert.condition] || Bell;
              return (
                <div key={alert.id} className="bg-[#151c2c] border border-emerald-500/20 rounded-2xl p-5 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-500/10">
                        <Icon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <span className="text-lg font-bold text-[#e8c76a]">{alert.symbol}</span>
                        <p className="text-xs text-[#94a3b8]">{alert.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleMutation.mutate({ id: alert.id, is_active: alert.is_active })}
                        className="p-2 hover:bg-yellow-500/10 rounded-lg transition-colors"
                      >
                        <BellOff className="w-4 h-4 text-yellow-400" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(alert.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#1e293b] rounded-xl p-3">
                    <span className="text-xs text-[#64748b]">{conditionLabels[alert.condition]}</span>
                    <p className="text-lg font-bold text-white mt-1">{alert.price}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inactive Alerts */}
      {inactiveAlerts.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#94a3b8] mb-3 flex items-center gap-2">
            <BellOff className="w-4 h-4 text-[#64748b]" />
            تنبيهات متوقفة ({inactiveAlerts.length})
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactiveAlerts.map((alert) => {
              const Icon = conditionIcons[alert.condition] || Bell;
              return (
                <div key={alert.id} className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5 opacity-60 transition-all hover:opacity-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-[#1e293b]">
                        <Icon className="w-4 h-4 text-[#64748b]" />
                      </div>
                      <div>
                        <span className="text-lg font-bold text-[#94a3b8]">{alert.symbol}</span>
                        <p className="text-xs text-[#64748b]">{alert.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleMutation.mutate({ id: alert.id, is_active: alert.is_active })}
                        className="p-2 hover:bg-emerald-500/10 rounded-lg transition-colors"
                      >
                        <BellRing className="w-4 h-4 text-emerald-400" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(alert.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#1e293b] rounded-xl p-3">
                    <span className="text-xs text-[#64748b]">{conditionLabels[alert.condition]}</span>
                    <p className="text-lg font-bold text-[#94a3b8] mt-1">{alert.price}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 rounded-3xl bg-[#d4a843]/10 flex items-center justify-center mb-6">
            <Bell className="w-12 h-12 text-[#d4a843]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">لا توجد تنبيهات</h2>
          <p className="text-[#94a3b8] max-w-md">أنشئ تنبيهات لمتابعة أسعار الأسهم التي تهمك</p>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">إضافة تنبيه جديد</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-[#1e293b] rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <SearchStock onSelect={handleSelect} />
              {form.symbol && (
                <div className="bg-[#1e293b] rounded-xl p-3 flex items-center gap-2">
                  <span className="text-sm font-bold text-[#e8c76a]">{form.symbol}</span>
                  <span className="text-xs text-[#94a3b8]">{form.name}</span>
                </div>
              )}
              <div>
                <label className="text-xs text-[#94a3b8] mb-1 block">نوع التنبيه</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(conditionLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setForm({ ...form, condition: key })}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                        form.condition === key
                          ? 'bg-[#d4a843]/20 border-[#d4a843]/40 text-[#e8c76a]'
                          : 'bg-[#1e293b] border-[#2d3a4f] text-[#94a3b8] hover:border-[#d4a843]/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#94a3b8] mb-1 block">
                  {form.condition.includes("change") ? "النسبة %" : "السعر"}
                </label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-[#1e293b] border border-[#2d3a4f] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/50"
                  placeholder={form.condition.includes("change") ? "5.0" : "50.00"}
                />
              </div>
              <button
                onClick={() => {
                  if (form.symbol && form.price) {
                    createMutation.mutate({
                      symbol: form.symbol,
                      name: form.name,
                      market: form.market,
                      condition: form.condition,
                      price: parseFloat(form.price),
                      is_active: true,
                      triggered: false,
                    });
                  }
                }}
                disabled={!form.symbol || !form.price}
                className="w-full py-3 bg-[#d4a843] hover:bg-[#e8c76a] disabled:opacity-40 text-black font-semibold rounded-xl transition-all"
              >
                إنشاء التنبيه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}