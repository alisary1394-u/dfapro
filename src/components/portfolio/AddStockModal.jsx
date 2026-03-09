import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import SearchStock from "@/components/ui/SearchStock";

const SECTORS = ["البنوك", "الطاقة", "الاتصالات", "التجزئة", "الصحة", "العقارات", "الصناعة", "المواد الأساسية", "التقنية", "أخرى"];

export default function AddStockModal({ onClose, onAdd, loading }) {
  const [form, setForm] = useState({ symbol: "", name: "", market: "saudi", shares: "", avg_cost: "", sector: "", purchase_date: "" });

  const valid = form.symbol && parseFloat(form.shares) > 0 && parseFloat(form.avg_cost) > 0;

  const handleSubmit = () => {
    if (!valid) return;
    onAdd({
      ...form,
      shares: parseFloat(form.shares),
      avg_cost: parseFloat(form.avg_cost),
      current_price: parseFloat(form.avg_cost),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">إضافة سهم للمحفظة</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#1e293b] rounded-xl transition-colors">
            <X className="w-4 h-4 text-[#94a3b8]" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Stock Search */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1.5 block">ابحث عن السهم</label>
            <SearchStock onSelect={(s) => setForm({ ...form, symbol: s.symbol, name: s.name, market: s.market })} />
          </div>

          {/* Selected Stock Badge */}
          {form.symbol && (
            <div className="flex items-center gap-3 bg-[#d4a843]/10 border border-[#d4a843]/30 rounded-xl p-3">
              <div>
                <span className="text-sm font-bold text-[#e8c76a]">{form.symbol}</span>
                <span className="text-xs text-[#94a3b8] mr-2">{form.name}</span>
              </div>
              <span className="mr-auto text-xs px-2 py-0.5 rounded bg-[#1e293b] text-[#64748b]">
                {form.market === "saudi" ? "SA" : "US"}
              </span>
            </div>
          )}

          {/* Shares & Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#94a3b8] mb-1.5 block">عدد الأسهم *</label>
              <input type="number" min="0" value={form.shares}
                onChange={e => setForm({ ...form, shares: e.target.value })}
                className="w-full bg-[#1e293b] border border-[#2d3a4f] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/60 placeholder-[#3d4f63]"
                placeholder="100" />
            </div>
            <div>
              <label className="text-xs text-[#94a3b8] mb-1.5 block">متوسط التكلفة *</label>
              <input type="number" min="0" step="0.01" value={form.avg_cost}
                onChange={e => setForm({ ...form, avg_cost: e.target.value })}
                className="w-full bg-[#1e293b] border border-[#2d3a4f] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/60 placeholder-[#3d4f63]"
                placeholder="50.00" />
            </div>
          </div>

          {/* Sector */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1.5 block">القطاع</label>
            <select value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })}
              className="w-full bg-[#1e293b] border border-[#2d3a4f] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/60 appearance-none">
              <option value="">اختر القطاع...</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Purchase Date */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1.5 block">تاريخ الشراء</label>
            <input type="date" value={form.purchase_date}
              onChange={e => setForm({ ...form, purchase_date: e.target.value })}
              className="w-full bg-[#1e293b] border border-[#2d3a4f] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/60" />
          </div>

          {/* Cost Preview */}
          {form.shares && form.avg_cost && (
            <div className="bg-[#1e293b] rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-[#94a3b8]">إجمالي تكلفة الشراء</span>
              <span className="text-sm font-bold text-[#d4a843]">
                {(parseFloat(form.shares) * parseFloat(form.avg_cost)).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <button onClick={handleSubmit} disabled={!valid || loading}
            className="w-full py-3 bg-[#d4a843] hover:bg-[#e8c76a] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            {loading ? "جاري الإضافة..." : "إضافة للمحفظة"}
          </button>
        </div>
      </div>
    </div>
  );
}