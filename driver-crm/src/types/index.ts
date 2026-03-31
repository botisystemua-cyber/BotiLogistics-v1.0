export interface Route {
  name: string;
  count: number;
}

export interface ShippingRoute {
  name: string;
  label: string;
  count: number;
}

// Спільні поля для пасажира та посилки (з одного маршрутного листа)
interface RouteItemBase {
  rowNum: number;
  rteId: string;
  type: string;           // "Пасажир" | "Посилка"
  direction: string;
  itemId: string;         // PAX_ID / PKG_ID
  dateCreated: string;
  dateTrip: string;
  timing: string;
  autoNum: string;
  driver: string;
  city: string;
  amount: string;
  currency: string;
  deposit: string;
  depositCurrency: string;
  payForm: string;
  payStatus: string;
  debt: string;
  payNote: string;
  status: string;
  statusCrm: string;
  tag: string;
  note: string;
  smsNote: string;
  sheet: string;
  _statusKey: string;
  _sourceRoute?: string;
}

export interface Passenger extends RouteItemBase {
  name: string;
  phone: string;
  addrFrom: string;
  addrTo: string;
  seatsCount: string;
  baggageWeight: string;
  seat: string;
}

export interface Package extends RouteItemBase {
  senderName: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddr: string;
  internalNum: string;
  ttn: string;
  pkgDesc: string;
  pkgWeight: string;
}

export interface ShippingItem {
  rowNum: number;
  dispatchId: string;
  dateCreated: string;
  dateTrip: string;
  autoNum: string;
  driver: string;
  senderPhone: string;
  senderName: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddr: string;
  internalNum: string;
  weight: string;
  description: string;
  photo: string;
  amount: string;
  currency: string;
  deposit: string;
  depositCurrency: string;
  payForm: string;
  payStatus: string;
  debt: string;
  status: string;
  pkgId: string;
  note: string;
  sheet: string;
  _statusKey: string;
  _sourceRoute?: string;
}

export type RouteItem = Passenger | Package;

export type ItemStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export type RouteType = 'route';  // one type now — route contains both pax + pkg

export type StatusFilter = 'all' | ItemStatus;

export type ViewTab = 'all' | 'passengers' | 'packages' | 'shipping';
