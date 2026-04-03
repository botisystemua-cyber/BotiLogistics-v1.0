import { useState } from 'react';
import { Truck, ShieldCheck, Users, Eye, EyeOff, LogIn, Loader2, LogOut, ChevronLeft } from 'lucide-react';

const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

type Role = 'owner' | 'manager' | 'driver';

interface RoleOption {
  key: Role;
  label: string;
  sublabel: string;
  icon: typeof Truck;
  gradient: string;
  iconBg: string;
}

const ROLES: RoleOption[] = [
  {
    key: 'owner',
    label: 'Власник',
    sublabel: 'Повний доступ до системи',
    icon: ShieldCheck,
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-100 text-violet-600',
  },
  {
    key: 'manager',
    label: 'Менеджер',
    sublabel: 'Управління пасажирами',
    icon: Users,
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-blue-100 text-blue-600',
  },
  {
    key: 'driver',
    label: 'Водій',
    sublabel: 'Маршрути та відправки',
    icon: Truck,
    gradient: 'from-emerald-500 to-green-600',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
];

interface AuthResult {
  success: boolean;
  user?: { name: string; role: string; staffId: string };
  error?: string;
}

function App() {
  const [step, setStep] = useState<'role' | 'login' | 'success'>('role');
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<AuthResult['user'] | null>(null);

  const handleRoleSelect = (role: RoleOption) => {
    setSelectedRole(role);
    setStep('login');
    setLogin('');
    setPassword('');
    setError('');
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

    setLoading(true);
    setError('');

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'login',
          role: selectedRole!.key,
          login: login.trim(),
          password: password.trim(),
        }),
      });
      const data: AuthResult = await res.json();

      if (data.success && data.user) {
        setUser(data.user);
        setStep('success');
      } else {
        setError(data.error || 'Невірний логін або пароль');
      }
    } catch {
      setError('Помилка мережі. Спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setStep('role');
    setSelectedRole(null);
    setUser(null);
    setLogin('');
    setPassword('');
    setError('');
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-4">
          <Truck className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-text tracking-tight">BotiLogistics</h1>
        <p className="text-sm text-muted mt-1">Система управління логістикою</p>
      </div>

      {/* Step: Role selection */}
      {step === 'role' && (
        <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
          <p className="text-center text-sm font-semibold text-text-secondary mb-4">Оберіть вашу роль</p>
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.key}
                onClick={() => handleRoleSelect(role)}
                className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-brand hover:shadow-lg hover:shadow-brand/5 transition-all duration-200 cursor-pointer active:scale-[0.98] group"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${role.iconBg} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-base font-bold text-text">{role.label}</div>
                  <div className="text-xs text-muted">{role.sublabel}</div>
                </div>
                <ChevronLeft className="w-5 h-5 text-border rotate-180 group-hover:text-brand transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      {/* Step: Login form */}
      {step === 'login' && selectedRole && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-text font-semibold mb-5 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Назад
          </button>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            {/* Role badge */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedRole.iconBg}`}>
                <selectedRole.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-text">Вхід як {selectedRole.label}</div>
                <div className="text-xs text-muted">{selectedRole.sublabel}</div>
              </div>
            </div>

            {/* Login field */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Логін</label>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => { setLogin(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pwd')?.focus()}
                  placeholder="Введіть логін"
                  autoFocus
                  autoComplete="username"
                  className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
                />
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Пароль</label>
                <div className="relative">
                  <input
                    id="pwd"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="Введіть пароль"
                    autoComplete="current-password"
                    className="w-full px-4 py-3 pr-12 bg-bg border border-border rounded-xl text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text cursor-pointer transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-error flex items-center gap-2">
                <span className="shrink-0">!</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleLogin}
              disabled={loading || !login.trim() || !password.trim()}
              className={`w-full mt-5 py-3.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r ${selectedRole.gradient} shadow-lg shadow-brand/20 hover:shadow-xl`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  Перевірка...
                </>
              ) : (
                <>
                  <LogIn className="w-4.5 h-4.5" />
                  Увійти
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step: Success */}
      {step === 'success' && user && selectedRole && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${selectedRole.gradient} shadow-lg mb-4`}>
              <selectedRole.icon className="w-8 h-8 text-white" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-success text-xs font-bold mb-3">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Авторизовано
            </div>

            <h2 className="text-xl font-extrabold text-text">{user.name}</h2>
            <p className="text-sm text-muted mt-1">{user.role}</p>

            <div className="mt-6 pt-4 border-t border-border space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">ID</span>
                <span className="font-mono font-semibold text-text-secondary">{user.staffId}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted">Статус</span>
                <span className="font-semibold text-success">Активний</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full mt-6 py-3 rounded-xl border border-border text-sm font-bold text-text-secondary hover:bg-bg cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Вийти
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-[11px] text-muted/60 mt-8">
        BotiLogistics v1.0
      </p>
    </div>
  );
}

export default App;
