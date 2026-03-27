import { ArrowRight, Repeat, X } from 'lucide-react';
import type { Passenger, PassengerRoute } from '../types';

interface Props {
  passenger: Passenger;
  routes: PassengerRoute[];
  onTransfer: (targetRoute: string) => void;
  onClose: () => void;
}

export function TransferModal({ passenger, routes, onTransfer, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-5"
      onClick={onClose}
    >
      <div
        className="bg-dark-card border border-dark-border-glow rounded-2xl w-full max-w-sm overflow-hidden shadow-[0_0_40px_rgba(57,255,20,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-dark-surface px-5 py-4 border-b border-neon-green/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-orange-400" />
            <h2 className="text-base font-bold text-white">Перенести пасажира</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 cursor-pointer">
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        {/* Passenger info */}
        <div className="px-5 pt-4">
          <div className="bg-dark-surface rounded-xl p-3 text-xs">
            <div className="font-bold text-white">{passenger.name}</div>
            <div className="text-white/50 mt-1">{passenger.phone}</div>
            <div className="text-white/40 mt-1 flex items-center gap-1">
              {passenger.from} <ArrowRight className="w-3 h-3" /> {passenger.to}
            </div>
            <div className="text-white/30 mt-1">Зараз: {passenger._sourceRoute}</div>
          </div>
        </div>

        {/* Route options */}
        <div className="px-5 py-4 space-y-2 max-h-[40vh] overflow-y-auto">
          {routes.map((route) => {
            const isCurrent = route.name === passenger._sourceRoute;
            return (
              <button
                key={route.name}
                onClick={() => !isCurrent && onTransfer(route.name)}
                disabled={isCurrent}
                className={`w-full flex items-center justify-between p-3 border rounded-xl transition-all text-left ${
                  isCurrent
                    ? 'border-dark-border opacity-40 cursor-not-allowed'
                    : 'border-dark-border hover:border-neon-green/30 cursor-pointer hover:bg-neon-green/5'
                }`}
              >
                <div className="font-semibold text-white text-sm">
                  {route.name} {isCurrent && '(поточний)'}
                </div>
                <span className="text-xs text-white/40">{route.count} пас.</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-3 bg-dark-surface text-white/60 font-semibold rounded-xl text-sm hover:bg-white/5 transition-all cursor-pointer"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}
