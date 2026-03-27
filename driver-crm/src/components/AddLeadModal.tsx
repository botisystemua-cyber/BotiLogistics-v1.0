import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { addDeliveryToRoute, addPassengerToRoute } from '../api';

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export function AddLeadModal({ onClose, onAdded }: Props) {
  const { currentRouteType, currentSheet, showToast } = useApp();
  const isDelivery = currentRouteType === 'delivery';
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (isDelivery) {
      if (!form.phone && !form.address) {
        showToast('Введіть телефон або адресу');
        return;
      }
    } else {
      if (!form.name && !form.phone) {
        showToast("Введіть ім'я або телефон");
        return;
      }
    }

    setLoading(true);
    try {
      let result;
      if (isDelivery) {
        result = await addDeliveryToRoute(currentSheet, form);
      } else {
        result = await addPassengerToRoute(currentSheet, {
          ...form,
          seats: form.seats || '1',
        });
      }
      if (result.success) {
        showToast('Додано!');
        onClose();
        onAdded();
      } else {
        showToast(result.error || 'Помилка');
      }
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dark-card border-t border-dark-border-glow rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[0_-10px_40px_rgba(57,255,20,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-card px-5 pt-5 pb-3 flex items-center justify-between border-b border-dark-border">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-neon-green" />
            <h2 className="text-base font-bold text-white">
              Додати {isDelivery ? 'посилку' : 'пасажира'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 cursor-pointer">
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isDelivery ? (
            <>
              <Field label="Телефон" type="tel" placeholder="+380..." value={form.phone} onChange={(v) => set('phone', v)} />
              <Field label="Адреса" placeholder="Адреса доставки" value={form.address} onChange={(v) => set('address', v)} />
              <Field label="ПІБ" placeholder="Ім'я отримувача" value={form.name} onChange={(v) => set('name', v)} />
              <Field label="ТТН" placeholder="Номер ТТН" value={form.ttn} onChange={(v) => set('ttn', v)} />
              <Field label="Вага (кг)" placeholder="0" value={form.weight} onChange={(v) => set('weight', v)} />
              <Field label="Сума (€)" placeholder="0" value={form.amount} onChange={(v) => set('amount', v)} />
              <Field label="Примітка" placeholder="" value={form.note} onChange={(v) => set('note', v)} />
            </>
          ) : (
            <>
              <Field label="Ім'я" placeholder="Ім'я пасажира" value={form.name} onChange={(v) => set('name', v)} />
              <Field label="Телефон" type="tel" placeholder="+380..." value={form.phone} onChange={(v) => set('phone', v)} />
              <Field label="Звідки" placeholder="Місто відправки" value={form.from} onChange={(v) => set('from', v)} />
              <Field label="Куди" placeholder="Місто прибуття" value={form.to} onChange={(v) => set('to', v)} />
              <Field label="Дата" type="date" value={form.date} onChange={(v) => set('date', v)} />
              <Field label="Місць" type="number" placeholder="1" value={form.seats} onChange={(v) => set('seats', v)} />
              <Field label="Примітка" placeholder="" value={form.note} onChange={(v) => set('note', v)} />
            </>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-neon-green text-dark-bg font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {loading ? 'Збереження...' : 'Додати'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-dark-surface text-white/60 font-semibold rounded-xl text-sm hover:bg-white/5 transition-all cursor-pointer"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-neon-green/60 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-neon-green/40 transition-all"
      />
    </div>
  );
}
