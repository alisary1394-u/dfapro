import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getSectorHeatmap, getFearGreed, getCorrelation } from "@/components/api/marketDataClient";
import MarketOverviewBar from "@/components/ui/MarketOverviewBar";
import {
  Grid3X3, TrendingUp, TrendingDown, Activity, Flame, BarChart3,
  ArrowUpRight, ArrowDownRight, RefreshCw, Gauge, Link2, Loader2
} from "lucide-react";
import {
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

const getChangeColor = (change) => {
  if (change >= 3) return "bg-emerald-500";
  if (change >= 1.5) return "bg-emerald-600";
  if (change >= 0.5) return "bg-emerald-700";
  if (change > 0) return "bg-emerald-800";
  if (change === 0) return "bg-slate-700";
  if (change > -0.5) return "bg-red-800";
  if (change > -1.5) return "bg-red-700";
  if (change > -3) return "bg-red-600";
  return "bg-red-500";
};

const getTextColor = (change) => {
  if (change > 0) return "text-emerald-400";
  if (change < 0) return "text-red-400";
  return "text-slate-400";
};

const FearGreedGauge = ({ data }) => {
  if (!data) return null;
  const angle = (data.score / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-5 h-5 text-[#d4a843]" />
        <h3 className="text-lg font-bold text-white">مؤشر الخوف والطمع</h3>
      </div>

      <div className="flex flex-col items-center">
        {/* Gauge visual */}
        <div className="relative w-48 h-28 mb-4">
          <svg viewBox="0 0 200 110" className="w-full h-full">
            {/* Background arc */}
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1a2540" strokeWidth="14" strokeLinecap="round" />
            {/* Colored arc segments */}
            <path d="M 20 100 A 80 80 0 0 1 52 45" fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" />
            <path d="M 52 45 A 80 80 0 0 1 84 25" fill="none" stroke="#f97316" strokeWidth="14" strokeLinecap="round" />
            <path d="M 84 25 A 80 80 0 0 1 116 25" fill="none" stroke="#eab308" strokeWidth="14" strokeLinecap="round" />
            <path d="M 116 25 A 80 80 0 0 1 148 45" fill="none" stroke="#84cc16" strokeWidth="14" strokeLinecap="round" />
            <path d="M 148 45 A 80 80 0 0 1 180 100" fill="none" stroke="#22c55e" strokeWidth="14" strokeLinecap="round" />
            {/* Needle */}
            <line
              x1="100" y1="100"
              x2={100 + 65 * Math.cos((angle * Math.PI) / 180)}
              y2={100 - 65 * Math.sin((angle * Math.PI) / 180)}
              stroke="white" strokeWidth="2.5" strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="5" fill="white" />
          </svg>
        </div>

        <div className="text-center">
          <span className="text-4xl font-black" style={{ color: data.color }}>{data.score}</span>
          <p className="text-lg font-bold mt-1" style={{ color: data.color }}>{data.label}</p>
        </div>
      </div>

      {/* Components */}
      <div className="mt-4 space-y-2">
        {Object.values(data.components || {}).map((comp, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{comp.label}</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-[#1a2540] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${comp.score}%`,
                    backgroundColor: comp.score >= 60 ? '#22c55e' : comp.score >= 40 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
              <span className="text-xs font-mono text-slate-300 w-7 text-left">{comp.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CorrelationMatrix = ({ data }) => {
  if (!data?.symbols?.length) return null;

  const getCorrelationColor = (corr) => {
    if (corr >= 0.8) return "bg-emerald-500/80";
    if (corr >= 0.5) return "bg-emerald-700/60";
    if (corr >= 0.2) return "bg-emerald-900/40";
    if (corr >= -0.2) return "bg-slate-700/40";
    if (corr >= -0.5) return "bg-red-900/40";
    if (corr >= -0.8) return "bg-red-700/60";
    return "bg-red-500/80";
  };

  return (
    <div className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-5 h-5 text-[#d4a843]" />
        <h3 className="text-lg font-bold text-white">مصفوفة الارتباط</h3>
        <span className="text-xs text-slate-500">({data.period})</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1 text-slate-500"></th>
              {data.symbols.map(s => (
                <th key={s} className="p-1 text-slate-300 font-mono text-center">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.symbols.map(s1 => (
              <tr key={s1}>
                <td className="p-1 text-slate-300 font-mono font-bold">{s1}</td>
                {data.symbols.map(s2 => {
                  const corr = data.matrix?.[s1]?.[s2] ?? 0;
                  return (
                    <td key={s2} className="p-1 text-center">
                      <div className={`rounded px-1.5 py-1 ${getCorrelationColor(corr)} text-white font-mono`}>
                        {corr.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.insights?.length > 0 && (
        <div className="mt-4 space-y-1">
          {data.insights.map((ins, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={ins.correlation > 0 ? 'text-emerald-400' : 'text-red-400'}>●</span>
              <span className="text-slate-300">{ins.pair}: {ins.type}</span>
              <span className="font-mono text-slate-500">({ins.correlation.toFixed(2)})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function SectorHeatmap() {
  const navigate = useNavigate();
  const [market, setMarket] = useState("saudi");
  const [heatmapData, setHeatmapData] = useState(null);
  const [fearGreed, setFearGreed] = useState(null);
  const [correlationData, setCorrelationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [correlationSymbols, setCorrelationSymbols] = useState("");
  const [loadingCorrelation, setLoadingCorrelation] = useState(false);

  const defaultCorrelationSymbols = {
    saudi: "2222,1120,2010,7010,1180",
    us: "AAPL,MSFT,NVDA,GOOGL,TSLA",
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCorrelationSymbols(defaultCorrelationSymbols[market]);

    Promise.all([
      getSectorHeatmap(market).catch(() => null),
      getFearGreed().catch(() => null),
      getCorrelation(defaultCorrelationSymbols[market].split(','), market).catch(() => null),
    ]).then(([sectors, fg, corr]) => {
      if (cancelled) return;
      setHeatmapData(sectors);
      setFearGreed(fg);
      setCorrelationData(corr);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [market]);

  const fetchCorrelation = async () => {
    const syms = correlationSymbols.split(',').map(s => s.trim()).filter(Boolean);
    if (syms.length < 2) return;
    setLoadingCorrelation(true);
    try {
      const data = await getCorrelation(syms, market);
      setCorrelationData(data);
    } catch {}
    setLoadingCorrelation(false);
  };

  const handleStockClick = (symbol) => {
    navigate(createPageUrl("StockAnalysis") + `?symbol=${symbol}&market=${market}`);
  };

  const sectorBarData = heatmapData?.sectors?.map(s => ({
    name: s.sector,
    change: s.change,
    fill: s.change >= 0 ? '#10b981' : '#ef4444',
  })) || [];

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <MarketOverviewBar />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#d4a843]/20 to-[#d4a843]/5 border border-[#d4a843]/20">
              <Grid3X3 className="w-6 h-6 text-[#d4a843]" />
            </div>
            خريطة القطاعات الحرارية
          </h1>
          <p className="text-sm text-slate-400 mt-1">تحليل أداء القطاعات والأسهم مع مؤشر الخوف والطمع ومصفوفة الارتباط</p>
        </div>
        <div className="flex gap-2">
          {[
            { key: "saudi", label: "السوق السعودي" },
            { key: "us", label: "السوق الأمريكي" },
          ].map(m => (
            <button
              key={m.key}
              onClick={() => setMarket(m.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                market === m.key
                  ? "bg-[#d4a843] text-[#0f172a]"
                  : "bg-[#0d1420] border border-[#1a2540] text-slate-300 hover:border-[#d4a843]/40"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#d4a843] animate-spin" />
            <p className="text-slate-400 text-sm">جاري تحليل القطاعات...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Fear & Greed + Sector Performance Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <FearGreedGauge data={fearGreed} />

            <div className="lg:col-span-2 bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-[#d4a843]" />
                <h3 className="text-lg font-bold text-white">أداء القطاعات</h3>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sectorBarData} layout="vertical" margin={{ right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                  <Tooltip
                    contentStyle={{ background: '#0d1420', border: '1px solid #1a2540', borderRadius: '12px', direction: 'rtl' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(v) => [`${Number(v).toFixed(2)}%`, 'التغيير']}
                  />
                  <Bar dataKey="change" radius={[0, 4, 4, 0]}>
                    {sectorBarData.map((entry, i) => (
                      <rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sector Heatmap Grid */}
          <div className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-[#d4a843]" />
              <h3 className="text-lg font-bold text-white">الخريطة الحرارية</h3>
              <div className="flex-1" />
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <span className="w-4 h-3 rounded bg-red-500 inline-block" /> هبوط
                <span className="w-4 h-3 rounded bg-slate-700 inline-block mx-1" /> ثبات
                <span className="w-4 h-3 rounded bg-emerald-500 inline-block" /> صعود
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {heatmapData?.sectors?.map((sector) => (
                <div key={sector.sector} className="space-y-2">
                  <div className={`rounded-xl p-3 ${getChangeColor(sector.change)} transition-all`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{sector.sector}</span>
                      <span className={`text-sm font-mono font-bold ${sector.change >= 0 ? 'text-white' : 'text-red-200'}`}>
                        {sector.change >= 0 ? '+' : ''}{sector.change}%
                      </span>
                    </div>
                    <p className="text-[10px] text-white/60 mt-0.5">{sector.stock_count} أسهم</p>
                  </div>

                  <div className="space-y-1">
                    {sector.stocks?.map((stock) => (
                      <button
                        key={stock.symbol}
                        onClick={() => handleStockClick(stock.symbol)}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1a2540] transition-all text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {stock.change > 0 ? (
                            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                          ) : stock.change < 0 ? (
                            <ArrowDownRight className="w-3 h-3 text-red-400" />
                          ) : (
                            <Activity className="w-3 h-3 text-slate-500" />
                          )}
                          <span className="text-white font-medium">{stock.symbol}</span>
                          <span className="text-slate-500 truncate max-w-[80px]">{stock.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 font-mono">{stock.price}</span>
                          <span className={`font-mono font-bold ${getTextColor(stock.change)}`}>
                            {stock.change >= 0 ? '+' : ''}{stock.change}%
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Correlation Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="w-5 h-5 text-[#d4a843]" />
                  <h3 className="text-sm font-bold text-white">تحليل الارتباط المخصص</h3>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  أدخل رموز الأسهم مفصولة بفواصل لحساب مصفوفة الارتباط بينها
                </p>
                <div className="flex gap-2">
                  <input
                    value={correlationSymbols}
                    onChange={(e) => setCorrelationSymbols(e.target.value)}
                    placeholder="AAPL,MSFT,NVDA"
                    className="flex-1 rounded-xl bg-[#111827] border border-[#1a2540] px-3 py-2 text-sm text-white font-mono outline-none focus:border-[#d4a843]/40"
                    dir="ltr"
                  />
                  <button
                    onClick={fetchCorrelation}
                    disabled={loadingCorrelation}
                    className="px-4 py-2 rounded-xl bg-[#d4a843] text-[#0f172a] text-sm font-bold disabled:opacity-60 flex items-center gap-1"
                  >
                    {loadingCorrelation ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    تحليل
                  </button>
                </div>
              </div>
              <CorrelationMatrix data={correlationData} />
            </div>

            {/* Market Summary Insights */}
            <div className="bg-[#0d1420] border border-[#1a2540] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-[#d4a843]" />
                <h3 className="text-lg font-bold text-white">ملخص تحليلي</h3>
              </div>

              <div className="space-y-4">
                {/* Best & Worst Sectors */}
                {heatmapData?.sectors?.length > 0 && (
                  <>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold mb-1">
                        <TrendingUp className="w-4 h-4" /> أفضل قطاع
                      </div>
                      <p className="text-white text-lg font-bold">{heatmapData.sectors[0].sector}</p>
                      <p className="text-emerald-400 font-mono text-sm">+{heatmapData.sectors[0].change}%</p>
                    </div>

                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-1">
                        <TrendingDown className="w-4 h-4" /> أسوأ قطاع
                      </div>
                      <p className="text-white text-lg font-bold">{heatmapData.sectors[heatmapData.sectors.length - 1].sector}</p>
                      <p className="text-red-400 font-mono text-sm">{heatmapData.sectors[heatmapData.sectors.length - 1].change}%</p>
                    </div>
                  </>
                )}

                {/* Fear & Greed Summary */}
                {fearGreed && (
                  <div className="p-3 rounded-xl bg-[#111827] border border-[#1a2540]">
                    <div className="flex items-center gap-2 text-sm font-bold mb-1" style={{ color: fearGreed.color }}>
                      <Gauge className="w-4 h-4" /> مؤشر الخوف والطمع
                    </div>
                    <p className="text-white text-lg font-bold">{fearGreed.label} ({fearGreed.score}/100)</p>
                    <p className="text-slate-400 text-xs mt-1">
                      {fearGreed.score >= 60
                        ? 'السوق في حالة طمع - كن حذراً من المبالغة في الشراء'
                        : fearGreed.score >= 40
                        ? 'السوق في حالة توازن - فرص انتقائية'
                        : 'السوق في حالة خوف - قد تكون هناك فرص شراء'}
                    </p>
                  </div>
                )}

                {/* Overall Market Stats */}
                {heatmapData?.sectors && (
                  <div className="p-3 rounded-xl bg-[#111827] border border-[#1a2540]">
                    <div className="flex items-center gap-2 text-[#d4a843] text-sm font-bold mb-2">
                      <BarChart3 className="w-4 h-4" /> إحصائيات
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">قطاعات صاعدة</span>
                        <p className="text-emerald-400 font-bold">{heatmapData.sectors.filter(s => s.change > 0).length}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">قطاعات هابطة</span>
                        <p className="text-red-400 font-bold">{heatmapData.sectors.filter(s => s.change < 0).length}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">متوسط التغيير</span>
                        <p className="text-white font-bold">
                          {(heatmapData.sectors.reduce((s, x) => s + x.change, 0) / heatmapData.sectors.length).toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">إجمالي الأسهم</span>
                        <p className="text-white font-bold">
                          {heatmapData.sectors.reduce((s, x) => s + x.stock_count, 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
