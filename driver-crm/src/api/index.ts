import { supabase } from '../lib/supabase';
import { readSession } from '../lib/session';
import type { Route, ShippingRoute, Passenger, Package, ShippingItem, RouteItem, ExpenseItem, ExpenseAdvance } from '../types';

// ============================================
// Helpers
// ============================================

function getTenantId(): string {
  return readSession()?.tenant_id ?? 'gresco';
}

function s(v: unknown): string {
  return v == null ? '' : String(v);
}

// ============================================
// Routes list
// ============================================

export async function fetchRoutes(): Promise<{ routes: Route[]; shipping: ShippingRoute[] }> {
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('routes')
    .select('rte_id, record_type, is_placeholder')
    .eq('tenant_id', tenantId);

  if (error) throw error;

  const routeMap: Record<string, Route> = {};
  for (const row of data ?? []) {
    const name = row.rte_id || 'Маршрут';
    if (!routeMap[name]) routeMap[name] = { name, count: 0, paxCount: 0, pkgCount: 0 };
    if (row.is_placeholder) continue;
    routeMap[name].count++;
    const t = (row.record_type || '').toLowerCase();
    if (t === 'пасажир' || t === 'passenger') routeMap[name].paxCount!++;
    else routeMap[name].pkgCount!++;
  }

  const routes = Object.values(routeMap).sort((a, b) => a.name.localeCompare(b.name));

  // Dispatches — count per rte_id
  const { data: dispData } = await supabase
    .from('dispatches')
    .select('rte_id')
    .eq('tenant_id', tenantId);

  const dispMap: Record<string, number> = {};
  for (const d of dispData ?? []) {
    const name = d.rte_id || '';
    dispMap[name] = (dispMap[name] || 0) + 1;
  }

  // Build shipping routes from dispatches that have distinct rte_id values
  const shipping: ShippingRoute[] = Object.entries(dispMap).map(([name, count]) => ({
    name: name.replace('Маршрут_', 'Відправка_'),
    label: name.replace('Маршрут_', 'Відправка ').replace('_', ' '),
    count,
  }));

  return { routes, shipping };
}

// ============================================
// Common route row → driver-crm object
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCommon(r: any, sheetName: string) {
  return {
    rowNum: 0,                                 // no row numbers in Supabase — use id
    _uuid: r.id,
    rteId: s(r.rte_id),
    type: s(r.record_type),
    direction: s(r.direction),
    itemId: s(r.pax_id_or_pkg_id),
    dateCreated: s(r.created_at),
    dateTrip: s(r.route_date),
    timing: s(r.timing),
    autoNum: s(r.vehicle_name),
    driver: s(r.driver_name),
    city: s(r.city),
    amount: s(r.amount),
    currency: s(r.amount_currency),
    deposit: s(r.deposit),
    depositCurrency: s(r.deposit_currency),
    payForm: s(r.payment_form),
    payStatus: s(r.payment_status),
    debt: s(r.debt),
    payNote: s(r.payment_notes),
    status: s(r.status) || 'pending',
    statusCrm: s(r.crm_status),
    tag: s(r.tag),
    note: s(r.notes),
    smsNote: s(r.sms_notes),
    tips: s(r.tips),
    tipsCurrency: s(r.tips_currency),
    sheet: sheetName,
    _statusKey: '',
    _sourceRoute: undefined as string | undefined,
  };
}

// ============================================
// Passengers
// ============================================

export async function fetchPassengers(sheetName: string): Promise<Passenger[]> {
  const tenantId = getTenantId();

  let query = supabase
    .from('routes')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('record_type', '%пасажир%');

  if (sheetName && sheetName !== '__unified__') {
    query = query.eq('rte_id', sheetName);
  }

  const { data, error } = await query;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? [] as any[])
    .filter((r: any) => r.pax_id_or_pkg_id)
    .map((r: any) => ({
      ...buildCommon(r, r.rte_id || sheetName),
      name: s(r.passenger_name),
      phone: s(r.passenger_phone),
      addrFrom: s(r.departure_address),
      addrTo: s(r.arrival_address),
      seatsCount: s(r.seats_count),
      baggageWeight: s(r.baggage_weight),
      seat: s(r.seat_number),
    } as Passenger));
}

// ============================================
// Packages
// ============================================

