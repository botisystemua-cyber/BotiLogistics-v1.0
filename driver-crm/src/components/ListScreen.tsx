import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Package, Users, Truck, BarChart3,
  ListFilter, LayoutGrid, Search, X,
} from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { fetchPassengers, fetchPackages, fetchShippingItems } from '../api';
import { PassengerCard } from './PassengerCard';
import { PackageCard } from './PackageCard';
import { ShippingCard } from './ShippingCard';
import { ColumnEditor } from './ColumnEditor';
import { BottomNav } from './BottomNav';
import { AddItemModal } from './AddItemModal';
import type { Passenger, Package as Pkg, ShippingItem, ItemStatus, StatusFilter, ViewTab } from '../types';

export function ListScreen() {
  const {
    currentSheet, isUnifiedView, goBack, showToast, setCurrentScreen,
    statusFilter, setStatusFilter, getStatus, setStatus,
    routeFilter, setRouteFilter, routes, shippingRoutes,
    viewTab, setViewTab,
  } = useApp();

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [shippingItems, setShippingItems] = useState<ShippingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedTabs, setLoadedTabs] = useState<Set<ViewTab>>(new Set());
  const [showColumnEditor, setShowColumnEditor] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const routeNum = currentSheet.replace('Маршрут_', '');
  const shippingSheetName = shippingRoutes.find((s) => s.name === 'Відправка_' + routeNum)?.name || '';
  const hasShipping = !!shippingSheetName || isUnifiedView;

  const isPackagesMode = viewTab === 'packages' || viewTab === 'shipping' || viewTab === 'allPackages';
  const activeMainTab: 'all' | 'passengers' | 'packages' = viewTab === 'all' ? 'all' : isPackagesMode ? 'packages' : 'passengers';

  // Load data for current tab only
  const loadCurrentTab = useCallback(async (tab: ViewTab, force = false) => {
    const tabsToLoad: ViewTab[] = tab === 'all' ? ['passengers', 'packages', 'shipping'] : tab === 'allPackages' ? ['packages', 'shipping'] : [tab];
    const needsLoad = tabsToLoad.some((t) => force || !loadedTabs.has(t));
    if (!needsLoad) return;

    setLoading(true);
    try {
      for (const loadTab of tabsToLoad) {
        if (!force && loadedTabs.has(loadTab)) continue;

        if (loadTab === 'passengers') {
          if (isUnifiedView && routes.length > 0) {
            const all: Passenger[] = [];
            for (const route of routes) {
              try {
                const items = await fetchPassengers(route.name);
                all.push(...items.map((p) => ({ ...p, _sourceRoute: route.name })));
              } catch { /* skip failed route */ }
            }
            all.forEach((p, i) => { p._statusKey = `pax_${p.itemId}_${p._sourceRoute}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
            setPassengers(all);
          } else if (!isUnifiedView) {
            const items = await fetchPassengers(currentSheet);
            items.forEach((p, i) => { p._statusKey = `pax_${p.itemId}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
            setPassengers(items);
          }
        } else if (loadTab === 'packages') {
          if (isUnifiedView && routes.length > 0) {
            const all: Pkg[] = [];
            for (const route of routes) {
              try {
                const items = await fetchPackages(route.name);
                all.push(...items.map((p) => ({ ...p, _sourceRoute: route.name })));
              } catch { /* skip failed route */ }
            }
            all.forEach((p, i) => { p._statusKey = `pkg_${p.itemId}_${p._sourceRoute}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
            setPackages(all);
          } else if (!isUnifiedView) {
            const items = await fetchPackages(currentSheet);
            items.forEach((p, i) => { p._statusKey = `pkg_${p.itemId}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
            setPackages(items);
          }
        } else if (loadTab === 'shipping') {
          if (isUnifiedView && routes.length > 0) {
            const all: ShippingItem[] = [];
            for (let ri = 0; ri < routes.length; ri++) {
              const routeName = routes[ri].name;
              const sName = shippingRoutes.find((s) => s.name === 'Відправка_' + (ri + 1))?.name;
              if (!sName) continue;
              try {
                const items = await fetchShippingItems(sName);
                all.push(...items.map((s) => ({ ...s, _sourceRoute: routeName })));
              } catch { /* skip */ }
            }
            all.forEach((s, i) => { s._statusKey = `ship_${s.dispatchId || s.rowNum}_${s._sourceRoute}_${i}`; if (s.status && s.status !== 'pending') setStatus(s._statusKey, s.status as ItemStatus); });
            setShippingItems(all);
          } else if (shippingSheetName) {
            const items = await fetchShippingItems(shippingSheetName);
            items.forEach((s, i) => { s._statusKey = `ship_${s.dispatchId || s.rowNum}_${i}`; if (s.status && s.status !== 'pending') setStatus(s._statusKey, s.status as ItemStatus); });
            setShippingItems(items);
          }
        }

        setLoadedTabs((prev) => new Set(prev).add(loadTab));
      }
      if (tab === 'all') showToast('Завантажено усе');
      else if (tab === 'passengers') showToast('Завантажено пасажирів');
      else if (tab === 'packages') showToast('Завантажено посилок');
      else if (tab === 'shipping') showToast('Відправлення завантажено');
      else if (tab === 'allPackages') showToast('Завантажено посилки та відправлення');
    } catch (err) { showToast('Помилка: ' + (err as Error).message); }
    finally { setLoading(false); }
  }, [currentSheet, isUnifiedView, shippingSheetName, loadedTabs, routes, shippingRoutes, setStatus, showToast]);

  useEffect(() => { loadCurrentTab(viewTab); }, [viewTab, loadCurrentTab]);

  const refresh = () => {
    setLoadedTabs(new Set());
    loadCurrentTab(viewTab, true);
  };

  // Filter
  const filterItems = <T extends { _statusKey: string; _sourceRoute?: string }>(items: T[]): T[] => {
    let filtered = items;
    if (isUnifiedView && routeFilter !== 'all') filtered = filtered.filter((i) => i._sourceRoute === routeFilter);
    if (statusFilter !== 'all') filtered = filtered.filter((i) => getStatus(i._statusKey) === statusFilter);
    return filtered;
  };

  const q = searchQuery.toLowerCase().trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchIn = <T,>(items: T[], fields: string[]): T[] => {
    if (!q) return items;
    return items.filter((item) => fields.some((f) => String((item as any)[f] || '').toLowerCase().includes(q)));
  };

  const filteredPassengers = searchIn(filterItems(passengers), ['name', 'phone', 'addrFrom', 'addrTo', 'itemId']);
  const filteredPackages = searchIn(filterItems(packages), ['recipientName', 'recipientPhone', 'senderName', 'recipientAddr', 'ttn', 'itemId']);
  const filteredShipping = searchIn(filterItems(shippingItems), ['senderName', 'recipientName', 'recipientPhone', 'recipientAddr', 'dispatchId']);
  const currentItems = viewTab === 'passengers' || viewTab === 'all' ? filteredPassengers : viewTab === 'packages' ? filteredPackages : [];

  // Stats
  const allStatsItems: { _statusKey: string; _sourceRoute?: string }[] = viewTab === 'all'
    ? [...passengers, ...packages, ...shippingItems]
    : viewTab === 'allPackages' ? [...packages, ...shippingItems]
    : viewTab === 'shipping' ? shippingItems
    : viewTab === 'passengers' ? passengers : packages;
  const statsBase = isUnifiedView && routeFilter !== 'all'
    ? allStatsItems.filter((i) => i._sourceRoute === routeFilter) : allStatsItems;

  const stats = {
    total: statsBase.length,
    inProgress: statsBase.filter((i) => getStatus(i._statusKey) === 'in-progress').length,
    completed: statsBase.filter((i) => getStatus(i._statusKey) === 'completed').length,
    cancelled: statsBase.filter((i) => getStatus(i._statusKey) === 'cancelled').length,
  };

  const countSource: { _sourceRoute?: string }[] = viewTab === 'all' ? [...passengers, ...packages, ...shippingItems] : viewTab === 'allPackages' ? [...packages, ...shippingItems] : viewTab === 'shipping' ? shippingItems : viewTab === 'passengers' ? passengers : packages;
  const routeTabs = isUnifiedView
    ? [{ name: 'all', label: 'Усі', count: countSource.length },
       ...routes.map((r) => ({ name: r.name, label: r.name.replace('Маршрут_', 'М'), count: countSource.filter((i) => i._sourceRoute === r.name).length }))]
    : [];

  const filters: { key: StatusFilter; label: string; count: number; pill: string; pillActive: string }[] = [
    { key: 'all', label: 'Усі', count: stats.total, pill: 'bg-gray-100 text-gray-600', pillActive: 'bg-gray-800 text-white' },
    { key: 'in-progress', label: 'В роботі', count: stats.inProgress, pill: 'bg-blue-50 text-blue-400', pillActive: 'bg-blue-500 text-white' },
    { key: 'completed', label: 'Готово', count: stats.completed, pill: 'bg-emerald-50 text-emerald-400', pillActive: 'bg-emerald-500 text-white' },
    { key: 'cancelled', label: 'Скас.', count: stats.cancelled, pill: 'bg-red-50 text-red-400', pillActive: 'bg-red-500 text-white' },
  ];

  const mainTabs: { key: 'all' | 'passengers' | 'packages'; label: string; icon: typeof Users }[] = [
    { key: 'all', label: 'Усі', icon: LayoutGrid },
    { key: 'passengers', label: 'Пасажири', icon: Users },
    { key: 'packages', label: 'Посилки', icon: Package },
  ];

  const showShipping = viewTab === 'shipping';
  const showAllTab = viewTab === 'all';
  const showAllPackages = viewTab === 'allPackages';

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
              {isUnifiedView ? <BarChart3 className="w-5 h-5 text-brand" /> : <Package className="w-5 h-5 text-brand" />}
              <span className="text-sm font-bold text-text">{isUnifiedView ? 'Усі маршрути' : currentSheet}</span>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-2.5">
          <Search className="w-4 h-4 text-muted shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук: ім'я, телефон, адреса..."
            className="flex-1 text-xs text-text placeholder:text-gray-300 bg-transparent focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-0.5 rounded-md hover:bg-gray-200 cursor-pointer">
              <X className="w-3.5 h-3.5 text-muted" />
            </button>
          )}
        </div>

        {/* Main tabs */}
        <div className="flex gap-2 mb-2.5">
          {mainTabs.map((t) => (
            <button key={t.key} onClick={() => setViewTab(t.key === 'packages' && hasShipping ? 'allPackages' : t.key)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-center cursor-pointer transition-all ${
                activeMainTab === t.key ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
              }`}>
              <t.icon className="w-4 h-4 inline mr-1.5 -mt-0.5" />{t.label}
            </button>
          ))}
        </div>

        {/* Sub-tabs: Усі | Отримання | Відправка */}
        {isPackagesMode && hasShipping && (
          <div className="flex items-center gap-1 mb-2 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewTab('allPackages')}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold text-center cursor-pointer transition-all ${viewTab === 'allPackages' ? 'bg-white text-text shadow-sm' : 'text-gray-400'}`}>
              <LayoutGrid className="w-3 h-3 inline mr-1 -mt-0.5" />Усі
            </button>
            <button onClick={() => setViewTab('packages')}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold text-center cursor-pointer transition-all ${viewTab === 'packages' ? 'bg-white text-text shadow-sm' : 'text-gray-400'}`}>
              <Package className="w-3 h-3 inline mr-1 -mt-0.5" />Отримання
            </button>
            <button onClick={() => setViewTab('shipping')}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold text-center cursor-pointer transition-all ${viewTab === 'shipping' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>
              <Truck className="w-3 h-3 inline mr-1 -mt-0.5" />Відправка
            </button>
          </div>
        )}

        {/* Status pills */}
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

        {/* Route tabs for unified */}
        {isUnifiedView && routeTabs.length > 0 && (
          <div className="flex gap-1.5 mt-2.5 justify-center overflow-x-auto pb-0.5 -mx-1 px-1">
            {routeTabs.map((tab) => {
              const isAll = tab.name === 'all';
              return (
                <button key={tab.name} onClick={() => setRouteFilter(tab.name)}
                  className={`shrink-0 rounded-full font-bold cursor-pointer transition-all ${
                    isAll ? 'min-w-[80px] px-5 py-2 text-xs' : 'px-3 py-1.5 text-[10px]'
                  } ${
                    routeFilter === tab.name ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {tab.label} <span className="font-black">{tab.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-3 space-y-4">
        {loading && !loadedTabs.has(viewTab === 'all' ? 'passengers' : viewTab) ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-brand animate-spin mb-3" />
            <p className="text-muted text-sm">Завантаження...</p>
          </div>
        ) : showAllPackages ? (
          (filteredPackages.length === 0 && filteredShipping.length === 0) ? <Empty /> : (
            <>
              {filteredPackages.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-1">
                    <Package className="w-4 h-4 text-brand" />
                    <span className="text-xs font-bold text-text">Отримання</span>
                    <span className="text-[10px] font-bold text-muted bg-gray-100 px-2 py-0.5 rounded-full">{filteredPackages.length}</span>
                  </div>
                  {filteredPackages.map((p, i) => (
                    <PackageCard key={p._statusKey} pkg={p} index={i} searchQuery={searchQuery} />
                  ))}
                </>
              )}
              {filteredShipping.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-1 mt-2">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold text-text">Відправка</span>
                    <span className="text-[10px] font-bold text-muted bg-gray-100 px-2 py-0.5 rounded-full">{filteredShipping.length}</span>
                  </div>
                  {filteredShipping.map((item, i) => (
                    <ShippingCard key={item._statusKey || `ship_${item.rowNum}_${i}`} item={item} index={i} />
                  ))}
                </>
              )}
            </>
          )
        ) : showShipping ? (
          filteredShipping.length === 0 ? <Empty /> : filteredShipping.map((item, i) => (
            <ShippingCard key={item._statusKey || `ship_${item.rowNum}_${i}`} item={item} index={i} />
          ))
        ) : showAllTab ? (
          (filteredPassengers.length === 0 && filteredPackages.length === 0 && filteredShipping.length === 0) ? <Empty /> : (
            <>
              {filteredPassengers.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-1">
                    <Users className="w-4 h-4 text-brand" />
                    <span className="text-xs font-bold text-text">Пасажири</span>
                    <span className="text-[10px] font-bold text-muted bg-gray-100 px-2 py-0.5 rounded-full">{filteredPassengers.length}</span>
                  </div>
                  {filteredPassengers.map((p, i) => (
                    <PassengerCard key={p._statusKey} passenger={p} index={i} searchQuery={searchQuery} />
                  ))}
                </>
              )}
              {filteredPackages.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-1 mt-2">
                    <Package className="w-4 h-4 text-brand" />
                    <span className="text-xs font-bold text-text">Посилки</span>
                    <span className="text-[10px] font-bold text-muted bg-gray-100 px-2 py-0.5 rounded-full">{filteredPackages.length}</span>
                  </div>
                  {filteredPackages.map((p, i) => (
                    <PackageCard key={p._statusKey} pkg={p} index={i} searchQuery={searchQuery} />
                  ))}
                </>
              )}
              {filteredShipping.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-1 mt-2">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold text-text">Відправка</span>
                    <span className="text-[10px] font-bold text-muted bg-gray-100 px-2 py-0.5 rounded-full">{filteredShipping.length}</span>
                  </div>
                  {filteredShipping.map((item, i) => (
                    <ShippingCard key={item._statusKey || `ship_${item.rowNum}_${i}`} item={item} index={i} />
                  ))}
                </>
              )}
            </>
          )
        ) : viewTab === 'passengers' ? (
          currentItems.length === 0 ? <Empty /> : (currentItems as Passenger[]).map((p, i) => (
            <PassengerCard key={p._statusKey} passenger={p} index={i} searchQuery={searchQuery} />
          ))
        ) : (
          currentItems.length === 0 ? <Empty /> : (currentItems as Pkg[]).map((p, i) => (
            <PackageCard key={p._statusKey} pkg={p} index={i} searchQuery={searchQuery} />
          ))
        )}
      </div>

      {/* Bottom Nav */}
      <BottomNav
        onAdd={() => setShowAddModal(true)}
        onExpenses={() => setCurrentScreen('expenses')}
        onColumns={() => setShowColumnEditor(true)}
        onRefresh={refresh}
        loading={loading}
      />

      {/* Modals */}
      {showColumnEditor && <ColumnEditor onClose={() => setShowColumnEditor(false)} />}
      {showAddModal && <AddItemModal onClose={() => setShowAddModal(false)} onAdded={refresh} />}
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
