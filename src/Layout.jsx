import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StockSidebar from "@/components/layout/StockSidebar";
import MarketOverviewBar from "@/components/ui/MarketOverviewBar";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard, Brain, Radar, Briefcase, Star, GitCompare,
  Bell, Zap, Menu, X, TrendingUp, Building2, Newspaper,
  Wallet, BarChart3, Activity, ChevronDown, ChevronUp,
  Sparkles, Shield, LineChart, Target, BookOpen,
  LogOut, Clock, AlertTriangle, Grid3X3
} from "lucide-react";

const navGroups = [
  {
    label: "الرئيسية",
    items: [
      { name: "لوحة التحكم", icon: LayoutDashboard, page: "Dashboard" },
    ]
  },
  {
    label: "الأسواق",
    items: [
      { name: "لوحة الرسم البياني", icon: BarChart3, page: "ChartBoard" },
      { name: "متابع السوق", icon: Activity, page: "MarketWatch" },
      { name: "خريطة القطاعات", icon: Grid3X3, page: "SectorHeatmap" },
    ]
  },
  {
    label: "التحليل",
    items: [
      { name: "تحليل سهم", icon: Brain, page: "StockAnalysis" },
      { name: "تحليل أوبشن", icon: Target, page: "OptionsAnalysis" },
      { name: "مقارنة الأسهم", icon: GitCompare, page: "Compare" },
      { name: "أخبار وتحليل المشاعر", icon: Newspaper, page: "StockNews" },
    ]
  },
  {
    label: "الفرص",
    items: [
      { name: "رادار الفرص", icon: Radar, page: "OpportunityRadar" },
      { name: "ماسح الفرص", icon: LineChart, page: "Screener" },
    ]
  },
  {
    label: "المحفظة",
    items: [
      { name: "المحفظة", icon: Briefcase, page: "Portfolio" },
      { name: "المحفظة الافتراضية", icon: Wallet, page: "VirtualPortfolio" },
      { name: "قائمة المراقبة", icon: Star, page: "Watchlist" },
    ]
  },
  {
    label: "الأدوات",
    items: [
      { name: "التنبيهات", icon: Bell, page: "Alerts" },
      { name: "بوت التداول", icon: Zap, page: "TradingBot" },
      { name: "إدارة الوسيط", icon: Building2, page: "BrokerManager" },
    ]
  },
];

