import { useState } from 'react';
import {
  Phone, MapPin, RotateCw, CheckCircle2, XCircle, Undo2,
  FileText, Scale, Clock, MessageSquare, CreditCard, Navigation, Info,
} from 'lucide-react';
import type { Delivery, ItemStatus } from '../types';
import { useApp } from '../store/useAppStore';
import { updateDeliveryStatus } from '../api';

interface Props {
  delivery: Delivery;
  globalIndex: number;
  onShowDetail: () => void;
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

export function DeliveryCard({ delivery, globalIndex, onShowDetail }: Props) {
  const { getStatus, setStatus, hiddenCols, driverName, currentSheet, showToast } = useApp();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const status = getStatus(delivery._statusKey);
  const show = (col: string) => !hiddenCols.has(col);
  const priceVal = delivery.price || delivery.amount || '';
  const payStatusVal = delivery.paymentStatus || delivery.payStatus || '';
  const canUndo = status === 'completed' || status === 'cancelled';
  const sl = stLabel[status];

  const doStatus = async (ns: ItemStatus) => {
    setStatus(delivery._statusKey, ns);
    try { await updateDeliveryStatus(driverName, currentSheet, delivery, ns); showToast(stLabel[ns].t + '!'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); }
  };
  const doCancel = async () => {
    if (!cancelReason.trim()) { showToast('Введи причину'); return; }
    setStatus(delivery._statusKey, 'cancelled'); setShowCancel(false);
    try { await updateDeliveryStatus(driverName, currentSheet, delivery, 'cancelled', cancelReason); showToast('Скасовано'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); }
  };
  const doUndo = async () => {
    if (!canUndo) return; const prev = status; setStatus(delivery._statusKey, 'pending');
    try { await updateDeliveryStatus(driverName, currentSheet, delivery, 'pending', 'Відміна'); showToast('Відмінено'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); setStatus(delivery._statusKey, prev); }
  };
  const navigate = () => {
    if (delivery.coords?.lat) window.open(`https://www.google.com/maps/dir/?api=1&destination=${delivery.coords.lat},${delivery.coords.lng}&travelmode=driving`, '_blank');
    else if (delivery.address) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(delivery.address)}&travelmode=driving`, '_blank');
    else showToast('Немає адреси');
  };

  return (
    <div className={`bg-card rounded-2xl border-2 border-gray-300 ${borderColor[status]} border-l-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden`}>
      <div className="p-3.5">
        {/* Top row */}
        <div className="flex items-center gap-2.5 mb-2">
          <span className="w-8 h-8 rounded-lg bg-gray-100 text-secondary flex items-center justify-center text-xs font-black shrink-0">
            {globalIndex + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-text text-[13px] leading-snug truncate">
              {show('id') && <span className="text-secondary">#{delivery.internalNumber} </span>}
              {show('address') && delivery.address}
            </div>
            {show('name') && delivery.name && <div className="text-xs text-secondary truncate mt-0.5">{delivery.name}</div>}
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${sl.c}`}>{sl.t}</span>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {show('phone') && delivery.phone && <C icon={Phone} c="green">{delivery.phone}</C>}
          {show('price') && priceVal && <C icon={CreditCard} c="green" b>€{priceVal}</C>}
          {show('ttn') && delivery.ttn && <C icon={FileText} c="red">ТТН: {delivery.ttn}</C>}
          {show('weight') && delivery.weight && <C icon={Scale} c="gray">{delivery.weight}кг</C>}
          {show('direction') && delivery.direction && <C icon={Navigation} c="purple">{delivery.direction}</C>}
          {show('timing') && delivery.timing && <C icon={Clock} c="gray">{delivery.timing}</C>}
          {show('payStatus') && payStatusVal && (
            <C icon={CreditCard} c={payStatusVal === 'Оплачено' ? 'green' : 'red'} b>{payStatusVal}</C>
          )}
        </div>
        {show('note') && delivery.note?.trim() && (
          <p className="text-[11px] text-secondary leading-snug mb-2 flex gap-1"><MessageSquare className="w-3 h-3 mt-0.5 shrink-0" /><span className="line-clamp-2">{delivery.note}</span></p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mb-2">
          <Btn icon={Phone} label="Дзвонити" color="bg-green-50 text-green-700" onClick={() => { window.location.href = `tel:${delivery.phone}`; }} />
          <Btn icon={MapPin} label="Карта" color="bg-blue-50 text-blue-700" onClick={navigate} />
          <Btn icon={Info} label="Деталі" color="bg-gray-50 text-gray-600" onClick={onShowDetail} />
        </div>

        {/* Status row */}
        <div className="flex gap-1.5">
          <SB icon={RotateCw} c="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => doStatus('in-progress')} />
          <SB icon={CheckCircle2} c="border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => doStatus('completed')} />
          <SB icon={XCircle} c="border-red-200 text-red-500 hover:bg-red-50" onClick={() => setShowCancel(true)} />
          <SB icon={Undo2} c="border-gray-300 text-gray-500 hover:bg-gray-100" onClick={canUndo ? doUndo : () => {}} disabled={!canUndo} />
        </div>
      </div>

      {showCancel && (
        <div className="border-t border-red-100 bg-red-50/60 p-3.5">
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Причина скасування..." autoFocus
            className="w-full px-3 py-2.5 bg-white border border-red-200 rounded-xl text-text text-sm resize-none h-16 focus:outline-none focus:border-red-400" />
          <button onClick={doCancel} className="w-full mt-2 py-2.5 bg-red-500 text-white font-bold rounded-xl text-sm cursor-pointer active:scale-[0.98]">Підтвердити</button>
        </div>
      )}
    </div>
  );
}

function C({ icon: I, c, b, children }: { icon: typeof Phone; c: string; b?: boolean; children: React.ReactNode }) {
  const m: Record<string, string> = { green: 'bg-green-50 text-green-700', red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700', purple: 'bg-purple-50 text-purple-700', gray: 'bg-gray-100 text-gray-500' };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${b ? 'font-bold' : 'font-medium'} ${m[c]}`}><I className="w-3 h-3" />{children}</span>;
}
function Btn({ icon: I, label, color, onClick }: { icon: typeof Phone; label: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform ${color}`}><I className="w-4 h-4" />{label}</button>;
}
function SB({ icon: I, c, onClick, disabled }: { icon: typeof RotateCw; c: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`flex-1 py-2 border rounded-xl flex items-center justify-center transition-all ${c} ${disabled ? 'opacity-50' : 'cursor-pointer active:scale-95'}`}><I className="w-4 h-4" /></button>;
}
