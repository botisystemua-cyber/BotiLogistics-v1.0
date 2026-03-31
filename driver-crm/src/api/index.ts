import { CONFIG } from '../config';
import type { Route, ShippingRoute, Passenger, Package, ShippingItem, RouteItem } from '../types';

async function callApi<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(CONFIG.API_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const response = await fetch(url.toString());
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Невалідна відповідь: ' + text.substring(0, 200));
  }
}

async function postApi<T>(body: unknown): Promise<T> {
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Невалідна відповідь: ' + text.substring(0, 200));
  }
}

// ---- Routes ----
export async function fetchRoutes(): Promise<{ routes: Route[]; shipping: ShippingRoute[] }> {
  const data = await callApi<{
    success: boolean;
    routes?: Route[];
    shipping?: ShippingRoute[];
    error?: string;
  }>({ action: 'getAvailableRoutes' });

  if (!data.success) throw new Error(data.error || 'Помилка завантаження маршрутів');
  return { routes: data.routes || [], shipping: data.shipping || [] };
}

// ---- Passengers only ----
export async function fetchPassengers(sheetName: string): Promise<Passenger[]> {
  const data = await callApi<{
    success: boolean;
    items?: Passenger[];
    error?: string;
  }>({ action: 'getPassengers', sheet: sheetName });

  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.items || [];
}

// ---- Packages only ----
export async function fetchPackages(sheetName: string): Promise<Package[]> {
  const data = await callApi<{
    success: boolean;
    items?: Package[];
    error?: string;
  }>({ action: 'getPackages', sheet: sheetName });

  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.items || [];
}

// ---- Shipping (read-only) ----
export async function fetchShippingItems(sheetName: string): Promise<ShippingItem[]> {
  const data = await callApi<{
    success: boolean;
    items?: ShippingItem[];
    error?: string;
  }>({ action: 'getShippingItems', sheet: sheetName });

  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.items || [];
}

// ---- Status Update ----
export async function updateItemStatus(
  driverName: string,
  routeName: string,
  item: RouteItem,
  status: string,
  cancelReason = ''
) {
  return postApi({
    action: 'updateDriverStatus',
    driverId: driverName,
    routeName,
    itemId: item.itemId,
    itemType: item.type,
    phone: 'phone' in item ? item.phone : ('recipientPhone' in item ? item.recipientPhone : ''),
    status,
    cancelReason,
  });
}
