import { CONFIG } from '../config';
import type { Route, ShippingRoute, Passenger, Package, ShippingItem, RouteItem, ExpenseItem, ExpenseAdvance } from '../types';

// ============================================
// Читання через Google Sheets gviz API (публічна таблиця)
// Це НАБАГАТО швидше ніж Apps Script
// ============================================

async function fetchSheet(sheetName: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Не вдалося завантажити: ' + sheetName);
  const csv = await response.text();
  return parseCsv(csv);
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && csv[i + 1] === '\n')) {
        row.push(current);
        current = '';
        if (row.some((c) => c.trim())) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length) {
    row.push(current);
    if (row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
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
  NOTE: 43, SMS_NOTE: 44,
};

// Column indices for Відправка sheets
const CS = {
  DISPATCH_ID: 0, DATE_CREATED: 1, RTE_ID: 2, DATE_TRIP: 3,
  AUTO_NUM: 5, DRIVER: 6, SENDER_PHONE: 9, SENDER_NAME: 10,
  RECIPIENT_NAME: 11, RECIPIENT_PHONE: 12, RECIPIENT_ADDR: 13,
  INTERNAL_NUM: 14, WEIGHT: 15, DESCRIPTION: 16, PHOTO: 17,
  AMOUNT: 18, CURRENCY: 19, DEPOSIT: 20, DEPOSIT_CURRENCY: 21, PAY_FORM: 22,
  PAY_STATUS: 23, DEBT: 24, STATUS: 25, PKG_ID: 26, NOTE: 27,
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
    itemId: val(row, C.ITEM_ID),
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
    sheet: sheetName,
    _statusKey: '',
    _sourceRoute: undefined as string | undefined,
  };
}

// ---- Routes (fetch real counts from Apps Script) ----
export async function fetchRoutes(): Promise<{ routes: Route[]; shipping: ShippingRoute[] }> {
  try {
    const response = await fetch(CONFIG.API_URL + '?action=getAvailableRoutes');
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
    if (!val(row, C.ITEM_ID)) continue;

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
    if (!val(row, C.ITEM_ID)) continue;

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

  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'updateDriverStatus',
      driverId: driverName,
      routeName,
      itemId,
      itemType,
      phone,
      status,
      cancelReason,
    }),
  });
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error('Помилка оновлення'); }
}

// ---- Expenses ----
export async function fetchExpenses(routeName: string): Promise<{ items: ExpenseItem[]; advance: ExpenseAdvance | null }> {
  const sheetName = routeName.replace('Маршрут_', 'Витрати_');
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'getExpenses', payload: { sheetName } }),
  });
  const text = await response.text();
  const data = JSON.parse(text);
  if (data.success) return { items: data.items || [], advance: data.advance || null };
  throw new Error(data.error || 'Помилка завантаження витрат');
}

export async function addExpense(data: Record<string, string>) {
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'addExpense', ...data }),
  });
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error('Помилка додавання витрати'); }
}

export async function deleteExpense(data: Record<string, string>) {
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'deleteExpense', ...data }),
  });
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error('Помилка видалення витрати'); }
}

// ---- Add new item (passenger or package) ----
export async function addRouteItem(data: Record<string, string>) {
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'addRouteItem', ...data }),
  });
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error('Помилка додавання'); }
}
