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
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center">
              <Lock className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Введи пароль</h2>
              <p className="text-sm text-text-secondary">{routeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-bg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6 text-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Пароль"
            autoFocus
            className="w-full px-5 py-4 bg-bg border-2 border-border rounded-2xl text-text text-lg placeholder-text-secondary/40 focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-bg text-text-secondary font-bold rounded-2xl text-base hover:bg-border/50 transition-all cursor-pointer"
          >
            Скасувати
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-4 bg-brand text-white font-bold rounded-2xl text-base hover:bg-brand-dark transition-all cursor-pointer shadow-lg shadow-brand/20"
          >
            Вхід
          </button>
        </div>
      </div>
    </div>
  );
}
