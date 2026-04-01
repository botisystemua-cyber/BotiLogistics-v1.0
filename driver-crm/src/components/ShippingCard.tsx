import { useState } from 'react';
import {
  Phone, MapPin, Package, ChevronUp, Info, Truck,
  CreditCard, RotateCw, CheckCircle2, XCircle, Undo2,
} from 'lucide-react';
import type { ShippingItem, ItemStatus } from '../types';
import { useApp } from '../store/useAppStore';
import { updateItemStatus } from '../api';

interface Props {
  item: ShippingItem;
  index: number;
}

const borderColor: Record<ItemStatus, string> = {
  pending: 'border-l-amber-400', 'in-progress': 'border-l-blue-500',
  completed: 'border-l-emerald-500', cancelled: 'border-l-red-400',
};
const stLabel: Record<ItemStatus, { t: string; c: string }> = {
  pending: { t: 'Очікує', c: 'text-amber-700 bg-amber-50' },
  'in-progress': { t: 'В роботі', c: 'text-blue-700 bg-blue-50' },
  completed: { t: 'Готово', c: 'text-emerald-700 bg-emerald-50' },
  cancelled: { t: 'Скасов.', c: 'text-red-700 bg-red-50' },
};

export function ShippingCard({ item, index }: Props) {
  const { getStatus, setStatus, driverName, isUnifiedView, showToast } = useApp();
  const [expanded, setExpanded] = useState(false);

  const rawStatus = item._statusKey ? getStatus(item._statusKey) : 'pending';
  const status: ItemStatus = rawStatus in stLabel ? rawStatus : 'pending';
  const canUndo = status === 'completed' || status === 'cancelled';
  const sl = stLabel[status];
  const sheetName = isUnifiedView && item._sourceRoute
    ? item._sourceRoute.replace('Маршрут_', 'Відправка_')
    : item.sheet;

  const doStatus = async (ns: ItemStatus) => {
    if (!item._statusKey) return;
    setStatus(item._statusKey, ns);
    try {
      await updateItemStatus(driverName, sheetName, { itemId: item.dispatchId, type: 'відправка' } as never, ns);
      showToast(stLabel[ns].t + '!');
    } catch (e) { showToast('Помилка: ' + (e as Error).message); }
  };
  const doUndo = async () => {
    if (!canUndo || !item._statusKey) return;
    const prev = status;
    setStatus(item._statusKey, 'pending');
    try {
      await updateItemStatus(driverName, sheetName, { itemId: item.dispatchId, type: 'відправка' } as never, 'pending', 'Відміна');
      showToast('Відмінено');
    } catch (e) { showToast('Помилка: ' + (e as Error).message); setStatus(item._statusKey, prev); }
  };

  return (
    <div className={`bg-card rounded-2xl border-2 border-gray-300 ${borderColor[status]} border-l-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden`}>
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex flex-col items-center justify-center shrink-0">
            <Truck className="w-3 h-3" />
            <span className="text-[8px] font-black leading-none">{index + 1}</span>
          </span>
          <div className="flex-1 min-w-0">
            {item._sourceRoute && <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-blue-600 bg-blue-50 mb-0.5">{item._sourceRoute}</span>}
            <div className="font-bold text-text text-[13px] leading-snug truncate">
              {item.senderName || '—'}
            </div>
            {item.recipientAddr && (
              <div className="text-xs text-secondary truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />{item.recipientAddr}
              </div>
            )}
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${sl.c}`}>
            {sl.t}
          </span>
        </div>

        {/* Key info */}
        <div className="flex items-center gap-2 ml-9 mb-2 flex-wrap">
          {item.internalNum && (
            <span className="text-xs font-semibold text-text flex items-center gap-1">
              <Package className="w-3 h-3 text-blue-500" />#{item.internalNum}
            </span>
          )}
          {item.recipientPhone && (
            <span className="text-xs font-semibold text-text flex items-center gap-1">
              <Phone className="w-3 h-3 text-green-600" />{item.recipientPhone}
            </span>
          )}
          {item.amount && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CreditCard className="w-3 h-3" />{item.amount}{item.currency ? ' ' + item.currency : ''}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 ml-9 mb-1.5">
          {item.recipientPhone && (
            <button onClick={() => { window.location.href = `tel:${item.recipientPhone}`; }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform bg-green-50 text-green-700">
              <Phone className="w-4 h-4" />Дзвонити
            </button>
          )}
          {item.recipientAddr && (
            <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.recipientAddr)}&travelmode=driving`, '_blank')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform bg-blue-50 text-blue-700">
              <MapPin className="w-4 h-4" />Карта
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform ${expanded ? 'bg-brand/10 text-brand' : 'bg-gray-50 text-gray-600'}`}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            {expanded ? 'Згорнути' : 'Деталі'}
          </button>
        </div>

        {/* Status buttons */}
        <div className="flex gap-1 ml-9">
          <SB icon={RotateCw} c="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => doStatus('in-progress')} />
          <SB icon={CheckCircle2} c="border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => doStatus('completed')} />
          <SB icon={XCircle} c="border-red-200 text-red-500 hover:bg-red-50" onClick={() => doStatus('cancelled')} />
          <SB icon={Undo2} c="border-gray-300 text-gray-500 hover:bg-gray-100" onClick={doUndo} disabled={!canUndo} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <Cell label="Відправник" value={item.senderName} full />
            <Cell label="Тел. відправника" value={item.senderPhone} />
            <Cell label="Отримувач" value={item.recipientName} />
            <Cell label="Тел. отримувача" value={item.recipientPhone} />
            <Cell label="Адреса отримувача" value={item.recipientAddr} full />
            {item.internalNum && <Cell label="Внутр. №" value={item.internalNum} />}
            {item.weight && <Cell label="Вага" value={item.weight} />}
            {item.amount && <Cell label="Сума" value={item.amount + (item.currency ? ' ' + item.currency : '')} />}
            {item.payForm && <Cell label="Оплата" value={item.payForm} />}
            {item.payStatus && <Cell label="Ст. оплати" value={item.payStatus} />}
            {item.debt && <Cell label="Борг" value={item.debt} />}
            {item.deposit && <Cell label="Завдаток" value={item.deposit} />}
            {item.dateTrip && <Cell label="Дата рейсу" value={item.dateTrip} />}
          </div>
          {item.description && (
            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-blue-50 text-[11px] text-text">
              <span className="text-blue-600 font-bold">Опис: </span>{item.description}
            </div>
          )}
          {item.note && (
            <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-[11px] text-text">
              <span className="text-amber-700 font-bold">Примітка: </span>{item.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  if (!value) return null;
  return (
    <div className={`py-1 min-w-0 ${full ? 'col-span-2' : ''}`}>
      <div className="text-[9px] text-muted font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-[11px] font-medium text-text truncate">{value}</div>
    </div>
  );
}

function SB({ icon: I, c, onClick, disabled }: { icon: typeof RotateCw; c: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`flex-1 py-2 border rounded-xl flex items-center justify-center transition-all ${c} ${disabled ? 'opacity-50' : 'cursor-pointer active:scale-95'}`}><I className="w-4 h-4" /></button>;
}
