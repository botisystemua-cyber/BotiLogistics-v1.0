import { useEffect, useState } from 'react';
import {
  Users, BarChart3, CreditCard, Settings, LogOut, Plus, Pencil, Trash2,
  Loader2, AlertCircle, X, Save, ShieldCheck,
} from 'lucide-react';
import { Logo } from './shared';
import {
  listClients, createClient, updateClient, deleteClient,
  type Client, type ClientInput,
} from '../api/clients';

type Section = 'clients' | 'stats' | 'billing' | 'settings';

const ALL_MODULES = ['passenger', 'cargo', 'driver', 'owner'] as const;

export function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<Section>('clients');

  return (
    <div className="min-h-screen bg-bg flex">
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
      <main className="flex-1 p-6 sm:p-8 overflow-x-auto">
        {section === 'clients' && <ClientsScreen />}
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
  const [creating, setCreating] = useState(false);

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
    if (!confirm(`Видалити клієнта "${c.name}" (${c.tenant_id})?\nЙого дані в routes/passengers НЕ будуть видалені.`)) return;
    try {
      await deleteClient(c.id);
      await reload();
    } catch (e: unknown) {
      alert('Помилка: ' + (e as Error).message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-text">Клієнти</h1>
          <p className="text-sm text-muted mt-1">Керування тенантами та доступом до модулів</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-violet-500/20 hover:brightness-110 active:scale-[0.97] cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          Додати клієнта
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border-2 border-red-200 rounded-xl text-sm font-semibold text-error flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div>{error}</div>
            {error.includes('password') || error.includes('modules') ? (
              <div className="mt-1 text-xs font-normal text-red-700">
                Запусти SQL з <code className="bg-red-100 px-1 rounded">sql/2026-04-add-client-auth.sql</code> у Supabase Dashboard → SQL Editor.
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="bg-card border-2 border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm">Клієнтів немає</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg border-b-2 border-border">
                <Th>Tenant ID</Th>
                <Th>Назва</Th>
                <Th>Пароль</Th>
                <Th>Модулі</Th>
                <Th className="text-right">Дії</Th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-bg/50">
                  <Td><code className="font-mono text-xs font-bold">{c.tenant_id}</code></Td>
                  <Td className="font-semibold">{c.name}</Td>
                  <Td>
                    {c.password
                      ? <span className="font-mono text-xs">{'•'.repeat(Math.min(c.password.length, 8))}</span>
                      : <span className="text-xs text-muted italic">не задано</span>}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(c.modules ?? []).map((m) => (
                        <span key={m} className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 uppercase">
                          {m}
                        </span>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex gap-2">
                      <IconBtn icon={Pencil} onClick={() => setEditing(c)} title="Редагувати" />
                      <IconBtn icon={Trash2} onClick={() => handleDelete(c)} title="Видалити" danger />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(creating || editing) && (
        <ClientFormModal
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await reload(); }}
        />
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-text ${className}`}>{children}</td>;
}
function IconBtn({
  icon: Icon, onClick, title, danger,
}: { icon: typeof Pencil; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all border-2 ${
        danger
          ? 'border-red-200 text-error hover:bg-red-50'
          : 'border-border text-text-secondary hover:bg-bg hover:border-violet-300 hover:text-violet-600'
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// ─────────────── Modal ───────────────

function ClientFormModal({
  initial, onClose, onSaved,
}: { initial: Client | null; onClose: () => void; onSaved: () => void }) {
  const [tenantId, setTenantId] = useState(initial?.tenant_id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? '');
  const [modules, setModules] = useState<string[]>(initial?.modules ?? ['passenger']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleModule = (m: string) => {
    setModules((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  };

  const handleSave = async () => {
    if (!tenantId.trim() || !name.trim()) {
      setError('Tenant ID та Назва обов’язкові');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input: ClientInput = {
        tenant_id: tenantId.trim(),
        name: name.trim(),
        password: password.trim() || null,
        logo_url: logoUrl.trim() || null,
        modules,
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
      <div className="bg-card border-2 border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-[scaleIn_0.2s_ease-out]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black text-text">{initial ? 'Редагувати клієнта' : 'Новий клієнт'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-bg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Tenant ID (slug)">
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={!!initial}
              placeholder="gresco"
              className="w-full px-3 py-2.5 bg-bg border-2 border-border rounded-xl text-sm font-mono focus:outline-none focus:border-violet-400 disabled:opacity-50"
            />
          </Field>
          <Field label="Назва">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gresco Express"
              className="w-full px-3 py-2.5 bg-bg border-2 border-border rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
          </Field>
          <Field label="Пароль">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="залиш пустим щоб не змінювати"
              className="w-full px-3 py-2.5 bg-bg border-2 border-border rounded-xl text-sm font-mono focus:outline-none focus:border-violet-400"
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase border-2 cursor-pointer transition-all ${
                      on
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-bg border-border text-muted hover:border-emerald-200'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}
