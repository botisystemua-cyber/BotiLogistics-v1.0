import { useState } from 'react';
import { LogIn, Truck } from 'lucide-react';
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
    <div className="flex-1 flex flex-col items-center justify-center px-6 bg-white">
      {/* Icon */}
      <div className="w-24 h-24 rounded-3xl bg-brand-light flex items-center justify-center mb-8">
        <Truck className="w-12 h-12 text-brand" strokeWidth={1.5} />
      </div>

      <BotiLogo size="lg" />
      <p className="text-text-secondary text-base mt-2 mb-12 font-medium">
        Панель водія
      </p>

      {/* Form */}
      <div className="w-full max-w-md">
        <label className="block text-base font-semibold text-text mb-3">
          Твоє ім'я
        </label>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="Введи своє ім'я"
          className="w-full px-5 py-4 bg-bg border-2 border-border rounded-2xl text-text text-lg placeholder-text-secondary/40 focus:outline-none focus:border-brand transition-colors"
        />
        <button
          onClick={handleLogin}
          className="w-full mt-6 py-4.5 bg-brand text-white font-bold rounded-2xl text-lg hover:bg-brand-dark active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-brand/20"
        >
          <LogIn className="w-6 h-6" />
          Увійти
        </button>
      </div>
    </div>
  );
}
