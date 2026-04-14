import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { AppContext, type AppStore, type Theme } from './useAppStore';
import type { ItemStatus, StatusFilter, Route, ShippingRoute, ViewTab } from '../types';

function loadStatuses(sheet: string): Record<string, ItemStatus> {
  try {
    const saved = localStorage.getItem('driverStatuses_' + sheet);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function loadHiddenCols(): Set<string> {
  try {
    const saved = localStorage.getItem('driverHiddenCols');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [driverName, setDriverNameState] = useState(() => localStorage.getItem('driverName') || 'Водій');
  const [currentScreen, setCurrentScreen] = useState<'login' | 'routes' | 'list' | 'expenses'>('routes');
  const [currentSheet, setCurrentSheet] = useState('');
  const [isUnifiedView, setIsUnifiedView] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [viewTab, setViewTab] = useState<ViewTab>('passengers');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [shippingRoutes, setShippingRoutes] = useState<ShippingRoute[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(loadHiddenCols);
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('driverTheme') as Theme | null;
    const lastManual = parseInt(localStorage.getItem('driverThemeManualAt') || '0', 10);
    const hour = new Date().getHours();
    const isNight = hour >= 20 || hour < 7;
    if (isNight && Date.now() - lastManual > 12 * 3600 * 1000) return 'lone-wolf';
    return saved || 'top-driver';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const check = () => {
      const lastManual = parseInt(localStorage.getItem('driverThemeManualAt') || '0', 10);
      if (Date.now() - lastManual < 12 * 3600 * 1000) return;
      const hour = new Date().getHours();
      const isNight = hour >= 20 || hour < 7;
      setThemeState((prev) => {
        if (isNight && prev === 'top-driver') return 'lone-wolf';
        if (!isNight && prev === 'lone-wolf') return 'top-driver';
        return prev;
      });
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem('driverTheme', t);
    localStorage.setItem('driverThemeManualAt', String(Date.now()));
  }, []);

  const setDriverName = useCallback((name: string) => {
    setDriverNameState(name);
    localStorage.setItem('driverName', name);
  }, []);

  const setStatus = useCallback((key: string, status: ItemStatus) => {
    setStatuses((prev) => {
      const next = { ...prev, [key]: status };
      if (currentSheet) {
        localStorage.setItem('driverStatuses_' + currentSheet, JSON.stringify(next));
      }
      return next;
    });
  }, [currentSheet]);

  const getStatus = useCallback((key: string): ItemStatus => statuses[key] || 'pending', [statuses]);

  const openRoute = useCallback((sheet: string, unified = false) => {
    setCurrentSheet(sheet);
    setIsUnifiedView(unified);
    setStatusFilter('all');
    setRouteFilter('all');
    setViewTab('all');
    setStatuses(loadStatuses(sheet));
    setCurrentScreen('list');
  }, []);

  const goBack = useCallback(() => {
    setCurrentScreen('routes');
    setIsUnifiedView(false);
    setRouteFilter('all');
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  }, []);

  const toggleCol = useCallback((col: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      localStorage.setItem('driverHiddenCols', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const store: AppStore = useMemo(() => ({
    driverName, setDriverName, currentScreen, setCurrentScreen,
    currentSheet, isUnifiedView, statuses, setStatus, getStatus,
    statusFilter, setStatusFilter, routeFilter, setRouteFilter,
    viewTab, setViewTab, routes, setRoutes, shippingRoutes, setShippingRoutes,
    openRoute, goBack, toastMessage, showToast, hiddenCols, toggleCol,
    theme, setTheme,
  }), [
    driverName, setDriverName, currentScreen, currentSheet,
    isUnifiedView, statuses, setStatus, getStatus,
    statusFilter, routeFilter, viewTab, routes, shippingRoutes,
    openRoute, goBack, toastMessage, showToast, hiddenCols, toggleCol,
    theme, setTheme,
  ]);

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}
