import { useState } from 'react';
import { ChevronRight, ChevronDown, Check, Save, RefreshCw, RotateCcw } from 'lucide-react';
import {
  CURRENCIES,
  saveCurrencySettings,
  type CurrencyCode,
  type CurrencyFieldKey,
  type CurrencyOverrides,
  type CurrencySettings,
} from '../api/currencies';

// Нетехнічні лейбли полів — видно у власника-управлінця, водія. Без «passenger_*».
const FIELD_LABELS: Record<CurrencyFieldKey, { label: string; hint: string }> = {
  passenger_ticket:  { label: 'Ціна квитка',        hint: 'Коли вводиш вартість квитка пасажира' },
  passenger_deposit: { label: 'Завдаток за квиток', hint: 'Коли пасажир вносить завдаток' },
  passenger_baggage: { label: 'Оплата багажу',      hint: 'Коли вводиш вартість багажу' },
  package_payment:   { label: 'Оплата посилки',     hint: 'Коли вводиш суму за посилку' },
  package_deposit:   { label: 'Завдаток за посилку', hint: 'Коли відправник вносить завдаток' },
  package_np:        { label: 'Накладений платіж',  hint: 'Коли отримувач платить готівкою при отриманні' },
};

const FIELD_GROUPS: { title: string; icon: string; keys: CurrencyFieldKey[] }[] = [
  { title: 'Пасажири', icon: '\u{1F465}', keys: ['passenger_ticket', 'passenger_deposit', 'passenger_baggage'] },
  { title: 'Посилки',  icon: '\u{1F4E6}', keys: ['package_payment',  'package_deposit',   'package_np'] },
];

function shallowEqOverrides(a: CurrencyOverrides, b: CurrencyOverrides): boolean {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i]) return false;
    if (a[ak[i] as CurrencyFieldKey] !== b[bk[i] as CurrencyFieldKey]) return false;
  }
  return true;
}

