import { useState } from 'react';
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  ChevronRight,
  X, Save, RefreshCw,
} from 'lucide-react';
import {
  createRoutePoint,
  updateRoutePoint,
  deleteRoutePoint,
  swapRoutePointOrder,
  extractLatLonFromMapsUrl,
  type RoutePoint,
  type RoutePointInput,
} from '../api/routes';

const COUNTRIES = [
  { code: 'UA', flag: '\u{1F1FA}\u{1F1E6}', label: '\u{1F1FA}\u{1F1E6} \u0423\u043A\u0440\u0430\u0457\u043D\u0430' },
  { code: 'RO', flag: '\u{1F1F7}\u{1F1F4}', label: '\u{1F1F7}\u{1F1F4} \u0420\u0443\u043C\u0443\u043D\u0456\u044F' },
  { code: 'SK', flag: '\u{1F1F8}\u{1F1F0}', label: '\u{1F1F8}\u{1F1F0} \u0421\u043B\u043E\u0432\u0430\u0447\u0447\u0438\u043D\u0430' },
  { code: 'CZ', flag: '\u{1F1E8}\u{1F1FF}', label: '\u{1F1E8}\u{1F1FF} \u0427\u0435\u0445\u0456\u044F' },
  { code: 'DE', flag: '\u{1F1E9}\u{1F1EA}', label: '\u{1F1E9}\u{1F1EA} \u041D\u0456\u043C\u0435\u0447\u0447\u0438\u043D\u0430' },
  { code: 'ES', flag: '\u{1F1EA}\u{1F1F8}', label: '\u{1F1EA}\u{1F1F8} \u0406\u0441\u043F\u0430\u043D\u0456\u044F' },
  { code: 'PL', flag: '\u{1F1F5}\u{1F1F1}', label: '\u{1F1F5}\u{1F1F1} \u041F\u043E\u043B\u044C\u0449\u0430' },
  { code: 'AT', flag: '\u{1F1E6}\u{1F1F9}', label: '\u{1F1E6}\u{1F1F9} \u0410\u0432\u0441\u0442\u0440\u0456\u044F' },
  { code: 'HU', flag: '\u{1F1ED}\u{1F1FA}', label: '\u{1F1ED}\u{1F1FA} \u0423\u0433\u043E\u0440\u0449\u0438\u043D\u0430' },
  { code: 'CH', flag: '\u{1F1E8}\u{1F1ED}', label: '\u{1F1E8}\u{1F1ED} \u0428\u0432\u0435\u0439\u0446\u0430\u0440\u0456\u044F' },
  { code: 'IT', flag: '\u{1F1EE}\u{1F1F9}', label: '\u{1F1EE}\u{1F1F9} \u0406\u0442\u0430\u043B\u0456\u044F' },
  { code: 'FR', flag: '\u{1F1EB}\u{1F1F7}', label: '\u{1F1EB}\u{1F1F7} \u0424\u0440\u0430\u043D\u0446\u0456\u044F' },
] as const;

const flagFor = (code: string) =>
  COUNTRIES.find(c => c.code === code)?.flag ?? code;

type PointForm = {
  name_ua: string;
  country_code: string;
  sort_order: number;
  location_name: string;
  lat: string;
  lon: string;
  maps_url: string;
  active: boolean;
};

const EMPTY_FORM: PointForm = {
  name_ua: '',
  country_code: 'UA',
  sort_order: 1,
  location_name: '',
  lat: '',
  lon: '',
  maps_url: '',
  active: true,
};

function pointToForm(p: RoutePoint): PointForm {
  return {
    name_ua: p.name_ua,
    country_code: p.country_code,
    sort_order: p.sort_order,
    location_name: p.location_name ?? '',
    lat: p.lat != null ? String(p.lat) : '',
    lon: p.lon != null ? String(p.lon) : '',
    maps_url: p.maps_url ?? '',
    active: p.active,
  };
}

function formToInput(f: PointForm): RoutePointInput {
  const mapsUrl = f.maps_url.trim() || null;
  const coords = mapsUrl ? extractLatLonFromMapsUrl(mapsUrl) : null;
  return {
    route_group: 'ua-es-wed',
    name_ua: f.name_ua.trim(),
    country_code: f.country_code,
    sort_order: f.sort_order,
    location_name: f.location_name.trim() || null,
    lat: coords ? coords[0] : (f.lat ? parseFloat(f.lat) : null),
    lon: coords ? coords[1] : (f.lon ? parseFloat(f.lon) : null),
    maps_url: mapsUrl,
    active: f.active,
  };
}

