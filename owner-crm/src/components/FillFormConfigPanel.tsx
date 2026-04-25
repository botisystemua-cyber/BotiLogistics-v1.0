import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, Lock, RotateCcw } from 'lucide-react';
import {
  CARGO_FILL_GROUPS,
  defaultCargoConfig,
  getCargoFillConfig,
  saveCargoFillConfig,
  PASSENGER_FILL_GROUPS,
  PASSENGER_LOCKED_FIELDS,
  defaultPassengerConfig,
  getPassengerFillConfig,
  savePassengerFillConfig,
  type FillFormConfig,
  type FieldDef,
} from '../api/fillFormConfig';

// Напрямок: 'ue' = УК→ЄВ, 'eu' = ЄВ→УК — той самий код, що в cargo-crm/Cargo.js.
type Dir = 'ue' | 'eu';
type Crm = 'cargo' | 'passenger';

// Чи поле належить активному напрямку. Якщо у field.directions нічого не
// вказано — поле належить ОБОМ напрямкам (універсальне на кшталт SMS-парсера).
function fieldInDir(f: FieldDef, dir: Dir): boolean {
  if (!f.directions || f.directions.length === 0) return true;
  return f.directions.includes(dir);
}

// ============================================================================
// FillFormConfigPanel — top-level з CRM-табом. Усередині — окрема секція
// для кожного CRM (cargo / passenger). Кожна секція має власний state, бо
// конфіги зберігаються окремими рядками в system_settings.
// ============================================================================
export function FillFormConfigPanel({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [crm, setCrm] = useState<Crm>('cargo');

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
              Які поля показувати менеджерам у формах «Додати посилку» і «Новий пасажир».
            </p>
          </div>
        </button>
      </div>

      {!open ? null : (
        <>
          {/* CRM-таб: між cargo / passenger. Конфіги окремі, тож при перемиканні
              кожен з блоків (нижче) тримає свій власний state. */}
          <div className="flex gap-1 mb-4 lg:mb-5 p-1 rounded-xl bg-bg-light border border-border max-w-md">
            <button
              type="button"
              onClick={() => setCrm('cargo')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                crm === 'cargo' ? 'bg-amber-700 text-white shadow' : 'text-muted hover:bg-bg'
              }`}
            >
              📦 Посилкова
            </button>
            <button
              type="button"
              onClick={() => setCrm('passenger')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                crm === 'passenger' ? 'bg-brand text-white shadow' : 'text-muted hover:bg-bg'
              }`}
            >
              👥 Пасажирська
            </button>
          </div>

          {crm === 'cargo'
            ? <CargoConfigSection tenantId={tenantId} />
            : <PassengerConfigSection tenantId={tenantId} />}
        </>
      )}
    </section>
  );
}

// ============================================================================
// CARGO SECTION — direction-aware (УК→ЄВ / ЄВ→УК). Зберігається у
// system_settings.fill_form_cargo.
// ============================================================================
function CargoConfigSection({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cfg, setCfg] = useState<FillFormConfig>(defaultCargoConfig());
  const [dir, setDir] = useState<Dir>('ue');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await getCargoFillConfig(tenantId);
      setCfg(fresh);
      setDirty(false);
    } catch (e) {
      console.warn('[FillFormConfig:cargo] load failed:', e);
      setCfg(defaultCargoConfig());
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

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
      console.error('[FillFormConfig:cargo] save failed:', e);
      alert('Не вдалось зберегти: ' + (e as Error).message);
    }
    setSaving(false);
  };

  if (loading) return <div className="text-center py-8 text-muted text-sm">Завантаження…</div>;

  return (
    <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
      <div className="space-y-5">
        <div className="rounded-xl border border-border p-4 lg:p-5 bg-bg">
          <h3 className="text-sm lg:text-base font-extrabold text-text mb-1">📦 Посилкова CRM</h3>
          <p className="text-xs text-muted mb-3">
            Оберіть напрямок і налаштуйте, які поля показувати у формі.
            Поля з <span className="font-bold text-amber-700">*</span> — обов'язкові
            (locked, прибрати не можна). Зберігання — спільне для обох напрямків.
          </p>

          {/* Direction tabs */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl bg-bg-light border border-border">
            <button
              type="button"
              onClick={() => setDir('ue')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                dir === 'ue' ? 'bg-amber-700 text-white shadow' : 'text-muted hover:bg-bg'
              }`}
            >
              🇺🇦 → 🇪🇺 УК → Європа
            </button>
            <button
              type="button"
              onClick={() => setDir('eu')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                dir === 'eu' ? 'bg-amber-700 text-white shadow' : 'text-muted hover:bg-bg'
              }`}
            >
              🇪🇺 → 🇺🇦 Європа → УК
            </button>
          </div>

          <SmsParserToggle checked={cfg.smsParser} onChange={toggleSms} />

          <div className="space-y-4">
            {CARGO_FILL_GROUPS.map(g => {
              const visibleFields = g.fields.filter(f => fieldInDir(f, dir));
              if (visibleFields.length === 0) return null;
              return (
                <FieldGroupCard
                  key={g.key}
                  title={g.title}
                  description={g.description}
                  fields={visibleFields}
                  cfg={cfg}
                  onToggle={toggleField}
                />
              );
            })}
          </div>
        </div>

        <ActionsBar saving={saving} dirty={dirty} onSave={save} onReset={resetDefaults} hint="Зміни застосовуються при наступному завантаженні cargo-CRM (F5 у вкладці менеджера)." />
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <CargoFillFormPreview cfg={cfg} dir={dir} />
      </div>
    </div>
  );
}

