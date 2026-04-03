import { ArrowLeft, Phone, MessageCircle, Mail } from 'lucide-react';
import { tariffsCities } from '../data/mock';
import type { Screen } from '../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export default function TariffsScreen({ onNavigate }: Props) {
  return (
    <div className="animate-fade-in">
      <div className="bg-navy px-4 pt-6 pb-5 rounded-b-3xl md:rounded-none md:px-10 md:pt-8 md:pb-6">
        <button onClick={() => onNavigate('home')} className="text-blue-200/60 flex items-center gap-1 mb-3 text-sm">
          <ArrowLeft size={16} /> Назад
        </button>
        <h1 className="text-xl font-bold text-white">Тарифи та ціни</h1>
      </div>

      <div className="px-4 -mt-3 pb-6 space-y-4 md:px-10 md:mt-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        {/* Passengers */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-base font-bold text-navy mb-3">Пасажири</h2>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Місто</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Ціна</th>
                </tr>
              </thead>
              <tbody>
                {tariffsCities.map((row, i) => (
                  <tr key={row.city} className={i % 2 ? 'bg-gray-50/50' : ''}>
                    <td className="px-3 py-2.5 text-gray-700">{row.city}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-navy">від {row.price}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">* Ціни уточнюйте у менеджера</p>
        </div>

        {/* Parcels UA→EU */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-base font-bold text-navy mb-2">Посилки Україна → Європа</h2>
          <div className="space-y-1.5 text-sm text-gray-600">
            <p>Ціна за кг — <span className="font-semibold text-navy">від 5€</span></p>
            <p>Мінімальна вага — <span className="font-semibold text-navy">1 кг</span></p>
            <p className="text-xs text-gray-400">Умови: уточнюйте у менеджера</p>
          </div>
        </div>

        {/* Parcels EU→UA */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-base font-bold text-navy mb-2">Посилки Європа → Україна</h2>
          <div className="space-y-1.5 text-sm text-gray-600">
            <p>Виклик кур'єра — <span className="font-semibold text-navy">від 10€</span></p>
            <p className="text-xs text-gray-400">Умови доставки: уточнюйте у менеджера</p>
          </div>
        </div>

        {/* Contacts */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-base font-bold text-navy mb-3">Контакти</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                <Phone size={16} className="text-status-confirmed" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Телефон</p>
                <p className="text-sm font-semibold text-navy">+380 67 123 4567</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <MessageCircle size={16} className="text-status-done" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Telegram</p>
                <p className="text-sm font-semibold text-navy">@escoexpress</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
                <Mail size={16} className="text-accent" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Email</p>
                <p className="text-sm font-semibold text-navy">info@escoexpress.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
