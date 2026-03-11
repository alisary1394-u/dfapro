import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin;

let socket = null;
const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 2000 });
  }
  return socket;
};

/**
 * Subscribe to live price updates for a list of symbols.
 * Returns { prices, prevPrices } where prices is { [symbol]: quoteData }
 * and prevPrices holds the previous tick for flash animation.
 */
export function useLivePrices(symbols, market) {
  const [prices, setPrices] = useState({});
  const prevPricesRef = useRef({});
  const [prevPrices, setPrevPrices] = useState({});

  useEffect(() => {
    if (!symbols?.length || !market) return;

    const s = getSocket();
    s.emit('subscribe', { symbols, market });

    const handler = (data) => {
      setPrices(prev => {
        const next = { ...prev };
        const prevSnap = {};
        for (const [sym, q] of Object.entries(data)) {
          prevSnap[sym] = prev[sym] || null;
          next[sym] = q;
        }
        prevPricesRef.current = { ...prevPricesRef.current, ...prevSnap };
        setPrevPrices(p => ({ ...p, ...prevSnap }));
        return next;
      });
    };

    s.on('prices', handler);

    return () => {
      s.off('prices', handler);
      s.emit('unsubscribe');
    };
  }, [JSON.stringify(symbols), market]);

  return { prices, prevPrices };
}
