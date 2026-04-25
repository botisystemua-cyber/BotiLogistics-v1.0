import { useEffect, useState, useCallback } from 'react';
import { ChevronRight, Lock, RotateCcw } from 'lucide-react';
import {
  CARGO_FILL_GROUPS,
  CARGO_LOCKED_FIELDS,
  defaultCargoConfig,
  getCargoFillConfig,
  saveCargoFillConfig,
  type FillFormConfig,
} from '../api/fillFormConfig';

// Панель «📋 Колонки форми заповнення». Поки що тільки cargo-вкладка.
// Passenger додам після того, як cargo стабілізуємо.
export function FillFormConfigPanel({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cfg, setCfg] = useState<FillFormConfig>(defaultCargoConfig());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await getCargoFillConfig(tenantId);
      setCfg(fresh);
      setDirty(false);
    } catch (e) {
      console.warn('[FillFormConfig] load failed:', e);
      setCfg(defaultCargoConfig());
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const toggleField = (key: string) => {
    setCfg(prev => ({ ...prev, fields: { ...prev.fields, [key]: !prev.fields[key] } }));
    setDirty(true);
  };
  const toggleSms = () => {
    setCfg(prev => ({ ...prev, smsParser: !prev.smsParser }));
    setDirty(true);
  };
  const resetDefaults = () => {
    setCfg(defaultCargoConfig());
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveCargoFillConfig(tenantId, cfg);
      setDirty(false);
    } catch (e) {
      console.error('[FillFormConfig] save failed:', e);
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
            <h2 className="text-base lg:text-lg font-extrabold text-text">📋 Колонки форми заповнення</h2>
            <p className="text-xs lg:text-sm text-muted mt-0.5">
              Які поля показувати менеджерам у формі «Додати посилку». Обов'язкові поля прибрати не можна.
            </p>
          </div>
        </button>
      </div>

      {!open ? null : loading ? (
        <div className="text-center py-8 text-muted text-sm">Завантаження…</div>
      ) : (
        <div className="space-y-5">
          {/* TODO: коли додамо passenger — тут буде [📦 Посилкова] [👥 Пасажирська] tab-bar */}
          <div className="rounded-xl border border-border p-4 lg:p-5 bg-bg">
            <h3 className="text-sm lg:text-base font-extrabold text-text mb-1">📦 Посилкова CRM</h3>
            <p className="text-xs text-muted mb-4">
              Налаштування форми «➕ Додати посилку» (cargo-crm). Зніміть галочки з полів,
              які не потрібні менеджерам у вашій конфігурації.
            </p>

            {/* Заблоковані поля — інформативно */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
              <div className="text-xs font-bold text-amber-900 mb-2 uppercase tracking-wide">
                Завжди вгорі форми (прибрати не можна)
              </div>
              <ul className="space-y-1.5">
                {CARGO_LOCKED_FIELDS.map(f => (
                  <li key={f.key} className="flex items-center gap-2 text-sm text-amber-900">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-semibold">{f.label.replace(/^🔒\s*/, '')}</span>
                    {f.hint && <span className="text-xs text-amber-700">— {f.hint}</span>}
                  </li>
                ))}
              </ul>
            </div>

            {/* SMS-парсер toggle */}
            <label className="flex items-start gap-3 mb-5 p-3 rounded-lg border border-border bg-white cursor-pointer hover:bg-bg-light transition-colors">
              <input
                type="checkbox"
                checked={cfg.smsParser}
                onChange={toggleSms}
                className="mt-0.5 w-4 h-4 cursor-pointer accent-brand"
              />
              <div className="flex-1">
                <div className="text-sm font-bold text-text">📋 Розпізнавання SMS</div>
                <div className="text-xs text-muted mt-0.5">
                  Блок «Вставте текст повідомлення» нагорі форми. Менеджер вставляє текст —
                  парсер автоматично заповнює телефон, вагу, адресу. Якщо вимкнути — блок
                  взагалі не з'являється у формі.
                </div>
              </div>
            </label>

            {/* Групи полів */}
            <div className="space-y-4">
              {CARGO_FILL_GROUPS.map(g => (
                <div key={g.key} className="rounded-lg border border-border bg-white p-3 lg:p-4">
                  <div className="font-bold text-sm text-text mb-1">{g.title}</div>
                  {g.description && <div className="text-xs text-muted mb-3">{g.description}</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.fields.map(f => {
                      const checked = cfg.fields[f.key] !== false;
                      return (
                        <label
                          key={f.key}
                          className="flex items-center gap-2 p-2 rounded border border-border-light cursor-pointer hover:bg-bg-light transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleField(f.key)}
                            className="w-4 h-4 cursor-pointer accent-brand"
                          />
                          <span className="text-sm text-text">{f.label}</span>
                          {f.hint && <span className="text-xs text-muted ml-auto">{f.hint}</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-sm lg:text-base disabled:opacity-50 cursor-pointer hover:brightness-110 transition-all"
            >
              {saving ? 'Збереження…' : dirty ? '💾 Зберегти налаштування' : '✓ Збережено'}
            </button>
            <button
              onClick={resetDefaults}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-border text-text font-semibold text-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer hover:bg-bg-light transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Скинути на стандарт
            </button>
            {dirty && (
              <span className="text-xs text-amber-700">Є незбережені зміни</span>
            )}
          </div>
          <p className="text-xs text-muted">
            Зміни застосовуються при наступному завантаженні cargo-CRM (F5 у вкладці менеджера).
            Live-preview справа — у наступній версії.
          </p>
        </div>
      )}
    </section>
  );
}
