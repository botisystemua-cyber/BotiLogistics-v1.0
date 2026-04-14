import { Settings, X } from 'lucide-react';
import { useApp } from '../store/useAppStore';

const PASSENGER_COLUMNS = [
  { key: 'name', label: 'ПІБ' },
  { key: 'phone', label: 'Телефон' },
  { key: 'addrFrom', label: 'Звідки' },
  { key: 'addrTo', label: 'Куди' },
  { key: 'dateTrip', label: 'Дата рейсу' },
  { key: 'timing', label: 'Таймінг' },
  { key: 'seatsCount', label: 'Місця' },
  { key: 'amount', label: 'Сума' },
  { key: 'payStatus', label: 'Статус оплати' },
  { key: 'city', label: 'Місто' },
  { key: 'direction', label: 'Напрям' },
];

const PACKAGE_COLUMNS = [
  { key: 'recipientAddr', label: 'Адреса отримувача' },
  { key: 'recipientName', label: 'Отримувач' },
  { key: 'recipientPhone', label: 'Тел. отримувача' },
  { key: 'senderName', label: 'Відправник' },
  { key: 'ttn', label: 'ТТН' },
  { key: 'pkgWeight', label: 'Вага' },
  { key: 'amount', label: 'Сума' },
  { key: 'payStatus', label: 'Статус оплати' },
  { key: 'dateTrip', label: 'Дата рейсу' },
  { key: 'city', label: 'Місто' },
  { key: 'direction', label: 'Напрям' },
];

const SHIPPING_COLUMNS = [
  { key: 'recipientAddr', label: 'Адреса отримувача' },
  { key: 'recipientName', label: 'Отримувач' },
  { key: 'recipientPhone', label: 'Тел. отримувача' },
  { key: 'senderName', label: 'Відправник' },
  { key: 'senderPhone', label: 'Тел. відправника' },
  { key: 'internalNum', label: 'Внутрішній №' },
  { key: 'weight', label: 'Вага' },
  { key: 'description', label: 'Опис' },
  { key: 'amount', label: 'Сума' },
  { key: 'payForm', label: 'Форма оплати' },
  { key: 'payStatus', label: 'Статус оплати' },
  { key: 'debt', label: 'Борг' },
  { key: 'dateTrip', label: 'Дата рейсу' },
];

interface Props { onClose: () => void; }

// Combined columns for "all" tab (unique by key, preserving order)
const ALL_COLUMNS = (() => {
  const seen = new Set<string>();
  const result: { key: string; label: string }[] = [];
  for (const col of [...PASSENGER_COLUMNS, ...PACKAGE_COLUMNS, ...SHIPPING_COLUMNS]) {
    if (!seen.has(col.key)) { seen.add(col.key); result.push(col); }
  }
  return result;
})();

// Combined package+shipping columns for "allPackages" tab
const ALL_PACKAGE_COLUMNS = (() => {
  const seen = new Set<string>();
  const result: { key: string; label: string }[] = [];
  for (const col of [...PACKAGE_COLUMNS, ...SHIPPING_COLUMNS]) {
    if (!seen.has(col.key)) { seen.add(col.key); result.push(col); }
  }
  return result;
})();

export function ColumnEditor({ onClose }: Props) {
  const { hiddenCols, toggleCol, viewTab } = useApp();
  const columns = viewTab === 'shipping' ? SHIPPING_COLUMNS
    : viewTab === 'packages' ? PACKAGE_COLUMNS
    : viewTab === 'allPackages' ? ALL_PACKAGE_COLUMNS
    : viewTab === 'all' ? ALL_COLUMNS
    : PASSENGER_COLUMNS;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-card rounded-t-3xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center">
              <Settings className="w-6 h-6 text-brand" />
            </div>
            <h2 className="text-lg font-bold text-text">Колонки</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg cursor-pointer">
            <X className="w-6 h-6 text-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {columns.map((col) => {
            const isOn = !hiddenCols.has(col.key);
            return (
              <div key={col.key} className="flex items-center justify-between px-4 py-4 border-b border-border/50 last:border-0">
                <span className="text-base font-semibold text-text">{col.label}</span>
                <button onClick={() => toggleCol(col.key)}
                  className={`w-14 h-8 rounded-full relative transition-colors cursor-pointer ${isOn ? 'bg-brand' : 'bg-gray-300'}`}>
                  <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${isOn ? 'left-[26px]' : 'left-1'}`} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-6 pt-3 border-t border-border shrink-0">
          <button onClick={onClose}
            className="w-full py-4 bg-brand text-white font-bold rounded-2xl text-base cursor-pointer shadow-lg shadow-brand/20">
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
