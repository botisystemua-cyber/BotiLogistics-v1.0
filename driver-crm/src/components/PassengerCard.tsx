import { useState } from 'react';
import {
  Phone, MapPin, RotateCw, CheckCircle2, XCircle, Undo2,
  Car, ArrowRight, Info, ChevronUp, CreditCard, Calendar, Clock, Users, User, Pencil, MessageCircle,
  AlertCircle, Lock,
} from 'lucide-react';
import type { Passenger, ItemStatus } from '../types';
import { useApp } from '../store/useAppStore';
import { updateItemStatus } from '../api';
import { readSession } from '../lib/session';
import { Highlight } from './Highlight';
import { isUaEu, isEuUa } from '../utils/smsParser';
import { MessengerPopup } from './MessengerPopup';
import { AddressPicker } from './AddressPicker';
import { PaymentSheet } from './PaymentSheet';
import { TipsButton } from './TipsButton';

interface Props { passenger: Passenger; index: number; searchQuery?: string; onEdit?: (p: Passenger) => void; }

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

export function PassengerCard({ passenger: p, index, searchQuery = '', onEdit }: Props) {
  const hl = (text: string) => <Highlight text={text} query={searchQuery} />;
  const { getStatus, setStatus, hiddenCols, driverName, currentSheet, isUnifiedView, showToast } = useApp();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showMessenger, setShowMessenger] = useState(false);
  const [showAddrPicker, setShowAddrPicker] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [localPayStatus, setLocalPayStatus] = useState(p.payStatus);
  const [localPayForm, setLocalPayForm] = useState(p.payForm);
  const [localDebt, setLocalDebt] = useState(p.debt);
  const [localCollectedBy, setLocalCollectedBy] = useState(p.paymentCollectedBy);
  const [localTips, setLocalTips] = useState(p.tips);
  const [localTipsCur, setLocalTipsCur] = useState(p.tipsCurrency);

  const show = (col: string) => !hiddenCols.has(col);
  const rawStatus = getStatus(p._statusKey);
  const status: ItemStatus = rawStatus in stLabel ? rawStatus : 'pending';
  const canUndo = status === 'completed' || status === 'cancelled';
  const routeName = isUnifiedView && p._sourceRoute ? p._sourceRoute : currentSheet;
  const sl = stLabel[status];
  const dirKind: 'ua-eu' | 'eu-ua' | null = isUaEu(p.direction) ? 'ua-eu' : isEuUa(p.direction) ? 'eu-ua' : null;
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
    // Undo повертає в «В роботі» — водій уже взявся за пасажира і
    // помилково натиснув Готово/Скасов. Не скидаємо назад у чергу.
    if (!canUndo) return; const prev = status; setStatus(p._statusKey, 'in-progress');
    try { await updateItemStatus(driverName, routeName, p, 'in-progress', 'Відміна'); showToast('Повернено в роботу'); }
    catch (e) { showToast('Помилка: ' + (e as Error).message); setStatus(p._statusKey, prev); }
  };

  return (
    <div className={`bg-card rounded-2xl border-2 border-gray-300 ${borderColor[status]} border-l-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden`}>
      <div className="p-3.5">
        {dirBadge && (
          <div className="mb-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-black tracking-wide ${dirBadge.cls}`}>
              {dirBadge.label}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2.5 mb-2">
          <span className="relative w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black shrink-0">
            {index + 1}
            <User className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 bg-blue-100 rounded-full p-0.5 box-content" />
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
          <TipsButton
            tips={localTips}
            tipsCurrency={localTipsCur}
            routeName={routeName}
            itemId={p.itemId}
            onUpdated={(t, c) => { setLocalTips(t); setLocalTipsCur(c); }}
          />
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${sl.c}`}>{sl.t}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {show('phone') && p.phone && <Chip icon={Phone} c="green">{hl(p.phone)}</Chip>}
          {show('dateTrip') && p.dateTrip && <Chip icon={Calendar} c="gray">{p.dateTrip}</Chip>}
          {show('timing') && p.timing && <Chip icon={Clock} c="gray">{p.timing}</Chip>}
          {show('seatsCount') && p.seatsCount && <Chip icon={Users} c="blue">{p.seatsCount} місць</Chip>}
          {show('amount') && p.amount && <Chip icon={CreditCard} c="green" b>{p.amount} {p.currency}</Chip>}
          {(() => {
            // Тапабельний чіп оплати: тап → bottom-sheet з 5 опцій. Замочок,
            // якщо менеджер уже відмітив (collected_by != мене).
            const sess = readSession();
            const myLogin = sess?.user_login || '';
            const isLockedForMe = localPayStatus === 'Оплачено'
              && localCollectedBy !== '' && localCollectedBy !== myLogin;
            const label = paxFormLabel(localPayStatus, localPayForm);
            const cls = paxFormClass(localPayStatus);
            return (
              <button
                onClick={(e) => { e.stopPropagation(); setShowPayment(true); }}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-transform ${cls}`}
                title={isLockedForMe ? 'Уже оплачено: ' + (localCollectedBy || 'менеджер') : 'Натисніть щоб змінити'}
              >
                {isLockedForMe && <Lock className="w-3 h-3" />}
                {label}
              </button>
            );
          })()}
          {(() => {
            // Червоний чіп «Борг» — показуємо лише при unpaid/partial і debt > 0.
            const debtN = parseFloat(localDebt) || 0;
            const isUnpaid = localPayStatus === 'Не оплачено' || localPayStatus === 'Частково';
            if (!isUnpaid || debtN <= 0) return null;
            return <Chip icon={AlertCircle} c="red" b title="Не повністю оплачено">Борг: {debtN}{p.currency ? ' ' + p.currency : ''}</Chip>;
          })()}
        </div>

        {/* 🔗 Перелік об'єднаних ТТН (якщо це primary з дочками) */}
        {p.mergedTtns && p.mergedTtns.length > 0 && (
          <div className="mb-2 px-2 py-1 rounded-lg bg-violet-50 border border-violet-200 text-[11px] font-bold text-violet-700">
            🔗 + {p.mergedTtns.length} ТТН: {p.mergedTtns.join(', ')}
          </div>
        )}

        <div className="flex gap-2 mb-2">
          <Btn icon={Phone} label="Дзвонити" color="bg-green-50 text-green-700" onClick={() => { if (p.phone) window.location.href = `tel:${p.phone}`; else showToast('Немає телефону'); }} />
          <Btn icon={MessageCircle} label="Написати" color="bg-purple-50 text-purple-700" onClick={() => { if (p.phone) setShowMessenger(true); else showToast('Немає телефону'); }} />
          <Btn icon={MapPin} label="Куди" color="bg-blue-50 text-blue-700" onClick={() => { if (p.addrFrom || p.addrTo) setShowAddrPicker(true); else showToast('Немає адрес'); }} />
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
          {onEdit && (
            <div className="flex justify-end mb-2">
              <button onClick={() => onEdit(p)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-bold cursor-pointer active:scale-95 transition-all">
                <Pencil className="w-3 h-3" />Редагувати
              </button>
            </div>
          )}
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
            <Cell label="Оплата" value={localPayForm} />
            <Cell label="Ст. оплати" value={localPayStatus} />
            <Cell label="Хто прийняв" value={localCollectedBy ? (localCollectedBy + (localCollectedBy === (readSession()?.user_login || '') ? ' (я)' : '')) : ''} />
            <Cell label="Борг" value={parseFloat(localDebt) > 0 ? localDebt + (p.currency ? ' ' + p.currency : '') : ''} bold accent="red" />
            <Cell label="Напрям" value={p.direction} />
            <Cell label="Тег" value={p.tag} />
          </div>
          {p.note && <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50 text-[11px] text-text"><span className="text-amber-700 font-bold">Примітка: </span>{p.note}</div>}
          {p.smsNote && <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-[11px] text-text"><span className="text-blue-600 font-bold">SMS: </span>{p.smsNote}</div>}
        </div>
      )}

      {showMessenger && <MessengerPopup phone={p.phone} onClose={() => setShowMessenger(false)} />}
      {showAddrPicker && <AddressPicker addrFrom={p.addrFrom} addrTo={p.addrTo} onClose={() => setShowAddrPicker(false)} />}
      {showPayment && (
        <PaymentSheet
          routeRowUuid={p._uuid}
          currentStatus={localPayStatus}
          currentForm={localPayForm}
          collectedBy={localCollectedBy}
          amount={p.amount}
          currency={p.currency}
          onClose={() => setShowPayment(false)}
          showToast={showToast}
          onApplied={(r) => {
            setLocalPayStatus(r.status);
            setLocalPayForm(r.form);
            setLocalDebt(String(r.debt));
            setLocalCollectedBy(r.collectedBy);
          }}
        />
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

// Лейбл і колір тапабельного чіпа оплати — точно по тих самих правилах
// що в PackageCard'і (символи й стан). Дублюємо локально, бо PackageCard
// використовує свою копію (formLabel/formClass) — спільний хелпер додасть
// імпорт-зайв на 8 рядків коду.
function paxFormLabel(payStatus: string, payForm: string): string {
  if (payStatus === 'Оплачено') {
    if (payForm === 'Готівка') return '💵 Готівка';
    if (payForm === 'Картка')  return '💳 Картка';
    if (payForm === 'Наложка') return '🏦 Наложка';
    return '✅ Оплачено';
  }
  if (payStatus === 'Частково')    return '🟡 Частково';
  if (payStatus === 'Не оплачено') return '⚠️ Не оплачено';
  const f = (payForm || '').toLowerCase().trim();
  if (f === 'готівка' || f === 'картка') return '✅ Оплачено';
  if (f === 'частково') return '🟡 Частково';
  if (f === 'наложка')  return '🏦 Наложка';
  return '⚠️ Борг';
}
function paxFormClass(payStatus: string): string {
  if (payStatus === 'Оплачено')    return 'text-emerald-700 bg-emerald-50';
  if (payStatus === 'Частково')    return 'text-amber-700 bg-amber-50';
  if (payStatus === 'Не оплачено') return 'text-red-700 bg-red-50';
  return 'text-gray-600 bg-gray-100';
}

function Cell({ label, value, bold, accent, full }: { label: string; value?: string; bold?: boolean; accent?: 'green' | 'red'; full?: boolean }) {
  if (!value) return null;
  const vc = accent === 'green' ? 'text-emerald-700' : accent === 'red' ? 'text-red-600' : 'text-text';
  return (<div className={`py-1 min-w-0 ${full ? 'col-span-2' : ''}`}><div className="text-[9px] text-muted font-semibold uppercase tracking-wide">{label}</div><div className={`text-[11px] ${bold ? 'font-bold' : 'font-medium'} ${vc} truncate`}>{value}</div></div>);
}
function Chip({ icon: I, c, b, title, children }: { icon: typeof Phone; c: string; b?: boolean; title?: string; children: React.ReactNode }) {
  const m: Record<string, string> = { green: 'bg-green-50 text-green-700', blue: 'bg-blue-50 text-blue-700', gray: 'bg-gray-100 text-gray-500', red: 'bg-red-50 text-red-700' };
  return <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${b ? 'font-bold' : 'font-medium'} ${m[c]}`}><I className="w-3 h-3" />{children}</span>;
}
function Btn({ icon: I, label, color, onClick }: { icon: typeof Phone; label: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform ${color}`}><I className="w-4 h-4" />{label}</button>;
}
function SB({ icon: I, c, onClick, disabled }: { icon: typeof RotateCw; c: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`flex-1 py-2 border rounded-xl flex items-center justify-center transition-all ${c} ${disabled ? 'opacity-50' : 'cursor-pointer active:scale-95'}`}><I className="w-4 h-4" /></button>;
}