// ============================================================================
// PASSENGER SECTION — без direction-tab (форма єдина для обох напрямків).
// Зберігається у system_settings.fill_form_passenger.
// ============================================================================
function PassengerConfigSection({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cfg, setCfg] = useState<FillFormConfig>(defaultPassengerConfig());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await getPassengerFillConfig(tenantId);
      setCfg(fresh);
      setDirty(false);
    } catch (e) {
      console.warn('[FillFormConfig:passenger] load failed:', e);
      setCfg(defaultPassengerConfig());
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const toggleField = (key: string) => {
    setCfg(prev => ({ ...prev, fields: { ...prev.fields, [key]: !prev.fields[key] } }));
    setDirty(true);
  };
  const toggleSms = () => {
    setCfg(prev => ({ ...prev, smsParser: !prev.smsParser }));
    setDirty(true);
  };
  const resetDefaults = () => {
    setCfg(defaultPassengerConfig());
    setDirty(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await savePassengerFillConfig(tenantId, cfg);
      setDirty(false);
    } catch (e) {
      console.error('[FillFormConfig:passenger] save failed:', e);
      alert('Не вдалось зберегти: ' + (e as Error).message);
    }
    setSaving(false);
  };

  if (loading) return <div className="text-center py-8 text-muted text-sm">Завантаження…</div>;

  return (
    <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
      <div className="space-y-5">
        <div className="rounded-xl border border-border p-4 lg:p-5 bg-bg">
          <h3 className="text-sm lg:text-base font-extrabold text-text mb-1">👥 Пасажирська CRM</h3>
          <p className="text-xs text-muted mb-4">
            Налаштуйте, які поля показувати у формі «Новий пасажир». Форма єдина
            для обох напрямків (УК↔ЄВ обирається в самій формі).
            Поля з <span className="font-bold text-brand">*</span> — обов'язкові
            (locked, прибрати не можна).
          </p>

          <SmsParserToggle checked={cfg.smsParser} onChange={toggleSms} />

          <div className="space-y-4">
            {PASSENGER_FILL_GROUPS.map(g => (
              <FieldGroupCard
                key={g.key}
                title={g.title}
                description={g.description}
                fields={g.fields}
                cfg={cfg}
                onToggle={toggleField}
              />
            ))}
          </div>
        </div>

        <ActionsBar saving={saving} dirty={dirty} onSave={save} onReset={resetDefaults} hint="Зміни застосовуються при наступному завантаженні passenger-CRM (F5 у вкладці менеджера)." />
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <PassengerFillFormPreview cfg={cfg} />
      </div>
    </div>
  );
}

// ============================================================================
// SHARED CONTROLS
// ============================================================================
function SmsParserToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-3 mb-5 p-3 rounded-lg border border-border bg-white cursor-pointer hover:bg-bg-light transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
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
  );
}

