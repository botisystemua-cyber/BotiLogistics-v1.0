import { supabase } from '../lib/supabase';

// ================================================================
// Типи
// ================================================================

export interface RoutePoint {
  id: number;
  tenant_id: string;
  route_group: string;
  name_ua: string;
  country_code: string;
  sort_order: number;
  location_name: string | null;
  lat: number | null;
  lon: number | null;
  maps_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type RoutePointInput = Omit<
  RoutePoint,
  'id' | 'tenant_id' | 'created_at' | 'updated_at'
>;

export interface RoutePrice {
  id: number;
  tenant_id: string;
  from_point_id: number;
  to_point_id: number;
  currency: string;
  price: number;
  active: boolean;
  created_at: string;
}

export type RoutePriceInput = Omit<
  RoutePrice,
  'id' | 'tenant_id' | 'created_at'
>;

// ================================================================
// Route points CRUD
// ================================================================

export async function listRoutePointsByTenant(
  tenantId: string,
  routeGroup = 'ua-es-wed',
): Promise<RoutePoint[]> {
  const { data, error } = await supabase
    .from('passenger_route_points')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('route_group', routeGroup)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RoutePoint[];
}

export async function createRoutePoint(
  tenantId: string,
  input: RoutePointInput,
): Promise<RoutePoint> {
  const { data, error } = await supabase
    .from('passenger_route_points')
    .insert({ ...input, tenant_id: tenantId })
    .select()
    .single();
  if (error) throw error;
  return data as RoutePoint;
}

export async function updateRoutePoint(
  tenantId: string,
  id: number,
  patch: Partial<RoutePointInput>,
): Promise<RoutePoint> {
  const { data, error } = await supabase
    .from('passenger_route_points')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (error) throw error;
  return data as RoutePoint;
}

export async function deleteRoutePoint(tenantId: string, id: number): Promise<void> {
  const { error } = await supabase
    .from('passenger_route_points')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

// Піднімає точку на одну позицію вгору (міняє sort_order з сусідньою точкою).
// Повертає true якщо swap відбувся, false якщо точка вже зверху.
export async function swapRoutePointOrder(
  tenantId: string,
  points: RoutePoint[],
  idx: number,
  direction: 'up' | 'down',
): Promise<boolean> {
  const other = direction === 'up' ? idx - 1 : idx + 1;
  if (other < 0 || other >= points.length) return false;
  const a = points[idx];
  const b = points[other];
  // Тимчасове значення щоб уникнути конфлікту унікальності по (tenant,route_group,sort_order)
  // якщо такий індекс колись додамо. Зараз UNIQUE тільки по name_ua, але перестраховуємось.
  const tmp = -Math.abs(a.sort_order) - 1;
  await updateRoutePoint(tenantId, a.id, { sort_order: tmp });
  await updateRoutePoint(tenantId, b.id, { sort_order: a.sort_order });
  await updateRoutePoint(tenantId, a.id, { sort_order: b.sort_order });
  return true;
}

// ================================================================
// Route prices CRUD
// ================================================================

export async function listRoutePricesByTenant(
  tenantId: string,
): Promise<RoutePrice[]> {
  const { data, error } = await supabase
    .from('passenger_route_prices')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('from_point_id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RoutePrice[];
}

export async function createRoutePrice(
  tenantId: string,
  input: RoutePriceInput,
): Promise<RoutePrice> {
  const { data, error } = await supabase
    .from('passenger_route_prices')
    .insert({ ...input, tenant_id: tenantId })
    .select()
    .single();
  if (error) throw error;
  return data as RoutePrice;
}

// Створити одразу дві дзеркальні ціни (from→to і to→from з тією самою сумою).
// Якщо один з напрямків уже існує — ігноруємо конфлікт і створюємо лише відсутній.
export async function createRoutePriceWithReverse(
  tenantId: string,
  input: RoutePriceInput,
): Promise<{ created: number }> {
  const rows = [
    { ...input, tenant_id: tenantId },
    {
      ...input,
      tenant_id: tenantId,
      from_point_id: input.to_point_id,
      to_point_id: input.from_point_id,
    },
  ];
  const { data, error } = await supabase
    .from('passenger_route_prices')
    .upsert(rows, {
      onConflict: 'tenant_id,from_point_id,to_point_id,currency',
      ignoreDuplicates: true,
    })
    .select();
  if (error) throw error;
  return { created: (data ?? []).length };
}

export async function updateRoutePrice(
  tenantId: string,
  id: number,
  patch: Partial<RoutePriceInput>,
): Promise<RoutePrice> {
  const { data, error } = await supabase
    .from('passenger_route_prices')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (error) throw error;
  return data as RoutePrice;
}

export async function deleteRoutePrice(tenantId: string, id: number): Promise<void> {
  const { error } = await supabase
    .from('passenger_route_prices')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

// ================================================================
// Утиліти: розпарсити координати з URL Google Maps
// ================================================================

// Витягує [lat, lon] з повного URL google.com/maps/... Якщо коротке посилання
// (maps.app.goo.gl/...) — розгортання в браузері неможливе через CORS,
// повертається null (користувач має ввести координати вручну).
export function extractLatLonFromMapsUrl(url: string): [number, number] | null {
  if (!url) return null;
  // Формат 1: /@LAT,LON,ZOOMz або /@LAT,LON (найчастіший у google.com/maps/)
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return [parseFloat(at[1]), parseFloat(at[2])];
  // Формат 2: !3dLAT!4dLON (всередині data-параметрів)
  const d = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (d) return [parseFloat(d[1]), parseFloat(d[2])];
  // Формат 3: query=LAT,LON або q=LAT,LON
  const q = url.match(/[?&](?:query|q)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return [parseFloat(q[1]), parseFloat(q[2])];
  return null;
}
