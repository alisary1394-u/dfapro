import React, { useState, useRef, useEffect } from "react";
import { X, Search, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";

const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple", market: "us" }, { symbol: "TSLA", name: "Tesla", market: "us" },
  { symbol: "NVDA", name: "NVIDIA", market: "us" }, { symbol: "MSFT", name: "Microsoft", market: "us" },
  { symbol: "AMZN", name: "Amazon", market: "us" }, { symbol: "META", name: "Meta", market: "us" },
  { symbol: "GOOGL", name: "Alphabet", market: "us" }, { symbol: "AMD", name: "AMD", market: "us" },
  { symbol: "NFLX", name: "Netflix", market: "us" }, { symbol: "JPM", name: "JPMorgan", market: "us" },
  { symbol: "2222", name: "أرامكو السعودية", market: "saudi" }, { symbol: "1120", name: "الراجحي", market: "saudi" },
  { symbol: "2010", name: "سابك", market: "saudi" }, { symbol: "7010", name: "الاتصالات", market: "saudi" },
  { symbol: "1180", name: "الأهلي", market: "saudi" }, { symbol: "2380", name: "بترو رابغ", market: "saudi" },
];

export default function AddTradeModal({ onClose, onSave }) {
  const [inputVal, setInputVal] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [form, setForm] = useState({ trade_type: "buy", shares: "", entry_price: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = inputVal.trim()
    ? POPULAR_STOCKS.filter(s => s.symbol.includes(inputVal.toUpperCase()) || s.name.includes(inputVal))
    : POPULAR_STOCKS.slice(0, 8);

  const handleSave = async () => {
    if (!selectedStock || !form.shares || !form.entry_price) return;
    setSaving(true);
    const trade = {
      symbol: selectedStock.symbol,
      name: selectedStock.name,
      market: selectedStock.market,
      trade_type: form.trade_type,
      shares: parseFloat(form.shares),
      entry_price: parseFloat(form.entry_price),
      current_price: parseFloat(form.entry_price),
      status: "open",
      notes: form.notes,
    };
    await base44.entities.VirtualTrade.create(trade);
    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#1e293b]">
          <h2 className="text-base font-bold text-white">إضافة صفقة جديدة</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#1e293b] rounded-lg transition-colors">
            <X className="w-4 h-4 text-[#94a3b8]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Stock Search */}
          <div>
            <label className="text-xs text-[#64748b] block mb-1.5">السهم</label>
            <div className="relative" ref={searchRef}>
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
              <input
                value={inputVal}
                onChange={e => { setInputVal(e.target.value); setShowDropdown(true); setSelectedStock(null); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="ابحث عن سهم..."
                className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl pr-9 pl-4 py-2.5 text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#d4a843]/50"
              />
              {showDropdown && filtered.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-[#1a2235] border border-[#1e293b] rounded-xl z-50 max-h-48 overflow-y-auto shadow-xl">
                  {filtered.map(s => (
                    <button key={s.symbol} onMouseDown={() => { setSelectedStock(s); setInputVal(`${s.symbol} — ${s.name}`); setShowDropdown(false); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#d4a843]/10 transition-colors">
                      <span className="text-xs text-[#94a3b8]">{s.name} · {s.market === "saudi" ? "🇸🇦" : "🇺🇸"}</span>
                      <span className="text-sm font-bold text-white">{s.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Trade Type */}
          <div>
            <label className="text-xs text-[#64748b] block mb-1.5">نوع الصفقة</label>
            <div className="flex gap-2">
              <button onClick={() => setForm(f => ({ ...f, trade_type: "buy" }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${form.trade_type === "buy" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-[#0f1623] border border-[#1e293b] text-[#94a3b8]"}`}>
                📈 شراء (Long)
              </button>
              <button onClick={() => setForm(f => ({ ...f, trade_type: "sell" }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${form.trade_type === "sell" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-[#0f1623] border border-[#1e293b] text-[#94a3b8]"}`}>
                📉 بيع (Short)
              </button>
            </div>
          </div>

          {/* Shares + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#64748b] block mb-1.5">عدد الأسهم</label>
              <input type="number" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                placeholder="0"
                className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/50" />
            </div>
            <div>
              <label className="text-xs text-[#64748b] block mb-1.5">سعر الدخول</label>
              <input type="number" value={form.entry_price} onChange={e => setForm(f => ({ ...f, entry_price: e.target.value }))}
                placeholder="0.00"
                className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/50" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-[#64748b] block mb-1.5">ملاحظات (اختياري)</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="سبب الصفقة، استراتيجية..."
              className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/50" />
          </div>

          {/* Cost preview */}
          {form.shares && form.entry_price && (
            <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-[#64748b]">إجمالي تكلفة الصفقة</span>
              <span className="text-base font-black text-[#d4a843]">
                ${(parseFloat(form.shares) * parseFloat(form.entry_price)).toLocaleString("en", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-[#1e293b]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#1e293b] text-[#94a3b8] text-sm font-bold hover:text-white transition-all">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !selectedStock || !form.shares || !form.entry_price}
            className="flex-1 py-2.5 rounded-xl bg-[#d4a843] text-black text-sm font-bold hover:bg-[#e8c76a] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
            إضافة الصفقة
          </button>
        </div>
      </div>
    </div>
  );
}