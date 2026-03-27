import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { useApp } from '../store/useAppStore';

interface Props {
  routeName: string;
  correctPassword: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function PasswordModal({ routeName, correctPassword, onSuccess, onClose }: Props) {
  const [password, setPassword] = useState('');
  const { showToast } = useApp();

  const handleSubmit = () => {
    if (!password.trim()) {
      showToast('Введи пароль');
      return;
    }
    if (password !== correctPassword) {
      showToast('Неправильний пароль!');
      return;
    }
    onSuccess();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-5 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-dark-card border border-dark-border-glow rounded-2xl w-full max-w-sm overflow-hidden shadow-[0_0_40px_rgba(57,255,20,0.1)] animate-in zoom-in-95 slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-dark-surface px-5 py-4 border-b border-neon-green/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-neon-green" />
            <h2 className="text-base font-bold text-white">Введи пароль</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-center text-white font-semibold mb-4">{routeName}</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Пароль"
            autoFocus
            className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-neon-green/50 focus:shadow-[0_0_15px_rgba(57,255,20,0.1)] transition-all text-sm"
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-dark-surface text-white/60 font-semibold rounded-xl text-sm hover:bg-white/5 transition-all cursor-pointer"
          >
            Скасувати
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 bg-neon-green text-dark-bg font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all cursor-pointer"
          >
            Вхід
          </button>
        </div>
      </div>
    </div>
  );
}
