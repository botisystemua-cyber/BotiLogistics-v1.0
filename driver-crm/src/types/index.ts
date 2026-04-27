export interface Route {
  name: string;
  count: number;
  paxCount?: number;
  pkgCount?: number;
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
  tips: string;
  tipsCurrency: string;
  // Аудит «хто проставив оплату» — вирішує чи готівка падає водію в зведення.
  // Якщо менеджер уже проставив до рейсу — водій бачить замочок і не бере у звіт.
  paymentCollectedBy: string;
  paymentCollectedAt: string;
  // routes.id — UUID, потрібен RPC driver_set_payment'у. itemId/PAX_ID/PKG_ID
  // не годяться, бо для пасажирського рейсу-плейсхолдера itemId порожній.
  _uuid: string;
  // Якщо ця посилка — primary об'єднаного ліда, тут перелік ТТН дочок.
  // Водій бачить «🔗 + ТТН A, B» у картці — щоб не пропустити коробки клієнта.
  mergedTtns: string[];
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
  senderPhone: string;
  addrFrom: string;
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
  tips: string;
  tipsCurrency: string;
  sheet: string;
  _statusKey: string;
  _sourceRoute?: string;
}

export type RouteItem = Passenger | Package | ShippingItem;

export type ItemStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export type RouteType = 'route';  // one type now — route contains both pax + pkg

export type StatusFilter = 'all' | ItemStatus;

export type ViewTab = 'all' | 'passengers' | 'packages' | 'shipping' | 'allPackages' | 'paxUaEu' | 'paxEuUa' | 'pkgUaEu' | 'pkgEuUa';

export type ExpenseCategory = 'fuel' | 'food' | 'parking' | 'toll' | 'fine' | 'customs' | 'topUp' | 'other' | 'tips';

export interface ExpenseItem {
  rowNum: number;
  expId: string;
  dateTrip: string;
  driver: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  description: string;
}

export interface ExpenseAdvance {
  cash: number;
  cashCurrency: string;
  card: number;
  cardCurrency: string;
}

export interface RouteSummary {
  routeName: string;
  passengers: Record<string, number>;
  packages: Record<string, number>;
  shipping: Record<string, number>;
  tips: Record<string, number>;
  income: Record<string, number>;
  cashCollected: Record<string, number>;
  cardCollected: Record<string, number>;
  debts: Record<string, number>;
  advanceCash: number;
  advanceCashCur: string;
  advanceCard: number;
  advanceCardCur: string;
  expenses: Record<string, number>;
  expensesByCategory: Record<string, { amount: number; currency: string }>;
  toReturn: Record<string, number>;
}
