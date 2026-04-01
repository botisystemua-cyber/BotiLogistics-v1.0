import { useState } from 'react';
import {
  Phone, MapPin, RotateCw, CheckCircle2, XCircle, Undo2,
  Car, ArrowRight, Info, ChevronUp, CreditCard, Calendar, Clock, Users, User,
} from 'lucide-react';
import type { Passenger, ItemStatus } from '../types';
import { useApp } from '../store/useAppStore';
import { updateItemStatus } from '../api';
import { Highlight } from './Highlight';

interface Props { passenger: Passenger; index: number; searchQuery?: string; }

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

export function PassengerCard({ passenger: p, index, searchQuery = '' }: Props) {
  const hl = (text: string) => <Highlight text={text} query={searchQuery} />;
  const { getStatus, setStatus, hiddenCols, driverName, currentSheet, isUnifiedView, showToast } = useApp();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [expanded, setExpanded] = useState(false);

  const show = (col: string) => !hiddenCols.has(col);
  const rawStatus = getStatus(p._statusKey);
  const status: ItemStatus = rawStatus in stLabel ? rawStatus : 'pending';
  const canUndo = status === 'completed' || status === 'cancelled';
  const routeName = isUnifiedView && p._sourceRoute ? p._sourceRoute : currentSheet;
  const sl = stLabel[status];

  const doStatus = async (ns: ItemStatus) => {
    setStatus(p._statusKey, ns);
    try { await updateItemStatus(driverName, routeName, p, ns); showToast(stLabel[ns].t + '!'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); }
  };
  const doCancel = async () => {
    if (!cancelReason.trim()) { showToast('Введи причину'); return; }
    setStatus(p._statusKey, 'cancelled'); setShowCancel(false);
    try { await updateItemStatus(driverName, routeName, p, 'cancelled', cancelReason); showToast('Скасовано'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); }
  };
  const doUndo = async () => {
    if (!canUndo) return; const prev = status; setStatus(p._statusKey, 'pending');
    try { await updateItemStatus(driverName, routeName, p, 'pending', 'Відміна'); showToast('Відмінено'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); setStatus(p._statusKey, prev); }
  };
  const nav = (addr: string) => {
    if (addr) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`, '_blank');
    else showToast('Немає адреси');
  };

  return (
    <div className={`bg-card rounded-2xl border-2 border-gray-300 ${borderColor[status]} border-l-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden`}>
      <div className="p-3.5">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex flex-col items-center justify-center shrink-0">
            <User className="w-3 h-3" />
            <span className="text-[8px] font-black leading-none">{index + 1}</span>
          </span>
          <div className="flex-1 min-w-0">
            {isUnifiedView && p._sourceRoute && <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-blue-600 bg-blue-50 mb-0.5">{p._sourceRoute}</span>}
            {show('name') && <div className="font-bold text-text text-[13px] leading-snug truncate">{hl(p.name)}</div>}
            {(show('addrFrom') || show('addrTo')) && (
              <div className="flex items-center gap-1 text-xs text-secondary truncate">
                {show('addrFrom') && <><Car className="w-3 h-3 shrink-0" /><span className="truncate">{hl(p.addrFrom)}</span></>}
                {show('addrFrom') && show('addrTo') && <ArrowRight className="w-3 h-3 shrink-0 text-brand" />}
                {show('addrTo') && <span className="truncate">{hl(p.addrTo)}</span>}
              </div>
            )}
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${sl.c}`}>{sl.t}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {show('phone') && p.phone && <Chip icon={Phone} c="green">{hl(p.phone)}</Chip>}
          {show('dateTrip') && p.dateTrip && <Chip icon={Calendar} c="gray">{p.dateTrip}</Chip>}
          {show('timing') && p.timing && <Chip icon={Clock} c="gray">{p.timing}</Chip>}
          {show('seatsCount') && p.seatsCount && <Chip icon={Users} c="blue">{p.seatsCount} місць</Chip>}
          {show('amount') && p.amount && <Chip icon={CreditCard} c="green" b>{p.amount} {p.currency}</Chip>}
        </div>

        <div className="flex gap-2 mb-2">
          {p.phone && <Btn icon={Phone} label="Дзвонити" color="bg-green-50 text-green-700" onClick={() => { window.location.href = `tel:${p.phone}`; }} />}
          <Btn icon={Car} label="Звідки" color="bg-blue-50 text-blue-700" onClick={() => nav(p.addrFrom)} />
          <Btn icon={MapPin} label="Куди" color="bg-blue-50 text-blue-700" onClick={() => nav(p.addrTo)} />
        </div>
        <div className="flex gap-2 mb-2">
          <Btn icon={expanded ? ChevronUp : Info} label={expanded ? 'Згорнути' : 'Деталі'} color={expanded ? 'bg-brand/10 text-brand' : 'bg-gray-50 text-gray-600'} onClick={() => setExpanded(!expanded)} />
        </div>

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
            <Cell label="ПІБ" value={p.name} full />
            <Cell label="Телефон" value={p.phone} />
            <Cell label="Звідки" value={p.addrFrom} />
            <Cell label="Куди" value={p.addrTo} />
            <Cell label="Дата рейсу" value={p.dateTrip} />
            <Cell label="Таймінг" value={p.timing} />
            <Cell label="Місць" value={p.seatsCount} />
            <Cell label="Вага багажу" value={p.baggageWeight} />
            <Cell label="Місце" value={p.seat} />
            <Cell label="Місто" value={p.city} />
            <Cell label="Сума" value={p.amount ? p.amount + ' ' + p.currency : ''} bold accent="green" />
            <Cell label="Оплата" value={p.payForm} />
            <Cell label="Ст. оплати" value={p.payStatus} />
            <Cell label="Борг" value={p.debt} accent="red" />
            <Cell label="Напрям" value={p.direction} />
            <Cell label="Тег" value={p.tag} />
          </div>
          {p.note && <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50 text-[11px] text-text"><span className="text-amber-700 font-bold">Примітка: </span>{p.note}</div>}
          {p.smsNote && <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-[11px] text-text"><span className="text-blue-600 font-bold">SMS: </span>{p.smsNote}</div>}
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

function Cell({ label, value, bold, accent, full }: { label: string; value?: string; bold?: boolean; accent?: 'green' | 'red'; full?: boolean }) {
  if (!value) return null;
  const vc = accent === 'green' ? 'text-emerald-700' : accent === 'red' ? 'text-red-600' : 'text-text';
  return (<div className={`py-1 min-w-0 ${full ? 'col-span-2' : ''}`}><div className="text-[9px] text-muted font-semibold uppercase tracking-wide">{label}</div><div className={`text-[11px] ${bold ? 'font-bold' : 'font-medium'} ${vc} truncate`}>{value}</div></div>);
}
function Chip({ icon: I, c, b, children }: { icon: typeof Phone; c: string; b?: boolean; children: React.ReactNode }) {
  const m: Record<string, string> = { green: 'bg-green-50 text-green-700', blue: 'bg-blue-50 text-blue-700', gray: 'bg-gray-100 text-gray-500' };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${b ? 'font-bold' : 'font-medium'} ${m[c]}`}><I className="w-3 h-3" />{children}</span>;
}
function Btn({ icon: I, label, color, onClick }: { icon: typeof Phone; label: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform ${color}`}><I className="w-4 h-4" />{label}</button>;
}
function SB({ icon: I, c, onClick, disabled }: { icon: typeof RotateCw; c: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`flex-1 py-2 border rounded-xl flex items-center justify-center transition-all ${c} ${disabled ? 'opacity-50' : 'cursor-pointer active:scale-95'}`}><I className="w-4 h-4" /></button>;
}
