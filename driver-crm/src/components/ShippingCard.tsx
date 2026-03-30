import { useState } from 'react';
import {
  Phone, MapPin, User, Package, ChevronUp, Info,
  CreditCard, Scale, FileText,
} from 'lucide-react';
import type { ShippingItem } from '../types';

interface Props {
  item: ShippingItem;
  index: number;
}

export function ShippingCard({ item, index }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card rounded-2xl border-2 border-gray-300 border-l-4 border-l-blue-400 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-[11px] font-black shrink-0">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-text text-[13px] leading-snug truncate">
              {item.name || '—'}
            </div>
            {item.city && (
              <div className="text-xs text-secondary truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />{item.city}
              </div>
            )}
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-700 bg-blue-50">
            Відпр.
          </span>
        </div>

        {/* Key info */}
        <div className="flex items-center gap-2 ml-9 mb-2 flex-wrap">
          {item.number && (
            <span className="text-xs font-semibold text-text flex items-center gap-1">
              <Package className="w-3 h-3 text-blue-500" />#{item.number}
            </span>
          )}
          {item.phone && (
            <span className="text-xs font-semibold text-text flex items-center gap-1">
              <Phone className="w-3 h-3 text-green-600" />{item.phone}
            </span>
          )}
          {item.amount && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CreditCard className="w-3 h-3" />{item.amount}{item.currency ? ' ' + item.currency : ''}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 ml-9">
          {item.phone && (
            <button onClick={() => { window.location.href = `tel:${item.phone}`; }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform bg-green-50 text-green-700">
              <Phone className="w-4 h-4" />Дзвонити
            </button>
          )}
          {item.city && (
            <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.city)}&travelmode=driving`, '_blank')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform bg-blue-50 text-blue-700">
              <MapPin className="w-4 h-4" />Карта
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-transform ${expanded ? 'bg-brand/10 text-brand' : 'bg-gray-50 text-gray-600'}`}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            {expanded ? 'Згорнути' : 'Деталі'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <Cell label="ПІБ" value={item.name} full />
            {item.number && <Cell label="№ посилки" value={item.number} />}
            <Cell label="Місто/НП" value={item.city} />
            {item.weight && <Cell label="Вага" value={item.weight} />}
            {item.amount && <Cell label="Сума" value={item.amount} />}
            {item.payType && <Cell label="Оплата" value={item.payType} />}
            {item.currency && <Cell label="Валюта" value={item.currency} />}
            {item.envelope && <Cell label="Конверт" value={item.envelope} />}
            {item.phone && <Cell label="Телефон" value={item.phone} />}
          </div>
          {item.description && (
            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-blue-50 text-[11px] text-text">
              <span className="text-blue-600 font-bold">Опис: </span>{item.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  if (!value) return null;
  return (
    <div className={`py-1 min-w-0 ${full ? 'col-span-2' : ''}`}>
      <div className="text-[9px] text-muted font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-[11px] font-medium text-text truncate">{value}</div>
    </div>
  );
}
