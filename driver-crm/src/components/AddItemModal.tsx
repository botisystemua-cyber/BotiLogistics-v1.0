import { useState, useEffect, useRef, useCallback } from 'react';
import { X, UserPlus, Package, Send, Hash, Search, Camera, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { addRouteItem, fetchPackages, fetchShippingItems, searchArchive } from '../api';
import type { ArchiveMatch } from '../api';
import { parseSmsText, directionToNapryam } from '../utils/smsParser';
import { supabase } from '../lib/supabase';
import { readSession } from '../lib/session';

const PHOTO_BUCKET = 'package-photos';
const SUPABASE_URL = 'https://pgdhuezxkehpjlxoesoe.supabase.co';

const CARGO_SUGGESTIONS = [
  'Крафтова коробка', 'Дві крафтові коробки', 'Три крафтові коробки',
  'Синя сумка IKEA', 'Польська чорна клітка', 'Білий пакет', 'Чорна сумка',
  'Біла коробка', 'Червона торба Деннер', 'Сіра валіза', 'Синя дорожня сумка',
  'Чорна валіза', 'Торба Мігрос', 'Червона сумка', 'Голуба торба Алді',
];

const CONTACTS_KEY = 'recipientContacts';
function loadContacts(): Record<string, { name: string; addr: string }> {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '{}'); }
  catch { return {}; }
}
function saveContact(phone: string, name: string, addr: string) {
  if (!phone.trim()) return;
  const contacts = loadContacts();
  contacts[phone.trim()] = { name: name.trim(), addr: addr.trim() };
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

interface PrefillData {
  senderName?: string;
  senderPhone?: string;
  addrFrom?: string;
  pkgDesc?: string;
  city?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddr?: string;
  pkgWeight?: string;
  amount?: string;
  currency?: string;
}

interface Props {
  onClose: () => void;
  onAdded: () => void;
  defaultType?: 'пасажир' | 'посилка';
  forceShipping?: boolean;
  prefill?: PrefillData;
}

export function AddItemModal({ onClose, onAdded, defaultType: dt, forceShipping = false, prefill }: Props) {
  const { currentSheet, isUnifiedView, routes, driverName, viewTab, shippingRoutes, showToast } = useApp();

  // За замовчуванням «посилка → відправка». Виняток — явно пасажирські таби,
  // там логічно одразу пасажирська форма. Раніше було навпаки (whitelist
  // posyлкових), і таб «Усі» падав у пасажирську форму, хоча водій
  // частіше додає саме відправки.
  const isPaxTab = viewTab === 'passengers' || viewTab === 'paxUaEu' || viewTab === 'paxEuUa';
  const defaultType = dt || (isPaxTab ? 'пасажир' : 'посилка');
  const [itemType, setItemType] = useState<'пасажир' | 'посилка'>(forceShipping ? 'посилка' : defaultType);
  const [selectedRoute, setSelectedRoute] = useState(isUnifiedView ? routes[0]?.name || '' : currentSheet);
  const [submitting, setSubmitting] = useState(false);
  const defaultDirection = viewTab === 'shipping' ? 'відправка' : 'відправка';
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
  const [ttn] = useState('');
  // Фото посилки (тільки для відправки) — URL після успішного upload в storage.
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoCamRef = useRef<HTMLInputElement>(null);
  const photoGalRef = useRef<HTMLInputElement>(null);

  async function handlePhotoFile(file: File | null) {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const sess = readSession();
      const tenantId = sess?.tenant_id || 'tn';
      let ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) ext = 'jpg';
      const path = `${tenantId}/_dispatch-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { contentType: file.type || `image/${ext}`, upsert: true });
      if (error) throw error;
      const url = `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
      setPhotoUrl(url);
      showToast('📷 Фото додано');
    } catch (err) {
      showToast('Помилка фото: ' + (err as Error).message);
    } finally {
      setPhotoUploading(false);
    }
  }

  // Apply prefill once on mount
  useEffect(() => {
    if (!prefill) return;
    if (prefill.senderName) setSenderName(prefill.senderName);
    if (prefill.senderPhone) setSenderPhone(prefill.senderPhone);
    if (prefill.addrFrom) setAddrFrom(prefill.addrFrom);
    if (prefill.pkgDesc) setPkgDesc(prefill.pkgDesc);
    if (prefill.city) setCity(prefill.city);
    if (prefill.recipientName) setRecipientName(prefill.recipientName);
    if (prefill.recipientPhone) setRecipientPhone(prefill.recipientPhone);
    if (prefill.recipientAddr) setRecipientAddr(prefill.recipientAddr);
    if (prefill.pkgWeight) setPkgWeight(prefill.pkgWeight);
    if (prefill.amount) setAmount(prefill.amount);
    if (prefill.currency) setCurrency(prefill.currency);
    if (prefill.senderPhone && prefill.recipientPhone) setArchiveFilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Відправка-specific fields
  const [internalNum, setInternalNum] = useState('');
  const [lastInternalNum, setLastInternalNum] = useState('');
  const [loadingNum, setLoadingNum] = useState(false);
  // Set усіх вже зайнятих внутрішніх номерів (з посилок + dispatches) — для
  // live-попередження при введенні дубля. Раніше перевірявся лише останній,
  // тому повтор будь-якого старого номера проходив без попередження.
  const [usedInternalNums, setUsedInternalNums] = useState<Set<string>>(new Set());
  const [pkgPieces, setPkgPieces] = useState('1');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositCurrency, setDepositCurrency] = useState('CHF');

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [contactLoaded, setContactLoaded] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Archive search state
  const [archiveResults, setArchiveResults] = useState<ArchiveMatch[]>([]);
  const [archiveTotalMatches, setArchiveTotalMatches] = useState(0);
  const [archiveSearching, setArchiveSearching] = useState(false);
  const [archiveFilled, setArchiveFilled] = useState(false);

  const isShipping = itemType === 'посилка' && direction === 'відправка';
  const isPickup = itemType === 'посилка' && direction === 'отримання';

  // Fetch last internal number when in shipping mode
  const loadLastInternalNum = useCallback(async () => {
    setLoadingNum(true);
    try {
      const routeName = selectedRoute;
      const routeNum = routeName.replace('Маршрут_', '');
      const shipSheetName = shippingRoutes.find((s) => s.name === 'Відправка_' + routeNum)?.name || 'Відправка_' + routeNum;
      const [pkgs, shipItems] = await Promise.allSettled([
        fetchPackages(routeName),
        fetchShippingItems(shipSheetName),
      ]);
      const nums: number[] = [];
      const all = new Set<string>();
      if (pkgs.status === 'fulfilled') pkgs.value.forEach((p) => {
        const raw = String(p.internalNum || '').trim();
        if (raw) all.add(raw);
        const n = parseInt(raw); if (!isNaN(n)) nums.push(n);
      });
      if (shipItems.status === 'fulfilled') shipItems.value.forEach((s) => {
        const raw = String(s.internalNum || '').trim();
        if (raw) all.add(raw);
        const n = parseInt(raw); if (!isNaN(n)) nums.push(n);
      });
      const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
      setLastInternalNum(String(maxNum));
      setUsedInternalNums(all);
      setInternalNum(String(maxNum + 1));
    } catch { /* ignore */ }
    finally { setLoadingNum(false); }
  }, [selectedRoute, shippingRoutes]);

  useEffect(() => { if (isShipping) loadLastInternalNum(); }, [isShipping, loadLastInternalNum]);

  // Recipient phone autocomplete from localStorage
  const handleRecipientPhoneBlur = () => {
    if (!recipientPhone.trim() || contactLoaded) return;
    const contacts = loadContacts();
    const saved = contacts[recipientPhone.trim()];
    if (saved) {
      if (!recipientName.trim()) setRecipientName(saved.name);
      if (!recipientAddr.trim()) setRecipientAddr(saved.addr);
      setContactLoaded(true);
      showToast('Контакт знайдено');
    }
  };
  useEffect(() => { setContactLoaded(false); }, [recipientPhone]);

  // Archive search
  const doArchiveSearch = useCallback(async (query: string) => {
    if (archiveFilled || !query || query.trim().length < 5) return;
    setArchiveSearching(true);
    try {
      const res = await searchArchive(query.trim());
      if (res.results.length > 0) { setArchiveResults(res.results); setArchiveTotalMatches(res.totalMatches); }
    } catch { /* ignore */ }
    finally { setArchiveSearching(false); }
  }, [archiveFilled]);

  const applyArchiveMatch = (match: ArchiveMatch) => {
    if (!recipientPhone.trim() && match.recipientPhone) setRecipientPhone(match.recipientPhone);
    if (!recipientName.trim() && match.recipientName) setRecipientName(match.recipientName);
    if (!recipientAddr.trim() && match.recipientAddr) setRecipientAddr(match.recipientAddr);
    setArchiveFilled(true);
    setArchiveResults([]);
    if (match.recipientPhone) saveContact(match.recipientPhone, match.recipientName, match.recipientAddr);
    showToast('Дані з архіву заповнені');
  };

  const filteredSuggestions = pkgDesc.trim()
    ? CARGO_SUGGESTIONS.filter((s) => s.toLowerCase().includes(pkgDesc.toLowerCase().trim()))
    : CARGO_SUGGESTIONS;

  const handleSubmit = async () => {
    if (itemType === 'пасажир') {
      if (!name.trim()) { showToast('Введи ПІБ'); return; }
    } else if (isShipping) {
      if (!internalNum.trim()) { showToast('Введи внутрішній номер'); return; }
      if (!recipientPhone.trim()) { showToast('Введи тел. отримувача'); return; }
      if (!senderPhone.trim()) { showToast('Введи тел./ІД відправника'); return; }
      if (!amount.trim()) { showToast('Введи оціночну вартість'); return; }
      if (usedInternalNums.has(internalNum.trim())) {
        showToast('⚠️ Внутрішній № ' + internalNum.trim() + ' вже існує — введіть інший');
        return;
      }
    } else if (isPickup) {
      if (!senderPhone.trim()) { showToast('Введи телефон клієнта'); return; }
      if (!addrFrom.trim()) { showToast('Введи адресу забору'); return; }
    } else {
      if (!recipientName.trim()) { showToast('Введи отримувача'); return; }
    }
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
      } else if (isShipping) {
        data.direction = 'відправка';
        data.internalNum = internalNum;
        data.recipientName = recipientName;
        data.recipientPhone = recipientPhone;
        data.recipientAddr = recipientAddr;
        data.pkgDesc = pkgDesc;
        data.pkgPieces = pkgPieces;
        data.photoUrl = photoUrl;
        data.pkgWeight = pkgWeight;
        data.senderPhone = senderPhone;
        data.amount = amount;
        data.paymentAmount = paymentAmount;
        data.currency = currency;
        data.payForm = payForm;
        data.deposit = depositAmount;
        data.depositCurrency = depositCurrency;
        saveContact(recipientPhone, recipientName, recipientAddr);
      } else if (isPickup) {
        data.direction = 'Європа-УК';
        data.dateTrip = dateTrip;
        data.timing = timing;
        data.city = city;
        data.senderName = senderName;
        data.senderPhone = senderPhone;
        data.addrFrom = addrFrom;
        data.pkgDesc = pkgDesc;
        data.note = note;
      } else {
        data.direction = 'отримання';
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

          {/* ===== PACKAGE FORM ===== */}
          {itemType === 'посилка' && (
            <>
              {/* Direction toggle */}
              {!forceShipping && (
              <div className="flex gap-2">
                <button onClick={() => setDirection('отримання')}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-bold text-center cursor-pointer transition-all ${
                    direction === 'отримання' ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                  }`}>
                  Заїзд EU→UA
                </button>
                <button onClick={() => setDirection('відправка')}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-bold text-center cursor-pointer transition-all ${
                    direction === 'відправка' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                  }`}>
                  <Send className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Відправка
                </button>
              </div>
              )}

              {/* ===== ВІДПРАВКА FORM ===== */}
              {isShipping ? (
                <>
                  {/* 1. Внутрішній номер */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-muted uppercase">
                        <Hash className="w-3 h-3 inline mr-0.5 -mt-0.5" />Внутрішній номер *
                      </label>
                      <span className="text-[10px] text-blue-500 font-semibold">
                        {loadingNum ? 'Завантаження...' : lastInternalNum ? `Попередній: ${lastInternalNum}` : 'Немає записів'}
                      </span>
                    </div>
                    {(() => {
                      const isDup = !!internalNum.trim() && usedInternalNums.has(internalNum.trim());
                      return (
                        <>
                          <input type="text" value={internalNum} onChange={(e) => setInternalNum(e.target.value)}
                            placeholder={lastInternalNum ? String(Number(lastInternalNum) + 1) : '1'}
                            className={`w-full px-3 py-2.5 border rounded-xl text-sm placeholder:text-gray-300 focus:outline-none font-bold text-center text-lg ${
                              isDup
                                ? 'bg-red-50 border-red-400 text-red-700 focus:border-red-500'
                                : 'bg-gray-50 border-gray-200 text-text focus:border-brand'
                            }`} />
                          {isDup && (
                            <div className="mt-1 text-[11px] font-bold text-red-600">
                              ⚠️ № {internalNum.trim()} вже існує — обери інший, інакше буде дубль
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* 2. Відправник */}
                  <div className="bg-emerald-50/50 rounded-xl p-2.5 space-y-2">
                    <label className="text-[11px] font-semibold text-emerald-600 uppercase">Відправник</label>
                    <div className="relative">
                      <Field label="Тел. або ІД *" value={senderPhone} onChange={setSenderPhone} placeholder="+380... або ID"
                        onBlur={() => doArchiveSearch(senderPhone)} />
                      {senderPhone.trim().length >= 5 && !archiveFilled && (
                        <button onClick={() => doArchiveSearch(senderPhone)}
                          className="absolute right-2 top-6 p-1 rounded-lg hover:bg-emerald-100 cursor-pointer">
                          <Search className="w-3.5 h-3.5 text-emerald-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3. Отримувач */}
                  <div className="bg-blue-50/50 rounded-xl p-2.5 space-y-2">
                    <label className="text-[11px] font-semibold text-blue-600 uppercase">Отримувач</label>
                    <div className="relative">
                      <Field label="Телефон *" value={recipientPhone} onChange={setRecipientPhone} placeholder="+380..." type="tel"
                        onBlur={() => { handleRecipientPhoneBlur(); doArchiveSearch(recipientPhone); }} />
                      {recipientPhone.trim().length >= 5 && !archiveFilled && (
                        <button onClick={() => doArchiveSearch(recipientPhone)}
                          className="absolute right-2 top-6 p-1 rounded-lg hover:bg-blue-100 cursor-pointer">
                          <Search className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                      )}
                    </div>
                    <Field label="ПІБ" value={recipientName} onChange={setRecipientName} placeholder="ПІБ отримувача" />
                    <Field label="Адреса" value={recipientAddr} onChange={setRecipientAddr} placeholder="Місто, вулиця..." />
                  </div>

                  {/* Archive search results */}
                  {archiveSearching && (
                    <div className="text-center text-[11px] text-blue-500 font-semibold py-2">Пошук в архіві...</div>
                  )}
                  {archiveResults.length > 0 && (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-violet-700">Знайдено в архіві:</span>
                        {archiveTotalMatches > 5 && (
                          <span className="text-[10px] font-semibold text-violet-500">ще {archiveTotalMatches - 5} записів</span>
                        )}
                      </div>
                      {archiveResults.map((m, i) => (
                        <button key={i} onClick={() => applyArchiveMatch(m)}
                          className="w-full text-left px-2.5 py-2 bg-white rounded-lg border border-violet-100 hover:border-violet-300 cursor-pointer transition-all active:scale-[0.98]">
                          <div className="text-[12px] font-bold text-text">{m.recipientName || '—'}</div>
                          <div className="text-[10px] text-secondary">{m.recipientPhone} {m.recipientAddr ? '· ' + m.recipientAddr : ''}</div>
                          <div className="text-[9px] text-violet-400 mt-0.5">{m.dateArchive} · {m.senderPhone}</div>
                          {archiveTotalMatches > 3 && i === 0 && (
                            <div className="text-[9px] font-bold text-amber-600 mt-0.5">Мін. {archiveTotalMatches} заявок на цю людину</div>
                          )}
                        </button>
                      ))}
                      <button onClick={() => setArchiveResults([])}
                        className="w-full text-center text-[10px] text-violet-400 hover:text-violet-600 py-1 cursor-pointer">
                        Закрити
                      </button>
                    </div>
                  )}

                  {/* 4. Опис вантажу з автокомплітом */}
                  <div ref={suggestionsRef}>
                    <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Опис вантажу</label>
                    <input type="text" value={pkgDesc}
                      onChange={(e) => { setPkgDesc(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      placeholder="Почніть вводити..."
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text placeholder:text-gray-300 focus:outline-none focus:border-brand" />
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-sm max-h-32 overflow-y-auto">
                        {filteredSuggestions.map((s) => (
                          <button key={s} onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setPkgDesc(s); setShowSuggestions(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-text hover:bg-blue-50 cursor-pointer first:rounded-t-xl last:rounded-b-xl">
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5. К-сть місць + Вага */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted uppercase mb-1">К-сть місць</label>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPkgPieces(String(Math.max(1, (parseInt(pkgPieces) || 1) - 1)))}
                          className="w-7 h-9 shrink-0 rounded-lg bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center cursor-pointer active:scale-95 transition-all">−</button>
                        <input type="number" value={pkgPieces} onChange={(e) => setPkgPieces(e.target.value)}
                          className="flex-1 min-w-0 px-1 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-text text-center font-bold focus:outline-none focus:border-brand" />
                        <button onClick={() => setPkgPieces(String((parseInt(pkgPieces) || 0) + 1))}
                          className="w-7 h-9 shrink-0 rounded-lg bg-blue-500 text-white font-bold text-sm flex items-center justify-center cursor-pointer active:scale-95 transition-all">+</button>
                      </div>
                    </div>
                    <Field label="Вага (кг)" value={pkgWeight} onChange={setPkgWeight} placeholder="кг" type="number" />
                  </div>

                  {/* 6. Оціночна вартість */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Оціночна вартість *</label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text placeholder:text-gray-300 focus:outline-none focus:border-brand" />
                    <div className="flex gap-1.5 mt-1.5">
                      {['50', '100', '200', '500'].map((v) => (
                        <button key={v} onClick={() => setAmount(v)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                            amount === v ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>{v}</button>
                      ))}
                    </div>
                  </div>

                  {/* 6.5 Фото посилки — дві кнопки: пряма камера + галерея.
                       Заливаємо у package-photos bucket; URL зберігаємо у state
                       і передаємо у addRouteItem → dispatches.photo_url. */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted uppercase mb-1">📷 Фото посилки</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => photoCamRef.current?.click()} disabled={photoUploading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-800 text-[12px] font-bold cursor-pointer active:scale-95 transition-all disabled:opacity-50">
                        <Camera className="w-4 h-4" /> Сфотографувати
                      </button>
                      <button type="button" onClick={() => photoGalRef.current?.click()} disabled={photoUploading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-blue-300 bg-blue-50 text-blue-700 text-[12px] font-bold cursor-pointer active:scale-95 transition-all disabled:opacity-50">
                        <ImageIcon className="w-4 h-4" /> Галерея
                      </button>
                    </div>
                    <input ref={photoCamRef} type="file" accept="image/*" capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => { handlePhotoFile(e.target.files?.[0] || null); e.target.value = ''; }} />
                    <input ref={photoGalRef} type="file" accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => { handlePhotoFile(e.target.files?.[0] || null); e.target.value = ''; }} />
                    {photoUploading && (
                      <div className="text-[11px] text-amber-700 mt-1.5">⏳ Завантаження…</div>
                    )}
                    {photoUrl && !photoUploading && (
                      <div className="mt-2 relative">
                        <img src={photoUrl} alt="Превʼю"
                          className="max-h-44 w-full object-contain rounded-xl border border-gray-200 bg-gray-50" />
                        <button type="button" onClick={() => setPhotoUrl('')}
                          className="absolute top-1.5 right-1.5 px-2 py-1 rounded-lg bg-red-100 text-red-700 text-[10px] font-bold cursor-pointer">
                          ✕ Очистити
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 7. Оплата */}
                  <div className="bg-gray-50/80 rounded-xl p-2.5 space-y-2">
                    <label className="text-[11px] font-semibold text-text uppercase">Оплата</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Сума" value={paymentAmount} onChange={setPaymentAmount} placeholder="0" type="number" />
                      <div>
                        <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Валюта</label>
                        <div className="flex gap-1">
                          {['CHF', 'EUR', 'UAH', 'USD'].map((c) => (
                            <button key={c} onClick={() => setCurrency(c)}
                              className={`flex-1 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                                currency === c ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                              }`}>{c}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Форма оплати</label>
                      <div className="flex gap-1">
                        {['Готівка', 'Картка', 'Наложка', 'Борг', 'Частково'].map((f) => (
                          <button key={f} onClick={() => setPayForm(f)}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                              payForm === f ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                            }`}>{f}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 8. Пакетик (cash envelope) */}
                  <div className="bg-amber-50/50 rounded-xl p-2.5 space-y-2">
                    <label className="text-[11px] font-semibold text-amber-600 uppercase">Пакетик (готівка)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Сума" value={depositAmount} onChange={setDepositAmount} placeholder="0" type="number" />
                      <div>
                        <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Валюта</label>
                        <div className="flex gap-1">
                          {['CHF', 'EUR', 'UAH', 'USD'].map((c) => (
                            <button key={c} onClick={() => setDepositCurrency(c)}
                              className={`flex-1 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                                depositCurrency === c ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                              }`}>{c}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* ===== ЗАЇЗД ЗА ПОСИЛКОЮ (EU→UA) ===== */
                <>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 text-[11px] text-orange-700 font-semibold">
                    Заїзд до клієнта в Європі — забрати посилку для відправки в Україну. Обовʼязкові тільки телефон і адреса.
                  </div>
                  <Field label="Імʼя клієнта" value={senderName} onChange={setSenderName} placeholder="ПІБ" />
                  <Field label="Телефон *" value={senderPhone} onChange={setSenderPhone} placeholder="+380... / +41..." type="tel" />
                  <Field label="Адреса забору *" value={addrFrom} onChange={setAddrFrom} placeholder="Країна, місто, вулиця..." />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Дата заїзду" value={dateTrip} onChange={setDateTrip} type="date" />
                    <Field label="Час" value={timing} onChange={setTiming} placeholder="14:00" />
                  </div>
                  <Field label="Місто" value={city} onChange={setCity} placeholder="Цюріх" />
                  <Field label="Опис посилки" value={pkgDesc} onChange={setPkgDesc} placeholder="Що забираємо" />
                  <Field label="Примітка" value={note} onChange={setNote} placeholder="Деталі, побажання" />
                </>
              )}
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

function Field({ label, value, onChange, placeholder, type, onBlur }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; onBlur?: () => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted uppercase mb-1">{label}</label>
      <input type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onBlur={onBlur}
        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text placeholder:text-gray-300 focus:outline-none focus:border-brand" />
    </div>
  );
}
