import { supabase } from '../lib/supabase';

export type CurrencyCode =
  | 'UAH' | 'EUR' | 'USD' | 'CHF' | 'PLN' | 'CZK'
  | 'GBP' | 'SEK' | 'NOK' | 'DKK' | 'HUF' | 'RON';

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;
  symbol: string;
  flag: string;
}

export const CURRENCIES: readonly CurrencyInfo[] = [
  { code: 'UAH', name: 'Гривня',               symbol: '₴',   flag: '\u{1F1FA}\u{1F1E6}' },
  { code: 'EUR', name: 'Євро',                 symbol: '€',   flag: '\u{1F1EA}\u{1F1FA}' },
  { code: 'USD', name: 'Долар США',            symbol: '$',   flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'CHF', name: 'Швейцарський франк',   symbol: 'Fr',  flag: '\u{1F1E8}\u{1F1ED}' },
  { code: 'PLN', name: 'Польський злотий',     symbol: 'zł',  flag: '\u{1F1F5}\u{1F1F1}' },
  { code: 'CZK', name: 'Чеська крона',         symbol: 'Kč',  flag: '\u{1F1E8}\u{1F1FF}' },
  { code: 'GBP', name: 'Фунт стерлінгів',      symbol: '£',   flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'SEK', name: 'Шведська крона',       symbol: 'kr',  flag: '\u{1F1F8}\u{1F1EA}' },
  { code: 'NOK', name: 'Норвезька крона',      symbol: 'kr',  flag: '\u{1F1F3}\u{1F1F4}' },
  { code: 'DKK', name: 'Данська крона',        symbol: 'kr',  flag: '\u{1F1E9}\u{1F1F0}' },
  { code: 'HUF', name: 'Угорський форинт',     symbol: 'Ft',  flag: '\u{1F1ED}\u{1F1FA}' },
  { code: 'RON', name: 'Румунський лей',       symbol: 'lei', flag: '\u{1F1F7}\u{1F1F4}' },
] as const;

export const DEFAULT_ENABLED: CurrencyCode[] = ['UAH', 'EUR', 'USD', 'CHF', 'PLN', 'CZK'];
export const DEFAULT_DEFAULT: CurrencyCode = 'EUR';

export interface CurrencySettings {
  default: CurrencyCode;
  enabled: CurrencyCode[];
}

const SN_DEFAULT = 'default_currency';
const SN_SUPPORTED = 'supported_currencies';

function isCurrencyCode(v: string): v is CurrencyCode {
  return CURRENCIES.some(c => c.code === v);
}

function parseEnabled(raw: string | null | undefined): CurrencyCode[] {
  if (!raw) return [...DEFAULT_ENABLED];
  const codes = raw.split(',').map(s => s.trim()).filter(isCurrencyCode);
  return codes.length > 0 ? codes : [...DEFAULT_ENABLED];
}

export async function getCurrencySettings(tenantId: string): Promise<CurrencySettings> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_name, setting_value')
    .eq('tenant_id', tenantId)
    .in('setting_name', [SN_DEFAULT, SN_SUPPORTED]);
  if (error) throw error;
  const rows = data ?? [];
  const enabled = parseEnabled(rows.find(r => r.setting_name === SN_SUPPORTED)?.setting_value);
  const rawDefault = rows.find(r => r.setting_name === SN_DEFAULT)?.setting_value?.trim() ?? '';
  // Default та enabled — незалежні. EUR — фолбек якщо нічого не збережено.
  const def: CurrencyCode = isCurrencyCode(rawDefault) ? rawDefault : DEFAULT_DEFAULT;
  return { default: def, enabled };
}

export async function saveCurrencySettings(
  tenantId: string,
  settings: CurrencySettings,
): Promise<void> {
  if (settings.enabled.length === 0) {
    throw new Error('Має бути увімкнена хоча б одна валюта');
  }
  await upsertSetting(tenantId, SN_DEFAULT, settings.default, 'Система', 'Валюта за замовчуванням');
  await upsertSetting(tenantId, SN_SUPPORTED, settings.enabled.join(','), 'Система', 'Підтримувані валюти');
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
    .select('id, setting_id')
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

  // setting_id з tenant_id-префіксом, бо UNIQUE constraint на колонці
  // setting_id глобальний — без префіксу другий tenant не зможе зберегти.
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
