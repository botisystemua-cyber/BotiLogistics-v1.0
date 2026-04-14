import { CONFIG } from '../config';
import type { Route, ShippingRoute, Passenger, Package, ShippingItem, RouteItem, ExpenseItem, ExpenseAdvance, RouteSummary } from '../types';

// POST-запит до GAS з таймаутом 30 сек
async function gasPost(action: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, ...data }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await response.text();
    try { return JSON.parse(text); }
    catch { throw new Error('GAS повернув не-JSON: ' + text.slice(0, 120)); }
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Таймаут — GAS не відповів за 30 секунд');
    }
    throw err;
  }
}

// ============================================
// Читання аркушів MARHRUT через Apps Script backend (apiGetSheetRows)
// ============================================
// Раніше тут був прямий fetch gviz CSV, але він вимагав публічної таблиці
// (у браузера водія немає прав на приватний Sheet → Google редиректив на
// ServiceLogin → CORS ламав запит). Apps Script виконується серверно під
// акаунтом власника, тому має повний доступ навіть коли MARHRUT приватна.

async function fetchSheet(sheetName: string): Promise<string[][]> {
  const url = CONFIG.API_URL + '?action=getSheetRows&sheet=' + encodeURIComponent(sheetName);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error('Не вдалося завантажити: ' + sheetName);
    const text = await response.text();
    let data: { success?: boolean; error?: string; rows?: unknown[][] };
    try { data = JSON.parse(text); }
    catch { throw new Error('GAS повернув не-JSON: ' + text.slice(0, 120)); }
    if (!data.success) throw new Error(data.error || 'Не вдалося завантажити: ' + sheetName);
    return (data.rows || []).map((row: unknown[]) =>
      row.map((cell) => (cell == null ? '' : String(cell)))
    );
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// Column indices for Маршрут sheets (matching .gs COL)
const C = {
  RTE_ID: 0, TYPE: 1, DIRECTION: 2, SOURCE_SHEET: 3, ITEM_ID: 4,
  DATE_CREATED: 5, DATE_TRIP: 6, TIMING: 7, AUTO_ID: 8, AUTO_NUM: 9,
  DRIVER: 10, DRIVER_PHONE: 11, CITY: 12, SEAT: 13, PAX_NAME: 14,
  PAX_PHONE: 15, ADDR_FROM: 16, ADDR_TO: 17, SEATS_COUNT: 18,
  BAGGAGE_WEIGHT: 19, SENDER_NAME: 20, RECIPIENT_NAME: 21,
  RECIPIENT_PHONE: 22, RECIPIENT_ADDR: 23, INTERNAL_NUM: 24,
  TTN: 25, PKG_DESC: 26, PKG_WEIGHT: 27, AMOUNT: 28, CURRENCY: 29,
  DEPOSIT: 30, DEPOSIT_CURRENCY: 31, PAY_FORM: 32, PAY_STATUS: 33,
  DEBT: 34, PAY_NOTE: 35, STATUS: 36, STATUS_CRM: 37, TAG: 38,
  NOTE: 43, SMS_NOTE: 44, TIPS: 51, TIPS_CUR: 52,
};

// Column indices for Відправка sheets
const CS = {
  DISPATCH_ID: 0, DATE_CREATED: 1, RTE_ID: 2, DATE_TRIP: 3,
  AUTO_NUM: 5, DRIVER: 6, SENDER_PHONE: 9, SENDER_NAME: 10,
  RECIPIENT_NAME: 11, RECIPIENT_PHONE: 12, RECIPIENT_ADDR: 13,
  INTERNAL_NUM: 14, WEIGHT: 15, DESCRIPTION: 16, PHOTO: 17,
  AMOUNT: 18, CURRENCY: 19, DEPOSIT: 20, DEPOSIT_CURRENCY: 21, PAY_FORM: 22,
  PAY_STATUS: 23, DEBT: 24, STATUS: 25, PKG_ID: 26, NOTE: 27,
  TIPS: 28, TIPS_CUR: 29,
};

function val(row: string[], idx: number): string {
  return (row[idx] || '').trim();
}

function buildCommon(row: string[], sheetName: string, rowNum: number) {
  return {
    rowNum,
    rteId: val(row, C.RTE_ID),
    type: val(row, C.TYPE),
    direction: val(row, C.DIRECTION),
    // Fallback: якщо окрема колонка ITEM_ID порожня, беремо RTE_ID (старий формат)
    itemId: val(row, C.ITEM_ID) || val(row, C.RTE_ID),
    dateCreated: val(row, C.DATE_CREATED),
    dateTrip: val(row, C.DATE_TRIP),
    timing: val(row, C.TIMING),
    autoNum: val(row, C.AUTO_NUM),
    driver: val(row, C.DRIVER),
    city: val(row, C.CITY),
    amount: val(row, C.AMOUNT),
    currency: val(row, C.CURRENCY),
    deposit: val(row, C.DEPOSIT),
    depositCurrency: val(row, C.DEPOSIT_CURRENCY),
    payForm: val(row, C.PAY_FORM),
    payStatus: val(row, C.PAY_STATUS),
    debt: val(row, C.DEBT),
    payNote: val(row, C.PAY_NOTE),
    status: val(row, C.STATUS) || 'pending',
    statusCrm: val(row, C.STATUS_CRM),
    tag: val(row, C.TAG),
    note: val(row, C.NOTE),
    smsNote: val(row, C.SMS_NOTE),
    tips: val(row, C.TIPS),
    tipsCurrency: val(row, C.TIPS_CUR),
    sheet: sheetName,
    _statusKey: '',
    _sourceRoute: undefined as string | undefined,
  };
}

// ---- Routes (fetch real counts from Apps Script) ----
export async function fetchRoutes(): Promise<{ routes: Route[]; shipping: ShippingRoute[] }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(CONFIG.API_URL + '?action=getAvailableRoutes', { signal: controller.signal });
    clearTimeout(timer);
    const text = await response.text();
    const data = JSON.parse(text);
    if (data.success) return { routes: data.routes, shipping: data.shipping };
  } catch { /* fallback to config */ }
  return {
    routes: CONFIG.ROUTES.map((name) => ({ name, count: 0 })),
    shipping: CONFIG.SHIPPING.map((s) => ({ ...s, count: 0 })),
  };
}

