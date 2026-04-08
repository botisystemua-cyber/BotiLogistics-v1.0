import { useMemo, useState } from 'react';
import {
  RefreshCw, Pencil, Trash2, X, Save, UserPlus,
  Truck as TruckIcon, Users as UsersIcon, ShieldCheck, UserCog,
} from 'lucide-react';
import {
  createUserForTenant, updateUser, deleteUser,
  type User, type Role,
} from '../api/users';

type RoleFilter = 'all' | Role;

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Власник',
  manager: 'Менеджер',
  driver: 'Водій',
};

const FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'Всі' },
  { key: 'owner', label: 'Власники' },
  { key: 'manager', label: 'Менеджери' },
  { key: 'driver', label: 'Водії' },
];

function roleIcon(role: Role, size = 'w-5 h-5', isFounder = false) {
  if (role === 'owner') {
    return isFounder ? <ShieldCheck className={size} /> : <UserCog className={size} />;
  }
  if (role === 'manager') return <UsersIcon className={size} />;
  return <TruckIcon className={size} />;
}

function roleBg(role: Role) {
  if (role === 'owner') return 'bg-violet-50 text-violet-600 border-violet-200';
  if (role === 'manager') return 'bg-blue-50 text-blue-600 border-blue-200';
  return 'bg-emerald-50 text-emerald-600 border-emerald-200';
}

type FormState = {
  login: string;
  password: string;
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  login: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  role: 'driver',
  is_active: true,
};

function userToForm(u: User): FormState {
  return {
    login: u.login ?? '',
    password: u.password ?? '',
    full_name: u.full_name ?? '',
    email: u.email ?? '',
    phone: u.phone ?? '',
    role: u.role,
    is_active: u.is_active ?? true,
  };
}

// Friendly error mapping. Supabase/Postgres returns "duplicate key value violates
// unique constraint ..." — surface that as a plain message instead of raw SQL.
function humanizeError(e: unknown): string {
  const msg = (e as Error)?.message || String(e || '');
  if (/duplicate key/i.test(msg) || /users_login_key/i.test(msg) || /unique constraint/i.test(msg)) {
    return 'Користувач з таким логіном вже існує. Оберіть інший логін.';
  }
  return msg || 'Невідома помилка';
}

