import { useState } from 'react';
import { ShieldCheck, Users, Eye, EyeOff, LogIn, Loader2, LogOut, ArrowLeft, CircleCheck, AlertCircle, Truck, ScanLine } from 'lucide-react';
import { Logo } from './components/shared';
import { AdminPanel } from './components/AdminPanel';
import { authenticate, authenticateAny } from './api/users';

const SCANNER_URL = '/BotiLogistics-v1.0/cargo-crm/scaner_ttn.html?from=config';

const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'botibro';

// Where to send each app after successful login. Adjust paths to match hosting.
const APP_URLS: Record<string, string> = {
  passenger: '/BotiLogistics-v1.0/passenger-crm/',
  cargo:     '/BotiLogistics-v1.0/cargo-crm/',
  driver:    '/BotiLogistics-v1.0/driver-crm/',
  owner:     '/BotiLogistics-v1.0/owner-crm/',
};

const APP_LABEL: Record<string, string> = {
  passenger: 'Пасажири',
  cargo:     'Посилки',
  driver:    'Водій',
  owner:     'Власник',
};

type Role = 'owner' | 'manager' | 'driver';

interface RoleOption {
  key: Role;
  label: string;
  sublabel: string;
  icon: typeof Truck;
  gradient: string;
  border: string;
  iconBg: string;
  shadow: string;
}

const ROLES: RoleOption[] = [
  {
    key: 'owner',
    label: 'Власник',
    sublabel: 'Повний доступ до системи',
    icon: ShieldCheck,
    gradient: 'from-violet-500 to-purple-600',
    border: 'hover:border-violet-400',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white',
    shadow: 'shadow-violet-500/20',
  },
  {
    key: 'manager',
    label: 'Менеджер',
    sublabel: 'Управління пасажирами',
    icon: Users,
    gradient: 'from-blue-500 to-indigo-600',
    border: 'hover:border-blue-400',
    iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white',
    shadow: 'shadow-blue-500/20',
  },
  {
    key: 'driver',
    label: 'Водій',
    sublabel: 'Маршрути та відправки',
    icon: Truck,
    gradient: 'from-emerald-500 to-green-600',
    border: 'hover:border-emerald-400',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600 text-white',
    shadow: 'shadow-emerald-500/20',
  },
];

interface SessionUser {
  name: string;
  role: string;
  staffId: string;
  tenantId: string;
  tenantName: string;
  modules: string[];
}

