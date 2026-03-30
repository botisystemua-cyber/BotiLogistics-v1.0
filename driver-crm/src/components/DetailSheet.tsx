import {
  X, Phone, MapPin, User, Hash, FileText, Scale, Clock, Navigation,
  CreditCard, Calendar, Image, ExternalLink, Car, Users,
} from 'lucide-react';
import type { Delivery, Passenger, ItemStatus } from '../types';

interface Props {
  item: Delivery | Passenger;
  type: 'delivery' | 'passenger';
  status: ItemStatus;
  onClose: () => void;
}

const statusLabel: Record<ItemStatus, { t: string; c: string }> = {
  pending: { t: 'Очікує', c: 'text-amber-700 bg-amber-50' },
  'in-progress': { t: 'В роботі', c: 'text-blue-700 bg-blue-50' },
  completed: { t: 'Готово', c: 'text-emerald-700 bg-emerald-50' },
  cancelled: { t: 'Скасов.', c: 'text-red-700 bg-red-50' },
};

export function DetailSheet({ item, type, status, onClose }: Props) {
  const sl = statusLabel[status];

  if (type === 'delivery') {
    const d = item as Delivery;
    const priceVal = d.price || d.amount || '';
    const paymentVal = d.payment || '';
    const payStatusVal = d.paymentStatus || d.payStatus || '';

    return (
      <Sheet onClose={onClose}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 mr-3">
            <p className="font-bold text-text text-lg leading-snug">{d.address || '—'}</p>
            <p className="text-sm text-secondary mt-0.5">{d.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${sl.c}`}>{sl.t}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
              <X className="w-5 h-5 text-muted" />
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 mb-5">
          {d.phone && (
            <a href={`tel:${d.phone}`} className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand text-white font-bold text-sm rounded-xl active:scale-[0.97] transition-transform">
              <Phone className="w-4 h-4" />Дзвонити
            </a>
          )}
          <button onClick={() => {
            if (d.coords?.lat) window.open(`https://www.google.com/maps/dir/?api=1&destination=${d.coords.lat},${d.coords.lng}&travelmode=driving`, '_blank');
            else if (d.address) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address)}&travelmode=driving`, '_blank');
          }} className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-700 font-bold text-sm rounded-xl active:scale-[0.97] transition-transform cursor-pointer">
            <MapPin className="w-4 h-4" />Карта
          </button>
        </div>

        {/* Info rows */}
        <div className="space-y-0.5">
          <Row icon={Hash} label="Номер" value={d.internalNumber} />
          {d.id && <Row icon={Hash} label="ІД" value={d.id} />}
          {d.vo && <Row icon={FileText} label="ВО" value={d.vo} />}
          <Row icon={MapPin} label="Адреса" value={d.address} />
          {d.ttn && <Row icon={FileText} label="ТТН" value={d.ttn} bold />}
          <Row icon={User} label="Отримувач" value={d.name} />
          {d.phone && <PhoneRow phone={d.phone} label="Телефон" />}
          {d.registrarPhone && <PhoneRow phone={d.registrarPhone} label="Тел. реєстр." />}
          {d.weight && <Row icon={Scale} label="Вага" value={d.weight + ' кг'} />}
          {d.direction && <Row icon={Navigation} label="Напрямок" value={d.direction} />}
          {d.timing && <Row icon={Clock} label="Таймінг" value={d.timing} />}
          {priceVal && <Row icon={CreditCard} label="Сума" value={'€' + priceVal} bold accent="green" />}
          {paymentVal && <Row icon={CreditCard} label="Оплата" value={paymentVal} />}
          {payStatusVal && <Row icon={CreditCard} label="Статус оплати" value={payStatusVal} bold accent={payStatusVal === 'Оплачено' ? 'green' : 'red'} />}
          {d.createdAt && <Row icon={Calendar} label="Оформлено" value={d.createdAt} />}
          {d.receiveDate && <Row icon={Calendar} label="Отримано" value={d.receiveDate} />}
        </div>

        {/* Notes */}
        {d.smsNote?.trim() && (
          <div className="mt-4 px-3 py-2.5 rounded-xl bg-blue-50 text-xs text-text">
            <span className="text-blue-600 font-bold">SMS: </span>{d.smsNote}
          </div>
        )}
        {d.note?.trim() && (
          <div className="mt-2 px-3 py-2.5 rounded-xl bg-amber-50 text-xs text-text">
            <span className="text-amber-700 font-bold">Примітка: </span>{d.note}
          </div>
        )}

        {/* Photo */}
        {d.photo?.startsWith('http') && (
          <a href={d.photo} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-sm text-blue-600 font-semibold">
            <Image className="w-4 h-4" />Відкрити фото<ExternalLink className="w-3 h-3" />
          </a>
        )}
      </Sheet>
    );
  }

  // Passenger
  const p = item as Passenger;

  return (
    <Sheet onClose={onClose}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 mr-3">
          <p className="font-bold text-text text-lg leading-snug">{p.name}</p>
          <p className="text-sm text-secondary mt-0.5 flex items-center gap-1">
            <Car className="w-4 h-4" />{p.from} → {p.to}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${sl.c}`}>{sl.t}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-5">
        <a href={`tel:${p.phone}`} className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand text-white font-bold text-sm rounded-xl active:scale-[0.97] transition-transform">
          <Phone className="w-4 h-4" />Дзвонити
        </a>
        <button onClick={() => p.from && window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.from)}&travelmode=driving`, '_blank')}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-700 font-bold text-sm rounded-xl active:scale-[0.97] transition-transform cursor-pointer">
          <Car className="w-4 h-4" />Звідки
        </button>
        <button onClick={() => p.to && window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.to)}&travelmode=driving`, '_blank')}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-700 font-bold text-sm rounded-xl active:scale-[0.97] transition-transform cursor-pointer">
          <MapPin className="w-4 h-4" />Куди
        </button>
      </div>

      {/* Info rows */}
      <div className="space-y-0.5">
        <Row icon={User} label="ПІБ" value={p.name} />
        {p.id && <Row icon={Hash} label="ІД" value={p.id} />}
        <PhoneRow phone={p.phone} label="Телефон" />
        <Row icon={MapPin} label="Звідки" value={p.from} />
        <Row icon={MapPin} label="Куди" value={p.to} />
        {p.date && <Row icon={Calendar} label="Дата" value={p.date} />}
        {p.timing && <Row icon={Clock} label="Час" value={p.timing} />}
        {p.seats && <Row icon={Users} label="Місць" value={String(p.seats)} />}
        {p.weight && <Row icon={Scale} label="Вага" value={p.weight + ' кг'} />}
        {p.vehicle && <Row icon={Car} label="Автомобіль" value={p.vehicle} />}
        {p.payment && <Row icon={CreditCard} label="Оплата" value={'€' + p.payment} bold accent="green" />}
        {p._sourceRoute && <Row icon={MapPin} label="Маршрут" value={p._sourceRoute} />}
      </div>

      {/* Notes */}
      {p.note?.trim() && (
        <div className="mt-4 px-3 py-2.5 rounded-xl bg-amber-50 text-xs text-text">
          <span className="text-amber-700 font-bold">Примітка: </span>{p.note}
        </div>
      )}
    </Sheet>
  );
}

