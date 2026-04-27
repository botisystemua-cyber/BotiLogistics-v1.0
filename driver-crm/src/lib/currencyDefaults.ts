// Гранулярні дефолти валют з owner-crm CurrencyDefaultsPanel
// (system_settings.currency_defaults, JSON у setting_value).
//
// Структура: { cargo: {payment, deposit, np, tips}, passenger: {ticket, deposit, tips} }.
// Сканер посилок уже читає це у scaner_ttn.html (window.sbGetCurrencyDefault).
// Drv-CRM раніше показував лише те, що було записано в самій посилці —
// тут додаємо fallback-кеш, щоб старі записи з порожньою валютою все одно
// показувалися з тим, що власник вибрав у панелі.
//
// Кеш sync (як uiPrefs.ts) — заповнюється один раз при старті AppProvider.

import { supabase } from './supabase';
import { readSession } from './session';

type Section = Record<string, string>;
type Defaults = Record<string, Section>;

let cache: Defaults = {};
let loaded = false;

export async function loadCurrencyDefaults(): Promise<void> {
  const s = readSession();
  if (!s || !s.tenant_id) {
    loaded = true;
    return;
  }
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('tenant_id', s.tenant_id)
      .eq('setting_name', 'currency_defaults')
      .maybeSingle();
    if (error) throw error;
    const raw = data?.setting_value;
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === 'object') cache = parsed as Defaults;
    }
  } catch (e) {
    console.warn('[currencyDefaults] load failed:', e);
  }
  loaded = true;
}

export function getCurrencyDefault(app: string, field: string, fallback = ''): string {
  if (!loaded) return fallback;
  const section = cache[app];
  if (!section || typeof section !== 'object') return fallback;
  return section[field] || fallback;
}
