import { Bus } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function OrdersScreen() {
  return (
    <div className="animate-fade-in">
      <div className="bg-navy px-4 pt-6 pb-5 rounded-b-3xl md:rounded-none md:px-10 md:pt-8 md:pb-6">
        <div>
        <h1 className="text-xl md:text-2xl font-bold text-white mb-4">Мої замовлення</h1>
        <div className="flex gap-2 md:max-w-xs">
          <button
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-white text-navy"
          >
            Поїздки
          </button>
          <button
            disabled
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-white/5 text-blue-200/30 cursor-not-allowed line-through"
          >
            Посилки
          </button>
        </div>
        </div>
      </div>

      <div className="px-4 -mt-3 pb-4 space-y-3 md:px-10 md:mt-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5 md:space-y-0">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bus size={18} className="text-accent" />
              <span className="font-bold text-navy text-sm">Цюріх</span>
            </div>
            <span className="text-xs text-gray-400">15.06.2025</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">Місце A2 · 1 місце</p>
          <StatusBadge status="confirmed" />
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bus size={18} className="text-navy" />
              <span className="font-bold text-navy text-sm">Женева</span>
            </div>
            <span className="text-xs text-gray-400">01.05.2025</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">Місце B1 · 2 місця</p>
          <StatusBadge status="done" />
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bus size={18} className="text-navy" />
              <span className="font-bold text-navy text-sm">Берлін</span>
            </div>
            <span className="text-xs text-gray-400">12.03.2025</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">Місце C3 · 1 місце</p>
          <StatusBadge status="done" />
        </div>
      </div>
    </div>
  );
}
