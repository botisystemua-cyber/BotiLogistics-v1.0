import { useState } from 'react';
import {
  Phone, MapPin, ChevronDown, ChevronUp, RotateCw, CheckCircle2, XCircle, Undo2,
  FileText, Scale, Clock, MessageSquare, Image, CreditCard, Hash, Navigation,
} from 'lucide-react';
import type { Delivery, ItemStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { useApp } from '../store/useAppStore';
import { updateDeliveryStatus } from '../api';

interface Props {
  delivery: Delivery;
  globalIndex: number;
}

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

  const handleStatus = async (newStatus: ItemStatus) => {
    setStatus(delivery._statusKey, newStatus);
    try {
      await updateDeliveryStatus(driverName, currentSheet, delivery, newStatus);
      const labels: Record<string, string> = { 'in-progress': 'В процесі', completed: 'Готово!', pending: 'Очікує' };
      showToast(labels[newStatus] || newStatus);
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) { showToast('Введи причину скасування'); return; }
    setStatus(delivery._statusKey, 'cancelled');
    setShowCancel(false);
    try {
      await updateDeliveryStatus(driverName, currentSheet, delivery, 'cancelled', cancelReason);
      showToast('Скасовано');
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
  };

  const handleUndo = async () => {
    if (!canUndo) return;
    setStatus(delivery._statusKey, 'pending');
    try {
      await updateDeliveryStatus(driverName, currentSheet, delivery, 'pending', 'Відміна статусу');
      showToast('Статус відмінено');
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
      setStatus(delivery._statusKey, status);
    }
  };

  const navigate = () => {
    if (delivery.coords?.lat) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${delivery.coords.lat},${delivery.coords.lng}&travelmode=driving`, '_blank');
    } else if (delivery.address) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(delivery.address)}&travelmode=driving`, '_blank');
    } else { showToast('Немає адреси'); }
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Main content */}
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-light text-brand flex items-center justify-center text-base font-black shrink-0">
            {globalIndex + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-text text-base leading-snug">
              {show('id') && <span className="text-text-secondary">#{delivery.internalNumber} </span>}
              {show('address') && delivery.address}
            </div>
            {show('name') && delivery.name && (
              <div className="text-sm text-text-secondary mt-1">{delivery.name}</div>
            )}
            {show('vo') && delivery.vo && (
              <div className="text-sm text-text-secondary">{delivery.vo}</div>
            )}
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Info badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          {show('phone') && delivery.phone && (
            <InfoChip icon={Phone} color="green">{delivery.phone}</InfoChip>
          )}
          {show('price') && priceVal && (
            <InfoChip icon={CreditCard} color="green" bold>€{priceVal}</InfoChip>
          )}
          {show('ttn') && delivery.ttn && (
            <InfoChip icon={FileText} color="red">ТТН: {delivery.ttn}</InfoChip>
          )}
          {show('weight') && delivery.weight && (
            <InfoChip icon={Scale} color="gray">{delivery.weight} кг</InfoChip>
          )}
          {show('direction') && delivery.direction && (
            <InfoChip icon={Navigation} color="purple">{delivery.direction}</InfoChip>
          )}
          {show('timing') && delivery.timing && (
            <InfoChip icon={Clock} color="gray">{delivery.timing}</InfoChip>
          )}
          {show('status') && statusVal && (
            <InfoChip icon={Hash} color="blue">{statusVal}</InfoChip>
          )}
          {show('payment') && paymentVal && (
            <InfoChip icon={CreditCard} color="gray">{paymentVal}</InfoChip>
          )}
          {show('payStatus') && payStatusVal && (
            <InfoChip icon={CreditCard} color={payStatusVal === 'Оплачено' ? 'green' : 'red'} bold>{payStatusVal}</InfoChip>
          )}
        </div>

        {show('note') && delivery.note?.trim() && (
          <div className="flex items-start gap-2 mt-3 text-sm text-text-secondary">
            <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{delivery.note}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <BigButton icon={Phone} label="Дзвонити" color="green" onClick={() => { window.location.href = `tel:${delivery.phone}`; }} />
          <BigButton icon={MapPin} label="Карта" color="blue" onClick={navigate} />
          <BigButton icon={expanded ? ChevronUp : ChevronDown} label="Деталі" color="gray" onClick={() => setExpanded(!expanded)} />
        </div>

        {/* Status buttons */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <StatusBtn icon={RotateCw} label="В роботу" color="blue" onClick={() => handleStatus('in-progress')} />
          <StatusBtn icon={CheckCircle2} label="Готово" color="green" onClick={() => handleStatus('completed')} />
          <StatusBtn icon={XCircle} label="Скасувати" color="red" onClick={() => { setShowCancel(true); setExpanded(true); }} />
          <StatusBtn icon={Undo2} label="Відміна" color="gray" onClick={handleUndo} disabled={!canUndo} />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border bg-bg/50 p-5 space-y-3">
          <Detail label="ПІБ" value={delivery.name} />
          <Detail label="Номер / ІД" value={`${delivery.internalNumber}${delivery.id ? ' / ' + delivery.id : ''}`} />
          {delivery.vo && <Detail label="ВО" value={delivery.vo} />}
          <Detail label="Адреса" value={delivery.address} />
          <Detail label="ТТН" value={delivery.ttn} />
          <Detail label="Вага" value={delivery.weight} />
          {delivery.direction && <Detail label="Напрямок" value={delivery.direction} />}
          <Detail label="Телефон" value={delivery.phone} />
          {delivery.registrarPhone && <Detail label="Тел. Реєстратора" value={delivery.registrarPhone} />}
          {priceVal && <Detail label="Сума" value={`€${priceVal}`} />}
          {paymentVal && <Detail label="Оплата" value={paymentVal} />}
          {payStatusVal && <Detail label="Статус оплати" value={payStatusVal} highlight={payStatusVal === 'Оплачено' ? 'green' : 'red'} />}
          {delivery.timing && <Detail label="Таймінг" value={delivery.timing} />}
          {delivery.createdAt && <Detail label="Дата оформлення" value={delivery.createdAt} />}
          {delivery.receiveDate && <Detail label="Дата отримання" value={delivery.receiveDate} />}
          {delivery.smsNote?.trim() && <Detail label="SMS" value={delivery.smsNote} />}
          {delivery.photo?.startsWith('http') && (
            <a href={delivery.photo} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 font-semibold hover:underline mt-2">
              <Image className="w-4 h-4" /> Відкрити фото
            </a>
          )}
        </div>
      )}

      {/* Cancel reason */}
      {showCancel && (
        <div className="border-t border-red-200 bg-red-50 p-5">
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Причина скасування..."
            autoFocus
            className="w-full px-4 py-3 bg-white border-2 border-red-200 rounded-2xl text-text text-sm resize-y min-h-[80px] focus:outline-none focus:border-red-400 placeholder-text-secondary/40"
          />
          <button
            onClick={handleCancel}
            className="w-full mt-3 py-3.5 bg-red-500 text-white font-bold rounded-2xl text-sm hover:bg-red-600 transition-colors cursor-pointer"
          >
            Підтвердити скасування
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function InfoChip({ icon: Icon, color, bold, children }: {
  icon: typeof Phone; color: string; bold?: boolean; children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs ${bold ? 'font-bold' : 'font-semibold'} ${colors[color]}`}>
      <Icon className="w-3.5 h-3.5" />{children}
    </span>
  );
}

function BigButton({ icon: Icon, label, color, onClick }: {
  icon: typeof Phone; label: string; color: string; onClick: () => void;
}) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-700 active:bg-green-100',
    blue: 'bg-blue-50 text-blue-700 active:bg-blue-100',
    gray: 'bg-gray-100 text-gray-600 active:bg-gray-200',
  };
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl font-semibold text-xs transition-all cursor-pointer active:scale-95 ${colors[color]}`}>
      <Icon className="w-5 h-5" />{label}
    </button>
  );
}

function StatusBtn({ icon: Icon, label, color, onClick, disabled }: {
  icon: typeof RotateCw; label: string; color: string; onClick: () => void; disabled?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 text-blue-600 hover:bg-blue-50',
    green: 'border-green-200 text-green-600 hover:bg-green-50',
    red: 'border-red-200 text-red-600 hover:bg-red-50',
    gray: 'border-gray-200 text-gray-500 hover:bg-gray-50',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 py-2.5 border-2 rounded-xl transition-all cursor-pointer text-[10px] font-semibold active:scale-95 ${colors[color]} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>
      <Icon className="w-5 h-5" />{label}
    </button>
  );
}

function Detail({ label, value, highlight }: { label: string; value?: string; highlight?: 'green' | 'red' }) {
  if (!value) return null;
  const hColor = highlight === 'green' ? 'text-green-600 font-bold' : highlight === 'red' ? 'text-red-600 font-bold' : 'text-text';
  return (
    <div className="bg-white rounded-xl px-4 py-3 border border-border">
      <div className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider">{label}</div>
      <div className={`text-sm mt-0.5 break-words ${hColor}`}>{value}</div>
    </div>
  );
}
