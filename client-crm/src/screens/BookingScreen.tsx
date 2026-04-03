import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Modal from '../components/Modal';
import type { Flight, Screen } from '../types';

interface Props {
  flight: Flight;
  onNavigate: (screen: Screen) => void;
}

export default function BookingScreen({ flight, onNavigate }: Props) {
  const [form, setForm] = useState({ name: '', phone: '', from: '', to: '', seats: 1, note: '' });
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const update = (k: string, v: string | number) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: false }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, boolean> = {};
    if (!form.name) errs.name = true;
    if (!form.phone) errs.phone = true;
    if (!form.from) errs.from = true;
    if (!form.to) errs.to = true;
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setShowModal(true);
  };

  const inputCls = (field: string) =>
    `w-full px-4 py-3 bg-gray-50 border ${errors[field] ? 'border-red-400' : 'border-gray-200'} rounded-xl text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition`;

  return (
    <div className="animate-fade-in">
      <div className="bg-navy px-4 pt-6 pb-5 rounded-b-3xl md:rounded-none md:px-10 md:pt-8 md:pb-6">
        <button onClick={() => onNavigate('flights')} className="text-blue-200/60 flex items-center gap-1 mb-3 text-sm">
          <ArrowLeft size={16} /> Назад
        </button>
        <h1 className="text-lg font-bold text-white">
          {flight.from_city} → {flight.to_city}
        </h1>
        <p className="text-blue-200/60 text-xs mt-1">{flight.date} · Вільних: {flight.free_seats}</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 -mt-3 pb-6 space-y-3 md:max-w-2xl md:mx-auto md:mt-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <input placeholder="ПІБ пасажира *" value={form.name} onChange={e => update('name', e.target.value)} className={inputCls('name')} />
          <input placeholder="Телефон *" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputCls('phone')} />
          <input placeholder="Адреса відправки (Україна) *" value={form.from} onChange={e => update('from', e.target.value)} className={inputCls('from')} />
          <input placeholder="Адреса прибуття (Швейцарія) *" value={form.to} onChange={e => update('to', e.target.value)} className={inputCls('to')} />

          <div>
            <p className="text-xs text-gray-500 mb-2">Кількість місць</p>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update('seats', n)}
                  className={`w-12 h-10 rounded-xl font-bold text-sm transition ${
                    form.seats === n ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <textarea
            placeholder="Примітка"
            value={form.note}
            onChange={e => update('note', e.target.value)}
            rows={2}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full py-3.5 bg-accent text-white font-bold rounded-xl active:scale-[0.97] transition-transform shadow-lg shadow-accent/30"
        >
          Забронювати
        </button>
      </form>

      {showModal && (
        <Modal
          title="Заявку прийнято!"
          subtitle="Менеджер зв'яжеться з вами найближчим часом"
          onClose={() => {
            setShowModal(false);
            onNavigate('flights');
          }}
        />
      )}
    </div>
  );
}