export async function fetchPackages(sheetName: string): Promise<Package[]> {
  const tenantId = getTenantId();

  let query = supabase
    .from('routes')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('record_type', '%посилк%');

  if (sheetName && sheetName !== '__unified__') {
    query = query.eq('rte_id', sheetName);
  }

  const { data, error } = await query;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? [] as any[])
    .filter((r: any) => r.pax_id_or_pkg_id)
    .map((r: any) => ({
      ...buildCommon(r, r.rte_id || sheetName),
      senderName: s(r.sender_name),
      senderPhone: s(r.passenger_phone),
      addrFrom: s(r.departure_address),
      recipientName: s(r.recipient_name),
      recipientPhone: s(r.recipient_phone),
      recipientAddr: s(r.recipient_address),
      internalNum: s(r.internal_number),
      ttn: s(r.ttn_number),
      pkgDesc: s(r.package_description),
      pkgWeight: s(r.package_weight),
    } as Package));
}

// ============================================
// Shipping (dispatches — read-only for driver)
// ============================================

export async function fetchShippingItems(sheetName: string): Promise<ShippingItem[]> {
  const tenantId = getTenantId();
  // sheetName comes as "Відправка_1" — map back to rte_id "Маршрут_1"
  const rteId = sheetName.replace('Відправка_', 'Маршрут_');

  let query = supabase
    .from('dispatches')
    .select('*')
    .eq('tenant_id', tenantId);

  if (sheetName && sheetName !== '__unified__') {
    query = query.eq('rte_id', rteId);
  }

  const { data, error } = await query;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? [] as any[]).map((r: any) => ({
    rowNum: 0,
    _uuid: r.id,
    dispatchId: s(r.dispatch_id),
    dateCreated: s(r.created_at),
    dateTrip: s(r.route_date),
    autoNum: s(r.vehicle_name),
    driver: s(r.driver_name),
    senderPhone: s(r.sender_phone),
    senderName: s(r.sender_name),
    recipientName: s(r.recipient_name),
    recipientPhone: s(r.recipient_phone),
    recipientAddr: s(r.recipient_address),
    internalNum: s(r.internal_number),
    weight: s(r.weight_kg),
    description: s(r.description),
    photo: s(r.photo_url),
    amount: s(r.total_amount),
    currency: s(r.payment_currency),
    deposit: s(r.deposit),
    depositCurrency: s(r.deposit_currency),
    payForm: s(r.payment_form),
    payStatus: s(r.payment_status),
    debt: s(r.debt),
    status: s(r.status),
    pkgId: s(r.pkg_id),
    note: s(r.notes),
    tips: s(r.tips),
    tipsCurrency: s(r.tips_currency),
    sheet: sheetName,
    _statusKey: '',
    _sourceRoute: undefined as string | undefined,
  }));
}

// ============================================
// Expenses
// ============================================

const CATEGORY_COL: Record<string, string> = {
  fuel: 'fuel', food: 'food', parking: 'parking', toll: 'toll',
  fine: 'fine', customs: 'customs', topUp: 'top_up', other: 'other', tips: 'tips',
};

function detectCategory(row: Record<string, unknown>): { category: string; amount: number } {
  for (const [cat, col] of Object.entries(CATEGORY_COL)) {
    const v = parseFloat(String(row[col] ?? '0')) || 0;
    if (v > 0) return { category: cat, amount: v };
  }
  return { category: 'other', amount: 0 };
}

