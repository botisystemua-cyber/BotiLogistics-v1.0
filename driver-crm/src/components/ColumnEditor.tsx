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
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dark-card border-t border-dark-border-glow rounded-t-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-[0_-10px_40px_rgba(57,255,20,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-dark-card px-5 pt-5 pb-3 flex items-center justify-between border-b border-dark-border">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-neon-green" />
            <h2 className="text-base font-bold text-white">Налаштування колонок</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 cursor-pointer">
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        <div className="p-3">
          {ALL_COLUMNS.map((col) => {
            const isOn = !hiddenCols.has(col.key);
            return (
              <div
                key={col.key}
                className="flex items-center justify-between px-3 py-3 border-b border-dark-border/50 last:border-0"
              >
                <span className="text-sm font-semibold text-white/80">{col.label}</span>
                <button
                  onClick={() => toggleCol(col.key)}
                  className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${
                    isOn ? 'bg-neon-green' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      isOn ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-5 pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 bg-neon-green text-dark-bg font-bold rounded-xl text-sm cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
