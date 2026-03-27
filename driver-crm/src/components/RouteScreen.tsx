import { useEffect, useState } from 'react';
import {
  Package, Users, RefreshCw, User, BarChart3, Lock, ChevronRight,
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
    <div className="flex-1 flex flex-col items-center px-5 py-8 bg-gradient-to-br from-dark-bg via-[#0d1a12] to-dark-bg overflow-y-auto relative">
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-neon-green/5 blur-[120px] pointer-events-none" />

      <BotiLogo size="md" />
      <p className="text-neon-green/50 text-[10px] tracking-[3px] uppercase font-semibold mt-1">
        Driver App
      </p>

      {/* Driver info */}
      <div className="mt-5 mb-8 flex items-center gap-2 px-4 py-2.5 bg-neon-green/10 border border-neon-green/20 rounded-xl">
        <User className="w-4 h-4 text-neon-green" />
        <span className="text-sm text-white/90 font-medium">Водій: {driverName}</span>
      </div>

      <div className="w-full max-w-lg space-y-8">
        {/* Delivery routes */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Package className="w-4 h-4 text-neon-green" />
            <h2 className="text-sm font-bold text-white/90 tracking-wider uppercase">Посилки</h2>
          </div>
          <div className="grid gap-3">
            {CONFIG.DELIVERY_ROUTES.map((route) => (
              <button
                key={route.name}
                onClick={() => handleDeliveryRoute(route.name, route.password)}
                className="group w-full flex items-center justify-between p-4 bg-dark-card border border-dark-border rounded-xl hover:border-neon-green/30 hover:shadow-[0_0_20px_rgba(57,255,20,0.08)] transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neon-green/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-neon-green" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">
                      {route.name.replace(' марш.', '')}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Lock className="w-3 h-3 text-white/30" />
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">
                        Пароль
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-neon-green transition-colors" />
              </button>
            ))}
          </div>
        </section>

        {/* Passenger routes */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-neon-green" />
              <h2 className="text-sm font-bold text-white/90 tracking-wider uppercase">
                Пасажири
              </h2>
            </div>
            <button
              onClick={loadRoutes}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Unified card */}
          {passengerRoutes.length > 0 && (
            <button
              onClick={handleUnified}
              className="w-full mb-3 p-5 bg-gradient-to-r from-neon-green/20 via-neon-green/10 to-neon-green/5 border border-neon-green/30 rounded-xl hover:shadow-[0_0_30px_rgba(57,255,20,0.15)] transition-all cursor-pointer text-center group"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <BarChart3 className="w-5 h-5 text-neon-green" />
                <span className="font-bold text-neon-green text-sm tracking-wider">ЗВЕДЕНИЙ</span>
              </div>
              <div className="text-3xl font-black text-white mt-1 drop-shadow-[0_0_10px_rgba(57,255,20,0.3)]">
                {totalPassengers}
              </div>
              <div className="text-[10px] text-white/50 uppercase tracking-widest mt-1">
                Пасажирів у всіх маршрутах
              </div>
            </button>
          )}

          <div className="grid gap-3">
            {loading && passengerRoutes.length === 0 ? (
              <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 text-neon-green/50 animate-spin mx-auto mb-2" />
                <p className="text-white/40 text-sm">Завантаження...</p>
              </div>
            ) : (
              passengerRoutes.map((route) => (
                <button
                  key={route.name}
                  onClick={() => handlePassengerRoute(route.name)}
                  className="group w-full flex items-center justify-between p-4 bg-dark-card border border-dark-border rounded-xl hover:border-neon-green/30 hover:shadow-[0_0_20px_rgba(57,255,20,0.08)] transition-all cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{route.name}</div>
                      <span className="text-[10px] text-blue-400/70 uppercase tracking-wider">
                        Пасажири
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-neon-green">{route.count}</span>
                    <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-neon-green transition-colors" />
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
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
