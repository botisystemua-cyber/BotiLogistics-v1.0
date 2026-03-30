import { CONFIG } from '../config';
import type { Route, ShippingRoute, Delivery, Passenger, ShippingItem } from '../types';

async function postApi<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  return response.json();
}

// ---- Cargo Routes ----
export async function fetchRoutes(): Promise<{ receiving: Route[]; shipping: ShippingRoute[] }> {
  const data = await postApi<{
    success: boolean;
    routes?: Route[];
    shipping?: ShippingRoute[];
    error?: string;
  }>(CONFIG.API_URL, { action: 'getAvailableRoutes' });

  if (!data.success) throw new Error(data.error || 'Помилка завантаження маршрутів');
  return {
    receiving: data.routes || [],
    shipping: data.shipping || [],
  };
}

// ---- Passenger Routes ----
export async function fetchPassengerRoutes(): Promise<Route[]> {
  const data = await postApi<{
    success: boolean;
    routes?: Route[];
    error?: string;
  }>(CONFIG.PASSENGER_API_URL, { action: 'getAvailableRoutes' });

  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.routes || [];
}

// ---- Deliveries ----
export async function fetchDeliveries(sheetName: string): Promise<Delivery[]> {
  const data = await postApi<{
    success: boolean;
    deliveries?: Delivery[];
    packages?: Delivery[];
    passengers?: Delivery[];
    error?: string;
  }>(CONFIG.API_URL, {
    action: 'getDeliveries',
    payload: { sheetName },
  });
  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.deliveries || data.packages || data.passengers || [];
}

// ---- Passengers ----
export async function fetchPassengers(sheetName: string): Promise<Passenger[]> {
  const data = await postApi<{
    success: boolean;
    passengers?: Passenger[];
    error?: string;
  }>(CONFIG.PASSENGER_API_URL, {
    action: 'getPassengers',
    payload: { sheetName },
  });
  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.passengers || [];
}

// ---- Shipping items (read-only) ----
export async function fetchShippingItems(sheetName: string): Promise<ShippingItem[]> {
  const data = await postApi<{
    success: boolean;
    items?: ShippingItem[];
    error?: string;
  }>(CONFIG.API_URL, {
    action: 'getShippingItems',
    payload: { sheetName },
  });
  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.items || [];
}

// ---- Delivery Status Update ----
export async function updateDeliveryStatus(
  driverName: string,
  routeName: string,
  delivery: Delivery,
  status: string,
  cancelReason = ''
) {
  return postApi(CONFIG.API_URL, {
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

// ---- Passenger Status Update ----
export async function updatePassengerStatus(
  driverName: string,
  routeName: string,
  passenger: Passenger,
  status: string,
  cancelReason = ''
) {
  return postApi<{ success: boolean; error?: string }>(CONFIG.PASSENGER_API_URL, {
    action: 'updateDriverStatus',
    driverId: driverName,
    routeName,
    passengerId: passenger.id || '',
    phone: passenger.phone || '',
    address: passenger.from || '',
    status,
    cancelReason,
  });
}

// ---- Transfer Passenger ----
export async function transferPassenger(
  passenger: Passenger,
  sourceRoute: string,
  targetRoute: string
) {
  const passengerData: Record<string, unknown[]> = {
    [targetRoute]: [{
      date: passenger.date || '', from: passenger.from || '', to: passenger.to || '',
      seats: passenger.seats || '1', name: passenger.name || '', phone: passenger.phone || '',
      mark: passenger.mark || '', payment: passenger.payment || '', percent: passenger.percent || '',
      dispatcher: passenger.dispatcher || '', id: passenger.id || '', phoneReg: passenger.phoneReg || '',
      weight: passenger.weight || '', timing: passenger.timing || '', dateReg: passenger.dateReg || '',
      note: passenger.note || '', sourceSheet: sourceRoute,
    }],
  };
  const copyResult = await postApi<{ success: boolean; error?: string }>(
    CONFIG.PASSENGER_API_URL,
    { action: 'copyToRoute', payload: { passengersByVehicle: passengerData, conflictAction: 'add' } }
  );
  if (!copyResult.success) throw new Error(copyResult.error || 'Помилка копіювання');

  const delResult = await postApi<{ success: boolean; error?: string }>(
    CONFIG.PASSENGER_API_URL,
    { action: 'deleteRoutePassenger', payload: { sheetName: sourceRoute, rowNum: passenger.rowNum, expectedId: passenger.id || '' } }
  );
  if (!delResult.success) throw new Error('Скопійовано, але не вдалося видалити з ' + sourceRoute);
}

// ---- Add ----
export async function addDeliveryToRoute(sheetName: string, data: Record<string, string>) {
  return postApi<{ success: boolean; error?: string }>(CONFIG.API_URL, {
    action: 'addPackageToRoute',
    payload: { sheetName, ...data },
  });
}

export async function addPassengerToRoute(sheetName: string, data: Record<string, string>) {
  return postApi<{ success: boolean; error?: string }>(CONFIG.PASSENGER_API_URL, {
    action: 'addPassengerToRoute',
    payload: { sheetName, ...data },
  });
}
