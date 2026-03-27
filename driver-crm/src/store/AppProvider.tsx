import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { AppContext, type AppStore } from './useAppStore';
import type { ItemStatus, RouteType, StatusFilter, PassengerRoute } from '../types';

function loadStatuses(sheet: string): Record<string, ItemStatus> {
  try {
    const saved = localStorage.getItem('driverStatuses_' + sheet);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function loadHiddenCols(): Set<string> {
  try {
    const saved = localStorage.getItem('driverHiddenCols');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [driverName, setDriverNameState] = useState(
    () => localStorage.getItem('driverName') || ''
  );
  const [currentScreen, setCurrentScreen] = useState<'login' | 'routes' | 'list'>('login');
  const [currentSheet, setCurrentSheet] = useState('');
  const [currentRouteType, setCurrentRouteType] = useState<RouteType>('delivery');
  const [isUnifiedView, setIsUnifiedView] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [passengerRoutes, setPassengerRoutes] = useState<PassengerRoute[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(loadHiddenCols);

  const setDriverName = useCallback((name: string) => {
    setDriverNameState(name);
    localStorage.setItem('driverName', name);
  }, []);

  const setStatus = useCallback(
    (key: string, status: ItemStatus) => {
      setStatuses((prev) => {
        const next = { ...prev, [key]: status };
        localStorage.setItem('driverStatuses_' + currentSheet, JSON.stringify(next));
        return next;
      });
    },
    [currentSheet]
  );

  const getStatus = useCallback(
    (key: string): ItemStatus => statuses[key] || 'pending',
    [statuses]
  );

  const openRoute = useCallback(
    (sheet: string, type: RouteType, unified = false) => {
      setCurrentSheet(sheet);
      setCurrentRouteType(type);
      setIsUnifiedView(unified);
      setStatusFilter('all');
      setRouteFilter('all');
      setStatuses(loadStatuses(sheet));
      setCurrentScreen('list');
    },
    []
  );

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
      if (next.has(col)) next.delete(col);
      else next.add(col);
      localStorage.setItem('driverHiddenCols', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const store: AppStore = useMemo(
    () => ({
      driverName,
      setDriverName,
      currentScreen,
      setCurrentScreen,
      currentSheet,
      currentRouteType,
      isUnifiedView,
      statuses,
      setStatus,
      getStatus,
      statusFilter,
      setStatusFilter,
      routeFilter,
      setRouteFilter,
      passengerRoutes,
      setPassengerRoutes,
      openRoute,
      goBack,
      toastMessage,
      showToast,
      hiddenCols,
      toggleCol,
    }),
    [
      driverName, setDriverName, currentScreen, currentSheet,
      currentRouteType, isUnifiedView, statuses, setStatus, getStatus,
      statusFilter, routeFilter, passengerRoutes, openRoute, goBack,
      toastMessage, showToast, hiddenCols, toggleCol,
    ]
  );

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}
