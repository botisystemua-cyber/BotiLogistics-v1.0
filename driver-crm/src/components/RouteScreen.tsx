import { useEffect } from 'react';
import { Package, LogOut, ChevronRight, Layers } from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchRoutes } from '../api';
import { BotiLogo } from './BotiLogo';

export function RouteScreen() {
  const { driverName, setDriverName, setCurrentScreen, openRoute, routes, setRoutes, setShippingRoutes, showToast } = useApp();
  useEffect(() => {
    if (routes.length === 0) {
      const data = fetchRoutes();
      setRoutes(data.routes);
      setShippingRoutes(data.shipping);
    }
  }, []);

  const logout = () => { setDriverName(''); localStorage.removeItem('driverName'); setCurrentScreen('login'); };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white border-b border-border px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BotiLogo size="md" />
            <div className="text-[11px] text-muted">{driverName}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={logout} className="p-2 rounded-xl hover:bg-red-50 cursor-pointer active:scale-95 transition-all">
              <LogOut className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {routes.length > 0 ? (
          <>
            {routes.length > 1 && (
              <button onClick={() => openRoute('__unified__', true)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border-2 border-brand/20 shadow-sm cursor-pointer active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center"><Layers className="w-5 h-5 text-brand" /></div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-text text-sm">Усі маршрути</div>
                  <div className="text-xs text-muted">{routes.reduce((s, r) => s + r.count, 0)} записів</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted" />
              </button>
            )}
            {routes.map((r) => (
              <button key={r.name} onClick={() => openRoute(r.name)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-border shadow-sm cursor-pointer active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center"><Package className="w-5 h-5 text-brand" /></div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-text text-sm">{r.name}</div>
                  <div className="text-xs text-muted">{r.count} записів</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted" />
              </button>
            ))}
          </>
        ) : (
          <p className="text-center text-muted text-sm py-10">Маршрутів не знайдено</p>
        )}
      </div>
    </div>
  );
}
