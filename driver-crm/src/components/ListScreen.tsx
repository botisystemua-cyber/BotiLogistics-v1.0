import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Package, Truck, Users, BarChart3,
  Plus, Settings, ListFilter,
} from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchDeliveries, fetchPassengers, fetchShippingItems, fetchPassengerRoutes, transferPassenger } from '../api';
import { DeliveryCard } from './DeliveryCard';
import { PassengerCard } from './PassengerCard';
import { ShippingCard } from './ShippingCard';
import { TransferModal } from './TransferModal';
import { AddLeadModal } from './AddLeadModal';
import { ColumnEditor } from './ColumnEditor';
import type { Delivery, Passenger, ShippingItem, ItemStatus, StatusFilter } from '../types';

type ViewTab = 'receiving' | 'shipping';

export function ListScreen() {
  const {
    currentSheet, currentRouteType, isUnifiedView, goBack, showToast,
    statusFilter, setStatusFilter, getStatus, setStatus,
    routeFilter, setRouteFilter, receivingRoutes, shippingRoutes,
    passengerRoutes, setPassengerRoutes,
  } = useApp();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [allRoutePassengers, setAllRoutePassengers] = useState<Passenger[]>([]);
  const [shippingItems, setShippingItems] = useState<ShippingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showColumnEditor, setShowColumnEditor] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Passenger | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>('receiving');

  const isDelivery = currentRouteType === 'delivery';
  const isPassenger = currentRouteType === 'passenger';

  // Find matching shipping sheet
  const shippingSheetName = shippingRoutes.find(
    (s) => s.label === currentSheet || s.name === currentSheet + ' (відпр)'
  )?.name || '';
  const hasShipping = !!shippingSheetName && !isUnifiedView && isDelivery;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isDelivery && viewTab === 'shipping' && shippingSheetName) {
        const items = await fetchShippingItems(shippingSheetName);
        setShippingItems(items);
        showToast(`${items.length} записів`);
      } else if (isDelivery && isUnifiedView) {
        const results = await Promise.all(receivingRoutes.map(async (route) => {
          try {
            const items = await fetchDeliveries(route.name);
            return items.map((d) => ({ ...d, _sourceRoute: route.name }));
          } catch { return [] as Delivery[]; }
        }));
        const all = results.flat();
        all.forEach((d, idx) => {
          d._statusKey = `del_${d.id || d.internalNumber}_${d._sourceRoute}_${idx}`;
          const s = d.parcelStatus || d.driverStatus;
          if (s && s !== 'pending') setStatus(d._statusKey, s as ItemStatus);
        });
        setDeliveries(all);
        showToast(`${all.length} посилок`);
      } else if (isDelivery) {
        const items = await fetchDeliveries(currentSheet);
        items.forEach((d, idx) => {
          d._statusKey = `del_${d.id || d.internalNumber}_${idx}`;
          const s = d.parcelStatus || d.driverStatus;
          if (s && s !== 'pending') setStatus(d._statusKey, s as ItemStatus);
        });
        setDeliveries(items);
        showToast(`${items.length} записів`);
      } else if (isPassenger && isUnifiedView) {
        let routes = passengerRoutes;
        if (routes.length === 0) { routes = await fetchPassengerRoutes(); setPassengerRoutes(routes); }
        const results = await Promise.all(routes.map(async (route) => {
          const pax = await fetchPassengers(route.name);
          return pax.map((p) => ({ ...p, _sourceRoute: route.name }));
        }));
        const all = results.flat();
        all.forEach((p, idx) => {
          p._statusKey = `pas_${p.rowNum}_${p._sourceRoute}_${idx}`;
          if (p.driverStatus && p.driverStatus !== 'pending') setStatus(p._statusKey, p.driverStatus as ItemStatus);
        });
        setAllRoutePassengers(all);
        setPassengerRoutes(routes.map((r) => ({ ...r, count: all.filter((p) => p._sourceRoute === r.name).length })));
        showToast(`${all.length} пасажирів`);
      } else if (isPassenger) {
        const items = await fetchPassengers(currentSheet);
        items.forEach((p, idx) => {
          p._statusKey = `pas_${p.rowNum}_${idx}`;
          if (p.driverStatus && p.driverStatus !== 'pending') setStatus(p._statusKey, p.driverStatus as ItemStatus);
        });
        setPassengers(items);
        showToast(`${items.length} записів`);
      }
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
    finally { setLoading(false); }
  }, [currentSheet, currentRouteType, isUnifiedView, viewTab, shippingSheetName]);

  useEffect(() => { loadData(); }, [loadData]);

  // Get items based on current view
  const getItems = (): (Delivery | Passenger)[] => {
    if (isDelivery) {
      let items: Delivery[] = deliveries;
      if (isUnifiedView && routeFilter !== 'all') items = items.filter((d) => d._sourceRoute === routeFilter);
      if (statusFilter !== 'all') items = items.filter((i) => getStatus(i._statusKey) === statusFilter);
      return items;
    } else {
      let items: Passenger[] = isUnifiedView ? allRoutePassengers : passengers;
      if (isUnifiedView && routeFilter !== 'all') items = items.filter((p) => p._sourceRoute === routeFilter);
      if (statusFilter !== 'all') items = items.filter((i) => getStatus(i._statusKey) === statusFilter);
      return items;
    }
  };
  const items = (viewTab === 'receiving' || isPassenger) ? getItems() : [];

  // Stats
  const allItems = isDelivery
    ? (isUnifiedView && routeFilter !== 'all' ? deliveries.filter((d) => d._sourceRoute === routeFilter) : deliveries)
    : (isUnifiedView ? (routeFilter !== 'all' ? allRoutePassengers.filter((p) => p._sourceRoute === routeFilter) : allRoutePassengers) : passengers);
  const stats = {
    total: allItems.length,
    inProgress: allItems.filter((i) => getStatus(i._statusKey) === 'in-progress').length,
    completed: allItems.filter((i) => getStatus(i._statusKey) === 'completed').length,
    cancelled: allItems.filter((i) => getStatus(i._statusKey) === 'cancelled').length,
  };

  // Route tabs for unified
  const routeTabs = isUnifiedView
    ? isDelivery
      ? [{ name: 'all', label: 'Усі', count: deliveries.length }, ...receivingRoutes.map((r) => ({
          name: r.name, label: r.name, count: deliveries.filter((d) => d._sourceRoute === r.name).length,
        }))]
      : [{ name: 'all', label: 'Усі', count: allRoutePassengers.length }, ...passengerRoutes.map((r) => ({
          name: r.name, label: r.name, count: r.count,
        }))]
    : [];

  const handleTransfer = async (targetRoute: string) => {
    if (!transferTarget) return; showToast('Переносимо...');
    try { await transferPassenger(transferTarget, transferTarget._sourceRoute || currentSheet, targetRoute); showToast('Перенесено'); setTransferTarget(null); loadData(); }
    catch (err) { showToast('Помилка: ' + (err as Error).message); }
  };

  const HeaderIcon = isPassenger ? Users : isUnifiedView ? BarChart3 : Package;
  const headerTitle = isUnifiedView ? 'Усі маршрути' : currentSheet;

  const filters: { key: StatusFilter; label: string; count: number; pill: string; pillActive: string }[] = [
    { key: 'all', label: 'Усі', count: stats.total, pill: 'bg-gray-100 text-gray-600', pillActive: 'bg-gray-800 text-white' },
    { key: 'in-progress', label: 'В роботі', count: stats.inProgress, pill: 'bg-blue-50 text-blue-400', pillActive: 'bg-blue-500 text-white' },
    { key: 'completed', label: 'Готово', count: stats.completed, pill: 'bg-emerald-50 text-emerald-400', pillActive: 'bg-emerald-500 text-white' },
    { key: 'cancelled', label: 'Скас.', count: stats.cancelled, pill: 'bg-red-50 text-red-400', pillActive: 'bg-red-500 text-white' },
  ];

  const showShippingTab = viewTab === 'shipping' && isDelivery;

  return (
    <div className="flex-1 flex flex-col bg-bg max-h-dvh overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-border px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <button onClick={goBack} className="p-2 -ml-2 rounded-xl hover:bg-bg cursor-pointer active:scale-95 transition-all">
              <ArrowLeft className="w-5 h-5 text-text" />
            </button>
            <div className="flex items-center gap-2">
              <HeaderIcon className="w-5 h-5 text-brand" />
              <div>
                <span className="text-sm font-bold text-text">{headerTitle}</span>
                {isUnifiedView && routeFilter !== 'all' && <span className="text-xs text-muted ml-2">{routeFilter}</span>}
              </div>
            </div>
          </div>
          <button onClick={() => loadData()} className="p-2 rounded-xl hover:bg-bg cursor-pointer active:scale-95 transition-all">
            <RefreshCw className={`w-5 h-5 text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Отримання / Відправка tabs (cargo only) */}
        {hasShipping && (
          <div className="flex gap-2 mb-3">
            <button onClick={() => setViewTab('receiving')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold text-center cursor-pointer transition-all ${viewTab === 'receiving' ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}>
              <Package className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Отримання
            </button>
            <button onClick={() => setViewTab('shipping')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold text-center cursor-pointer transition-all ${viewTab === 'shipping' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}>
              <Truck className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Відправка
            </button>
          </div>
        )}

        {/* Status pills */}
        {!showShippingTab && (
          <div className="flex gap-2">
            {filters.map((f) => {
              const active = statusFilter === f.key;
              return (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`flex-1 py-2 rounded-full text-center cursor-pointer active:scale-95 transition-all ${active ? f.pillActive + ' shadow-sm' : f.pill}`}>
                  <div className="text-sm font-black leading-tight">{f.count}</div>
                  <div className="text-[9px] font-semibold leading-tight">{f.label}</div>
                </button>
              );
            })}
          </div>
        )}

        {showShippingTab && (
          <div className="text-center text-sm text-muted">{shippingItems.length} записів</div>
        )}

        {/* Route tabs for unified */}
        {isUnifiedView && !showShippingTab && routeTabs.length > 0 && (
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-0.5 -mx-1 px-1">
            {routeTabs.map((tab) => (
              <button key={tab.name} onClick={() => setRouteFilter(tab.name)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
                  routeFilter === tab.name ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-500'
                }`}>
                {tab.label} <span className="font-black">{tab.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-20 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-brand animate-spin mb-3" />
            <p className="text-muted text-sm">Завантаження...</p>
          </div>
        ) : showShippingTab ? (
          shippingItems.length === 0 ? <Empty /> : shippingItems.map((item, i) => (
            <ShippingCard key={`ship_${item.rowNum}_${i}`} item={item} index={i} />
          ))
        ) : items.length === 0 ? <Empty /> : isDelivery ? (
          (items as Delivery[]).map((d) => (
            <DeliveryCard key={d._statusKey} delivery={d} globalIndex={deliveries.indexOf(d)} />
          ))
        ) : (
          (items as Passenger[]).map((p, i) => (
            <PassengerCard key={p._statusKey} passenger={p} index={i}
              onTransfer={isUnifiedView ? () => setTransferTarget(p) : undefined} />
          ))
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around items-center py-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] z-40">
        <NB icon={isPassenger ? Users : Package} label="Список" active
          onClick={() => { document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        <NB icon={RefreshCw} label="Оновити" onClick={() => loadData()} />
        {!showShippingTab && (
          <button onClick={() => setShowAddLead(true)}
            className="w-12 h-12 -mt-6 rounded-full bg-brand flex items-center justify-center shadow-lg shadow-brand/30 cursor-pointer active:scale-90 transition-transform">
            <Plus className="w-6 h-6 text-white" />
          </button>
        )}
        {!showShippingTab && (
          <NB icon={Settings} label="Колонки" onClick={() => setShowColumnEditor(true)} />
        )}
        <NB icon={ArrowLeft} label="Назад" onClick={goBack} />
      </div>

      {showAddLead && <AddLeadModal onClose={() => setShowAddLead(false)} onAdded={loadData} />}
      {showColumnEditor && <ColumnEditor onClose={() => setShowColumnEditor(false)} />}
      {transferTarget && <TransferModal passenger={transferTarget} routes={passengerRoutes} onTransfer={handleTransfer} onClose={() => setTransferTarget(null)} />}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <ListFilter className="w-10 h-10 text-border mb-3" strokeWidth={1} />
      <p className="text-muted text-sm">Нічого не знайдено</p>
    </div>
  );
}

function NB({ icon: I, label, active, onClick }: { icon: typeof Package; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 px-2 py-1 cursor-pointer ${active ? 'text-brand' : 'text-muted'}`}>
      <I className="w-5 h-5" /><span className="text-[9px] font-semibold">{label}</span>
    </button>
  );
}
