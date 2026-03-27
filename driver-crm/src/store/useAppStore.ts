import { createContext, useContext } from 'react';
import type { ItemStatus, RouteType, StatusFilter, PassengerRoute } from '../types';

export interface AppStore {
  // Auth
  driverName: string;
  setDriverName: (name: string) => void;

  // Navigation
  currentScreen: 'login' | 'routes' | 'list';
  setCurrentScreen: (screen: 'login' | 'routes' | 'list') => void;

  // Route
  currentSheet: string;
  currentRouteType: RouteType;
  isUnifiedView: boolean;

  // Status
  statuses: Record<string, ItemStatus>;
  setStatus: (key: string, status: ItemStatus) => void;
  getStatus: (key: string) => ItemStatus;

  // Filter
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;

  // Route filter (unified view)
  routeFilter: string;
  setRouteFilter: (f: string) => void;

  // Passenger routes
  passengerRoutes: PassengerRoute[];
  setPassengerRoutes: (routes: PassengerRoute[]) => void;

  // Actions
  openRoute: (sheet: string, type: RouteType, unified?: boolean) => void;
  goBack: () => void;

  // Toast
  toastMessage: string;
  showToast: (msg: string) => void;

  // Hidden columns
  hiddenCols: Set<string>;
  toggleCol: (col: string) => void;
}

export const AppContext = createContext<AppStore | null>(null);

export function useApp(): AppStore {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