export async function fetchExpenses(routeName: string): Promise<{ items: ExpenseItem[]; advance: ExpenseAdvance | null }> {
  const tenantId = getTenantId();

  let query = supabase
    .from('expenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (routeName && routeName !== '__unified__') {
    query = query.eq('rte_id', routeName);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  let advance: ExpenseAdvance | null = null;
  const items: ExpenseItem[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    // First row per route may contain advance info
    if (i === 0 || (!advance && (parseFloat(r.advance_cash) > 0 || parseFloat(r.advance_card) > 0))) {
      const advCash = parseFloat(r.advance_cash) || 0;
      const advCard = parseFloat(r.advance_card) || 0;
      if (advCash > 0 || advCard > 0) {
        advance = {
          cash: advCash,
          cashCurrency: r.advance_cash_currency || 'UAH',
          card: advCard,
          cardCurrency: r.advance_card_currency || 'UAH',
        };
      }
    }

    const detected = detectCategory(r);
    if (detected.amount === 0 && !r.other_description && !r.notes) continue;

    items.push({
      rowNum: 0,
      _uuid: r.id,
      expId: s(r.exp_id),
      dateTrip: s(r.trip_date ?? r.route_date),
      driver: s(r.driver_name),
      category: detected.category as ExpenseItem['category'],
      amount: detected.amount,
      currency: s(r.expense_currency) || 'CHF',
      description: s(r.other_description || r.notes || ''),
      _routeName: s(r.rte_id),
    } as ExpenseItem & { _uuid: string; _routeName: string });
  }

  return { items, advance };
}

// ============================================
// WRITE: Status Update
// ============================================

export async function updateItemStatus(
  _driverName: string,
  _routeName: string,
  item: RouteItem | { itemId: string; type: string },
  status: string,
  cancelReason = ''
) {
  const isDispatch = 'dispatchId' in item;
  const table = isDispatch ? 'dispatches' : 'routes';
  const idCol = isDispatch ? 'dispatch_id' : 'pax_id_or_pkg_id';
  const idVal = isDispatch ? (item as ShippingItem).dispatchId : (item as Passenger | Package).itemId;
  const tenantId = getTenantId();

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (cancelReason) update.cancel_reason = cancelReason;

  const { error } = await supabase
    .from(table)
    .update(update)
    .eq('tenant_id', tenantId)
    .eq(idCol, idVal);

  if (error) throw error;
  return { success: true };
}

// ============================================
// WRITE: Add new item (passenger or package)
// ============================================

export async function addRouteItem(data: Record<string, string>) {
  const tenantId = getTenantId();
  const typeRaw = data.itemType || data.type || '';
  const isPackage = typeRaw.toLowerCase().includes('посилк');

  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    rte_id: data.routeName,
    record_type: isPackage ? 'Посилка' : 'Пасажир',
    direction: data.direction || '',
    pax_id_or_pkg_id: data.itemId || `${isPackage ? 'PKG' : 'PAX'}-${Date.now()}`,
    route_date: data.dateTrip || '',
    timing: data.timing || '',
    vehicle_name: data.autoNum || '',
    driver_name: data.driverName || '',
    city: data.city || '',
    amount: data.amount || '',
    amount_currency: data.currency || '',
    payment_form: data.payForm || '',
    notes: data.note || '',
    status: 'pending',
    is_placeholder: false,
  };

  if (!isPackage) {
    row.passenger_name = data.name || '';
    row.passenger_phone = data.phone || '';
    row.departure_address = data.addrFrom || '';
    row.arrival_address = data.addrTo || '';
    row.seats_count = data.seatsCount || '';
    row.baggage_weight = data.baggageWeight || '';
  } else {
    row.sender_name = data.senderName || '';
    row.passenger_phone = data.senderPhone || '';
    row.recipient_name = data.recipientName || '';
    row.recipient_phone = data.recipientPhone || '';
    row.recipient_address = data.recipientAddr || '';
    row.departure_address = data.addrFrom || '';
    row.internal_number = data.internalNum || '';
    row.ttn_number = data.ttn || '';
    row.package_description = data.pkgDesc || '';
    row.package_weight = data.pkgWeight || '';
  }

  const { error } = await supabase.from('routes').insert(row);
  if (error) throw error;
  return { success: true };
}

// ============================================
// WRITE: Update driver fields
// ============================================

const FIELD_MAP: Record<string, string> = {
  status: 'status',
  dateTrip: 'route_date',
  timing: 'timing',
  name: 'passenger_name',
  phone: 'passenger_phone',
  addrFrom: 'departure_address',
  addrTo: 'arrival_address',
  seatsCount: 'seats_count',
  baggageWeight: 'baggage_weight',
  seat: 'seat_number',
  city: 'city',
  amount: 'amount',
  currency: 'amount_currency',
  deposit: 'deposit',
  depositCurrency: 'deposit_currency',
  payForm: 'payment_form',
  payStatus: 'payment_status',
  debt: 'debt',
  payNote: 'payment_notes',
  note: 'notes',
  smsNote: 'sms_notes',
  tag: 'tag',
  senderName: 'sender_name',
  senderPhone: 'passenger_phone',
  recipientName: 'recipient_name',
  recipientPhone: 'recipient_phone',
  recipientAddr: 'recipient_address',
  internalNum: 'internal_number',
  ttn: 'ttn_number',
  pkgDesc: 'package_description',
  pkgWeight: 'package_weight',
  weight: 'weight_kg',
  description: 'description',
  tips: 'tips',
  tipsCurrency: 'tips_currency',
};

