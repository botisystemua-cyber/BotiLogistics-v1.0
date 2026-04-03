import { CheckCircle, X } from 'lucide-react';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export default function Modal({ title, subtitle, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm text-center animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400">
          <X size={20} />
        </button>
        <CheckCircle size={56} className="text-status-confirmed mx-auto mb-3" />
        <h3 className="text-lg font-bold text-navy mb-1">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        <button
          onClick={onClose}
          className="mt-5 w-full py-3 bg-navy text-white rounded-xl font-semibold active:scale-95 transition-transform"
        >
          Закрити
        </button>
      </div>
    </div>
  );
}
