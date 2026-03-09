import React, { useState } from "react";
import { Settings, X, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { ALL_WIDGETS } from "./useDashboardLayout";

export default function DashboardCustomizer({ layout, market, onToggle, onMove, onMarketChange }) {
  const [open, setOpen] = useState(false);

  const enabledCount = layout.filter(w => w.enabled).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-[#151c2c] border border-[#1e293b] hover:border-[#d4a843]/50 rounded-xl text-xs text-[#94a3b8] hover:text-[#d4a843] transition-all"
      >
        <Settings className="w-4 h-4" />
        تخصيص اللوحة
        <span className="bg-[#1e293b] text-[#94a3b8] px-1.5 py-0.5 rounded-full text-[10px]">{enabledCount}/{layout.length}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="relative bg-[#111827] border border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#1e293b]">
              <div>
                <h2 className="text-white font-bold text-base">تخصيص لوحة التحكم</h2>
                <p className="text-[#64748b] text-xs mt-0.5">فعّل أو أوقف الودجات وغيّر ترتيبها</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-[#1e293b] rounded-xl transition-colors">
                <X className="w-4 h-4 text-[#94a3b8]" />
              </button>
            </div>

            {/* Widget List */}
            <div className="p-3 space-y-1 max-h-96 overflow-y-auto">
              {layout.map((w, idx) => {
                const meta = ALL_WIDGETS.find(a => a.id === w.id);
                return (
                  <div
                    key={w.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      w.enabled ? "bg-[#1a2235]" : "opacity-50"
                    }`}
                  >
                    <span className="text-base">{meta?.icon}</span>
                    <span className="flex-1 text-xs text-white">{meta?.label}</span>

                    {/* Move buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => onMove(w.id, "up")}
                        disabled={idx === 0}
                        className="p-0.5 hover:text-[#d4a843] text-[#374151] disabled:opacity-20 transition-colors"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onMove(w.id, "down")}
                        disabled={idx === layout.length - 1}
                        className="p-0.5 hover:text-[#d4a843] text-[#374151] disabled:opacity-20 transition-colors"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => onToggle(w.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        w.enabled
                          ? "text-[#10b981] hover:bg-[#10b981]/20"
                          : "text-[#64748b] hover:bg-[#1e293b]"
                      }`}
                    >
                      {w.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-[#1e293b]">
              <p className="text-[10px] text-[#64748b] text-center">يتم حفظ التفضيلات تلقائياً لحسابك</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}