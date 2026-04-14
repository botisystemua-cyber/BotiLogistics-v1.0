import { X, Car, MapPin } from 'lucide-react';

interface Props {
  addrFrom?: string;
  addrTo?: string;
  onClose: () => void;
}

function nav(addr: string) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`, '_blank');
}

export function AddressPicker({ addrFrom, addrTo, onClose }: Props) {
  const go = (a: string) => { nav(a); onClose(); };
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-sm text-text">🗺 Куди прокласти маршрут?</span>
          <button onClick={onClose} className="text-gray-500 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {addrFrom && (
          <button onClick={() => go(addrFrom)} className="block w-full py-3 my-1.5 px-3 rounded-xl bg-blue-50 text-blue-700 font-semibold text-left text-[13px] cursor-pointer active:scale-[0.98]">
            <Car className="w-4 h-4 inline mr-2 -mt-0.5" />Адреса відправки
            <div className="text-[11px] font-normal text-blue-600/80 truncate mt-0.5">{addrFrom}</div>
          </button>
        )}
        {addrTo && (
          <button onClick={() => go(addrTo)} className="block w-full py-3 my-1.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 font-semibold text-left text-[13px] cursor-pointer active:scale-[0.98]">
            <MapPin className="w-4 h-4 inline mr-2 -mt-0.5" />Адреса прибуття
            <div className="text-[11px] font-normal text-emerald-600/80 truncate mt-0.5">{addrTo}</div>
          </button>
        )}
        {!addrFrom && !addrTo && <div className="text-center text-sm text-gray-500 py-2">Немає адрес</div>}
      </div>
    </div>
  );
}
