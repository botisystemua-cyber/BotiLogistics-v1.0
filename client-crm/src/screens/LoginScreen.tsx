import { useState } from 'react';
import { Truck, Phone, User, Loader2 } from 'lucide-react';

interface Props {
  onLogin: (phone: string, name: string) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [phone, setPhone] = useState('+380');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputClass =
    'w-full px-4 py-3.5 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-blue-200/50 outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError("Введіть ім'я та прізвище");
      return;
    }

    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (cleaned.length < 10) {
      setError('Введіть коректний номер телефону');
      return;
    }

    setLoading(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    setTimeout(() => {
      onLogin(cleaned, fullName);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy to-navy-dark flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm md:max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 md:w-40 md:h-40 bg-accent rounded-2xl md:rounded-3xl flex items-center justify-center mb-4 md:mb-6 shadow-lg shadow-accent/30">
            <Truck size={40} className="text-white md:hidden" />
            <Truck size={80} className="text-white hidden md:block" />
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            <span className="text-white">BOTI</span>
            <span className="text-emerald-400">LOGISTICS</span>
          </h1>
          <p className="text-blue-200/70 text-sm md:text-base mt-1">Логістика без кордонів</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" />
              <input
                type="text"
                placeholder="Ім'я"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setError(''); }}
                className={`${inputClass} pl-11`}
                autoComplete="given-name"
                autoFocus
              />
            </div>
            <input
              type="text"
              placeholder="Прізвище"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); setError(''); }}
              className={inputClass}
              autoComplete="family-name"
            />
          </div>

          <div className="relative">
            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" />
            <input
              type="tel"
              placeholder="+380 XX XXX XXXX"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(''); }}
              className={`${inputClass} pl-11`}
              autoComplete="tel"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs pl-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-accent text-white font-bold rounded-xl text-base shadow-lg shadow-accent/30 active:scale-[0.97] transition-all duration-150 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Вхід...
              </>
            ) : (
              'Увійти'
            )}
          </button>
        </form>

        <p className="text-center text-blue-200/40 text-xs mt-6">
          Введіть дані для входу в додаток
        </p>
      </div>
    </div>
  );
}
