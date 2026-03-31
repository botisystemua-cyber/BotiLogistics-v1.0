import { createContext, useContext } from 'react';
import type { ItemStatus, StatusFilter, Route, ShippingRoute, ViewTab } from '../types';

export interface AppStore {
  driverName: string;
  setDriverName: (name: string) => void;

  currentScreen: 'login' | 'routes' | 'list';
  setCurrentScreen: (screen: 'login' | 'routes' | 'list') => void;

  currentSheet: string;
  isUnifiedView: boolean;

  statuses: Record<string, ItemStatus>;
  setStatus: (key: string, status: ItemStatus) => void;
  getStatus: (key: string) => ItemStatus;

  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;

  routeFilter: string;
  setRouteFilter: (f: string) => void;

  viewTab: ViewTab;
  setViewTab: (t: ViewTab) => void;

  routes: Route[];
  setRoutes: (routes: Route[]) => void;
  shippingRoutes: ShippingRoute[];
  setShippingRoutes: (routes: ShippingRoute[]) => void;

  openRoute: (sheet: string, unified?: boolean) => void;
  goBack: () => void;

  toastMessage: string;
  showToast: (msg: string) => void;

  hiddenCols: Set<string>;
  toggleCol: (col: string) => void;
}

export const AppContext = createContext<AppStore | null>(null);

export function useApp(): AppStore {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
