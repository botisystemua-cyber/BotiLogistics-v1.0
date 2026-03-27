import { useState } from 'react';
import {
  Phone, MapPin, ChevronDown, ChevronUp, RotateCw, CheckCircle2, XCircle, Undo2,
  Users, Calendar, Clock, Car, FileText, ArrowRight, Repeat,
} from 'lucide-react';
import type { Passenger, ItemStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { useApp } from '../store/useAppStore';
import { updatePassengerStatus } from '../api';

interface Props {
  passenger: Passenger;
  index: number;
  onTransfer?: () => void;
}

export function PassengerCard({ passenger, index, onTransfer }: Props) {
  const { getStatus, setStatus, driverName, currentSheet, isUnifiedView, showToast } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const status = getStatus(passenger._statusKey);
  const canUndo = status === 'completed' || status === 'cancelled';
  const routeName = isUnifiedView && passenger._sourceRoute ? passenger._sourceRoute : currentSheet;

  const handleStatus = async (newStatus: ItemStatus) => {
    setStatus(passenger._statusKey, newStatus);
    try {
      await updatePassengerStatus(driverName, routeName, passenger, newStatus);
      const labels: Record<string, string> = { 'in-progress': 'В процесі', completed: 'Готово!', pending: 'Очікує' };
      showToast(labels[newStatus] || newStatus);
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) { showToast('Введи причину скасування'); return; }
    setStatus(passenger._statusKey, 'cancelled');
    setShowCancel(false);
    try {
      await updatePassengerStatus(driverName, routeName, passenger, 'cancelled', cancelReason);
      showToast('Скасовано');
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
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
    } else { showToast('Немає адреси'); }
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-base font-black shrink-0">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            {isUnifiedView && passenger._sourceRoute && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-blue-600 bg-blue-50 mb-1.5">
                <MapPin className="w-3 h-3" />
                {passenger._sourceRoute}
              </span>
            )}
            <div className="font-bold text-text text-base">{passenger.name}</div>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-text-secondary">
              <Car className="w-4 h-4" />
              {passenger.from}
              <ArrowRight className="w-4 h-4 text-brand" />
              {passenger.to}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Info chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          <InfoChip icon={Phone} color="green">{passenger.phone}</InfoChip>
          {passenger.date && <InfoChip icon={Calendar} color="gray">{passenger.date}</InfoChip>}
          {passenger.timing && <InfoChip icon={Clock} color="gray">{passenger.timing}</InfoChip>}
          {passenger.seats && <InfoChip icon={Users} color="blue">{passenger.seats} місць</InfoChip>}
          {passenger.payment && <InfoChip icon={FileText} color="green" bold>€{passenger.payment}</InfoChip>}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <BigButton icon={Phone} label="Дзвонити" color="green" onClick={() => { window.location.href = `tel:${passenger.phone}`; }} />
          <BigButton icon={Car} label="Відправка" color="blue" onClick={() => navigateTo(passenger.from)} />
          <BigButton icon={MapPin} label="Прибуття" color="blue" onClick={() => navigateTo(passenger.to)} />
        </div>

        <div className={`grid ${onTransfer ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mt-3`}>
          <BigButton icon={expanded ? ChevronUp : ChevronDown} label="Деталі" color="gray" onClick={() => setExpanded(!expanded)} />
          {onTransfer && (
            <button onClick={onTransfer}
              className="flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl font-semibold text-xs bg-amber-50 text-amber-700 active:bg-amber-100 transition-all cursor-pointer active:scale-95">
              <Repeat className="w-5 h-5" /> Перенести
            </button>
          )}
        </div>

        {/* Status buttons */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <StatusBtn icon={RotateCw} label="В роботу" color="blue" onClick={() => handleStatus('in-progress')} />
          <StatusBtn icon={CheckCircle2} label="Готово" color="green" onClick={() => handleStatus('completed')} />
          <StatusBtn icon={XCircle} label="Скасувати" color="red" onClick={() => { setShowCancel(true); setExpanded(true); }} />
          <StatusBtn icon={Undo2} label="Відміна" color="gray" onClick={handleUndo} disabled={!canUndo} />
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-border bg-bg/50 p-5 space-y-3">
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
        <div className="border-t border-red-200 bg-red-50 p-5">
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Причина скасування..." autoFocus
            className="w-full px-4 py-3 bg-white border-2 border-red-200 rounded-2xl text-text text-sm resize-y min-h-[80px] focus:outline-none focus:border-red-400 placeholder-text-secondary/40" />
          <button onClick={handleCancel}
            className="w-full mt-3 py-3.5 bg-red-500 text-white font-bold rounded-2xl text-sm hover:bg-red-600 transition-colors cursor-pointer">
            Підтвердити скасування
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Shared sub-components ----

function InfoChip({ icon: Icon, color, bold, children }: { icon: typeof Phone; color: string; bold?: boolean; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-700', blue: 'bg-blue-50 text-blue-700', gray: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs ${bold ? 'font-bold' : 'font-semibold'} ${colors[color]}`}>
      <Icon className="w-3.5 h-3.5" />{children}
    </span>
  );
}

function BigButton({ icon: Icon, label, color, onClick }: { icon: typeof Phone; label: string; color: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-700 active:bg-green-100', blue: 'bg-blue-50 text-blue-700 active:bg-blue-100', gray: 'bg-gray-100 text-gray-600 active:bg-gray-200',
  };
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl font-semibold text-xs transition-all cursor-pointer active:scale-95 ${colors[color]}`}>
      <Icon className="w-5 h-5" />{label}
    </button>
  );
}

function StatusBtn({ icon: Icon, label, color, onClick, disabled }: { icon: typeof RotateCw; label: string; color: string; onClick: () => void; disabled?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 text-blue-600 hover:bg-blue-50', green: 'border-green-200 text-green-600 hover:bg-green-50',
    red: 'border-red-200 text-red-600 hover:bg-red-50', gray: 'border-gray-200 text-gray-500 hover:bg-gray-50',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 py-2.5 border-2 rounded-xl transition-all cursor-pointer text-[10px] font-semibold active:scale-95 ${colors[color]} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>
      <Icon className="w-5 h-5" />{label}
    </button>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="bg-white rounded-xl px-4 py-3 border border-border">
      <div className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider">{label}</div>
      <div className="text-sm text-text mt-0.5 break-words">{value}</div>
    </div>
  );
}
