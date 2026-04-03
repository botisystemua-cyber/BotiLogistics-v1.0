import type { OrderStatus } from '../types';

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  processing: { label: 'В обробці', color: 'text-status-processing', bg: 'bg-slate-100' },
  pending: { label: 'Очікує завдаток', color: 'text-status-pending', bg: 'bg-amber-50' },
  confirmed: { label: 'Підтверджено', color: 'text-status-confirmed', bg: 'bg-green-50' },
  transit: { label: 'В дорозі', color: 'text-status-transit', bg: 'bg-orange-50' },
  done: { label: 'Виконано', color: 'text-status-done', bg: 'bg-blue-50' },
  cancelled: { label: 'Скасовано', color: 'text-status-cancelled', bg: 'bg-red-50' },
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.color.replace('text-', 'bg-')}`} />
      {cfg.label}
    </span>
  );
}
