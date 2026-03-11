import React, { useState } from "react";
import {
  Send, Loader2, AlertCircle, CheckCircle2,
  TrendingUp, TrendingDown
} from "lucide-react";

export default function OrderExecutor({ symbol, currentPrice, mode = "paper" }) {
  const [orderType, setOrderType] = useState("market"); // "market" | "limit"
  const [side, setSide] = useState("buy"); // "buy" | "sell"
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState(currentPrice || 0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const submitOrder = async () => {
    if (!symbol || quantity <= 0) {
      setError("Please enter valid symbol and quantity");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      throw new Error("خدمة تنفيذ الأوامر غير متاحة حالياً");
    } catch (err) {
      setError(err.message || "Failed to submit order");
    } finally {
      setLoading(false);
    }
  };

  const estimatedCost = quantity * (orderType === "limit" ? limitPrice : currentPrice);

  return (
    <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">تنفيذ أمر</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
          mode === 'live'
            ? 'bg-red-500/20 text-red-400'
            : 'bg-blue-500/20 text-blue-400'
        }`}>
          {mode === 'live' ? '⚡ تجريبي/حقيقي' : '📊 تجريبي فقط'}
        </span>
      </div>

      <div className="space-y-4">
        {/* Buy/Sell Toggle */}
        <div>
          <label className="text-xs text-[#64748b] block mb-2">نوع الأمر</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSide("buy")}
              className={`flex-1 py-2 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                side === "buy"
                  ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                  : "bg-[#0f1623] border border-[#1e293b] text-[#94a3b8] hover:text-white"
              }`}
            >
              <TrendingUp className="w-4 h-4" /> شراء
            </button>
            <button
              onClick={() => setSide("sell")}
              className={`flex-1 py-2 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                side === "sell"
                  ? "bg-red-500/20 border border-red-500/30 text-red-400"
                  : "bg-[#0f1623] border border-[#1e293b] text-[#94a3b8] hover:text-white"
              }`}
            >
              <TrendingDown className="w-4 h-4" /> بيع
            </button>
          </div>
        </div>

        {/* Symbol Display */}
        <div>
          <label className="text-xs text-[#64748b] block mb-2">الرمز</label>
          <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl px-3 py-2 text-white font-bold">
            {symbol || "—"}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="text-xs text-[#64748b] block mb-2">الكمية</label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50"
          />
        </div>

        {/* Order Type */}
        <div>
          <label className="text-xs text-[#64748b] block mb-2">نوع السعر</label>
          <div className="flex gap-2">
            <button
              onClick={() => setOrderType("market")}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs transition-all ${
                orderType === "market"
                  ? "bg-[#d4a843]/20 border border-[#d4a843]/60 text-[#d4a843]"
                  : "bg-[#0f1623] border border-[#1e293b] text-[#94a3b8] hover:text-white"
              }`}
            >
              سوقي
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs transition-all ${
                orderType === "limit"
                  ? "bg-[#d4a843]/20 border border-[#d4a843]/60 text-[#d4a843]"
                  : "bg-[#0f1623] border border-[#1e293b] text-[#94a3b8] hover:text-white"
              }`}
            >
              محدد
            </button>
          </div>
        </div>

        {/* Limit Price (if limit order) */}
        {orderType === "limit" && (
          <div>
            <label className="text-xs text-[#64748b] block mb-2">السعر المحدد</label>
            <input
              type="number"
              step="0.01"
              value={limitPrice}
              onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50"
            />
          </div>
        )}

        {/* Estimated Cost */}
        <div className="p-3 bg-[#0f1623] border border-[#1e293b] rounded-xl">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#64748b]">التكلفة المتوقعة</span>
            <span className="text-sm font-bold text-white">
              ${estimatedCost.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-[#64748b] mt-1">
            {quantity} × ${(orderType === "limit" ? limitPrice : currentPrice).toFixed(2)}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {result && (
          <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-400">
              <p className="font-bold">تم تنفيذ الأمر بنجاح</p>
              <p>ID: {result.id}</p>
              <p>السعر المتوقع: ${result.filledPrice?.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={submitOrder}
          disabled={loading || !symbol}
          className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            side === "buy"
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50'
              : 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 disabled:opacity-50'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> جاري...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> تنفيذ الأمر
            </>
          )}
        </button>
      </div>
    </div>
  );
}