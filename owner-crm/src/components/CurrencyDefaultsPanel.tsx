import { useEffect, useState, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Типи: два под-блоки налаштувань, cargo + passenger. Назви полів
// відповідають семантиці (payment / deposit / np / tips / ticket).
interface CargoDefaults {
  payment?: string;   // Сума (посилки)
  deposit?: string;   // Завдаток
  np?: string;        // НП (Нова Пошта)
  tips?: string;      // Чайові водію
}
interface PassengerDefaults {
  ticket?: string;    // Квиток
  deposit?: string;   // Завдаток
  tips?: string;      // Чайові
}
interface CurrencyDefaults {
  cargo?: CargoDefaults;
  passenger?: PassengerDefaults;
}

const CURRENCIES = ['EUR', 'UAH', 'CHF', 'PLN', 'CZK', 'USD'];
const SETTING_NAME = 'currency_defaults';
const SETTING_SECTION = 'currencies';
const SETTING_DESCRIPTION = 'Дефолти валют per-app / per-field (cargo + passenger)';

export function CurrencyDefaultsPanel({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaults, setDefaults] = useState<CurrencyDefaults>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Дані живуть як один рядок у system_settings з setting_name='currency_defaults',
      // setting_value — JSON-рядок об'єкта. Того самого патерну як інші налаштування
      // (default_currency / supported_currencies).
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('tenant_id', tenantId)
        .eq('setting_name', SETTING_NAME)
        .maybeSingle();
      if (error) throw error;
      let parsed: CurrencyDefaults = {};
      if (data?.setting_value) {
        try { parsed = JSON.parse(data.setting_value) as CurrencyDefaults; } catch { /* corrupt */ }
      }
      setDefaults(parsed || {});
    } catch (e) {
      console.warn('[CurrencyDefaults] load failed:', e);
      setDefaults({});
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const setCargoField = (field: keyof CargoDefaults, value: string) => {
    setDefaults(prev => ({ ...prev, cargo: { ...(prev.cargo || {}), [field]: value } }));
  };
  const setPaxField = (field: keyof PassengerDefaults, value: string) => {
    setDefaults(prev => ({ ...prev, passenger: { ...(prev.passenger || {}), [field]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const value = JSON.stringify(defaults);
      const now = new Date().toISOString();

      // Чи є вже такий рядок? (tenant_id + setting_name — унікальна пара, але
      // явного UNIQUE constraint на PostgREST onConflict немає, тож робимо
      // select → update/insert вручну.)
      const { data: existing, error: selErr } = await supabase
        .from('system_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('setting_name', SETTING_NAME)
        .limit(1);
      if (selErr) throw selErr;

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('system_settings')
          .update({ setting_value: value, updated_date: now })
          .eq('id', existing[0].id);
        if (error) throw error;
      } else {
        // setting_id має містити tenant_id, інакше при першому збереженні
        // у новому tenant порушується UNIQUE(setting_id) — бо інший tenant
        // вже має рядок з setting_id='SET-currency_defaults'.
        const safeTenant = String(tenantId).replace(/[^a-z0-9-]/gi, '').slice(0, 32);
        const { error } = await supabase
          .from('system_settings')
          .insert({
            tenant_id: tenantId,
            setting_id: `SET-${safeTenant}-${SETTING_NAME}`.slice(0, 64),
            setting_section: SETTING_SECTION,
            setting_name: SETTING_NAME,
            setting_value: value,
            setting_description: SETTING_DESCRIPTION,
            updated_date: now,
          });
        if (error) throw error;
      }
    } catch (e) {
      console.error('[CurrencyDefaults] save failed:', e);
      alert('Не вдалось зберегти: ' + (e as Error).message);
    }
    setSaving(false);
  };

  return (
    <section className="mt-6 lg:mt-8">
      <div className="border-b border-border pb-3 lg:pb-4 mb-4 lg:mb-5">
        <button
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-2 w-full text-left cursor-pointer group"
        >
          <ChevronRight
            className={`w-4 h-4 lg:w-5 lg:h-5 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base lg:text-lg font-extrabold text-text">Валюти</h2>
            <p className="text-xs lg:text-sm text-muted mt-0.5">
              Які валюти показувати в полях оплати та яка обирається за замовчуванням
            </p>
          </div>
        </button>
      </div>

      {!open ? null : loading ? (
        <div className="text-center py-8 text-muted text-sm">Завантаження…</div>
      ) : (
        <div className="space-y-6">
          {/* CARGO */}
          <div className="rounded-xl border border-border p-4 lg:p-5 bg-bg">
            <h3 className="text-sm lg:text-base font-extrabold text-text mb-3">
              📦 Посилки (cargo)
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <CurrencyField label="Сума" value={defaults.cargo?.payment} onChange={v => setCargoField('payment', v)} />
              <CurrencyField label="Завдаток" value={defaults.cargo?.deposit} onChange={v => setCargoField('deposit', v)} />
              <CurrencyField label="НП" value={defaults.cargo?.np} onChange={v => setCargoField('np', v)} />
              <CurrencyField label="Чайові" value={defaults.cargo?.tips} onChange={v => setCargoField('tips', v)} />
            </div>
          </div>

          {/* PASSENGER */}
          <div className="rounded-xl border border-border p-4 lg:p-5 bg-bg">
            <h3 className="text-sm lg:text-base font-extrabold text-text mb-3">
              🚐 Пасажири (passenger)
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <CurrencyField label="Квиток" value={defaults.passenger?.ticket} onChange={v => setPaxField('ticket', v)} />
              <CurrencyField label="Завдаток" value={defaults.passenger?.deposit} onChange={v => setPaxField('deposit', v)} />
              <CurrencyField label="Чайові" value={defaults.passenger?.tips} onChange={v => setPaxField('tips', v)} />
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-sm lg:text-base disabled:opacity-60 cursor-pointer hover:brightness-110 transition-all"
          >
            {saving ? 'Збереження…' : 'Зберегти налаштування'}
          </button>
          <p className="text-xs text-muted">
            Зміни застосовуються при наступному завантаженні cargo-CRM і passenger-CRM (F5 у кожній вкладці).
          </p>
        </div>
      )}
    </section>
  );
}

function CurrencyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-card text-sm font-semibold cursor-pointer"
      >
        <option value="">— (не задано)</option>
        {CURRENCIES.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </label>
  );
}
