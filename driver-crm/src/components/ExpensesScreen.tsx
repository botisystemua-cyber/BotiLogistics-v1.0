import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Save, Fuel, UtensilsCrossed, ParkingCircle, Route, AlertTriangle, Landmark, Smartphone, HelpCircle, Receipt, MessageSquare } from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchExpenses, saveExpense } from '../api';
import type { ExpenseRow } from '../types';

const EXPENSE_CATEGORIES: { key: keyof ExpenseRow; label: string; icon: typeof Fuel; color: string }[] = [
  { key: 'fuel', label: 'Бензин', icon: Fuel, color: 'text-amber-600 bg-amber-50' },
  { key: 'food', label: 'Їжа', icon: UtensilsCrossed, color: 'text-orange-600 bg-orange-50' },
  { key: 'parking', label: 'Паркування', icon: ParkingCircle, color: 'text-blue-600 bg-blue-50' },
  { key: 'toll', label: 'Толл', icon: Route, color: 'text-violet-600 bg-violet-50' },
  { key: 'fine', label: 'Штраф', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  { key: 'customs', label: 'Митниця', icon: Landmark, color: 'text-emerald-600 bg-emerald-50' },
  { key: 'topUp', label: 'Поповнення', icon: Smartphone, color: 'text-cyan-600 bg-cyan-50' },
  { key: 'other', label: 'Інше', icon: HelpCircle, color: 'text-gray-600 bg-gray-100' },
  { key: 'tips', label: 'Чайові', icon: Receipt, color: 'text-pink-600 bg-pink-50' },
];

export function ExpensesScreen() {
  const { currentSheet, driverName, showToast, setCurrentScreen } = useApp();

  const routeNum = currentSheet.replace('Маршрут_', '');
  const expSheetName = 'Витрати_' + routeNum;

  const [existing, setExisting] = useState<ExpenseRow | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [otherDesc, setOtherDesc] = useState('');
  const [note, setNote] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [tipsCurrency, setTipsCurrency] = useState('CHF');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchExpenses(expSheetName);
      const mine = items.find((e) => e.driver === driverName);
      if (mine) {
        setExisting(mine);
        const vals: Record<string, string> = {};
        EXPENSE_CATEGORIES.forEach((c) => { vals[c.key] = mine[c.key] || ''; });
        setValues(vals);
        setOtherDesc(mine.otherDesc || '');
        setNote(mine.note || '');
        setCurrency(mine.expenseCurrency || 'CHF');
        setTipsCurrency(mine.tipsCurrency || 'CHF');
      }
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [expSheetName, driverName, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const setValue = (key: string, val: string) => {
    // allow only numbers and dot
    const clean = val.replace(/[^0-9.,]/g, '').replace(',', '.');
    setValues((prev) => ({ ...prev, [key]: clean }));
  };

  const total = EXPENSE_CATEGORIES.reduce((sum, c) => sum + (parseFloat(values[c.key] || '0') || 0), 0);

  const advanceCash = parseFloat(existing?.advanceCash || '0') || 0;
  const advanceCard = parseFloat(existing?.advanceCard || '0') || 0;
  const advanceTotal = advanceCash + advanceCard;
  const remaining = advanceTotal - total;

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Record<string, string> = {
        routeName: currentSheet,
        driverName,
        ...values,
        otherDesc,
        note,
        expenseCurrency: currency,
        tipsCurrency,
      };
      const res = await saveExpense(data);
      if (res.success) {
        showToast('Витрати збережено!');
        loadData();
      } else {
        showToast('Помилка: ' + (res.error || 'невідома'));
      }
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => setCurrentScreen('list');

  return (
    <div className="flex-1 flex flex-col bg-bg max-h-dvh overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-border px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={goBack} className="p-2 -ml-2 rounded-xl hover:bg-bg cursor-pointer active:scale-95 transition-all">
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
            {/* Advance info (read-only) */}
            {advanceTotal > 0 && (
              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Аванс</div>
                <div className="flex gap-3">
                  {advanceCash > 0 && (
                    <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
                      <div className="text-lg font-black text-green-700">{advanceCash}</div>
                      <div className="text-[9px] font-semibold text-green-600">Готівка ({existing?.advanceCashCurrency || 'UAH'})</div>
                    </div>
                  )}
                  {advanceCard > 0 && (
                    <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                      <div className="text-lg font-black text-blue-700">{advanceCard}</div>
                      <div className="text-[9px] font-semibold text-blue-600">Картка ({existing?.advanceCardCurrency || 'UAH'})</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Currency selector */}
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Валюта витрат</div>
              <div className="flex gap-2">
                {['UAH', 'EUR', 'CHF', 'PLN', 'USD'].map((c) => (
                  <button key={c} onClick={() => setCurrency(c)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      currency === c ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                    }`}>{c}</button>
                ))}
              </div>
            </div>

            {/* Expense categories */}
            <div className="bg-white rounded-2xl border border-border p-4 space-y-2">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Категорії витрат</div>
              {EXPENSE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.key} className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cat.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-semibold text-text flex-1 min-w-0">{cat.label}</span>
                    <input
                      type="text" inputMode="decimal"
                      value={values[cat.key] || ''}
                      onChange={(e) => setValue(cat.key, e.target.value)}
                      placeholder=""
                      className="w-24 text-left text-sm font-bold text-text bg-gray-50 rounded-xl px-3 py-2 border border-border focus:border-brand focus:outline-none transition-colors"
                    />
                  </div>
                );
              })}

              {/* Other description */}
              {parseFloat(values.other || '0') > 0 && (
                <div className="pl-11">
                  <input
                    type="text" value={otherDesc} onChange={(e) => setOtherDesc(e.target.value)}
                    placeholder="Опис витрати..."
                    className="w-full text-xs text-text bg-gray-50 rounded-xl px-3 py-2 border border-border focus:border-brand focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Tips currency */}
            {parseFloat(values.tips || '0') > 0 && (
              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Валюта чайових</div>
                <div className="flex gap-2">
                  {['UAH', 'EUR', 'CHF', 'PLN', 'USD'].map((c) => (
                    <button key={c} onClick={() => setTipsCurrency(c)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        tipsCurrency === c ? 'bg-pink-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                      }`}>{c}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-muted" />
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Примітка</span>
              </div>
              <input
                type="text" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Додаткова інформація..."
                className="w-full text-xs text-text bg-gray-50 rounded-xl px-3 py-2.5 border border-border focus:border-brand focus:outline-none"
              />
            </div>

            {/* Totals */}
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-text">Всього витрат</span>
                <span className="text-xl font-black text-text">{total.toFixed(2)} <span className="text-sm text-muted">{currency}</span></span>
              </div>
              {advanceTotal > 0 && (
                <div className={`flex items-center justify-between pt-2 border-t border-border`}>
                  <span className="text-xs font-bold text-text">Залишок авансу</span>
                  <span className={`text-lg font-black ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {remaining.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Save button */}
      {!loading && (
        <div className="shrink-0 bg-white border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Збереження...' : 'Зберегти витрати'}
          </button>
        </div>
      )}
    </div>
  );
}
