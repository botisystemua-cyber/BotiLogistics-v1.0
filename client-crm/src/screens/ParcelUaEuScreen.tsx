import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Modal from '../components/Modal';
import { contentTypes } from '../data/mock';
import type { Screen } from '../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export default function ParcelUaEuScreen({ onNavigate }: Props) {
  const [form, setForm] = useState({ ttn: '', name: '', phone: '', address: '', value: '', content: 'Одяг', note: '' });
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const update = (k: string, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: false }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, boolean> = {};
    if (!form.ttn) errs.ttn = true;
    if (!form.name) errs.name = true;
    if (!form.phone) errs.phone = true;
    if (!form.address) errs.address = true;
    if (!form.value) errs.value = true;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setShowModal(true);
  };

  const inputCls = (field: string) =>
    `w-full px-4 py-3 bg-gray-50 border ${errors[field] ? 'border-red-400' : 'border-gray-200'} rounded-xl text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition`;

  return (
    <div className="animate-fade-in">
      <div className="bg-navy px-4 pt-6 pb-5 rounded-b-3xl md:rounded-none md:px-10 md:pt-8 md:pb-6">
        <button onClick={() => onNavigate('parcels')} className="text-blue-200/60 flex items-center gap-1 mb-3 text-sm">
          <ArrowLeft size={16} /> Назад
        </button>
        <h1 className="text-lg font-bold text-white">Посилка Україна → Європа</h1>
        <p className="text-blue-200/60 text-xs mt-1">Реєстрація ТТН Нової Пошти</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 -mt-3 pb-6 space-y-3 md:max-w-2xl md:mx-auto md:mt-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <input placeholder="Номер ТТН Нової Пошти *" value={form.ttn} onChange={e => update('ttn', e.target.value)} className={inputCls('ttn')} />
          <input placeholder="ПІБ отримувача *" value={form.name} onChange={e => update('name', e.target.value)} className={inputCls('name')} />
          <input placeholder="Телефон отримувача *" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputCls('phone')} />
          <input placeholder="Адреса в Європі *" value={form.address} onChange={e => update('address', e.target.value)} className={inputCls('address')} />
          <input placeholder="Оціночна вартість (EUR) *" type="number" value={form.value} onChange={e => update('value', e.target.value)} className={inputCls('value')} />
          <select value={form.content} onChange={e => update('content', e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent transition">
            {contentTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea placeholder="Примітка" value={form.note} onChange={e => update('note', e.target.value)} rows={2} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent transition resize-none" />
        </div>
        <button type="submit" className="w-full py-3.5 bg-accent text-white font-bold rounded-xl active:scale-[0.97] transition-transform shadow-lg shadow-accent/30">
          Відправити заявку
        </button>
      </form>

      {showModal && (
        <Modal title="Заявку прийнято!" subtitle="PKG-2025-0042" onClose={() => { setShowModal(false); onNavigate('parcels'); }} />
      )}
    </div>
  );
}
