import { useState } from 'react';
import { LogIn, User, Truck } from 'lucide-react';
import { BotiLogo } from './BotiLogo';
import { useApp } from '../store/useAppStore';

export function LoginScreen() {
  const { driverName, setDriverName, setCurrentScreen, showToast } = useApp();
  const [inputValue, setInputValue] = useState(driverName);

  const handleLogin = () => {
    const name = inputValue.trim();
    if (!name) {
      showToast('Введи своє ім\'я');
      return;
    }
    setDriverName(name);
    setCurrentScreen('routes');
    showToast(`Привіт, ${name}!`);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 bg-gradient-to-br from-dark-bg via-dark-card to-dark-bg relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-neon-green/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-neon-green/3 blur-[80px] pointer-events-none" />

      {/* Floating truck icon */}
      <div className="mb-8 relative">
        <div className="w-20 h-20 rounded-2xl bg-dark-surface border border-neon-green/20 flex items-center justify-center shadow-[0_0_30px_rgba(57,255,20,0.15)]">
          <Truck className="w-10 h-10 text-neon-green" />
        </div>
        <div className="absolute -inset-1 rounded-2xl bg-neon-green/10 blur-md -z-10" />
      </div>

      <BotiLogo size="lg" />
      <p className="text-neon-green/60 text-xs tracking-[4px] uppercase mt-1 mb-8 font-semibold">
        Driver Panel
      </p>

      {/* Login form */}
      <div className="w-full max-w-sm">
        <div className="bg-dark-card/80 backdrop-blur-xl border border-dark-border-glow rounded-2xl p-6 shadow-[0_0_40px_rgba(57,255,20,0.05)]">
          <label className="block text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-neon-green" />
            Твоє ім'я
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Введи своє ім'я"
            className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-neon-green/50 focus:shadow-[0_0_15px_rgba(57,255,20,0.1)] transition-all text-sm"
          />
          <button
            onClick={handleLogin}
            className="w-full mt-5 py-3.5 bg-neon-green text-dark-bg font-bold rounded-xl text-sm tracking-wide hover:shadow-[0_0_25px_rgba(57,255,20,0.4)] hover:bg-neon-green-dim active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Увійти
          </button>
        </div>
      </div>
    </div>
  );
}
