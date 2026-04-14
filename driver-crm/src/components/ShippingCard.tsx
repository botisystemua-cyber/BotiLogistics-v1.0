import { useState } from 'react';
import {
  Phone, MapPin, ChevronUp, Info, Car, Hash,
  CreditCard, RotateCw, CheckCircle2, XCircle, Undo2, Pencil, Banknote,
} from 'lucide-react';
import type { ShippingItem, ItemStatus } from '../types';
import { useApp } from '../store/useAppStore';
import { updateItemStatus } from '../api';
import { TipsButton } from './TipsButton';

interface Props {
  item: ShippingItem;
  index: number;
  onEdit?: (item: ShippingItem) => void;
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

function derivePayStatus(payForm?: string): { label: string; cls: string } {
  const f = (payForm || '').toLowerCase().trim();
  if (f === 'готівка' || f === 'картка') return { label: 'Оплачено', cls: 'text-emerald-700 bg-emerald-50' };
  if (f === 'частково') return { label: 'Частково', cls: 'text-amber-700 bg-amber-50' };
  if (f === 'наложка') return { label: 'Наложка', cls: 'text-red-600 bg-red-50' };
  return { label: 'Борг', cls: 'text-red-600 bg-red-50' };
}

export function ShippingCard({ item, index, onEdit }: Props) {
  const { getStatus, setStatus, driverName, isUnifiedView, showToast } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [localTips, setLocalTips] = useState(item.tips);
  const [localTipsCur, setLocalTipsCur] = useState(item.tipsCurrency);

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
      await updateItemStatus(driverName, sheetName, item, ns);
      showToast(stLabel[ns].t + '!');
    } catch (e) { showToast('Помилка: ' + (e as Error).message); }
  };
  const doUndo = async () => {
    if (!canUndo || !item._statusKey) return;
    const prev = status;
    setStatus(item._statusKey, 'pending');
    try {
      await updateItemStatus(driverName, sheetName, item, 'pending', 'Відміна');
      showToast('Відмінено');
    } catch (e) { showToast('Помилка: ' + (e as Error).message); setStatus(item._statusKey, prev); }
  };

  return (
    <div className={`bg-card rounded-2xl border-2 border-gray-300 ${borderColor[status]} border-l-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden`}>
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="relative w-7 h-7 rounded-lg bg-gray-100 text-secondary flex items-center justify-center text-[11px] font-black shrink-0">
            {index + 1}
            <span className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none">📦</span>
          </span>
          <div className="flex-1 min-w-0">
            {item._sourceRoute && <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-blue-600 bg-blue-50 mb-0.5">{item._sourceRoute}</span>}
            <div className="font-bold text-text text-[13px] leading-snug truncate">
              {item.recipientName || '—'}
            </div>
            {item.recipientAddr && (
              <div className="text-xs text-secondary truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />{item.recipientAddr}
              </div>
            )}
          </div>
          <TipsButton
            tips={localTips}
            tipsCurrency={localTipsCur}
            routeName={sheetName}
            itemId={item.dispatchId}
            onUpdated={(t, c) => { setLocalTips(t); setLocalTipsCur(c); }}
          />
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${sl.c}`}>
            {sl.t}
          </span>
        </div>

        {/* Key info */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {item.internalNum && (
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <Hash className="w-3 h-3" />ВН-{item.internalNum}
            </span>
          )}
          {item.recipientPhone && (
            <span className="text-[11px] font-semibold text-text flex items-center gap-0.5">
              <Phone className="w-3 h-3 text-green-600" />{item.recipientPhone}
            </span>
          )}
          {item.amount && (
            <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-0.5" title="Оціночна вартість">
              {item.amount}
            </span>
          )}
          {item.debt && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5" title="Оплата клієнта">
              <Banknote className="w-3 h-3" />{item.debt}{item.currency ? ' ' + item.currency : ''}
            </span>
          )}
          {(() => { const ps = derivePayStatus(item.payForm); return (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ps.cls}`}>
              {ps.label}
            </span>
          ); })()}
          {item.payForm && (
            <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
              {item.payForm}
            </span>
          )}
          {item.deposit && (
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-0.5" title="Пакетик">
              <CreditCard className="w-3 h-3" />{item.deposit}{item.depositCurrency ? ' ' + item.depositCurrency : ''}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-2">
          <Btn icon={Phone} label="Дзвонити" color="bg-green-50 text-green-700" onClick={() => { if (item.recipientPhone) window.location.href = `tel:${item.recipientPhone}`; else showToast('Немає телефону'); }} />
          <Btn icon={Car} label="Звідки" color="bg-blue-50 text-blue-700" onClick={() => { if (item.senderPhone) window.location.href = `tel:${item.senderPhone}`; else showToast('Немає телефону відправника'); }} />
          <Btn icon={MapPin} label="Куди" color="bg-blue-50 text-blue-700" onClick={() => { if (item.recipientAddr) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.recipientAddr)}&travelmode=driving`, '_blank'); else showToast('Немає адреси'); }} />
          <Btn icon={expanded ? ChevronUp : Info} label={expanded ? 'Згорнути' : 'Деталі'} color={expanded ? 'bg-brand/10 text-brand' : 'bg-gray-50 text-gray-600'} onClick={() => setExpanded(!expanded)} />
        </div>

        {/* Status buttons */}
        <div className="flex gap-1.5">
          <SB icon={RotateCw} c="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => doStatus('in-progress')} />
          <SB icon={CheckCircle2} c="border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => doStatus('completed')} />
          <SB icon={XCircle} c="border-red-200 text-red-500 hover:bg-red-50" onClick={() => doStatus('cancelled')} />
          <SB icon={Undo2} c="border-gray-300 text-gray-500 hover:bg-gray-100" onClick={doUndo} disabled={!canUndo} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2.5">
          <div className="flex justify-end mb-2">
            {onEdit && (
              <button onClick={() => onEdit(item)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-bold cursor-pointer active:scale-95 transition-all">
                <Pencil className="w-3 h-3" />Редагувати
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {item.internalNum && <Cell label="Внутрішній №" value={'ВН-' + item.internalNum} />}
            <Cell label="Тел. відправника" value={item.senderPhone} />
            <Cell label="Отримувач" value={item.recipientName} />
            <Cell label="Тел. отримувача" value={item.recipientPhone} />
            <Cell label="Адреса отримувача" value={item.recipientAddr} full />
            {item.weight && <Cell label="Вага" value={item.weight + ' кг'} />}
            {item.amount && <Cell label="Оціночна вартість" value={item.amount} />}
            {item.debt && <Cell label="Оплата клієнта" value={item.debt + (item.currency ? ' ' + item.currency : '')} />}
            {item.payForm && <Cell label="Форма оплати" value={item.payForm} />}
            <Cell label="Ст. оплати" value={derivePayStatus(item.payForm).label} bold accent={derivePayStatus(item.payForm).label === 'Оплачено' ? 'green' : derivePayStatus(item.payForm).label === 'Частково' ? 'amber' : 'red'} />
            {item.deposit && <Cell label="Пакетик" value={item.deposit + (item.depositCurrency ? ' ' + item.depositCurrency : '')} />}
            {item.senderName && <Cell label="Відправник" value={item.senderName} />}
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

function Cell({ label, value, full, bold, accent }: { label: string; value?: string; full?: boolean; bold?: boolean; accent?: 'green' | 'red' | 'amber' }) {
  if (!value) return null;
  const vc = accent === 'green' ? 'text-emerald-700' : accent === 'red' ? 'text-red-600' : accent === 'amber' ? 'text-amber-700' : 'text-text';
  return (
    <div className={`py-1 min-w-0 ${full ? 'col-span-2' : ''}`}>
      <div className="text-[9px] text-muted font-semibold uppercase tracking-wide">{label}</div>
      <div className={`text-[11px] ${bold ? 'font-bold' : 'font-medium'} ${vc} truncate`}>{value}</div>
    </div>
  );
}

function Btn({ icon: I, label, color, onClick }: { icon: typeof Phone; label: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform ${color}`}><I className="w-4 h-4" />{label}</button>;
}
function SB({ icon: I, c, onClick, disabled }: { icon: typeof RotateCw; c: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`flex-1 py-2 border rounded-xl flex items-center justify-center transition-all ${c} ${disabled ? 'opacity-50' : 'cursor-pointer active:scale-95'}`}><I className="w-4 h-4" /></button>;
}
