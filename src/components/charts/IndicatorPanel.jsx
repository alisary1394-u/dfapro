import React, { useState } from "react";
import { Settings2, ChevronDown, ChevronUp } from "lucide-react";

const DEFAULT_INDICATORS = {
  MA: { enabled: false, type: "EMA", period: 20, color: "#f59e0b" },
  MA2: { enabled: false, type: "SMA", period: 50, color: "#818cf8" },
  MA3: { enabled: false, type: "EMA", period: 200, color: "#fb923c" },
  BB: { enabled: false, period: 20, multiplier: 2, color: "#a78bfa" },
  RSI: { enabled: false, period: 14 },
  MACD: { enabled: false, fast: 12, slow: 26, signal: 9 },
};

export function useIndicators() {
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);

  const toggle = (key) =>
    setIndicators(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));

  const update = (key, field, value) =>
    setIndicators(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  return { indicators, toggle, update };
}

export default function IndicatorPanel({ indicators, onToggle, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const activeCount = Object.values(indicators).filter(i => i.enabled).length;

  const maTypes = ["EMA", "SMA"];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
          activeCount > 0
            ? "bg-[#d4a843]/20 border-[#d4a843]/40 text-[#d4a843]"
            : "bg-[#111827] border-[#1e293b] text-white hover:bg-[#1e293b]"
        }`}
      >
        <Settings2 className="w-3 h-3" />
        مؤشرات {activeCount > 0 && <span className="bg-[#d4a843] text-black rounded-full w-4 h-4 flex items-center justify-center font-bold">{activeCount}</span>}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-[#111827] border border-[#1e293b] rounded-xl shadow-2xl z-30 w-72">
          <div className="p-3 border-b border-[#1e293b]">
            <p className="text-xs font-bold text-white">المؤشرات الفنية</p>
          </div>

          <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
            {/* MA 1 */}
            <IndicatorRow
              label={`${indicators.MA.type} ${indicators.MA.period}`}
              color={indicators.MA.color}
              enabled={indicators.MA.enabled}
              onToggle={() => onToggle("MA")}
              expanded={expanded === "MA"}
              onExpand={() => setExpanded(expanded === "MA" ? null : "MA")}
            >
              <SettingRow label="النوع">
                <select value={indicators.MA.type} onChange={e => onUpdate("MA", "type", e.target.value)} className="bg-[#0a0e17] border border-[#1e293b] rounded px-2 py-0.5 text-xs text-white">
                  {maTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </SettingRow>
              <SettingRow label="الفترة">
                <NumberInput value={indicators.MA.period} onChange={v => onUpdate("MA", "period", v)} min={2} max={500} />
              </SettingRow>
              <SettingRow label="اللون">
                <input type="color" value={indicators.MA.color} onChange={e => onUpdate("MA", "color", e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0" />
              </SettingRow>
            </IndicatorRow>

            {/* MA 2 */}
            <IndicatorRow
              label={`${indicators.MA2.type} ${indicators.MA2.period}`}
              color={indicators.MA2.color}
              enabled={indicators.MA2.enabled}
              onToggle={() => onToggle("MA2")}
              expanded={expanded === "MA2"}
              onExpand={() => setExpanded(expanded === "MA2" ? null : "MA2")}
            >
              <SettingRow label="النوع">
                <select value={indicators.MA2.type} onChange={e => onUpdate("MA2", "type", e.target.value)} className="bg-[#0a0e17] border border-[#1e293b] rounded px-2 py-0.5 text-xs text-white">
                  {maTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </SettingRow>
              <SettingRow label="الفترة">
                <NumberInput value={indicators.MA2.period} onChange={v => onUpdate("MA2", "period", v)} min={2} max={500} />
              </SettingRow>
              <SettingRow label="اللون">
                <input type="color" value={indicators.MA2.color} onChange={e => onUpdate("MA2", "color", e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0" />
              </SettingRow>
            </IndicatorRow>

            {/* MA 3 */}
            <IndicatorRow
              label={`${indicators.MA3.type} ${indicators.MA3.period}`}
              color={indicators.MA3.color}
              enabled={indicators.MA3.enabled}
              onToggle={() => onToggle("MA3")}
              expanded={expanded === "MA3"}
              onExpand={() => setExpanded(expanded === "MA3" ? null : "MA3")}
            >
              <SettingRow label="النوع">
                <select value={indicators.MA3.type} onChange={e => onUpdate("MA3", "type", e.target.value)} className="bg-[#0a0e17] border border-[#1e293b] rounded px-2 py-0.5 text-xs text-white">
                  {maTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </SettingRow>
              <SettingRow label="الفترة">
                <NumberInput value={indicators.MA3.period} onChange={v => onUpdate("MA3", "period", v)} min={2} max={500} />
              </SettingRow>
              <SettingRow label="اللون">
                <input type="color" value={indicators.MA3.color} onChange={e => onUpdate("MA3", "color", e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0" />
              </SettingRow>
            </IndicatorRow>

            {/* Bollinger Bands */}
            <IndicatorRow
              label={`Bollinger Bands ${indicators.BB.period}`}
              color={indicators.BB.color}
              enabled={indicators.BB.enabled}
              onToggle={() => onToggle("BB")}
              expanded={expanded === "BB"}
              onExpand={() => setExpanded(expanded === "BB" ? null : "BB")}
            >
              <SettingRow label="الفترة">
                <NumberInput value={indicators.BB.period} onChange={v => onUpdate("BB", "period", v)} min={2} max={200} />
              </SettingRow>
              <SettingRow label="الانحراف">
                <NumberInput value={indicators.BB.multiplier} onChange={v => onUpdate("BB", "multiplier", v)} min={0.5} max={5} step={0.5} />
              </SettingRow>
              <SettingRow label="اللون">
                <input type="color" value={indicators.BB.color} onChange={e => onUpdate("BB", "color", e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0" />
              </SettingRow>
            </IndicatorRow>

            {/* RSI */}
            <IndicatorRow
              label={`RSI ${indicators.RSI.period}`}
              color="#22d3ee"
              enabled={indicators.RSI.enabled}
              onToggle={() => onToggle("RSI")}
              expanded={expanded === "RSI"}
              onExpand={() => setExpanded(expanded === "RSI" ? null : "RSI")}
            >
              <SettingRow label="الفترة">
                <NumberInput value={indicators.RSI.period} onChange={v => onUpdate("RSI", "period", v)} min={2} max={100} />
              </SettingRow>
            </IndicatorRow>

            {/* MACD */}
            <IndicatorRow
              label={`MACD (${indicators.MACD.fast},${indicators.MACD.slow},${indicators.MACD.signal})`}
              color="#a78bfa"
              enabled={indicators.MACD.enabled}
              onToggle={() => onToggle("MACD")}
              expanded={expanded === "MACD"}
              onExpand={() => setExpanded(expanded === "MACD" ? null : "MACD")}
            >
              <SettingRow label="سريع">
                <NumberInput value={indicators.MACD.fast} onChange={v => onUpdate("MACD", "fast", v)} min={2} max={50} />
              </SettingRow>
              <SettingRow label="بطيء">
                <NumberInput value={indicators.MACD.slow} onChange={v => onUpdate("MACD", "slow", v)} min={2} max={100} />
              </SettingRow>
              <SettingRow label="إشارة">
                <NumberInput value={indicators.MACD.signal} onChange={v => onUpdate("MACD", "signal", v)} min={2} max={50} />
              </SettingRow>
            </IndicatorRow>
          </div>
        </div>
      )}
    </div>
  );
}

function IndicatorRow({ label, color, enabled, onToggle, expanded, onExpand, children }) {
  return (
    <div className="rounded-lg overflow-hidden">
      <div className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${enabled ? "bg-[#1e293b]" : "hover:bg-[#1a2235]"}`}>
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="flex-1 text-xs text-white">{label}</span>
        <button
          onClick={onExpand}
          className="p-0.5 hover:text-[#d4a843] text-[#64748b] transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <button
          onClick={onToggle}
          className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${enabled ? "bg-[#d4a843]" : "bg-[#374151]"}`}
        >
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${enabled ? "right-0.5" : "left-0.5"}`} />
        </button>
      </div>
      {expanded && (
        <div className="bg-[#0a0e17] px-3 py-2 space-y-2 border-t border-[#1e293b]">
          {children}
        </div>
      )}
    </div>
  );
}

function SettingRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-[#94a3b8]">{label}</span>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step = 1 }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-16 bg-[#1e293b] border border-[#2d3748] rounded px-2 py-0.5 text-xs text-white text-center"
    />
  );
}