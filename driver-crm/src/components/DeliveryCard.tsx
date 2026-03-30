import { useState } from 'react';
import {
  Phone, MapPin, RotateCw, CheckCircle2, XCircle, Undo2,
  CreditCard, Info, ChevronUp, Hash, FileText, Scale, Clock,
  Navigation, Calendar, Image, ExternalLink, User,
} from 'lucide-react';
import type { Delivery, ItemStatus } from '../types';
import { useApp } from '../store/useAppStore';
import { updateDeliveryStatus } from '../api';

interface Props {
  delivery: Delivery;
  globalIndex: number;
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

export function DeliveryCard({ delivery, globalIndex }: Props) {
  const { getStatus, setStatus, hiddenCols, driverName, currentSheet, showToast } = useApp();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [expanded, setExpanded] = useState(false);

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
      <div className="px-3 py-2.5">
        {/* Top row: number + address + status */}
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-lg bg-gray-100 text-secondary flex items-center justify-center text-[11px] font-black shrink-0">
            {globalIndex + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-text text-[13px] leading-snug truncate">
              {show('address') && (delivery.address || '—')}
            </div>
            {show('name') && delivery.name && <div className="text-xs text-secondary truncate">{delivery.name}</div>}
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${sl.c}`}>{sl.t}</span>
        </div>

        {/* Key info only: phone + price */}
        <div className="flex items-center gap-2 ml-9 mb-2">
          {show('phone') && delivery.phone && (
            <span className="text-xs font-semibold text-text flex items-center gap-1">
              <Phone className="w-3 h-3 text-brand" />{delivery.phone}
            </span>
          )}
          {show('price') && priceVal && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CreditCard className="w-3 h-3" />€{priceVal}
            </span>
          )}
          {show('payStatus') && payStatusVal && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${payStatusVal === 'Оплачено' ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>{payStatusVal}</span>
          )}
        </div>

        {/* Actions — compact */}
        <div className="flex gap-1.5 ml-9 mb-1.5">
          <Btn icon={Phone} label="Дзвонити" color="bg-green-50 text-green-700" onClick={() => { window.location.href = `tel:${delivery.phone}`; }} />
          <Btn icon={MapPin} label="Карта" color="bg-blue-50 text-blue-700" onClick={navigate} />
          <Btn icon={expanded ? ChevronUp : Info} label={expanded ? 'Згорнути' : 'Деталі'} color={expanded ? 'bg-brand/10 text-brand' : 'bg-gray-50 text-gray-600'} onClick={() => setExpanded(!expanded)} />
        </div>

        {/* Status row */}
        <div className="flex gap-1 ml-9">
          <SB icon={RotateCw} c="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => doStatus('in-progress')} />
          <SB icon={CheckCircle2} c="border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => doStatus('completed')} />
          <SB icon={XCircle} c="border-red-200 text-red-500 hover:bg-red-50" onClick={() => setShowCancel(true)} />
          <SB icon={Undo2} c="border-gray-300 text-gray-500 hover:bg-gray-100" onClick={canUndo ? doUndo : () => {}} disabled={!canUndo} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-3">
          <div className="space-y-0.5">
            <DRow icon={Hash} label="Номер" value={delivery.internalNumber} />
            {delivery.id && <DRow icon={Hash} label="ІД" value={delivery.id} />}
            {delivery.vo && <DRow icon={FileText} label="ВО" value={delivery.vo} />}
            <DRow icon={MapPin} label="Адреса" value={delivery.address} />
            {delivery.ttn && <DRow icon={FileText} label="ТТН" value={delivery.ttn} bold />}
            <DRow icon={User} label="Отримувач" value={delivery.name} />
            {delivery.phone && <DRow icon={Phone} label="Телефон" value={delivery.phone} phone />}
            {delivery.registrarPhone && <DRow icon={Phone} label="Тел. реєстр." value={delivery.registrarPhone} phone />}
            {delivery.weight && <DRow icon={Scale} label="Вага" value={delivery.weight + ' кг'} />}
            {delivery.direction && <DRow icon={Navigation} label="Напрямок" value={delivery.direction} />}
            {delivery.timing && <DRow icon={Clock} label="Таймінг" value={delivery.timing} />}
            {priceVal && <DRow icon={CreditCard} label="Сума" value={'€' + priceVal} bold accent="green" />}
            {delivery.payment && <DRow icon={CreditCard} label="Оплата" value={delivery.payment} />}
            {payStatusVal && <DRow icon={CreditCard} label="Статус оплати" value={payStatusVal} bold accent={payStatusVal === 'Оплачено' ? 'green' : 'red'} />}
            {delivery.createdAt && <DRow icon={Calendar} label="Оформлено" value={delivery.createdAt} />}
            {delivery.receiveDate && <DRow icon={Calendar} label="Отримано" value={delivery.receiveDate} />}
          </div>
          {delivery.smsNote?.trim() && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-blue-50 text-xs text-text">
              <span className="text-blue-600 font-bold">SMS: </span>{delivery.smsNote}
            </div>
          )}
          {delivery.note?.trim() && (
            <div className="mt-2 px-3 py-2 rounded-xl bg-amber-50 text-xs text-text">
              <span className="text-amber-700 font-bold">Примітка: </span>{delivery.note}
            </div>
          )}
          {delivery.photo?.startsWith('http') && (
            <a href={delivery.photo} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-sm text-blue-600 font-semibold">
              <Image className="w-4 h-4" />Фото<ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

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

function DRow({ icon: I, label, value, bold, accent, phone }: {
  icon: typeof Phone; label: string; value?: string; bold?: boolean; accent?: 'green' | 'red'; phone?: boolean;
}) {
  if (!value) return null;
  const valColor = accent === 'green' ? 'text-emerald-700' : accent === 'red' ? 'text-red-600' : 'text-text';
  return (
    <div className="flex items-center py-2 border-b border-gray-100 last:border-0">
      <I className="w-3.5 h-3.5 text-muted shrink-0 mr-2.5" />
      <span className="text-[11px] text-secondary w-20 shrink-0">{label}</span>
      <span className={`text-xs ${bold ? 'font-bold' : 'font-medium'} ${valColor} flex-1 text-right break-words`}>{value}</span>
      {phone && (
        <a href={`tel:${value}`} className="ml-2 p-1 rounded-lg bg-green-50 text-green-700 shrink-0">
          <Phone className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function Btn({ icon: I, label, color, onClick }: { icon: typeof Phone; label: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform ${color}`}><I className="w-4 h-4" />{label}</button>;
}
function SB({ icon: I, c, onClick, disabled }: { icon: typeof RotateCw; c: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`flex-1 py-2 border rounded-xl flex items-center justify-center transition-all ${c} ${disabled ? 'opacity-50' : 'cursor-pointer active:scale-95'}`}><I className="w-4 h-4" /></button>;
}
