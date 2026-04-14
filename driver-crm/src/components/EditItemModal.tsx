import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { updateDriverFields } from '../api';
import type { Passenger, Package as Pkg, ShippingItem, RouteItem } from '../types';

const CURRENCIES = ['UAH', 'EUR', 'CHF', 'PLN', 'USD'];
const PAY_FORMS = ['', 'Готівка', 'Картка', 'Переказ'];

interface Props {
  item: RouteItem;
  onClose: () => void;
  onSaved: () => void;
}

export function EditItemModal({ item, onClose, onSaved }: Props) {
  const { currentSheet, isUnifiedView, showToast } = useApp();
  const [submitting, setSubmitting] = useState(false);

  const isShipping = 'dispatchId' in item;
  const isPax = !isShipping && item.type.toLowerCase().includes('пасажир');
  const isPkg = !isShipping && !isPax;

  const getRouteName = () => {
    if (isShipping) {
      const ship = item as ShippingItem;
      if (isUnifiedView && ship._sourceRoute) return ship._sourceRoute.replace('Маршрут_', 'Відправка_');
      return ship.sheet;
    }
    return isUnifiedView && item._sourceRoute ? item._sourceRoute : currentSheet;
  };
  const routeName = getRouteName();

  // Common
  const [dateTrip, setDateTrip] = useState(item.dateTrip || '');
  const [amount, setAmount] = useState(item.amount || '');
  const [currency, setCurrency] = useState(item.currency || 'UAH');
  const [payForm, setPayForm] = useState(
    isShipping ? (item as ShippingItem).payForm || ''
    : (item as Passenger | Pkg).payForm || ''
  );
  const [note, setNote] = useState(item.note || '');

  // Passenger
  const pax = item as Passenger;
  const [name, setName] = useState(isPax ? pax.name || '' : '');
  const [phone, setPhone] = useState(isPax ? pax.phone || '' : '');
  const [addrFrom, setAddrFrom] = useState(isPax ? pax.addrFrom || '' : '');
  const [addrTo, setAddrTo] = useState(isPax ? pax.addrTo || '' : '');
  const [seatsCount, setSeatsCount] = useState(isPax ? pax.seatsCount || '1' : '1');
  const [baggageWeight, setBaggageWeight] = useState(isPax ? pax.baggageWeight || '' : '');
  const [timing, setTiming] = useState(isPax ? pax.timing || '' : '');
  const [city, setCity] = useState(!isShipping ? (item as Passenger).city || '' : '');

  // Package
  const pkg = item as Pkg;
  const [senderName, setSenderName] = useState(isPkg ? pkg.senderName || '' : isShipping ? (item as ShippingItem).senderName || '' : '');
  const [senderPhone, setSenderPhone] = useState(
    isPkg ? (pkg.senderPhone || '')
    : isShipping ? (item as ShippingItem).senderPhone || ''
    : ''
  );
  const [recipientName, setRecipientName] = useState(isPkg ? pkg.recipientName || '' : isShipping ? (item as ShippingItem).recipientName || '' : '');
  const [recipientPhone, setRecipientPhone] = useState(isPkg ? pkg.recipientPhone || '' : isShipping ? (item as ShippingItem).recipientPhone || '' : '');
  const [recipientAddr, setRecipientAddr] = useState(isPkg ? pkg.recipientAddr || '' : isShipping ? (item as ShippingItem).recipientAddr || '' : '');
  const [pkgDesc, setPkgDesc] = useState(isPkg ? pkg.pkgDesc || '' : '');
  const [pkgWeight, setPkgWeight] = useState(isPkg ? pkg.pkgWeight || '' : '');
  const [ttn, setTtn] = useState(isPkg ? pkg.ttn || '' : '');

  // Shipping-specific
  const ship = item as ShippingItem;
  const [weight, setWeight] = useState(isShipping ? ship.weight || '' : '');
  const [description, setDescription] = useState(isShipping ? ship.description || '' : '');

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const fields: Record<string, string> = {};

      // Common fields
      fields.dateTrip = dateTrip;
      fields.amount = amount;
      fields.currency = currency;
      fields.payForm = payForm;
      fields.note = note;

      if (isShipping) {
        fields.senderName = senderName;
        fields.senderPhone = senderPhone;
        fields.recipientName = recipientName;
        fields.recipientPhone = recipientPhone;
        fields.recipientAddr = recipientAddr;
        fields.weight = weight;
        fields.pkgDesc = description;
      } else {
        fields.city = city;

        if (isPax) {
          fields.name = name;
          fields.phone = phone;
          fields.addrFrom = addrFrom;
          fields.addrTo = addrTo;
          fields.seatsCount = seatsCount;
          fields.baggageWeight = baggageWeight;
          fields.timing = timing;
        } else {
          fields.senderName = senderName;
          fields.senderPhone = senderPhone;
          fields.recipientName = recipientName;
          fields.recipientPhone = recipientPhone;
          fields.recipientAddr = recipientAddr;
          fields.pkgDesc = pkgDesc;
          fields.pkgWeight = pkgWeight;
          fields.ttn = ttn;
        }
      }

      const itemId = isShipping ? (item as ShippingItem).dispatchId : (item as Passenger | Pkg).itemId;

      await updateDriverFields(itemId, routeName, fields);
      showToast('Збережено!');
      onSaved();
      onClose();
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const title = isShipping ? '✏️ Редагувати відправку' : isPax ? '✏️ Редагувати пасажира' : '✏️ Редагувати посилку';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col animate-[slideUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
          <h2 className="text-base font-bold text-text">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {isPax && (
            <>
              <Field label="ПІБ" value={name} onChange={setName} />
              <Field label="Телефон" value={phone} onChange={setPhone} type="tel" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Звідки" value={addrFrom} onChange={setAddrFrom} />
                <Field label="Куди" value={addrTo} onChange={setAddrTo} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Місць" value={seatsCount} onChange={setSeatsCount} type="number" />
                <Field label="Вага багажу" value={baggageWeight} onChange={setBaggageWeight} />
                <Field label="Таймінг" value={timing} onChange={setTiming} placeholder="08:00" />
              </div>
            </>
          )}

          {isPkg && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Відправник" value={senderName} onChange={setSenderName} />
                <Field label="Тел. відправника" value={senderPhone} onChange={setSenderPhone} type="tel" />
              </div>
              <Field label="Отримувач" value={recipientName} onChange={setRecipientName} />
              <Field label="Тел. отримувача" value={recipientPhone} onChange={setRecipientPhone} type="tel" />
              <Field label="Адреса отримувача" value={recipientAddr} onChange={setRecipientAddr} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Опис" value={pkgDesc} onChange={setPkgDesc} />
                <Field label="Вага (кг)" value={pkgWeight} onChange={setPkgWeight} />
              </div>
              <Field label="ТТН" value={ttn} onChange={setTtn} />
            </>
          )}

          {isShipping && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Відправник" value={senderName} onChange={setSenderName} />
                <Field label="Тел. відправника" value={senderPhone} onChange={setSenderPhone} type="tel" />
              </div>
              <Field label="Отримувач" value={recipientName} onChange={setRecipientName} />
              <Field label="Тел. отримувача" value={recipientPhone} onChange={setRecipientPhone} type="tel" />
              <Field label="Адреса отримувача" value={recipientAddr} onChange={setRecipientAddr} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Опис" value={description} onChange={setDescription} />
                <Field label="Вага" value={weight} onChange={setWeight} />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Дата рейсу" value={dateTrip} onChange={setDateTrip} type="date" />
            {!isShipping ? <Field label="Місто" value={city} onChange={setCity} /> : <div />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Сума" value={amount} onChange={setAmount} type="number" />
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Форма оплати</label>
              <select value={payForm} onChange={(e) => setPayForm(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                {PAY_FORMS.map((pf) => (
                  <option key={pf} value={pf}>{pf || '—'}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Валюта</label>
            <div className="flex gap-1">
              {CURRENCIES.map((c) => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                    currency === c ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'
                  }`}>{c}</button>
              ))}
            </div>
          </div>
          <Field label="Примітка" value={note} onChange={setNote} />
        </div>

        <div className="px-3 py-3 border-t border-gray-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={handleSave} disabled={submitting}
            className="w-full py-3 rounded-xl bg-brand text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-50">
            <Save className="w-4 h-4" />
            {submitting ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted uppercase mb-1">{label}</label>
      <input type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text placeholder:text-gray-300 focus:outline-none focus:border-brand" />
    </div>
  );
}
