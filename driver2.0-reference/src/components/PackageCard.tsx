import { useState } from 'react';
import {
  Phone, MapPin, RotateCw, CheckCircle2, XCircle, Undo2,
  CreditCard, Info, ChevronUp, Calendar, Pencil,
} from 'lucide-react';
import type { Package, ItemStatus } from '../types';
import { useApp } from '../store/useAppStore';
import { updateItemStatus } from '../api';
import { Highlight } from './Highlight';
import { isUaEu, isEuUa } from '../utils/smsParser';
import { TipsButton } from './TipsButton';

interface Props { pkg: Package; index: number; searchQuery?: string; onEdit?: (p: Package) => void; onConvertPickup?: (p: Package) => void; }

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

export function PackageCard({ pkg: p, index, searchQuery = '', onEdit, onConvertPickup }: Props) {
  const hl = (text: string) => <Highlight text={text} query={searchQuery} />;
  const { getStatus, setStatus, hiddenCols, driverName, currentSheet, isUnifiedView, showToast } = useApp();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [localTips, setLocalTips] = useState(p.tips);
  const [localTipsCur, setLocalTipsCur] = useState(p.tipsCurrency);

  const show = (col: string) => !hiddenCols.has(col);
  const rawStatus = getStatus(p._statusKey);
  const status: ItemStatus = rawStatus in stLabel ? rawStatus : 'pending';
  const canUndo = status === 'completed' || status === 'cancelled';
  const routeName = isUnifiedView && p._sourceRoute ? p._sourceRoute : currentSheet;
  const sl = stLabel[status];
  const dirKind: 'ua-eu' | 'eu-ua' | null = isUaEu(p.direction) ? 'ua-eu' : isEuUa(p.direction) ? 'eu-ua' : null;
  const dirBar = dirKind === 'ua-eu' ? 'border-l-emerald-500' : dirKind === 'eu-ua' ? 'border-l-orange-500' : 'border-l-gray-300';
  const dirBadge = dirKind === 'ua-eu'
    ? { label: 'UA → EU', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' }
    : dirKind === 'eu-ua'
    ? { label: 'EU → UA', cls: 'bg-orange-100 text-orange-700 border-orange-300' }
    : null;

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
  const navigate = () => {
    if (p.recipientAddr) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.recipientAddr)}&travelmode=driving`, '_blank');
    else showToast('Немає адреси');
  };

  return (
    <div className={`bg-card rounded-2xl border-2 border-gray-300 ${dirBar} border-l-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden`}>
      <div className={`h-0.5 ${borderColor[status].replace('border-l-', 'bg-')}`} />
      <div className="px-3 py-2.5">
        {dirBadge && (
          <div className="mb-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-black tracking-wide ${dirBadge.cls}`}>
              {dirBadge.label}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 mb-1">
          <span className="relative w-7 h-7 rounded-lg bg-gray-100 text-secondary flex items-center justify-center text-[11px] font-black shrink-0">
            {index + 1}
            <span className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none">📦</span>
          </span>
          <div className="flex-1 min-w-0">
            {isUnifiedView && p._sourceRoute && <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-blue-600 bg-blue-50 mb-0.5">{p._sourceRoute}</span>}
            {show('recipientAddr') && <div className="font-bold text-text text-[13px] leading-snug truncate">{hl(p.recipientAddr || '—')}</div>}
            {show('recipientName') && p.recipientName && <div className="text-xs text-secondary truncate">{hl(p.recipientName)}</div>}
          </div>
          <TipsButton
            tips={localTips}
            tipsCurrency={localTipsCur}
            routeName={routeName}
            itemId={p.itemId}
            onUpdated={(t, c) => { setLocalTips(t); setLocalTipsCur(c); }}
          />
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${sl.c}`}>{sl.t}</span>
        </div>

        <div className="flex items-center gap-2 ml-9 mb-2 flex-wrap">
          {show('recipientPhone') && p.recipientPhone && <Chip icon={Phone} c="green">{hl(p.recipientPhone)}</Chip>}
          {show('amount') && p.amount && <Chip icon={CreditCard} c="green" b>{p.amount} {p.currency}</Chip>}
          {show('payStatus') && (() => { const ps = derivePayStatus(p.payForm); return (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ps.cls}`}>{ps.label}</span>
          ); })()}
          {show('dateTrip') && p.dateTrip && <Chip icon={Calendar} c="gray">{p.dateTrip}</Chip>}
        </div>

        <div className="flex gap-2 mb-2">
          <Btn icon={Phone} label="Дзвонити" color="bg-green-50 text-green-700" onClick={() => { if (p.recipientPhone) window.location.href = `tel:${p.recipientPhone}`; else showToast('Немає телефону'); }} />
          <Btn icon={MapPin} label="Куди" color="bg-blue-50 text-blue-700" onClick={() => {
            const addr = dirKind === 'eu-ua' ? p.addrFrom : p.recipientAddr;
            if (addr) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`, '_blank');
            else showToast('Немає адреси');
          }} />
          <Btn icon={MapPin} label="Куди" color="bg-blue-50 text-blue-700" onClick={navigate} />
          <Btn icon={expanded ? ChevronUp : Info} label={expanded ? 'Згорнути' : 'Деталі'} color={expanded ? 'bg-brand/10 text-brand' : 'bg-gray-50 text-gray-600'} onClick={() => setExpanded(!expanded)} />
        </div>

        {dirKind === 'eu-ua' && status !== 'completed' && onConvertPickup && (
          <button onClick={() => onConvertPickup(p)} className="w-full mb-2 py-2.5 rounded-xl bg-emerald-500 text-white text-[12px] font-bold cursor-pointer active:scale-95 transition-transform">
            ✅ Оформити відправку
          </button>
        )}

        <div className="flex gap-1.5">
          <SB icon={RotateCw} c="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => doStatus('in-progress')} />
          <SB icon={CheckCircle2} c="border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => doStatus('completed')} />
          <SB icon={XCircle} c="border-red-200 text-red-500 hover:bg-red-50" onClick={() => setShowCancel(true)} />
          <SB icon={Undo2} c="border-gray-300 text-gray-500 hover:bg-gray-100" onClick={canUndo ? doUndo : () => {}} disabled={!canUndo} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2.5">
          {onEdit && (
            <div className="flex justify-end mb-2">
              <button onClick={() => onEdit(p)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-bold cursor-pointer active:scale-95 transition-all">
                <Pencil className="w-3 h-3" />Редагувати
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <Cell label="Адреса отримувача" value={p.recipientAddr} full />
            <Cell label="Отримувач" value={p.recipientName} />
            <Cell label="Тел. отримувача" value={p.recipientPhone} />
            <Cell label="Відправник" value={p.senderName} />
            <Cell label="Внутр. №" value={p.internalNum} />
            <Cell label="ТТН" value={p.ttn} bold />
            <Cell label="Опис" value={p.pkgDesc} />
            <Cell label="Вага" value={p.pkgWeight ? p.pkgWeight + ' кг' : ''} />
            <Cell label="Дата рейсу" value={p.dateTrip} />
            <Cell label="Таймінг" value={p.timing} />
            <Cell label="Місто" value={p.city} />
            <Cell label="Напрям" value={p.direction} />
            <Cell label="Сума" value={p.amount ? p.amount + ' ' + p.currency : ''} bold accent="green" />
            <Cell label="Оплата" value={p.payForm} />
            <Cell label="Ст. оплати" value={derivePayStatus(p.payForm).label} bold accent={derivePayStatus(p.payForm).label === 'Оплачено' ? 'green' : derivePayStatus(p.payForm).label === 'Частково' ? 'amber' : 'red'} />
            <Cell label="Борг" value={p.debt} accent="red" />
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

function Cell({ label, value, bold, accent, full }: { label: string; value?: string; bold?: boolean; accent?: 'green' | 'red' | 'amber'; full?: boolean }) {
  if (!value) return null;
  const vc = accent === 'green' ? 'text-emerald-700' : accent === 'red' ? 'text-red-600' : accent === 'amber' ? 'text-amber-700' : 'text-text';
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
