import { useState } from 'react';
import {
  Phone, MapPin, RotateCw, CheckCircle2, XCircle, Undo2,
  Users, Calendar, Clock, Car, FileText, ArrowRight, Repeat, Info,
  ChevronUp, Hash, Scale, CreditCard, User,
} from 'lucide-react';
import type { Passenger, ItemStatus } from '../types';
import { useApp } from '../store/useAppStore';
import { updatePassengerStatus } from '../api';

interface Props {
  passenger: Passenger;
  index: number;
  onTransfer?: () => void;
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

export function PassengerCard({ passenger, index, onTransfer }: Props) {
  const { getStatus, setStatus, driverName, currentSheet, isUnifiedView, showToast } = useApp();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [expanded, setExpanded] = useState(false);

  const status = getStatus(passenger._statusKey);
  const canUndo = status === 'completed' || status === 'cancelled';
  const routeName = isUnifiedView && passenger._sourceRoute ? passenger._sourceRoute : currentSheet;
  const sl = stLabel[status];

  const doStatus = async (ns: ItemStatus) => {
    setStatus(passenger._statusKey, ns);
    try { await updatePassengerStatus(driverName, routeName, passenger, ns); showToast(stLabel[ns].t + '!'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); }
  };
  const doCancel = async () => {
    if (!cancelReason.trim()) { showToast('Введи причину'); return; }
    setStatus(passenger._statusKey, 'cancelled'); setShowCancel(false);
    try { await updatePassengerStatus(driverName, routeName, passenger, 'cancelled', cancelReason); showToast('Скасовано'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); }
  };
  const doUndo = async () => {
    if (!canUndo) return; const prev = status; setStatus(passenger._statusKey, 'pending');
    try { await updatePassengerStatus(driverName, routeName, passenger, 'pending', 'Відміна'); showToast('Відмінено'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); setStatus(passenger._statusKey, prev); }
  };
  const nav = (addr: string) => {
    if (addr) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`, '_blank');
    else showToast('Немає адреси');
  };

  return (
    <div className={`bg-card rounded-2xl border-2 border-gray-300 ${borderColor[status]} border-l-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden`}>
      <div className="p-3.5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black shrink-0">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            {isUnifiedView && passenger._sourceRoute && (
              <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-blue-600 bg-blue-50 mb-0.5">{passenger._sourceRoute}</span>
            )}
            <div className="font-bold text-text text-[13px] leading-snug truncate">{passenger.name}</div>
            <div className="flex items-center gap-1 text-xs text-secondary truncate">
              <Car className="w-3 h-3 shrink-0" /><span className="truncate">{passenger.from}</span>
              <ArrowRight className="w-3 h-3 shrink-0 text-brand" /><span className="truncate">{passenger.to}</span>
            </div>
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${sl.c}`}>{sl.t}</span>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <C icon={Phone} c="green">{passenger.phone}</C>
          {passenger.date && <C icon={Calendar} c="gray">{passenger.date}</C>}
          {passenger.timing && <C icon={Clock} c="gray">{passenger.timing}</C>}
          {passenger.seats && <C icon={Users} c="blue">{passenger.seats} місць</C>}
          {passenger.payment && <C icon={FileText} c="green" b>€{passenger.payment}</C>}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-2">
          <Btn icon={Phone} label="Дзвонити" color="bg-green-50 text-green-700" onClick={() => { window.location.href = `tel:${passenger.phone}`; }} />
          <Btn icon={Car} label="Звідки" color="bg-blue-50 text-blue-700" onClick={() => nav(passenger.from)} />
          <Btn icon={MapPin} label="Куди" color="bg-blue-50 text-blue-700" onClick={() => nav(passenger.to)} />
        </div>
        <div className="flex gap-2 mb-2">
          <Btn icon={expanded ? ChevronUp : Info} label={expanded ? 'Згорнути' : 'Деталі'} color={expanded ? 'bg-brand/10 text-brand' : 'bg-gray-50 text-gray-600'} onClick={() => setExpanded(!expanded)} />
          {onTransfer && <Btn icon={Repeat} label="Перенести" color="bg-amber-50 text-amber-700" onClick={onTransfer} />}
        </div>

        {/* Status */}
        <div className="flex gap-1.5">
          <SB icon={RotateCw} c="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => doStatus('in-progress')} />
          <SB icon={CheckCircle2} c="border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => doStatus('completed')} />
          <SB icon={XCircle} c="border-red-200 text-red-500 hover:bg-red-50" onClick={() => setShowCancel(true)} />
          <SB icon={Undo2} c="border-gray-300 text-gray-500 hover:bg-gray-100" onClick={canUndo ? doUndo : () => {}} disabled={!canUndo} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <PCell label="ПІБ" value={passenger.name} full />
            {passenger.id && <PCell label="ІД" value={passenger.id} />}
            <PCell label="Телефон" value={passenger.phone} phone />
            <PCell label="Звідки" value={passenger.from} />
            <PCell label="Куди" value={passenger.to} />
            {passenger.date && <PCell label="Дата" value={passenger.date} />}
            {passenger.timing && <PCell label="Час" value={passenger.timing} />}
            {passenger.seats && <PCell label="Місць" value={String(passenger.seats)} />}
            {passenger.weight && <PCell label="Вага" value={passenger.weight + ' кг'} />}
            {passenger.vehicle && <PCell label="Автомобіль" value={passenger.vehicle} />}
            {passenger.payment && <PCell label="Оплата" value={'€' + passenger.payment} bold accent="green" />}
            {passenger._sourceRoute && <PCell label="Маршрут" value={passenger._sourceRoute} />}
          </div>
          {passenger.note?.trim() && (
            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50 text-[11px] text-text">
              <span className="text-amber-700 font-bold">Примітка: </span>{passenger.note}
            </div>
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

function PCell({ label, value, bold, accent, phone, full }: {
  label: string; value?: string; bold?: boolean; accent?: 'green' | 'red'; phone?: boolean; full?: boolean;
}) {
  if (!value) return null;
  const valColor = accent === 'green' ? 'text-emerald-700' : accent === 'red' ? 'text-red-600' : 'text-text';
  return (
    <div className={`py-1 min-w-0 ${full ? 'col-span-2' : ''}`}>
      <div className="text-[9px] text-muted font-semibold uppercase tracking-wide">{label}</div>
      <div className={`text-[11px] ${bold ? 'font-bold' : 'font-medium'} ${valColor} truncate flex items-center gap-1`}>
        {value}
        {phone && (
          <a href={`tel:${value}`} className="p-0.5 rounded bg-green-50 text-green-700 shrink-0">
            <Phone className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function C({ icon: I, c, b, children }: { icon: typeof Phone; c: string; b?: boolean; children: React.ReactNode }) {
  const m: Record<string, string> = { green: 'bg-green-50 text-green-700', blue: 'bg-blue-50 text-blue-700', gray: 'bg-gray-100 text-gray-500' };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${b ? 'font-bold' : 'font-medium'} ${m[c]}`}><I className="w-3 h-3" />{children}</span>;
}
function Btn({ icon: I, label, color, onClick }: { icon: typeof Phone; label: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform ${color}`}><I className="w-4 h-4" />{label}</button>;
}
function SB({ icon: I, c, onClick, disabled }: { icon: typeof RotateCw; c: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`flex-1 py-2 border rounded-xl flex items-center justify-center transition-all ${c} ${disabled ? 'opacity-50' : 'cursor-pointer active:scale-95'}`}><I className="w-4 h-4" /></button>;
}
