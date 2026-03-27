import { useState } from 'react';
import {
  Phone, MapPin, ChevronDown, ChevronUp, RotateCw, CheckCircle2, XCircle, Undo2,
  Users, Calendar, Clock, Car, FileText, ArrowRight, Repeat,
} from 'lucide-react';
import type { Passenger, ItemStatus } from '../types';
import { StatusIcon } from './StatusBadge';
import { useApp } from '../store/useAppStore';
import { updatePassengerStatus } from '../api';

interface Props {
  passenger: Passenger;
  index: number;
  onTransfer?: () => void;
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

export function PassengerCard({ passenger, index, onTransfer }: Props) {
  const { getStatus, setStatus, driverName, currentSheet, isUnifiedView, showToast } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const status = getStatus(passenger._statusKey);
  const canUndo = status === 'completed' || status === 'cancelled';
  const routeName =
    isUnifiedView && passenger._sourceRoute ? passenger._sourceRoute : currentSheet;

  const handleStatus = async (newStatus: ItemStatus) => {
    setStatus(passenger._statusKey, newStatus);
    try {
      await updatePassengerStatus(driverName, routeName, passenger, newStatus);
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
    setStatus(passenger._statusKey, 'cancelled');
    setShowCancel(false);
    try {
      await updatePassengerStatus(driverName, routeName, passenger, 'cancelled', cancelReason);
      showToast('Скасовано');
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    }
  };

  const handleUndo = async () => {
    if (!canUndo) return;
    const prev = status;
    setStatus(passenger._statusKey, 'pending');
    try {
      await updatePassengerStatus(driverName, routeName, passenger, 'pending', 'Відміна статусу водієм');
      showToast('Статус відмінено');
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
      setStatus(passenger._statusKey, prev);
    }
  };

  const navigateTo = (addr: string) => {
    if (addr) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`, '_blank');
    } else {
      showToast('Немає адреси');
    }
  };

  return (
    <div
      className={`${statusBgColors[status]} ${statusBorderColors[status]} border-l-4 border border-dark-border rounded-xl p-3 transition-all hover:shadow-[0_0_15px_rgba(57,255,20,0.05)]`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-400/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          {isUnifiedView && passenger._sourceRoute && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-blue-300 bg-blue-400/10 mb-1">
              <MapPin className="w-2.5 h-2.5" />
              {passenger._sourceRoute}
            </span>
          )}
          <div className="font-semibold text-white text-xs">{passenger.name}</div>
          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-white/40">
            <Car className="w-3 h-3" />
            {passenger.from}
            <ArrowRight className="w-3 h-3 text-neon-green/50" />
            {passenger.to}
          </div>
        </div>
        <StatusIcon status={status} />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {passenger.date && (
          <Badge icon={Calendar} color="text-white/60 bg-white/5">{passenger.date}</Badge>
        )}
        {passenger.timing && (
          <Badge icon={Clock} color="text-white/60 bg-white/5">{passenger.timing}</Badge>
        )}
        {passenger.seats && (
          <Badge icon={Users} color="text-blue-400 bg-blue-400/10">{passenger.seats} місць</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <Badge icon={Phone} color="text-neon-green bg-neon-green/10" bold>{passenger.phone}</Badge>
        {passenger.payment && (
          <Badge icon={FileText} color="text-emerald-400 bg-emerald-400/10" bold>€{passenger.payment}</Badge>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <ActionBtn icon={Phone} label="Дзвонити" onClick={() => { window.location.href = `tel:${passenger.phone}`; }} />
        <ActionBtn icon={Car} label="Відправка" onClick={() => navigateTo(passenger.from)} />
        <ActionBtn icon={MapPin} label="Прибуття" onClick={() => navigateTo(passenger.to)} />
      </div>

      <div className={`grid ${onTransfer ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mt-2`}>
        <ActionBtn
          icon={expanded ? ChevronUp : ChevronDown}
          label="Деталі"
          onClick={() => setExpanded(!expanded)}
        />
        {onTransfer && (
          <button
            onClick={onTransfer}
            className="flex items-center justify-center gap-1 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-[10px] font-semibold text-orange-400 hover:bg-orange-500/20 transition-all cursor-pointer"
          >
            <Repeat className="w-3 h-3" /> Перенести
          </button>
        )}
      </div>

      {/* Status buttons */}
      <div className="flex gap-1.5 mt-2">
        <StatusBtn icon={RotateCw} color="blue" onClick={() => handleStatus('in-progress')} />
        <StatusBtn icon={CheckCircle2} color="green" onClick={() => handleStatus('completed')} />
        <StatusBtn icon={XCircle} color="red" onClick={() => { setShowCancel(true); setExpanded(true); }} />
        <StatusBtn icon={Undo2} color="purple" onClick={handleUndo} disabled={!canUndo} />
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-dark-border space-y-2 animate-in slide-in-from-top-2">
          <Detail label="ПІБ" value={passenger.name} />
          <Detail label="ІД" value={passenger.id} />
          <Detail label="Дата виїзду" value={passenger.date} />
          <Detail label="Маршрут" value={`${passenger.from} → ${passenger.to}`} />
          <Detail label="Місць" value={passenger.seats?.toString()} />
          <Detail label="Вага" value={passenger.weight} />
          <Detail label="Автомобіль" value={passenger.vehicle} />
          {passenger._sourceRoute && <Detail label="Маршрутний лист" value={passenger._sourceRoute} />}
          {passenger.note?.trim() && <Detail label="Примітка" value={passenger.note} />}
        </div>
      )}

      {/* Cancel */}
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

// ---- Shared sub-components ----

function Badge({ icon: Icon, color, bold, children }: { icon: typeof Phone; color: string; bold?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${bold ? 'font-bold' : 'font-medium'} ${color}`}>
      <Icon className="w-2.5 h-2.5" />{children}
    </span>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: { icon: typeof Phone; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-1 py-2 bg-dark-surface border border-dark-border rounded-lg text-[10px] font-semibold text-white/60 hover:text-neon-green hover:border-neon-green/20 transition-all cursor-pointer">
      <Icon className="w-3 h-3" />{label}
    </button>
  );
}

function StatusBtn({ icon: Icon, color, onClick, disabled }: { icon: typeof RotateCw; color: string; onClick: () => void; disabled?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 border-blue-400/30 hover:bg-blue-400/10',
    green: 'text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10',
    red: 'text-red-400 border-red-400/30 hover:bg-red-400/10',
    purple: 'text-purple-400 border-purple-400/30 hover:bg-purple-400/10',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`flex-1 py-2 border rounded-lg flex items-center justify-center transition-all cursor-pointer ${colors[color]} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>
      <Icon className="w-4 h-4" />
    </button>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="bg-dark-surface/50 border-l-2 border-neon-green/30 rounded-r-lg px-3 py-2">
      <div className="text-[9px] text-neon-green/60 font-bold uppercase tracking-wider">{label}</div>
      <div className="text-xs text-white/80 mt-0.5 break-words">{value}</div>
    </div>
  );
}
