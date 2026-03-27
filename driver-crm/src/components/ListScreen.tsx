import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Package, Users, BarChart3, Filter,
  Clock, RotateCw, CheckCircle2, XCircle, Plus, Settings,
} from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchDeliveries, fetchPassengers, fetchPassengerRoutes, transferPassenger } from '../api';
import { DeliveryCard } from './DeliveryCard';
import { PassengerCard } from './PassengerCard';
import { TransferModal } from './TransferModal';
import { AddLeadModal } from './AddLeadModal';
import { ColumnEditor } from './ColumnEditor';
import type { Delivery, Passenger, ItemStatus, StatusFilter } from '../types';

export function ListScreen() {
  const {
    currentSheet, currentRouteType, isUnifiedView, goBack, showToast,
    statusFilter, setStatusFilter, getStatus, setStatus,
    routeFilter, setRouteFilter, passengerRoutes, setPassengerRoutes,
  } = useApp();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [allRoutePassengers, setAllRoutePassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferTarget, setTransferTarget] = useState<Passenger | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showColumnEditor, setShowColumnEditor] = useState(false);

  const isDelivery = currentRouteType === 'delivery';

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isUnifiedView) {
        // Fetch all passenger routes
        let routes = passengerRoutes;
        if (routes.length === 0) {
          routes = await fetchPassengerRoutes();
          setPassengerRoutes(routes);
        }
        // Fetch all passengers in parallel
        const results = await Promise.all(
          routes.map(async (route) => {
            const pax = await fetchPassengers(route.name);
            return pax.map((p) => ({ ...p, _sourceRoute: route.name }));
          })
        );
        const all = results.flat();
        // Assign status keys
        all.forEach((p, idx) => {
          p._statusKey = `pas_${p.rowNum}_${p._sourceRoute}_${idx}`;
          if (p.driverStatus && p.driverStatus !== 'pending') {
            setStatus(p._statusKey, p.driverStatus as ItemStatus);
          }
        });
        setAllRoutePassengers(all);
        // Update route counts
        const updatedRoutes = routes.map((r) => ({
          ...r,
          count: all.filter((p) => p._sourceRoute === r.name).length,
        }));
        setPassengerRoutes(updatedRoutes);
        showToast(`Завантажено ${all.length} пасажирів`);
      } else if (isDelivery) {
        const items = await fetchDeliveries(currentSheet);
        items.forEach((d, idx) => {
          d._statusKey = `del_${d.internalNumber}_${idx}`;
          const apiStatus = d.status || d.driverStatus;
          if (apiStatus && apiStatus !== 'pending') {
            setStatus(d._statusKey, apiStatus as ItemStatus);
          }
        });
        setDeliveries(items);
        showToast(`Завантажено ${items.length} записів`);
      } else {
        const items = await fetchPassengers(currentSheet);
        items.forEach((p, idx) => {
          p._statusKey = `pas_${p.rowNum}_${idx}`;
          if (p.driverStatus && p.driverStatus !== 'pending') {
            setStatus(p._statusKey, p.driverStatus as ItemStatus);
          }
        });
        setPassengers(items);
        showToast(`Завантажено ${items.length} записів`);
      }
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currentSheet, currentRouteType, isUnifiedView]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Apply filters
  const getItems = (): (Delivery | Passenger)[] => {
    let items: (Delivery | Passenger)[];
    if (isUnifiedView) {
      items = routeFilter === 'all'
        ? allRoutePassengers
        : allRoutePassengers.filter((p) => p._sourceRoute === routeFilter);
    } else if (isDelivery) {
      items = deliveries;
    } else {
      items = passengers;
    }

    if (statusFilter !== 'all') {
      items = items.filter((item) => getStatus(item._statusKey) === statusFilter);
    }
    return items;
  };

  const items = getItems();

  // Stats
  const allItems = isUnifiedView
    ? (routeFilter === 'all' ? allRoutePassengers : allRoutePassengers.filter((p) => (p as Passenger)._sourceRoute === routeFilter))
    : isDelivery ? deliveries : passengers;
  const stats = {
    total: allItems.length,
    inProgress: allItems.filter((i) => getStatus(i._statusKey) === 'in-progress').length,
    completed: allItems.filter((i) => getStatus(i._statusKey) === 'completed').length,
    cancelled: allItems.filter((i) => getStatus(i._statusKey) === 'cancelled').length,
  };

  // Unified route tabs
  const routeTabs = isUnifiedView
    ? [
        { name: 'all', label: 'Усього', count: allRoutePassengers.length },
        ...passengerRoutes.map((r) => ({ name: r.name, label: r.name, count: r.count })),
      ]
    : [];

  const handleTransfer = async (targetRoute: string) => {
    if (!transferTarget) return;
    const sourceRoute = transferTarget._sourceRoute || currentSheet;
    showToast('Переносимо...');
    try {
      await transferPassenger(transferTarget, sourceRoute, targetRoute);
      showToast(`Перенесено до ${targetRoute}`);
      setTransferTarget(null);
      loadData();
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    }
  };

  const headerIcon = isUnifiedView
    ? BarChart3
    : isDelivery
      ? Package
      : Users;
  const HeaderIcon = headerIcon;

  const headerTitle = isUnifiedView
    ? 'Зведений'
    : isDelivery
      ? 'Посилки'
      : 'Пасажири';

  const filterButtons: { key: StatusFilter; icon: typeof Clock; label: string; count: number }[] = [
    { key: 'all', icon: Filter, label: 'УСЬОГО', count: stats.total },
    { key: 'in-progress', icon: RotateCw, label: 'В ПРОЦЕСІ', count: stats.inProgress },
    { key: 'completed', icon: CheckCircle2, label: 'ГОТОВО', count: stats.completed },
    { key: 'cancelled', icon: XCircle, label: 'СКАС.', count: stats.cancelled },
  ];

  return (
    <div className="flex-1 flex flex-col bg-dark-bg max-h-dvh overflow-hidden">
      {/* Header */}
      <div className="bg-dark-card border-b border-neon-green/10 px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HeaderIcon className="w-5 h-5 text-neon-green" />
            <div>
              <div className="text-sm font-bold text-white">{headerTitle}</div>
              <div className="text-[10px] text-white/40">
                {isUnifiedView && routeFilter !== 'all' ? routeFilter : currentSheet}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadData()}
              className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-[11px] font-semibold text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Оновити
            </button>
            <button
              onClick={goBack}
              className="px-3 py-1.5 bg-neon-green/10 border border-neon-green/30 rounded-lg text-[11px] font-semibold text-neon-green hover:bg-neon-green/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Назад
            </button>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {filterButtons.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer border ${
                statusFilter === f.key
                  ? 'bg-neon-green/15 border-neon-green/40 text-neon-green shadow-[0_0_10px_rgba(57,255,20,0.1)]'
                  : 'bg-dark-surface border-dark-border text-white/40 hover:text-white/60'
              }`}
            >
              <div className="text-xs font-bold">{f.count}</div>
              <div className="text-[7px] font-semibold tracking-wider">{f.label}</div>
            </button>
          ))}
        </div>

        {/* Route filter tabs (unified) */}
        {isUnifiedView && routeTabs.length > 0 && (
          <div className="flex gap-1 mt-2 overflow-x-auto scrollbar-hide pb-0.5">
            {routeTabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => setRouteFilter(tab.name)}
                className={`shrink-0 px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                  routeFilter === tab.name
                    ? 'bg-neon-green/15 border-neon-green/40 text-neon-green'
                    : 'bg-dark-surface border-dark-border text-white/40'
                }`}
              >
                {tab.label} <span className="font-black">{tab.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-20 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-8 h-8 text-neon-green/50 animate-spin mb-3" />
            <p className="text-white/40 text-sm">Завантаження...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Package className="w-10 h-10 text-white/10 mb-3" />
            <p className="text-white/30 text-sm">Нічого не знайдено</p>
          </div>
        ) : isDelivery ? (
          (items as Delivery[]).map((delivery) => (
            <DeliveryCard
              key={delivery._statusKey}
              delivery={delivery}
              globalIndex={deliveries.indexOf(delivery)}
            />
          ))
        ) : (
          (items as Passenger[]).map((passenger, idx) => (
            <PassengerCard
              key={passenger._statusKey}
              passenger={passenger}
              index={idx}
              onTransfer={isUnifiedView ? () => setTransferTarget(passenger) : undefined}
            />
          ))
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-dark-card/95 backdrop-blur-md border-t border-neon-green/20 flex justify-around items-center py-2 pb-[calc(8px+env(safe-area-inset-bottom))] z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        <NavBtn icon={isDelivery ? Package : Users} label={isDelivery ? 'Посилки' : 'Пасажири'} active onClick={() => {
          const container = document.querySelector('.overflow-y-auto');
          container?.scrollTo({ top: 0, behavior: 'smooth' });
        }} />
        <NavBtn icon={RefreshCw} label="Оновити" onClick={() => loadData()} />
        <NavBtn icon={Plus} label="Додати" onClick={() => setShowAddLead(true)} />
        {isDelivery && (
          <NavBtn icon={Settings} label="Колонки" onClick={() => setShowColumnEditor(true)} />
        )}
      </div>

      {/* Modals */}
      {transferTarget && (
        <TransferModal
          passenger={transferTarget}
          routes={passengerRoutes}
          onTransfer={handleTransfer}
          onClose={() => setTransferTarget(null)}
        />
      )}
      {showAddLead && (
        <AddLeadModal onClose={() => setShowAddLead(false)} onAdded={loadData} />
      )}
      {showColumnEditor && <ColumnEditor onClose={() => setShowColumnEditor(false)} />}
    </div>
  );
}

function NavBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Package;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1 cursor-pointer transition-colors ${
        active ? 'text-neon-green' : 'text-white/40 hover:text-white/60'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[9px] font-semibold">{label}</span>
    </button>
  );
}
