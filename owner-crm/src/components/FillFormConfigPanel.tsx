import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
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
        <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
          {/* ===== ЛІВА КОЛОНКА: налаштування ===== */}
          <div className="space-y-5">
            <div className="rounded-xl border border-border p-4 lg:p-5 bg-bg">
              <h3 className="text-sm lg:text-base font-extrabold text-text mb-1">📦 Посилкова CRM</h3>
              <p className="text-xs text-muted mb-4">
                Зніміть галочки з полів, які не потрібні менеджерам.
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
                    Блок нагорі форми, куди менеджер вставляє текст і парсер автоматично
                    заповнює поля. Якщо вимкнути — блок взагалі не з'являється.
                  </div>
                </div>
              </label>

              {/* Групи полів */}
              <div className="space-y-4">
                {CARGO_FILL_GROUPS.map(g => (
                  <div key={g.key} className="rounded-lg border border-border bg-white p-3 lg:p-4">
                    <div className="font-bold text-sm text-text mb-1">{g.title}</div>
                    {g.description && <div className="text-xs text-muted mb-3">{g.description}</div>}
                    <div className="space-y-2">
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
            </p>
          </div>

          {/* ===== ПРАВА КОЛОНКА: live preview ===== */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <CargoFillFormPreview cfg={cfg} />
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Live-preview макет форми «Додати посилку» — рендериться синхронно з конфігом.
// Це не функціональна форма, лише візуалізація: оператор бачить, як буде
// виглядати реальна форма в cargo-crm після збереження. Стилізовано близько до
// справжнього cargo (бренд amber #92400e), але без логіки.
//
// Прев'ю має DIRECTION-перемикач, бо реальна cargo-форма показує різні
// блоки в УК→ЄВ і ЄВ→УК. У ЄВ→УК — окремий «📤 Відправник (Європа)» зі
// своїми полями (ПІБ/телефон/адреса). У УК→ЄВ цього блоку взагалі немає,
// бо відправник — клієнт з України, його дані не вводяться окремо.
// Плейсхолдери телефонів теж залежать від напрямку.
// ============================================================================
type Dir = 'ue' | 'eu'; // 'ue' = УК→ЄВ, 'eu' = ЄВ→УК (узгоджено з cargo-crm/Cargo.js)

function CargoFillFormPreview({ cfg }: { cfg: FillFormConfig }) {
  const [dir, setDir] = useState<Dir>('ue');
  const isOn = (k: string) => cfg.fields[k] !== false;

  const isUe = dir === 'ue';
  // Плейсхолдери залежно від напрямку:
  // - УК→ЄВ: відправник (UA, +380), отримувач (EU, +41/+49)
  // - ЄВ→УК: відправник (EU), отримувач (UA, +380)
  const recvPhonePlaceholder = isUe ? '+41… / +49…' : '+380…';
  const recvAddrPlaceholder  = isUe ? 'Цюрих, Bahnhofstrasse 12' : 'Київ, вул. Хрещатик, буд. 5 / НП…';

  // У реальній cargo-формі sender-блок (з полями fSender/fPhone/fAddressFrom)
  // існує лише для напрямку ЄВ→УК. У УК→ЄВ його немає. У ЄВ→УК телефон і
  // адреса відправника обов'язкові — тому секція завжди є для ЄВ→УК.
  const showSenderSection = !isUe;
  // Деталі посилки і НП-фінанси активні лише в УК→ЄВ.
  const showParcelDetails = isUe && (
    isOn('parcelTtn') || isOn('parcelDescription') || isOn('parcelQty') ||
    isOn('parcelWeightUE') || isOn('parcelEstValueUE')
  );
  const showFinance = isUe && (
    isOn('parcelSum') || isOn('parcelCurrency') || isOn('parcelPayStatus') ||
    isOn('parcelNpSum') || isOn('parcelNpCurrency')
  );

  return (
    <div className="rounded-xl border-2 border-amber-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-amber-700 to-amber-800 text-white px-4 py-3 flex items-center justify-between">
        <span className="font-extrabold text-sm">➕ Додати посилку</span>
        <span className="text-xs opacity-80">прев'ю</span>
      </div>
      <div className="p-4 space-y-3 max-h-[680px] overflow-y-auto">
        {/* Direction toggle — клікабельний, превʼю перебудовується */}
        <div className="flex gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setDir('ue')}
            className={`flex-1 px-3 py-2 rounded-lg text-center transition-colors ${
              isUe ? 'bg-amber-100 text-amber-900 border border-amber-300'
                   : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'
            }`}
          >
            🇺🇦 → 🇪🇺 УК → Європа
          </button>
          <button
            type="button"
            onClick={() => setDir('eu')}
            className={`flex-1 px-3 py-2 rounded-lg text-center transition-colors ${
              !isUe ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'
            }`}
          >
            🇪🇺 → 🇺🇦 Європа → УК
          </button>
        </div>

        {/* SMS-парсер */}
        {cfg.smsParser && (
          <PreviewSection title="📋 SMS-парсер" amber>
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/30 p-3 text-xs text-amber-800 italic">
              «Турко Сергій +41797856664 Цюріх, документи 2кг»
            </div>
            <PreviewBtn label="🔍 Розпізнати та заповнити" />
          </PreviewSection>
        )}

        {/* Locked fields — first, always */}
        <PreviewSection title="🔒 Обов'язкові поля" locked>
          <PreviewField label="Телефон отримувача *" placeholder={recvPhonePlaceholder} locked />
          <PreviewField label="Адреса доставки *"    placeholder={recvAddrPlaceholder}  locked />
        </PreviewSection>

        {/* Sender section — лише для ЄВ→УК. Телефон + адреса locked
            (контакт людини, у якої забираємо посилку — обов'язкові). */}
        {showSenderSection && (
          <PreviewSection title="📤 Відправник (Європа)">
            {isOn('senderName') && <PreviewField label="ПІБ відправника" placeholder="Прізвище Ім'я" />}
            <PreviewField label="Телефон відправника *" placeholder="+41… / +49…" locked />
            <PreviewField label="Адреса відправника *"  placeholder="Введіть адресу…" locked />
            <div className="grid grid-cols-2 gap-2">
              {isOn('senderEstValue') && <PreviewField label="Оцін. вартість (€)" placeholder="0" />}
              {isOn('senderWeight')   && <PreviewField label="Вага (кг)"         placeholder="0" />}
            </div>
          </PreviewSection>
        )}

        {/* Receiver name (toggle, per-direction) */}
        {((isUe && isOn('receiverNameUe')) || (!isUe && isOn('receiverNameEu'))) && (
          <PreviewSection title="📥 Отримувач (додатково)">
            <PreviewField label="ПІБ отримувача" placeholder="Прізвище Ім'я По-батькові" />
          </PreviewSection>
        )}

        {/* Parcel details — лише для УК→ЄВ */}
        {showParcelDetails && (
          <PreviewSection title="📦 Деталі посилки">
            {isOn('parcelTtn') && <PreviewField label="Номер ТТН" placeholder="59001…" />}
            <div className="grid grid-cols-2 gap-2">
              {isOn('parcelWeightUE')   && <PreviewField label="Вага (кг)"          placeholder="0" />}
              {isOn('parcelEstValueUE') && <PreviewField label="Оцін. вартість (€)" placeholder="0" />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {isOn('parcelDescription') && <PreviewField label="Опис вмісту" placeholder="Що всередині…" />}
              {isOn('parcelQty')         && <PreviewField label="Кількість"   placeholder="1" />}
            </div>
          </PreviewSection>
        )}

        {/* Finance — лише для УК→ЄВ */}
        {showFinance && (
          <PreviewSection title="💰 Фінанси">
            <div className="grid grid-cols-2 gap-2">
              {isOn('parcelSum')      && <PreviewField label="Сума"   placeholder="0" />}
              {isOn('parcelCurrency') && <PreviewField label="Валюта" placeholder="EUR" />}
            </div>
            {isOn('parcelPayStatus') && <PreviewField label="Статус оплати" placeholder="Не оплачено" />}
            {(isOn('parcelNpSum') || isOn('parcelNpCurrency')) && (
              <div className="grid grid-cols-2 gap-2">
                {isOn('parcelNpSum')      && <PreviewField label="Сума НП (₴)" placeholder="0" />}
                {isOn('parcelNpCurrency') && <PreviewField label="Валюта НП"   placeholder="UAH" />}
              </div>
            )}
          </PreviewSection>
        )}

        {/* Footer (always) */}
        <div className="flex gap-2 pt-2">
          <button className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs font-bold cursor-default" disabled>Скасувати</button>
          <button className="flex-1 py-2 rounded-lg bg-amber-700 text-white text-xs font-bold cursor-default" disabled>💾 Зберегти</button>
        </div>
      </div>
    </div>
  );
}

function PreviewSection(
  { title, children, amber, locked }:
  { title: string; children: ReactNode; amber?: boolean; locked?: boolean },
) {
  const bg = locked ? 'bg-amber-50 border-amber-200'
           : amber  ? 'bg-amber-50/40 border-amber-100'
           : 'bg-gray-50 border-gray-200';
  return (
    <div className={`rounded-lg border ${bg} p-3`}>
      <div className="text-xs font-extrabold text-text mb-2 uppercase tracking-wide opacity-80">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PreviewField(
  { label, placeholder, locked }:
  { label: string; placeholder?: string; locked?: boolean },
) {
  return (
    <div>
      <div className={`text-[11px] font-semibold mb-0.5 ${locked ? 'text-amber-900' : 'text-gray-600'}`}>
        {locked && <Lock className="inline-block w-3 h-3 mr-1 -mt-0.5" />}
        {label}
      </div>
      <div className={`h-7 rounded border px-2 flex items-center text-[11px] italic ${
        locked
          ? 'bg-amber-50 border-amber-300 text-amber-700'
          : 'bg-white border-gray-200 text-gray-400'
      }`}>
        {placeholder || ''}
      </div>
    </div>
  );
}

function PreviewBtn({ label }: { label: string }) {
  return (
    <div className="mt-2 h-7 rounded bg-amber-700/80 text-white text-[11px] font-bold flex items-center justify-center cursor-default">
      {label}
    </div>
  );
}
