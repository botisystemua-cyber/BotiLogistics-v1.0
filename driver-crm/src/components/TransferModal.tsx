import { ArrowRight, Repeat, X } from 'lucide-react';
import type { Passenger, Route } from '../types';

interface Props {
  passenger: Passenger;
  routes: Route[];
  onTransfer: (targetRoute: string) => void;
  onClose: () => void;
}

export function TransferModal({ passenger, routes, onTransfer, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-card rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Repeat className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-text">Перенести</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg cursor-pointer">
            <X className="w-6 h-6 text-text-secondary" />
          </button>
        </div>

        {/* Passenger info */}
        <div className="px-6">
          <div className="bg-bg rounded-2xl p-4">
            <div className="font-bold text-text text-base">{passenger.name}</div>
            <div className="text-sm text-text-secondary mt-1">{passenger.phone}</div>
            <div className="text-sm text-text-secondary mt-1 flex items-center gap-1">
              {passenger.from} <ArrowRight className="w-4 h-4" /> {passenger.to}
            </div>
            <div className="text-xs text-text-secondary/60 mt-1">Зараз: {passenger._sourceRoute}</div>
          </div>
        </div>

        {/* Route options */}
        <div className="px-6 py-5 space-y-3 max-h-[40vh] overflow-y-auto">
          {routes.map((route) => {
            const isCurrent = route.name === passenger._sourceRoute;
            return (
              <button key={route.name} onClick={() => !isCurrent && onTransfer(route.name)} disabled={isCurrent}
                className={`w-full flex items-center justify-between p-4 border-2 rounded-2xl transition-all text-left ${
                  isCurrent ? 'border-border opacity-40 cursor-not-allowed' : 'border-border hover:border-brand cursor-pointer active:scale-[0.98]'
                }`}>
                <span className="font-bold text-text text-base">{route.name} {isCurrent && '(поточний)'}</span>
                <span className="text-sm text-text-secondary font-semibold">{route.count} пас.</span>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose}
            className="w-full py-4 bg-bg text-text-secondary font-bold rounded-2xl text-base cursor-pointer hover:bg-border/50 transition-all">
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}
