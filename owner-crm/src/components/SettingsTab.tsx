import { useState, useEffect, useCallback } from 'react';
import { RoutePointsPanel } from './RoutePointsPanel';
import { listRoutePointsByTenant, type RoutePoint } from '../api/routes';

export function SettingsTab({ tenantId }: { tenantId: string }) {
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPoints(await listRoutePointsByTenant(tenantId));
    } catch (e) {
      console.error('Settings load error', e);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { reload(); }, [reload]);

  return loading ? (
    <div className="text-center py-16 text-muted text-sm">Завантаження...</div>
  ) : (
    <RoutePointsPanel points={points} tenantId={tenantId} onReload={reload} />
  );
}
