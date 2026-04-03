import { Bus, Package, User, MessageCircle, Tag, Wrench } from 'lucide-react';
import type { Screen } from '../types';

interface Props {
  onNavigate: (screen: Screen) => void;
  userName: string | null;
}

export default function HomeScreen({ onNavigate, userName }: Props) {
  const displayName = userName ? userName.split(' ')[0] : 'Клієнт';

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="bg-navy px-5 pt-8 pb-6 rounded-b-3xl md:rounded-none md:px-10 md:pt-10 md:pb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm md:text-base font-bold tracking-wide mb-1"><span className="text-white">BOTI</span><span className="text-emerald-400">LOGISTICS</span></p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Привіт, {displayName}! 👋</h1>
          </div>
          <button
            onClick={() => onNavigate('profile')}
            className="w-12 h-12 bg-white/15 rounded-full flex items-center justify-center border border-white/10"
          >
            <User size={24} className="text-white" />
          </button>
        </div>
      </div>

      {/* 4 Action Cards */}
      <div className="px-4 mt-5 space-y-4 pb-4 md:px-10 md:mt-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          <button
            onClick={() => onNavigate('flights')}
            className="bg-white border-2 border-navy/80 rounded-2xl p-7 text-left active:scale-[0.97] transition-transform flex flex-col justify-between min-h-[260px] md:min-h-[220px] md:p-6 md:hover:shadow-lg md:hover:border-accent md:transition-all"
          >
            <div className="w-16 h-16 md:w-16 md:h-16 bg-accent/10 rounded-2xl flex items-center justify-center">
              <Bus size={34} className="text-accent md:hidden" />
              <Bus size={34} className="text-accent hidden md:block" />
            </div>
            <div className="mt-auto pt-5 md:pt-4">
              <p className="text-navy font-extrabold text-lg md:text-lg leading-tight">Забронювати поїздку</p>
              <p className="text-gray-400 text-sm md:text-sm mt-2 md:mt-1">Пасажирські рейси</p>
            </div>
          </button>

          <div
            className="bg-gray-100 border-2 border-gray-200 rounded-2xl p-7 text-left flex flex-col justify-between min-h-[260px] md:min-h-[220px] md:p-6 relative overflow-hidden opacity-60 cursor-not-allowed"
          >
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-gray-200 text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              <Wrench size={10} />
              В розробці
            </div>
            <div className="w-16 h-16 md:w-16 md:h-16 bg-gray-200 rounded-2xl flex items-center justify-center">
              <Package size={34} className="text-gray-400" />
            </div>
            <div className="mt-auto pt-5 md:pt-4">
              <p className="text-gray-400 font-extrabold text-lg md:text-lg leading-tight line-through">Відправити посилку</p>
              <p className="text-gray-300 text-sm md:text-sm mt-2 md:mt-1 line-through">Україна ⇄ Європа</p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('chat')}
            className="bg-white border-2 border-navy/80 rounded-2xl px-4 py-4 active:scale-[0.97] transition-transform flex items-center gap-3 min-h-[90px] md:flex-col md:items-start md:p-6 md:min-h-[220px] md:justify-between md:hover:shadow-lg md:hover:border-accent md:transition-all"
          >
            <div className="w-11 h-11 md:w-16 md:h-16 bg-accent/10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
              <MessageCircle size={22} className="text-accent md:hidden" />
              <MessageCircle size={34} className="text-accent hidden md:block" />
            </div>
            <div className="text-left min-w-0 md:mt-auto md:pt-4">
              <p className="text-navy font-bold text-xs sm:text-sm md:font-extrabold md:text-lg leading-tight">Чат з менеджером</p>
              <div className="flex items-center gap-1 mt-1 md:mt-1.5">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-status-confirmed rounded-full" />
                <span className="text-[10px] sm:text-xs md:text-sm text-gray-400">Онлайн</span>
              </div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('tariffs')}
            className="bg-white border-2 border-navy/80 rounded-2xl px-4 py-4 active:scale-[0.97] transition-transform flex items-center gap-3 min-h-[90px] md:flex-col md:items-start md:p-6 md:min-h-[220px] md:justify-between md:hover:shadow-lg md:hover:border-accent md:transition-all"
          >
            <div className="w-11 h-11 md:w-16 md:h-16 bg-accent/10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
              <Tag size={22} className="text-accent md:hidden" />
              <Tag size={34} className="text-accent hidden md:block" />
            </div>
            <div className="text-left min-w-0 md:mt-auto md:pt-4">
              <p className="text-navy font-bold text-xs sm:text-sm md:font-extrabold md:text-lg leading-tight">Тарифи та ціни</p>
              <p className="text-gray-400 text-[10px] sm:text-xs md:text-sm mt-1 md:mt-1.5">від 5€/кг</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
