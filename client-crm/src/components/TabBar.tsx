import { Home, Bus, Package, ClipboardList, MessageCircle, Truck } from 'lucide-react';
import type { Tab } from '../types';

interface TabBarProps {
  active: Tab;
  onTab: (tab: Tab) => void;
  chatBadge: number;
}

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Головна', icon: Home },
  { id: 'flights', label: 'Поїздки', icon: Bus },
  { id: 'parcels', label: 'Посилки', icon: Package },
  { id: 'orders', label: 'Замовлення', icon: ClipboardList },
  { id: 'chat', label: 'Чат', icon: MessageCircle },
];

const disabledTabs: Tab[] = ['parcels'];

export default function TabBar({ active, onTab, chatBadge }: TabBarProps) {
  return (
    <>
      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
        <div className="max-w-[480px] mx-auto flex justify-around items-center h-16">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            const isDisabled = disabledTabs.includes(id);
            return (
              <button
                key={id}
                onClick={() => !isDisabled && onTab(id)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors relative ${
                  isDisabled ? 'text-gray-300 cursor-not-allowed' : isActive ? 'text-accent' : 'text-gray-400'
                }`}
              >
                <Icon size={22} strokeWidth={isActive && !isDisabled ? 2.5 : 1.8} />
                <span className={`text-[10px] font-medium ${isDisabled ? 'line-through' : ''}`}>{label}</span>
                {id === 'chat' && chatBadge > 0 && (
                  <span className="absolute top-0.5 right-1/2 translate-x-4 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {chatBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-56 bg-navy flex-col z-40 shadow-xl">
        <div className="flex items-center gap-3 px-5 pt-6 pb-8">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <Truck size={22} className="text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight"><span className="text-white">BOTI</span><span className="text-emerald-400">LOGISTICS</span></span>
        </div>
        <div className="flex flex-col gap-1 px-3 flex-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            const isDisabled = disabledTabs.includes(id);
            return (
              <button
                key={id}
                onClick={() => !isDisabled && onTab(id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors relative ${
                  isDisabled
                    ? 'text-blue-200/30 cursor-not-allowed'
                    : isActive
                      ? 'bg-accent text-white'
                      : 'text-blue-200/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={20} strokeWidth={isActive && !isDisabled ? 2.5 : 1.8} />
                <span className={`text-sm font-semibold ${isDisabled ? 'line-through' : ''}`}>{label}</span>
                {id === 'chat' && chatBadge > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {chatBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
