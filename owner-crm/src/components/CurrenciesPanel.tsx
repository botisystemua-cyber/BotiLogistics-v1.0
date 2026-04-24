import { useState } from 'react';
import { ChevronRight, Check, Save, RefreshCw } from 'lucide-react';
import {
  CURRENCIES,
  saveCurrencySettings,
  type CurrencyCode,
  type CurrencySettings,
} from '../api/currencies';

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
  const [defaultCode, setDefaultCode] = useState<CurrencyCode>(settings.default);
  const [enabled, setEnabled] = useState<Set<CurrencyCode>>(new Set(settings.enabled));
  const [saving, setSaving] = useState(false);

  const dirty =
    defaultCode !== settings.default ||
    enabled.size !== settings.enabled.length ||
    [...enabled].some(c => !settings.enabled.includes(c));

  const toggle = (code: CurrencyCode) => {
    setEnabled(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const pickDefault = (code: CurrencyCode) => {
    setDefaultCode(code);
  };

  const save = async () => {
    if (enabled.size === 0) {
      alert('Має бути увімкнена хоча б одна валюта');
      return;
    }
    setSaving(true);
    try {
      const enabledOrdered = CURRENCIES.filter(c => enabled.has(c.code)).map(c => c.code);
      await saveCurrencySettings(tenantId, { default: defaultCode, enabled: enabledOrdered });
      onReload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
    setSaving(false);
  };

  const reset = () => {
    setDefaultCode(settings.default);
    setEnabled(new Set(settings.enabled));
  };

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
              Які валюти показувати в полях оплати та яка обирається за замовчуванням
            </p>
          </div>
        </button>
      </div>

      {open && (
        <div className="space-y-4 lg:space-y-5">
          {/* Default currency row */}
          <div className="rounded-xl lg:rounded-2xl border border-border bg-white p-3 lg:p-5">
            <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-2 lg:mb-2.5">
              Валюта за замовчуванням
            </label>
            <select
              value={defaultCode}
              onChange={e => pickDefault(e.target.value as CurrencyCode)}
              className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand transition-all"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.name} ({c.symbol})
                </option>
              ))}
            </select>
            <p className="text-[11px] lg:text-xs text-muted mt-2">
              Ця валюта буде передобрана при додаванні нового пасажира чи посилки
            </p>
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
