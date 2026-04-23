// Per-user UI-налаштування (тема, приховані колонки тощо) зберігаються
// у users.ui_prefs (jsonb). Ключі пласкі з префіксом app-і:
// «cargo_card_cols», «pax_hidden_cols», «driver_theme» тощо — щоб три
// CRM не конфліктували в одному blob'і.
//
// Кеш у пам'яті синхронно читається всюди, асинхронно підтягується з БД
// один раз на старті (loadUiPrefs), і write-through оновлюється при
// setUiPref — щоб зміни одразу підхоплювалися наступним рендером.

import { supabase } from './supabase';
import { readSession } from './session';

type UiPrefs = Record<string, unknown>;

let cache: UiPrefs = {};
let loaded = false;

export async function loadUiPrefs(): Promise<UiPrefs> {
  const s = readSession();
  if (!s || !s.tenant_id || !s.user_login) {
    cache = {};
    loaded = true;
    return cache;
  }
  try {
    const { data, error } = await supabase
      .from('users')
      .select('ui_prefs')
      .eq('tenant_id', s.tenant_id)
      .eq('login', s.user_login)
      .maybeSingle();
    if (error) throw error;
    cache = (data && (data.ui_prefs as UiPrefs)) || {};
  } catch (e) {
    console.warn('[uiPrefs] load failed:', e);
    cache = {};
  }
  loaded = true;
  return cache;
}

export function getUiPrefSync<T = unknown>(key: string, fallback: T): T {
  if (!loaded) return fallback;
  const v = cache[key];
  return (v === undefined || v === null) ? fallback : (v as T);
}

export async function setUiPref(key: string, value: unknown): Promise<void> {
  cache = { ...cache, [key]: value };
  const s = readSession();
  if (!s || !s.tenant_id || !s.user_login) return;
  try {
    const { error } = await supabase
      .from('users')
      .update({ ui_prefs: cache })
      .eq('tenant_id', s.tenant_id)
      .eq('login', s.user_login);
    if (error) throw error;
  } catch (e) {
    console.warn('[uiPrefs] save failed (key=' + key + '):', e);
  }
}
