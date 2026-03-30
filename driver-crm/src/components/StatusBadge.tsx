import { Clock, RotateCw, CheckCircle2, XCircle } from 'lucide-react';
import type { ItemStatus } from '../types';

const config: Record<
  ItemStatus,
  { icon: typeof Clock; color: string; bg: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    label: 'Очікує',
  },
  'in-progress': {
    icon: RotateCw,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    label: 'В процесі',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50',
    label: 'Готово',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    label: 'Скасовано',
  },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${c.color} ${c.bg}`}>
      <Icon className="w-4 h-4" />
      {c.label}
    </span>
  );
}

export function StatusIcon({ status }: { status: ItemStatus }) {
  const c = config[status];
  const Icon = c.icon;
  return <Icon className={`w-6 h-6 ${c.color}`} />;
}
