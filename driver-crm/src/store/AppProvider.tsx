import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { AppContext, type AppStore, type Theme } from './useAppStore';
import type { ItemStatus, StatusFilter, Route, ShippingRoute, ViewTab } from '../types';
import { readSession } from '../lib/session';
import { loadUiPrefs, getUiPrefSync, setUiPref } from '../lib/uiPrefs';

function loadStatuses(sheet: string): Record<string, ItemStatus> {
  // Статуси — per-route, per-device (рішення водія у моменті: готово / в роботі).
  // Це не UI-налаштування — лишаємо в localStorage, щоб працювало офлайн.
  try {
    const saved = localStorage.getItem('driverStatuses_' + sheet);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function loadHiddenCols(): Set<string> {
  // Спочатку читаємо з localStorage (sync fallback). Після loadUiPrefs()
  // кеш оновлюється — тоді setHiddenCols знову читає з БД.
  try {
    const saved = localStorage.getItem('driverHiddenCols');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const session = readSession();
  const driverName = session?.user_name ?? '';

  const [currentScreen, setCurrentScreen] = useState<'routes' | 'list' | 'expenses'>('routes');
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

  // Завантажуємо per-user UI-налаштування з БД один раз на старті.
  // Якщо юзер мав legacy-значення у localStorage, а в БД ще порожньо —
  // заливаємо, щоб нічого не втратити. Далі всі save/load йдуть через БД.
  useEffect(() => {
    (async () => {
      const prefs = await loadUiPrefs();
      // Migrate legacy localStorage → DB (once)
      const legacyTheme = localStorage.getItem('driverTheme') as Theme | null;
      const legacyManualAt = localStorage.getItem('driverThemeManualAt');
      const legacyHidden = localStorage.getItem('driverHiddenCols');
      if (prefs.driver_theme == null && legacyTheme) setUiPref('driver_theme', legacyTheme);
      if (prefs.driver_theme_manual_at == null && legacyManualAt)
        setUiPref('driver_theme_manual_at', parseInt(legacyManualAt, 10) || 0);
      if (prefs.driver_hidden_cols == null && legacyHidden) {
        try { setUiPref('driver_hidden_cols', JSON.parse(legacyHidden)); } catch { /* ignore */ }
      }
      // Apply loaded prefs to React state
      const t = getUiPrefSync<Theme | null>('driver_theme', null);
      if (t) setThemeState(t);
      const hidden = getUiPrefSync<string[] | null>('driver_hidden_cols', null);
      if (Array.isArray(hidden)) setHiddenCols(new Set(hidden));
    })();
  }, []);

  useEffect(() => {
    const check = () => {
      const lastManualDb = getUiPrefSync<number>('driver_theme_manual_at', 0);
      const lastManualLs = parseInt(localStorage.getItem('driverThemeManualAt') || '0', 10);
      const lastManual = Math.max(lastManualDb, lastManualLs);
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
    // Write-through: DB (source of truth) + localStorage (sync fallback).
    const now = Date.now();
    setUiPref('driver_theme', t);
    setUiPref('driver_theme_manual_at', now);
    localStorage.setItem('driverTheme', t);
    localStorage.setItem('driverThemeManualAt', String(now));
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
      const arr = [...next];
      // Write-through: DB (source of truth) + localStorage (sync fallback).
      setUiPref('driver_hidden_cols', arr);
      localStorage.setItem('driverHiddenCols', JSON.stringify(arr));
      return next;
    });
  }, []);

  const store: AppStore = useMemo(() => ({
    driverName, currentScreen, setCurrentScreen,
    currentSheet, isUnifiedView, statuses, setStatus, getStatus,
    statusFilter, setStatusFilter, routeFilter, setRouteFilter,
    viewTab, setViewTab, routes, setRoutes, shippingRoutes, setShippingRoutes,
    openRoute, goBack, toastMessage, showToast, hiddenCols, toggleCol,
    theme, setTheme,
  }), [
    driverName, currentScreen, currentSheet,
    isUnifiedView, statuses, setStatus, getStatus,
    statusFilter, routeFilter, viewTab, routes, shippingRoutes,
    openRoute, goBack, toastMessage, showToast, hiddenCols, toggleCol,
    theme, setTheme,
  ]);

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}