export function CurrenciesPanel({
  tenantId,
  settings,
  onReload,
}: {
  tenantId: string;
  settings: CurrencySettings;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [defaultCode, setDefaultCode] = useState<CurrencyCode>(settings.default);
  const [enabled, setEnabled] = useState<Set<CurrencyCode>>(new Set(settings.enabled));
  const [overrides, setOverrides] = useState<CurrencyOverrides>({ ...settings.overrides });
  const [saving, setSaving] = useState(false);

  const dirty =
    defaultCode !== settings.default ||
    enabled.size !== settings.enabled.length ||
    [...enabled].some(c => !settings.enabled.includes(c)) ||
    !shallowEqOverrides(overrides, settings.overrides);

  const toggle = (code: CurrencyCode) => {
    setEnabled(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const setOverride = (key: CurrencyFieldKey, code: CurrencyCode | '') => {
    setOverrides(prev => {
      const next = { ...prev };
      if (!code || code === defaultCode) delete next[key];
      else next[key] = code;
      return next;
    });
  };

  const clearAllOverrides = () => setOverrides({});

  const save = async () => {
    if (enabled.size === 0) {
      alert('Має бути увімкнена хоча б одна валюта');
      return;
    }
    setSaving(true);
    try {
      const enabledOrdered = CURRENCIES.filter(c => enabled.has(c.code)).map(c => c.code);
      await saveCurrencySettings(tenantId, {
        default: defaultCode,
        enabled: enabledOrdered,
        overrides,
      });
      onReload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
    setSaving(false);
  };

  const reset = () => {
    setDefaultCode(settings.default);
    setEnabled(new Set(settings.enabled));
    setOverrides({ ...settings.overrides });
  };

  const optionsForSelect = CURRENCIES.filter(c => enabled.has(c.code));
  const overrideCount = Object.keys(overrides).filter(k => overrides[k as CurrencyFieldKey] && overrides[k as CurrencyFieldKey] !== defaultCode).length;

  return (
    <section className="mt-6 lg:mt-8">
      {/* Section header — clickable to toggle */}
      <div className="border-b border-border pb-3 lg:pb-4 mb-4 lg:mb-5">
        <button
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-2 w-full text-left cursor-pointer group"
        >
          <ChevronRight className={`w-4 h-4 lg:w-5 lg:h-5 text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
          <div className="flex-1 min-w-0">
            <h2 className="text-base lg:text-lg font-extrabold text-text">Валюти</h2>
            <p className="text-xs lg:text-sm text-muted mt-0.5">
              Яка валюта підставляється в полях оплати та які взагалі доступні
            </p>
          </div>
        </button>
      </div>

      {open && (
        <div className="space-y-4 lg:space-y-5">
          {/* Default currency row */}
          <div className="rounded-xl lg:rounded-2xl border border-border bg-white p-3 lg:p-5">
            <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-2 lg:mb-2.5">
              Основна валюта
            </label>
            <select
              value={defaultCode}
              onChange={e => setDefaultCode(e.target.value as CurrencyCode)}
              className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand transition-all"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.name} ({c.symbol})
                </option>
              ))}
            </select>
            <p className="text-[11px] lg:text-xs text-muted mt-2">
              Ця валюта автоматично підставляється в усі поля оплати. Можна змінити нижче окремо для кожного випадку.
            </p>
          </div>

          {/* ─── Accordion: per-field overrides ─── */}
          <div className="rounded-xl lg:rounded-2xl border border-border bg-white overflow-hidden">
            <button
              onClick={() => setAdvOpen(prev => !prev)}
              className="w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-5 py-3 lg:py-4 text-left cursor-pointer hover:bg-bg transition-colors"
            >
              {advOpen
                ? <ChevronDown className="w-4 h-4 lg:w-5 lg:h-5 text-muted shrink-0" />
                : <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-muted shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm lg:text-base font-bold text-text">Окремо для кожного виду оплати</div>
                <div className="text-[11px] lg:text-xs text-muted mt-0.5">
                  {overrideCount > 0
                    ? `Налаштовано окремо: ${overrideCount}`
                    : 'Наприклад, завдаток у гривнях, а квиток у євро'}
                </div>
              </div>
              {overrideCount > 0 && (
                <span className="text-[10px] lg:text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                  {overrideCount}
                </span>
              )}
            </button>

            {advOpen && (
              <div className="border-t border-border px-3 lg:px-5 py-3 lg:py-4 space-y-4 lg:space-y-5 bg-bg/40">
                {FIELD_GROUPS.map(group => (
                  <div key={group.title}>
                    <div className="flex items-center gap-2 mb-2 lg:mb-2.5">
                      <span className="text-base lg:text-lg">{group.icon}</span>
                      <span className="text-[11px] lg:text-xs font-bold text-muted uppercase tracking-wider">
                        {group.title}
                      </span>
                    </div>
                    <div className="space-y-2 lg:space-y-2.5">
                      {group.keys.map(k => {
                        const fieldLabel = FIELD_LABELS[k];
                        const current = overrides[k];
                        const isCustom = !!current && current !== defaultCode;
                        return (
                          <div
                            key={k}
                            className={`flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl border transition-colors ${
                              isCustom ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-border'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm lg:text-base font-bold text-text truncate">{fieldLabel.label}</div>
                              <div className="text-[10px] lg:text-xs text-muted truncate">{fieldLabel.hint}</div>
                            </div>
                            <select
                              value={current ?? ''}
                              onChange={e => setOverride(k, e.target.value as CurrencyCode | '')}
                              className={`px-2.5 lg:px-3 py-2 rounded-lg border text-sm font-bold focus:outline-none focus:border-brand transition-all shrink-0 ${
                                isCustom ? 'bg-white border-amber-300 text-amber-900' : 'bg-bg border-border text-text'
                              }`}
                              style={{ minWidth: 130 }}
                            >
                              <option value="">
                                Як основна ({defaultCode})
                              </option>
                              {optionsForSelect.map(c => (
                                <option key={c.code} value={c.code}>
                                  {c.flag} {c.code}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {overrideCount > 0 && (
                  <button
                    onClick={clearAllOverrides}
                    className="w-full py-2 lg:py-2.5 rounded-xl border border-border bg-white text-text-secondary text-sm font-semibold hover:bg-bg hover:text-text cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Скинути всі до основної валюти
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Enabled currencies grid */}
          <div>
            <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-2 lg:mb-2.5">
              Увімкнені валюти
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-3">
              {CURRENCIES.map(c => {
                const isOn = enabled.has(c.code);
                return (
                  <button
                    key={c.code}
                    onClick={() => toggle(c.code)}
                    className={`flex items-center gap-2.5 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isOn
                        ? 'bg-white border-brand shadow-sm'
                        : 'bg-gray-50 border-gray-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center shrink-0 text-lg ${
                      isOn ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-100 border border-gray-200'
                    }`}>
                      {c.flag}
                    </div>
                    <span className="flex-1 text-sm lg:text-base font-bold text-text">{c.code}</span>
                    <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      isOn ? 'bg-brand border-brand' : 'bg-white border-gray-300'
                    }`}>
                      {isOn && <Check className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          {dirty && (
            <div className="flex gap-2 lg:gap-3 sticky bottom-0 bg-bg/90 backdrop-blur py-3 -mx-1 px-1">
              <button
                onClick={reset}
                disabled={saving}
                className="px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl border border-border bg-white text-text text-sm font-bold hover:bg-bg cursor-pointer transition-all disabled:opacity-40"
              >
                Скасувати
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 lg:py-3 rounded-xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-all disabled:opacity-40"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
