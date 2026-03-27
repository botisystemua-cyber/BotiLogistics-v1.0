import { Clock, RotateCw, CheckCircle2, XCircle } from 'lucide-react';
import type { ItemStatus } from '../types';

const config: Record<
  ItemStatus,
  { icon: typeof Clock; color: string; bg: string; border: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
    label: 'Очікує',
  },
  'in-progress': {
    icon: RotateCw,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/30',
    label: 'В процесі',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/30',
    label: 'Готово',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/30',
    label: 'Скасовано',
  },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const c = config[status];
  const Icon = c.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${c.color} ${c.bg} border ${c.border}`}
    >
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

export function StatusIcon({ status }: { status: ItemStatus }) {
  const c = config[status];
  const Icon = c.icon;
  return <Icon className={`w-5 h-5 ${c.color}`} />;
}
