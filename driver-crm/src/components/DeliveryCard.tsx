import { useState } from 'react';
import {
  Phone, MapPin, ChevronDown, ChevronUp, RotateCw, CheckCircle2, XCircle, Undo2,
  FileText, Scale, Clock, MessageSquare, Image, CreditCard, Hash, Navigation,
  User, Calendar, ExternalLink,
} from 'lucide-react';
import type { Delivery, ItemStatus } from '../types';
import { useApp } from '../store/useAppStore';
import { updateDeliveryStatus } from '../api';

interface Props { delivery: Delivery; globalIndex: number; }

const borderColor: Record<ItemStatus, string> = {
  pending: 'border-l-amber-400', 'in-progress': 'border-l-blue-500',
  completed: 'border-l-emerald-500', cancelled: 'border-l-red-400',
};
const statusLabel: Record<ItemStatus, { t: string; c: string }> = {
  pending: { t: 'Очікує', c: 'text-amber-600 bg-amber-50' },
  'in-progress': { t: 'В роботі', c: 'text-blue-600 bg-blue-50' },
  completed: { t: 'Готово', c: 'text-emerald-600 bg-emerald-50' },
  cancelled: { t: 'Скасов.', c: 'text-red-600 bg-red-50' },
};

export function DeliveryCard({ delivery, globalIndex }: Props) {
  const { getStatus, setStatus, hiddenCols, driverName, currentSheet, showToast } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const status = getStatus(delivery._statusKey);
  const show = (col: string) => !hiddenCols.has(col);
  const priceVal = delivery.price || delivery.amount || '';
  const paymentVal = delivery.payment || '';
  const payStatusVal = delivery.paymentStatus || delivery.payStatus || '';
  const statusVal = delivery.parcelStatus || delivery.status || '';
  const canUndo = status === 'completed' || status === 'cancelled';
  const sl = statusLabel[status];

  const doStatus = async (ns: ItemStatus) => {
    setStatus(delivery._statusKey, ns);
    try { await updateDeliveryStatus(driverName, currentSheet, delivery, ns); showToast(statusLabel[ns].t + '!'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); }
  };
  const doCancel = async () => {
    if (!cancelReason.trim()) { showToast('Введи причину'); return; }
    setStatus(delivery._statusKey, 'cancelled'); setShowCancel(false);
    try { await updateDeliveryStatus(driverName, currentSheet, delivery, 'cancelled', cancelReason); showToast('Скасовано'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); }
  };
  const doUndo = async () => {
    if (!canUndo) return;
    const prev = status; setStatus(delivery._statusKey, 'pending');
    try { await updateDeliveryStatus(driverName, currentSheet, delivery, 'pending', 'Відміна'); showToast('Відмінено'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); setStatus(delivery._statusKey, prev); }
  };
  const navigate = () => {
    if (delivery.coords?.lat) window.open(`https://www.google.com/maps/dir/?api=1&destination=${delivery.coords.lat},${delivery.coords.lng}&travelmode=driving`, '_blank');
    else if (delivery.address) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(delivery.address)}&travelmode=driving`, '_blank');
    else showToast('Немає адреси');
  };

  return (
    <div className={`bg-card rounded-2xl border-2 border-gray-300 ${borderColor[status]} border-l-4 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]`}>
      <div className="p-3.5">
        {/* Top row */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-gray-100 text-text flex items-center justify-center text-xs font-black shrink-0">
            {globalIndex + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-text text-[13px] leading-snug truncate">
              {show('id') && <span className="text-muted">#{delivery.internalNumber} </span>}
              {show('address') && delivery.address}
            </div>
            {show('name') && delivery.name && <div className="text-xs text-muted truncate mt-0.5">{delivery.name}</div>}
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${sl.c}`}>{sl.t}</span>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {show('phone') && delivery.phone && <C icon={Phone} c="green">{delivery.phone}</C>}
          {show('price') && priceVal && <C icon={CreditCard} c="green" b>€{priceVal}</C>}
          {show('ttn') && delivery.ttn && <C icon={FileText} c="red">ТТН: {delivery.ttn}</C>}
          {show('weight') && delivery.weight && <C icon={Scale} c="gray">{delivery.weight}кг</C>}
          {show('direction') && delivery.direction && <C icon={Navigation} c="purple">{delivery.direction}</C>}
          {show('timing') && delivery.timing && <C icon={Clock} c="gray">{delivery.timing}</C>}
          {show('status') && statusVal && <C icon={Hash} c="blue">{statusVal}</C>}
          {show('payment') && paymentVal && <C icon={CreditCard} c="gray">{paymentVal}</C>}
          {show('payStatus') && payStatusVal && <C icon={CreditCard} c={payStatusVal === 'Оплачено' ? 'green' : 'red'} b>{payStatusVal}</C>}
        </div>
        {show('note') && delivery.note?.trim() && (
          <p className="text-[11px] text-muted leading-snug mb-3 flex gap-1"><MessageSquare className="w-3 h-3 mt-0.5 shrink-0" /><span className="line-clamp-2">{delivery.note}</span></p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mb-2">
          <Btn icon={Phone} label="Дзвонити" color="bg-green-50 text-green-700" onClick={() => { window.location.href = `tel:${delivery.phone}`; }} />
          <Btn icon={MapPin} label="Карта" color="bg-blue-50 text-blue-700" onClick={navigate} />
          <Btn icon={expanded ? ChevronUp : ChevronDown} label={expanded ? 'Згорнути' : 'Деталі'} color="bg-gray-50 text-gray-600" onClick={() => setExpanded(!expanded)} />
        </div>

        {/* Status row */}
        <div className="flex gap-1.5">
          <SB icon={RotateCw} c="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => doStatus('in-progress')} />
          <SB icon={CheckCircle2} c="border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => doStatus('completed')} />
          <SB icon={XCircle} c="border-red-200 text-red-500 hover:bg-red-50" onClick={() => { setShowCancel(true); setExpanded(true); }} />
          <SB icon={Undo2} c="border-gray-300 text-gray-500 hover:bg-gray-100" onClick={canUndo ? doUndo : () => {}} disabled={!canUndo} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-gray-50/80 px-3.5 py-3 space-y-2.5">
          {/* Contact */}
          <DetailGroup icon={User} title="Контакт" color="text-blue-600 bg-blue-50">
            <div className="space-y-1.5">
              {delivery.name && <DRow icon={User} value={delivery.name} />}
              {delivery.phone && (
                <div className="flex items-center justify-between">
                  <DRow icon={Phone} value={delivery.phone} />
                  <a href={`tel:${delivery.phone}`} className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-[10px] font-bold flex items-center gap-1">
                    <Phone className="w-3 h-3" />Дзвонити
                  </a>
                </div>
              )}
              {delivery.registrarPhone && (
                <div className="flex items-center justify-between">
                  <DRow icon={Phone} value={delivery.registrarPhone} label="Реєстр." />
                  <a href={`tel:${delivery.registrarPhone}`} className="px-2.5 py-1 rounded-lg bg-gray-100 text-secondary text-[10px] font-bold flex items-center gap-1">
                    <Phone className="w-3 h-3" />Дзвонити
                  </a>
                </div>
              )}
            </div>
          </DetailGroup>

          {/* Delivery info */}
          <DetailGroup icon={MapPin} title="Доставка" color="text-amber-600 bg-amber-50">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <DRow icon={Hash} value={delivery.internalNumber} label="Номер" />
              {delivery.id && <DRow icon={Hash} value={delivery.id} label="ІД" />}
              {delivery.vo && <DRow icon={FileText} value={delivery.vo} label="ВО" />}
              {delivery.ttn && <DRow icon={FileText} value={delivery.ttn} label="ТТН" />}
              {delivery.weight && <DRow icon={Scale} value={delivery.weight + ' кг'} label="Вага" />}
              {delivery.direction && <DRow icon={Navigation} value={delivery.direction} label="Напрямок" />}
              {delivery.timing && <DRow icon={Clock} value={delivery.timing} label="Таймінг" />}
            </div>
            {delivery.address && (
              <div className="mt-1.5 text-xs text-text leading-snug">
                <span className="text-muted">Адреса: </span>{delivery.address}
              </div>
            )}
          </DetailGroup>

          {/* Payment */}
          {(priceVal || paymentVal || payStatusVal) && (
            <DetailGroup icon={CreditCard} title="Оплата" color="text-emerald-600 bg-emerald-50">
              <div className="flex flex-wrap gap-2">
                {priceVal && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">€{priceVal}</span>
                )}
                {paymentVal && (
                  <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-secondary text-xs font-medium">{paymentVal}</span>
                )}
                {payStatusVal && (
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${payStatusVal === 'Оплачено' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{payStatusVal}</span>
                )}
              </div>
            </DetailGroup>
          )}

          {/* Dates & notes */}
          {(delivery.createdAt || delivery.receiveDate || delivery.smsNote?.trim() || delivery.note?.trim() || delivery.photo?.startsWith('http')) && (
            <DetailGroup icon={Calendar} title="Інше" color="text-gray-600 bg-gray-100">
              <div className="space-y-1.5">
                {delivery.createdAt && <DRow icon={Calendar} value={delivery.createdAt} label="Оформлено" />}
                {delivery.receiveDate && <DRow icon={Calendar} value={delivery.receiveDate} label="Отримано" />}
                {delivery.smsNote?.trim() && (
                  <div className="text-xs text-text mt-1 px-2.5 py-1.5 rounded-lg bg-blue-50">
                    <span className="text-blue-600 font-semibold">SMS: </span>{delivery.smsNote}
                  </div>
                )}
                {delivery.note?.trim() && (
                  <div className="text-xs text-text mt-1 px-2.5 py-1.5 rounded-lg bg-amber-50">
                    <span className="text-amber-700 font-semibold">Примітка: </span>{delivery.note}
                  </div>
                )}
                {delivery.photo?.startsWith('http') && (
                  <a href={delivery.photo} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold mt-1">
                    <Image className="w-3.5 h-3.5" />Відкрити фото <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </DetailGroup>
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
function DetailGroup({ icon: I, title, color, children }: { icon: typeof Phone; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-border`}>
        <span className={`w-6 h-6 rounded-md ${color} flex items-center justify-center`}><I className="w-3.5 h-3.5" /></span>
        <span className="text-xs font-bold text-text">{title}</span>
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  );
}

function DRow({ icon: I, value, label }: { icon: typeof Phone; value: string; label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <I className="w-3.5 h-3.5 text-muted shrink-0" />
      {label && <span className="text-muted">{label}:</span>}
      <span className="text-text font-medium truncate">{value}</span>
    </div>
  );
}
