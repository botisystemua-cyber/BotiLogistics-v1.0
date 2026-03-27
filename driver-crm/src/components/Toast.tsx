import { useApp } from '../store/useAppStore';

export function Toast() {
  const { toastMessage } = useApp();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60]">
      <div className="bg-text text-white rounded-2xl px-6 py-4 shadow-2xl text-sm font-semibold max-w-xs text-center">
        {toastMessage}
      </div>
    </div>
  );
}
