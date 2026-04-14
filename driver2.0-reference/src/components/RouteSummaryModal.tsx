import { useState } from 'react';
import { X, RefreshCw, Save, ArrowDownCircle, ArrowUpCircle, Banknote, Wallet } from 'lucide-react';
import type { RouteSummary } from '../types';
import { saveRouteSummaryApi } from '../api';

const CURRENCIES = ['UAH', 'CHF', 'EUR', 'PLN', 'CZK', 'USD'];

function nonZeroEntries(obj: Record<string, number>): [string, number][] {
  return CURRENCIES.map((c) => [c, obj[c] || 0] as [string, number]).filter(([, v]) => v !== 0);
}

function CurrencyRow({ label, obj, color }: { label: string; obj: Record<string, number>; color: string }) {
  const entries = nonZeroEntries(obj);
  if (entries.length === 0) return null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-muted font-medium">{label}</span>
      <div className="flex flex-wrap gap-x-2.5 justify-end">
        {entries.map(([cur, val]) => (
          <span key={cur} className={`text-[13px] font-bold ${color}`}>
            {val.toFixed(2)} <span className="text-[10px] text-muted font-semibold">{cur}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface Props {
  summary: RouteSummary;
  routeName: string;
  driverName: string;
  showToast: (msg: string) => void;
  onClose: () => void;
}

export function RouteSummaryModal({ summary, routeName, driverName, showToast, onClose }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveRouteSummaryApi(routeName, driverName, summary);
      showToast('Зведення збережено');
      setSaved(true);
    } catch (e) {
      showToast('Помилка: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const catLabels: Record<string, string> = {
    fuel: 'Бензин', food: 'Їжа', parking: 'Паркування', toll: 'Толл',
    fine: 'Штраф', customs: 'Митниця', topUp: 'Поповнення', other: 'Інше',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[92dvh] flex flex-col animate-[slideUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-text">
            Зведення — {routeName.replace('Маршрут_', '')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* ОТРИМАНО */}
          <Section icon={ArrowDownCircle} title="ОТРИМАНО" color="text-emerald-600" bg="bg-emerald-50">
            <CurrencyRow label="Пасажири" obj={summary.passengers} color="text-text" />
            <CurrencyRow label="Посилки" obj={summary.packages} color="text-text" />
            <CurrencyRow label="Відправки" obj={summary.shipping} color="text-text" />
            <div className="border-t border-gray-100 mt-1 pt-1">
              <CurrencyRow label="Всього дохід" obj={summary.income} color="text-emerald-700" />
            </div>
            <div className="border-t border-gray-100 mt-1 pt-1">
              <CurrencyRow label="Готівка" obj={summary.cashCollected} color="text-text" />
              <CurrencyRow label="Картка" obj={summary.cardCollected} color="text-text" />
              <CurrencyRow label="Борги" obj={summary.debts} color="text-red-600" />
            </div>
          </Section>

          {/* ЧАЙОВІ */}
          {nonZeroEntries(summary.tips).length > 0 && (
            <Section icon={Banknote} title="ЧАЙОВІ" color="text-pink-600" bg="bg-pink-50">
              <CurrencyRow label="Чайові" obj={summary.tips} color="text-pink-700" />
            </Section>
          )}

          {/* ВИТРАЧЕНО */}
          <Section icon={ArrowUpCircle} title="ВИТРАЧЕНО" color="text-red-600" bg="bg-red-50">
            {summary.advanceCash > 0 && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[11px] text-muted font-medium">Аванс готівка</span>
                <span className="text-[13px] font-bold text-text">
                  {summary.advanceCash.toFixed(2)}{' '}
                  <span className="text-[10px] text-muted font-semibold">{summary.advanceCashCur}</span>
                </span>
              </div>
            )}
            {summary.advanceCard > 0 && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[11px] text-muted font-medium">Аванс картка</span>
                <span className="text-[13px] font-bold text-text">
                  {summary.advanceCard.toFixed(2)}{' '}
                  <span className="text-[10px] text-muted font-semibold">{summary.advanceCardCur}</span>
                </span>
              </div>
            )}
            {Object.entries(summary.expensesByCategory).map(([cat, info]) => (
              <div key={cat} className="flex items-center justify-between py-1.5">
                <span className="text-[11px] text-muted font-medium">{catLabels[cat] || cat}</span>
                <span className="text-[13px] font-bold text-text">
                  {info.amount.toFixed(2)}{' '}
                  <span className="text-[10px] text-muted font-semibold">{info.currency}</span>
                </span>
              </div>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <CurrencyRow label="Всього витрат" obj={summary.expenses} color="text-red-600" />
            </div>
          </Section>

          {/* ЗДАТИ В КАСУ */}
          <Section icon={Wallet} title="ЗДАТИ В КАСУ" color="text-blue-700" bg="bg-blue-50">
            {CURRENCIES.map((c) => {
              const val = summary.toReturn[c] || 0;
              if (val === 0) return null;
              return (
                <div key={c} className="flex items-center justify-between py-2">
                  <span className="text-sm font-bold text-text">{c}</span>
                  <span className={`text-xl font-black ${val >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                    {val.toFixed(2)}
                  </span>
                </div>
              );
            })}
            {nonZeroEntries(summary.toReturn).length === 0 && (
              <div className="text-sm text-gray-300 py-2">0</div>
            )}
          </Section>
        </div>

        {/* Save button */}
        <div className="px-3 py-3 border-t border-gray-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-40 ${
              saved ? 'bg-emerald-500 text-white' : 'bg-brand text-white'
            }`}
          >
            {saving ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Зберігаю...</>
            ) : saved ? (
              'Зведення збережено'
            ) : (
              <><Save className="w-4 h-4" /> Зберегти зведення</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, color, bg, children }: {
  icon: typeof ArrowDownCircle;
  title: string;
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg ${bg} ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </span>
        <span className={`text-[10px] font-black uppercase tracking-wider ${color}`}>{title}</span>
      </div>
      <div className="space-y-0">{children}</div>
    </div>
  );
}
