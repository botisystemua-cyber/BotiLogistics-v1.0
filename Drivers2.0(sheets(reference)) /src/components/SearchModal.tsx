import { useState, useMemo } from 'react';
import { X, Search, Phone, MapPin, Package } from 'lucide-react';
import type { Passenger, Package as Pkg } from '../types';

interface Props {
  passengers: Passenger[];
  packages: Pkg[];
  onClose: () => void;
}

export function SearchModal({ passengers, packages, onClose }: Props) {
  const [query, setQuery] = useState('');
  const q = query.toLowerCase().trim();

  const results = useMemo(() => {
    if (!q) return { pax: [] as Passenger[], pkg: [] as Pkg[] };
    const pax = passengers.filter((p) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.phone || '').includes(q) ||
      (p.addrFrom || '').toLowerCase().includes(q) ||
      (p.addrTo || '').toLowerCase().includes(q) ||
      (p.itemId || '').toLowerCase().includes(q)
    );
    const pkg = packages.filter((p) =>
      (p.recipientName || '').toLowerCase().includes(q) ||
      (p.recipientPhone || '').includes(q) ||
      (p.senderName || '').toLowerCase().includes(q) ||
      (p.recipientAddr || '').toLowerCase().includes(q) ||
      (p.ttn || '').includes(q) ||
      (p.itemId || '').toLowerCase().includes(q)
    );
    return { pax, pkg };
  }, [q, passengers, packages]);

  const total = results.pax.length + results.pkg.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-4" onClick={onClose}>
      <div className="w-full max-w-lg mx-3 bg-white rounded-2xl shadow-2xl max-h-[80dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Search input */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <Search className="w-5 h-5 text-muted shrink-0" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Ім'я, телефон, адреса, ТТН..."
            className="flex-1 text-sm text-text placeholder:text-gray-300 focus:outline-none bg-transparent" />
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto border-t border-gray-100 px-3 py-2 space-y-1">
          {!q ? (
            <p className="text-center text-muted text-xs py-8">Введіть запит для пошуку</p>
          ) : total === 0 ? (
            <p className="text-center text-muted text-xs py-8">Нічого не знайдено</p>
          ) : (
            <>
              {results.pax.map((p, i) => (
                <div key={`pax_${i}`} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-text truncate">{p.name || '—'}</div>
                    <div className="text-[10px] text-muted truncate">{p.phone} · {p.addrFrom} → {p.addrTo}</div>
                  </div>
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="p-1.5 rounded-lg bg-green-50 text-green-600">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
              {results.pkg.map((p, i) => (
                <div key={`pkg_${i}`} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50">
                  <span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                    <Package className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-text truncate">{p.recipientName || '—'}</div>
                    <div className="text-[10px] text-muted truncate">{p.recipientPhone} · {p.recipientAddr}</div>
                  </div>
                  {p.recipientPhone && (
                    <a href={`tel:${p.recipientPhone}`} className="p-1.5 rounded-lg bg-green-50 text-green-600">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {q && total > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 text-center text-[10px] text-muted font-semibold">
            Знайдено: {results.pax.length} пасажирів, {results.pkg.length} посилок
          </div>
        )}
      </div>
    </div>
  );
}
