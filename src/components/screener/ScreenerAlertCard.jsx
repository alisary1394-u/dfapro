import React, { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown, Zap, Clock } from "lucide-react";
import { signalColor } from "@/pages/Screener";

export default function ScreenerAlertCard({ alert, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const colors = signalColor(alert.signalType);
  const isBuy = alert.signalType.includes("buy");

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div className={`relative rounded-2xl border p-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      style={{ borderColor: colors.bg + '50', backgroundColor: colors.bg + '12' }}>
      {/* dismiss */}
      <button onClick={() => onDismiss(alert.id)}
        className="absolute top-2 left-2 p-1 rounded-lg hover:bg-white/10 transition-colors">
        <X className="w-3.5 h-3.5 text-[#64748b]" />
      </button>

      {/* pulse dot */}
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: colors.bg + '25' }}>
            {isBuy
              ? <TrendingUp className="w-4 h-4" style={{ color: colors.bg }} />
              : <TrendingDown className="w-4 h-4" style={{ color: colors.bg }} />
            }
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping"
            style={{ backgroundColor: colors.bg + '80' }} />
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.bg }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-black text-white">{alert.symbol}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
              style={{ backgroundColor: colors.bg + '20', color: colors.bg }}>
              {alert.signal}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#1e293b] text-[#64748b]">
              {alert.market === "saudi" ? "🇸🇦" : "🇺🇸"}
            </span>
          </div>
          <p className="text-xs text-[#94a3b8] truncate">{alert.name}</p>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-white font-bold">{alert.price.toFixed(2)}</span>
            <span className="text-[#64748b]">{alert.aligned}/{alert.totalTfs} أطر متوافقة</span>
            <span className="text-[#64748b] flex items-center gap-1">
              <Clock className="w-3 h-3" />{alert.time}
            </span>
          </div>
          {/* score bar */}
          <div className="mt-2 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${alert.score}%`, backgroundColor: colors.bg }} />
          </div>
        </div>
      </div>
    </div>
  );
}