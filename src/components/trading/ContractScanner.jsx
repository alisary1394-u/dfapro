import React, { useState } from "react";
import { Radar, Loader2, TrendingUp, TrendingDown, Zap, CheckCircle2, ChevronRight } from "lucide-react";
import { computeTargets } from "@/components/charts/TargetEngine";

// ===== US Futures & Popular Contracts =====
const US_CONTRACTS = [
  { symbol: "AAPL", name: "Apple", sector: "تقنية", basePrice: 185 },
  { symbol: "NVDA", name: "Nvidia", sector: "تقنية", basePrice: 875 },
  { symbol: "TSLA", name: "Tesla", sector: "سيارات", basePrice: 175 },
  { symbol: "MSFT", name: "Microsoft", sector: "تقنية", basePrice: 415 },
  { symbol: "AMZN", name: "Amazon", sector: "تجارة", basePrice: 185 },
  { symbol: "META", name: "Meta", sector: "تقنية", basePrice: 510 },
  { symbol: "GOOGL", name: "Alphabet", sector: "تقنية", basePrice: 170 },
  { symbol: "SPY", name: "S&P 500 ETF", sector: "مؤشر", basePrice: 525 },
  { symbol: "QQQ", name: "Nasdaq ETF", sector: "مؤشر", basePrice: 455 },
  { symbol: "NFLX", name: "Netflix", sector: "إعلام", basePrice: 630 },
  { symbol: "AMD", name: "AMD", sector: "تقنية", basePrice: 165 },
  { symbol: "COIN", name: "Coinbase", sector: "كريبتو", basePrice: 230 },
  { symbol: "JPM", name: "JPMorgan", sector: "بنوك", basePrice: 200 },
  { symbol: "GS", name: "Goldman Sachs", sector: "بنوك", basePrice: 475 },
  { symbol: "BABA", name: "Alibaba", sector: "تجارة", basePrice: 82 },
];

// Generate simulated candles around a base price
const genCandles = (basePrice, n = 80, vol = 0.012) => {
  let price = basePrice;
  return Array.from({ length: n }, (_, i) => {
    const open = price;
    const change = (Math.random() - 0.485) * price * vol;
    const close = parseFloat((open + change).toFixed(3));
    const high = parseFloat((Math.max(open, close) * (1 + Math.random() * 0.005)).toFixed(3));
    const low = parseFloat((Math.min(open, close) * (1 - Math.random() * 0.005)).toFixed(3));
    const volume = Math.floor(Math.random() * 8000000 + 500000);
    price = close;
    return { time: `${i}`, open, high, low, close, volume, isBull: close >= open };
  });
};

const scoreLabel = (s) =>
  s >= 80 ? "قوي جداً" : s >= 65 ? "قوي" : s >= 55 ? "متوسط+" : s >= 45 ? "محايد" : "ضعيف";

const scoreColor = (s) =>
  s >= 75 ? "#10b981" : s >= 60 ? "#34d399" : s >= 48 ? "#d4a843" : "#ef4444";

