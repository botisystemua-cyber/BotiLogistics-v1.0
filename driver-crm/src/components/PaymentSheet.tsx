import { useState } from 'react';
import { X, Banknote, CreditCard, Truck, Coins, AlertTriangle, Lock, CheckCheck } from 'lucide-react';
import { setPayment, type PayStatus, type PayForm } from '../api';
import { readSession } from '../lib/session';

interface Props {
  // UUID рядка маршруту (routes.id), потрібен RPC'у driver_set_payment.
  routeRowUuid: string;
  // Поточні значення на картці — для замочка та підсвітки активного варіанта.
  currentStatus: string;
  currentForm: string;
  collectedBy: string;
  amount: string;
  currency: string;
  onClose: () => void;
  onApplied: (result: { status: PayStatus; form: PayForm; debt: number; collectedBy: string; collectedAt: string }) => void;
  showToast: (msg: string) => void;
}

interface Option {
  status: PayStatus;
  form: PayForm;
  label: string;
  desc: string;
  icon: typeof Banknote;
  // Tailwind-класи для рамки/фону/тексту неактивного стану. Активний (поточний)
  // обводиться окремо — щоб водій бачив що зараз стоїть.
  cls: string;
}

const OPTIONS: Option[] = [
  { status: 'Оплачено',    form: 'Готівка', label: 'Готівкою',      desc: 'У водія на руках',   icon: Banknote,       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { status: 'Оплачено',    form: 'Картка',  label: 'На картку',     desc: 'На рахунок компанії', icon: CreditCard,     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  { status: 'Оплачено',    form: 'Наложка', label: 'Наложкою (НП)', desc: 'Через Нову Пошту',    icon: Truck,          cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  { status: 'Частково',    form: 'Частково', label: 'Частково',      desc: 'Лишився борг',        icon: Coins,          cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { status: 'Не оплачено', form: 'Борг',    label: 'Не оплатив',    desc: 'Жодних коштів',       icon: AlertTriangle,  cls: 'bg-red-50 text-red-700 border-red-200' },
];

export function PaymentSheet({
  routeRowUuid, currentStatus, currentForm, collectedBy,
  amount, currency, onClose, onApplied, showToast,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const sess = readSession();
  const myLogin = sess?.user_login || '';

  // Замочок коли вже Оплачено АЛЕ це не я зібрав. Це означає менеджер
  // (або інший водій) уже зафіксував — щоб не зіпсувати облік готівки.
  const isLocked = currentStatus === 'Оплачено' && collectedBy !== '' && collectedBy !== myLogin;

  async function apply(opt: Option) {
    if (busy) return;
    if (isLocked) {
      const ok = window.confirm('Цю оплату вже зафіксував ' + (collectedBy || 'менеджер') + '. Точно перезаписати?');
      if (!ok) return;
    }
    setBusy(opt.label);
    const res = await setPayment(routeRowUuid, opt.status, opt.form, myLogin);
    setBusy(null);
    if (!res.ok) {
      showToast(res.error || 'Помилка збереження');
      return;
    }
    onApplied({
      status: opt.status,
      form: opt.form,
      debt: typeof res.debt === 'number' ? res.debt : 0,
      collectedBy: res.collected_by || myLogin,
      collectedAt: res.collected_at || new Date().toISOString(),
    });
    showToast(opt.status === 'Оплачено' ? '✅ Записано: ' + opt.label : opt.label);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-2xl p-4 pb-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-base">Як прийняв оплату?</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {amount && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-gray-50 text-[12px] text-gray-700">
            Сума ліда: <span className="font-bold">{amount} {currency}</span>
          </div>
        )}

        {isLocked && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold">Уже оплачено</div>
              <div>Зафіксував: {collectedBy || 'менеджер'}. Гроші вже на компанії — водієві у звіт не падають.</div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {OPTIONS.map((opt) => {
            const isActive = currentStatus === opt.status && currentForm === opt.form;
            const isBusy = busy === opt.label;
            return (
              <button
                key={opt.label}
                onClick={() => apply(opt)}
                disabled={isBusy || (isLocked && !isActive)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-left transition-all
                  ${opt.cls}
                  ${isActive ? 'ring-2 ring-offset-1 ring-current' : ''}
                  ${(isBusy || (isLocked && !isActive)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}
                `}
              >
                <opt.icon className="w-6 h-6 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] flex items-center gap-1.5">
                    {opt.label}
                    {isActive && <CheckCheck className="w-3.5 h-3.5" />}
                  </div>
                  <div className="text-[10px] opacity-80">{opt.desc}</div>
                </div>
                {isBusy && <span className="text-[11px] font-bold">…</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
