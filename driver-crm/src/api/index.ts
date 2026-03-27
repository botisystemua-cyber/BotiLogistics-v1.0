import { CONFIG } from '../config';
import type { PassengerRoute, Delivery, Passenger } from '../types';

async function postApi<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  return response.json();
}

// ---- Routes ----
export async function fetchPassengerRoutes(): Promise<PassengerRoute[]> {
  const data = await postApi<{ success: boolean; routes?: PassengerRoute[] }>(
    CONFIG.ROUTES_API_URL,
    { action: 'getAvailableRoutes' }
  );
  if (data.success && data.routes) return data.routes;
  return [];
}

// ---- Deliveries ----
export async function fetchDeliveries(vehicleName: string): Promise<Delivery[]> {
  const data = await postApi<{
    success: boolean;
    passengers?: Delivery[];
    packages?: Delivery[];
    deliveries?: Delivery[];
    error?: string;
  }>(CONFIG.DELIVERY_API_URL, {
    action: 'getRoutePassengers',
    payload: { vehicleName },
  });
  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.passengers || data.packages || data.deliveries || [];
}

// ---- Passengers ----
export async function fetchPassengers(sheetName: string): Promise<Passenger[]> {
  const data = await postApi<{
    success: boolean;
    passengers?: Passenger[];
    error?: string;
  }>(CONFIG.PASSENGER_API_URL, {
    action: 'getRoutePassengers',
    payload: { sheetName },
  });
  if (!data.success) throw new Error(data.error || 'Помилка завантаження');
  return data.passengers || [];
}

// ---- Status Updates ----
export async function updateDeliveryStatus(
  driverName: string,
  routeName: string,
  delivery: Delivery,
  status: string,
  cancelReason = ''
) {
  return postApi(CONFIG.DELIVERY_API_URL, {
    date: new Date().toLocaleDateString('uk-UA'),
    time: new Date().toLocaleTimeString('uk-UA'),
    driverId: driverName,
    routeName,
    deliveryNumber: delivery.internalNumber,
    address: delivery.address,
    status,
    cancelReason,
    phone: delivery.phone,
    price: delivery.price || delivery.amount,
  });
}

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

// ---- Transfer ----
export async function transferPassenger(
  passenger: Passenger,
  sourceRoute: string,
  targetRoute: string
) {
  // 1. Copy to target
  const passengerData: Record<string, unknown[]> = {
    [targetRoute]: [
      {
        date: passenger.date || '',
        from: passenger.from || '',
        to: passenger.to || '',
        seats: passenger.seats || 1,
        name: passenger.name || '',
        phone: passenger.phone || '',
        mark: passenger.mark || '',
        payment: passenger.payment || '',
        percent: passenger.percent || '',
        dispatcher: passenger.dispatcher || '',
        id: passenger.id || '',
        phoneReg: passenger.phoneReg || '',
        weight: passenger.weight || '',
        timing: passenger.timing || '',
        dateReg: passenger.dateReg || '',
        note: passenger.note || '',
        sourceSheet: sourceRoute,
      },
    ],
  };
  const copyResult = await postApi<{ success: boolean; error?: string }>(
    CONFIG.PASSENGER_API_URL,
    {
      action: 'copyToRoute',
      payload: { passengersByVehicle: passengerData, conflictAction: 'add' },
    }
  );
  if (!copyResult.success) throw new Error(copyResult.error || 'Помилка копіювання');

  // 2. Delete from source
  const delResult = await postApi<{ success: boolean; error?: string }>(
    CONFIG.PASSENGER_API_URL,
    {
      action: 'deleteRoutePassenger',
      payload: {
        sheetName: sourceRoute,
        rowNum: passenger.rowNum,
        expectedId: passenger.id || '',
      },
    }
  );
  if (!delResult.success)
    throw new Error('Скопійовано, але не вдалося видалити з ' + sourceRoute);
}

// ---- Add Lead ----
export async function addDeliveryToRoute(vehicleName: string, data: Record<string, string>) {
  return postApi<{ success: boolean; error?: string }>(CONFIG.DELIVERY_API_URL, {
    action: 'addPackageToRoute',
    payload: { vehicleName, ...data },
  });
}

export async function addPassengerToRoute(sheetName: string, data: Record<string, string>) {
  return postApi<{ success: boolean; error?: string }>(CONFIG.PASSENGER_API_URL, {
    action: 'addPassengerToRoute',
    payload: { sheetName, ...data },
  });
}
