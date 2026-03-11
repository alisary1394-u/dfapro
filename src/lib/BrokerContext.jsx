/**
 * BrokerContext – Global broker connection manager.
 * 
 * - Auto-reconnects on app start using saved credentials
 * - Sets the module-level brokerState singleton so marketDataClient routes correctly
 * - Exposes broker status to all pages via useBroker() hook
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setBroker, clearBroker } from '@/lib/brokerState';
import {
  connectAlpaca,
  disconnectAlpaca,
  getAlpacaStatus,
  alpacaConfig,
} from '@/components/api/alpacaClient';
import {
  connectToGateway,
  getConnectionStatus,
  ibkrConfig,
} from '@/components/api/ibkrClient';

const BrokerContext = createContext(null);

export function BrokerProvider({ children }) {
  const [broker, setBrokerState] = useState({
    active: null,        // 'alpaca' | 'ibkr' | null
    alpacaConnected: false,
    alpacaPaper: true,
    ibkrConnected: false,
    loading: true,
  });

  const setAlpacaActive = useCallback((connected, paper) => {
    setBrokerState(prev => ({ ...prev, alpacaConnected: connected, alpacaPaper: paper ?? prev.alpacaPaper, active: connected ? 'alpaca' : (prev.ibkrConnected ? 'ibkr' : null), loading: false }));
    if (connected) setBroker('alpaca');
    else if (!broker.ibkrConnected) clearBroker();
  }, [broker.ibkrConnected]);

  const setIbkrActive = useCallback((connected) => {
    setBrokerState(prev => ({ ...prev, ibkrConnected: connected, active: connected ? 'ibkr' : (prev.alpacaConnected ? 'alpaca' : null), loading: false }));
    if (connected) { if (!broker.alpacaConnected) setBroker('ibkr'); }
    else if (!broker.alpacaConnected) clearBroker();
  }, [broker.alpacaConnected]);

  // ── Auto-connect on mount ──
  useEffect(() => {
    let cancelled = false;

    const tryAlpaca = async () => {
      try {
        const status = await getAlpacaStatus();
        if (cancelled) return;
        if (status.connected) {
          const saved = alpacaConfig.getConfig();
          setBroker('alpaca');
          setBrokerState(prev => ({ ...prev, alpacaConnected: true, alpacaPaper: saved?.paper !== false, active: 'alpaca', loading: false }));
          return;
        }
      } catch { /* not connected */ }

      // Try reconnect with saved keys
      const saved = alpacaConfig.getConfig();
      if (saved?.apiKey && saved?.secretKey) {
        try {
          const r = await connectAlpaca(saved.apiKey, saved.secretKey, saved.paper !== false);
          if (cancelled) return;
          if (r.connected) {
            setBroker('alpaca');
            setBrokerState(prev => ({ ...prev, alpacaConnected: true, alpacaPaper: saved.paper !== false, active: 'alpaca', loading: false }));
            return;
          }
        } catch { /* ignore */ }
      }
      if (!cancelled) {
        setBrokerState(prev => ({ ...prev, loading: false }));
      }
    };

    const tryIbkr = async () => {
      try {
        const s = await getConnectionStatus();
        if (s.connected && !cancelled) {
          setBroker('ibkr');
          setBrokerState(prev => ({ ...prev, ibkrConnected: true, active: prev.active || 'ibkr', loading: false }));
        }
      } catch { /* not connected */ }
    };

    Promise.all([tryAlpaca(), tryIbkr()]);
    return () => { cancelled = true; };
  }, []);

  // ── Health check: re-verify every 30s ──
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const s = await getAlpacaStatus();
        if (!s.connected && broker.alpacaConnected) {
          // Reconnect
          const saved = alpacaConfig.getConfig();
          if (saved?.apiKey && saved?.secretKey) {
            const r = await connectAlpaca(saved.apiKey, saved.secretKey, saved.paper !== false).catch(() => null);
            if (!r?.connected) {
              clearBroker();
              setBrokerState(prev => ({ ...prev, alpacaConnected: false, active: prev.ibkrConnected ? 'ibkr' : null }));
            }
          }
        } else if (s.connected && !broker.alpacaConnected) {
          setBroker('alpaca');
          setBrokerState(prev => ({ ...prev, alpacaConnected: true, active: 'alpaca' }));
        }
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(iv);
  }, [broker.alpacaConnected, broker.ibkrConnected]);

  return (
    <BrokerContext.Provider value={{ broker, setAlpacaActive, setIbkrActive }}>
      {/* Live data indicator bar */}
      {broker.active && !broker.loading && (
        <div className={`fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-1 text-[11px] font-bold ${broker.active === 'alpaca' ? 'bg-[#ffeb3b]/10 border-t border-[#ffeb3b]/20 text-[#ffeb3b]' : 'bg-[#ff9800]/10 border-t border-[#ff9800]/20 text-[#ff9800]'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {broker.active === 'alpaca'
            ? `Alpaca ${broker.alpacaPaper ? '(ورقي)' : '(حقيقي)'} — بيانات لحظية نشطة`
            : 'IBKR — بيانات لحظية نشطة'}
        </div>
      )}
      {children}
    </BrokerContext.Provider>
  );
}

export const useBroker = () => {
  const ctx = useContext(BrokerContext);
  if (!ctx) return { broker: { active: null, alpacaConnected: false, ibkrConnected: false, loading: false } };
  return ctx;
};
