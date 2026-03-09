import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getQuote, getBatchQuotes } from "@/components/api/marketDataClient";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import {
  Search, RefreshCw, Loader2, Brain, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Zap, Filter, ChevronUp, ChevronDown,
  Activity, BarChart3, Star, Eye, Sparkles, Clock, AlertCircle
} from "lucide-react";

// ─── Full Saudi & US stock lists ───────────────────────────────────────────
const SAUDI_STOCKS = [
  { symbol: "2222", name: "أرامكو السعودية", sector: "الطاقة" },
  { symbol: "1120", name: "مصرف الراجحي", sector: "البنوك" },
  { symbol: "2010", name: "سابك", sector: "البتروكيماويات" },
  { symbol: "7010", name: "الاتصالات السعودية", sector: "الاتصالات" },
  { symbol: "1180", name: "البنك الأهلي", sector: "البنوك" },
  { symbol: "2380", name: "بترو رابغ", sector: "الطاقة" },
  { symbol: "1211", name: "معادن", sector: "التعدين" },
  { symbol: "4200", name: "مجموعة الإتحاد", sector: "الاتصالات" },
  { symbol: "1010", name: "بنك الرياض", sector: "البنوك" },
  { symbol: "2330", name: "أدوا للنظافة", sector: "الخدمات" },
  { symbol: "4030", name: "تبوك للزراعة", sector: "الزراعة" },
  { symbol: "4190", name: "جرير", sector: "التجزئة" },
  { symbol: "8010", name: "تأمين سلامة", sector: "التأمين" },
  { symbol: "3010", name: "نماء", sector: "الأسمنت" },
  { symbol: "2350", name: "كيان للبتروكيماويات", sector: "البتروكيماويات" },
  { symbol: "1060", name: "بنك البلاد", sector: "البنوك" },
  { symbol: "7020", name: "موبايلي", sector: "الاتصالات" },
  { symbol: "7030", name: "زين السعودية", sector: "الاتصالات" },
  { symbol: "2082", name: "أحد الرافدين", sector: "الصناعة" },
  { symbol: "2381", name: "الحجر العربية", sector: "الصناعة" },
  { symbol: "4250", name: "جازان للتنمية", sector: "التطوير" },
  { symbol: "2050", name: "مجموعة صافولا", sector: "الأغذية" },
  { symbol: "4170", name: "أنس", sector: "التجزئة" },
  { symbol: "1150", name: "البنك الوطني", sector: "البنوك" },
  { symbol: "2084", name: "مياهنا", sector: "المياه" },
  { symbol: "6018", name: "الأثيرية الإلكترونية", sector: "التقنية" },
];

const US_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "التقنية" },
  { symbol: "MSFT", name: "Microsoft", sector: "التقنية" },
  { symbol: "NVDA", name: "NVIDIA", sector: "أشباه الموصلات" },
  { symbol: "TSLA", name: "Tesla", sector: "السيارات" },
  { symbol: "AMZN", name: "Amazon", sector: "التجزئة" },
  { symbol: "META", name: "Meta Platforms", sector: "التواصل الاجتماعي" },
  { symbol: "GOOGL", name: "Alphabet", sector: "التقنية" },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "أشباه الموصلات" },
  { symbol: "NFLX", name: "Netflix", sector: "الترفيه" },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "البنوك" },
  { symbol: "BAC", name: "Bank of America", sector: "البنوك" },
  { symbol: "V", name: "Visa Inc.", sector: "المدفوعات" },
  { symbol: "WMT", name: "Walmart", sector: "التجزئة" },
  { symbol: "DIS", name: "Disney", sector: "الترفيه" },
  { symbol: "INTC", name: "Intel", sector: "أشباه الموصلات" },
  { symbol: "COIN", name: "Coinbase", sector: "العملات الرقمية" },
  { symbol: "PLTR", name: "Palantir", sector: "البيانات الضخمة" },
  { symbol: "SOFI", name: "SoFi Technologies", sector: "التقنية المالية" },
  { symbol: "GME", name: "GameStop", sector: "التجزئة" },
  { symbol: "SPY", name: "S&P 500 ETF", sector: "مؤشرات" },
];

