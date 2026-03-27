import { useApp } from '../store/useAppStore';

export function Toast() {
  const { toastMessage } = useApp();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-auto z-[60] animate-in slide-in-from-bottom-4 fade-in">
      <div className="bg-dark-card border border-neon-green/30 rounded-xl px-4 py-3 shadow-[0_0_25px_rgba(57,255,20,0.15)] text-sm text-white font-medium max-w-xs">
        {toastMessage}
      </div>
    </div>
  );
}
