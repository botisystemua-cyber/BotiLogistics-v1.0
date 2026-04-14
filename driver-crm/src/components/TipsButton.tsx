import { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { updateDriverFields } from '../api';

const TIP_CURRENCIES = ['CHF', 'EUR', 'UAH'];

interface TipsButtonProps {
  tips: string;
  tipsCurrency: string;
  routeName: string;
  itemId: string;
  onUpdated: (tips: string, tipsCurrency: string) => void;
}

export function TipsButton({ tips, tipsCurrency, routeName, itemId, onUpdated }: TipsButtonProps) {
  const { showToast } = useApp();
  const [showModal, setShowModal] = useState(false);

  const hasTips = !!tips && parseFloat(tips) > 0;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer active:scale-95 transition-all ${
          hasTips
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-gray-50 text-gray-400 border border-gray-200'
        }`}
      >
        💰{hasTips && ` ${tips} ${tipsCurrency || 'CHF'}`}
      </button>

      {showModal && (
        <TipsModal
          initialAmount={tips}
          initialCurrency={tipsCurrency || 'CHF'}
          routeName={routeName}
          itemId={itemId}
          showToast={showToast}
          onClose={() => setShowModal(false)}
          onSaved={onUpdated}
        />
      )}
    </>
  );
}

function TipsModal({ initialAmount, initialCurrency, routeName, itemId, showToast, onClose, onSaved }: {
  initialAmount: string;
  initialCurrency: string;
  routeName: string;
  itemId: string;
  showToast: (msg: string) => void;
  onClose: () => void;
  onSaved: (tips: string, tipsCurrency: string) => void;
}) {
  const [amount, setAmount] = useState(initialAmount && parseFloat(initialAmount) > 0 ? initialAmount : '');
  const [currency, setCurrency] = useState(initialCurrency || 'CHF');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { showToast('Введи суму'); return; }
    setSubmitting(true);
    try {
      await updateDriverFields(itemId, routeName, {
        tips: String(num),
        tipsCurrency: currency,
      });
      showToast('Чайові збережено');
      onSaved(String(num), currency);
      onClose();
    } catch (e) {
      showToast('Помилка: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await updateDriverFields(itemId, routeName, {
        tips: '0',
        tipsCurrency: '',
      });
      showToast('Чайові видалено');
      onSaved('', '');
      onClose();
    } catch (e) {
      showToast('Помилка: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[70dvh] flex flex-col animate-[slideUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
          <h2 className="text-base font-bold text-text">💰 Чайові</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Сума</div>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
              placeholder="0"
              className="w-full text-xl font-black text-text bg-gray-50 rounded-xl px-3 py-3 border border-border focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Валюта</div>
            <div className="flex gap-1.5">
              {TIP_CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                    currency === c ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-3 py-3 border-t border-gray-100 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          <button
            onClick={handleSave}
            disabled={submitting}
            className="w-full py-3 rounded-2xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : '💰'}
            {submitting ? 'Зберігаю...' : 'Зберегти'}
          </button>
          {initialAmount && parseFloat(initialAmount) > 0 && (
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="w-full py-2.5 rounded-2xl bg-red-50 text-red-500 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-40"
            >
              Видалити чайові
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
