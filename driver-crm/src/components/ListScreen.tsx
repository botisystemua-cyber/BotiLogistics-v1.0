import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Package, Users, BarChart3,
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isUnifiedView) {
        let routes = passengerRoutes;
        if (routes.length === 0) {
          routes = await fetchPassengerRoutes();
          setPassengerRoutes(routes);
        }
        const results = await Promise.all(
          routes.map(async (route) => {
            const pax = await fetchPassengers(route.name);
            return pax.map((p) => ({ ...p, _sourceRoute: route.name }));
          })
        );
        const all = results.flat();
        all.forEach((p, idx) => {
          p._statusKey = `pas_${p.rowNum}_${p._sourceRoute}_${idx}`;
          if (p.driverStatus && p.driverStatus !== 'pending') {
            setStatus(p._statusKey, p.driverStatus as ItemStatus);
          }
        });
        setAllRoutePassengers(all);
        setPassengerRoutes(routes.map((r) => ({
          ...r, count: all.filter((p) => p._sourceRoute === r.name).length,
        })));
        showToast(`Завантажено ${all.length} пасажирів`);
      } else if (isDelivery) {
        const items = await fetchDeliveries(currentSheet);
        items.forEach((d, idx) => {
          d._statusKey = `del_${d.internalNumber}_${idx}`;
          const apiStatus = d.status || d.driverStatus;
          if (apiStatus && apiStatus !== 'pending') setStatus(d._statusKey, apiStatus as ItemStatus);
        });
        setDeliveries(items);
        showToast(`Завантажено ${items.length} записів`);
      } else {
        const items = await fetchPassengers(currentSheet);
        items.forEach((p, idx) => {
          p._statusKey = `pas_${p.rowNum}_${idx}`;
          if (p.driverStatus && p.driverStatus !== 'pending') setStatus(p._statusKey, p.driverStatus as ItemStatus);
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

  useEffect(() => { loadData(); }, [loadData]);

  const getItems = (): (Delivery | Passenger)[] => {
    let items: (Delivery | Passenger)[];
    if (isUnifiedView) {
      items = routeFilter === 'all' ? allRoutePassengers : allRoutePassengers.filter((p) => p._sourceRoute === routeFilter);
    } else if (isDelivery) {
      items = deliveries;
    } else {
      items = passengers;
    }
    if (statusFilter !== 'all') items = items.filter((item) => getStatus(item._statusKey) === statusFilter);
    return items;
  };

  const items = getItems();

  const allItems = isUnifiedView
    ? (routeFilter === 'all' ? allRoutePassengers : allRoutePassengers.filter((p) => (p as Passenger)._sourceRoute === routeFilter))
    : isDelivery ? deliveries : passengers;
  const stats = {
    total: allItems.length,
    inProgress: allItems.filter((i) => getStatus(i._statusKey) === 'in-progress').length,
    completed: allItems.filter((i) => getStatus(i._statusKey) === 'completed').length,
    cancelled: allItems.filter((i) => getStatus(i._statusKey) === 'cancelled').length,
  };

  const routeTabs = isUnifiedView
    ? [{ name: 'all', label: 'Усього', count: allRoutePassengers.length }, ...passengerRoutes.map((r) => ({ name: r.name, label: r.name, count: r.count }))]
    : [];

  const handleTransfer = async (targetRoute: string) => {
    if (!transferTarget) return;
    showToast('Переносимо...');
    try {
      await transferPassenger(transferTarget, transferTarget._sourceRoute || currentSheet, targetRoute);
      showToast(`Перенесено до ${targetRoute}`);
      setTransferTarget(null);
      loadData();
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
  };

  const HeaderIcon = isUnifiedView ? BarChart3 : isDelivery ? Package : Users;
  const headerTitle = isUnifiedView ? 'Зведений' : isDelivery ? 'Посилки' : 'Пасажири';

  const filters: { key: StatusFilter; icon: typeof Clock; label: string; count: number; color: string }[] = [
    { key: 'all', icon: Package, label: 'Усього', count: stats.total, color: 'brand' },
    { key: 'in-progress', icon: RotateCw, label: 'В роботі', count: stats.inProgress, color: 'blue' },
    { key: 'completed', icon: CheckCircle2, label: 'Готово', count: stats.completed, color: 'green' },
    { key: 'cancelled', icon: XCircle, label: 'Скас.', count: stats.cancelled, color: 'red' },
  ];

  const filterColors: Record<string, { active: string; inactive: string }> = {
    brand: { active: 'bg-brand text-white shadow-lg shadow-brand/20', inactive: 'bg-white text-text border border-border' },
    blue: { active: 'bg-blue-500 text-white shadow-lg shadow-blue-500/20', inactive: 'bg-white text-text border border-border' },
    green: { active: 'bg-green-500 text-white shadow-lg shadow-green-500/20', inactive: 'bg-white text-text border border-border' },
    red: { active: 'bg-red-500 text-white shadow-lg shadow-red-500/20', inactive: 'bg-white text-text border border-border' },
  };

  return (
    <div className="flex-1 flex flex-col bg-bg max-h-dvh overflow-hidden">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-light flex items-center justify-center">
              <HeaderIcon className="w-6 h-6 text-brand" />
            </div>
            <div>
              <div className="text-lg font-bold text-text">{headerTitle}</div>
              <div className="text-xs text-text-secondary">
                {isUnifiedView && routeFilter !== 'all' ? routeFilter : currentSheet}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => loadData()}
              className="px-4 py-2.5 bg-blue-50 rounded-xl text-sm font-bold text-blue-600 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Оновити
            </button>
            <button onClick={goBack}
              className="px-4 py-2.5 bg-bg rounded-xl text-sm font-bold text-text-secondary active:scale-95 transition-all cursor-pointer flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>
          </div>
        </div>

        {/* Status filter */}
        <div className="grid grid-cols-4 gap-2">
          {filters.map((f) => {
            const isActive = statusFilter === f.key;
            const Icon = f.icon;
            return (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`py-3 rounded-2xl text-center transition-all cursor-pointer active:scale-95 ${isActive ? filterColors[f.color].active : filterColors[f.color].inactive}`}>
                <Icon className="w-5 h-5 mx-auto mb-0.5" />
                <div className="text-lg font-black">{f.count}</div>
                <div className="text-[10px] font-semibold opacity-80">{f.label}</div>
              </button>
            );
          })}
        </div>

        {/* Route filter tabs (unified) */}
        {isUnifiedView && routeTabs.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
            {routeTabs.map((tab) => (
              <button key={tab.name} onClick={() => setRouteFilter(tab.name)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                  routeFilter === tab.name
                    ? 'bg-brand text-white shadow-md shadow-brand/20'
                    : 'bg-white text-text border border-border'
                }`}>
                {tab.label} <span className="font-black">{tab.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-10 h-10 text-brand animate-spin mb-4" />
            <p className="text-text-secondary text-lg font-medium">Завантаження...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package className="w-16 h-16 text-border mb-4" strokeWidth={1} />
            <p className="text-text-secondary text-lg font-medium">Нічого не знайдено</p>
          </div>
        ) : isDelivery ? (
          (items as Delivery[]).map((delivery) => (
            <DeliveryCard key={delivery._statusKey} delivery={delivery} globalIndex={deliveries.indexOf(delivery)} />
          ))
        ) : (
          (items as Passenger[]).map((passenger, idx) => (
            <PassengerCard key={passenger._statusKey} passenger={passenger} index={idx}
              onTransfer={isUnifiedView ? () => setTransferTarget(passenger) : undefined} />
          ))
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around items-center py-2 pb-[calc(8px+env(safe-area-inset-bottom))] z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <NavBtn icon={isDelivery ? Package : Users} label={isDelivery ? 'Посилки' : 'Пасажири'} active
          onClick={() => { document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        <NavBtn icon={RefreshCw} label="Оновити" onClick={() => loadData()} />
        <NavBtn icon={Plus} label="Додати" onClick={() => setShowAddLead(true)} isBrand />
        {isDelivery && <NavBtn icon={Settings} label="Колонки" onClick={() => setShowColumnEditor(true)} />}
      </div>

      {/* Modals */}
      {transferTarget && (
        <TransferModal passenger={transferTarget} routes={passengerRoutes}
          onTransfer={handleTransfer} onClose={() => setTransferTarget(null)} />
      )}
      {showAddLead && <AddLeadModal onClose={() => setShowAddLead(false)} onAdded={loadData} />}
      {showColumnEditor && <ColumnEditor onClose={() => setShowColumnEditor(false)} />}
    </div>
  );
}

function NavBtn({ icon: Icon, label, active, isBrand, onClick }: {
  icon: typeof Package; label: string; active?: boolean; isBrand?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-1.5 cursor-pointer transition-colors ${
        isBrand ? 'text-brand' : active ? 'text-brand' : 'text-text-secondary'
      }`}>
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}
