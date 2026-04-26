import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import {
  defaultPricingConfig,
  getPricingConfig,
  savePricingConfig,
  type PricingConfig,
  type PassengerPricing,
  type CargoPricing,
} from '../api/pricingConfig';

// Панель «💰 Прайс» у owner-crm Налаштування. Власник задає дефолтні ціни,
// що автоматично підставляються у форми менеджерів при створенні нових
// лідів. Менеджер може переписати вручну (manual win).
//
// Усі поля — опціональні. Залиште порожнім → дефолт не підставляється,
// галочка «🧒 Дитячий» у passenger-формі не зʼявиться, авто-розрахунок
// «Сума = вага × тариф» у cargo не виконається.
export function PricingDefaultsPanel({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cfg, setCfg] = useState<PricingConfig>(defaultPricingConfig());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await getPricingConfig(tenantId);
      setCfg(fresh);
      setDirty(false);
    } catch (e) {
      console.warn('[PricingDefaults] load failed:', e);
      setCfg(defaultPricingConfig());
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const setPax = (k: keyof PassengerPricing, v: number | undefined) => {
    setCfg(prev => ({ ...prev, passenger: { ...prev.passenger, [k]: v } }));
    setDirty(true);
  };
  const setCargo = (k: keyof CargoPricing, v: number | undefined) => {
    setCfg(prev => ({ ...prev, cargo: { ...prev.cargo, [k]: v } }));
    setDirty(true);
  };
  const reset = () => {
    setCfg(defaultPricingConfig());
    setDirty(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await savePricingConfig(tenantId, cfg);
      setDirty(false);
    } catch (e) {
      console.error('[PricingDefaults] save failed:', e);
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
            <h2 className="text-base lg:text-lg font-extrabold text-text">💰 Прайс</h2>
            <p className="text-xs lg:text-sm text-muted mt-0.5">
              Дефолтні ціни, що підставляються у форми менеджерів автоматично.
              Менеджер може переписати вручну. Валюту беремо з блоку «Валюти» вище.
            </p>
          </div>
        </button>
      </div>

      {!open ? null : loading ? (
        <div className="text-center py-8 text-muted text-sm">Завантаження…</div>
      ) : (
        <div className="space-y-5">
          {/* PASSENGER */}
          <div className="rounded-xl border border-border p-4 lg:p-5 bg-bg">
            <h3 className="text-sm lg:text-base font-extrabold text-text mb-1">🚐 Пасажирська CRM</h3>
            <p className="text-xs text-muted mb-4">
              Якщо ціну не вписано — дефолт у форму не підставляється. Дитячі поля
              лишіть порожніми, якщо не пропонуєте дитячі квитки — галочка «🧒 Дитячий»
              у формі менеджера не зʼявиться.
            </p>

            {/* Дорослий квиток */}
            <FieldGroup title="🎫 Дорослий квиток">
              <NumField label="UA → EU" value={cfg.passenger.ticketAdultUe} onChange={v => setPax('ticketAdultUe', v)} placeholder="100" />
              <NumField label="EU → UA" value={cfg.passenger.ticketAdultEu} onChange={v => setPax('ticketAdultEu', v)} placeholder="120" />
            </FieldGroup>

            {/* Дитячий квиток */}
            <FieldGroup title="🧒 Дитячий квиток (опціонально)">
              <NumField label="UA → EU" value={cfg.passenger.ticketChildUe} onChange={v => setPax('ticketChildUe', v)} placeholder="50" />
              <NumField label="EU → UA" value={cfg.passenger.ticketChildEu} onChange={v => setPax('ticketChildEu', v)} placeholder="60" />
            </FieldGroup>

            {/* Багаж */}
            <FieldGroup title="🧳 Багаж — ціна за 1 кг">
              <NumField label="UA → EU" value={cfg.passenger.baggagePerKgUe} onChange={v => setPax('baggagePerKgUe', v)} placeholder="2" step="0.1" />
              <NumField label="EU → UA" value={cfg.passenger.baggagePerKgEu} onChange={v => setPax('baggagePerKgEu', v)} placeholder="1.5" step="0.1" />
            </FieldGroup>

            {/* Завдаток */}
            <FieldGroup title="💵 Завдаток (фіксована сума)">
              <NumField label="Завдаток" value={cfg.passenger.deposit} onChange={v => setPax('deposit', v)} placeholder="20" />
            </FieldGroup>
          </div>

          {/* CARGO */}
          <div className="rounded-xl border border-border p-4 lg:p-5 bg-bg">
            <h3 className="text-sm lg:text-base font-extrabold text-text mb-1">📦 Посилкова CRM</h3>
            <p className="text-xs text-muted mb-4">
              Тариф за 1 кг множиться на введену вагу — поле «Сума» у формі
              «Нова посилка» заповнюється автоматично. Менеджер може переписати.
            </p>

            <FieldGroup title="📦 Тариф за 1 кг посилки">
              <NumField label="UA → EU" value={cfg.cargo.perKgUe} onChange={v => setCargo('perKgUe', v)} placeholder="3" step="0.1" />
              <NumField label="EU → UA" value={cfg.cargo.perKgEu} onChange={v => setCargo('perKgEu', v)} placeholder="3.5" step="0.1" />
            </FieldGroup>

            <FieldGroup title="💵 Завдаток (фіксована сума)">
              <NumField label="Завдаток" value={cfg.cargo.deposit} onChange={v => setCargo('deposit', v)} placeholder="20" />
            </FieldGroup>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-sm lg:text-base disabled:opacity-50 cursor-pointer hover:brightness-110 transition-all"
            >
              {saving ? 'Збереження…' : dirty ? '💾 Зберегти прайс' : '✓ Збережено'}
            </button>
            <button
              onClick={reset}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-border text-text font-semibold text-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer hover:bg-bg-light transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Скинути все
            </button>
            {dirty && <span className="text-xs text-amber-700">Є незбережені зміни</span>}
          </div>
          <p className="text-xs text-muted">
            Зміни застосовуються при наступному завантаженні CRM (F5 у вкладці менеджера).
          </p>
        </div>
      )}
    </section>
  );
}

// ---------- helpers ----------

function FieldGroup(
  { title, children }:
  { title: string; children: React.ReactNode },
) {
  return (
    <div className="rounded-lg border border-border bg-white p-3 lg:p-4 mb-3">
      <div className="font-bold text-xs text-text mb-2 uppercase tracking-wide opacity-70">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function NumField(
  { label, value, onChange, placeholder, step }:
  {
    label: string;
    value: number | undefined;
    onChange: (v: number | undefined) => void;
    placeholder?: string;
    step?: string;
  },
) {
  const enabled = value !== undefined;
  // Запам'ятовуємо останнє введене значення, щоб при OFF→ON відновити, а
  // не давати юзеру «свіжі 0». Якщо поле приходить з БД заповненим —
  // ініціалізуємо ним; інакше — null (нічого не пам'ятаємо).
  const lastValueRef = useRef<number | undefined>(value);
  useEffect(() => { if (value !== undefined) lastValueRef.current = value; }, [value]);

  const toggle = () => {
    if (enabled) {
      // OFF: значення в БД не піде (undefined), але lastValueRef зберігає
      // останнє введене на випадок, якщо юзер передумає.
      onChange(undefined);
    } else {
      // ON: відновлюємо попереднє значення; якщо ніколи не було — placeholder
      // як підказка (зберігаємо як число для сумісності зі стейтом).
      const prev = lastValueRef.current;
      const fallback = placeholder ? parseFloat(placeholder) : 0;
      onChange(prev !== undefined ? prev : (isNaN(fallback) ? 0 : fallback));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggle}
          className="w-4 h-4 cursor-pointer accent-brand flex-shrink-0"
          title={enabled ? 'Вимкнути дефолт' : 'Увімкнути дефолт'}
        />
        <span className={`text-[11px] font-semibold ${enabled ? 'text-muted' : 'text-gray-400'}`}>
          {label}
        </span>
      </div>
      <input
        type="number"
        min="0"
        step={step || '1'}
        disabled={!enabled}
        value={enabled && value !== undefined ? String(value) : ''}
        onChange={e => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          const n = parseFloat(raw);
          if (!isNaN(n)) lastValueRef.current = n;
          onChange(isNaN(n) ? undefined : n);
        }}
        placeholder={enabled ? (placeholder || '0') : 'вимкнено'}
        className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
          enabled
            ? 'border-border bg-white text-text focus:outline-none focus:border-brand'
            : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      />
    </div>
  );
}
