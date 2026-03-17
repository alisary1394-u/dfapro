import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { authClient } from '@/api/authClient';

const AuthContext = createContext(null);

const IDLE_TIMEOUT = 30 * 60 * 1000;   // 30 minutes
const IDLE_WARNING = 2 * 60 * 1000;    // warn 2 minutes before logout

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const [idleSecondsLeft, setIdleSecondsLeft] = useState(120);

  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const clearAllTimers = () => {
    clearTimeout(idleTimerRef.current);
    clearTimeout(warningTimerRef.current);
    clearInterval(countdownRef.current);
  };

  const resetIdleTimer = useCallback(() => {
    clearAllTimers();
    setIdleWarning(false);

    // Show warning 2 minutes before auto-logout
    warningTimerRef.current = setTimeout(() => {
      setIdleWarning(true);
      let secs = 120;
      setIdleSecondsLeft(secs);
      countdownRef.current = setInterval(() => {
        secs -= 1;
        setIdleSecondsLeft(secs);
        if (secs <= 0) clearInterval(countdownRef.current);
      }, 1000);
    }, IDLE_TIMEOUT - IDLE_WARNING);

    // Auto-logout after full idle timeout
    idleTimerRef.current = setTimeout(() => {
      clearAllTimers();
      authClient.logout().catch(() => {}).finally(() => {
        window.location.assign('/login');
      });
    }, IDLE_TIMEOUT);
  }, []);

  // Start/stop idle tracking based on auth state
  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers();
      setIdleWarning(false);
      return;
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      clearAllTimers();
    };
  }, [isAuthenticated, resetIdleTimer]);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await authClient.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAppPublicSettings({ id: 'local', public_settings: {} });
    } catch (error) {
      const authErrorStatus = error?.status;
      setUser(null);
      setIsAuthenticated(false);
      if (authErrorStatus === 401) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else {
        setAuthError({ type: 'unknown', message: error.message || 'Authentication failed' });
      }
    } finally {
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await authClient.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      if (error?.status === 401 || error?.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = async (shouldRedirect = true) => {
    await authClient.logout();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
    // Clear all user data from localStorage to prevent data leakage
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('portfolio_') ||
          key.startsWith('watchlist_') ||
          key.startsWith('alert_') ||
          key.startsWith('virtual_') ||
          key.startsWith('dfa_') ||
          key === 'dashboard_layout' ||
          key === 'dashboard_market'
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
    if (shouldRedirect) {
      window.location.assign('/login');
    }
  };

  const navigateToLogin = () => {
    window.location.assign('/login');
  };

  // Initialize: check auth state on mount
  useEffect(() => {
    checkAppState();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      setUser,
      setIsAuthenticated,
      setAuthError,
      idleWarning,
      idleSecondsLeft,
      resetIdleTimer,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