// ─── Market header stats ───────────────────────────────────────────────────
function MarketStat({ label, value, sub, up }) {
  return (
    <div className="flex flex-col min-w-[100px] px-3 py-1.5 border-l border-[#1e293b] first:border-l-0">
      <span className="text-[9px] text-[#64748b] uppercase font-medium">{label}</span>
      <span className={`text-xs font-black ${up ? "text-[#26a69a]" : up === false ? "text-[#ef5350]" : "text-white"}`}>{value}</span>
      {sub && <span className="text-[9px] text-[#64748b]">{sub}</span>}
    </div>
  );
}

// ─── AI Insight Panel ──────────────────────────────────────────────────────
function AiMarketInsight({ market, stocks }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setOpen(true);
    const loadedStocks = stocks.filter(s => s.price).slice(0, 10);
    const gainers = loadedStocks.filter(s => s.change_percent > 0).sort((a, b) => b.change_percent - a.change_percent).slice(0, 3);
    const losers = loadedStocks.filter(s => s.change_percent < 0).sort((a, b) => a.change_percent - b.change_percent).slice(0, 3);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `أنت محلل سوق مالي خبير. حلل وضع السوق ${market === "saudi" ? "السعودي (تداول)" : "الأمريكي"} اليوم.
أكثر الأسهم ارتفاعاً: ${gainers.map(s => `${s.symbol} +${s.change_percent?.toFixed(2)}%`).join(", ")}
أكثر الأسهم انخفاضاً: ${losers.map(s => `${s.symbol} ${s.change_percent?.toFixed(2)}%`).join(", ")}
قدم: 1- توجه السوق العام  2- أبرز 3 فرص  3- أبرز مخاطرة  4- توصية المتداول اليوم في جملة واحدة.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          market_trend: { type: "string" },
          trend_strength: { type: "number" },
          opportunities: { type: "array", items: { type: "string" } },
          risk: { type: "string" },
          daily_tip: { type: "string" },
          sentiment: { type: "string" }
        }
      }
    });
    setResult(res);
    setLoading(false);
  };

  const sentColor = result?.sentiment === "صاعد" ? "#26a69a" : result?.sentiment === "هابط" ? "#ef5350" : "#d4a843";

  return (
    <div>
      <button onClick={analyze} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4a843]/15 border border-[#d4a843]/40 text-[#d4a843] rounded-lg text-[11px] font-bold hover:bg-[#d4a843]/25 transition-all disabled:opacity-60">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
        تحليل ذكي للسوق
      </button>

      {open && (
        <div className="absolute top-12 left-2 w-72 bg-[#111827]/98 border border-[#d4a843]/30 rounded-xl shadow-2xl z-50 backdrop-blur-md">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e293b]">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#d4a843]" />
              <span className="text-xs font-bold text-[#d4a843]">تحليل السوق بالذكاء الاصطناعي</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#64748b] hover:text-white text-xs">✕</button>
          </div>
          <div className="p-3 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="w-7 h-7 text-[#d4a843] animate-spin" />
                <p className="text-xs text-[#64748b]">يحلل حركة السوق...</p>
              </div>
            ) : result ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#64748b]">توجه السوق</span>
                  <span className="text-sm font-black" style={{ color: sentColor }}>{result.sentiment} · {result.market_trend}</span>
                </div>
                {result.trend_strength && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[9px] text-[#64748b]">قوة الاتجاه</span>
                      <span className="text-[9px] text-white">{result.trend_strength}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${result.trend_strength}%`, backgroundColor: sentColor }} />
                    </div>
                  </div>
                )}
                {result.opportunities?.length > 0 && (
                  <div className="bg-[#0f1623] border border-emerald-500/20 rounded-lg p-2.5">
                    <p className="text-[9px] font-bold text-emerald-400 mb-1.5">الفرص</p>
                    {result.opportunities.map((op, i) => (
                      <p key={i} className="text-[10px] text-[#94a3b8] flex gap-1.5 mb-0.5">
                        <span className="text-emerald-400">✓</span>{op}
                      </p>
                    ))}
                  </div>
                )}
                {result.risk && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2">
                    <p className="text-[9px] font-bold text-red-400 mb-1">تحذير</p>
                    <p className="text-[10px] text-[#94a3b8]">{result.risk}</p>
                  </div>
                )}
                {result.daily_tip && (
                  <div className="bg-[#d4a843]/10 border border-[#d4a843]/20 rounded-lg p-2">
                    <p className="text-[9px] font-bold text-[#d4a843] mb-1">💡 نصيحة اليوم</p>
                    <p className="text-[10px] text-[#94a3b8]">{result.daily_tip}</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stock Row in table ────────────────────────────────────────────────────
function StockTableRow({ stock, onNavigate, aiSignals }) {
  const isUp = stock.change_percent >= 0;
  const aiSignal = aiSignals?.[stock.symbol];

  const signalColor = aiSignal === "شراء" ? "text-emerald-400" : aiSignal === "بيع" ? "text-red-400" : "text-[#64748b]";

  return (
    <tr
      className="border-b border-[#0a0e17] hover:bg-[#1a2235] cursor-pointer transition-colors group"
      onClick={() => onNavigate(stock)}
    >
      <td className="px-2 py-2 text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <div>
            <div className="text-[11px] font-black text-white group-hover:text-[#d4a843] transition-colors">{stock.symbol}</div>
            <div className="text-[9px] text-[#64748b] truncate max-w-[80px]">{stock.name}</div>
          </div>
        </div>
      </td>
      <td className={`px-2 py-2 text-center text-[11px] font-bold ${isUp ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
        {stock.price != null ? stock.price.toFixed(2) : <span className="text-[#374151]">—</span>}
      </td>
      <td className={`px-2 py-2 text-center text-[11px] font-bold ${isUp ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
        {stock.change != null ? (
          <span className="flex items-center justify-center gap-0.5">
            {isUp ? "▲" : "▼"} {Math.abs(stock.change_percent || 0).toFixed(2)}%
          </span>
        ) : <span className="text-[#374151]">—</span>}
      </td>
      <td className="px-2 py-2 text-center text-[10px] text-[#64748b]">
        {stock.open != null ? stock.open.toFixed(2) : "—"}
      </td>
      <td className="px-2 py-2 text-center text-[10px] text-[#26a69a]">
        {stock.high != null ? stock.high.toFixed(2) : "—"}
      </td>
      <td className="px-2 py-2 text-center text-[10px] text-[#ef5350]">
        {stock.low != null ? stock.low.toFixed(2) : "—"}
      </td>
      <td className="px-2 py-2 text-center text-[10px] text-[#64748b]">
        {stock.volume != null ? (stock.volume > 1e6 ? (stock.volume / 1e6).toFixed(2) + "M" : (stock.volume / 1e3).toFixed(0) + "K") : "—"}
      </td>
      <td className="px-2 py-2 text-center">
        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-center inline-block ${
          isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
        }`} style={{ minWidth: 36 }}>
          {stock.price != null ? (isUp ? "صاعد" : "هابط") : "—"}
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        {aiSignal ? (
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${signalColor} bg-current/10`}
            style={{ background: aiSignal === "شراء" ? "rgba(38,166,154,0.1)" : aiSignal === "بيع" ? "rgba(239,83,80,0.1)" : "transparent" }}>
            {aiSignal}
          </span>
        ) : (
          <span className="text-[#374151] text-[10px]">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <div className="w-16 h-5 overflow-hidden opacity-70">
          {stock.price != null && (
            <MiniSparkline up={isUp} />
          )}
        </div>
      </td>
    </tr>
  );
}

function MiniSparkline({ up }) {
  const points = Array.from({ length: 10 }, (_, i) => ({
    x: i * 16,
    y: 20 - Math.random() * 15 + (up ? (i * 0.5) : -(i * 0.5))
  }));
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg width="64" height="20" viewBox="0 0 144 20">
      <path d={d} fill="none" stroke={up ? "#26a69a" : "#ef5350"} strokeWidth="1.5" />
    </svg>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function MarketWatch() {
  const navigate = useNavigate();
  const [market, setMarket] = useState("saudi");
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("change_percent");
  const [sortDir, setSortDir] = useState("desc");
  const [aiSignals, setAiSignals] = useState({});
  const [generatingSignals, setGeneratingSignals] = useState(false);
  const [filterSector, setFilterSector] = useState("الكل");
  const [marketStats, setMarketStats] = useState({ up: 0, down: 0, unchanged: 0, totalVol: 0 });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const stockList = market === "saudi" ? SAUDI_STOCKS : US_STOCKS;

  // Load quotes in batches of 10 via batch API for speed
  const loadQuotes = useCallback(async (list, isRefresh = false) => {
    setLoading(true);
    setLoadedCount(0);
    const enriched = list.map(s => ({ ...s, price: null, change: null, change_percent: null, open: null, high: null, low: null, volume: null }));
    setStocks([...enriched]);

    const updated = [...enriched];
    let up = 0, down = 0, unchanged = 0, totalVol = 0;
    const BATCH_SIZE = 10;

    for (let batch = 0; batch < list.length; batch += BATCH_SIZE) {
      const chunk = list.slice(batch, batch + BATCH_SIZE);
      try {
        const symbolsStr = chunk.map(s => s.symbol);
        const quotes = await getBatchQuotes(symbolsStr, market);
        if (quotes) {
          chunk.forEach((s, j) => {
            const idx = batch + j;
            const q = quotes[s.symbol];
            if (q && q.price != null) {
              updated[idx] = { ...updated[idx], ...q };
              if (q.change_percent > 0) up++;
              else if (q.change_percent < 0) down++;
              else unchanged++;
              totalVol += q.volume || 0;
            }
          });
          setStocks([...updated]);
          setLoadedCount(Math.min(batch + BATCH_SIZE, list.length));
          setMarketStats({ up, down, unchanged, totalVol });
        }
      } catch (_) {
        // Fallback: load one by one
        for (let j = 0; j < chunk.length; j++) {
          try {
            const res = await base44.functions.invoke("marketData", { action: "quote", symbol: chunk[j].symbol, market });
            const q = res?.data;
            if (q && q.price != null && !q.error) {
              updated[batch + j] = { ...updated[batch + j], ...q };
              if (q.change_percent > 0) up++;
              else if (q.change_percent < 0) down++;
              else unchanged++;
              totalVol += q.volume || 0;
              setStocks([...updated]);
              setLoadedCount(batch + j + 1);
              setMarketStats({ up, down, unchanged, totalVol });
            }
          } catch (_) {}
        }
      }
    }

    setLastUpdate(new Date());
    setLoading(false);
    setLoadingMore(false);
  }, [market]);

  // Silent refresh: updates prices in-place without clearing data or showing loaders
  const silentRefresh = useCallback(async (list) => {
    const BATCH_SIZE = 10;
    for (let batch = 0; batch < list.length; batch += BATCH_SIZE) {
      const chunk = list.slice(batch, batch + BATCH_SIZE);
      try {
        const quotes = await getBatchQuotes(chunk.map(s => s.symbol), market);
        if (quotes) {
          setStocks(prev => {
            const next = [...prev];
            let up = 0, down = 0, unchanged = 0, totalVol = 0;
            chunk.forEach((s, j) => {
              const idx = batch + j;
              const q = quotes[s.symbol];
              if (q && q.price != null) {
                next[idx] = { ...next[idx], ...q };
              }
            });
            next.forEach(s => {
              if (s.price != null) {
                if (s.change_percent > 0) up++;
                else if (s.change_percent < 0) down++;
                else unchanged++;
                totalVol += s.volume || 0;
              }
            });
            setMarketStats({ up, down, unchanged, totalVol });
            return next;
          });
        }
      } catch (_) {}
    }
    setLastUpdate(new Date());
  }, [market]);

  useEffect(() => {
    loadQuotes(stockList, true);
    const iv = setInterval(() => silentRefresh(stockList), 1000);
    return () => clearInterval(iv);
  }, [market]);

  // AI signals for top stocks
  const generateAISignals = async () => {
    setGeneratingSignals(true);
    const loaded = stocks.filter(s => s.price).slice(0, 12);
    if (loaded.length === 0) { setGeneratingSignals(false); return; }

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `بناءً على هذه الأسهم وبيانات تغيرها اليومي، أعطِ إشارة فنية سريعة لكل سهم (شراء / بيع / انتظار):
${loaded.map(s => `${s.symbol}: سعر ${s.price?.toFixed(2)}, تغير ${s.change_percent?.toFixed(2)}%`).join("\n")}

أعد JSON يحتوي على مفتاح "signals" يكون قاموسًا من رمز السهم إلى الإشارة (شراء أو بيع أو انتظار فقط).`,
      response_json_schema: {
        type: "object",
        properties: {
          signals: { type: "object", additionalProperties: { type: "string" } }
        }
      }
    });
    if (res?.signals) setAiSignals(res.signals);
    setGeneratingSignals(false);
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const sectors = ["الكل", ...Array.from(new Set(stockList.map(s => s.sector)))];
  const filtered = stocks
    .filter(s => {
      const matchSearch = s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.includes(search);
      const matchSector = filterSector === "الكل" || s.sector === filterSector;
      return matchSearch && matchSector;
    })
    .sort((a, b) => {
      const va = a[sortCol] ?? (sortDir === "asc" ? Infinity : -Infinity);
      const vb = b[sortCol] ?? (sortDir === "asc" ? Infinity : -Infinity);
      return sortDir === "asc" ? va - vb : vb - va;
    });

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  };

  const upPct = stocks.length > 0 ? ((marketStats.up / Math.max(stocks.filter(s => s.price).length, 1)) * 100).toFixed(0) : 0;

  const handleNavigate = (stock) => {
    navigate(`${createPageUrl("StockAnalysis").split("?")[0]}?symbol=${stock.symbol}&market=${market}&name=${encodeURIComponent(stock.name)}`);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0e17] -m-4 md:-m-6 lg:-m-8">

      {/* ── TOP MARKET STATS BAR ─────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0d1117] border-b border-[#1e293b] flex items-stretch overflow-x-auto">
        <div className="flex items-center gap-0 flex-nowrap">
          <div className="flex items-center gap-1.5 px-3 py-2 border-l border-[#1e293b]">
            <div className={`w-2 h-2 rounded-full animate-pulse ${loading ? "bg-[#d4a843]" : "bg-emerald-400"}`} />
            <span className="text-[10px] font-bold text-white whitespace-nowrap">
              {market === "saudi" ? "سوق الأسهم السعودي" : "البورصة الأمريكية"}
            </span>
          </div>
          <MarketStat label="الصاعدة" value={marketStats.up} sub={`${upPct}%`} up={true} />
          <MarketStat label="الهابطة" value={marketStats.down} up={false} />
          <MarketStat label="بدون تغيير" value={marketStats.unchanged} />
          <MarketStat label="السيولة" value={marketStats.totalVol > 1e9 ? (marketStats.totalVol / 1e9).toFixed(2) + "B" : (marketStats.totalVol / 1e6).toFixed(0) + "M"} />
          {lastUpdate && <MarketStat label="آخر تحديث" value={lastUpdate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })} />}
          {loadedCount > 0 && loadedCount < stockList.length && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-l border-[#1e293b]">
              <Loader2 className="w-3 h-3 text-[#d4a843] animate-spin" />
              <span className="text-[10px] text-[#64748b]">{loadedCount}/{stockList.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── TOOLBAR ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#111827] border-b border-[#1e293b] flex items-center gap-2 px-3 py-2 flex-wrap relative">
        {/* Market toggle */}
        <div className="flex gap-1">
          <button onClick={() => setMarket("saudi")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${market === "saudi" ? "bg-[#d4a843] text-black" : "bg-[#1e293b] text-[#94a3b8] hover:text-white"}`}>
            🇸🇦 السوق السعودي
          </button>
          <button onClick={() => setMarket("us")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${market === "us" ? "bg-[#d4a843] text-black" : "bg-[#1e293b] text-[#94a3b8] hover:text-white"}`}>
            🇺🇸 الأمريكي
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748b]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث عن سهم..."
            className="bg-[#1e293b] border border-[#2d3748] rounded-lg pr-7 pl-3 py-1.5 text-[11px] text-white placeholder-[#64748b] outline-none focus:border-[#d4a843]/50 w-40" />
        </div>

        {/* Sector filter */}
        <select value={filterSector} onChange={e => setFilterSector(e.target.value)}
          className="bg-[#1e293b] border border-[#2d3748] rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#d4a843]/50">
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Refresh */}
        <button onClick={() => loadQuotes(stockList, true)} disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1e293b] border border-[#2d3748] text-[#94a3b8] rounded-lg text-[11px] font-bold hover:text-white disabled:opacity-50 transition-all">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          تحديث
        </button>

        {/* AI Signals */}
        <button onClick={generateAISignals} disabled={generatingSignals || stocks.filter(s => s.price).length === 0}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#d4a843]/15 border border-[#d4a843]/40 text-[#d4a843] rounded-lg text-[11px] font-bold hover:bg-[#d4a843]/25 disabled:opacity-50 transition-all">
          {generatingSignals ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          إشارات AI
        </button>

        {/* AI Market Analysis */}
        <AiMarketInsight market={market} stocks={stocks} />

        <div className="flex-1" />
        <span className="text-[10px] text-[#64748b]">{filtered.length} سهم</span>
      </div>

      {/* ── TABLE ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-right min-w-[800px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0d1117] border-b border-[#1e293b]">
              {[
                { key: null, label: "الرمز / الاسم", w: "w-36" },
                { key: "price", label: "السعر", w: "w-20" },
                { key: "change_percent", label: "التغيير%", w: "w-20" },
                { key: "open", label: "الافتتاح", w: "w-20" },
                { key: "high", label: "الأعلى", w: "w-20" },
                { key: "low", label: "الأدنى", w: "w-20" },
                { key: "volume", label: "الحجم", w: "w-20" },
                { key: null, label: "الحالة", w: "w-20" },
                { key: null, label: "AI", w: "w-16" },
                { key: null, label: "المسار", w: "w-16" },
              ].map((col, i) => (
                <th key={i}
                  className={`px-2 py-2 text-[10px] font-bold text-[#64748b] text-center ${col.w} ${col.key ? "cursor-pointer hover:text-[#d4a843] select-none" : ""}`}
                  onClick={() => col.key && handleSort(col.key)}>
                  {col.label} {col.key && <SortIcon col={col.key} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((stock) => (
              <StockTableRow key={stock.symbol} stock={stock} onNavigate={handleNavigate} aiSignals={aiSignals} />
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Activity className="w-12 h-12 text-[#1e293b]" />
            <p className="text-[#64748b]">لا توجد نتائج</p>
          </div>
        )}
      </div>

      {/* ── BOTTOM LEGEND ─────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0d1117] border-t border-[#1e293b] flex items-center gap-4 px-4 py-1.5 text-[9px]">
        <span className="flex items-center gap-1 text-[#26a69a]">■ صاعد</span>
        <span className="flex items-center gap-1 text-[#ef5350]">■ هابط</span>
        <span className="flex items-center gap-1 text-[#d4a843]">■ AI إشارة</span>
        <span className="flex-1" />
        <span className="text-[#64748b]">متابع السوق · مدعوم بالذكاء الاصطناعي · اضغط على أي سهم للتحليل الكامل</span>
      </div>
    </div>
  );
}