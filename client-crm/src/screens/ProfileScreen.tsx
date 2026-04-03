import { ArrowLeft, LogOut, CreditCard } from 'lucide-react';
import type { Screen } from '../types';

interface Props {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  phone: string | null;
  userName: string | null;
}

export default function ProfileScreen({ onNavigate, onLogout, phone, userName }: Props) {
  return (
    <div className="animate-fade-in">
      <div className="bg-navy px-4 pt-6 pb-8 rounded-b-3xl md:rounded-none md:px-10 md:pt-8 md:pb-8">
        <button onClick={() => onNavigate('home')} className="text-blue-200/60 flex items-center gap-1 mb-4 text-sm">
          <ArrowLeft size={16} /> Назад
        </button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-accent/30">
            {userName ? userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '👤'}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{userName ?? 'Клієнт'}</h1>
            <p className="text-blue-200/60 text-sm">{phone ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 pb-6 space-y-3 md:max-w-2xl md:mx-auto md:mt-6">
        {/* Debts */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <CreditCard size={20} className="text-status-confirmed" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Мої борги</p>
              <p className="text-sm font-bold text-status-confirmed">Немає заборгованості</p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <LogOut size={20} className="text-status-cancelled" />
          </div>
          <span className="text-sm font-semibold text-status-cancelled">Вийти з акаунту</span>
        </button>
      </div>
    </div>
  );
}
