import { Settings, X } from 'lucide-react';
import { useApp } from '../store/useAppStore';

const ALL_COLUMNS = [
  { key: 'id', label: '# Номер' },
  { key: 'vo', label: 'ВО' },
  { key: 'name', label: 'ПІБ' },
  { key: 'address', label: 'Адреса' },
  { key: 'ttn', label: 'ТТН' },
  { key: 'weight', label: 'Вага' },
  { key: 'direction', label: 'Напрямок' },
  { key: 'phone', label: 'Телефон' },
  { key: 'registrarPhone', label: 'Тел. Реєстратора' },
  { key: 'price', label: 'Сума' },
  { key: 'payment', label: 'Оплата' },
  { key: 'payStatus', label: 'Статус оплати' },
  { key: 'timing', label: 'Таймінг' },
  { key: 'status', label: 'Статус посилки' },
  { key: 'note', label: 'Примітка' },
  { key: 'smsNote', label: 'SMS Примітка' },
  { key: 'createdAt', label: 'Дата оформлення' },
  { key: 'receiveDate', label: 'Дата отримання' },
  { key: 'photo', label: 'Фото' },
];

interface Props {
  onClose: () => void;
}

export function ColumnEditor({ onClose }: Props) {
  const { hiddenCols, toggleCol } = useApp();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-card rounded-t-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card px-6 pt-6 pb-4 flex items-center justify-between border-b border-border">
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

        <div className="px-4 py-2">
          {ALL_COLUMNS.map((col) => {
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

        <div className="p-6 pt-3">
          <button onClick={onClose}
            className="w-full py-4 bg-brand text-white font-bold rounded-2xl text-base cursor-pointer shadow-lg shadow-brand/20">
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
