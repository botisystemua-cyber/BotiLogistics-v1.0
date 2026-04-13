import { supabase } from '../lib/supabase';
import { UA_ES_TEMPLATE } from '../data/uaEsTemplate';

// ================================================================
// Типи
// ================================================================

export type DeliveryMode = 'point' | 'address_and_point';

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
  delivery_mode: DeliveryMode;
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
  id: number,
  patch: Partial<RoutePointInput>,
): Promise<RoutePoint> {
  const { data, error } = await supabase
    .from('passenger_route_points')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as RoutePoint;
}

export async function deleteRoutePoint(id: number): Promise<void> {
  const { error } = await supabase
    .from('passenger_route_points')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Піднімає точку на одну позицію вгору (міняє sort_order з сусідньою точкою).
// Повертає true якщо swap відбувся, false якщо точка вже зверху.
export async function swapRoutePointOrder(
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
  await updateRoutePoint(a.id, { sort_order: tmp });
  await updateRoutePoint(b.id, { sort_order: a.sort_order });
  await updateRoutePoint(a.id, { sort_order: b.sort_order });
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
  id: number,
  patch: Partial<RoutePriceInput>,
): Promise<RoutePrice> {
  const { data, error } = await supabase
    .from('passenger_route_prices')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as RoutePrice;
}

export async function deleteRoutePrice(id: number): Promise<void> {
  const { error } = await supabase
    .from('passenger_route_prices')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ================================================================
// Шаблон UA→ES: швидке заповнення порожнього тенанта
// ================================================================

// Імпортує 23 точки + всі цінові правила (з реверсом) з константного шаблону.
// Ідемпотентний: якщо точка з тим самим name_ua вже існує у тенанті/групі,
// вона пропускається (унікальний ключ спрацьовує на UNIQUE(tenant,group,name_ua)).
// Ціни так само пропускаються за UNIQUE(tenant,from,to,currency).
// Повертає скільки точок і цін було додано.
export async function importUaEsTemplate(
  tenantId: string,
): Promise<{ pointsCreated: number; pricesCreated: number }> {
  const routeGroup = 'ua-es-wed';

  // 1) Вставляємо точки. Використовуємо upsert з ignoreDuplicates щоб повторний
  // імпорт не падав, а лише пропускав уже існуючі.
  const pointRows = UA_ES_TEMPLATE.points.map(p => ({
    tenant_id: tenantId,
    route_group: routeGroup,
    name_ua: p.name_ua,
    country_code: p.country_code,
    sort_order: p.sort_order,
    location_name: p.location_name,
    lat: p.lat,
    lon: p.lon,
    maps_url: p.maps_url,
    delivery_mode: p.delivery_mode,
    active: true,
  }));

  const { data: insertedPoints, error: pointErr } = await supabase
    .from('passenger_route_points')
    .upsert(pointRows, {
      onConflict: 'tenant_id,route_group,name_ua',
      ignoreDuplicates: true,
    })
    .select();
  if (pointErr) throw pointErr;
  const pointsCreated = (insertedPoints ?? []).length;

  // 2) Витягуємо всі точки цього тенанта (щоб мати name_ua → id мапінг для цін)
  const allPoints = await listRoutePointsByTenant(tenantId, routeGroup);
  const idByName: Record<string, number> = {};
  for (const p of allPoints) idByName[p.name_ua] = p.id;

  // 3) Будуємо цінові правила за шаблоном. Кожне правило описане як
  // `{ from: "Чернівці", to: "Малага", price: 200 }` — ми його мапимо на id
  // і дублюємо для реверса.
  const priceRows: Array<{
    tenant_id: string;
    from_point_id: number;
    to_point_id: number;
    currency: string;
    price: number;
    active: boolean;
  }> = [];
  for (const rule of UA_ES_TEMPLATE.prices) {
    const fromId = idByName[rule.from];
    const toId = idByName[rule.to];
    if (!fromId || !toId) continue; // точки не імпортовані — пропускаємо
    priceRows.push({
      tenant_id: tenantId,
      from_point_id: fromId,
      to_point_id: toId,
      currency: 'EUR',
      price: rule.price,
      active: true,
    });
    if (rule.reverse !== false) {
      priceRows.push({
        tenant_id: tenantId,
        from_point_id: toId,
        to_point_id: fromId,
        currency: 'EUR',
        price: rule.price,
        active: true,
      });
    }
  }

  if (priceRows.length === 0) return { pointsCreated, pricesCreated: 0 };

  const { data: insertedPrices, error: priceErr } = await supabase
    .from('passenger_route_prices')
    .upsert(priceRows, {
      onConflict: 'tenant_id,from_point_id,to_point_id,currency',
      ignoreDuplicates: true,
    })
    .select();
  if (priceErr) throw priceErr;

  return { pointsCreated, pricesCreated: (insertedPrices ?? []).length };
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