function FieldGroupCard(
  { title, description, fields, cfg, onToggle }:
  { title: string; description?: string; fields: FieldDef[]; cfg: FillFormConfig; onToggle: (k: string) => void },
) {
  return (
    <div className="rounded-lg border border-border bg-white p-3 lg:p-4">
      <div className="font-bold text-sm text-text mb-1">{title}</div>
      {description && <div className="text-xs text-muted mb-3">{description}</div>}
      <div className="space-y-2">
        {fields.map(f => {
          const checked = cfg.fields[f.key] !== false;
          return (
            <label
              key={f.key}
              className="flex items-center gap-2 p-2 rounded border border-border-light cursor-pointer hover:bg-bg-light transition-colors"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(f.key)}
                className="w-4 h-4 cursor-pointer accent-brand"
              />
              <span className="text-sm text-text">{f.label}</span>
              {f.hint && <span className="text-[11px] text-muted ml-auto">{f.hint}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ActionsBar(
  { saving, dirty, onSave, onReset, hint }:
  { saving: boolean; dirty: boolean; onSave: () => void; onReset: () => void; hint: string },
) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving || !dirty}
          className="px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-sm lg:text-base disabled:opacity-50 cursor-pointer hover:brightness-110 transition-all"
        >
          {saving ? 'Збереження…' : dirty ? '💾 Зберегти налаштування' : '✓ Збережено'}
        </button>
        <button
          onClick={onReset}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl border border-border text-text font-semibold text-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer hover:bg-bg-light transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Скинути на стандарт
        </button>
        {dirty && <span className="text-xs text-amber-700">Є незбережені зміни</span>}
      </div>
      <p className="text-xs text-muted">{hint}</p>
    </>
  );
}

// ============================================================================
// CARGO PREVIEW — direction-aware візуалізація форми «Додати посилку»
// ============================================================================
function CargoFillFormPreview({ cfg, dir }: { cfg: FillFormConfig; dir: Dir }) {
  const isOn = (k: string) => cfg.fields[k] !== false;
  const isUe = dir === 'ue';
  const recvPhonePlaceholder = isUe ? '+41… / +49…' : '+380…';
  const recvAddrPlaceholder  = isUe ? 'Цюрих, Bahnhofstrasse 12' : 'Київ, вул. Хрещатик, буд. 5 / НП…';
  const showSenderSection = !isUe;
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
        <span className="font-extrabold text-sm">
          ➕ Додати посилку — {isUe ? '🇺🇦 → 🇪🇺' : '🇪🇺 → 🇺🇦'}
        </span>
        <span className="text-xs opacity-80">прев'ю</span>
      </div>
      <div className="p-4 space-y-3 max-h-[680px] overflow-y-auto">
        {cfg.smsParser && (
          <PreviewSection title="📋 SMS-парсер" amber>
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/30 p-3 text-xs text-amber-800 italic">
              «Турко Сергій +41797856664 Цюріх, документи 2кг»
            </div>
            <PreviewBtn label="🔍 Розпізнати та заповнити" />
          </PreviewSection>
        )}

        {isUe && (
          <PreviewSection title="🔒 Обов'язкові поля" locked>
            <PreviewField label="Телефон отримувача *" placeholder={recvPhonePlaceholder} locked />
            <PreviewField label="Адреса доставки *"    placeholder={recvAddrPlaceholder}  locked />
          </PreviewSection>
        )}

        {showSenderSection && (
          <PreviewSection title="🔒 Відправник (Європа) — обов'язкові" locked>
            <PreviewField label="Телефон відправника *" placeholder="+41… / +49…" locked />
            <PreviewField label="Адреса відправника *"  placeholder="Введіть адресу…" locked />
            {isOn('senderName') && <PreviewField label="ПІБ відправника" placeholder="Прізвище Ім'я" />}
            <div className="grid grid-cols-2 gap-2">
              {isOn('senderEstValue') && <PreviewField label="Оцін. вартість (€)" placeholder="0" />}
              {isOn('senderWeight')   && <PreviewField label="Вага (кг)"         placeholder="0" />}
            </div>
          </PreviewSection>
        )}

        {!isUe && (isOn('receiverNameEu') || isOn('receiverPhoneEu') || isOn('receiverAddressEu')) && (
          <PreviewSection title="📥 Отримувач (Україна)">
            {isOn('receiverNameEu')    && <PreviewField label="ПІБ отримувача"     placeholder="Прізвище Ім'я По-батькові" />}
            {isOn('receiverPhoneEu')   && <PreviewField label="Телефон отримувача" placeholder="+380…" />}
            {isOn('receiverAddressEu') && <PreviewField label="Адреса доставки"    placeholder="НП: Київ 174 / вул. …" />}
          </PreviewSection>
        )}

        {isUe && (isOn('receiverNameUe') || isOn('senderPhoneUe')) && (
          <PreviewSection title="📥 Отримувач + 📤 Відправник (UA)">
            {isOn('receiverNameUe') && <PreviewField label="ПІБ отримувача"           placeholder="Прізвище Ім'я По-батькові" />}
            {isOn('senderPhoneUe')  && <PreviewField label="Телефон відправника (UA)" placeholder="+380…" />}
          </PreviewSection>
        )}

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

        <div className="flex gap-2 pt-2">
          <button className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs font-bold cursor-default" disabled>Скасувати</button>
          <button className="flex-1 py-2 rounded-lg bg-amber-700 text-white text-xs font-bold cursor-default" disabled>💾 Зберегти</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PASSENGER PREVIEW — єдина форма для обох напрямків. Locked: телефон +
// точка відправки + точка прибуття (на верху). Решта togglable.
// ============================================================================
function PassengerFillFormPreview({ cfg }: { cfg: FillFormConfig }) {
  const isOn = (k: string) => cfg.fields[k] !== false;
  const showRoute  = true; // locked, завжди показуємо
  const showBasic  = isOn('paxName') || isOn('paxPhoneReg') || isOn('paxMessenger') || isOn('paxTag');
  const showRouteX = isOn('paxDate') || isOn('paxSeats') || isOn('paxTiming') || isOn('paxSeatNumber');
  const showTicket = isOn('paxPrice') || isOn('paxDeposit') || isOn('paxPayStatus') || isOn('paxPayForm');
  const showBag    = isOn('paxBaggage');
  const showOther  = isOn('paxNote');

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-brand to-blue-900 text-white px-4 py-3 flex items-center justify-between">
        <span className="font-extrabold text-sm">➕ Новий пасажир</span>
        <span className="text-xs opacity-80">прев'ю</span>
      </div>
      <div className="p-4 space-y-3 max-h-[680px] overflow-y-auto">
        {cfg.smsParser && (
          <PreviewSection title="📋 SMS-парсер" amber>
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/30 p-3 text-xs text-amber-800 italic">
              «12.03 два пасажири до Цюріха +380639763484 мама»
            </div>
            <PreviewBtn label="🔍 Розпізнати та заповнити" />
          </PreviewSection>
        )}

        {/* Locked: телефон + точки відправки/прибуття (з полем напрямку зверху) */}
        <PreviewSection title="🔒 Обов'язкові поля" locked>
          <PreviewField label="Напрямок"             placeholder="🇺🇦→🇪🇺 / 🇪🇺→🇺🇦" />
          <PreviewField label="Телефон пасажира *"   placeholder="+380…"    locked />
          {showRoute && (
            <>
              <PreviewField label="Точка відправки *" placeholder="Київ"        locked />
              <PreviewField label="Точка прибуття *"  placeholder="Цюрих"       locked />
            </>
          )}
        </PreviewSection>

        {showBasic && (
          <PreviewSection title="👤 Пасажир">
            {isOn('paxName')      && <PreviewField label="ПІБ"              placeholder="Прізвище Ім'я" />}
            {isOn('paxPhoneReg')  && <PreviewField label="Тел. реєстратора" placeholder="+380…" />}
            {isOn('paxMessenger') && <PreviewField label="Месенджер"        placeholder="Telegram / WhatsApp / …" />}
            {isOn('paxTag')       && <PreviewField label="Тег"              placeholder="VIP, постійний…" />}
          </PreviewSection>
        )}

        {showRouteX && (
          <PreviewSection title="📍 Маршрут (додатково)">
            <div className="grid grid-cols-2 gap-2">
              {isOn('paxDate')  && <PreviewField label="Дата виїзду" placeholder="2026-05-15" />}
              {isOn('paxSeats') && <PreviewField label="Місць"       placeholder="1" />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {isOn('paxTiming')     && <PreviewField label="Таймінг"     placeholder="14:00" />}
              {isOn('paxSeatNumber') && <PreviewField label="Місце в авто" placeholder="2A" />}
            </div>
          </PreviewSection>
        )}

        {showTicket && (
          <PreviewSection title="🎫 Квиток і фінанси">
            {isOn('paxPrice')   && <PreviewField label="Ціна квитка + валюта" placeholder="100 EUR" />}
            {isOn('paxDeposit') && <PreviewField label="Завдаток + валюта"    placeholder="20 EUR" />}
            <div className="grid grid-cols-2 gap-2">
              {isOn('paxPayStatus') && <PreviewField label="Статус оплати" placeholder="Не оплачено" />}
              {isOn('paxPayForm')   && <PreviewField label="Форма оплати"  placeholder="Готівка" />}
            </div>
          </PreviewSection>
        )}

        {showBag && (
          <PreviewSection title="🧳 Багаж">
            <PreviewField label="Вага + ціна + валюта" placeholder="20 кг — 30 EUR" />
          </PreviewSection>
        )}

        {showOther && (
          <PreviewSection title="📝 Інше">
            {isOn('paxNote') && <PreviewField label="Примітка" placeholder="Доп. інфо…" />}
          </PreviewSection>
        )}

        <div className="flex gap-2 pt-2">
          <button className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs font-bold cursor-default" disabled>Скасувати</button>
          <button className="flex-1 py-2 rounded-lg bg-brand text-white text-xs font-bold cursor-default" disabled>💾 Зберегти</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SHARED PREVIEW HELPERS
// ============================================================================
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

// Силуємо PASSENGER_LOCKED_FIELDS не «втратитись» (Tree-shake може його випиляти,
// якщо він не використовується вище). Залишаємо як публічний експорт через
// модуль api/fillFormConfig — тут не звертаємось.
void PASSENGER_LOCKED_FIELDS;
