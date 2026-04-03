import { RefreshCw, Wifi, WifiOff, Clock } from 'lucide-react';
import type { OnlineUser } from './shared';

export function OnlineTab({ users, onReload }: { users: OnlineUser[]; onReload: () => void }) {
  const online = users.filter(u => u.isOnline);
  const offline = users.filter(u => !u.isOnline);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-muted uppercase tracking-wider">{users.length} користувачів</span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {online.length} онлайн
          </span>
        </div>
        <button onClick={onReload} className="p-2 rounded-xl hover:bg-white cursor-pointer transition-all">
          <RefreshCw className="w-4 h-4 text-muted" />
        </button>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12 text-muted text-sm">Немає користувачів</div>
      ) : (
        <div className="space-y-4">
          {online.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider px-1">В мережі</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {online.map(u => <UserCard key={u.staffId} user={u} />)}
              </div>
            </div>
          )}
          {offline.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider px-1">Не в мережі</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {offline.map(u => <UserCard key={u.staffId} user={u} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserCard({ user }: { user: OnlineUser }) {
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 flex items-center gap-3 ${user.isOnline ? 'bg-green-50/50 border-green-200' : 'bg-white border-border'}`}>
      <div className="relative shrink-0">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${user.isOnline ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          {user.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${user.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-text">{user.name}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${user.role === 'Менеджер' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{user.role}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {user.city && <span className="text-xs text-muted">{user.city}</span>}
          {user.lastActive && (
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <Clock className="w-3 h-3" />
              {user.lastActive}
            </span>
          )}
        </div>
      </div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${user.isOnline ? 'text-green-600 bg-green-100' : 'text-gray-400 bg-gray-100'}`}>
        {user.isOnline ? 'Онлайн' : 'Офлайн'}
      </span>
    </div>
  );
}
