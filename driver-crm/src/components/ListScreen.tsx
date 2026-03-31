import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Package, Users, Truck, BarChart3,
  Settings, ListFilter,
} from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchRouteItems, fetchShippingItems } from '../api';
import { PassengerCard } from './PassengerCard';
import { PackageCard } from './PackageCard';
import { ShippingCard } from './ShippingCard';
import { ColumnEditor } from './ColumnEditor';
import type { Passenger, Package as Pkg, ShippingItem, ItemStatus, StatusFilter, ViewTab } from '../types';

export function ListScreen() {
  const {
    currentSheet, isUnifiedView, goBack, showToast,
    statusFilter, setStatusFilter, getStatus, setStatus,
    routeFilter, setRouteFilter, routes, shippingRoutes,
    viewTab, setViewTab,
  } = useApp();

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [shippingItems, setShippingItems] = useState<ShippingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColumnEditor, setShowColumnEditor] = useState(false);

  // Find matching shipping sheet: Маршрут_1 → Відправка_1
  const routeNum = currentSheet.replace('Маршрут_', '');
  const shippingSheetName = shippingRoutes.find((s) => s.name === 'Відправка_' + routeNum)?.name || '';
  const hasShipping = !!shippingSheetName && !isUnifiedView;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewTab === 'shipping' && shippingSheetName) {
        const items = await fetchShippingItems(shippingSheetName);
        setShippingItems(items);
        showToast(`${items.length} відправлень`);
      } else if (isUnifiedView) {
        const results = await Promise.all(routes.map(async (route) => {
          try {
            const data = await fetchRouteItems(route.name);
            return {
              passengers: data.passengers.map((p) => ({ ...p, _sourceRoute: route.name })),
              packages: data.packages.map((p) => ({ ...p, _sourceRoute: route.name })),
            };
          } catch { return { passengers: [] as Passenger[], packages: [] as Pkg[] }; }
        }));
        const allPax = results.flatMap((r) => r.passengers);
        const allPkg = results.flatMap((r) => r.packages);
        allPax.forEach((p, i) => { p._statusKey = `pax_${p.itemId}_${p._sourceRoute}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
        allPkg.forEach((p, i) => { p._statusKey = `pkg_${p.itemId}_${p._sourceRoute}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
        setPassengers(allPax);
        setPackages(allPkg);
        showToast(`${allPax.length} пас. / ${allPkg.length} пос.`);
      } else {
        const data = await fetchRouteItems(currentSheet);
        data.passengers.forEach((p, i) => { p._statusKey = `pax_${p.itemId}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
        data.packages.forEach((p, i) => { p._statusKey = `pkg_${p.itemId}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
        setPassengers(data.passengers);
        setPackages(data.packages);
        showToast(`${data.passengers.length} пас. / ${data.packages.length} пос.`);
      }
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
    finally { setLoading(false); }
  }, [currentSheet, isUnifiedView, viewTab, shippingSheetName]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter items by status and route
  const filterItems = <T extends { _statusKey: string; _sourceRoute?: string }>(items: T[]): T[] => {
    let filtered = items;
    if (isUnifiedView && routeFilter !== 'all') filtered = filtered.filter((i) => i._sourceRoute === routeFilter);
    if (statusFilter !== 'all') filtered = filtered.filter((i) => getStatus(i._statusKey) === statusFilter);
    return filtered;
  };

  const currentItems = viewTab === 'passengers' ? filterItems(passengers) : viewTab === 'packages' ? filterItems(packages) : [];
  const allForStats = viewTab === 'passengers' ? passengers : packages;
  const statsBase = isUnifiedView && routeFilter !== 'all' ? allForStats.filter((i) => i._sourceRoute === routeFilter) : allForStats;

  const stats = {
    total: statsBase.length,
    inProgress: statsBase.filter((i) => getStatus(i._statusKey) === 'in-progress').length,
    completed: statsBase.filter((i) => getStatus(i._statusKey) === 'completed').length,
    cancelled: statsBase.filter((i) => getStatus(i._statusKey) === 'cancelled').length,
  };

  const routeTabs = isUnifiedView
    ? [{ name: 'all', label: 'Усі', count: (viewTab === 'passengers' ? passengers : packages).length },
       ...routes.map((r) => ({ name: r.name, label: r.name, count: (viewTab === 'passengers' ? passengers : packages).filter((i) => i._sourceRoute === r.name).length }))]
    : [];

  const filters: { key: StatusFilter; label: string; count: number; pill: string; pillActive: string }[] = [
    { key: 'all', label: 'Усі', count: stats.total, pill: 'bg-gray-100 text-gray-600', pillActive: 'bg-gray-800 text-white' },
    { key: 'in-progress', label: 'В роботі', count: stats.inProgress, pill: 'bg-blue-50 text-blue-400', pillActive: 'bg-blue-500 text-white' },
    { key: 'completed', label: 'Готово', count: stats.completed, pill: 'bg-emerald-50 text-emerald-400', pillActive: 'bg-emerald-500 text-white' },
    { key: 'cancelled', label: 'Скас.', count: stats.cancelled, pill: 'bg-red-50 text-red-400', pillActive: 'bg-red-500 text-white' },
  ];

  const HeaderIcon = isUnifiedView ? BarChart3 : Package;

  // Top level tabs: Пасажири | Посилки
  const mainTabs: { key: ViewTab; label: string; icon: typeof Users; count: number }[] = [
    { key: 'passengers', label: 'Пасажири', icon: Users, count: passengers.length },
    { key: 'packages', label: 'Посилки', icon: Package, count: packages.length },
  ];
  // Посилки mode: sub-tabs Отримання | Відправка (only if shipping exists)
  const isPackagesMode = viewTab === 'packages' || viewTab === 'shipping';
  const activeMainTab = isPackagesMode ? 'packages' : 'passengers';
  const handleMainTab = (key: ViewTab) => { setViewTab(key); };

  return (
    <div className="flex-1 flex flex-col bg-bg max-h-dvh overflow-hidden">
      <div className="bg-white border-b border-border px-4 pt-4 pb-3 shrink-0">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <button onClick={goBack} className="p-2 -ml-2 rounded-xl hover:bg-bg cursor-pointer active:scale-95 transition-all">
              <ArrowLeft className="w-5 h-5 text-text" />
            </button>
            <div className="flex items-center gap-2">
              <HeaderIcon className="w-5 h-5 text-brand" />
              <span className="text-sm font-bold text-text">{isUnifiedView ? 'Усі маршрути' : currentSheet}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setShowColumnEditor(true)} className="p-2 rounded-xl hover:bg-bg cursor-pointer active:scale-95 transition-all">
              <Settings className="w-5 h-5 text-muted" />
            </button>
            <button onClick={() => loadData()} className="p-2 rounded-xl hover:bg-bg cursor-pointer active:scale-95 transition-all">
              <RefreshCw className={`w-5 h-5 text-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Main tabs: Пасажири / Посилки */}
        <div className="flex gap-1.5 mb-2">
          {mainTabs.map((t) => (
            <button key={t.key} onClick={() => handleMainTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold text-center cursor-pointer transition-all ${
                activeMainTab === t.key ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-500'
              }`}>
              <t.icon className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />{t.label}
              <span className="ml-1 font-black">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Sub-tabs for packages: Отримання / Відправка */}
        {isPackagesMode && hasShipping && (
          <div className="flex gap-1.5 mb-2">
            <button onClick={() => setViewTab('packages')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold text-center cursor-pointer transition-all ${viewTab === 'packages' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
              <Package className="w-3 h-3 inline mr-1 -mt-0.5" />Отримання
            </button>
            <button onClick={() => setViewTab('shipping')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold text-center cursor-pointer transition-all ${viewTab === 'shipping' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
              <Truck className="w-3 h-3 inline mr-1 -mt-0.5" />Відправка
            </button>
          </div>
        )}

        {/* Status pills (not for shipping) */}
        {viewTab !== 'shipping' && (
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

        {/* Route tabs for unified */}
        {isUnifiedView && viewTab !== 'shipping' && routeTabs.length > 0 && (
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
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-brand animate-spin mb-3" />
            <p className="text-muted text-sm">Завантаження...</p>
          </div>
        ) : viewTab === 'shipping' ? (
          shippingItems.length === 0 ? <Empty /> : shippingItems.map((item, i) => (
            <ShippingCard key={`ship_${item.rowNum}_${i}`} item={item} index={i} />
          ))
        ) : viewTab === 'passengers' ? (
          currentItems.length === 0 ? <Empty /> : (currentItems as Passenger[]).map((p, i) => (
            <PassengerCard key={p._statusKey} passenger={p} index={i} />
          ))
        ) : (
          currentItems.length === 0 ? <Empty /> : (currentItems as Pkg[]).map((p, i) => (
            <PackageCard key={p._statusKey} pkg={p} index={i} />
          ))
        )}
      </div>

      {showColumnEditor && <ColumnEditor onClose={() => setShowColumnEditor(false)} />}
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
