import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, RefreshCw, ArrowRight } from 'lucide-react';
import {
  createRoutePrice,
  createRoutePriceWithReverse,
  updateRoutePrice,
  deleteRoutePrice,
  type RoutePoint,
  type RoutePrice,
  type RoutePriceInput,
} from '../api/routes';

const CURRENCIES = ['EUR', 'UAH', 'CHF', 'USD', 'PLN', 'CZK'] as const;

export function RoutePricesPanel({
  prices,
  points,
  tenantId,
  onReload,
}: {
  prices: RoutePrice[];
  points: RoutePoint[];
  tenantId: string;
  onReload: () => void;
}) {
  const [editPrice, setEditPrice] = useState<RoutePrice | null>(null);

  const pointName = (id: number) =>
    points.find(p => p.id === id)?.name_ua ?? `#${id}`;

  const handleDelete = async (p: RoutePrice) => {
    const from = pointName(p.from_point_id);
    const to = pointName(p.to_point_id);
    if (!confirm(`Видалити ціну "${from} \u2192 ${to}"?`)) return;
    try {
      await deleteRoutePrice(tenantId, p.id);
      onReload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
  };

  const handleEditSave = async (price: number, currency: string) => {
    if (!editPrice) return;
    try {
      await updateRoutePrice(tenantId, editPrice.id, { price, currency });
      setEditPrice(null);
      onReload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-3 lg:space-y-5">
      <AddPriceForm
        points={points}
        tenantId={tenantId}
        onReload={onReload}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs lg:text-sm text-muted font-bold">
          {prices.length} {prices.length === 1 ? 'правило' : prices.length < 5 ? 'правила' : 'правил'}
        </span>
      </div>

      {prices.length === 0 ? (
        <div className="text-center py-12 lg:py-16 text-muted text-sm lg:text-base">
          Немає цінових правил. Додайте ціну через форму вище.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-4">
          {prices.map(p => (
            <div key={p.id} className="rounded-xl lg:rounded-2xl border bg-white border-border shadow-sm overflow-hidden">
              <div className="p-3 lg:p-5 flex items-center gap-3 lg:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 lg:gap-2 text-sm lg:text-base font-bold text-text">
                    <span className="truncate">{pointName(p.from_point_id)}</span>
                    <ArrowRight className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-muted shrink-0" />
                    <span className="truncate">{pointName(p.to_point_id)}</span>
                  </div>
                  <div className="text-xs lg:text-sm text-muted mt-0.5">
                    <span className="font-bold text-emerald-600">{p.price} {p.currency}</span>
                  </div>
                </div>
                <div className="flex gap-1 lg:gap-1.5 shrink-0">
                  <button onClick={() => setEditPrice(p)}
                    className="p-1.5 lg:p-2.5 rounded-lg lg:rounded-xl hover:bg-blue-50 cursor-pointer transition-all">
                    <Pencil className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
                  </button>
                  <button onClick={() => handleDelete(p)}
                    className="p-1.5 lg:p-2.5 rounded-lg lg:rounded-xl hover:bg-red-50 cursor-pointer transition-all">
                    <Trash2 className="w-4 h-4 lg:w-5 lg:h-5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editPrice && (
        <EditPriceModal
          price={editPrice}
          pointName={pointName}
          onClose={() => setEditPrice(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}

function AddPriceForm({
  points,
  tenantId,
  onReload,
}: {
  points: RoutePoint[];
  tenantId: string;
  onReload: () => void;
}) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<string>('EUR');
  const [reverse, setReverse] = useState(true);
  const [saving, setSaving] = useState(false);

  const activePoints = points.filter(p => p.active);

  const submit = async () => {
    if (!fromId || !toId || !price) {
      alert('Заповніть всі поля');
      return;
    }
    if (fromId === toId) {
      alert('Точки "Звідки" і "Куди" мають бути різними');
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      alert('Ціна має бути більше 0');
      return;
    }

    setSaving(true);
    try {
      const input: RoutePriceInput = {
        from_point_id: parseInt(fromId),
        to_point_id: parseInt(toId),
        price: numPrice,
        currency,
        active: true,
      };
      if (reverse) {
        await createRoutePriceWithReverse(tenantId, input);
      } else {
        await createRoutePrice(tenantId, input);
      }
      setFromId('');
      setToId('');
      setPrice('');
      onReload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl lg:rounded-2xl border border-border shadow-sm p-3 lg:p-5 space-y-3">
      <h3 className="text-sm lg:text-base font-bold text-text">Додати ціну</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        <div>
          <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1">Звідки</label>
          <select value={fromId} onChange={e => setFromId(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand transition-all">
            <option value="">Оберіть...</option>
            {activePoints.map(p => (
              <option key={p.id} value={p.id}>{p.name_ua}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1">Куди</label>
          <select value={toId} onChange={e => setToId(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand transition-all">
            <option value="">Оберіть...</option>
            {activePoints.map(p => (
              <option key={p.id} value={p.id}>{p.name_ua}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1">Ціна</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="200"
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand transition-all" />
        </div>
        <div>
          <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1">Валюта</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand transition-all">
            {CURRENCIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={reverse}
            onChange={e => setReverse(e.target.checked)}
            className="w-4 h-4 accent-brand cursor-pointer"
          />
          <span className="text-xs lg:text-sm font-bold text-text">+ реверс (зворотний напрямок)</span>
        </label>
        <button
          onClick={submit}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 lg:py-2.5 rounded-lg lg:rounded-xl bg-brand text-white text-xs lg:text-sm font-bold cursor-pointer hover:brightness-110 transition-all disabled:opacity-40"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {saving ? 'Додаю...' : 'Додати'}
        </button>
      </div>
    </div>
  );
}

function EditPriceModal({
  price: priceObj,
  pointName,
  onClose,
  onSave,
}: {
  price: RoutePrice;
  pointName: (id: number) => string;
  onClose: () => void;
  onSave: (price: number, currency: string) => Promise<void>;
}) {
  const [val, setVal] = useState(String(priceObj.price));
  const [cur, setCur] = useState(priceObj.currency);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      alert('Ціна має бути більше 0');
      return;
    }
    setSaving(true);
    await onSave(num, cur);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 lg:px-6 pt-5 lg:pt-6 pb-3 lg:pb-4 border-b border-border shrink-0">
          <h2 className="text-lg lg:text-xl font-extrabold text-text">Редагувати ціну</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="px-5 lg:px-6 py-4 lg:py-5 space-y-3 lg:space-y-4">
          <div className="text-sm font-bold text-text flex items-center gap-2">
            <span>{pointName(priceObj.from_point_id)}</span>
            <ArrowRight className="w-4 h-4 text-muted" />
            <span>{pointName(priceObj.to_point_id)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <div>
              <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1 lg:mb-1.5">Ціна</label>
              <input type="number" value={val} onChange={e => setVal(e.target.value)} autoFocus
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand transition-all" />
            </div>
            <div>
              <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1 lg:mb-1.5">Валюта</label>
              <select value={cur} onChange={e => setCur(e.target.value)}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand transition-all">
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="px-5 lg:px-6 py-4 lg:py-5 border-t border-border shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-3 lg:py-4 rounded-2xl bg-brand text-white font-bold text-sm lg:text-base flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-all disabled:opacity-40"
          >
            {saving ? <RefreshCw className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" /> : <Save className="w-4 h-4 lg:w-5 lg:h-5" />}
            {saving ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}
