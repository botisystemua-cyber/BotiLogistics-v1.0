import { useState, useEffect, useCallback } from 'react';
import { Users, Wifi, RefreshCw, ExternalLink, DollarSign, Menu, X } from 'lucide-react';
import { Logo, apiCall, type StaffMember, type RouteAccess, type OnlineUser } from './shared';
import { StaffTab } from './StaffTab';
import { OnlineTab } from './OnlineTab';

type Tab = 'staff' | 'online' | 'finances' | 'crm';

const MENU_ITEMS: { key: Tab; label: string; icon: typeof Users; external?: string }[] = [
  { key: 'staff', label: 'Співробітники', icon: Users },
  { key: 'online', label: 'Онлайн', icon: Wifi },
  { key: 'finances', label: 'Фінанси', icon: DollarSign },
  { key: 'crm', label: 'CRM', icon: ExternalLink, external: '/passenger-crm/Passengers.html' },
];

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('staff');
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [access, setAccess] = useState<RouteAccess[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-[100dvh] flex">
      {/* ═══ Sidebar — desktop ═══ */}
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col bg-white border-r border-border sticky top-0 h-[100dvh]">
        <div className="px-5 py-5 border-b border-border">
          <Logo size="sm" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            const active = !item.external && tab === item.key;
            return (
              <button key={item.key} onClick={() => handleTabClick(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all ${active ? 'bg-brand text-white shadow-sm' : 'text-text-secondary hover:bg-bg'}`}>
                <Icon className="w-5 h-5" />
                {item.label}
                {item.key === 'online' && onlineCount > 0 && (
                  <span className={`ml-auto w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${active ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600'}`}>
                    {onlineCount}
                  </span>
                )}
                {item.external && <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-40" />}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-border">
          <button onClick={loadAll}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-muted hover:bg-bg cursor-pointer transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Оновити
          </button>
        </div>
        <div className="px-5 pb-4 text-[10px] text-muted/50 font-medium">
          <span className="text-text/40 font-bold">Boti</span><span className="text-success/40 font-bold">Logistics</span> Owner v1.0
        </div>
      </aside>

      {/* ═══ Mobile header ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <button onClick={loadAll} className="p-2 rounded-xl hover:bg-bg cursor-pointer">
              <RefreshCw className={`w-5 h-5 text-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-xl hover:bg-bg cursor-pointer">
              {mobileMenuOpen ? <X className="w-5 h-5 text-text" /> : <Menu className="w-5 h-5 text-text" />}
            </button>
          </div>
        </header>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-border px-4 py-3 space-y-1 animate-[fadeIn_0.15s_ease-out]">
            {MENU_ITEMS.map(item => {
              const Icon = item.icon;
              const active = !item.external && tab === item.key;
              return (
                <button key={item.key} onClick={() => handleTabClick(item)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all ${active ? 'bg-brand text-white' : 'text-text-secondary hover:bg-bg'}`}>
                  <Icon className="w-5 h-5" />
                  {item.label}
                  {item.key === 'online' && onlineCount > 0 && (
                    <span className={`ml-auto w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${active ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600'}`}>
                      {onlineCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          {loading ? (
            <div className="text-center py-24 text-muted">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-4" />
              <span className="text-base">Завантаження даних...</span>
            </div>
          ) : (
            <>
              {tab === 'staff' && <StaffTab staff={staff} access={access} onReload={loadAll} />}
              {tab === 'online' && <OnlineTab users={onlineUsers} onReload={loadAll} />}
              {tab === 'finances' && (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="text-center">
                    <DollarSign className="w-16 h-16 text-muted/30 mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-black text-text/30">Фінанси</h2>
                    <p className="text-lg text-muted mt-2">Поки що недоступні</p>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
