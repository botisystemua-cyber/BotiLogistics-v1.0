import { useEffect, useState } from 'react';
import { Package, LogOut, ChevronRight, Layers, RefreshCw, User } from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchRoutes } from '../api';
import { BotiLogo } from './BotiLogo';

export function RouteScreen() {
  const { driverName, setDriverName, setCurrentScreen, openRoute, routes, setRoutes, shippingRoutes, setShippingRoutes } = useApp();
  const [loading, setLoading] = useState(false);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const data = await fetchRoutes();
      setRoutes(data.routes);
      setShippingRoutes(data.shipping);
    } catch { /* fallback handled inside fetchRoutes */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRoutes(); }, []);

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
                className="w-full flex items-center gap-3 p-4 bg-brand/10 rounded-2xl border-2 border-brand/30 shadow-sm cursor-pointer active:scale-[0.98] transition-transform">
                <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center shadow-sm"><Layers className="w-5 h-5 text-white" /></div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-brand-dark text-sm">Усі маршрути</div>
                  <div className="flex items-center gap-2 text-xs text-brand/60">
                    <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{routes.reduce((s, r) => s + (r.paxCount || 0), 0)}</span>
                    <span className="flex items-center gap-0.5">📦 {routes.reduce((s, r) => s + (r.pkgCount || 0), 0) + shippingRoutes.reduce((s, r) => s + r.count, 0)}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-brand" />
              </button>
            )}
            {routes.map((r) => (
              <button key={r.name} onClick={() => openRoute(r.name)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-border shadow-sm cursor-pointer active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center"><Package className="w-5 h-5 text-brand" /></div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-text text-sm">{r.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{r.paxCount || 0}</span>
                    <span className="flex items-center gap-0.5">📦 {(r.pkgCount || 0) + (() => { const num = r.name.replace('Маршрут_', ''); const ship = shippingRoutes.find(s => s.name === 'Відправка_' + num); return ship ? ship.count : 0; })()}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted" />
              </button>
            ))}
          </>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-brand animate-spin mb-3" />
            <p className="text-muted text-sm">Завантаження маршрутів...</p>
          </div>
        ) : (
          <p className="text-center text-muted text-sm py-10">Маршрутів не знайдено</p>
        )}
      </div>
    </div>
  );
}