// ---- Sub-components ----

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-card w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="sticky top-0 bg-card pt-3 pb-2 flex justify-center rounded-t-3xl">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="px-5 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function Row({ icon: I, label, value, bold, accent }: {
  icon: typeof Phone; label: string; value?: string; bold?: boolean; accent?: 'green' | 'red';
}) {
  if (!value) return null;
  const valColor = accent === 'green' ? 'text-emerald-700' : accent === 'red' ? 'text-red-600' : 'text-text';
  return (
    <div className="flex items-center py-2.5 border-b border-gray-100 last:border-0">
      <I className="w-4 h-4 text-muted shrink-0 mr-3" />
      <span className="text-xs text-secondary w-24 shrink-0">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${valColor} flex-1 text-right break-words`}>{value}</span>
    </div>
  );
}

function PhoneRow({ phone, label }: { phone: string; label: string }) {
  return (
    <div className="flex items-center py-2.5 border-b border-gray-100">
      <Phone className="w-4 h-4 text-muted shrink-0 mr-3" />
      <span className="text-xs text-secondary w-24 shrink-0">{label}</span>
      <span className="text-sm font-medium text-text flex-1 text-right">{phone}</span>
      <a href={`tel:${phone}`} className="ml-2 p-1.5 rounded-lg bg-green-50 text-green-700 shrink-0">
        <Phone className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
