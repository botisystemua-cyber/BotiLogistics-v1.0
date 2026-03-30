import { CONFIG } from '../config';
import type { Route, ShippingRoute, Delivery, ShippingItem } from '../types';

async function postApi<T>(body: unknown): Promise<T> {
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  return response.json();
}

// ---- Routes ----
export async function fetchRoutes(): Promise<{ receiving: Route[]; shipping: ShippingRoute[] }> {
  const data = await postApi<{
    success: boolean;
    routes?: Route[];
    shipping?: ShippingRoute[];
    error?: string;
  }>({ action: 'getAvailableRoutes' });

  if (!data.success) throw new Error(data.error || 'Помилка завантаження маршрутів');
  return {
    receiving: data.routes || [],
    shipping: data.shipping || [],
  };
}

// ---- Deliveries (отримання) ----
export async function fetchDeliveries(sheetName: string): Promise<Delivery[]> {
  const data = await postApi<{
    success: boolean;
    deliveries?: Delivery[];
    packages?: Delivery[];
    passengers?: Delivery[];
    error?: string;
  }>({
    action: 'getDeliveries',
    payload: { sheetName },
  });
  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.deliveries || data.packages || data.passengers || [];
}

// ---- Shipping items (відправлення, read-only) ----
export async function fetchShippingItems(sheetName: string): Promise<ShippingItem[]> {
  const data = await postApi<{
    success: boolean;
    items?: ShippingItem[];
    error?: string;
  }>({
    action: 'getShippingItems',
    payload: { sheetName },
  });
  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.items || [];
}

// ---- Status Update ----
export async function updateDeliveryStatus(
  driverName: string,
  routeName: string,
  delivery: Delivery,
  status: string,
  cancelReason = ''
) {
  return postApi(  {
    action: 'updateDriverStatus',
    driverId: driverName,
    routeName,
    deliveryId: delivery.id || delivery.internalNumber,
    address: delivery.address,
    status,
    cancelReason,
    phone: delivery.phone,
  });
}

// ---- Add Delivery ----
export async function addDeliveryToRoute(sheetName: string, data: Record<string, string>) {
  return postApi<{ success: boolean; error?: string }>({
    action: 'addPackageToRoute',
    payload: { sheetName, ...data },
  });
}
