import { useState, useEffect, useCallback } from 'react';
import { MapPin, DollarSign } from 'lucide-react';
import { RoutePointsPanel } from './RoutePointsPanel';
import { RoutePricesPanel } from './RoutePricesPanel';
import {
  listRoutePointsByTenant,
  listRoutePricesByTenant,
  type RoutePoint,
  type RoutePrice,
} from '../api/routes';

type SubTab = 'points' | 'prices';

const SUB_TABS: { key: SubTab; label: string; icon: typeof MapPin }[] = [
  { key: 'points', label: 'Точки маршруту', icon: MapPin },
  { key: 'prices', label: 'Ціни', icon: DollarSign },
];

export function SettingsTab({ tenantId }: { tenantId: string }) {
  const [sub, setSub] = useState<SubTab>('points');
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [prices, setPrices] = useState<RoutePrice[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [pts, prc] = await Promise.all([
        listRoutePointsByTenant(tenantId),
        listRoutePricesByTenant(tenantId),
      ]);
      setPoints(pts);
      setPrices(prc);
    } catch (e) {
      console.error('Settings load error', e);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="space-y-3 lg:space-y-5">
      {/* Sub-tab switcher */}
      <div className="flex gap-1.5 lg:gap-2">
        {SUB_TABS.map(t => {
          const Icon = t.icon;
          const active = sub === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSub(t.key)}
              className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg lg:rounded-xl text-xs lg:text-sm font-bold cursor-pointer transition-all ${
                active
                  ? 'bg-brand text-white'
                  : 'bg-white text-muted border border-border hover:bg-bg'
              }`}
            >
              <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted text-sm">Завантаження...</div>
      ) : (
        <>
          {sub === 'points' && (
            <RoutePointsPanel
              points={points}
              tenantId={tenantId}
              onReload={reload}
            />
          )}
          {sub === 'prices' && (
            <RoutePricesPanel
              prices={prices}
              points={points}
              tenantId={tenantId}
              onReload={reload}
            />
          )}
        </>
      )}
    </div>
  );
}
