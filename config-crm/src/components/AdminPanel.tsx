import { useEffect, useState } from 'react';
import {
  Users, UserCog, BarChart3, CreditCard, Settings, LogOut, Plus, Pencil, Trash2,
  Loader2, AlertCircle, X, Save, ShieldCheck, ChevronDown, ChevronRight,
  FlaskConical, Rocket,
} from 'lucide-react';
import { Logo } from './shared';
import {
  listClients, createClient, updateClient, deleteClient,
  promoteTenant, deleteTenantCascade,
  type Client, type ClientInput,
} from '../api/clients';
import {
  listUsers, createUser, updateUser, deleteUser, sortRoles,
  type User, type UserInput, type Role,
} from '../api/users';

type ClientsTab = 'main' | 'beta';

// Повертає інфо про бета-стан: скільки днів залишилось / чи прострочено.
function betaState(c: Client): { daysLeft: number | null; expired: boolean } {
  if (!c.is_beta || !c.beta_expires_at) return { daysLeft: null, expired: false };
  const ms = new Date(c.beta_expires_at).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  return { daysLeft: days, expired: days <= 0 };
}

type Section = 'clients' | 'users' | 'stats' | 'billing' | 'settings';
const ROLES: Role[] = ['owner', 'manager', 'driver'];
const ROLE_LABEL: Record<Role, string> = { owner: 'Власник', manager: 'Менеджер', driver: 'Водій' };

const ALL_MODULES = ['passenger', 'cargo', 'driver'] as const;
const MODULE_LABEL: Record<string, string> = {
  passenger: 'Пасажири',
  cargo: 'Посилки',
  driver: 'Водійська',
};

const TAG_PRESETS = ['Активний', 'Неактивний', 'SmartSender'] as const;
const TAG_STYLE: Record<string, string> = {
  'Активний':    'bg-teal-50 border-teal-200 text-teal-700',
  'Неактивний':  'bg-gray-100 border-gray-300 text-gray-500',
  'SmartSender': 'bg-blue-50 border-blue-200 text-blue-700',
};
const DEFAULT_TAG_STYLE = 'bg-violet-50 border-violet-200 text-violet-700';

export function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<Section>('clients');

  return (
    <div className="fixed inset-0 bg-bg flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r-2 border-border flex flex-col">
        <div className="p-5 border-b-2 border-border">
          <Logo size="md" />
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200">
            <ShieldCheck className="w-3 h-3 text-violet-600" />
            <span className="text-[10px] font-bold text-violet-700 uppercase">Admin</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavItem icon={Users} label="Клієнти" active={section === 'clients'} onClick={() => setSection('clients')} />
          <NavItem icon={UserCog} label="Користувачі" active={section === 'users'} onClick={() => setSection('users')} />
          <NavItem icon={BarChart3} label="Статистика" active={section === 'stats'} onClick={() => setSection('stats')} />
          <NavItem icon={CreditCard} label="Підписки" active={section === 'billing'} onClick={() => setSection('billing')} />
          <NavItem icon={Settings} label="Налаштування" active={section === 'settings'} onClick={() => setSection('settings')} />
        </nav>

        <button
          onClick={onLogout}
          className="m-3 px-4 py-3 rounded-xl border-2 border-border text-sm font-bold text-text-secondary hover:bg-bg hover:border-red-200 hover:text-error cursor-pointer transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Вийти
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 sm:p-8 overflow-auto">
        {section === 'clients' && <ClientsScreen />}
        {section === 'users' && <UsersScreen />}
        {section === 'stats' && <Placeholder title="Статистика" />}
        {section === 'billing' && <Placeholder title="Підписки" />}
        {section === 'settings' && <Placeholder title="Налаштування" />}
      </main>
    </div>
  );
}