function App() {
  const [step, setStep] = useState<'role' | 'login' | 'scanner-login' | 'success' | 'admin'>('role');
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);

  const handleRoleSelect = (role: RoleOption) => {
    setSelectedRole(role);
    setStep('login');
    setLogin('');
    setPassword('');
    setError('');
  };

  const handleScannerClick = () => {
    // Якщо вже залогінений — одразу в сканер (існуюча сесія містить tenant_id).
    if (localStorage.getItem('boti_session')) {
      window.location.href = SCANNER_URL;
      return;
    }
    setStep('scanner-login');
    setSelectedRole(null);
    setLogin('');
    setPassword('');
    setError('');
  };

  const handleScannerLogin = async () => {
    if (!login.trim() || !password.trim()) {
      setError('Введіть логін та пароль');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await authenticateAny(login.trim(), password.trim());
      const primary = result.user.roles && result.user.roles.length > 0 ? result.user.roles[0] : 'manager';
      localStorage.setItem('boti_session', JSON.stringify({
        tenant_id: result.user.tenant_id,
        tenant_name: result.tenantName,
        logo_url: result.logoUrl || '',
        user_login: result.user.login,
        user_name: result.user.full_name || result.user.login,
        role: primary,
        roles: result.user.roles ?? [primary],
        modules: result.modules,
      }));
      window.location.href = SCANNER_URL;
    } catch (e: unknown) {
      setError((e as Error).message || 'Помилка входу');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('role');
    setSelectedRole(null);
    setError('');
  };

  const handleLogin = async () => {
    if (!login.trim() || !password.trim()) {
      setError('Введіть логін та пароль');
      return;
    }

    // Master admin shortcut: bypasses GAS, opens internal admin panel
    if (login.trim() === ADMIN_LOGIN && password.trim() === ADMIN_PASSWORD) {
      setStep('admin');
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await authenticate(selectedRole!.key, login.trim(), password.trim());
      const session: SessionUser = {
        name: result.user.full_name || result.user.login,
        role: selectedRole!.label,
        staffId: result.user.login,
        tenantId: result.user.tenant_id,
        tenantName: result.tenantName,
        modules: result.modules,
      };
      // Store in localStorage so passenger-crm/cargo-crm/etc can read tenant_id on load.
      // `role` is the ACTIVE role the user picked at login (single string,
      //    consumed by passenger-crm/driver-crm which expect a string).
      // `roles` is the FULL set from DB — owner-crm uses it for multi-hat UX.
      localStorage.setItem('boti_session', JSON.stringify({
        tenant_id: session.tenantId,
        tenant_name: session.tenantName,
        logo_url: result.logoUrl || '',
        user_login: result.user.login,
        user_name: session.name,
        role: selectedRole!.key,
        roles: result.user.roles ?? [selectedRole!.key],
        modules: session.modules,
      }));
      setUser(session);
      setStep('success');
    } catch (e: unknown) {
      setError((e as Error).message || 'Помилка входу');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('boti_session');
    setStep('role');
    setSelectedRole(null);
    setUser(null);
    setLogin('');
    setPassword('');
    setError('');
  };

  // Which apps to show on success screen — based on selected role.
  // Manager enters via passenger-crm and can switch to cargo from inside
  // (the Посилки button there is gated by the tenant's cargo module).
  const availableApps = (u: SessionUser): string[] => {
    if (!u) return [];
    if (selectedRole?.key === 'driver') return ['driver'];
    if (selectedRole?.key === 'owner')  return ['owner'];
    return ['passenger']; // manager
  };

  if (step === 'admin') {
    return <AdminPanel onLogout={handleLogout} />;
  }

  return (
    <div className="login-wrapper w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto">
      {/* ═══════ ROLE SELECTION ═══════ */}
      {step === 'role' && (
        <div className="animate-[fadeIn_0.4s_ease-out]">
          <div className="text-center mb-8 sm:mb-10">
            <Logo />
            <p className="text-xs sm:text-sm text-muted mt-3 font-medium">Оберіть вашу роль для входу</p>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {ROLES.map((role, idx) => {
              const Icon = role.icon;
              return (
                <button
                  key={role.key}
                  onClick={() => handleRoleSelect(role)}
                  style={{ animationDelay: `${idx * 80}ms` }}
                  className={`w-full bg-card border-2 border-border rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 ${role.border} hover:shadow-xl ${role.shadow} transition-all duration-300 cursor-pointer active:scale-[0.97] group animate-[slideUp_0.4s_ease-out_backwards]`}
                >
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 ${role.iconBg} shadow-lg ${role.shadow} group-hover:scale-105 transition-transform duration-300`}>
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-lg sm:text-xl font-extrabold text-text">{role.label}</div>
                    <div className="text-xs sm:text-sm text-muted mt-0.5">{role.sublabel}</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center shrink-0 group-hover:bg-border transition-colors">
                    <ArrowLeft className="w-4 h-4 text-muted rotate-180 group-hover:text-text transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* ─── Сканер ТТН — окрема кнопка, доступна з будь-яким логіном ─── */}
          <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-border/60">
            <button
              onClick={handleScannerClick}
              style={{ animationDelay: `${ROLES.length * 80}ms` }}
              className="w-full bg-card border-2 border-dashed border-border rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/20 transition-all duration-300 cursor-pointer active:scale-[0.97] group animate-[slideUp_0.4s_ease-out_backwards]"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform duration-300">
                <ScanLine className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-lg sm:text-xl font-extrabold text-text">Сканер ТТН</div>
                <div className="text-xs sm:text-sm text-muted mt-0.5">Швидкий вхід для сканування посилок</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted rotate-180 group-hover:text-amber-600 transition-colors" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ═══════ SCANNER LOGIN FORM ═══════ */}
      {step === 'scanner-login' && (
        <div className="animate-[fadeIn_0.35s_ease-out]">
          <div className="mb-6 sm:mb-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-text font-semibold cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад
            </button>
          </div>

          <div className="bg-card border-2 border-border rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm">
            <div className="flex items-center gap-4 mb-6 sm:mb-7">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
                <ScanLine className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-extrabold text-text">Сканер ТТН</div>
                <div className="text-xs sm:text-sm text-muted">Увійдіть будь-яким робочим логіном</div>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleScannerLogin(); }} autoComplete="on">
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-2">Логін</label>
                  <input
                    type="text"
                    name="username"
                    value={login}
                    onChange={(e) => { setLogin(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('scan-pwd')?.focus()}
                    placeholder="Введіть ваш логін"
                    autoFocus
                    autoComplete="username"
                    className="w-full px-4 py-3.5 sm:py-4 bg-bg border-2 border-border rounded-xl sm:rounded-2xl text-sm sm:text-base text-text placeholder:text-muted/50 focus:outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-2">Пароль</label>
                  <div className="relative">
                    <input
                      id="scan-pwd"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      placeholder="Введіть пароль"
                      autoComplete="current-password"
                      className="w-full px-4 py-3.5 sm:py-4 pr-12 bg-bg border-2 border-border rounded-xl sm:rounded-2xl text-sm sm:text-base text-text placeholder:text-muted/50 focus:outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-text cursor-pointer transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 sm:mt-5 px-4 py-3 bg-red-50 border-2 border-red-200 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold text-error flex items-center gap-2.5 animate-[scaleIn_0.2s_ease-out]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !login.trim() || !password.trim()}
                className="w-full mt-5 sm:mt-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-white text-sm sm:text-base font-bold flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20 hover:shadow-xl hover:brightness-110"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Перевірка...
                  </>
                ) : (
                  <>
                    <ScanLine className="w-5 h-5" />
                    Відкрити сканер
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ LOGIN FORM ═══════ */}
      {step === 'login' && selectedRole && (
        <div className="animate-[fadeIn_0.35s_ease-out]">
          <div className="mb-6 sm:mb-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-text font-semibold cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад
            </button>
          </div>

          <div className="bg-card border-2 border-border rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm">
            <div className="flex items-center gap-4 mb-6 sm:mb-7">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 ${selectedRole.iconBg} shadow-lg ${selectedRole.shadow}`}>
                <selectedRole.icon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-extrabold text-text">{selectedRole.label}</div>
                <div className="text-xs sm:text-sm text-muted">{selectedRole.sublabel}</div>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} autoComplete="on">
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-2">Логін</label>
                  <input
                    type="text"
                    name="username"
                    value={login}
                    onChange={(e) => { setLogin(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pwd')?.focus()}
                    placeholder="Введіть ваш логін"
                    autoFocus
                    autoComplete="username"
                    className="w-full px-4 py-3.5 sm:py-4 bg-bg border-2 border-border rounded-xl sm:rounded-2xl text-sm sm:text-base text-text placeholder:text-muted/50 focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-2">Пароль</label>
                  <div className="relative">
                    <input
                      id="pwd"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      placeholder="Введіть пароль"
                      autoComplete="current-password"
                      className="w-full px-4 py-3.5 sm:py-4 pr-12 bg-bg border-2 border-border rounded-xl sm:rounded-2xl text-sm sm:text-base text-text placeholder:text-muted/50 focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-text cursor-pointer transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 sm:mt-5 px-4 py-3 bg-red-50 border-2 border-red-200 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold text-error flex items-center gap-2.5 animate-[scaleIn_0.2s_ease-out]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !login.trim() || !password.trim()}
                className={`w-full mt-5 sm:mt-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-white text-sm sm:text-base font-bold flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r ${selectedRole.gradient} shadow-lg ${selectedRole.shadow} hover:shadow-xl hover:brightness-110`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Перевірка...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Увійти
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ SUCCESS ═══════ */}
      {step === 'success' && user && selectedRole && (
        <div className="animate-[scaleIn_0.35s_ease-out]">
          <div className="bg-card border-2 border-border rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm text-center">
            <div className="flex justify-center mb-5">
              <div className={`flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br ${selectedRole.gradient} shadow-xl ${selectedRole.shadow}`}>
                <selectedRole.icon className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
            </div>

            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 border border-green-200 text-success text-xs sm:text-sm font-bold">
                <CircleCheck className="w-4 h-4" />
                Авторизовано
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-text">{user.name}</h2>
            <p className="text-sm sm:text-base text-muted mt-1 font-medium">{user.role}</p>

            <div className="mt-6 sm:mt-8 bg-bg rounded-xl sm:rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-muted">Логін</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-text-secondary bg-card px-2.5 py-1 rounded-lg">{user.staffId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-muted">Компанія</span>
                <span className="text-xs sm:text-sm font-bold text-text">{user.tenantName}</span>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Перейти до додатку</div>
              {availableApps(user).length === 0 ? (
                <div className="text-xs text-muted italic">Немає доступних додатків для цієї ролі</div>
              ) : availableApps(user).map((m) => (
                <a
                  key={m}
                  href={APP_URLS[m]}
                  className="block w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-[0.97] transition-all"
                >
                  {selectedRole?.key === 'manager' ? 'Перейти до додатку' : APP_LABEL[m]} →
                </a>
              ))}
            </div>

            <button
              onClick={handleLogout}
              className="w-full mt-6 sm:mt-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border-2 border-border text-sm sm:text-base font-bold text-text-secondary hover:bg-bg hover:border-red-200 hover:text-error cursor-pointer transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            >
              <LogOut className="w-4.5 h-4.5" />
              Вийти
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-[10px] sm:text-[11px] text-muted/50 mt-6 sm:mt-8 font-medium">
        <span className="text-text/40 font-bold">Boti</span><span className="text-success/40 font-bold">Logistics</span> v1.0
      </p>
    </div>
  );
}

export default App;