// ---- Passengers ----
export async function fetchPassengers(sheetName: string): Promise<Passenger[]> {
  const rows = await fetchSheet(sheetName);
  const items: Passenger[] = [];
  // Skip header (row 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const type = val(row, C.TYPE).toLowerCase();
    if (type !== 'пасажир') continue;
    // Пропускаємо лише якщо немає жодного ідентифікатора
    if (!val(row, C.ITEM_ID) && !val(row, C.RTE_ID)) continue;

    items.push({
      ...buildCommon(row, sheetName, i + 1),
      name: val(row, C.PAX_NAME),
      phone: val(row, C.PAX_PHONE),
      addrFrom: val(row, C.ADDR_FROM),
      addrTo: val(row, C.ADDR_TO),
      seatsCount: val(row, C.SEATS_COUNT),
      baggageWeight: val(row, C.BAGGAGE_WEIGHT),
      seat: val(row, C.SEAT),
    } as Passenger);
  }
  return items;
}

// ---- Packages ----
export async function fetchPackages(sheetName: string): Promise<Package[]> {
  const rows = await fetchSheet(sheetName);
  const items: Package[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const type = val(row, C.TYPE).toLowerCase();
    if (type !== 'посилка') continue;
    // Пропускаємо лише якщо немає жодного ідентифікатора
    if (!val(row, C.ITEM_ID) && !val(row, C.RTE_ID)) continue;

    items.push({
      ...buildCommon(row, sheetName, i + 1),
      senderName: val(row, C.SENDER_NAME),
      senderPhone: val(row, C.PAX_PHONE),
      addrFrom: val(row, C.ADDR_FROM),
      recipientName: val(row, C.RECIPIENT_NAME),
      recipientPhone: val(row, C.RECIPIENT_PHONE),
      recipientAddr: val(row, C.RECIPIENT_ADDR),
      internalNum: val(row, C.INTERNAL_NUM),
      ttn: val(row, C.TTN),
      pkgDesc: val(row, C.PKG_DESC),
      pkgWeight: val(row, C.PKG_WEIGHT),
    } as Package);
  }
  return items;
}