function NavItem({
  icon: Icon, label, active, onClick,
}: { icon: typeof Users; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
        active
          ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20'
          : 'text-text-secondary hover:bg-bg'
      }`}
    >
      <Icon className="w-4.5 h-4.5" />
      {label}
    </button>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="bg-card border-2 border-border rounded-2xl p-12 text-center">
      <h2 className="text-2xl font-black text-text mb-2">{title}</h2>
      <p className="text-sm text-muted">Скоро буде</p>
    </div>
  );
}

// ─────────────── Clients Screen ───────────────

function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState<ClientsTab | null>(null);
  const [tab, setTab] = useState<ClientsTab>('main');

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      setClients(await listClients());
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleDelete = async (c: Client) => {
    if (c.is_beta) {
      const msg =
        `УВАГА: видалення бета-тенанта "${c.name}" (${c.tenant_id}) КАСКАДНО.\n\n` +
        `Буде видалено ВСЕ: пасажирів, посилки, маршрути, платежі, користувачів і т.д. — все, що має tenant_id="${c.tenant_id}".\n\n` +
        `Це НЕЗВОРОТНО. Продовжити?`;
      if (!confirm(msg)) return;
      try {
        const { total, breakdown } = await deleteTenantCascade(c.tenant_id);
        const details = Object.entries(breakdown)
          .map(([t, n]) => `  • ${t}: ${n}`)
          .join('\n');
        alert(`Видалено рядків: ${total}\n${details}`);
        await reload();
      } catch (e: unknown) {
        alert('Помилка: ' + (e as Error).message);
      }
      return;
    }

    if (!confirm(`Видалити клієнта "${c.name}" (${c.tenant_id})?\nЙого дані в routes/passengers НЕ будуть видалені.`)) return;
    try {
      await deleteClient(c.id);
      await reload();
    } catch (e: unknown) {
      alert('Помилка: ' + (e as Error).message);
    }
  };

  const handlePromote = async (c: Client) => {
    if (!confirm(`Перевести "${c.name}" з бета-версії в основну?\nДані збережуться, прапорець is_beta буде знято.`)) return;
    try {
      await promoteTenant(c.tenant_id);
      await reload();
    } catch (e: unknown) {
      alert('Помилка: ' + (e as Error).message);
    }
  };

  const mainClients = clients.filter((c) => !c.is_beta);
  const betaClients = clients.filter((c) => c.is_beta);
  const visible = tab === 'beta' ? betaClients : mainClients;

  const isBetaTab = tab === 'beta';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-3xl font-black text-text">Клієнти</h1>
          <p className="text-sm text-muted mt-1">Керування тенантами та доступом до модулів</p>
        </div>
        <button
          onClick={() => setCreating(tab)}
          className={`px-4 py-2.5 rounded-xl text-white text-sm font-bold flex items-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.97] cursor-pointer transition-all ${
            isBetaTab
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/20'
              : 'bg-gradient-to-r from-violet-500 to-purple-600 shadow-violet-500/20'
          }`}
        >
          <Plus className="w-4 h-4" />
          {isBetaTab ? 'Додати бета-клієнта' : 'Додати клієнта'}
        </button>
      </div>

      {/* Tabs: Main / Beta */}
      <div className="mb-5 inline-flex p-1 bg-bg border-2 border-border rounded-xl">
        <TabBtn
          active={tab === 'main'}
          onClick={() => setTab('main')}
          color="violet"
          icon={Users}
          label="Основна версія"
          count={mainClients.length}
        />
        <TabBtn
          active={tab === 'beta'}
          onClick={() => setTab('beta')}
          color="amber"
          icon={FlaskConical}
          label="Бета"
          count={betaClients.length}
        />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border-2 border-red-200 rounded-xl text-sm font-semibold text-error flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div>{error}</div>
            {error.includes('modules') ? (
              <div className="mt-1 text-xs font-normal text-red-700">
                Запусти SQL з <code className="bg-red-100 px-1 rounded">sql/2026-04-add-client-auth.sql</code> у Supabase Dashboard → SQL Editor.
              </div>
            ) : null}
            {error.includes('is_beta') || error.includes('beta_expires_at') ? (
              <div className="mt-1 text-xs font-normal text-red-700">
                Запусти SQL з <code className="bg-red-100 px-1 rounded">sql/2026-04-clients-beta-mode.sql</code> у Supabase Dashboard → SQL Editor.
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div
        className={`border-2 rounded-2xl overflow-hidden ${
          isBetaTab ? 'bg-amber-50/40 border-amber-200' : 'bg-card border-border'
        }`}
      >
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm">
            {isBetaTab ? 'Бета-клієнтів немає' : 'Клієнтів немає'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b-2 ${isBetaTab ? 'bg-amber-100/50 border-amber-200' : 'bg-bg border-border'}`}>
                <Th>Логін</Th>
                <Th>Назва компанії</Th>
                <Th>Модулі</Th>
                {isBetaTab && <Th>Термін</Th>}
                <Th className="text-right">Дії</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const st = betaState(c);
                return (
                  <tr
                    key={c.id}
                    className={`border-b last:border-0 ${
                      isBetaTab
                        ? 'border-amber-200 hover:bg-amber-100/40'
                        : 'border-border hover:bg-bg/50'
                    }`}
                  >
                    <Td><code className="font-mono text-xs font-bold">{c.tenant_id}</code></Td>
                    <Td>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{c.name}</span>
                        {(c.tags ?? []).map((t) => (
                          <span key={t} className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase leading-none ${TAG_STYLE[t] ?? DEFAULT_TAG_STYLE}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {(c.modules ?? []).filter((m) => MODULE_LABEL[m]).map((m) => (
                          <span key={m} className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 uppercase">
                            {MODULE_LABEL[m]}
                          </span>
                        ))}
                      </div>
                    </Td>
                    {isBetaTab && (
                      <Td>
                        {c.beta_expires_at ? (
                          st.expired ? (
                            <span className="px-2 py-0.5 rounded-md bg-red-100 border border-red-300 text-[10px] font-bold text-red-700 uppercase">
                              Прострочено
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${
                              (st.daysLeft ?? 0) <= 3
                                ? 'bg-orange-50 border-orange-300 text-orange-700'
                                : 'bg-amber-50 border-amber-300 text-amber-700'
                            }`}>
                              {st.daysLeft} дн.
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-muted">безстроково</span>
                        )}
                      </Td>
                    )}
                    <Td className="text-right">
                      <div className="inline-flex gap-2">
                        {c.is_beta && (
                          <IconBtn icon={Rocket} onClick={() => handlePromote(c)} title="Перевести в основну версію" tone="emerald" />
                        )}
                        <IconBtn icon={Pencil} onClick={() => setEditing(c)} title="Редагувати" />
                        <IconBtn icon={Trash2} onClick={() => handleDelete(c)} title={c.is_beta ? 'Видалити бета (каскадно)' : 'Видалити'} danger />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {(creating || editing) && (
        <ClientFormModal
          initial={editing}
          defaultBeta={!editing && creating === 'beta'}
          onClose={() => { setCreating(null); setEditing(null); }}
          onSaved={async () => { setCreating(null); setEditing(null); await reload(); }}
        />
      )}
    </div>
  );
}

function TabBtn({
  active, onClick, color, icon: Icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  color: 'violet' | 'amber';
  icon: typeof Users;
  label: string;
  count: number;
}) {
  const activeBg = color === 'amber'
    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20'
    : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20';
  const idleTxt = color === 'amber' ? 'text-amber-700 hover:bg-amber-50' : 'text-text-secondary hover:bg-card';
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all ${
        active ? activeBg : idleTxt
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
        active ? 'bg-white/20 text-white' : 'bg-bg border border-border text-muted'
      }`}>
        {count}
      </span>
    </button>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-text ${className}`}>{children}</td>;
}
function IconBtn({
  icon: Icon, onClick, title, danger, tone,
}: {
  icon: typeof Pencil;
  onClick: () => void;
  title: string;
  danger?: boolean;
  tone?: 'emerald';
}) {
  const cls =
    danger
      ? 'border-red-200 text-error hover:bg-red-50'
      : tone === 'emerald'
        ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300'
        : 'border-border text-text-secondary hover:bg-bg hover:border-violet-300 hover:text-violet-600';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all border-2 ${cls}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// ─────────────── Modal ───────────────

function ClientFormModal({
  initial, defaultBeta = false, onClose, onSaved,
}: { initial: Client | null; defaultBeta?: boolean; onClose: () => void; onSaved: () => void }) {
  const [tenantId, setTenantId] = useState(initial?.tenant_id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const LOGO_BASE = 'https://botisystem.com/BotiLogistics-v1.0/logos/';
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url || LOGO_BASE);
  const [modules, setModules] = useState<string[]>(initial?.modules ?? ['passenger']);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [isBeta, setIsBeta] = useState<boolean>(initial?.is_beta ?? defaultBeta);
  const [betaDays, setBetaDays] = useState<string>(() => {
    if (initial?.beta_expires_at) {
      const ms = new Date(initial.beta_expires_at).getTime() - Date.now();
      const d = Math.max(0, Math.ceil(ms / 86_400_000));
      return String(d);
    }
    return '10';
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleModule = (m: string) => {
    setModules((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  };

  const toggleTag = (t: string) => {
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  };

  const handleSave = async () => {
    if (!tenantId.trim() || !name.trim()) {
      setError('Tenant ID та Назва обов’язкові');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let betaExpiresAt: string | null = null;
      if (isBeta) {
        const n = parseInt(betaDays, 10);
        if (!Number.isFinite(n) || n < 0) {
          setError('Термін бети має бути числом днів (0 = без обмежень)');
          setSaving(false);
          return;
        }
        betaExpiresAt = n === 0 ? null : new Date(Date.now() + n * 86_400_000).toISOString();
      }

      const input: ClientInput = {
        tenant_id: tenantId.trim(),
        name: name.trim(),
        password: null,
        logo_url: logoUrl.trim() || null,
        modules,
        tags,
        is_beta: isBeta,
        beta_expires_at: betaExpiresAt,
      };
      if (initial) await updateClient(initial.id, input);
      else await createClient(input);
      onSaved();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className={`bg-card border-2 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-[scaleIn_0.2s_ease-out] ${
        isBeta ? 'border-amber-300' : 'border-border'
      }`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-text">{initial ? 'Редагувати клієнта' : 'Новий клієнт'}</h2>
            {isBeta && (
              <span className="px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-700 uppercase">
                Beta
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-bg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Логін (унікальний slug)">
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={!!initial}
              placeholder="gresco"
              className="w-full px-3 py-2.5 bg-bg border-2 border-border rounded-xl text-sm font-mono focus:outline-none focus:border-violet-400 disabled:opacity-50"
            />
          </Field>
          <Field label="Назва компанії">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gresco Express"
              className="w-full px-3 py-2.5 bg-bg border-2 border-border rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
          </Field>
          <Field label="Logo URL (опційно)">
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2.5 bg-bg border-2 border-border rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
          </Field>
          <Field label="Модулі">
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map((m) => {
                const on = modules.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleModule(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 cursor-pointer transition-all ${
                      on
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-bg border-border text-muted hover:border-emerald-200'
                    }`}
                  >
                    {MODULE_LABEL[m] ?? m}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Мітки">
            <div className="flex flex-wrap gap-2 mb-2">
              {TAG_PRESETS.map((t) => {
                const on = tags.includes(t);
                const style = TAG_STYLE[t] ?? DEFAULT_TAG_STYLE;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 cursor-pointer transition-all ${
                      on
                        ? style.replace(/border-\w+-200/g, (m) => m.replace('200', '400'))
                        : 'bg-bg border-border text-muted hover:border-gray-300'
                    }`}
                  >
                    {on ? '✓ ' : ''}{t}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Бета-доступ">
            <div className={`rounded-xl border-2 p-3 space-y-3 ${
              isBeta ? 'border-amber-300 bg-amber-50/50' : 'border-border bg-bg/60'
            }`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBeta}
                  onChange={(e) => setIsBeta(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm font-bold text-text">Тимчасовий бета-тенант</span>
              </label>
              {isBeta && (
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Термін дії (днів, 0 = без обмежень)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={betaDays}
                    onChange={(e) => setBetaDays(e.target.value)}
                    className="w-full px-3 py-2 bg-card border-2 border-amber-200 rounded-lg text-sm font-mono focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-muted mt-1.5">
                    Після закінчення терміну в списку з'явиться бейдж «Прострочено» — видалити каскадно або промоутнути можна вручну.
                  </p>
                </div>
              )}
            </div>
          </Field>
        </div>

        {error && (
          <div className="mt-4 px-3 py-2 bg-red-50 border-2 border-red-200 rounded-lg text-xs font-semibold text-error flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border-2 border-border text-sm font-bold text-text-secondary hover:bg-bg cursor-pointer"
          >
            Скасувати
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:brightness-110 disabled:opacity-50 cursor-pointer ${
              isBeta
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/20'
                : 'bg-gradient-to-r from-violet-500 to-purple-600 shadow-violet-500/20'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ─────────────── Users Screen ───────────────

function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const [u, c] = await Promise.all([listUsers(), listClients()]);
      setUsers(u);
      setClients(c);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleDelete = async (u: User) => {
    if (!confirm(`Видалити користувача "${u.full_name || u.login}"?`)) return;
    try {
      await deleteUser(u.id);
      await reload();
    } catch (e: unknown) {
      alert('Помилка: ' + (e as Error).message);
    }
  };

  const toggleGroup = (tid: string) =>
    setCollapsed((prev) => ({ ...prev, [tid]: !prev[tid] }));

  // Group users by tenant, keep client order
  const grouped = clients
    .map((c) => ({
      client: c,
      users: users.filter((u) => u.tenant_id === c.tenant_id),
    }))
    .filter((g) => g.users.length > 0);

  // Users with unknown tenant (shouldn't happen, but just in case)
  const knownTenants = new Set(clients.map((c) => c.tenant_id));
  const orphans = users.filter((u) => !knownTenants.has(u.tenant_id));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-text">Користувачі</h1>
          <p className="text-sm text-muted mt-1">Логіни співробітників прив'язані до компаній</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-violet-500/20 hover:brightness-110 active:scale-[0.97] cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          Додати користувача
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border-2 border-red-200 rounded-xl text-sm font-semibold text-error flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div>{error}</div>
            {error.toLowerCase().includes('users') ? (
              <div className="mt-1 text-xs font-normal text-red-700">
                Запусти SQL з <code className="bg-red-100 px-1 rounded">sql/2026-04-create-users.sql</code> у Supabase Dashboard.
              </div>
            ) : null}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-card border-2 border-border rounded-2xl p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-card border-2 border-border rounded-2xl p-12 text-center text-muted text-sm">Користувачів немає</div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ client, users: groupUsers }) => {
            const isOpen = !collapsed[client.tenant_id];
            return (
              <div key={client.tenant_id} className="bg-card border-2 border-border rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(client.tenant_id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-bg/50 cursor-pointer transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="w-5 h-5 text-muted shrink-0" />
                    : <ChevronRight className="w-5 h-5 text-muted shrink-0" />
                  }
                  <span className="text-base font-black text-text">{client.name}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-xs font-bold text-violet-700">
                    {groupUsers.length}
                  </span>
                </button>

                {isOpen && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg border-t-2 border-b-2 border-border">
                        <Th>Логін</Th>
                        <Th>ПІБ</Th>
                        <Th>Ролі</Th>
                        <Th>Пароль</Th>
                        <Th className="text-right">Дії</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupUsers.map((u) => (
                        <tr key={u.id} className="border-b border-border last:border-0 hover:bg-bg/50">
                          <Td><code className="font-mono text-xs font-bold">{u.login}</code></Td>
                          <Td className="font-semibold">{u.full_name || <span className="text-muted italic">—</span>}</Td>
                          <Td>
                            <div className="flex flex-wrap gap-1">
                              {sortRoles(u.roles ?? []).map((r) => (
                                <span key={r} className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                                  r === 'owner'   ? 'bg-violet-50 border-violet-200 text-violet-700' :
                                  r === 'manager' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                    'bg-emerald-50 border-emerald-200 text-emerald-700'
                                }`}>{ROLE_LABEL[r]}</span>
                              ))}
                            </div>
                          </Td>
                          <Td><span className="font-mono text-xs text-text-secondary">{u.password}</span></Td>
                          <Td className="text-right">
                            <div className="inline-flex gap-2">
                              <IconBtn icon={Pencil} onClick={() => setEditing(u)} title="Редагувати" />
                              <IconBtn icon={Trash2} onClick={() => handleDelete(u)} title="Видалити" danger />
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          {orphans.length > 0 && (
            <div className="bg-card border-2 border-orange-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
                <span className="text-base font-black text-text">Без компанії</span>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-orange-700">
                  {orphans.length}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg border-t-2 border-b-2 border-border">
                    <Th>Логін</Th>
                    <Th>ПІБ</Th>
                    <Th>Ролі</Th>
                    <Th>tenant_id</Th>
                    <Th>Пароль</Th>
                    <Th className="text-right">Дії</Th>
                  </tr>
                </thead>
                <tbody>
                  {orphans.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-bg/50">
                      <Td><code className="font-mono text-xs font-bold">{u.login}</code></Td>
                      <Td className="font-semibold">{u.full_name || <span className="text-muted italic">—</span>}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {sortRoles(u.roles ?? []).map((r) => (
                            <span key={r} className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                              r === 'owner'   ? 'bg-violet-50 border-violet-200 text-violet-700' :
                              r === 'manager' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}>{ROLE_LABEL[r]}</span>
                          ))}
                        </div>
                      </Td>
                      <Td><code className="font-mono text-xs text-orange-600">{u.tenant_id}</code></Td>
                      <Td><span className="font-mono text-xs text-text-secondary">{u.password}</span></Td>
                      <Td className="text-right">
                        <div className="inline-flex gap-2">
                          <IconBtn icon={Pencil} onClick={() => setEditing(u)} title="Редагувати" />
                          <IconBtn icon={Trash2} onClick={() => handleDelete(u)} title="Видалити" danger />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(creating || editing) && (
        <UserFormModal
          initial={editing}
          clients={clients}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await reload(); }}
        />
      )}
    </div>
  );
}

function UserFormModal({
  initial, clients, onClose, onSaved,
}: { initial: User | null; clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const [login, setLogin] = useState(initial?.login ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [roles, setRoles] = useState<Role[]>(
    initial?.roles && initial.roles.length > 0 ? initial.roles : ['manager'],
  );
  const [tenantId, setTenantId] = useState(initial?.tenant_id ?? clients[0]?.tenant_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleRole = (r: Role) => {
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  };

  const handleSave = async () => {
    if (!login.trim() || !password.trim() || !tenantId) {
      setError('Логін, пароль і компанія обов’язкові');
      return;
    }
    if (roles.length === 0) {
      setError('Обери хоча б одну роль');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input: UserInput = {
        tenant_id: tenantId,
        login: login.trim(),
        password: password.trim(),
        roles: sortRoles(roles),
        full_name: fullName.trim() || null,
      };
      if (initial) await updateUser(initial.id, input);
      else await createUser(input);
      onSaved();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-card border-2 border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-[scaleIn_0.2s_ease-out]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black text-text">{initial ? 'Редагувати користувача' : 'Новий користувач'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-bg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Логін">
            <input
              value={login} onChange={(e) => setLogin(e.target.value)} placeholder="oleg"
              className="w-full px-3 py-2.5 bg-bg border-2 border-border rounded-xl text-sm font-mono focus:outline-none focus:border-violet-400"
            />
          </Field>
          <Field label="Пароль">
            <input
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="oleg123"
              className="w-full px-3 py-2.5 bg-bg border-2 border-border rounded-xl text-sm font-mono focus:outline-none focus:border-violet-400"
            />
          </Field>
          <Field label="ПІБ">
            <input
              value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Олег Іванов"
              className="w-full px-3 py-2.5 bg-bg border-2 border-border rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
          </Field>
          <Field label="Ролі (можна декілька)">
            <div className="flex gap-2">
              {ROLES.map((r) => {
                const on = roles.includes(r);
                return (
                  <button
                    key={r} type="button" onClick={() => toggleRole(r)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border-2 cursor-pointer transition-all ${
                      on ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-bg border-border text-muted hover:border-violet-200'
                    }`}
                  >{ROLE_LABEL[r]}</button>
                );
              })}
            </div>
          </Field>
          <Field label="Компанія">
            <select
              value={tenantId} onChange={(e) => setTenantId(e.target.value)}
              className="w-full px-3 py-2.5 bg-bg border-2 border-border rounded-xl text-sm focus:outline-none focus:border-violet-400"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.tenant_id}>{c.name} ({c.tenant_id})</option>
              ))}
            </select>
          </Field>
        </div>

        {error && (
          <div className="mt-4 px-3 py-2 bg-red-50 border-2 border-red-200 rounded-lg text-xs font-semibold text-error flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-border text-sm font-bold text-text-secondary hover:bg-bg cursor-pointer">Скасувати</button>
          <button
            onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 hover:brightness-110 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}
