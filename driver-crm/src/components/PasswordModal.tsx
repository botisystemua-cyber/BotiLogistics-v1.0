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
    if (!password.trim()) { showToast('Введи пароль'); return; }
    if (password !== correctPassword) { showToast('Неправильний пароль!'); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-5" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Пароль</h2>
              <p className="text-xs text-muted">{routeName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>
        <div className="px-5 pb-2">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} placeholder="Пароль" autoFocus
            className="w-full px-4 py-3.5 bg-bg border border-border rounded-xl text-text text-base placeholder-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all" />
        </div>
        <div className="flex gap-2.5 px-5 pb-5 pt-3">
          <button onClick={onClose} className="flex-1 py-3 bg-bg text-muted font-semibold rounded-xl text-sm cursor-pointer hover:bg-border/50 transition-all">Скасувати</button>
          <button onClick={handleSubmit} className="flex-1 py-3 bg-brand text-white font-bold rounded-xl text-sm cursor-pointer shadow-md shadow-brand/25">Вхід</button>
        </div>
      </div>
    </div>
  );
}
