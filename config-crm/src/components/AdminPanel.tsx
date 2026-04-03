import { useState, useEffect, useCallback } from 'react';
import { Users, ScrollText, Wifi, LogOut, RefreshCw } from 'lucide-react';
import { Logo, apiCall, type AuthUser, type StaffMember, type RouteAccess, type LogEntry, type OnlineUser } from './shared';
import { StaffTab } from './StaffTab';
import { LogTab } from './LogTab';
import { OnlineTab } from './OnlineTab';

type Tab = 'staff' | 'log' | 'online';

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'staff', label: 'Персонал', icon: Users },
  { key: 'log', label: 'Лог доступів', icon: ScrollText },
  { key: 'online', label: 'Хто онлайн', icon: Wifi },
];

export function AdminPanel({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('staff');
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [access, setAccess] = useState<RouteAccess[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, accessRes, logRes, onlineRes] = await Promise.all([
        apiCall('getStaff'),
        apiCall('getRouteAccess'),
        apiCall('getAccessLog'),
        apiCall('getOnlineUsers'),
      ]);
      if (staffRes.success) setStaff(staffRes.staff || []);
      if (accessRes.success) setAccess(accessRes.access || []);
      if (logRes.success) setLogs((logRes.logs || []).reverse());
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
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <button onClick={loadAll}
              className="p-2 rounded-xl hover:bg-bg cursor-pointer transition-all" title="Оновити все">
              <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-text">{user.name}</div>
              <div className="text-[10px] text-muted">{user.role}</div>
            </div>
            <button onClick={onLogout}
              className="p-2 rounded-xl hover:bg-red-50 cursor-pointer transition-all group">
              <LogOut className="w-4 h-4 text-muted group-hover:text-red-500 transition-colors" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="sticky top-[57px] z-30 bg-white/80 backdrop-blur-xl border-b border-border px-4">
        <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto no-scrollbar py-2">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${active ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-bg'}`}>
                <Icon className="w-4 h-4" />
                {t.label}
                {t.key === 'online' && onlineCount > 0 && (
                  <span className={`ml-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${active ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600'}`}>
                    {onlineCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-center py-20 text-muted text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
              Завантаження даних...
            </div>
          ) : (
            <>
              {tab === 'staff' && <StaffTab staff={staff} access={access} onReload={loadAll} />}
              {tab === 'log' && <LogTab logs={logs} onReload={loadAll} />}
              {tab === 'online' && <OnlineTab users={onlineUsers} onReload={loadAll} />}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-muted/50 py-4 font-medium">
        <span className="text-text/40 font-bold">Boti</span><span className="text-success/40 font-bold">Logistics</span> Config v1.0
      </footer>
    </div>
  );
}
