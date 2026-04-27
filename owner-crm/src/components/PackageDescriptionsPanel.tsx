import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  ChevronRight, X, Save, RefreshCw, Package,
} from 'lucide-react';
import {
  listPackageDescriptionsByTenant,
  createPackageDescription,
  updatePackageDescription,
  deletePackageDescription,
  swapPackageDescriptionOrder,
  type PackageDescription,
  type PackageDescriptionInput,
} from '../api/packageDescriptions';

type DescForm = {
  text: string;
  sort_order: number;
  active: boolean;
};

const EMPTY_FORM: DescForm = {
  text: '',
  sort_order: 1,
  active: true,
};

function descToForm(d: PackageDescription): DescForm {
  return { text: d.text, sort_order: d.sort_order, active: d.active };
}

function formToInput(f: DescForm): PackageDescriptionInput {
  return {
    text: f.text.trim(),
    sort_order: f.sort_order,
    active: f.active,
  };
}

export function PackageDescriptionsPanel({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<PackageDescription[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editItem, setEditItem] = useState<PackageDescription | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const reload = useCallback(async () => {
    try {
      setItems(await listPackageDescriptionsByTenant(tenantId));
      setLoaded(true);
    } catch (e) {
      console.error('PackageDescriptions load error', e);
    }
  }, [tenantId]);

  useEffect(() => {
    if (open && !loaded) reload();
  }, [open, loaded, reload]);

  const handleSwap = async (idx: number, dir: 'up' | 'down') => {
    if (swapping) return;
    setSwapping(true);
    try {
      await swapPackageDescriptionOrder(tenantId, items, idx, dir);
      await reload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
    setSwapping(false);
  };

  const handleDelete = async (d: PackageDescription) => {
    if (!confirm(`Видалити опис "${d.text}"?`)) return;
    try {
      await deletePackageDescription(tenantId, d.id);
      await reload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
  };

  const handleSave = async (form: DescForm) => {
    const input = formToInput(form);
    if (!input.text) {
      alert('Текст опису не може бути порожнім');
      return;
    }
    try {
      if (isNew) {
        await createPackageDescription(tenantId, input);
      } else if (editItem) {
        await updatePackageDescription(tenantId, editItem.id, input);
      }
      setEditItem(null);
      await reload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
  };

  const openNew = () => {
    setEditItem({} as PackageDescription);
    setIsNew(true);
  };

  return (
    <section>
      {/* Section header — clickable to toggle */}
      <div className="border-b border-border pb-3 lg:pb-4 mb-4 lg:mb-5">
        <button
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-2 w-full text-left cursor-pointer group"
        >
          <ChevronRight className={`w-4 h-4 lg:w-5 lg:h-5 text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
          <div className="flex-1 min-w-0">
            <h2 className="text-base lg:text-lg font-extrabold text-text">Описи посилок</h2>
            <p className="text-xs lg:text-sm text-muted mt-0.5">
              Стандартні описи, що з'являються як підказки при створенні нової посилки
            </p>
          </div>
          {open && (
            <span
              onClick={e => { e.stopPropagation(); openNew(); }}
              className="flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg lg:rounded-xl bg-brand text-white text-xs lg:text-sm font-bold cursor-pointer hover:brightness-110 transition-all shrink-0"
            >
              <Plus className="w-4 h-4 lg:w-5 lg:h-5" /> Додати
            </span>
          )}
        </button>
      </div>

      {/* Content — only when open */}
      {!open ? null : !loaded ? (
        <div className="text-center py-12 text-muted text-sm">Завантаження...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 lg:py-16 text-muted text-sm lg:text-base">
          Немає описів. Натисніть «Додати» щоб створити перший.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-4">
          {items.map((d, idx) => (
            <div
              key={d.id}
              className={`rounded-xl lg:rounded-2xl border overflow-hidden shadow-sm ${
                d.active ? 'bg-white border-border' : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <div className="p-3 lg:p-5 flex items-center gap-3 lg:gap-4">
                <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-lg lg:rounded-xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600 border border-amber-200">
                  <Package className="w-5 h-5 lg:w-6 lg:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <span className="text-sm lg:text-base font-bold text-text truncate">{d.text}</span>
                    {!d.active && (
                      <span className="text-[10px] lg:text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                        Неактивний
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5 lg:gap-1 shrink-0">
                  <button onClick={() => handleSwap(idx, 'up')} disabled={idx === 0 || swapping}
                    className="p-1 lg:p-1.5 rounded-lg hover:bg-bg cursor-pointer transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <ChevronUp className="w-4 h-4 text-muted" />
                  </button>
                  <button onClick={() => handleSwap(idx, 'down')} disabled={idx === items.length - 1 || swapping}
                    className="p-1 lg:p-1.5 rounded-lg hover:bg-bg cursor-pointer transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <ChevronDown className="w-4 h-4 text-muted" />
                  </button>
                  <button onClick={() => { setEditItem(d); setIsNew(false); }}
                    className="p-1.5 lg:p-2.5 rounded-lg lg:rounded-xl hover:bg-blue-50 cursor-pointer transition-all">
                    <Pencil className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
                  </button>
                  <button onClick={() => handleDelete(d)}
                    className="p-1.5 lg:p-2.5 rounded-lg lg:rounded-xl hover:bg-red-50 cursor-pointer transition-all">
                    <Trash2 className="w-4 h-4 lg:w-5 lg:h-5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <DescModal
          initial={isNew ? { ...EMPTY_FORM, sort_order: items.length > 0 ? Math.max(...items.map(d => d.sort_order)) + 1 : 1 } : descToForm(editItem)}
          isNew={isNew}
          onClose={() => setEditItem(null)}
          onSave={handleSave}
        />
      )}
    </section>
  );
}

function DescModal({
  initial, isNew, onClose, onSave,
}: {
  initial: DescForm;
  isNew: boolean;
  onClose: () => void;
  onSave: (f: DescForm) => Promise<void>;
}) {
  const [form, setForm] = useState<DescForm>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof DescForm>(k: K, v: DescForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.text.trim()) {
      alert('Текст опису не може бути порожнім');
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 lg:px-6 pt-5 lg:pt-6 pb-3 lg:pb-4 border-b border-border shrink-0">
          <h2 className="text-lg lg:text-xl font-extrabold text-text">
            {isNew ? 'Новий опис' : 'Редагувати опис'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-4 lg:py-5 space-y-3 lg:space-y-4">
          <div>
            <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1 lg:mb-1.5">Текст опису</label>
            <input
              type="text"
              value={form.text}
              onChange={e => set('text', e.target.value)}
              autoFocus
              maxLength={200}
              placeholder="Напр.: Документи, Одяг, Електроніка"
              className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-bg border border-border rounded-xl text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand transition-all"
            />
          </div>

          <label className="flex items-center gap-3 px-4 py-3 bg-bg rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => set('active', e.target.checked)}
              className="w-5 h-5 accent-brand cursor-pointer"
            />
            <span className="text-sm font-bold text-text">Активний</span>
          </label>
        </div>

        <div className="px-5 lg:px-6 py-4 lg:py-5 border-t border-border shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-3 lg:py-4 rounded-2xl bg-brand text-white font-bold text-sm lg:text-base flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-all disabled:opacity-40"
          >
            {saving ? <RefreshCw className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" /> : <Save className="w-4 h-4 lg:w-5 lg:h-5" />}
            {saving ? 'Збереження...' : isNew ? 'Додати' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}
