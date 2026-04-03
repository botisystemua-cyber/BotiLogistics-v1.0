import { useState } from 'react';
import { RefreshCw, Plus, Pencil, Trash2, X, Save, UserPlus, Shield, Truck as TruckIcon, Users as UsersIcon, ChevronDown, MapPin } from 'lucide-react';
import { apiCall, type StaffMember, type RouteAccess } from './shared';

const EMPTY_STAFF: Omit<StaffMember, 'rowNum'> = {
  staffId: '', name: '', phone: '', email: '', role: 'Водій',
  login: '', password: '', city: '', autoId: '', autoNum: '',
  rate: '', rateCur: 'CHF', status: 'Активний', dateHired: '',
  lastActive: '', note: '',
};

const ROLES_FILTER = ['Всі', 'Водій', 'Менеджер'];
const CURRENCIES = ['UAH', 'EUR', 'CHF', 'PLN', 'USD'];

export function StaffTab({ staff, access, onReload }: {
  staff: StaffMember[];
  access: RouteAccess[];
  onReload: () => void;
}) {
  const [filter, setFilter] = useState('Всі');
  const [editItem, setEditItem] = useState<StaffMember | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddAccess, setShowAddAccess] = useState<string | null>(null); // staffName for adding access

  const filtered = filter === 'Всі' ? staff : staff.filter(s => s.role === filter);

  const getAccessForStaff = (s: StaffMember) =>
    access.filter(a => a.staffName === s.name || a.staffId === s.staffId);

  const handleSave = async (item: Omit<StaffMember, 'rowNum'> & { rowNum?: number }) => {
    const data = await apiCall(isNew ? 'addStaff' : 'updateStaff', { staff: item });
    if (data.success) { setEditItem(null); onReload(); }
    else alert('Помилка: ' + (data.error || ''));
  };

  const handleDelete = async (s: StaffMember) => {
    if (!confirm(`Видалити ${s.name}?`)) return;
    const data = await apiCall('deleteStaff', { staffId: s.staffId });
    if (data.success) onReload();
    else alert('Помилка: ' + (data.error || ''));
  };

  const handleDeleteAccess = async (a: RouteAccess) => {
    if (!confirm(`Видалити доступ до ${a.route}?`)) return;
    const data = await apiCall('deleteRouteAccess', { accessId: a.accessId });
    if (data.success) onReload();
    else alert('Помилка: ' + (data.error || ''));
  };

  const handleAddAccess = async (form: Record<string, string>) => {
    const data = await apiCall('addRouteAccess', { access: form });
    if (data.success) { setShowAddAccess(null); onReload(); }
    else alert('Помилка: ' + (data.error || ''));
  };

  const getRoleIcon = (role: string) => {
    if (role === 'Менеджер') return <UsersIcon className="w-4 h-4" />;
    if (role === 'Водій') return <TruckIcon className="w-4 h-4" />;
    return <Shield className="w-4 h-4" />;
  };

  const getRoleBg = (role: string) => {
    if (role === 'Менеджер') return 'bg-blue-50 text-blue-600 border-blue-200';
    if (role === 'Водій') return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    return 'bg-violet-50 text-violet-600 border-violet-200';
  };

  const getLevelBg = (level: string) => {
    if (level.includes('Повний')) return 'bg-violet-50 text-violet-600';
    if (level.includes('Запис')) return 'bg-blue-50 text-blue-600';
    return 'bg-gray-50 text-gray-600';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5">
          {ROLES_FILTER.map(r => (
            <button key={r} onClick={() => setFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${filter === r ? 'bg-brand text-white' : 'bg-white text-muted border border-border hover:bg-bg'}`}>
              {r} {r !== 'Всі' && <span className="ml-0.5 opacity-60">({staff.filter(s => s.role === r).length})</span>}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditItem({ ...EMPTY_STAFF, rowNum: 0 } as StaffMember); setIsNew(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand text-white text-xs font-bold cursor-pointer hover:brightness-110 transition-all">
          <UserPlus className="w-4 h-4" /> Додати
        </button>
      </div>

      {/* Staff list — grid on desktop */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted text-sm">Немає персоналу</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(s => {
            const staffAccess = getAccessForStaff(s);
            const isExpanded = expandedId === s.staffId;
            return (
              <div key={s.staffId || s.rowNum} className="bg-white rounded-2xl border border-border overflow-hidden">
                {/* Main card row */}
                <div className="p-4 flex items-center gap-3">
                  <div className={`w-11 h-11 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shrink-0 ${getRoleBg(s.role)}`}>
                    {getRoleIcon(s.role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-text truncate">{s.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBg(s.role)}`}>{s.role}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'Активний' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{s.status}</span>
                    </div>
                    <div className="text-xs text-muted mt-0.5 truncate">
                      {s.login && <span className="font-mono">{s.login}</span>}
                      {s.phone && <span className="ml-2">{s.phone}</span>}
                      {s.city && <span className="ml-2">{s.city}</span>}
                    </div>
                    {s.lastActive && <div className="text-[10px] text-muted/60 mt-0.5">Останній вхід: {s.lastActive}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : s.staffId)}
                      className="p-2 rounded-lg hover:bg-bg cursor-pointer transition-all" title="Доступи до маршрутів">
                      <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button onClick={() => { setEditItem(s); setIsNew(false); }}
                      className="p-2 rounded-lg hover:bg-blue-50 cursor-pointer transition-all">
                      <Pencil className="w-4 h-4 text-blue-500" />
                    </button>
                    <button onClick={() => handleDelete(s)}
                      className="p-2 rounded-lg hover:bg-red-50 cursor-pointer transition-all">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Expanded: route access */}
                {isExpanded && (
                  <div className="border-t border-border bg-bg/50 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Доступи до маршрутів ({staffAccess.length})
                      </span>
                      <button onClick={() => setShowAddAccess(s.name)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand text-white text-[10px] font-bold cursor-pointer hover:brightness-110 transition-all">
                        <Plus className="w-3 h-3" /> Додати
                      </button>
                    </div>
                    {staffAccess.length === 0 ? (
                      <div className="text-xs text-muted py-2">Немає доступів</div>
                    ) : (
                      staffAccess.map(a => (
                        <div key={a.accessId} className="bg-white rounded-xl border border-border p-2.5 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-text">{a.route}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getLevelBg(a.level)}`}>{a.level}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${a.status === 'Активний' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{a.status}</span>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteAccess(a)}
                            className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer transition-all shrink-0">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Staff Edit Modal */}
      {editItem && (
        <StaffModal item={editItem} isNew={isNew} onClose={() => setEditItem(null)} onSave={handleSave} />
      )}

      {/* Add Access Modal */}
      {showAddAccess && (
        <AddAccessModal staffName={showAddAccess} onClose={() => setShowAddAccess(null)} onSave={handleAddAccess} />
      )}
    </div>
  );
}

/* ── Staff Edit/Add Modal ── */
function StaffModal({ item, isNew, onClose, onSave }: {
  item: StaffMember;
  isNew: boolean;
  onClose: () => void;
  onSave: (s: Omit<StaffMember, 'rowNum'> & { rowNum?: number }) => void;
}) {
  const [form, setForm] = useState({ ...item });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof StaffMember, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.login.trim()) { alert('ПІБ та Логін обов\'язкові'); return; }
    setSaving(true);
    await onSave(isNew ? { ...form, rowNum: undefined as never } : form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <h2 className="text-lg font-extrabold text-text">{isNew ? 'Новий співробітник' : 'Редагувати'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg cursor-pointer"><X className="w-5 h-5 text-muted" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <F label="ПІБ" value={form.name} onChange={v => set('name', v)} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <F label="Телефон" value={form.phone} onChange={v => set('phone', v)} type="tel" />
            <F label="Email" value={form.email} onChange={v => set('email', v)} type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Роль</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                <option>Водій</option>
                <option>Менеджер</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Статус</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                <option>Активний</option>
                <option>Неактивний</option>
                <option>Звільнений</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Логін" value={form.login} onChange={v => set('login', v)} />
            <F label="Пароль" value={form.password} onChange={v => set('password', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Місто" value={form.city} onChange={v => set('city', v)} />
            <F label="Номер авто" value={form.autoNum} onChange={v => set('autoNum', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Ставка" value={form.rate} onChange={v => set('rate', v)} type="number" />
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Валюта</label>
              <div className="flex gap-1">
                {CURRENCIES.map(c => (
                  <button key={c} onClick={() => set('rateCur', c)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${form.rateCur === c ? 'bg-brand text-white' : 'bg-bg text-muted border border-border'}`}>{c}</button>
                ))}
              </div>
            </div>
          </div>
          <F label="Примітка" value={form.note} onChange={v => set('note', v)} />
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={submit} disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-all disabled:opacity-40">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Збереження...' : isNew ? 'Додати' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Route Access Modal ── */
function AddAccessModal({ staffName, onClose, onSave }: {
  staffName: string;
  onClose: () => void;
  onSave: (form: Record<string, string>) => void;
}) {
  const [form, setForm] = useState({
    staffName, role: 'Водій', route: '', level: 'Читання + Запис', status: 'Активний', note: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.route.trim()) { alert('Маршрут обов\'язковий'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <h2 className="text-base font-extrabold text-text">Новий доступ — {staffName}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg cursor-pointer"><X className="w-5 h-5 text-muted" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <F label="Маршрут" value={form.route} onChange={v => setForm(p => ({ ...p, route: v }))} autoFocus />
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Рівень доступу</label>
            <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand">
              <option>Читання</option><option>Читання + Запис</option><option>Повний</option>
            </select>
          </div>
          <F label="Примітка" value={form.note} onChange={v => setForm(p => ({ ...p, note: v }))} />
        </div>
        <div className="px-5 py-4 border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={submit} disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-all disabled:opacity-40">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Збереження...' : 'Додати'}
          </button>
        </div>
      </div>
    </div>
  );
}

function F({ label, value, onChange, type, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">{label}</label>
      <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} autoFocus={autoFocus}
        className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand transition-all" />
    </div>
  );
}
