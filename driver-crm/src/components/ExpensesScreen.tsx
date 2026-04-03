import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Plus, Trash2, Fuel, UtensilsCrossed,
  ParkingCircle, Route, AlertTriangle, Landmark, Smartphone,
  HelpCircle, Receipt, X, Wallet, Pencil,
} from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchExpenses, addExpense, deleteExpense, updateAdvance } from '../api';
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

const CURRENCIES = ['UAH', 'EUR', 'CHF', 'PLN', 'USD'];

function getCat(key: string) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[7];
}

interface TaggedExpense extends ExpenseItem {
  _routeName: string;
}

export function ExpensesScreen() {
  const { currentSheet, driverName, isUnifiedView, routes, showToast, setCurrentScreen } = useApp();

  const [items, setItems] = useState<TaggedExpense[]>([]);
  const [advances, setAdvances] = useState<Record<string, ExpenseAdvance | null>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState<string | null>(null); // routeName or null

  const routeNames = isUnifiedView ? routes.map((r) => r.name) : [currentSheet];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        routeNames.map(async (rn) => {
          const data = await fetchExpenses(rn);
          return {
            routeName: rn,
            items: data.items.filter((e) => e.driver === driverName).map((e) => ({ ...e, _routeName: rn })),
            advance: data.advance,
          };
        })
      );

      const allItems: TaggedExpense[] = [];
      const advMap: Record<string, ExpenseAdvance | null> = {};

      for (const r of results) {
        if (r.status === 'fulfilled') {
          allItems.push(...r.value.items);
          advMap[r.value.routeName] = r.value.advance;
        }
      }

      setItems(allItems);
      setAdvances(advMap);
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSheet, isUnifiedView, routes.length, driverName, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Grand totals
  const totalsByCurrency: Record<string, number> = {};
  items.forEach((e) => { totalsByCurrency[e.currency] = (totalsByCurrency[e.currency] || 0) + e.amount; });
  const currencyEntries = Object.entries(totalsByCurrency);

  // Per-route totals
  const perRouteTotals: Record<string, Record<string, number>> = {};
  if (isUnifiedView) {
    for (const rn of routeNames) perRouteTotals[rn] = {};
    items.forEach((e) => {
      if (!perRouteTotals[e._routeName]) perRouteTotals[e._routeName] = {};
      perRouteTotals[e._routeName][e.currency] = (perRouteTotals[e._routeName][e.currency] || 0) + e.amount;
    });
  }

  // Collect all advances for display
  const allAdvances: { routeName: string; adv: ExpenseAdvance }[] = [];
  for (const rn of routeNames) {
    const adv = advances[rn];
    if (adv && (adv.cash > 0 || adv.card > 0)) {
      allAdvances.push({ routeName: rn, adv });
    }
  }

  const handleDelete = async (item: TaggedExpense) => {
    try {
      const res = await deleteExpense({ routeName: item._routeName, rowNum: String(item.rowNum), driverName });
      if (res.success) { showToast('Видалено'); loadData(); }
      else showToast('Помилка: ' + (res.error || ''));
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
  };

  const handleAdd = async (category: ExpenseCategory, amount: string, currency: string, description: string, routeName: string) => {
    try {
      const res = await addExpense({ routeName, driverName, category, amount, currency, description });
      if (res.success) { showToast('Додано!'); setShowAdd(false); loadData(); }
      else showToast('Помилка: ' + (res.error || ''));
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
  };

  const handleSaveAdvance = async (routeName: string, cash: string, cashCurrency: string, card: string, cardCurrency: string) => {
    try {
      const res = await updateAdvance({ routeName, driverName, cash, cashCurrency, card, cardCurrency });
      if (res.success) { showToast('Збережено!'); setShowAdvanceModal(null); loadData(); }
      else showToast('Помилка: ' + (res.error || ''));
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
  };

  const headerLabel = isUnifiedView ? 'Усі маршрути' : currentSheet.replace('Маршрут_', 'М');

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
              <span className="text-sm font-bold text-text">Витрати — {headerLabel}</span>
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
            {/* Expenses summary */}
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

              {/* Per-route breakdown (unified view only) */}
              {isUnifiedView && routeNames.length > 1 && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {routeNames.map((rn) => {
                    const totals = perRouteTotals[rn] || {};
                    const entries = Object.entries(totals);
                    const count = items.filter((e) => e._routeName === rn).length;
                    return (
                      <div key={rn} className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted">{rn.replace('Маршрут_', 'Маршрут ')}</span>
                        <div className="flex items-center gap-3">
                          {entries.length === 0 ? (
                            <span className="text-xs text-gray-300">0</span>
                          ) : entries.map(([cur, sum]) => (
                            <span key={cur} className="text-xs font-bold text-text">
                              {sum.toFixed(2)} <span className="text-muted">{cur}</span>
                            </span>
                          ))}
                          <span className="text-[10px] text-muted bg-gray-100 px-1.5 py-0.5 rounded-full font-bold">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Кошти на поїздку */}
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-brand" />
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Кошти на поїздку</span>
                </div>
              </div>

              {allAdvances.length === 0 ? (
                <div className="text-sm text-gray-300 mb-2">Не вказано</div>
              ) : (
                <div className="space-y-2 mb-2">
                  {allAdvances.map(({ routeName: rn, adv }) => (
                    <div key={rn} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {isUnifiedView && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full mr-2">{rn.replace('Маршрут_', 'М')}</span>}
                        <span className="text-sm font-bold text-text">
                          {adv.cash > 0 && <>{adv.cash} {adv.cashCurrency}</>}
                          {adv.cash > 0 && adv.card > 0 && <span className="text-muted"> + </span>}
                          {adv.card > 0 && <>{adv.card} {adv.cardCurrency}</>}
                        </span>
                      </div>
                      {!isUnifiedView && (
                        <button onClick={() => setShowAdvanceModal(rn)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer active:scale-90 transition-all">
                          <Pencil className="w-3.5 h-3.5 text-muted" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add/edit advance buttons (hidden in unified view) */}
              {!isUnifiedView && (
                <button onClick={() => setShowAdvanceModal(currentSheet)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold cursor-pointer bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                  {allAdvances.length > 0 ? 'Редагувати кошти' : 'Додати кошти на поїздку'}
                </button>
              )}
            </div>

            {/* Expense cards */}
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Receipt className="w-10 h-10 text-border mb-3" strokeWidth={1} />
                <p className="text-muted text-sm">Немає витрат</p>
                {!isUnifiedView && <p className="text-muted text-xs mt-1">Натисни + щоб додати</p>}
              </div>
            ) : (
              items.map((item) => {
                const cat = getCat(item.category);
                const Icon = cat.icon;
                return (
                  <div key={`${item._routeName}_${item.expId || item.rowNum}`} className="bg-white rounded-2xl border border-border p-3.5 flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cat.bg} ${cat.color}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-text">{cat.label}</span>
                        {isUnifiedView && (
                          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                            {item._routeName.replace('Маршрут_', 'М')}
                          </span>
                        )}
                      </div>
                      {item.description && <div className="text-[11px] text-muted truncate">{item.description}</div>}
                      <div className="text-[10px] text-muted mt-0.5">{item.dateTrip}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-text">{item.amount}</div>
                      <div className="text-[10px] font-semibold text-muted">{item.currency}</div>
                    </div>
                    {!isUnifiedView && (
                      <button onClick={() => handleDelete(item)}
                        className="p-2 rounded-xl hover:bg-red-50 cursor-pointer active:scale-90 transition-all shrink-0">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Add button (hidden in unified view) */}
      {!loading && !isUnifiedView && (
        <div className="shrink-0 bg-white border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setShowAdd(true)}
            className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all">
            <Plus className="w-5 h-5" />
            Додати витрату
          </button>
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddExpenseModal
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
          routeNames={routeNames}
          isUnifiedView={isUnifiedView}
          defaultRoute={currentSheet || routeNames[0]}
        />
      )}
      {showAdvanceModal && (
        <AdvanceModal
          routeName={showAdvanceModal}
          advance={advances[showAdvanceModal] ?? null}
          onClose={() => setShowAdvanceModal(null)}
          onSave={handleSaveAdvance}
        />
      )}
    </div>
  );
}

// ---- Advance Modal ----
function AdvanceModal({ routeName, advance, onClose, onSave }: {
  routeName: string;
  advance: ExpenseAdvance | null;
  onClose: () => void;
  onSave: (routeName: string, cash: string, cashCurrency: string, card: string, cardCurrency: string) => void;
}) {
  // Determine initial type based on existing advance data
  const initialType: 'cash' | 'card' = advance && advance.card > 0 && !(advance.cash > 0) ? 'card' : 'cash';
  const [type, setType] = useState<'cash' | 'card'>(initialType);
  const [amount, setAmount] = useState(
    initialType === 'cash'
      ? (advance?.cash ? String(advance.cash) : '')
      : (advance?.card ? String(advance.card) : '')
  );
  const [currency, setCurrency] = useState(
    initialType === 'cash'
      ? (advance?.cashCurrency || 'UAH')
      : (advance?.cardCurrency || 'UAH')
  );
  const [submitting, setSubmitting] = useState(false);

  const handleTypeChange = (newType: 'cash' | 'card') => {
    setType(newType);
    // Load the value for the selected type from advance if available
    if (newType === 'cash') {
      setAmount(advance?.cash ? String(advance.cash) : '');
      setCurrency(advance?.cashCurrency || 'UAH');
    } else {
      setAmount(advance?.card ? String(advance.card) : '');
      setCurrency(advance?.cardCurrency || 'UAH');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    if (type === 'cash') {
      await onSave(routeName, amount || '0', currency, '0', 'UAH');
    } else {
      await onSave(routeName, '0', 'UAH', amount || '0', currency);
    }
    setSubmitting(false);
  };

  const handleClear = async () => {
    setSubmitting(true);
    await onSave(routeName, '0', 'UAH', '0', 'UAH');
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col animate-[slideUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
          <h2 className="text-base font-bold text-text">
            Кошти на поїздку — {routeName.replace('Маршрут_', 'М')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {/* Cash / Card toggle */}
          <div className="flex gap-2">
            <button onClick={() => handleTypeChange('cash')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all ${
                type === 'cash' ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
              }`}>Готівка</button>
            <button onClick={() => handleTypeChange('card')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all ${
                type === 'card' ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
              }`}>Картка</button>
          </div>

          {/* Amount */}
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              {type === 'cash' ? 'Сума готівкою' : 'Сума на картку'}
            </div>
            <input
              autoFocus
              type="text" inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
              placeholder="0"
              className="w-full text-xl font-black text-text bg-gray-50 rounded-xl px-3 py-3 border border-border focus:border-brand focus:outline-none"
            />
            <div className="flex gap-1.5 mt-1.5">
              {CURRENCIES.map((c) => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                    currency === c ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'
                  }`}>{c}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 py-3 border-t border-gray-100 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-3 rounded-2xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-40">
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {submitting ? 'Збереження...' : 'Зберегти'}
          </button>
          {advance && (advance.cash > 0 || advance.card > 0) && (
            <button onClick={handleClear} disabled={submitting}
              className="w-full py-2.5 rounded-2xl bg-red-50 text-red-500 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-40">
              <Trash2 className="w-3.5 h-3.5" />
              Очистити кошти
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Add Expense Modal ----
function AddExpenseModal({ onClose, onAdd, routeNames, isUnifiedView, defaultRoute }: {
  onClose: () => void;
  onAdd: (category: ExpenseCategory, amount: string, currency: string, description: string, routeName: string) => void;
  routeNames: string[];
  isUnifiedView: boolean;
  defaultRoute: string;
}) {
  const [category, setCategory] = useState<ExpenseCategory>('fuel');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [description, setDescription] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(defaultRoute);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSubmitting(true);
    await onAdd(category, amount, currency, description, selectedRoute);
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
          {isUnifiedView && (
            <div>
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Маршрут</div>
              <div className="flex gap-1.5">
                {routeNames.map((rn) => (
                  <button key={rn} onClick={() => setSelectedRoute(rn)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                      selectedRoute === rn ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                    }`}>{rn.replace('Маршрут_', 'М')}</button>
                ))}
              </div>
            </div>
          )}

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

          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Валюта</div>
            <div className="flex gap-1.5">
              {CURRENCIES.map((c) => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                    currency === c ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                  }`}>{c}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Опис (необов'язково)</div>
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Заправка Shell, обід..."
              className="w-full text-sm text-text bg-gray-50 rounded-xl px-3 py-2.5 border border-border focus:border-brand focus:outline-none placeholder:text-gray-300"
            />
          </div>
        </div>

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
