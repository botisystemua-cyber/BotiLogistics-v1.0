import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Plus, Trash2, Fuel, UtensilsCrossed,
  ParkingCircle, Route, AlertTriangle, Landmark, Smartphone,
  HelpCircle, Receipt, X,
} from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchExpenses, addExpense, deleteExpense } from '../api';
import type { ExpenseItem, ExpenseAdvance, ExpenseCategory } from '../types';

const CATEGORIES: { key: ExpenseCategory; label: string; icon: typeof Fuel; color: string; bg: string }[] = [
  { key: 'fuel', label: 'Бензин', icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'food', label: 'Їжа', icon: UtensilsCrossed, color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'parking', label: 'Паркування', icon: ParkingCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'toll', label: 'Толл', icon: Route, color: 'text-violet-600', bg: 'bg-violet-50' },
  { key: 'fine', label: 'Штраф', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  { key: 'customs', label: 'Митниця', icon: Landmark, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'topUp', label: 'Поповнення', icon: Smartphone, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { key: 'other', label: 'Інше', icon: HelpCircle, color: 'text-gray-600', bg: 'bg-gray-100' },
  { key: 'tips', label: 'Чайові', icon: Receipt, color: 'text-pink-600', bg: 'bg-pink-50' },
];

function getCat(key: string) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[7]; // fallback to 'other'
}

export function ExpensesScreen() {
  const { currentSheet, driverName, showToast, setCurrentScreen } = useApp();

  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [advance, setAdvance] = useState<ExpenseAdvance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExpenses(currentSheet);
      // show only this driver's expenses
      setItems(data.items.filter((e) => e.driver === driverName));
      setAdvance(data.advance);
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currentSheet, driverName, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalsByCurrency: Record<string, number> = {};
  items.forEach((e) => { totalsByCurrency[e.currency] = (totalsByCurrency[e.currency] || 0) + e.amount; });
  const currencyEntries = Object.entries(totalsByCurrency);

  // Залишок авансу — рахуємо тільки витрати в тій самій валюті
  const advanceCashSpent = advance ? (totalsByCurrency[advance.cashCurrency] || 0) : 0;
  const advanceCardSpent = advance ? (totalsByCurrency[advance.cardCurrency] || 0) : 0;
  const advanceTotal = advance ? advance.cash + advance.card : 0;
  const totalSpentInAdvanceCurrency = advance
    ? (advance.cashCurrency === advance.cardCurrency
        ? advanceCashSpent
        : advanceCashSpent + advanceCardSpent)
    : 0;
  const remaining = advanceTotal - totalSpentInAdvanceCurrency;

  const handleDelete = async (item: ExpenseItem) => {
    try {
      const res = await deleteExpense({ routeName: currentSheet, rowNum: String(item.rowNum), driverName });
      if (res.success) {
        showToast('Видалено');
        loadData();
      } else {
        showToast('Помилка: ' + (res.error || ''));
      }
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    }
  };

  const handleAdd = async (category: ExpenseCategory, amount: string, currency: string, description: string) => {
    try {
      const res = await addExpense({ routeName: currentSheet, driverName, category, amount, currency, description });
      if (res.success) {
        showToast('Додано!');
        setShowAdd(false);
        loadData();
      } else {
        showToast('Помилка: ' + (res.error || ''));
      }
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg max-h-dvh overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-border px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setCurrentScreen('list')} className="p-2 -ml-2 rounded-xl hover:bg-bg cursor-pointer active:scale-95 transition-all">
              <ArrowLeft className="w-5 h-5 text-text" />
            </button>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-brand" />
              <span className="text-sm font-bold text-text">Витрати — {currentSheet.replace('Маршрут_', 'М')}</span>
            </div>
          </div>
          <button onClick={loadData} className="p-2 rounded-xl hover:bg-bg cursor-pointer active:scale-95 transition-all">
            <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-brand animate-spin mb-3" />
            <p className="text-muted text-sm">Завантаження...</p>
          </div>
        ) : (
          <>
            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Всього витрат</div>
                  {currencyEntries.length === 0 ? (
                    <div className="text-2xl font-black text-text">0</div>
                  ) : (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {currencyEntries.map(([cur, sum]) => (
                        <div key={cur} className="text-xl font-black text-text">
                          {sum.toFixed(2)} <span className="text-sm text-muted font-bold">{cur}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Записів</div>
                  <div className="text-2xl font-black text-muted">{items.length}</div>
                </div>
              </div>
              {advanceTotal > 0 && (
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Аванс</div>
                    <div className="text-sm font-bold text-text">
                      {advance!.cash > 0 && <span>{advance!.cash} {advance!.cashCurrency}</span>}
                      {advance!.cash > 0 && advance!.card > 0 && <span className="text-muted"> + </span>}
                      {advance!.card > 0 && <span>{advance!.card} {advance!.cardCurrency}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Залишок</div>
                    <div className={`text-lg font-black ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {remaining.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Expense cards */}
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Receipt className="w-10 h-10 text-border mb-3" strokeWidth={1} />
                <p className="text-muted text-sm">Немає витрат</p>
                <p className="text-muted text-xs mt-1">Натисни + щоб додати</p>
              </div>
            ) : (
              items.map((item) => {
                const cat = getCat(item.category);
                const Icon = cat.icon;
                return (
                  <div key={item.expId || item.rowNum} className="bg-white rounded-2xl border border-border p-3.5 flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cat.bg} ${cat.color}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-text">{cat.label}</div>
                      {item.description && <div className="text-[11px] text-muted truncate">{item.description}</div>}
                      <div className="text-[10px] text-muted mt-0.5">{item.dateTrip}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-text">{item.amount}</div>
                      <div className="text-[10px] font-semibold text-muted">{item.currency}</div>
                    </div>
                    <button onClick={() => handleDelete(item)}
                      className="p-2 rounded-xl hover:bg-red-50 cursor-pointer active:scale-90 transition-all shrink-0">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Add button */}
      {!loading && (
        <div className="shrink-0 bg-white border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setShowAdd(true)}
            className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all">
            <Plus className="w-5 h-5" />
            Додати витрату
          </button>
        </div>
      )}

      {/* Add modal */}
      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </div>
  );
}

// ---- Add Expense Modal ----
function AddExpenseModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (category: ExpenseCategory, amount: string, currency: string, description: string) => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>('fuel');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSubmitting(true);
    await onAdd(category, amount, currency, description);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col animate-[slideUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
          <h2 className="text-base font-bold text-text">Нова витрата</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Category grid */}
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Категорія</div>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.key;
                return (
                  <button key={c.key} onClick={() => setCategory(c.key)}
                    className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                      active ? `${c.bg} ${c.color} ring-2 ring-current` : 'bg-gray-50 text-gray-400'
                    }`}>
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-bold">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Сума</div>
            <input
              autoFocus
              type="text" inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
              placeholder="0.00"
              className="w-full text-xl font-black text-text bg-gray-50 rounded-xl px-3 py-3 border border-border focus:border-brand focus:outline-none"
            />
          </div>

          {/* Currency */}
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Валюта</div>
            <div className="flex gap-1.5">
              {['UAH', 'EUR', 'CHF', 'PLN', 'USD'].map((c) => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                    currency === c ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                  }`}>{c}</button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Опис (необов'язково)</div>
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Заправка Shell, обід..."
              className="w-full text-sm text-text bg-gray-50 rounded-xl px-3 py-2.5 border border-border focus:border-brand focus:outline-none placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="px-3 py-3 border-t border-gray-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={handleSubmit} disabled={submitting || !amount || parseFloat(amount) <= 0}
            className="w-full py-3 rounded-2xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-40">
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? 'Додаю...' : 'Додати'}
          </button>
        </div>
      </div>
    </div>
  );
}
