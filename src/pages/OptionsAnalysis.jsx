import React, { useState, useRef, useEffect } from "react";
import { TrendingUp, Search, Loader2, Target, BarChart3, Activity, AlertCircle, ChevronDown, ChevronUp, X } from "lucide-react";
import { getOptionsChain } from "@/components/api/marketDataClient";

const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple" }, { symbol: "TSLA", name: "Tesla" }, { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "MSFT", name: "Microsoft" }, { symbol: "AMZN", name: "Amazon" }, { symbol: "META", name: "Meta" },
  { symbol: "GOOGL", name: "Alphabet" }, { symbol: "AMD", name: "AMD" }, { symbol: "NFLX", name: "Netflix" },
  { symbol: "SPY", name: "S&P 500 ETF" }, { symbol: "QQQ", name: "Nasdaq ETF" }, { symbol: "BABA", name: "Alibaba" },
  { symbol: "DIS", name: "Disney" }, { symbol: "JPM", name: "JPMorgan" }, { symbol: "BAC", name: "Bank of America" },
  { symbol: "COIN", name: "Coinbase" }, { symbol: "PLTR", name: "Palantir" }, { symbol: "SOFI", name: "SoFi" },
];

const OPTION_TYPES = [
  { value: "call", label: "Call — حق الشراء", color: "#10b981" },
  { value: "put", label: "Put — حق البيع", color: "#ef4444" },
];

const EXPIRY_OPTIONS = ["أسبوع واحد", "أسبوعان", "شهر واحد", "3 أشهر", "6 أشهر", "سنة"];

const formatExpiryLabel = (unixTs) => {
  if (!unixTs) return "—";
  return new Date(Number(unixTs) * 1000).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-4">
      <p className="text-xs text-[#64748b] mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color: color || "#f1f5f9" }}>{value}</p>
      {sub && <p className="text-[10px] text-[#64748b] mt-0.5">{sub}</p>}
    </div>
  );
}

