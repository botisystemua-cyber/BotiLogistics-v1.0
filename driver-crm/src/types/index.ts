export interface Route {
  name: string;
  count: number;
}

export interface ShippingRoute {
  name: string;
  label: string;
  count: number;
}

export interface Delivery {
  internalNumber: string;
  id?: string;
  name?: string;
  address?: string;
  ttn?: string;
  weight?: string;
  direction?: string;
  phone?: string;
  registrarPhone?: string;
  price?: string;
  amount?: string;
  payment?: string;
  paymentStatus?: string;
  payStatus?: string;
  parcelStatus?: string;
  status?: string;
  timing?: string;
  createdAt?: string;
  receiveDate?: string;
  note?: string;
  smsNote?: string;
  photo?: string;
  vehicle?: string;
  coords?: { lat: number; lng: number };
  _statusKey: string;
  _sourceRoute?: string;
  driverStatus?: string;
}

export interface ShippingItem {
  rowNum: number;
  name: string;
  number: string;
  city: string;
  description?: string;
  weight?: string;
  amount?: string;
  payType?: string;
  currency?: string;
  envelope?: string;
  phone?: string;
  sheet: string;
}

export type ItemStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export type RouteType = 'delivery' | 'shipping';

export type StatusFilter = 'all' | ItemStatus;

export interface AppState {
  driverName: string;
  currentScreen: 'login' | 'routes' | 'list';
  currentSheet: string;
  currentRouteType: RouteType;
  isUnifiedView: boolean;
}
