// ============================================================================
// pricingConfig — дефолтні ціни на квитки/багаж/посилки/завдатки.
//
// Власник у owner-crm задає числа, які підставляються у форми менеджерів
// автоматично. Менеджер може вручну переписати — manual win.
//
// Зберігається як один JSON-рядок у system_settings.setting_value з
// setting_name='pricing_defaults', по одному рядку на тенант.
//
// Усі поля — необов'язкові. `undefined`/null/'' означає «не задано» →
// форма НЕ підставляє дефолт. Це важливо для UX:
//   • якщо власник не вписав дитячу ціну — галочка «🧒 Дитячий квиток»
//     не зʼявляється у формі взагалі (нема куди переключатись).
//   • якщо власник не вписав тариф за кг посилки — авто-розрахунок
//     суми не виконується, менеджер вводить вручну.
//
// Валюта НЕ зберігається тут — вона вже задана у currency_defaults
// (CurrencyDefaultsPanel). Уся CRM працює з тією валютою.
// ============================================================================

import { supabase } from '../lib/supabase';

export interface PassengerPricing {
  ticketAdultUe?: number;   // UA→EU дорослий
  ticketAdultEu?: number;   // EU→UA дорослий
  ticketChildUe?: number;   // UA→EU дитячий
  ticketChildEu?: number;   // EU→UA дитячий
  deposit?: number;         // фіксована сума завдатку
  baggagePerKgUe?: number;  // тариф багажу UA→EU
  baggagePerKgEu?: number;  // тариф багажу EU→UA
}

export interface CargoPricing {
  // Звичайний тариф за 1 кг (фактична вага посилки).
  perKgUe?: number;             // UA→EU
  perKgEu?: number;             // EU→UA
  // Комерційний тариф за 1 кг (другий вид тарифу — для специфічних типів
  // вантажу, ставка зазвичай інша ніж звичайна).
  commercialPerKgUe?: number;   // UA→EU
  commercialPerKgEu?: number;   // EU→UA
  // Обʼємний тариф за 1 кг (для крупногабаритних). У формі менеджер вводить
  // Висота × Ширина × Довжина (см); обʼємна вага = H·W·L/4000 (формула НП).
  // Підсумкова сума = обʼємна_вага × volumetricPerKg.
  volumetricPerKgUe?: number;   // UA→EU
  volumetricPerKgEu?: number;   // EU→UA
  // Мінімальний заїзд: фікс-сума, нижче якої посилка не може коштувати
  // (легка ~2кг·€2 = €4, але мінімалка €15 → беремо €15). У cargo-формі
  // додано кнопку «🛡 Мінімалка», що одним тапом вставляє це число у поле
  // «Сума». Хардкоду «якщо менше — перетерти» немає — менеджер сам тисне.
  minOrderUe?: number;          // UA→EU
  minOrderEu?: number;          // EU→UA
}

export interface PricingConfig {
  passenger: PassengerPricing;
  cargo: CargoPricing;
}

export function defaultPricingConfig(): PricingConfig {
  return { passenger: {}, cargo: {} };
}

const SN_PRICING = 'pricing_defaults';

export async function getPricingConfig(tenantId: string): Promise<PricingConfig> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('tenant_id', tenantId)
    .eq('setting_name', SN_PRICING)
    .limit(1);
  if (error) throw error;
  const raw = data?.[0]?.setting_value;
  if (!raw) return defaultPricingConfig();
  try {
    return mergeWithDefaults(JSON.parse(raw));
  } catch (e) {
    console.warn('[pricingConfig] JSON parse failed, fallback to defaults', e);
    return defaultPricingConfig();
  }
}

export async function savePricingConfig(
  tenantId: string,
  cfg: PricingConfig,
): Promise<void> {
  // Чистимо порожні значення перед серіалізацією — щоб JSON у БД не
  // містив `null` чи 0 там, де власник нічого не вводив.
  const cleanPax: PassengerPricing = {};
  const cleanCargo: CargoPricing = {};
  for (const [k, v] of Object.entries(cfg.passenger)) {
    if (typeof v === 'number' && !isNaN(v) && v >= 0) (cleanPax as Record<string, number>)[k] = v;
  }
  for (const [k, v] of Object.entries(cfg.cargo)) {
    if (typeof v === 'number' && !isNaN(v) && v >= 0) (cleanCargo as Record<string, number>)[k] = v;
  }
  const cleaned: PricingConfig = { passenger: cleanPax, cargo: cleanCargo };
  await upsertSetting(tenantId, SN_PRICING, JSON.stringify(cleaned), 'Прайс', 'Дефолтні ціни (квитки, багаж, посилки, завдатки)');
}

// Тільки ці ключі дозволені — захист від застарілих/невідомих полів у JSON
// (наприклад legacy `cargo.deposit`, який ми прибрали — у cargo нема справжнього
// «дефолтного завдатку», там є часткова оплата без дефолту).
const PASSENGER_KEYS: Array<keyof PassengerPricing> = [
  'ticketAdultUe', 'ticketAdultEu', 'ticketChildUe', 'ticketChildEu',
  'deposit', 'baggagePerKgUe', 'baggagePerKgEu',
];
const CARGO_KEYS: Array<keyof CargoPricing> = [
  'perKgUe', 'perKgEu',
  'commercialPerKgUe', 'commercialPerKgEu',
  'volumetricPerKgUe', 'volumetricPerKgEu',
  'minOrderUe', 'minOrderEu',
];

function mergeWithDefaults(parsed: unknown): PricingConfig {
  const def = defaultPricingConfig();
  if (!parsed || typeof parsed !== 'object') return def;
  const p = parsed as Partial<PricingConfig>;
  const pickNumeric = <T extends string>(src: unknown, keys: T[]): Partial<Record<T, number>> => {
    const out: Partial<Record<T, number>> = {};
    if (!src || typeof src !== 'object') return out;
    const obj = src as Record<string, unknown>;
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === 'number' && !isNaN(v) && v >= 0) out[k] = v;
    }
    return out;
  };
  return {
    passenger: { ...def.passenger, ...pickNumeric(p.passenger, PASSENGER_KEYS) },
    cargo:     { ...def.cargo,     ...pickNumeric(p.cargo,     CARGO_KEYS) },
  };
}

async function upsertSetting(
  tenantId: string,
  name: string,
  value: string,
  section: string,
  description: string,
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from('system_settings')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('setting_name', name)
    .limit(1);
  if (selErr) throw selErr;
  const now = new Date().toISOString();

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('system_settings')
      .update({ setting_value: value, updated_date: now })
      .eq('id', existing[0].id);
    if (error) throw error;
    return;
  }

  // setting_id з tenant-префіксом — UNIQUE(setting_id) глобальний у БД,
  // тож без префіксу другий tenant не зможе виконати INSERT.
  const safeTenant = String(tenantId).replace(/[^a-z0-9-]/gi, '').slice(0, 32);
  const settingId = `SET-${safeTenant}-${name}`.slice(0, 64);
  const { error } = await supabase
    .from('system_settings')
    .insert({
      tenant_id: tenantId,
      setting_id: settingId,
      setting_section: section,
      setting_name: name,
      setting_value: value,
      setting_description: description,
      updated_date: now,
    });
  if (error) throw error;
}
