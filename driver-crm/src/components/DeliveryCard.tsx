import { useState } from 'react';
import {
  Phone, MapPin, ChevronDown, ChevronUp, RotateCw, CheckCircle2, XCircle, Undo2,
  FileText, Scale, Clock, MessageSquare, Image, CreditCard, Hash, Navigation,
} from 'lucide-react';
import type { Delivery, ItemStatus } from '../types';
import { StatusIcon } from './StatusBadge';
import { useApp } from '../store/useAppStore';
import { updateDeliveryStatus } from '../api';

interface Props {
  delivery: Delivery;
  globalIndex: number;
}

const statusBorderColors: Record<ItemStatus, string> = {
  pending: 'border-l-amber-400',
  'in-progress': 'border-l-blue-400',
  completed: 'border-l-emerald-400',
  cancelled: 'border-l-red-400',
};

const statusBgColors: Record<ItemStatus, string> = {
  pending: 'bg-dark-card',
  'in-progress': 'bg-blue-950/30',
  completed: 'bg-emerald-950/20',
  cancelled: 'bg-red-950/20',
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

  const handleStatus = async (newStatus: ItemStatus) => {
    setStatus(delivery._statusKey, newStatus);
    try {
      await updateDeliveryStatus(driverName, currentSheet, delivery, newStatus);
      const labels: Record<string, string> = {
        'in-progress': 'В процесі',
        completed: 'Готово!',
        pending: 'Очікує',
      };
      showToast(labels[newStatus] || newStatus);
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      showToast('Введи причину скасування');
      return;
    }
    setStatus(delivery._statusKey, 'cancelled');
    setShowCancel(false);
    try {
      await updateDeliveryStatus(driverName, currentSheet, delivery, 'cancelled', cancelReason);
      showToast('Скасовано');
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    }
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
    } else {
      showToast('Немає адреси');
    }
  };

  return (
    <div
      className={`${statusBgColors[status]} ${statusBorderColors[status]} border-l-4 border border-dark-border rounded-xl p-3 transition-all hover:shadow-[0_0_15px_rgba(57,255,20,0.05)]`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center text-xs font-bold shrink-0">
          {globalIndex + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-xs leading-tight">
            {show('id') && <span className="text-neon-green/60">#{delivery.internalNumber} </span>}
            {show('vo') && delivery.vo && <span className="text-white/50">{delivery.vo} | </span>}
            {show('address') && delivery.address}
          </div>
          {show('name') && delivery.name && (
            <div className="text-[11px] text-white/60 mt-0.5">{delivery.name}</div>
          )}
        </div>
        <StatusIcon status={status} />
      </div>

      {/* Detail badges */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {show('ttn') && delivery.ttn && (
          <Badge icon={FileText} color="text-red-400 bg-red-400/10">ТТН: {delivery.ttn}</Badge>
        )}
        {show('weight') && delivery.weight && (
          <Badge icon={Scale} color="text-white/60 bg-white/5">{delivery.weight} кг</Badge>
        )}
        {show('direction') && delivery.direction && (
          <Badge icon={Navigation} color="text-purple-400 bg-purple-400/10">{delivery.direction}</Badge>
        )}
        {show('timing') && delivery.timing && (
          <Badge icon={Clock} color="text-white/60 bg-white/5">{delivery.timing}</Badge>
        )}
        {show('status') && statusVal && (
          <Badge icon={Hash} color="text-blue-400 bg-blue-400/10">{statusVal}</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {show('phone') && delivery.phone && (
          <Badge icon={Phone} color="text-neon-green bg-neon-green/10" bold>{delivery.phone}</Badge>
        )}
        {show('price') && priceVal && (
          <Badge icon={CreditCard} color="text-emerald-400 bg-emerald-400/10" bold>€{priceVal}</Badge>
        )}
        {show('payment') && paymentVal && (
          <Badge icon={CreditCard} color="text-white/60 bg-white/5">{paymentVal}</Badge>
        )}
        {show('payStatus') && payStatusVal && (
          <Badge icon={CreditCard} color={payStatusVal === 'Оплачено' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'} bold>
            {payStatusVal}
          </Badge>
        )}
      </div>

      {show('note') && delivery.note?.trim() && (
        <div className="flex items-start gap-1 mt-1.5 text-[10px] text-white/40">
          <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{delivery.note}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <ActionBtn icon={Phone} label="Дзвонити" onClick={() => { window.location.href = `tel:${delivery.phone}`; }} />
        <ActionBtn icon={MapPin} label="Карта" onClick={navigate} />
        <ActionBtn
          icon={expanded ? ChevronUp : ChevronDown}
          label="Деталі"
          onClick={() => setExpanded(!expanded)}
        />
      </div>

      {/* Status buttons */}
      <div className="flex gap-1.5 mt-2">
        <StatusBtn icon={RotateCw} color="blue" onClick={() => handleStatus('in-progress')} />
        <StatusBtn icon={CheckCircle2} color="green" onClick={() => handleStatus('completed')} />
        <StatusBtn icon={XCircle} color="red" onClick={() => { setShowCancel(true); setExpanded(true); }} />
        <StatusBtn icon={Undo2} color="purple" onClick={handleUndo} disabled={!canUndo} />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-dark-border space-y-2 animate-in slide-in-from-top-2">
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
            <a
              href={delivery.photo}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-1"
            >
              <Image className="w-3 h-3" /> Відкрити фото
            </a>
          )}
        </div>
      )}

      {/* Cancel reason */}
      {showCancel && (
        <div className="mt-3 pt-3 border-t border-red-400/20 animate-in slide-in-from-top-2">
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Причина скасування..."
            autoFocus
            className="w-full px-3 py-2 bg-dark-surface border border-red-400/30 rounded-lg text-white text-xs resize-y min-h-[60px] focus:outline-none focus:border-red-400/50 placeholder-white/30"
          />
          <button
            onClick={handleCancel}
            className="w-full mt-2 py-2 bg-red-500 text-white font-semibold rounded-lg text-xs hover:bg-red-600 transition-colors cursor-pointer"
          >
            Підтвердити скасування
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function Badge({
  icon: Icon,
  color,
  bold,
  children,
}: {
  icon: typeof Phone;
  color: string;
  bold?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${bold ? 'font-bold' : 'font-medium'} ${color}`}>
      <Icon className="w-2.5 h-2.5" />
      {children}
    </span>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Phone;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1 py-2 bg-dark-surface border border-dark-border rounded-lg text-[10px] font-semibold text-white/60 hover:text-neon-green hover:border-neon-green/20 transition-all cursor-pointer"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

function StatusBtn({
  icon: Icon,
  color,
  onClick,
  disabled,
}: {
  icon: typeof RotateCw;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 border-blue-400/30 hover:bg-blue-400/10',
    green: 'text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10',
    red: 'text-red-400 border-red-400/30 hover:bg-red-400/10',
    purple: 'text-purple-400 border-purple-400/30 hover:bg-purple-400/10',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2 border rounded-lg flex items-center justify-center transition-all cursor-pointer ${colors[color]} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function Detail({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string;
  highlight?: 'green' | 'red';
}) {
  if (!value) return null;
  const highlightColor = highlight === 'green' ? 'text-emerald-400' : highlight === 'red' ? 'text-red-400' : 'text-white/80';
  return (
    <div className="bg-dark-surface/50 border-l-2 border-neon-green/30 rounded-r-lg px-3 py-2">
      <div className="text-[9px] text-neon-green/60 font-bold uppercase tracking-wider">{label}</div>
      <div className={`text-xs ${highlightColor} mt-0.5 break-words`}>{value}</div>
    </div>
  );
}