export async function updateDriverFields(itemId: string, _routeName: string, fields: Record<string, string>) {
  const tenantId = getTenantId();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const [key, value] of Object.entries(fields)) {
    const sbCol = FIELD_MAP[key] || key;
    update[sbCol] = value;
  }

  const { error } = await supabase
    .from('routes')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('pax_id_or_pkg_id', itemId);

  if (error) throw error;
  return { success: true };
}

// ============================================
// WRITE: Add expense
// ============================================

export async function addExpense(data: Record<string, string>) {
  const tenantId = getTenantId();
  const category = data.category;
  const categoryCol = CATEGORY_COL[category];
  if (!categoryCol) throw new Error('Невалідна категорія: ' + category);

  const amount = parseFloat(data.amount);
  if (!amount || amount <= 0) throw new Error('Невалідна сума');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const expId = 'EXP-' + dateStr.replace(/-/g, '') + '-' + now.toTimeString().slice(0, 8).replace(/:/g, '');

  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    exp_id: expId,
    rte_id: data.routeName,
    trip_date: dateStr,
    driver_name: data.driverName || '',
    expense_currency: data.currency || 'CHF',
    other_description: data.description || '',
    total_expenses: amount,
    [categoryCol]: amount,
  };

  const { error } = await supabase.from('expenses').insert(row);
  if (error) throw error;
  return { success: true, expId };
}

// ============================================
// WRITE: Delete expense
// ============================================

export async function deleteExpense(data: Record<string, string>) {
  const tenantId = getTenantId();
  const expId = data.expId;

  if (!expId) throw new Error('Не вказано ID витрати');

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('exp_id', expId);

  if (error) throw error;
  return { success: true };
}

// ============================================
// WRITE: Update advance
// ============================================

export async function updateAdvance(data: Record<string, string>) {
  const tenantId = getTenantId();
  const routeName = data.routeName;

  // Advance is stored on the first expense row for a given route.
  // Find or create it.
  const { data: existing } = await supabase
    .from('expenses')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('rte_id', routeName)
    .order('created_at', { ascending: true })
    .limit(1);

  const advanceFields = {
    advance_cash: parseFloat(data.cash) || 0,
    advance_cash_currency: data.cashCurrency || 'UAH',
    advance_card: parseFloat(data.card) || 0,
    advance_card_currency: data.cardCurrency || 'UAH',
    updated_at: new Date().toISOString(),
  };

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('expenses')
      .update(advanceFields)
      .eq('id', existing[0].id);
    if (error) throw error;
  } else {
    // Create new row with advance info
    const { error } = await supabase.from('expenses').insert({
      tenant_id: tenantId,
      rte_id: routeName,
      exp_id: `ADV-${routeName}-${Date.now()}`,
      driver_name: data.driverName || '',
      ...advanceFields,
    });
    if (error) throw error;
  }

  return { success: true };
}

