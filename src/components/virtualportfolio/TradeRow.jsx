import React, { useState } from "react";
import { TrendingUp, TrendingDown, Trash2, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function TradeRow({ trade, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closePrice, setClosePrice] = useState("");

  const isBuy = trade.trade_type === "buy";
  const currentPrice = trade.current_price || trade.entry_price;
  const pnl = isBuy
    ? (currentPrice - trade.entry_price) * trade.shares
    : (trade.entry_price - currentPrice) * trade.shares;
  const pnlPct = ((pnl / (trade.entry_price * trade.shares)) * 100);
  const totalValue = trade.shares * currentPrice;
  const cost = trade.shares * trade.entry_price;
  const isProfit = pnl >= 0;

  const handleClose = async () => {
    if (!closePrice) return;
    const cp = parseFloat(closePrice);
    const realizedPnl = isBuy ? (cp - trade.entry_price) * trade.shares : (trade.entry_price - cp) * trade.shares;
    await base44.entities.VirtualTrade.update(trade.id, { status: "closed", close_price: cp, current_price: cp });
    setClosing(false);
    onUpdate();
  };

  const handleDelete = async () => {
    await base44.entities.VirtualTrade.delete(trade.id);
    onUpdate();
  };

  return (
    <div className={`bg-[#151c2c] border rounded-xl transition-all ${trade.status === "closed" ? "border-[#1e293b] opacity-70" : isProfit ? "border-emerald-500/20" : "border-red-500/20"}`}>
      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isBuy ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
          {isBuy ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
        </div>

        {/* Symbol + name */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-white">{trade.symbol}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isBuy ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              {isBuy ? "Long" : "Short"}
            </span>
            {trade.status === "closed" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#1e293b] text-[#64748b]">مغلقة</span>
            )}
          </div>
          <p className="text-xs text-[#64748b] truncate">{trade.name}</p>
        </div>

        {/* Price info */}
        <div className="text-center hidden sm:block">
          <p className="text-xs text-[#64748b]">الدخول</p>
          <p className="text-sm font-bold text-white">${trade.entry_price?.toLocaleString()}</p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="text-xs text-[#64748b]">الحالي</p>
          <p className="text-sm font-bold text-white">${currentPrice?.toLocaleString()}</p>
        </div>

        {/* PnL */}
        <div className="text-left">
          <p className={`text-base font-black ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
            {isProfit ? "+" : ""}{pnl.toFixed(2)}$
          </p>
          <p className={`text-xs font-bold ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
            {isProfit ? "+" : ""}{pnlPct.toFixed(2)}%
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-[#64748b]" /> : <ChevronDown className="w-4 h-4 text-[#64748b]" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#1e293b] p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0f1623] rounded-lg p-3">
              <p className="text-[10px] text-[#64748b]">الأسهم</p>
              <p className="text-sm font-bold text-white">{trade.shares}</p>
            </div>
            <div className="bg-[#0f1623] rounded-lg p-3">
              <p className="text-[10px] text-[#64748b]">التكلفة</p>
              <p className="text-sm font-bold text-white">${cost.toLocaleString()}</p>
            </div>
            <div className="bg-[#0f1623] rounded-lg p-3">
              <p className="text-[10px] text-[#64748b]">القيمة الحالية</p>
              <p className="text-sm font-bold text-white">${totalValue.toLocaleString()}</p>
            </div>
            <div className="bg-[#0f1623] rounded-lg p-3">
              <p className="text-[10px] text-[#64748b]">السوق</p>
              <p className="text-sm font-bold text-white">{trade.market === "saudi" ? "🇸🇦 سعودي" : "🇺🇸 أمريكي"}</p>
            </div>
          </div>

          {trade.notes && (
            <p className="text-xs text-[#94a3b8] bg-[#0f1623] rounded-lg p-3 border border-[#1e293b]">
              📝 {trade.notes}
            </p>
          )}

          {trade.status === "open" && (
            <div className="flex gap-2 flex-wrap">
              {!closing ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setClosing(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#d4a843]/10 border border-[#d4a843]/30 text-[#d4a843] rounded-lg text-xs font-bold hover:bg-[#d4a843]/20 transition-all">
                    <CheckCircle className="w-3.5 h-3.5" /> إغلاق الصفقة
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all">
                    <Trash2 className="w-3.5 h-3.5" /> حذف
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input type="number" value={closePrice} onChange={e => setClosePrice(e.target.value)}
                    placeholder="سعر الإغلاق"
                    className="bg-[#0f1623] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white w-36 focus:outline-none focus:border-[#d4a843]/50" />
                  <button onClick={handleClose}
                    className="px-3 py-2 bg-[#d4a843] text-black rounded-lg text-xs font-bold hover:bg-[#e8c76a] transition-all">
                    تأكيد
                  </button>
                  <button onClick={() => setClosing(false)}
                    className="px-3 py-2 bg-[#1e293b] text-[#94a3b8] rounded-lg text-xs font-bold transition-all">
                    إلغاء
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}