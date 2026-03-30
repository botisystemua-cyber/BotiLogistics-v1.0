import { useEffect, useState } from 'react';
import {
  Package, Users, RefreshCw, LogOut, ChevronRight, Layers,
} from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchRoutes, fetchPassengerRoutes } from '../api';
import { BotiLogo } from './BotiLogo';

type Tab = 'cargo' | 'passengers';

export function RouteScreen() {
  const {
    driverName, setDriverName, setCurrentScreen, openRoute,
    receivingRoutes, setReceivingRoutes, setShippingRoutes,
    passengerRoutes, setPassengerRoutes, showToast,
  } = useApp();

  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('cargo');

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const [cargoData, paxRoutes] = await Promise.all([
        fetchRoutes(),
        fetchPassengerRoutes().catch(() => [] as { name: string; count: number }[]),
      ]);
      setReceivingRoutes(cargoData.receiving);
      setShippingRoutes(cargoData.shipping);
      setPassengerRoutes(paxRoutes);
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (receivingRoutes.length === 0 && passengerRoutes.length === 0) {
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <BotiLogo size="md" />
            <div className="text-[11px] text-muted">{driverName}</div>
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

        {/* Tabs: Посилки / Пасажири */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('cargo')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-center cursor-pointer transition-all ${
              tab === 'cargo' ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Package className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Посилки
          </button>
          <button
            onClick={() => setTab('passengers')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-center cursor-pointer transition-all ${
              tab === 'passengers' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Пасажири
          </button>
        </div>
      </div>

      {/* Route list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-brand animate-spin mb-3" />
            <p className="text-muted text-sm">Завантаження маршрутів...</p>
          </div>
        ) : tab === 'cargo' ? (
          <>
            {receivingRoutes.length > 1 && (
              <RouteBtn
                icon={<Layers className="w-5 h-5 text-brand" />}
                iconBg="bg-brand/10"
                name="Усі маршрути"
                count={receivingRoutes.reduce((s, r) => s + r.count, 0)}
                accent
                onClick={() => openRoute('__unified__', 'delivery', true)}
              />
            )}
            {receivingRoutes.map((route) => (
              <RouteBtn
                key={route.name}
                icon={<Package className="w-5 h-5 text-brand" />}
                iconBg="bg-brand/10"
                name={route.name}
                count={route.count}
                onClick={() => openRoute(route.name, 'delivery')}
              />
            ))}
            {receivingRoutes.length === 0 && (
              <p className="text-center text-muted text-sm py-10">Маршрутів не знайдено</p>
            )}
          </>
        ) : (
          <>
            {passengerRoutes.length > 1 && (
              <RouteBtn
                icon={<Layers className="w-5 h-5 text-blue-500" />}
                iconBg="bg-blue-50"
                name="Усі маршрути"
                count={passengerRoutes.reduce((s, r) => s + r.count, 0)}
                accent
                onClick={() => openRoute('__unified__', 'passenger', true)}
              />
            )}
            {passengerRoutes.map((route) => (
              <RouteBtn
                key={route.name}
                icon={<Users className="w-5 h-5 text-blue-500" />}
                iconBg="bg-blue-50"
                name={route.name}
                count={route.count}
                onClick={() => openRoute(route.name, 'passenger')}
              />
            ))}
            {passengerRoutes.length === 0 && (
              <p className="text-center text-muted text-sm py-10">Маршрутів пасажирів не знайдено</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RouteBtn({ icon, iconBg, name, count, accent, onClick }: {
  icon: React.ReactNode; iconBg: string; name: string; count: number; accent?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm cursor-pointer active:scale-[0.98] transition-transform ${
        accent ? 'border-2 border-brand/20' : 'border border-border'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>{icon}</div>
      <div className="flex-1 text-left">
        <div className="font-bold text-text text-sm">{name}</div>
        <div className="text-xs text-muted">{count} записів</div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted" />
    </button>
  );
}
