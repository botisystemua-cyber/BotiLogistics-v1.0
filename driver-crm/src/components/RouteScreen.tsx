import { useEffect, useState } from 'react';
import {
  Package, Users, RefreshCw, ChevronRight, BarChart3,
} from 'lucide-react';
import { BotiLogo } from './BotiLogo';
import { useApp } from '../store/useAppStore';
import { CONFIG } from '../config';
import { fetchPassengerRoutes } from '../api';
import { PasswordModal } from './PasswordModal';

export function RouteScreen() {
  const { driverName, openRoute, showToast, passengerRoutes, setPassengerRoutes } = useApp();
  const [loading, setLoading] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{
    route: string;
    password: string;
  } | null>(null);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const routes = await fetchPassengerRoutes();
      setPassengerRoutes(routes);
    } catch {
      showToast('Помилка завантаження маршрутів');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const handleDeliveryRoute = (name: string, password: string) => {
    setPasswordModal({ route: name, password });
  };

  const handlePasswordSuccess = () => {
    if (passwordModal) {
      openRoute(passwordModal.route, 'delivery');
      showToast(`Відкрито ${passwordModal.route}`);
    }
    setPasswordModal(null);
  };

  const handlePassengerRoute = (name: string) => {
    openRoute(name, 'passenger');
    showToast(`Відкрито ${name}`);
  };

  const handleUnified = () => {
    openRoute('Зведений', 'passenger', true);
    showToast('Завантаження зведеного...');
  };

  const totalPassengers = passengerRoutes.reduce((sum, r) => sum + (r.count || 0), 0);

  return (
    <div className="flex-1 flex flex-col bg-bg overflow-y-auto">
      {/* Header */}
      <div className="bg-white px-6 pt-8 pb-6 border-b border-border">
        <BotiLogo size="md" />
        <div className="mt-3 flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">
            <span className="text-brand font-bold text-sm">
              {driverName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Водій</p>
            <p className="text-base font-bold text-text">{driverName}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-8">
        {/* Delivery routes */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-brand" />
            <h2 className="text-lg font-bold text-text">Посилки</h2>
          </div>
          <div className="space-y-3">
            {CONFIG.DELIVERY_ROUTES.map((route) => (
              <button
                key={route.name}
                onClick={() => handleDeliveryRoute(route.name, route.password)}
                className="w-full flex items-center justify-between p-5 bg-card rounded-2xl shadow-sm border border-border hover:shadow-md hover:border-brand/30 transition-all cursor-pointer text-left active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                    <Package className="w-7 h-7 text-amber-500" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="font-bold text-text text-lg">
                      {route.name.replace(' марш.', '')}
                    </div>
                    <div className="text-sm text-text-secondary mt-0.5">
                      Натисни для входу
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-border" />
              </button>
            ))}
          </div>
        </section>

        {/* Passenger routes */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-bold text-text">Пасажири</h2>
            </div>
            <button
              onClick={loadRoutes}
              className="p-2 rounded-xl hover:bg-bg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-5 h-5 text-text-secondary ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Unified card */}
          {passengerRoutes.length > 0 && (
            <button
              onClick={handleUnified}
              className="w-full mb-4 p-6 bg-brand rounded-2xl shadow-lg shadow-brand/20 cursor-pointer text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-6 h-6 text-white/80" />
                <span className="font-bold text-white text-lg">Зведений</span>
              </div>
              <div className="text-5xl font-black text-white">{totalPassengers}</div>
              <div className="text-sm text-white/70 mt-1 font-medium">
                Пасажирів у всіх маршрутах
              </div>
            </button>
          )}

          <div className="space-y-3">
            {loading && passengerRoutes.length === 0 ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-text-secondary animate-spin mx-auto mb-3" />
                <p className="text-text-secondary text-base">Завантаження...</p>
              </div>
            ) : (
              passengerRoutes.map((route) => (
                <button
                  key={route.name}
                  onClick={() => handlePassengerRoute(route.name)}
                  className="w-full flex items-center justify-between p-5 bg-card rounded-2xl shadow-sm border border-border hover:shadow-md hover:border-brand/30 transition-all cursor-pointer text-left active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                      <Users className="w-7 h-7 text-blue-500" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="font-bold text-text text-lg">{route.name}</div>
                      <div className="text-sm text-text-secondary mt-0.5">Пасажири</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-brand">{route.count}</span>
                    <ChevronRight className="w-6 h-6 text-border" />
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* spacer for bottom */}
        <div className="h-4" />
      </div>

      {passwordModal && (
        <PasswordModal
          routeName={passwordModal.route}
          correctPassword={passwordModal.password}
          onSuccess={handlePasswordSuccess}
          onClose={() => setPasswordModal(null)}
        />
      )}
    </div>
  );
}
