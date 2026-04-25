// ============================================================================
// fillFormConfig — налаштування «Колонки форми заповнення» нового ліда.
// Власник у owner-crm обирає, які НЕОБОВ'ЯЗКОВІ поля показувати менеджерам
// у формі «Додати посилку» (cargo) і пізніше — «Додати пасажира» (passenger).
//
// Зберігається як один JSON-рядок у system_settings.setting_value, по
// одному рядку на CRM (cargo, passenger). Дефолт — усе ввімкнено.
//
// Обов'язкові поля (телефон отримувача + адреса доставки) у конфіг не
// потрапляють і завжди видимі; їх неможливо «вимкнути» з owner-crm.
// ============================================================================

import { supabase } from '../lib/supabase';

// ---------- Опис групп і полів cargo-форми ----------

export interface FieldDef {
  key: string;
  label: string;
  hint?: string; // невелика підказка (для якого напрямку, тощо)
}

export interface FieldGroup {
  key: string;
  title: string;       // заголовок групи (з emoji)
  description?: string;
  fields: FieldDef[];
}

// Cargo-CRM: фактичні id-шники в HTML — у runtime-loader (не тут).
// Тут лише стабільні key-и + людські назви для owner UI.
export const CARGO_FILL_GROUPS: FieldGroup[] = [
  {
    key: 'sender',
    title: '📤 Відправник',
    description: 'Дані того, хто відправляє посилку. Активне у напрямку Європа → УК. Телефон і адреса — обов\'язкові (це людина, у якої забираємо посилку), знімати не можна.',
    fields: [
      { key: 'senderName',     label: 'ПІБ відправника' },
      { key: 'senderEstValue', label: 'Оціночна вартість (€)' },
      { key: 'senderWeight',   label: 'Приблизна вага (кг)' },
    ],
  },
  {
    key: 'receiver',
    title: '📥 Отримувач',
    description: 'ПІБ можна знімати окремо для кожного напрямку. Телефон отримувача та адреса доставки — обов\'язкові, прибрати не можна.',
    fields: [
      { key: 'receiverNameUe', label: 'ПІБ отримувача (УК → ЄВ)' },
      { key: 'receiverNameEu', label: 'ПІБ отримувача (ЄВ → УК)' },
    ],
  },
  {
    key: 'parcel',
    title: '📦 Деталі посилки',
    description: 'Активне у напрямку УК → Європа.',
    fields: [
      { key: 'parcelTtn',         label: 'Номер ТТН' },
      { key: 'parcelDescription', label: 'Опис вмісту' },
      { key: 'parcelQty',         label: 'Кількість позицій' },
      { key: 'parcelWeightUE',    label: 'Вага (кг)' },
      { key: 'parcelEstValueUE',  label: 'Оціночна вартість (€)' },
    ],
  },
  {
    key: 'finance',
    title: '💰 Фінанси',
    fields: [
      { key: 'parcelSum',        label: 'Сума' },
      { key: 'parcelCurrency',   label: 'Валюта' },
      { key: 'parcelPayStatus',  label: 'Статус оплати' },
      { key: 'parcelNpSum',      label: 'Сума НП', hint: 'оплата Нової Пошти (УК→ЄВ)' },
      { key: 'parcelNpCurrency', label: 'Валюта НП', hint: 'зазвичай UAH' },
    ],
  },
];

// Поля що ОБОВ'ЯЗКОВІ у певному напрямку (locked, прибрати не можна).
// directions — у яких напрямках це поле обов'язкове ('ue' = УК→ЄВ, 'eu' = ЄВ→УК).
// У формі іншого напрямку поле не показується або є опціональним.
export interface LockedFieldDef extends FieldDef {
  directions: Array<'ue' | 'eu'>;
}
export const CARGO_LOCKED_FIELDS: LockedFieldDef[] = [
  // УК→ЄВ: посилка летить у Європу — потрібен контакт того, кому довезти.
  { key: 'receiverPhone',   label: '🔒 Телефон отримувача',  hint: 'тільки УК → ЄВ (кому довезти посилку)', directions: ['ue'] },
  { key: 'receiverAddress', label: '🔒 Адреса доставки',     hint: 'тільки УК → ЄВ (куди довезти посилку)', directions: ['ue'] },
  // ЄВ→УК: посилка забирається з Європи — потрібен контакт того, у кого забрати.
  { key: 'senderPhone',     label: '🔒 Телефон відправника', hint: 'тільки ЄВ → УК (у кого забрати посилку)', directions: ['eu'] },
  { key: 'senderAddress',   label: '🔒 Адреса відправника',  hint: 'тільки ЄВ → УК (куди їдемо за посилкою)', directions: ['eu'] },
];

// ---------- Модель конфігу ----------

export interface FillFormConfig {
  /** Чи показувати блок «📋 SMS-парсер» нагорі форми. */
  smsParser: boolean;
  /** Map: fieldKey → видимість. Якщо ключа немає — вважаємо true (дефолт). */
  fields: Record<string, boolean>;
}

export function defaultCargoConfig(): FillFormConfig {
  const fields: Record<string, boolean> = {};
  for (const g of CARGO_FILL_GROUPS) {
    for (const f of g.fields) fields[f.key] = true;
  }
  return { smsParser: true, fields };
}

// ---------- Persistence (system_settings JSON-blob) ----------

const SN_CARGO = 'fill_form_cargo';

export async function getCargoFillConfig(tenantId: string): Promise<FillFormConfig> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('tenant_id', tenantId)
    .eq('setting_name', SN_CARGO)
    .limit(1);
  if (error) throw error;
  const raw = data?.[0]?.setting_value;
  if (!raw) return defaultCargoConfig();
  try {
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch (e) {
    console.warn('[fillFormConfig] невдалий парсинг JSON, повертаємо дефолт', e);
    return defaultCargoConfig();
  }
}

export async function saveCargoFillConfig(
  tenantId: string,
  cfg: FillFormConfig,
): Promise<void> {
  const json = JSON.stringify(cfg);
  await upsertSetting(tenantId, SN_CARGO, json, 'Форми', 'Колонки форми «Додати посилку»');
}

// Підмішуємо дефолти: якщо хтось руками додав/прибрав ключі в БД, або
// ми додали нові поля у CARGO_FILL_GROUPS — у пам'яті завжди повна мапа.
function mergeWithDefaults(parsed: unknown): FillFormConfig {
  const def = defaultCargoConfig();
  if (!parsed || typeof parsed !== 'object') return def;
  const p = parsed as Partial<FillFormConfig>;
  const merged: FillFormConfig = {
    smsParser: typeof p.smsParser === 'boolean' ? p.smsParser : def.smsParser,
    fields: { ...def.fields },
  };
  if (p.fields && typeof p.fields === 'object') {
    const src = p.fields as Record<string, unknown>;
    // Backward-compat: legacy `receiverName` (одна галочка для обох напрямків)
    // конвертуємо у дві нові — receiverNameUe / receiverNameEu з тим самим значенням.
    // Якщо нові ключі вже є в БД — вони перекриють legacy нижче.
    if (typeof src.receiverName === 'boolean') {
      merged.fields.receiverNameUe = src.receiverName;
      merged.fields.receiverNameEu = src.receiverName;
    }
    for (const k of Object.keys(merged.fields)) {
      const v = src[k];
      if (typeof v === 'boolean') merged.fields[k] = v;
    }
  }
  return merged;
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

  const settingId = `SET-${name}`.slice(0, 64);
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
