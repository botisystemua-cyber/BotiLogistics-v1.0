import { useState, useEffect, useRef } from 'react';
import { LogIn, Truck } from 'lucide-react';
import { BotiLogo } from './BotiLogo';
import { useApp } from '../store/useAppStore';
import { fetchRoutes } from '../api';

export function LoginScreen() {
  const { driverName, setDriverName, setCurrentScreen, setRoutes, setShippingRoutes, showToast } = useApp();
  const [inputValue, setInputValue] = useState(driverName);
  const prefetched = useRef(false);

  // Prefetch routes while user is on login screen
  useEffect(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    fetchRoutes().then((data) => {
      setRoutes(data.routes);
      setShippingRoutes(data.shipping);
    }).catch(() => {});
  }, [setRoutes, setShippingRoutes]);

  const handleLogin = () => {
    const name = inputValue.trim();
    if (!name) { showToast('Введи своє ім\'я'); return; }
    setDriverName(name);
    setCurrentScreen('routes');
    showToast(`Привіт, ${name}!`);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 bg-white">
      <div className="w-20 h-20 rounded-3xl bg-brand/10 flex items-center justify-center mb-6">
        <Truck className="w-10 h-10 text-brand" strokeWidth={1.5} />
      </div>

      <BotiLogo size="lg" />
      <p className="text-muted text-sm mt-1 mb-10">Панель водія</p>

      <div className="w-full max-w-sm">
        <label className="block text-sm font-semibold text-text mb-2">Твоє ім'я</label>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="Введи своє ім'я"
          className="w-full px-4 py-3.5 bg-bg border border-border rounded-xl text-text text-base placeholder-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
        />
        <button onClick={handleLogin}
          className="w-full mt-4 py-3.5 bg-brand text-white font-bold rounded-xl text-base hover:bg-brand-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand/25">
          <LogIn className="w-5 h-5" /> Увійти
        </button>
      </div>
    </div>
  );
}
