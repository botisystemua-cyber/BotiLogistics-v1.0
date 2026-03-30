import { useEffect, useState } from 'react';
import {
  Package, RefreshCw, LogOut, ChevronRight, Layers,
} from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchRoutes } from '../api';
import { BotiLogo } from './BotiLogo';

export function RouteScreen() {
  const {
    driverName, setDriverName, setCurrentScreen, openRoute,
    receivingRoutes, setReceivingRoutes, setShippingRoutes, showToast,
  } = useApp();

  const [loading, setLoading] = useState(false);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const data = await fetchRoutes();
      setReceivingRoutes(data.receiving);
      setShippingRoutes(data.shipping);
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (receivingRoutes.length === 0) {
      loadRoutes();
    }
  }, []);

  const logout = () => {
    setDriverName('');
    localStorage.removeItem('driverName');
    setCurrentScreen('login');
  };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      {/* Header */}
      <div className="bg-white border-b border-border px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BotiLogo />
            <div>
              <div className="text-sm font-bold text-text">BotiLogistics</div>
              <div className="text-[11px] text-muted">{driverName}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={loadRoutes}
              className="p-2 rounded-xl hover:bg-bg cursor-pointer active:scale-95 transition-all">
              <RefreshCw className={`w-5 h-5 text-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={logout}
              className="p-2 rounded-xl hover:bg-red-50 cursor-pointer active:scale-95 transition-all">
              <LogOut className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Route list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-brand animate-spin mb-3" />
            <p className="text-muted text-sm">Завантаження маршрутів...</p>
          </div>
        ) : (
          <>
            {/* Unified */}
            {receivingRoutes.length > 1 && (
              <button
                onClick={() => openRoute('__unified__', 'delivery', true)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border-2 border-brand/20 shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-brand" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-text text-sm">Усі маршрути</div>
                  <div className="text-xs text-muted">
                    {receivingRoutes.reduce((s, r) => s + r.count, 0)} посилок
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted" />
              </button>
            )}

            {/* Individual routes */}
            {receivingRoutes.map((route) => (
              <button
                key={route.name}
                onClick={() => openRoute(route.name, 'delivery')}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-border shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-brand" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-text text-sm">{route.name}</div>
                  <div className="text-xs text-muted">{route.count} записів</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted" />
              </button>
            ))}

            {receivingRoutes.length === 0 && !loading && (
              <p className="text-center text-muted text-sm py-10">Маршрутів не знайдено</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