function NavGroup({ group, currentPageName, onNavigate, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasActive = group.items.some(i => i.page === currentPageName);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-black text-[#94a3b8] hover:text-white transition-colors tracking-wide"
      >
        <span>{group.label}</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {group.items.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={onNavigate}
                className={`
                  relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group
                  ${isActive
                    ? 'bg-gradient-to-l from-[#d4a843]/15 via-[#d4a843]/8 to-transparent text-[#e8c76a] border border-[#d4a843]/25 shadow-sm shadow-[#d4a843]/10'
                    : 'text-[#64748b] hover:text-[#cbd5e1] hover:bg-[#1e293b]/60'
                  }
                `}
              >
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-[#d4a843] to-[#b8922f] rounded-full" />
                )}
                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#d4a843]' : 'group-hover:text-[#94a3b8]'}`} />
                <span className="text-xs font-medium leading-none">{item.name}</span>
                {isActive && (
                  <div className="mr-auto flex items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d4a843] animate-pulse" />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { logout, idleWarning, idleSecondsLeft, resetIdleTimer } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = currentTime.toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div dir="rtl" className="min-h-screen bg-[#070b12] text-white font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap');
        :root {
          --gold: #d4a843; --gold-light: #e8c76a; --gold-dark: #b8922f;
          --bg-primary: #070b12; --bg-secondary: #0d1420; --bg-card: #111827;
          --bg-card-hover: #141d2e; --border-color: #1a2540;
          --text-primary: #e2e8f0; --text-secondary: #64748b;
          --green: #10b981; --red: #ef4444; --blue: #3b82f6;
          --sidebar-w: 17rem;
        }
        * { scrollbar-width: thin; scrollbar-color: #1a2540 transparent; }
        *::-webkit-scrollbar { width: 4px; height: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background-color: #1a2540; border-radius: 4px; }
        *::-webkit-scrollbar-thumb:hover { background-color: #243050; }
        body, .font-sans { font-family: 'Tajawal', system-ui, sans-serif !important; }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, transparent, rgba(212,168,67,0.08), transparent);
          background-size: 200% 100%; animation: shimmer 2.5s infinite;
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .glow-dot { animation: glow-pulse 2s ease-in-out infinite; }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.35s ease-out forwards; }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in-right 0.3s ease-out forwards; }
        .glass {
          background: rgba(13, 20, 32, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .sidebar-glow {
          box-shadow: -4px 0 40px rgba(212,168,67,0.04), -1px 0 0 #1a2540;
        }
        .gold-text {
          background: linear-gradient(135deg, #d4a843 0%, #e8c76a 50%, #b8922f 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .card-hover {
          transition: all 0.2s ease;
        }
        .card-hover:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
      `}</style>

      {/* ── Desktop Top Bar ── */}
      <div className="hidden lg:flex fixed top-0 z-40 items-center" style={{ right: 'var(--sidebar-w)', left: ['StockAnalysis', 'OptionsAnalysis', 'Compare', 'StockNews'].includes(currentPageName) ? '12rem' : '0', height: '48px' }}>
        <div className="w-full h-full glass border-b border-[#1a2540] px-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <MarketOverviewBar compact />
          </div>
          <div className="shrink-0 flex items-center gap-2 text-xs text-[#475569] border-r border-[#1a2540] pr-3 mr-1">
            <span className="text-[#64748b]">{dateStr}</span>
            <span className="font-bold text-[#94a3b8]">{timeStr}</span>
          </div>
        </div>
      </div>

      {/* ── Mobile Header ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-[#1a2540] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-[#1a2540] rounded-xl transition-all active:scale-95"
          aria-label="فتح القائمة"
        >
          <Menu className="w-5 h-5 text-[#94a3b8]" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#d4a843] to-[#b8922f] flex items-center justify-center shadow-md shadow-[#d4a843]/20">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold gold-text">محلل الأسهم Pro</span>
        </div>
        <div className="w-9" />
      </div>

      {/* ── Mobile Overlay ── */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main Sidebar ── */}
      <aside className={`
        fixed top-0 right-0 z-50 flex flex-col
        w-[17rem] h-full glass sidebar-glow
        transform transition-transform duration-300 ease-out will-change-transform
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1a2540]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#d4a843] via-[#c9993a] to-[#b8922f] flex items-center justify-center shadow-lg shadow-[#d4a843]/25">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d1420] glow-dot" />
              </div>
              <div>
                <h1 className="text-base font-black gold-text leading-tight">محلل الأسهم</h1>
                <p className="text-[10px] text-[#475569] font-medium mt-0.5 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-[#d4a843]" />
                  مدعوم بالذكاء الاصطناعي
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 hover:bg-[#1a2540] rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-[#64748b]" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
          {navGroups.map((group, i) => (
            <NavGroup
              key={group.label}
              group={group}
              currentPageName={currentPageName}
              onNavigate={() => setSidebarOpen(false)}
              defaultOpen={true}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-[#1a2540]">
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-[#d4a843]/10 via-[#111827] to-[#b8922f]/5 border border-[#d4a843]/20">
            <div className="absolute inset-0 shimmer" />
            <div className="relative flex items-start gap-3">
              <Shield className="w-4 h-4 text-[#d4a843] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#d4a843] mb-0.5">بيانات محلية آمنة</p>
                <p className="text-[10px] text-[#475569] leading-relaxed">جميع بياناتك محفوظة محلياً على جهازك</p>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#64748b] hover:text-red-400 hover:bg-red-900/10 rounded-xl transition-all group"
          >
            <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors" />
            <span>تسجيل الخروج</span>
          </button>
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[10px] text-[#334155]">v2.0 Pro</span>
            <span className="text-[10px] text-[#334155]">السوق السعودي · الأمريكي</span>
          </div>
        </div>
      </aside>

      {/* ── Stock Sidebar (desktop only, analysis pages) ── */}
      {['StockAnalysis', 'OptionsAnalysis', 'Compare', 'StockNews'].includes(currentPageName) && (
        <div className="hidden lg:block">
          <StockSidebar currentPageName={currentPageName} />
        </div>
      )}

      {/* ── Idle Warning Toast ── */}
      {idleWarning && (
        <div className="fixed bottom-5 left-5 z-[999] flex items-center gap-3 bg-[#1a1200]/95 border border-amber-600/50 text-amber-100 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-lg animate-fade-in-up" dir="rtl">
          <div className="flex items-center gap-2 text-amber-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-300">سيتم تسجيل خروجك تلقائياً</p>
            <p className="text-xs text-amber-500 mt-0.5">بسبب عدم النشاط — متبقي <span className="font-mono font-bold text-amber-300">{idleSecondsLeft}ث</span></p>
          </div>
          <button
            onClick={resetIdleTimer}
            className="mr-1 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors shrink-0"
          >
            استمر
          </button>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-xs font-bold border border-amber-700/50 text-amber-400 hover:text-amber-300 rounded-xl transition-colors shrink-0"
          >
            خروج الآن
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className={`lg:mr-[17rem] min-h-screen pt-14 lg:pt-12 ${['StockAnalysis', 'OptionsAnalysis', 'Compare', 'StockNews'].includes(currentPageName) ? 'lg:ml-48' : 'lg:ml-0'}`}>
        <div className="p-4 md:p-5 lg:p-7 animate-fade-in-up">
          {children}
        </div>
      </main>
    </div>
  );
}