function GreeksCard({ greeks }) {
  const items = [
    { key: "delta", label: "Delta", desc: "حساسية السعر", color: "#3b82f6" },
    { key: "gamma", label: "Gamma", desc: "معدل تغير Delta", color: "#8b5cf6" },
    { key: "theta", label: "Theta", desc: "تآكل الوقت يومياً", color: "#ef4444" },
    { key: "vega", label: "Vega", desc: "حساسية التقلب", color: "#10b981" },
    { key: "rho", label: "Rho", desc: "حساسية سعر الفائدة", color: "#d4a843" },
  ];
  return (
    <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#d4a843]" /> مؤشرات Greeks
      </h3>
      <div className="space-y-3">
        {items.map(({ key, label, desc, color }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <span className="text-sm font-bold" style={{ color }}>{label}</span>
              <span className="text-xs text-[#64748b] mr-2">{desc}</span>
            </div>
            <span className="text-sm font-mono font-bold text-white">
              {greeks?.[key] != null ? greeks[key].toFixed(4) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OptionsAnalysis() {
  const [symbol, setSymbol] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const [optionType, setOptionType] = useState("call");

  useEffect(() => {
    const handleClick = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredStocks = inputVal.trim()
    ? POPULAR_STOCKS.filter(s => s.symbol.includes(inputVal.toUpperCase()) || s.name.toLowerCase().includes(inputVal.toLowerCase()))
    : POPULAR_STOCKS.slice(0, 8);

  const selectStock = (stock) => {
    setInputVal(stock.symbol);
    setShowDropdown(false);
  };
  const [expiry, setExpiry] = useState(null);
  const [availableExpiries, setAvailableExpiries] = useState([]);
  const [strikeOffset, setStrikeOffset] = useState(0); // ATM=0, ITM=-1/+1, OTM=+1/-1
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const analyze = async (overrides = {}) => {
    if (!inputVal.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    const sym = inputVal.trim().toUpperCase();
    setSymbol(sym);
    const selectedType = overrides.type ?? optionType;
    const selectedOffset = overrides.offset ?? strikeOffset;
    const selectedExpiry = overrides.expiry ?? expiry;
    try {
      const data = await getOptionsChain({
        symbol: sym,
        type: selectedType,
        offset: selectedOffset,
        expiry: selectedExpiry,
      });
      setResult(data || null);
      if (Array.isArray(data?.expiration_dates) && data.expiration_dates.length > 0) {
        setAvailableExpiries(data.expiration_dates);
      }
      if (data?.expiration) {
        setExpiry(data.expiration);
      }
    } catch (e) {
      setError("تعذر تحميل بيانات الخيارات. تأكد من الرمز وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!inputVal.trim()) return;
    analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionType, strikeOffset]);

  const recColor = {
    "شراء قوي": "#10b981",
    "شراء": "#34d399",
    "محايد": "#d4a843",
    "تجنب": "#f97316",
    "بيع": "#ef4444",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4a843] to-[#b8922f] flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">تحليل الأوبشن</h1>
          <p className="text-xs text-[#94a3b8]">تحليل ذكي لعقود الخيارات (Options)</p>
        </div>
      </div>

      {/* Input Card */}
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6 space-y-5">
        {/* Symbol */}
        <div>
          <label className="text-xs text-[#64748b] block mb-2">رمز السهم</label>
          <div className="flex gap-2">
            <div className="relative flex-1" ref={searchRef}>
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
              <input
                value={inputVal}
                onChange={e => { setInputVal(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={e => { if (e.key === "Enter") { setShowDropdown(false); analyze(); } if (e.key === "Escape") setShowDropdown(false); }}
                placeholder="ابحث عن سهم: AAPL, TSLA, NVDA..."
                className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#d4a843]/50"
              />
              {inputVal && (
                <button onClick={() => { setInputVal(""); setShowDropdown(false); }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {showDropdown && filteredStocks.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-[#1a2235] border border-[#1e293b] rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                  {filteredStocks.map(stock => (
                    <button
                      key={stock.symbol}
                      onMouseDown={() => selectStock(stock)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#d4a843]/10 transition-colors text-right"
                    >
                      <span className="text-xs text-[#94a3b8]">{stock.name}</span>
                      <span className="text-sm font-bold text-white">{stock.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => { setShowDropdown(false); analyze(); }}
              disabled={loading || !inputVal.trim()}
              className="px-5 py-2.5 bg-[#d4a843] hover:bg-[#e8c76a] disabled:opacity-50 text-black font-bold rounded-xl transition-all flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              تحليل
            </button>
          </div>
        </div>

        {/* Type + Expiry + Strike */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-[#64748b] block mb-2">نوع الأوبشن</label>
            <div className="flex gap-2">
              {OPTION_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setOptionType(t.value)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                    optionType === t.value
                      ? `border-[${t.color}]/60 bg-[${t.color}]/10 text-white`
                      : "border-[#1e293b] bg-[#0f1623] text-[#94a3b8] hover:text-white"
                  }`}
                  style={optionType === t.value ? { borderColor: t.color + "80", backgroundColor: t.color + "15", color: t.color } : {}}
                >
                  {t.value === "call" ? "📈 Call" : "📉 Put"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[#64748b] block mb-2">تاريخ الانتهاء</label>
            <select
              value={expiry ?? ""}
              onChange={e => {
                const raw = e.target.value;
                if (!raw) return;
                const nextExpiry = Number(raw);
                if (!Number.isFinite(nextExpiry) || nextExpiry <= 0) return;
                setExpiry(nextExpiry);
                analyze({ expiry: nextExpiry });
              }}
              className="w-full bg-[#0f1623] border border-[#1e293b] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a843]/50"
            >
              {availableExpiries.length > 0 ? (
                availableExpiries.map((ts) => (
                  <option key={ts} value={ts}>{formatExpiryLabel(ts)}</option>
                ))
              ) : (
                EXPIRY_OPTIONS.map(o => <option key={o} value="">{o}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#64748b] block mb-2">موضع الإضراب</label>
            <div className="flex gap-1">
              {[
                { v: -1, label: "ITM" },
                { v: 0, label: "ATM" },
                { v: 1, label: "OTM" },
                { v: 2, label: "الكل" },
              ].map(s => (
                <button
                  key={s.v}
                  onClick={() => setStrikeOffset(s.v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    strikeOffset === s.v
                      ? "bg-[#d4a843] text-black"
                      : "bg-[#0f1623] border border-[#1e293b] text-[#94a3b8] hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#d4a843] border-t-transparent animate-spin" />
          <p className="text-[#94a3b8] text-sm">جاري تحليل عقد الأوبشن...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-5">
          {/* Recommendation Banner */}
          <div
            className="rounded-2xl p-5 border flex items-center gap-4 flex-wrap"
            style={{ borderColor: (recColor[result.recommendation] || "#d4a843") + "50", backgroundColor: (recColor[result.recommendation] || "#d4a843") + "10" }}
          >
            <div className="text-4xl">{result.recommendation === "شراء قوي" ? "🚀" : result.recommendation === "شراء" ? "✅" : result.recommendation === "محايد" ? "⚖️" : result.recommendation === "بيع" ? "📉" : "⚠️"}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold" style={{ color: recColor[result.recommendation] }}>{result.recommendation}</span>
                <span className="text-[#94a3b8] text-sm">— {result.symbol} {optionType.toUpperCase()}</span>
              </div>
              <p className="text-sm text-[#94a3b8]">{result.recommendation_reason}</p>
            </div>
            <div className="text-left">
              <p className="text-xs text-[#64748b]">Premium المقدر</p>
              <p className="text-2xl font-bold text-white">${result.premium?.toFixed(2)}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="السعر الحالي" value={`$${result.current_price?.toFixed(2)}`} />
            <StatCard label="سعر الإضراب" value={`$${result.strike_price?.toFixed(2)}`} color="#d4a843" />
            <StatCard label="نقطة التعادل" value={`$${result.breakeven?.toFixed(2)}`} color="#3b82f6" />
            <StatCard label="التقلب الضمني" value={`${result.iv_percent?.toFixed(1)}%`} sub="Implied Volatility" color="#8b5cf6" />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Greeks */}
            <GreeksCard greeks={result.greeks} />

            {/* Profit/Loss */}
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#d4a843]" /> سيناريوهات الربح والخسارة
              </h3>
              <div className="space-y-2">
                {result.profit_scenarios?.map((s, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#0f1623] rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-white">{s.scenario}</p>
                      <p className="text-[10px] text-[#64748b]">تغير السعر: {s.price_change}</p>
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-bold ${s.pnl?.startsWith("+") ? "text-[#10b981]" : s.pnl?.startsWith("-") ? "text-[#ef4444]" : "text-[#d4a843]"}`}>{s.pnl}</p>
                      <p className="text-[10px] text-[#64748b]">{s.probability}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-[#1e293b]">
                <div className="text-center">
                  <p className="text-[10px] text-[#64748b]">أقصى ربح</p>
                  <p className="text-sm font-bold text-[#10b981]">{result.max_profit}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-[#64748b]">أقصى خسارة</p>
                  <p className="text-sm font-bold text-[#ef4444]">{result.max_loss}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Strengths & Risks */}
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[#10b981] mb-3">✅ نقاط القوة</h3>
              <ul className="space-y-2">
                {result.strengths?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#94a3b8]">
                    <span className="text-[#10b981] mt-0.5">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[#ef4444] mb-3">⚠️ المخاطر</h3>
              <ul className="space-y-2">
                {result.risks?.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#94a3b8]">
                    <span className="text-[#ef4444] mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Summary */}
          {result.summary && (
            <div className="bg-[#151c2c] border border-[#d4a843]/20 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[#d4a843] mb-2">📋 الملخص التحليلي</h3>
              <p className="text-sm text-[#94a3b8] leading-relaxed">{result.summary}</p>
              <p className="text-xs text-[#64748b] mt-2">مصدر البيانات: سلسلة الخيارات الأمريكية</p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !result && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#151c2c] border border-[#1e293b] flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-[#d4a843]" />
          </div>
          <div>
            <p className="text-white font-bold">ابدأ بتحليل عقد أوبشن</p>
            <p className="text-xs text-[#64748b] mt-1">أدخل رمز السهم واختر إعدادات الأوبشن ثم اضغط تحليل</p>
          </div>
        </div>
      )}
    </div>
  );
}