export default function ContractScanner({ onSelect }) {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  const runScan = async () => {
    setScanning(true);
    setDone(false);
    setResults([]);

    const out = [];
    for (let i = 0; i < US_CONTRACTS.length; i++) {
      const c = US_CONTRACTS[i];
      setProgress(Math.round(((i + 1) / US_CONTRACTS.length) * 100));

      // Simulate small async delay per contract
      await new Promise(r => setTimeout(r, 80));

      try {
        const candles = genCandles(c.basePrice, 100, 0.014);
        const result = computeTargets(candles);
        if (!result) continue;

        const last = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        const priceChange = ((last.close - prev.close) / prev.close * 100);

        out.push({
          ...c,
          currentPrice: last.close,
          priceChange,
          score: result.confluenceScore,
          isBull: result.isBull,
          target: result.primaryTargets?.[0]?.level,
          stopLoss: result.stopLoss,
          rr: result.riskReward,
          atr: result.atr,
          candles,
        });
      } catch (_) {}
    }

    // Sort by score descending
    out.sort((a, b) => b.score - a.score);
    setResults(out);
    setDone(true);
    setScanning(false);
  };

  const top3 = results.slice(0, 3);
  const rest = results.slice(3);

  return (
    <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Radar className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">ماسح العقود التلقائي</h3>
            <p className="text-xs text-[#64748b]">يحلل {US_CONTRACTS.length} عقداً ويختار الأفضل تلقائياً</p>
          </div>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm font-bold hover:bg-purple-500/30 disabled:opacity-50 transition-all"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {scanning ? `جاري المسح... ${progress}%` : "ابدأ المسح"}
        </button>
      </div>

      {/* Progress bar */}
      {scanning && (
        <div className="mb-4">
          <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #a855f7, #7c3aed)" }}
            />
          </div>
          <p className="text-xs text-[#64748b] mt-1 text-center">تحليل العقود... {progress}%</p>
        </div>
      )}

      {/* Results */}
      {done && results.length > 0 && (
        <div className="space-y-4">
          {/* Top 3 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-[#d4a843]" />
              <span className="text-xs font-bold text-[#d4a843]">أفضل 3 عقود للتداول</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {top3.map((c, idx) => (
                <button
                  key={c.symbol}
                  onClick={() => onSelect && onSelect({ symbol: c.symbol, name: c.name, market: "us" })}
                  className="text-right p-3 rounded-xl border border-[#1e293b] bg-[#0f1623] hover:border-purple-500/40 hover:bg-purple-500/5 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-black ${idx === 0 ? "text-[#d4a843]" : idx === 1 ? "text-[#94a3b8]" : "text-amber-700"}`}>
                        #{idx + 1}
                      </span>
                      <span className="text-sm font-bold text-white">{c.symbol}</span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-[#64748b] mb-2">{c.name} · {c.sector}</p>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-black text-white">${c.currentPrice.toFixed(2)}</span>
                    <span className={`text-xs font-bold flex items-center gap-0.5 ${c.priceChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {c.priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {c.priceChange >= 0 ? "+" : ""}{c.priceChange.toFixed(2)}%
                    </span>
                  </div>
                  {/* Score bar */}
                  <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full transition-all" style={{ width: `${c.score}%`, backgroundColor: scoreColor(c.score) }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: scoreColor(c.score) }}>{scoreLabel(c.score)}</span>
                    <span className="text-[#64748b]">{c.score}%</span>
                  </div>
                  {c.isBull ? (
                    <div className="mt-2 text-xs text-emerald-400 font-bold">▲ إشارة شراء · هدف ${c.target?.toFixed(2) || "—"}</div>
                  ) : (
                    <div className="mt-2 text-xs text-red-400 font-bold">▼ إشارة بيع · SL ${c.stopLoss?.toFixed(2) || "—"}</div>
                  )}
                  <div className="mt-1 text-xs text-purple-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-3 h-3" /> اضغط لفتح في البوت
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Rest of results */}
          {rest.length > 0 && (
            <div>
              <p className="text-xs text-[#64748b] mb-2 font-bold">بقية العقود المحللة</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e293b]">
                      {["الرمز", "الاسم", "القطاع", "السعر", "التغير", "الإشارة", "القوة", "الهدف", "SL", "R:R"].map(h => (
                        <th key={h} className="text-right py-2 px-2 text-[#64748b] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map(c => (
                      <tr key={c.symbol}
                        onClick={() => onSelect && onSelect({ symbol: c.symbol, name: c.name, market: "us" })}
                        className="border-b border-[#1a2235] hover:bg-[#1e293b]/30 transition-colors cursor-pointer">
                        <td className="py-2 px-2 font-bold text-white">{c.symbol}</td>
                        <td className="py-2 px-2 text-[#94a3b8]">{c.name}</td>
                        <td className="py-2 px-2 text-[#64748b]">{c.sector}</td>
                        <td className="py-2 px-2 text-white font-semibold">${c.currentPrice.toFixed(2)}</td>
                        <td className={`py-2 px-2 font-bold ${c.priceChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {c.priceChange >= 0 ? "+" : ""}{c.priceChange.toFixed(2)}%
                        </td>
                        <td className="py-2 px-2">
                          <span className={`font-bold ${c.isBull ? "text-emerald-400" : "text-red-400"}`}>
                            {c.isBull ? "▲ شراء" : "▼ بيع"}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1 bg-[#1e293b] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${c.score}%`, backgroundColor: scoreColor(c.score) }} />
                            </div>
                            <span style={{ color: scoreColor(c.score) }}>{c.score}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-[#d4a843]">{c.target?.toFixed(2) || "—"}</td>
                        <td className="py-2 px-2 text-red-400">{c.stopLoss?.toFixed(2) || "—"}</td>
                        <td className="py-2 px-2 text-[#94a3b8]">{c.rr}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!done && !scanning && (
        <div className="text-center py-8 text-[#475569] text-sm">
          اضغط "ابدأ المسح" ليقوم البوت بتحليل {US_CONTRACTS.length} عقداً تلقائياً واختيار الأفضل
        </div>
      )}
    </div>
  );
}