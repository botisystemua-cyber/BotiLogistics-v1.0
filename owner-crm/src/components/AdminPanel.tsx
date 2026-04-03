import { useState, useEffect, useCallback } from 'react';
import { Users, Wifi, RefreshCw, ExternalLink } from 'lucide-react';
import { Logo, apiCall, type StaffMember, type RouteAccess, type OnlineUser } from './shared';
import { StaffTab } from './StaffTab';
import { OnlineTab } from './OnlineTab';

type Tab = 'staff' | 'online';

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'staff', label: 'Персонал', icon: Users },
  { key: 'online', label: 'Онлайн', icon: Wifi },
];

const CRM_URL = '/passenger-crm/Passengers.html';

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('staff');
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [access, setAccess] = useState<RouteAccess[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, accessRes, onlineRes] = await Promise.all([
        apiCall('getStaff'),
        apiCall('getRouteAccess'),
        apiCall('getOnlineUsers'),
      ]);
      if (staffRes.success) setStaff(staffRes.staff || []);
      if (accessRes.success) setAccess(accessRes.access || []);
      if (onlineRes.success) setOnlineUsers(onlineRes.users || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh online every 30s
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await apiCall('getOnlineUsers');
        if (res.success) setOnlineUsers(res.users || []);
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const onlineCount = onlineUsers.filter(u => u.isOnline).length;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <Logo size="md" />
          <button onClick={loadAll}
            className="p-2.5 rounded-xl hover:bg-bg cursor-pointer transition-all" title="Оновити все">
            <RefreshCw className={`w-5 h-5 text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="sticky top-[65px] z-30 bg-white/80 backdrop-blur-xl border-b border-border px-4 sm:px-6">
        <div className="max-w-[1400px] mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-3">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap cursor-pointer transition-all ${active ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-bg'}`}>
                <Icon className="w-5 h-5" />
                {t.label}
                {t.key === 'online' && onlineCount > 0 && (
                  <span className={`ml-0.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${active ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600'}`}>
                    {onlineCount}
                  </span>
                )}
              </button>
            );
          })}

          {/* CRM button */}
          <a href={CRM_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap cursor-pointer transition-all bg-emerald-500 text-white shadow-sm hover:bg-emerald-600">
            <ExternalLink className="w-5 h-5" />
            CRM
          </a>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 py-5 sm:py-6">
        <div className="max-w-[1400px] mx-auto">
          {loading ? (
            <div className="text-center py-24 text-muted">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-4" />
              <span className="text-base">Завантаження даних...</span>
            </div>
          ) : (
            <>
              {tab === 'staff' && <StaffTab staff={staff} access={access} onReload={loadAll} />}
              {tab === 'online' && <OnlineTab users={onlineUsers} onReload={loadAll} />}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-muted/50 py-5 font-medium">
        <span className="text-text/40 font-bold">Boti</span><span className="text-success/40 font-bold">Logistics</span> Owner v1.0
      </footer>
    </div>
  );
}
