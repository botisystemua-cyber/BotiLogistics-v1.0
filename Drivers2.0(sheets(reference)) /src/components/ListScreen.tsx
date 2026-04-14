import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, RefreshCw, Package, Users, Truck, BarChart3,
  ListFilter, LayoutGrid, Search, X,
} from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { ThemeSplash } from './ThemeSplash';
import type { Theme } from '../store/useAppStore';
import { isUaEu, isEuUa } from '../utils/smsParser';
import { fetchPassengers, fetchPackages, fetchShippingItems, updateItemStatus } from '../api';
import { PassengerCard } from './PassengerCard';
import { PackageCard } from './PackageCard';
import { ShippingCard } from './ShippingCard';
import { ColumnEditor } from './ColumnEditor';
import { BottomNav } from './BottomNav';
import { AddItemModal } from './AddItemModal';
import { EditItemModal } from './EditItemModal';
import type { Passenger, Package as Pkg, ShippingItem, ItemStatus, StatusFilter, ViewTab, RouteItem } from '../types';

export function ListScreen() {
  const {
    currentSheet, isUnifiedView, goBack, showToast, setCurrentScreen,
    statusFilter, setStatusFilter, getStatus, setStatus,
    routeFilter, setRouteFilter, routes, shippingRoutes,
    viewTab, setViewTab, driverName,
    theme, setTheme,
  } = useApp();

  const [splashTheme, setSplashTheme] = useState<Theme | null>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const THEME_LIST: { key: Theme; label: string; emoji: string }[] = [
    { key: 'top-driver', label: 'ТОП Водій', emoji: '👑' },
    { key: 'lone-wolf', label: 'Вовк-одинак', emoji: '🐺' },
    { key: 'detonator', label: 'Підривник', emoji: '💣' },
    { key: 'lightning', label: 'Блискавка', emoji: '⚡' },
  ];
  const pickTheme = (t: Theme) => {
    setThemeMenuOpen(false);
    if (t === theme) return;
    setSplashTheme(t);
    setTheme(t);
  };

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [shippingItems, setShippingItems] = useState<ShippingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedTabs, setLoadedTabs] = useState<Set<ViewTab>>(new Set());
  const [showColumnEditor, setShowColumnEditor] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<RouteItem | null>(null);
  const [convertingPickup, setConvertingPickup] = useState<Pkg | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hidingCompleted, setHidingCompleted] = useState(false);

  const routeNum = currentSheet.replace('Маршрут_', '');
  const shippingSheetName = shippingRoutes.find((s) => s.name === 'Відправка_' + routeNum)?.name || '';
  const hasShipping = !!shippingSheetName || isUnifiedView;

  const isPackagesMode = viewTab === 'packages' || viewTab === 'shipping' || viewTab === 'allPackages' || viewTab === 'pkgUaEu' || viewTab === 'pkgEuUa';
  const isPassengersMode = viewTab === 'passengers' || viewTab === 'paxUaEu' || viewTab === 'paxEuUa';
  const activeMainTab: 'all' | 'passengers' | 'packages' = viewTab === 'all' ? 'all' : isPackagesMode ? 'packages' : isPassengersMode ? 'passengers' : 'passengers';

  // Load data for current tab only
  const loadCurrentTab = useCallback(async (tab: ViewTab, force = false) => {
    const tabsToLoad: ViewTab[] = tab === 'all' ? ['passengers', 'packages', 'shipping']
      : tab === 'allPackages' ? ['packages', 'shipping']
      : (tab === 'paxUaEu' || tab === 'paxEuUa') ? ['passengers']
      : (tab === 'pkgUaEu' || tab === 'pkgEuUa') ? ['packages']
      : [tab];
    const needsLoad = tabsToLoad.some((t) => force || !loadedTabs.has(t));
    if (!needsLoad) return;

    setLoading(true);
    try {
      const tasks: Promise<void>[] = [];

      for (const loadTab of tabsToLoad) {
        if (!force && loadedTabs.has(loadTab)) continue;

        if (loadTab === 'passengers') {
          tasks.push((async () => {
            if (isUnifiedView && routes.length > 0) {
              const results = await Promise.allSettled(routes.map((route) => fetchPassengers(route.name).then((items) => items.map((p) => ({ ...p, _sourceRoute: route.name })))));
              const all = results.flatMap((r) => r.status === 'fulfilled' ? r.value : []);
              all.forEach((p, i) => { p._statusKey = `pax_${p.itemId}_${p._sourceRoute}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
              setPassengers(all);
            } else if (!isUnifiedView) {
              const items = await fetchPassengers(currentSheet);
              items.forEach((p, i) => { p._statusKey = `pax_${p.itemId}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
              setPassengers(items);
            }
            setLoadedTabs((prev) => new Set(prev).add('passengers'));
          })());
        } else if (loadTab === 'packages') {
          tasks.push((async () => {
            if (isUnifiedView && routes.length > 0) {
              const results = await Promise.allSettled(routes.map((route) => fetchPackages(route.name).then((items) => items.map((p) => ({ ...p, _sourceRoute: route.name })))));
              const all = results.flatMap((r) => r.status === 'fulfilled' ? r.value : []);
              all.forEach((p, i) => { p._statusKey = `pkg_${p.itemId}_${p._sourceRoute}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
              setPackages(all);
            } else if (!isUnifiedView) {
              const items = await fetchPackages(currentSheet);
              items.forEach((p, i) => { p._statusKey = `pkg_${p.itemId}_${i}`; if (p.status && p.status !== 'pending') setStatus(p._statusKey, p.status as ItemStatus); });
              setPackages(items);
            }
            setLoadedTabs((prev) => new Set(prev).add('packages'));
          })());
        } else if (loadTab === 'shipping') {
          tasks.push((async () => {
            if (isUnifiedView && routes.length > 0) {
              const shipTasks = routes.map((route) => {
                const num = route.name.replace('Маршрут_', '');
                const sName = shippingRoutes.find((s) => s.name === 'Відправка_' + num)?.name;
                if (!sName) return Promise.resolve([]);
                return fetchShippingItems(sName).then((items) => items.map((s) => ({ ...s, _sourceRoute: route.name }))).catch(() => [] as ShippingItem[]);
              });
              const results = await Promise.all(shipTasks);
              const all = results.flat();
              all.forEach((s, i) => { s._statusKey = `ship_${s.dispatchId || s.rowNum}_${s._sourceRoute}_${i}`; if (s.status && s.status !== 'pending') setStatus(s._statusKey, s.status as ItemStatus); });
              setShippingItems(all);
            } else if (shippingSheetName) {
              const items = await fetchShippingItems(shippingSheetName);
              items.forEach((s, i) => { s._statusKey = `ship_${s.dispatchId || s.rowNum}_${i}`; if (s.status && s.status !== 'pending') setStatus(s._statusKey, s.status as ItemStatus); });
              setShippingItems(items);
            }
            setLoadedTabs((prev) => new Set(prev).add('shipping'));
          })());
        }
      }

      await Promise.all(tasks);
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

  const filteredPassengersAll = searchIn(filterItems(passengers), ['name', 'phone', 'addrFrom', 'addrTo', 'itemId']);
  const filteredPassengers = viewTab === 'paxUaEu' ? filteredPassengersAll.filter((p) => isUaEu(p.direction))
    : viewTab === 'paxEuUa' ? filteredPassengersAll.filter((p) => isEuUa(p.direction))
    : filteredPassengersAll;
  const filteredPackagesAll = searchIn(filterItems(packages), ['recipientName', 'recipientPhone', 'senderName', 'recipientAddr', 'ttn', 'itemId']);
  const filteredPackages = viewTab === 'pkgUaEu' ? filteredPackagesAll.filter((p) => isUaEu(p.direction))
    : viewTab === 'pkgEuUa' ? filteredPackagesAll.filter((p) => isEuUa(p.direction))
    : filteredPackagesAll;
  const filteredShipping = searchIn(filterItems(shippingItems), ['senderName', 'recipientName', 'recipientPhone', 'recipientAddr', 'dispatchId']);
  // У табі "Усі": ховаємо виконані та записи Відправки (їх видно тільки в Посилки→Відправка)
  const allTabPassengers = statusFilter === 'completed' ? filteredPassengers : filteredPassengers.filter((p) => getStatus(p._statusKey) !== 'completed');
  const allTabPackages = statusFilter === 'completed' ? filteredPackages : filteredPackages.filter((p) => getStatus(p._statusKey) !== 'completed');
  const allTabTotal = allTabPassengers.length + allTabPackages.length;

  const prevAllTotalRef = useRef(allTabTotal);
  useEffect(() => {
    if (viewTab === 'all' && allTabTotal < prevAllTotalRef.current) {
      setHidingCompleted(true);
      const t = setTimeout(() => setHidingCompleted(false), 500);
      prevAllTotalRef.current = allTabTotal;
      return () => clearTimeout(t);
    }
    prevAllTotalRef.current = allTabTotal;
  }, [allTabTotal, viewTab]);
  const currentItems = isPassengersMode || viewTab === 'all' ? filteredPassengers : viewTab === 'packages' ? filteredPackages : [];

  // Stats
  const allStatsItems: { _statusKey: string; _sourceRoute?: string }[] = viewTab === 'all'
    ? [...passengers, ...packages]
    : viewTab === 'allPackages' ? [...packages, ...shippingItems]
    : viewTab === 'shipping' ? shippingItems
    : viewTab === 'paxUaEu' ? passengers.filter((p) => isUaEu(p.direction))
    : viewTab === 'paxEuUa' ? passengers.filter((p) => isEuUa(p.direction))
    : viewTab === 'pkgUaEu' ? packages.filter((p) => isUaEu(p.direction))
    : viewTab === 'pkgEuUa' ? packages.filter((p) => isEuUa(p.direction))
    : viewTab === 'passengers' ? passengers : packages;
  const statsBase = isUnifiedView && routeFilter !== 'all'
    ? allStatsItems.filter((i) => i._sourceRoute === routeFilter) : allStatsItems;

  const stats = {
    total: statsBase.length,
    inProgress: statsBase.filter((i) => getStatus(i._statusKey) === 'in-progress').length,
    completed: statsBase.filter((i) => getStatus(i._statusKey) === 'completed').length,
    cancelled: statsBase.filter((i) => getStatus(i._statusKey) === 'cancelled').length,
  };

  const countSource: { _sourceRoute?: string }[] = viewTab === 'all' ? [...passengers, ...packages] : viewTab === 'allPackages' ? [...packages, ...shippingItems] : viewTab === 'shipping' ? shippingItems : viewTab === 'passengers' ? passengers : packages;
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
              <button
                onClick={() => setThemeMenuOpen(true)}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer active:scale-90 transition-transform"
                title="Змінити тему"
              >
                <ThemeBadge theme={theme} unified={isUnifiedView} />
              </button>
              <span className="text-sm font-bold text-text">{isUnifiedView ? 'Усі маршрути' : currentSheet}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5 min-w-0 flex-1 max-w-[180px]">
            <Search className="w-3.5 h-3.5 text-muted shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук..."
              className="flex-1 text-[11px] text-text placeholder:text-gray-300 bg-transparent focus:outline-none min-w-0"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-0.5 rounded-md hover:bg-gray-200 cursor-pointer">
                <X className="w-3 h-3 text-muted" />
              </button>
            )}
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-2 mb-2.5">
          {mainTabs.map((t) => (
            <button key={t.key} onClick={() => setViewTab(t.key)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-center cursor-pointer transition-all ${
                activeMainTab === t.key ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
              }`}>
              <t.icon className="w-4 h-4 inline mr-1.5 -mt-0.5" />{t.label}
            </button>
          ))}
        </div>

        {/* Sub-tabs: УК→ЄВ | ЄВ→УК | Відправка */}
        {isPackagesMode && (
          <div className="flex items-center gap-1 mb-2 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewTab('pkgUaEu')}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold text-center cursor-pointer transition-all ${viewTab === 'pkgUaEu' ? 'bg-white text-text shadow-sm' : 'text-gray-400'}`}>
              🇺🇦→🇪🇺 УК-ЄВ
            </button>
            <button onClick={() => setViewTab('pkgEuUa')}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold text-center cursor-pointer transition-all ${viewTab === 'pkgEuUa' ? 'bg-white text-text shadow-sm' : 'text-gray-400'}`}>
              🇪🇺→🇺🇦 ЄВ-УК
            </button>
            {hasShipping && (
              <button onClick={() => setViewTab('shipping')}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold text-center cursor-pointer transition-all ${viewTab === 'shipping' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>
                <Truck className="w-3 h-3 inline mr-1 -mt-0.5" />Відправка
              </button>
            )}
          </div>
        )}

        {/* Sub-tabs: Усі | UA→EU | EU→UA */}
        {isPassengersMode && (
          <div className="flex items-center gap-1 mb-2 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewTab('passengers')}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold text-center cursor-pointer transition-all ${viewTab === 'passengers' ? 'bg-white text-text shadow-sm' : 'text-gray-400'}`}>
              <LayoutGrid className="w-3 h-3 inline mr-1 -mt-0.5" />Усі
            </button>
            <button onClick={() => setViewTab('paxUaEu')}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold text-center cursor-pointer transition-all ${viewTab === 'paxUaEu' ? 'bg-white text-text shadow-sm' : 'text-gray-400'}`}>
              🇺🇦→🇪🇺 УК-ЄВР
            </button>
            <button onClick={() => setViewTab('paxEuUa')}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold text-center cursor-pointer transition-all ${viewTab === 'paxEuUa' ? 'bg-white text-text shadow-sm' : 'text-gray-400'}`}>
              🇪🇺→🇺🇦 ЄВР-УК
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
                    <PackageCard key={p._statusKey} pkg={p} index={i} searchQuery={searchQuery} onEdit={setEditItem} onConvertPickup={setConvertingPickup} />
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
                    <ShippingCard key={item._statusKey || `ship_${item.rowNum}_${i}`} item={item} index={i} onEdit={setEditItem} />
                  ))}
                </>
              )}
            </>
          )
        ) : showShipping ? (
          filteredShipping.length === 0 ? <Empty /> : filteredShipping.map((item, i) => (
            <ShippingCard key={item._statusKey || `ship_${item.rowNum}_${i}`} item={item} index={i} onEdit={setEditItem} />
          ))
        ) : showAllTab ? (
          hidingCompleted ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="w-7 h-7 text-brand animate-spin mb-3" />
              <p className="text-muted text-sm">Оновлення...</p>
            </div>
          ) : (allTabPassengers.length === 0 && allTabPackages.length === 0) ? <Empty /> : (
            <>
              {allTabPassengers.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-1">
                    <Users className="w-4 h-4 text-brand" />
                    <span className="text-xs font-bold text-text">Пасажири</span>
                    <span className="text-[10px] font-bold text-muted bg-gray-100 px-2 py-0.5 rounded-full">{allTabPassengers.length}</span>
                  </div>
                  {allTabPassengers.map((p, i) => (
                    <PassengerCard key={p._statusKey} passenger={p} index={i} searchQuery={searchQuery} onEdit={setEditItem} />
                  ))}
                </>
              )}
              {allTabPackages.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-1 mt-2">
                    <Package className="w-4 h-4 text-brand" />
                    <span className="text-xs font-bold text-text">Посилки</span>
                    <span className="text-[10px] font-bold text-muted bg-gray-100 px-2 py-0.5 rounded-full">{allTabPackages.length}</span>
                  </div>
                  {allTabPackages.map((p, i) => (
                    <PackageCard key={p._statusKey} pkg={p} index={i} searchQuery={searchQuery} onEdit={setEditItem} onConvertPickup={setConvertingPickup} />
                  ))}
                </>
              )}
            </>
          )
        ) : isPassengersMode ? (
          currentItems.length === 0 ? <Empty /> : (currentItems as Passenger[]).map((p, i) => (
            <PassengerCard key={p._statusKey} passenger={p} index={i} searchQuery={searchQuery} onEdit={setEditItem} />
          ))
        ) : (
          currentItems.length === 0 ? <Empty /> : (currentItems as Pkg[]).map((p, i) => (
            <PackageCard key={p._statusKey} pkg={p} index={i} searchQuery={searchQuery} onEdit={setEditItem} onConvertPickup={setConvertingPickup} />
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
      {showAddModal && <AddItemModal onClose={() => setShowAddModal(false)} onAdded={refresh} defaultType="посилка" />}
      {convertingPickup && (
        <AddItemModal
          onClose={() => setConvertingPickup(null)}
          onAdded={async () => {
            const pkg = convertingPickup;
            const rn = isUnifiedView && pkg._sourceRoute ? pkg._sourceRoute : currentSheet;
            setStatus(pkg._statusKey, 'completed');
            try { await updateItemStatus(driverName, rn, pkg, 'completed'); }
            catch { /* status already set locally */ }
            showToast('Відправку створено, посилку закрито');
            refresh();
          }}
          defaultType="посилка"
          forceShipping
          prefill={{
            senderName: convertingPickup.senderName,
            senderPhone: convertingPickup.senderPhone || convertingPickup.phone,
            addrFrom: convertingPickup.addrFrom,
            pkgDesc: convertingPickup.pkgDesc,
            city: convertingPickup.city,
            recipientName: convertingPickup.recipientName,
            recipientPhone: convertingPickup.recipientPhone,
            recipientAddr: convertingPickup.recipientAddr,
            pkgWeight: convertingPickup.pkgWeight,
            amount: convertingPickup.amount,
            currency: convertingPickup.currency,
          }}
        />
      )}
      {editItem && <EditItemModal item={editItem} onClose={() => setEditItem(null)} onSaved={refresh} />}
      {splashTheme && <ThemeSplash theme={splashTheme} onDone={() => setSplashTheme(null)} />}
      {themeMenuOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setThemeMenuOpen(false)}
        >
          <div
            className="bg-card w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl"
            style={{ animation: 'slideUp 0.25s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text">Оформлення</span>
              <button onClick={() => setThemeMenuOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer">
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>
            <div className="space-y-2">
              {THEME_LIST.map((t) => {
                const active = t.key === theme;
                return (
                  <button
                    key={t.key}
                    onClick={() => pickTheme(t.key)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 cursor-pointer active:scale-[0.98] transition-all ${
                      active ? 'border-brand bg-brand/10' : 'border-border bg-bg hover:border-brand/40'
                    }`}
                  >
                    <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-card shrink-0">
                      <ThemeBadge theme={t.key} unified={false} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-bold text-text">{t.emoji} {t.label}</div>
                    </div>
                    {active && <div className="w-2 h-2 rounded-full bg-brand" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeBadge({ theme, unified }: { theme: Theme; unified: boolean }) {
  if (unified) return <BarChart3 className="w-5 h-5 text-brand" />;
  if (theme === 'detonator') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#ffd500" stroke="#d40511" strokeWidth="1.5" />
        <text x="12" y="16" fontSize="9" fontWeight="900" fill="#d40511" textAnchor="middle">DHL</text>
      </svg>
    );
  }
  if (theme === 'lightning') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#de2329" stroke="#7a0e12" strokeWidth="1.2" />
        <path d="M13,4 L7,13 L11,13 L9,20 L17,10 L13,10 L15,4 Z" fill="#fff" />
      </svg>
    );
  }
  if (theme === 'lone-wolf') {
    // Stylized wolf head silhouette
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="wolfGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e0e0e8" />
            <stop offset="100%" stopColor="#7a7a82" />
          </linearGradient>
        </defs>
        <path
          d="M4,11 L2,7 L5,8 L6,4 L9,7 L12,3 L15,7 L18,4 L19,8 L22,7 L20,11 L21,15 L18,19 L15,21 L12,20 L9,21 L6,19 L3,15 Z"
          fill="url(#wolfGrad)"
          stroke="#4a4a52"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        <circle cx="9.5" cy="13" r="1" fill="#0a0a0c" />
        <circle cx="14.5" cy="13" r="1" fill="#0a0a0c" />
        <path d="M11,16 L12,17 L13,16" stroke="#0a0a0c" strokeWidth="0.8" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  // top-driver — stylized hex with car icon
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="hexGrad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <path
        d="M12,2 L21,7 L21,17 L12,22 L3,17 L3,7 Z"
        fill="url(#hexGrad)"
        stroke="#0f6b30"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M7,14 L8.5,10 L15.5,10 L17,14 Z"
        fill="#fff"
        opacity="0.95"
      />
      <circle cx="9" cy="15" r="1.2" fill="#0f1f12" />
      <circle cx="15" cy="15" r="1.2" fill="#0f1f12" />
    </svg>
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
