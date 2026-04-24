import { useState, useEffect, useCallback } from 'react';
import { RoutePointsPanel } from './RoutePointsPanel';
import { CurrenciesPanel } from './CurrenciesPanel';
import { listRoutePointsByTenant, type RoutePoint } from '../api/routes';
import {
  getCurrencySettings,
  DEFAULT_DEFAULT,
  DEFAULT_ENABLED,
  type CurrencySettings,
} from '../api/currencies';

export function SettingsTab({ tenantId }: { tenantId: string }) {
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [currencies, setCurrencies] = useState<CurrencySettings>({
    default: DEFAULT_DEFAULT,
    enabled: [...DEFAULT_ENABLED],
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [pts, cur] = await Promise.all([
        listRoutePointsByTenant(tenantId),
        getCurrencySettings(tenantId),
      ]);
      setPoints(pts);
      setCurrencies(cur);
    } catch (e) {
      console.error('Settings load error', e);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { reload(); }, [reload]);

  return loading ? (
    <div className="text-center py-16 text-muted text-sm">Завантаження...</div>
  ) : (
    <>
      <RoutePointsPanel points={points} tenantId={tenantId} onReload={reload} />
      <CurrenciesPanel tenantId={tenantId} settings={currencies} onReload={reload} />
    </>
  );
}