// ---- Shipping (read-only) ----
export async function fetchShippingItems(sheetName: string): Promise<ShippingItem[]> {
  const rows = await fetchSheet(sheetName);
  const items: ShippingItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const dispatchId = val(row, CS.DISPATCH_ID);
    const senderName = val(row, CS.SENDER_NAME);
    if (!dispatchId && !senderName) continue;

    items.push({
      rowNum: i + 1,
      dispatchId,
      dateCreated: val(row, CS.DATE_CREATED),
      dateTrip: val(row, CS.DATE_TRIP),
      autoNum: val(row, CS.AUTO_NUM),
      driver: val(row, CS.DRIVER),
      senderPhone: val(row, CS.SENDER_PHONE),
      senderName,
      recipientName: val(row, CS.RECIPIENT_NAME),
      recipientPhone: val(row, CS.RECIPIENT_PHONE),
      recipientAddr: val(row, CS.RECIPIENT_ADDR),
      internalNum: val(row, CS.INTERNAL_NUM),
      weight: val(row, CS.WEIGHT),
      description: val(row, CS.DESCRIPTION),
      photo: val(row, CS.PHOTO),
      amount: val(row, CS.AMOUNT),
      currency: val(row, CS.CURRENCY),
      deposit: val(row, CS.DEPOSIT),
      depositCurrency: val(row, CS.DEPOSIT_CURRENCY),
      payForm: val(row, CS.PAY_FORM),
      payStatus: val(row, CS.PAY_STATUS),
      debt: val(row, CS.DEBT),
      status: val(row, CS.STATUS),
      pkgId: val(row, CS.PKG_ID),
      note: val(row, CS.NOTE),
      tips: val(row, CS.TIPS),
      tipsCurrency: val(row, CS.TIPS_CUR),
      sheet: sheetName,
      _statusKey: '',
      _sourceRoute: undefined as string | undefined,
    });
  }
  return items;
}

// ---- Status Update (still via Apps Script POST) ----
export async function updateItemStatus(
  driverName: string,
  routeName: string,
  item: RouteItem | { itemId: string; type: string },
  status: string,
  cancelReason = ''
) {
  const itemId = 'dispatchId' in item ? (item as ShippingItem).dispatchId : (item as Passenger | Package).itemId;
  const itemType = 'dispatchId' in item ? 'відправка' : (item as Passenger | Package).type;
  const phone = 'phone' in item ? (item as Passenger).phone : ('recipientPhone' in item ? (item as Package | ShippingItem).recipientPhone : '');

  const result = await gasPost('updateDriverStatus', {
    driverId: driverName, routeName, itemId, itemType, phone, status, cancelReason,
  });
  return result;
}

// ---- Expenses ----
export async function fetchExpenses(routeName: string): Promise<{ items: ExpenseItem[]; advance: ExpenseAdvance | null }> {
  const sheetName = routeName.replace('Маршрут_', 'Витрати_');
  const data = await gasPost('getExpenses', { payload: { sheetName } });
  if (data.success) return { items: (data.items as ExpenseItem[]) || [], advance: (data.advance as ExpenseAdvance) || null };
  throw new Error((data.error as string) || 'Помилка завантаження витрат');
}

export async function addExpense(data: Record<string, string>) {
  return gasPost('addExpense', data);
}

export async function deleteExpense(data: Record<string, string>) {
  return gasPost('deleteExpense', data);
}

// ---- Update advance ----
export async function updateAdvance(data: Record<string, string>) {
  return gasPost('updateAdvance', data);
}

// ---- Add new item (passenger or package) ----
export async function addRouteItem(data: Record<string, string>) {
  return gasPost('addRouteItem', data);
}

// ---- Search archive for sender/recipient autofill ----
export interface ArchiveMatch {
  dateArchive: string;
  pkgId: string;
  cliId: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddr: string;
}

export async function searchArchive(query: string): Promise<{ results: ArchiveMatch[]; totalMatches: number }> {
  const data = await gasPost('searchArchive', { query });
  if (data.success) return { results: (data.results as ArchiveMatch[]) || [], totalMatches: (data.totalMatches as number) || 0 };
  throw new Error((data.error as string) || 'Помилка пошуку в архіві');
}

// ---- Route Summary ----
export async function buildRouteSummaryApi(routeName: string, driverName: string): Promise<RouteSummary> {
  const data = await gasPost('buildRouteSummary', { routeName, driverName });
  if (data.success) return data.summary as RouteSummary;
  throw new Error((data.error as string) || 'Помилка побудови зведення');
}

export async function saveRouteSummaryApi(routeName: string, driverName: string, summary: RouteSummary): Promise<{ success: boolean }> {
  const data = await gasPost('saveRouteSummary', { routeName, driverName, summary });
  if (data.success) return { success: true };
  throw new Error((data.error as string) || 'Помилка збереження зведення');
}

// ---- Update driver fields (tips, etc.) ----
export async function updateDriverFieldsSafe(
  routeName: string,
  itemId: string,
  fields: Record<string, string | number>,
  driverName: string
) {
  return gasPost('updateDriverFieldsSafe', { routeName, itemId, fields, driverName });
}
