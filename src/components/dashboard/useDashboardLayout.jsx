import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export const ALL_WIDGETS = [
  { id: "market_overview",   label: "نظرة عامة على السوق",  icon: "📊", defaultEnabled: true,  defaultOrder: 0 },
  { id: "live_rates",        label: "أسعار حية",             icon: "💱", defaultEnabled: true,  defaultOrder: 1 },
  { id: "quick_stats",       label: "إحصائيات سريعة",        icon: "⚡", defaultEnabled: true,  defaultOrder: 2 },
  { id: "ai_insights",       label: "رؤى الذكاء الاصطناعي", icon: "🧠", defaultEnabled: true,  defaultOrder: 3 },
  { id: "volume_chart",      label: "حجم التداول الشهري",    icon: "📈", defaultEnabled: true,  defaultOrder: 4 },
  { id: "sentiment",         label: "مشاعر السوق",           icon: "🎯", defaultEnabled: true,  defaultOrder: 5 },
  { id: "top_gainers",       label: "الأكثر ارتفاعاً",       icon: "🔥", defaultEnabled: true,  defaultOrder: 6 },
  { id: "top_losers",        label: "الأكثر انخفاضاً",       icon: "📉", defaultEnabled: true,  defaultOrder: 7 },
  { id: "next_session",      label: "توقعات الجلسة القادمة", icon: "🔮", defaultEnabled: true,  defaultOrder: 8 },
  { id: "sector_performance",label: "أداء القطاعات",          icon: "🏭", defaultEnabled: true,  defaultOrder: 9 },
];

const DEFAULT_LAYOUT = ALL_WIDGETS.map(w => ({
  id: w.id,
  enabled: w.defaultEnabled,
  order: w.defaultOrder,
}));

const DEFAULT_MARKET = "saudi";

export function useDashboardLayout() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [market, setMarket] = useState(DEFAULT_MARKET);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        if (user?.dashboard_layout) {
          // Merge saved layout with any new widgets
          const saved = user.dashboard_layout;
          const merged = ALL_WIDGETS.map(w => {
            const found = saved.find(s => s.id === w.id);
            return found || { id: w.id, enabled: w.defaultEnabled, order: w.defaultOrder };
          });
          merged.sort((a, b) => a.order - b.order);
          setLayout(merged);
        }
        if (user?.dashboard_market) {
          setMarket(user.dashboard_market);
        }
      } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  const saveLayout = async (newLayout, newMarket) => {
    try {
      await base44.auth.updateMe({
        dashboard_layout: newLayout,
        dashboard_market: newMarket ?? market,
      });
    } catch (_) {}
  };

  const updateLayout = (newLayout) => {
    setLayout(newLayout);
    saveLayout(newLayout, market);
  };

  const updateMarket = (newMarket) => {
    setMarket(newMarket);
    saveLayout(layout, newMarket);
  };

  const toggleWidget = (id) => {
    const updated = layout.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
    updateLayout(updated);
  };

  const moveWidget = (id, direction) => {
    const sorted = [...layout].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(w => w.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const newSorted = [...sorted];
    [newSorted[idx], newSorted[swapIdx]] = [newSorted[swapIdx], newSorted[idx]];
    const updated = newSorted.map((w, i) => ({ ...w, order: i }));
    updateLayout(updated);
  };

  const orderedEnabled = [...layout].sort((a, b) => a.order - b.order);

  return { layout: orderedEnabled, market, loaded, toggleWidget, moveWidget, updateMarket };
}