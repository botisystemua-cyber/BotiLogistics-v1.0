import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { addDeliveryToRoute } from '../api';

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export function AddLeadModal({ onClose, onAdded }: Props) {
  const { currentSheet, showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.phone && !form.address) { showToast('Введіть телефон або адресу'); return; }
    setLoading(true);
    try {
      const result = await addDeliveryToRoute(currentSheet, form);
      if (result.success) { showToast('Додано!'); onClose(); onAdded(); }
      else { showToast(result.error || 'Помилка'); }
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-card rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-card px-6 pt-6 pb-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center">
              <Plus className="w-6 h-6 text-brand" />
            </div>
            <h2 className="text-lg font-bold text-text">
              Додати посилку
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg cursor-pointer">
            <X className="w-6 h-6 text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <Field label="Телефон" type="tel" placeholder="+380..." value={form.phone} onChange={(v) => set('phone', v)} />
          <Field label="Адреса" placeholder="Адреса доставки" value={form.address} onChange={(v) => set('address', v)} />
          <Field label="ПІБ" placeholder="Ім'я отримувача" value={form.name} onChange={(v) => set('name', v)} />
          <Field label="ТТН" placeholder="Номер ТТН" value={form.ttn} onChange={(v) => set('ttn', v)} />
          <Field label="Вага (кг)" placeholder="0" value={form.weight} onChange={(v) => set('weight', v)} />
          <Field label="Сума (€)" placeholder="0" value={form.amount} onChange={(v) => set('amount', v)} />
          <Field label="Примітка" placeholder="" value={form.note} onChange={(v) => set('note', v)} />

          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-4.5 bg-brand text-white font-bold rounded-2xl text-base hover:bg-brand-dark transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-brand/20">
            <Plus className="w-5 h-5" />
            {loading ? 'Збереження...' : 'Додати'}
          </button>
          <button onClick={onClose}
            className="w-full py-3.5 bg-bg text-text-secondary font-bold rounded-2xl text-base cursor-pointer hover:bg-border/50 transition-all">
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', placeholder, value, onChange }: {
  label: string; type?: string; placeholder?: string; value?: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-text mb-2">{label}</label>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-5 py-4 bg-bg border-2 border-border rounded-2xl text-text text-base placeholder-text-secondary/40 focus:outline-none focus:border-brand transition-colors" />
    </div>
  );
}