// ============================================
// Archive search (for autofill in AddItemModal)
// ============================================

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
  const tenantId = getTenantId();
  const q = query.trim();
  if (!q || q.length < 4) return { results: [], totalMatches: 0 };

  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`recipient_phone.ilike.%${q}%,passenger_phone.ilike.%${q}%,recipient_name.ilike.%${q}%,sender_name.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches: ArchiveMatch[] = (data ?? []).map((r: any) => ({
    dateArchive: s(r.route_date) || s(r.created_at),
    pkgId: s(r.pax_id_or_pkg_id),
    cliId: '',
    senderName: s(r.sender_name),
    senderPhone: s(r.passenger_phone),
    recipientName: s(r.recipient_name),
    recipientPhone: s(r.recipient_phone),
    recipientAddr: s(r.recipient_address),
  }));

  const seen = new Set<string>();
  const unique = matches.filter((m) => {
    const key = m.recipientPhone || m.senderPhone || m.pkgId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { results: unique.slice(0, 5), totalMatches: matches.length };
}

// ============================================
// Route Summary (client-side computation)
// ============================================

export async function buildRouteSummary(
  routeName: string,
  _driverName: string,
): Promise<import('../types').RouteSummary> {
  const [pax, pkgs, expenses] = await Promise.all([
    fetchPassengers(routeName),
    fetchPackages(routeName),
    fetchExpenses(routeName),
  ]);

  const shipName = routeName.replace('Маршрут_', 'Відправка_');
  let shipItems: import('../types').ShippingItem[] = [];
  try { shipItems = await fetchShippingItems(shipName); } catch { /* no shipping */ }

  const addCur = (obj: Record<string, number>, cur: string, val: number) => {
    if (!cur || !val) return;
    obj[cur] = (obj[cur] || 0) + val;
  };

  const paxTotals: Record<string, number> = {};
  const pkgTotals: Record<string, number> = {};
  const shipTotals: Record<string, number> = {};
  const tipsTotals: Record<string, number> = {};
  const cashCollected: Record<string, number> = {};
  const cardCollected: Record<string, number> = {};
  const debtsTotals: Record<string, number> = {};

  for (const p of pax) {
    const amt = parseFloat(p.amount) || 0;
    const cur = p.currency || 'UAH';
    addCur(paxTotals, cur, amt);
    const pf = (p.payForm || '').toLowerCase();
    if (pf === 'готівка') addCur(cashCollected, cur, amt);
    else if (pf === 'картка') addCur(cardCollected, cur, amt);
    const debt = parseFloat(p.debt) || 0;
    if (debt > 0) addCur(debtsTotals, cur, debt);
    const tip = parseFloat(p.tips) || 0;
    if (tip > 0) addCur(tipsTotals, p.tipsCurrency || 'CHF', tip);
  }

  for (const p of pkgs) {
    const amt = parseFloat(p.amount) || 0;
    const cur = p.currency || 'UAH';
    addCur(pkgTotals, cur, amt);
    const pf = (p.payForm || '').toLowerCase();
    if (pf === 'готівка') addCur(cashCollected, cur, amt);
    else if (pf === 'картка') addCur(cardCollected, cur, amt);
    const debt = parseFloat(p.debt) || 0;
    if (debt > 0) addCur(debtsTotals, cur, debt);
    const tip = parseFloat(p.tips) || 0;
    if (tip > 0) addCur(tipsTotals, p.tipsCurrency || 'CHF', tip);
  }

  for (const si of shipItems) {
    const amt = parseFloat(si.amount) || 0;
    const cur = si.currency || 'CHF';
    addCur(shipTotals, cur, amt);
    const debt = parseFloat(si.debt) || 0;
    if (debt > 0) addCur(debtsTotals, cur, debt);
    const tip = parseFloat(si.tips) || 0;
    if (tip > 0) addCur(tipsTotals, si.tipsCurrency || 'CHF', tip);
  }

  const income: Record<string, number> = {};
  for (const [c, v] of Object.entries(paxTotals)) addCur(income, c, v);
  for (const [c, v] of Object.entries(pkgTotals)) addCur(income, c, v);
  for (const [c, v] of Object.entries(shipTotals)) addCur(income, c, v);

  const expTotals: Record<string, number> = {};
  const expByCategory: Record<string, { amount: number; currency: string }> = {};
  let advCash = 0, advCashCur = 'CHF', advCard = 0, advCardCur = 'CHF';

  for (const e of expenses.items) {
    addCur(expTotals, e.currency, e.amount);
    expByCategory[e.category] = { amount: e.amount, currency: e.currency };
  }
  if (expenses.advance) {
    advCash = expenses.advance.cash;
    advCashCur = expenses.advance.cashCurrency || 'CHF';
    advCard = expenses.advance.card;
    advCardCur = expenses.advance.cardCurrency || 'CHF';
  }

  const toReturn: Record<string, number> = {};
  for (const [c, v] of Object.entries(cashCollected)) addCur(toReturn, c, v);
  for (const [c, v] of Object.entries(expTotals)) addCur(toReturn, c, -v);

  return {
    routeName,
    passengers: paxTotals,
    packages: pkgTotals,
    shipping: shipTotals,
    tips: tipsTotals,
    income,
    cashCollected,
    cardCollected,
    debts: debtsTotals,
    advanceCash: advCash,
    advanceCashCur: advCashCur,
    advanceCard: advCard,
    advanceCardCur: advCardCur,
    expenses: expTotals,
    expensesByCategory: expByCategory,
    toReturn,
  };
}

export async function saveRouteSummaryApi(
  _routeName: string,
  _driverName: string,
  _summary: import('../types').RouteSummary,
): Promise<void> {
  // Summary is computed client-side — no separate save needed
}
