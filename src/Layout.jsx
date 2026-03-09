import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StockSidebar from "@/components/layout/StockSidebar";
import {
  LayoutDashboard,
  Search,
  Brain,
  Radar,
  Briefcase,
  Star,
  GitCompare,
  Bell,
  Zap,
  Menu,
  X,
  TrendingUp,
  ChevronLeft,
  Building2,
  Newspaper,
  Wallet,
  BarChart3,
  Activity
} from "lucide-react";

const navItems = [
  { name: "لوحة التحكم", icon: LayoutDashboard, page: "Dashboard" },
  { name: "لوحة الرسم البياني", icon: BarChart3, page: "ChartBoard" },
  { name: "متابع السوق", icon: Activity, page: "MarketWatch" },
  { name: "تحليل سهم", icon: Brain, page: "StockAnalysis" },
  { name: "تحليل أوبشن", icon: TrendingUp, page: "OptionsAnalysis" },
  { name: "رادار الفرص", icon: Radar, page: "OpportunityRadar" },
  { name: "المحفظة", icon: Briefcase, page: "Portfolio" },
  { name: "قائمة المراقبة", icon: Star, page: "Watchlist" },
  { name: "المقارنة", icon: GitCompare, page: "Compare" },
  { name: "التنبيهات", icon: Bell, page: "Alerts" },
  { name: "المحفظة الافتراضية", icon: Wallet, page: "VirtualPortfolio" },
  { name: "أخبار وتحليل المشاعر", icon: Newspaper, page: "StockNews" },
  { name: "بوت التداول", icon: Zap, page: "TradingBot" },
  { name: "ماسح الفرص", icon: Radar, page: "Screener" },
  { name: "إدارة الوسيط", icon: Building2, page: "BrokerManager" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a0e17] text-white font-sans">
      <style>{`
        :root {
          --gold: #d4a843;
          --gold-light: #e8c76a;
          --gold-dark: #b8922f;
          --bg-primary: #0a0e17;
          --bg-secondary: #111827;
          --bg-card: #151c2c;
          --bg-card-hover: #1a2235;
          --border-color: #1e293b;
          --text-primary: #f1f5f9;
          --text-secondary: #94a3b8;
          --green: #10b981;
          --red: #ef4444;
          --blue: #3b82f6;
        }
        * { scrollbar-width: thin; scrollbar-color: #1e293b transparent; }
        *::-webkit-scrollbar { width: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background-color: #1e293b; border-radius: 3px; }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, transparent, rgba(212,168,67,0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,168,67,0.3); }
          50% { box-shadow: 0 0 20px 5px rgba(212,168,67,0.1); }
        }
      `}</style>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#111827]/95 backdrop-blur-xl border-b border-[#1e293b] px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-[#1e293b] rounded-xl transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#d4a843]" />
          <span className="text-lg font-bold bg-gradient-to-l from-[#d4a843] to-[#e8c76a] bg-clip-text text-transparent">محلل الأسهم</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 right-0 h-full w-72 bg-[#111827]/95 backdrop-blur-xl border-l border-[#1e293b] z-50
        transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="p-6 border-b border-[#1e293b]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4a843] to-[#b8922f] flex items-center justify-center shadow-lg shadow-[#d4a843]/20">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-l from-[#d4a843] to-[#e8c76a] bg-clip-text text-transparent">محلل الأسهم</h1>
                <p className="text-xs text-[#94a3b8]">تحليل ذكي متقدم</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-[#1e293b] rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive
                    ? 'bg-gradient-to-l from-[#d4a843]/20 to-transparent text-[#e8c76a] border border-[#d4a843]/30'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#1e293b]'
                  }
                `}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-[#d4a843]' : ''}`} />
                <span className="text-sm font-medium">{item.name}</span>
                {isActive && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-[#d4a843]" />}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#1e293b]">
          <div className="bg-gradient-to-l from-[#d4a843]/10 to-[#b8922f]/5 rounded-xl p-4 border border-[#d4a843]/20">
            <p className="text-xs text-[#d4a843] font-medium mb-1">تحليل مدعوم بالذكاء الاصطناعي</p>
            <p className="text-xs text-[#94a3b8]">تحليل فني وأساسي متقدم للسوق السعودي والأمريكي</p>
          </div>
        </div>
      </aside>

      {/* Stock Sidebar - only on desktop */}
      <div className="hidden lg:block">
        <StockSidebar currentPageName={currentPageName} />
      </div>

      {/* Main Content */}
      <main className="lg:mr-72 lg:ml-48 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}