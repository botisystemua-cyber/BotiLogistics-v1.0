import { useState } from 'react';
import { X, UserPlus, Package, Send } from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { addRouteItem } from '../api';
import { parseSmsText, directionToNapryam } from '../utils/smsParser';

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export function AddItemModal({ onClose, onAdded }: Props) {
  const { currentSheet, isUnifiedView, routes, driverName, viewTab, showToast } = useApp();

  const defaultType = viewTab === 'packages' || viewTab === 'shipping' ? 'посилка' : 'пасажир';
  const [itemType, setItemType] = useState<'пасажир' | 'посилка'>(defaultType);
  const [selectedRoute, setSelectedRoute] = useState(isUnifiedView ? routes[0]?.name || '' : currentSheet);
  const [submitting, setSubmitting] = useState(false);
  const defaultDirection = viewTab === 'shipping' ? 'відправка' : 'отримання';
  const [direction, setDirection] = useState<'отримання' | 'відправка'>(defaultDirection);

  // Common fields
  const [dateTrip, setDateTrip] = useState('');
  const [city, setCity] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [payForm, setPayForm] = useState('Готівка');
  const [note, setNote] = useState('');

  // Passenger fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addrFrom, setAddrFrom] = useState('');
  const [addrTo, setAddrTo] = useState('');
  const [seatsCount, setSeatsCount] = useState('1');
  const [baggageWeight, setBaggageWeight] = useState('');
  const [timing, setTiming] = useState('');
  const [paxDirection, setPaxDirection] = useState<'ua-eu' | 'eu-ua'>('ua-eu');
  const [phoneReg, setPhoneReg] = useState('');
  const [paxDeposit, setPaxDeposit] = useState('');
  const [paxDepositCurrency, setPaxDepositCurrency] = useState('UAH');
  const [weightPrice, setWeightPrice] = useState('');
  const [smsText, setSmsText] = useState('');
  const [smsLog, setSmsLog] = useState('');

  // Package fields
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddr, setRecipientAddr] = useState('');
  const [pkgDesc, setPkgDesc] = useState('');
  const [pkgWeight, setPkgWeight] = useState('');
  const [ttn, setTtn] = useState('');

  const handleSubmit = async () => {
    if (itemType === 'пасажир' && !name.trim()) { showToast('Введи ПІБ'); return; }
    if (itemType === 'посилка' && !recipientName.trim()) { showToast('Введи отримувача'); return; }
    if (!selectedRoute) { showToast('Обери маршрут'); return; }

    setSubmitting(true);
    try {
      const data: Record<string, string> = {
        routeName: selectedRoute,
        itemType: itemType === 'пасажир' ? 'пасажир' : 'посилка',
        driverName,
      };

      if (itemType === 'пасажир') {
        data.direction = directionToNapryam(paxDirection);
        data.dateTrip = dateTrip;
        data.city = city;
        data.amount = amount;
        data.currency = currency;
        data.payForm = payForm;
        // Extra fields — append to note
        const extra: string[] = [];
        if (phoneReg) extra.push('Тел.рег: ' + phoneReg);
        if (paxDeposit) extra.push('Завдаток: ' + paxDeposit + ' ' + paxDepositCurrency);
        if (weightPrice) extra.push('Ціна багажу: ' + weightPrice);
        data.note = [note, ...extra].filter(Boolean).join(' | ');
        data.deposit = paxDeposit;
        data.depositCurrency = paxDepositCurrency;
        data.name = name;
        data.phone = phone;
        data.addrFrom = addrFrom;
        data.addrTo = addrTo;
        data.seatsCount = seatsCount;
        data.baggageWeight = baggageWeight;
        data.timing = timing;
      } else {
        data.direction = direction;
        data.dateTrip = dateTrip;
        data.city = city;
        data.amount = amount;
        data.currency = currency;
        data.payForm = payForm;
        data.note = note;
        data.senderName = senderName;
        data.senderPhone = senderPhone;
        data.recipientName = recipientName;
        data.recipientPhone = recipientPhone;
        data.recipientAddr = recipientAddr;
        data.pkgDesc = pkgDesc;
        data.pkgWeight = pkgWeight;
        data.ttn = ttn;
      }

      await addRouteItem(data);
      showToast('Додано!');
      onAdded();
      onClose();
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col animate-[slideUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
          <h2 className="text-base font-bold text-text">Додати запис</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button onClick={() => setItemType('пасажир')}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-center cursor-pointer transition-all ${
                itemType === 'пасажир' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
              }`}>
              <UserPlus className="w-4 h-4 inline mr-1.5 -mt-0.5" />Пасажир
            </button>
            <button onClick={() => setItemType('посилка')}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-center cursor-pointer transition-all ${
                itemType === 'посилка' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
              }`}>
              <Package className="w-4 h-4 inline mr-1.5 -mt-0.5" />Посилка
            </button>
          </div>

          {/* Route selector (unified view) */}
          {isUnifiedView && (
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Маршрут</label>
              <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                {routes.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
            </div>
          )}

          {/* ===== PASSENGER FORM ===== */}
          {itemType === 'пасажир' && (
            <>
              {/* SMS parser */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5">
                <label className="block text-[10px] font-bold text-purple-700 uppercase mb-1.5">Вставте текст замовлення</label>
                <textarea
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  rows={3}
                  placeholder="Наприклад: 12.03 два пасажири Київ-Цюріх +380639763484 Іваненко Петро"
                  className="w-full px-2.5 py-2 bg-white border border-purple-200 rounded-lg text-[12px] text-text focus:outline-none focus:border-purple-400 resize-y"
                />
                <button
                  type="button"
                  onClick={() => {
                    const r = parseSmsText(smsText);
                    if (r.name) setName(r.name);
                    if (r.phone) setPhone(r.phone);
                    if (r.date) setDateTrip(r.date);
                    if (r.seats) setSeatsCount(String(r.seats));
                    if (r.fromValue) setAddrFrom(r.fromValue);
                    if (r.toValue) setAddrTo(r.toValue);
                    if (r.timing) setTiming(r.timing);
                    if (r.direction) setPaxDirection(r.direction);
                    setSmsLog(r.log.length ? r.log.join(' · ') : 'Не вдалось розпізнати');
                  }}
                  className="w-full mt-1.5 py-2 bg-gradient-to-r from-purple-600 to-purple-400 text-white rounded-lg text-[11px] font-bold cursor-pointer active:scale-95"
                >Розпізнати та заповнити</button>
                {smsLog && <div className="mt-1.5 text-[10px] font-semibold text-purple-700">{smsLog}</div>}
              </div>

              {/* Direction */}
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Напрямок *</label>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setPaxDirection('ua-eu')}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                      paxDirection === 'ua-eu' ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                    }`}>UA→EU</button>
                  <button type="button" onClick={() => setPaxDirection('eu-ua')}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                      paxDirection === 'eu-ua' ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                    }`}>EU→UA</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Дата рейсу" value={dateTrip} onChange={setDateTrip} type="date" />
                <Field label="Місто" value={city} onChange={setCity} placeholder="Київ" />
              </div>
              <Field label="ПІБ *" value={name} onChange={setName} placeholder="Іванов Іван" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Телефон пасажира" value={phone} onChange={setPhone} placeholder="+380..." type="tel" />
                <Field label="Тел. реєстратора" value={phoneReg} onChange={setPhoneReg} placeholder="+380..." type="tel" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Звідки" value={addrFrom} onChange={setAddrFrom} placeholder="Адреса" />
                <Field label="Куди" value={addrTo} onChange={setAddrTo} placeholder="Адреса" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Місць" value={seatsCount} onChange={setSeatsCount} type="number" />
                <Field label="Вага багажу" value={baggageWeight} onChange={setBaggageWeight} placeholder="кг" type="number" />
                <Field label="Ціна багажу" value={weightPrice} onChange={setWeightPrice} placeholder="0" type="number" />
              </div>
              <Field label="Таймінг" value={timing} onChange={setTiming} placeholder="08:00" />

              {/* Deposit */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Завдаток" value={paxDeposit} onChange={setPaxDeposit} placeholder="0" type="number" />
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Валюта завдатку</label>
                  <select value={paxDepositCurrency} onChange={(e) => setPaxDepositCurrency(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                    <option value="UAH">UAH</option>
                    <option value="EUR">EUR</option>
                    <option value="CHF">CHF</option>
                    <option value="USD">USD</option>
                    <option value="PLN">PLN</option>
                  </select>
                </div>
              </div>

              {/* Payment */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Сума" value={amount} onChange={setAmount} placeholder="0" type="number" />
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Форма оплати</label>
                  <select value={payForm} onChange={(e) => setPayForm(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                    <option value="Готівка">Готівка</option>
                    <option value="Картка">Картка</option>
                    <option value="Переказ">Переказ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Валюта</label>
                <div className="flex gap-1.5">
                  {['UAH', 'EUR', 'CHF', 'PLN', 'USD'].map((c) => (
                    <button key={c} onClick={() => setCurrency(c)}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                        currency === c ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                      }`}>{c}</button>
                  ))}
                </div>
              </div>

              <Field label="Примітка" value={note} onChange={setNote} placeholder="Додаткова інформація" />
            </>
          )}

          {/* ===== PACKAGE FORM (unchanged for now) ===== */}
          {itemType === 'посилка' && (
            <>
              {/* Direction toggle */}
              <div className="flex gap-2">
                <button onClick={() => setDirection('отримання')}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-bold text-center cursor-pointer transition-all ${
                    direction === 'отримання' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                  }`}>
                  <Package className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Отримання
                </button>
                <button onClick={() => setDirection('відправка')}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-bold text-center cursor-pointer transition-all ${
                    direction === 'відправка' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                  }`}>
                  <Send className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Відправка
                </button>
              </div>

              {/* Common fields */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Дата рейсу" value={dateTrip} onChange={setDateTrip} type="date" />
                <Field label="Місто" value={city} onChange={setCity} placeholder="Київ" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Відправник" value={senderName} onChange={setSenderName} placeholder="ПІБ" />
                <Field label="Тел. відправника" value={senderPhone} onChange={setSenderPhone} placeholder="+380..." type="tel" />
              </div>
              <Field label="Отримувач *" value={recipientName} onChange={setRecipientName} placeholder="ПІБ" />
              <Field label="Тел. отримувача" value={recipientPhone} onChange={setRecipientPhone} placeholder="+380..." type="tel" />
              <Field label="Адреса отримувача" value={recipientAddr} onChange={setRecipientAddr} placeholder="Місто, вулиця..." />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Опис" value={pkgDesc} onChange={setPkgDesc} placeholder="Що відправляється" />
                <Field label="Вага (кг)" value={pkgWeight} onChange={setPkgWeight} type="number" />
              </div>
              <Field label="ТТН" value={ttn} onChange={setTtn} placeholder="Номер ТТН" />

              {/* Payment section */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Сума" value={amount} onChange={setAmount} placeholder="0" type="number" />
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Форма оплати</label>
                  <select value={payForm} onChange={(e) => setPayForm(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                    <option value="Готівка">Готівка</option>
                    <option value="Картка">Картка</option>
                    <option value="Переказ">Переказ</option>
                  </select>
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Валюта</label>
                <div className="flex gap-1.5">
                  {['UAH', 'EUR', 'CHF', 'PLN', 'USD'].map((c) => (
                    <button key={c} onClick={() => setCurrency(c)}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                        currency === c ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                      }`}>{c}</button>
                  ))}
                </div>
              </div>

              <Field label="Примітка" value={note} onChange={setNote} placeholder="Додаткова інформація" />
            </>
          )}
        </div>

        {/* Submit */}
        <div className="px-3 py-3 border-t border-gray-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={handleSubmit} disabled={submitting}
            className={`w-full py-3 rounded-xl text-sm font-bold text-center cursor-pointer transition-all ${
              submitting ? 'bg-gray-300 text-gray-500' : 'bg-brand text-white shadow-sm active:scale-[0.98]'
            }`}>
            <Send className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {submitting ? 'Відправка...' : 'Додати'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
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
