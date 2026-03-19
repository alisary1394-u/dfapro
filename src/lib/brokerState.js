/**
 * Module-level singleton for active broker state.
 * This is shared across ALL imports — marketDataClient reads it to route requests.
 */

let _activeBroker = null; // 'alpaca' | 'polygon' | null

export const setBroker = (broker) => { _activeBroker = broker; };
export const clearBroker = () => { _activeBroker = null; };
export const getActiveBroker = () => _activeBroker;

// Poll interval: 5s for live broker, 15s default
export const getPollInterval = () => _activeBroker ? 5000 : 15000;