export function RoutePointsPanel({
  points,
  tenantId,
  onReload,
}: {
  points: RoutePoint[];
  tenantId: string;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editPoint, setEditPoint] = useState<RoutePoint | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const handleSwap = async (idx: number, dir: 'up' | 'down') => {
    if (swapping) return;
    setSwapping(true);
    try {
      await swapRoutePointOrder(tenantId, points, idx, dir);
      onReload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
    setSwapping(false);
  };

  const handleDelete = async (p: RoutePoint) => {
    if (!confirm(`Видалити точку "${p.name_ua}"?`)) return;
    try {
      await deleteRoutePoint(tenantId, p.id);
      onReload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
  };

  const handleSave = async (form: PointForm) => {
    const input = formToInput(form);
    if (!input.name_ua) {
      alert('Назва міста обов\u0027язкова');
      return;
    }
    try {
      if (isNew) {
        await createRoutePoint(tenantId, input);
      } else if (editPoint) {
        await updateRoutePoint(tenantId, editPoint.id, input);
      }
      setEditPoint(null);
      onReload();
    } catch (e) {
      alert('Помилка: ' + (e as Error).message);
    }
  };

  const openNew = () => {
    const nextOrder = points.length > 0
      ? Math.max(...points.map(p => p.sort_order)) + 1
      : 1;
    setEditPoint({} as RoutePoint);
    setIsNew(true);
    EMPTY_FORM.sort_order = nextOrder;
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
            <h2 className="text-base lg:text-lg font-extrabold text-text">Адреси</h2>
            <p className="text-xs lg:text-sm text-muted mt-0.5">
              Точки маршруту, які з'являються як підказки при додаванні пасажира
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
      {!open ? null : points.length === 0 ? (
        <div className="text-center py-12 lg:py-16 text-muted text-sm lg:text-base">
          Немає адрес. Натисніть «Додати» щоб створити першу.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-4">
          {points.map((p, idx) => (
            <div
              key={p.id}
              className={`rounded-xl lg:rounded-2xl border overflow-hidden shadow-sm ${
                p.active ? 'bg-white border-border' : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <div className="p-3 lg:p-5 flex items-center gap-3 lg:gap-4">
                <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-lg lg:rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <span className="text-lg lg:text-xl">{flagFor(p.country_code)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <span className="text-xs lg:text-sm font-bold text-muted/50">#{p.sort_order}</span>
                    <span className="text-sm lg:text-base font-bold text-text truncate">{p.name_ua}</span>
                    {!p.active && (
                      <span className="text-[10px] lg:text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                        Неактивна
                      </span>
                    )}
                  </div>
                  {p.location_name && (
                    <div className="text-xs lg:text-sm text-muted mt-0.5 truncate">{p.location_name}</div>
                  )}
                </div>
                <div className="flex gap-0.5 lg:gap-1 shrink-0">
                  <button onClick={() => handleSwap(idx, 'up')} disabled={idx === 0 || swapping}
                    className="p-1 lg:p-1.5 rounded-lg hover:bg-bg cursor-pointer transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <ChevronUp className="w-4 h-4 text-muted" />
                  </button>
                  <button onClick={() => handleSwap(idx, 'down')} disabled={idx === points.length - 1 || swapping}
                    className="p-1 lg:p-1.5 rounded-lg hover:bg-bg cursor-pointer transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <ChevronDown className="w-4 h-4 text-muted" />
                  </button>
                  <button onClick={() => { setEditPoint(p); setIsNew(false); }}
                    className="p-1.5 lg:p-2.5 rounded-lg lg:rounded-xl hover:bg-blue-50 cursor-pointer transition-all">
                    <Pencil className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
                  </button>
                  <button onClick={() => handleDelete(p)}
                    className="p-1.5 lg:p-2.5 rounded-lg lg:rounded-xl hover:bg-red-50 cursor-pointer transition-all">
                    <Trash2 className="w-4 h-4 lg:w-5 lg:h-5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editPoint && (
        <PointModal
          initial={isNew ? { ...EMPTY_FORM } : pointToForm(editPoint)}
          isNew={isNew}
          onClose={() => setEditPoint(null)}
          onSave={handleSave}
        />
      )}
    </section>
  );
}

function PointModal({
  initial, isNew, onClose, onSave,
}: {
  initial: PointForm;
  isNew: boolean;
  onClose: () => void;
  onSave: (f: PointForm) => Promise<void>;
}) {
  const [form, setForm] = useState<PointForm>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof PointForm>(k: K, v: PointForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.name_ua.trim()) {
      alert('Назва міста обов\u0027язкова');
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
            {isNew ? 'Нова точка' : 'Редагувати точку'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-4 lg:py-5 space-y-3 lg:space-y-4">
          <F label="Назва міста" value={form.name_ua} onChange={v => set('name_ua', v)} autoFocus />

          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <div>
              <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1 lg:mb-1.5">Країна</label>
              <select
                value={form.country_code}
                onChange={e => set('country_code', e.target.value)}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-bg border border-border rounded-xl text-sm text-text focus:outline-none focus:border-brand transition-all"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <F label="Порядок" value={String(form.sort_order)} onChange={v => set('sort_order', parseInt(v) || 0)} type="number" />
          </div>

          <F label="Локація (АЗС, автовокзал тощо)" value={form.location_name} onChange={v => set('location_name', v)} />

          <F label="Google Maps URL (необов'язково)" value={form.maps_url} onChange={v => set('maps_url', v)} />

          <label className="flex items-center gap-3 px-4 py-3 bg-bg rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => set('active', e.target.checked)}
              className="w-5 h-5 accent-brand cursor-pointer"
            />
            <span className="text-sm font-bold text-text">Активна</span>
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

function F({
  label, value, onChange, type, autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] lg:text-xs font-bold text-muted uppercase tracking-wider mb-1 lg:mb-1.5">{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full px-3 lg:px-4 py-2.5 lg:py-3 bg-bg border border-border rounded-xl text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand transition-all"
      />
    </div>
  );
}
