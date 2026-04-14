import { useApp } from '../store/useAppStore';

export function Toast() {
  const { toastMessage } = useApp();
  if (!toastMessage) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60]">
      <div className="bg-gray-800 text-white rounded-full px-5 py-2.5 shadow-xl text-sm font-medium whitespace-nowrap">
        {toastMessage}
      </div>
    </div>
  );
}
