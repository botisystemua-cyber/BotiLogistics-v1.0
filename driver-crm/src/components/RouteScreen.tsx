import { useEffect, useState } from 'react';
import { Package, Users, RefreshCw, ChevronRight, BarChart3 } from 'lucide-react';
import { BotiLogo } from './BotiLogo';
import { useApp } from '../store/useAppStore';
import { CONFIG } from '../config';
import { fetchPassengerRoutes } from '../api';
import { PasswordModal } from './PasswordModal';

export function RouteScreen() {
  const { driverName, openRoute, showToast, passengerRoutes, setPassengerRoutes, setCurrentScreen } = useApp();
  const [loading, setLoading] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{ route: string; password: string } | null>(null);

  const loadRoutes = async () => {
    setLoading(true);
    try { setPassengerRoutes(await fetchPassengerRoutes()); }
    catch { showToast('Помилка завантаження'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRoutes(); }, []);

  const totalPassengers = passengerRoutes.reduce((sum, r) => sum + (r.count || 0), 0);

  return (
    <div className="flex-1 flex flex-col bg-bg overflow-y-auto">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <BotiLogo size="lg" />
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-xs text-muted">Водій</div>
              <div className="text-sm font-bold text-text">{driverName}</div>
            </div>
            <button onClick={() => setCurrentScreen('login')} className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center text-sm font-bold cursor-pointer hover:bg-brand-dark transition-colors">
              {driverName.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5 pb-8">
        {/* Delivery routes */}
        <section>
          <SectionTitle icon={Package} label="Посилки" />

          {/* Unified delivery */}
          <button onClick={() => { openRoute('Усі маршрути', 'delivery', true); }}
            className="w-full mb-2 p-3.5 bg-card border-2 border-gray-300 rounded-2xl cursor-pointer text-left active:scale-[0.98] transition-transform flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="text-sm font-bold text-text">Усі маршрути</div>
                <div className="text-xs text-muted">Посилки</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted/40" />
          </button>

          <div className="space-y-2">
            {CONFIG.DELIVERY_ROUTES.map((route) => (
              <RouteCard key={route.name}
                icon={<Package className="w-5 h-5 text-amber-500" />}
                iconBg="bg-amber-50"
                name={route.name.replace(' марш.', '')}
                onClick={() => setPasswordModal({ route: route.name, password: route.password })} />
            ))}
          </div>
        </section>

        {/* Passenger routes */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <SectionTitle icon={Users} label="Пасажири" />
            <button onClick={loadRoutes} className="p-2 -mr-1 rounded-xl hover:bg-white cursor-pointer">
              <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Unified */}
          {passengerRoutes.length > 0 && (
            <button onClick={() => { openRoute('Усі маршрути', 'passenger', true); }}
              className="w-full mb-2 p-3.5 bg-card border-2 border-gray-300 rounded-2xl cursor-pointer text-left active:scale-[0.98] transition-transform flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-sm font-bold text-text">Усі маршрути</div>
                  <div className="text-xs text-muted">Пасажири</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-brand">{totalPassengers}</span>
                <ChevronRight className="w-4 h-4 text-muted/40" />
              </div>
            </button>
          )}

          <div className="space-y-2">
            {loading && passengerRoutes.length === 0 ? (
              <div className="text-center py-8">
                <RefreshCw className="w-5 h-5 text-muted animate-spin mx-auto mb-2" />
                <p className="text-muted text-sm">Завантаження...</p>
              </div>
            ) : passengerRoutes.map((route) => (
              <RouteCard key={route.name}
                icon={<Users className="w-5 h-5 text-blue-500" />}
                iconBg="bg-blue-50"
                name={route.name}
                right={<span className="text-lg font-black text-brand">{route.count}</span>}
                onClick={() => { openRoute(route.name, 'passenger'); }} />
            ))}
          </div>
        </section>
      </div>

      {passwordModal && (
        <PasswordModal routeName={passwordModal.route} correctPassword={passwordModal.password}
          onSuccess={() => { openRoute(passwordModal!.route, 'delivery'); setPasswordModal(null); }}
          onClose={() => setPasswordModal(null)} />
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: typeof Package; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3 px-0.5">
      <Icon className="w-5 h-5 text-brand" />
      <h2 className="text-lg font-black text-text">{label}</h2>
    </div>
  );
}

function RouteCard({ icon, iconBg, name, right, onClick }: {
  icon: React.ReactNode; iconBg: string; name: string; right?: React.ReactNode; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between p-3.5 bg-card rounded-xl border border-border hover:border-brand/30 hover:shadow-sm transition-all cursor-pointer text-left active:scale-[0.98]">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
        <span className="font-semibold text-text text-[15px]">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {right}
        <ChevronRight className="w-4 h-4 text-muted/40" />
      </div>
    </button>
  );
}