export function StaffTab({
  users, tenantId, currentUserLogin, onReload,
}: {
  users: User[];
  tenantId: string;
  currentUserLogin: string;
  onReload: () => void;
}) {
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [editItem, setEditItem] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Founder = first-created owner of this tenant. Can never be deleted (by anyone,
  // including themselves). Other owners are deletable, but still can't delete themselves.
  const founderId = useMemo(() => {
    const owners = users
      .filter(u => u.role === 'owner')
      .slice()
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    return owners[0]?.id ?? null;
  }, [users]);

  const filtered = filter === 'all' ? users : users.filter(u => u.role === filter);
  const countByRole = (r: Role) => users.filter(u => u.role === r).length;

  const handleSave = async (form: FormState) => {
    const payload = {
      login: form.login.trim(),
      password: form.password.trim(),
      full_name: form.full_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      is_active: form.is_active,
    };
    try {
      if (isNew) {
        await createUserForTenant(tenantId, payload);
      } else if (editItem) {
        await updateUser(editItem.id, payload);
      }
      setEditItem(null);
      onReload();
    } catch (e) {
      alert('Помилка: ' + humanizeError(e));
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === founderId) {
      alert('Неможливо видалити першого власника. Його може змінити лише супер-адмін у config-crm.');
      return;
    }
    if (u.login === currentUserLogin) {
      alert('Ви не можете видалити власний обліковий запис.');
      return;
    }
    if (!confirm(`Видалити користувача ${u.full_name || u.login}?`)) return;
    try {
      await deleteUser(u.id);
      onReload();
    } catch (e) {
      alert('Помилка: ' + humanizeError(e));
    }
  };

  return (
    <div className="space-y-3 lg:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 lg:gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg lg:rounded-xl text-xs lg:text-sm font-bold cursor-pointer transition-all ${filter === f.key ? 'bg-brand text-white' : 'bg-white text-muted border border-border hover:bg-bg'}`}>
              {f.label}
              {f.key !== 'all' && (
                <span className="ml-0.5 opacity-60">({countByRole(f.key as Role)})</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditItem({} as User); setIsNew(true); }}
          className="flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg lg:rounded-xl bg-brand text-white text-xs lg:text-sm font-bold cursor-pointer hover:brightness-110 transition-all"
        >
          <UserPlus className="w-4 h-4 lg:w-5 lg:h-5" /> Додати
        </button>
      </div>

      {/* Users list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 lg:py-16 text-muted text-sm lg:text-base">Немає співробітників</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-4">
          {filtered.map(u => {
            const isFounder = u.id === founderId;
            const isSelf = u.login === currentUserLogin;
            const deleteLocked = isFounder || isSelf;
            const deleteTitle = isFounder
              ? 'Першого власника видалити неможливо'
              : isSelf
                ? 'Не можна видалити власний обліковий запис'
                : 'Видалити';
            return (
            <div
              key={u.id}
              className={`rounded-xl lg:rounded-2xl border overflow-hidden shadow-sm ${
                isFounder ? 'bg-violet-50/40 border-violet-200' : 'bg-white border-border'
              }`}
            >
              <div className="p-3 lg:p-5 flex items-center gap-3 lg:gap-4">
                <div className={`w-10 h-10 lg:w-14 lg:h-14 rounded-lg lg:rounded-xl flex items-center justify-center shrink-0 ${roleBg(u.role)}`}>
                  {roleIcon(u.role, 'w-4 h-4 lg:w-5 lg:h-5', isFounder)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 lg:gap-2 flex-wrap">
                    <span className="text-sm lg:text-base font-bold text-text truncate">
                      {u.full_name || <span className="italic text-muted">без імені</span>}
                    </span>
                    <span className={`text-[10px] lg:text-xs font-bold px-2 lg:px-2.5 py-0.5 rounded-full border ${roleBg(u.role)}`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                    {isSelf && (
                      <span className="text-[10px] lg:text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                        Це ви
                      </span>
                    )}
                    {u.is_active === false && (
                      <span className="text-[10px] lg:text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                        Неактивний
                      </span>
                    )}
                  </div>
                  <div className="text-xs lg:text-sm text-muted mt-0.5 lg:mt-1 truncate">
                    <span className="font-mono">{u.login}</span>
                    {u.phone && <span className="ml-2 lg:ml-3">{u.phone}</span>}
                    {u.email && <span className="ml-2 lg:ml-3 truncate">{u.email}</span>}
                  </div>
                  {u.last_login && (
                    <div className="text-[10px] lg:text-xs text-muted/60 mt-0.5 lg:mt-1">
                      Останній вхід: {new Date(u.last_login).toLocaleString('uk-UA')}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 lg:gap-1.5 shrink-0">
                  <button onClick={() => { setEditItem(u); setIsNew(false); }}
                    className="p-1.5 lg:p-2.5 rounded-lg lg:rounded-xl hover:bg-blue-50 cursor-pointer transition-all">
                    <Pencil className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={deleteLocked}
                    title={deleteTitle}
                    className={`p-1.5 lg:p-2.5 rounded-lg lg:rounded-xl transition-all ${
                      deleteLocked
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:bg-red-50 cursor-pointer'
                    }`}
                  >
                    <Trash2 className="w-4 h-4 lg:w-5 lg:h-5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {editItem && (
        <UserModal
          initial={isNew ? EMPTY_FORM : userToForm(editItem)}
          isNew={isNew}
          existingRole={isNew ? null : editItem.role}
          onClose={() => setEditItem(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function UserModal({
  initial, isNew, existingRole, onClose, onSave,
}: {
  initial: FormState;
  isNew: boolean;
  existingRole: Role | null;
  onClose: () => void;
  onSave: (f: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  // Owner role editing rules:
  //   - When creating new: any role allowed, including another owner.
  //   - When editing existing owner: role is locked (can't demote). Only a
  //     super-admin in config-crm can flip an owner to non-owner.
  //   - When editing non-owner: can freely switch between driver/manager, but
  //     can't promote them to owner via edit (create a new owner record instead).
  const isExistingOwner = existingRole === 'owner';
  const canEditRole = !isExistingOwner;
  const availableRoles: Role[] = isNew ? ['driver', 'manager', 'owner'] : ['driver', 'manager'];

  const submit = async () => {
    if (!form.login.trim() || !form.password.trim()) {
      alert('Логін і пароль обов’язкові');
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 lg:px-6 pt-5 lg:pt-6 pb-3 lg:pb-4 border-b border-border shrink-0">
          <h2 className="text-lg lg:text-xl font-extrabold text-text">
            {isNew ? 'Новий співробітник' : 'Редагувати'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-4 lg:py-5 space-y-3 lg:space-y-4">
          {/* Role toggle */}
          <div>
            <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1.5 lg:mb-2">
              Роль {isExistingOwner && <span className="text-violet-600">(заблоковано)</span>}
            </label>
            <div className={`grid ${availableRoles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
              {availableRoles.map(role => {
                const active = form.role === role;
                const Icon = role === 'driver' ? TruckIcon : role === 'manager' ? UsersIcon : ShieldCheck;
                const activeClass =
                  role === 'driver'  ? 'bg-emerald-500 text-white shadow-sm' :
                  role === 'manager' ? 'bg-blue-500 text-white shadow-sm' :
                                       'bg-violet-500 text-white shadow-sm';
                return (
                  <button
                    key={role}
                    onClick={() => canEditRole && set('role', role)}
                    disabled={!canEditRole}
                    className={`flex items-center justify-center gap-2 py-2.5 lg:py-3 rounded-xl text-sm font-bold transition-all ${
                      active ? activeClass : 'bg-bg text-muted border border-border hover:bg-white'
                    } ${canEditRole ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                  >
                    <Icon className="w-4 h-4 lg:w-5 lg:h-5" />
                    {ROLE_LABEL[role]}
                  </button>
                );
              })}
            </div>
            {isExistingOwner && (
              <div className="mt-2 text-[11px] text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                Роль «Власник» може змінити лише супер-адмін у config-crm.
              </div>
            )}
          </div>

          <F label="ПІБ" value={form.full_name} onChange={v => set('full_name', v)} autoFocus />
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <F label="Телефон" value={form.phone} onChange={v => set('phone', v)} type="tel" />
            <F label="Email" value={form.email} onChange={v => set('email', v)} type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <F label="Логін" value={form.login} onChange={v => set('login', v)} />
            <F label="Пароль" value={form.password} onChange={v => set('password', v)} />
          </div>
          <label className="flex items-center gap-3 px-4 py-3 bg-bg rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="w-5 h-5 accent-brand cursor-pointer"
            />
            <span className="text-sm font-bold text-text">Активний</span>
          </label>
        </div>

        <div className="px-5 lg:px-6 py-4 lg:py-5 border-t border-border shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-3 lg:py-4 rounded-2xl bg-brand text-white font-bold text-sm lg:text-base flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-all disabled:opacity-40"
          >
            {saving ? <RefreshCw className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" /> : <Save className="w-4 h-4 lg:w-5 lg:h-5" />}
            {saving ? 'Збереження...' : isNew ? 'Додати' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

function F({
  label, value, onChange, type, autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1 lg:mb-1.5">{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-bg border border-border rounded-xl text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand transition-all"
      />
    </div>
  );
}
