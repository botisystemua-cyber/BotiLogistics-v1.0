import { useState, useEffect, useCallback } from 'react';
import { Users, Wifi, RefreshCw, ExternalLink, DollarSign } from 'lucide-react';
import { Logo, apiCall, type StaffMember, type RouteAccess, type OnlineUser } from './shared';
import { StaffTab } from './StaffTab';
import { OnlineTab } from './OnlineTab';

type Tab = 'staff' | 'online' | 'finances' | 'crm';

const MENU_ITEMS: { key: Tab; label: string; shortLabel: string; icon: typeof Users; external?: string }[] = [
  { key: 'staff', label: 'Співробітники', shortLabel: 'Команда', icon: Users },
  { key: 'online', label: 'Онлайн', shortLabel: 'Онлайн', icon: Wifi },
  { key: 'finances', label: 'Фінанси', shortLabel: 'Фінанси', icon: DollarSign },
  { key: 'crm', label: 'CRM', shortLabel: 'CRM', icon: ExternalLink, external: '/passenger-crm/Passengers.html' },
];

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

  const handleTabClick = (item: typeof MENU_ITEMS[0]) => {
    if (item.external) {
      window.open(item.external, '_blank');
      return;
    }
    setTab(item.key);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row">
      {/* ═══ Sidebar — desktop ═══ */}
      <aside className="hidden lg:flex w-[280px] shrink-0 flex-col bg-white border-r border-border sticky top-0 h-[100dvh]">
        <div className="px-6 py-6 border-b border-border">
          <Logo size="md" />
        </div>
        <nav className="flex-1 px-4 py-5 space-y-1.5">
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            const active = !item.external && tab === item.key;
            return (
              <button key={item.key} onClick={() => handleTabClick(item)}
                className={`w-full flex items-center gap-3.5 px-5 py-3.5 rounded-xl text-base font-bold cursor-pointer transition-all ${active ? 'bg-brand text-white shadow-sm' : 'text-text-secondary hover:bg-bg'}`}>
                <Icon className="w-5 h-5" />
                {item.label}
                {item.key === 'online' && onlineCount > 0 && (
                  <span className={`ml-auto min-w-[22px] h-[22px] rounded-full text-xs font-bold flex items-center justify-center px-1 ${active ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600'}`}>
                    {onlineCount}
                  </span>
                )}
                {item.external && <ExternalLink className="w-4 h-4 ml-auto opacity-40" />}
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-border">
          <button onClick={loadAll}
            className="w-full flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-bold text-muted hover:bg-bg cursor-pointer transition-all">
            <RefreshCw className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : ''}`} />
            Оновити все
          </button>
        </div>
        <div className="px-6 pb-5 text-xs text-muted/50 font-medium">
          <span className="text-text/40 font-bold">Boti</span><span className="text-success/40 font-bold">Logistics</span> Owner v1.0
        </div>
      </aside>

      {/* ═══ Main area ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content — with bottom padding for mobile tab bar */}
        <main className="flex-1 px-3 sm:px-4 lg:px-8 py-3 sm:py-4 lg:py-6 pb-[72px] lg:pb-6">
          {loading ? (
            <div className="text-center py-24 text-muted">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-4" />
              <span className="text-base">Завантаження...</span>
            </div>
          ) : (
            <>
              {tab === 'staff' && <StaffTab staff={staff} access={access} onReload={loadAll} />}
              {tab === 'online' && <OnlineTab users={onlineUsers} onReload={loadAll} />}
              {tab === 'finances' && (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="text-center">
                    <DollarSign className="w-16 h-16 lg:w-20 lg:h-20 text-muted/30 mx-auto mb-4" />
                    <h2 className="text-2xl lg:text-4xl font-black text-text/30">Фінанси</h2>
                    <p className="text-base lg:text-lg text-muted mt-2">Поки що недоступні</p>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ═══ Mobile bottom tab bar ═══ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-border px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around py-1.5">
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            const active = !item.external && tab === item.key;
            return (
              <button key={item.key} onClick={() => handleTabClick(item)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[60px] cursor-pointer transition-all ${active ? 'text-brand' : 'text-muted'}`}>
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.key === 'online' && onlineCount > 0 && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center bg-green-500 text-white">
                      {onlineCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
