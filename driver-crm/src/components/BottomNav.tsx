import { Plus, Search, Columns3, RefreshCw } from 'lucide-react';

interface Props {
  onAdd: () => void;
  onSearch: () => void;
  onColumns: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export function BottomNav({ onAdd, onSearch, onColumns, onRefresh, loading }: Props) {
  return (
    <div className="shrink-0 bg-white border-t border-border px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around">
        <NavBtn icon={Plus} label="Додати" onClick={onAdd} accent />
        <NavBtn icon={Search} label="Пошук" onClick={onSearch} />
        <NavBtn icon={Columns3} label="Колонки" onClick={onColumns} />
        <NavBtn icon={RefreshCw} label="Оновити" onClick={onRefresh} spin={loading} />
      </div>
    </div>
  );
}

function NavBtn({ icon: I, label, onClick, accent, spin }: {
  icon: typeof Plus; label: string; onClick: () => void; accent?: boolean; spin?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl cursor-pointer active:scale-90 transition-all ${
        accent ? 'text-brand' : 'text-muted'
      }`}>
      <I className={`w-5 h-5 ${spin ? 'animate-spin' : ''}`} />
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}
