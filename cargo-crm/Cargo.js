// ================================================================
// PWA: Shared Manifest + Service Worker
// manifest.php та sw.js лежать на рівні /BotiLogistics-v1.0/ —
// scope покриває обидва модулі (passenger-crm + cargo-crm), тому
// одне встановлення PWA працює для обох.
// ================================================================
(function() {
    // Read session
    var _sess = null;
    try { _sess = JSON.parse(localStorage.getItem('boti_session') || 'null'); } catch(_) {}
    var _tenantName = (_sess && _sess.tenant_name) ? _sess.tenant_name : '';
    var _logoUrl = (_sess && _sess.logo_url) ? _sess.logo_url : '';

    // Cookies (для PHP-сторінок сусіднього модуля — passenger-crm читає їх для Safari meta)
    if (_tenantName) {
        document.cookie = 'boti_tenant=' + encodeURIComponent(_tenantName) + ';path=/;max-age=31536000;SameSite=Lax';
    }
    if (_logoUrl) {
        document.cookie = 'boti_logo=' + encodeURIComponent(_logoUrl) + ';path=/;max-age=31536000;SameSite=Lax';
    }

    // Update manifest link (tag injected in HTML with id="pwaManifest")
    var manifestLink = document.getElementById('pwaManifest') || document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
        var params = [];
        if (_tenantName) params.push('name=' + encodeURIComponent(_tenantName));
        if (_logoUrl) params.push('logo=' + encodeURIComponent(_logoUrl));
        // start_url → ця сторінка (cargo-crm), щоб якщо юзер встановить звідси,
        // додаток відкривався саме на cargo-crm
        params.push('start=' + encodeURIComponent('cargo-crm/Cargo.html'));
        manifestLink.href = '../manifest.php?' + params.join('&');
    }

    // Update meta tags with tenant name
    if (_tenantName) {
        var metaAppTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (metaAppTitle) metaAppTitle.setAttribute('content', _tenantName);
        var metaAppName = document.querySelector('meta[name="application-name"]');
        if (metaAppName) metaAppName.setAttribute('content', _tenantName + ' CRM');
    }

    // Update apple-touch-icon if custom logo exists
    if (_logoUrl) {
        var appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (appleIcon) appleIcon.href = _logoUrl;
        var iconLink = document.querySelector('link[rel="icon"]');
        if (iconLink) iconLink.href = _logoUrl;
    }

    // Shared Service Worker — scope '../' покриває і passenger-crm/, і cargo-crm/
    if ('serviceWorker' in navigator) {
        // Спочатку прибираємо старі per-module SW (passenger-crm/sw.js, cargo-crm/sw.js) —
        // інакше їхній вужчий scope переважає над спільним SW і ламає кеш.
        navigator.serviceWorker.getRegistrations().then(function(regs) {
            regs.forEach(function(reg) {
                if (reg.scope && /\/(passenger-crm|cargo-crm)\/?$/.test(reg.scope)) {
                    reg.unregister();
                }
            });
        }).catch(function() {});
        navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function() {});
    }
})();

// Раннє оголошення функцій для onclick в HTML
window.openRouteView = function(idx) { if (typeof openRoute === 'function') openRoute(idx); else alert('Маршрути ще завантажуються'); };
// ╔══════════════════════════════════════════════════════════════╗
// ║  BotiLogistics CRM — Посилкова система                       ║
// ║                                                              ║
// ║  ЗМІСТ (Ctrl+F для навігації):                               ║
// ║  [SECT-CONFIG]   — Конфігурація, URL, константи              ║
// ║  [SECT-STATE]    — Глобальний стан (allData, filters)        ║
// ║  [SECT-COLUMNS]  — Конфігуратор колонок картки               ║
// ║  [SECT-API]      — API модуль (fetch → GAS)                  ║
// ║  [SECT-TOAST]    — Toast-повідомлення                        ║
// ║  [SECT-MOCK]     — Mock API (для тестування без GAS)         ║
// ║  [SECT-INIT]     — Ініціалізація (DOMContentLoaded)          ║
// ║  [SECT-FILTER]   — Фільтрація даних                          ║
// ║  [SECT-RENDER]   — Рендер карток (renderCards, renderCard)   ║
// ║  [SECT-DETAIL]   — Деталі картки (tabs, grid)               ║
// ║  [SECT-INTERACT] — Взаємодії (toggle, inline edit, save)    ║
// ║  [SECT-DROPDOWN] — Dropdown опції полів                      ║
// ║  [SECT-BULK]     — Масові дії (bulk select/delete/route)    ║
// ║  [SECT-VERIFY]   — Перевірка посилок (verification)         ║
// ║  [SECT-SIDEBAR]  — Бокова панель + фільтри                  ║
// ║  [SECT-COUNTERS] — Лічильники                                ║
// ║  [SECT-ARCHIVE]  — Архів лідів (архівування/відновлення)    ║
// ║  [SECT-ADDFORM]  — Форма створення посилки                  ║
// ║  [SECT-SMS]      — SMS парсер                                ║
// ║  [SECT-DUPL]     — Перевірка дублікатів                     ║
// ║  [SECT-SAVE]     — Збереження посилки                       ║
// ╚══════════════════════════════════════════════════════════════╝

// ===== [SECT-CONFIG] КОНФІГУРАЦІЯ =====
// GAS Web App URLs
const GAS_URL_POSYLKI = 'https://script.google.com/macros/s/AKfycbzTLwKLzOlyZV_xUagXlAMY4mJK2d2HOG889T4IB-1xc9rmegnhCGEwn9W_doFDiW9nJA/exec';
const GAS_URL = GAS_URL_POSYLKI;
const PASAZHYRY_URL = 'https://botisystem.com/BotiLogistics-v1.0/passenger-crm';
const USE_MOCK = false;

// ===== [SECT-STATE] GLOBAL STATE =====
let allData = [];
let filteredData = [];
let currentDirection = 'ue';
let currentFilter = 'all';
let currentVerifyFilter = 'all';
let currentPayFilter = 'all';
let searchQuery = '';

// Поля, по яких працює пошук (узгоджено з тим, що бачить юзер у картці)
const SEARCHABLE_PKG_FIELDS = [
  'PKG_ID', 'Ід_смарт',
  'Піб відправника', 'Телефон відправника', 'Телефон реєстратора',
  'Піб отримувача', 'Телефон отримувача',
  'Адреса відправки', 'Адреса в Європі', 'Місто Нова Пошта',
  'Номер ТТН', 'Внутрішній №',
  'Опис', 'Деталі',
  'Тег', 'Примітка', 'Примітка СМС',
  'Номер авто', 'RTE_ID',
];

// Підсвічування знайденого фрагмента в тексті картки.
// Повертає БЕЗПЕЧНИЙ HTML — спочатку екранує текст, потім обгортає
// збіги у <mark class="search-hl">. Викликати лише з searchQuery !== ''.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function highlightMatch(text) {
  const safe = escapeHtml(text == null ? '' : text);
  if (!searchQuery) return safe;
  const re = new RegExp('(' + escapeRegExp(searchQuery) + ')', 'gi');
  return safe.replace(re, '<mark class="search-hl">$1</mark>');
}
let openCardId = null;
let stats = {};
let routes = [];
let dispatches = [];
let expenses = [];
let routeSummary = null;
let activeRouteIdx = null;
let currentView = 'parcels'; // 'parcels' | 'route' | 'dispatch' | 'expenses' | 'summary'
let routeData = []; // current route sheet data
let routeFilterType = 'all'; // all | pax | parcel
let routeFilterStatus = 'all';
let routeFilterPay = 'all';
let routeTypeFilter = 'all';
let routeStatusFilter = 'all';
let routePayFilter = 'all';
let routeSelectedIds = new Set();
let routeOpenDetailsId = null;
let routeOpenActionsId = null;
let _routeForceRefresh = false;
let _routeToolbarForceOpen = false;
let confirmCallback = null;
let openRouteDetailId = null;
let selectedIds = new Set();
let isLoading = false;
let addFormDirection = 'ue';
let deliveryType = 'np';
let showArchive = false;
let archiveData = [];

// Owner-configurable route points loaded from passenger_route_points
// table (same catalogue that owner-crm's RoutePointsPanel manages).
// Populated by loadRoutePointsCatalog(); empty until fetch resolves.
// Shape: [{ city, addr }] where city=name_ua, addr=location_name.
let SWISS_POINTS = [];

// ===== [SECT-COLUMNS] COLUMN CONFIGURATOR =====
const ALL_CARD_COLUMNS = [
  { key: 'phone',       label: '📞 Телефон реєстратора' },
  { key: 'phoneRecv',   label: '📱 Телефон отримувача' },
  { key: 'weight',      label: '⚖️ Вага (кг)' },
  { key: 'sum',         label: '💰 Сума' },
  { key: 'deposit',     label: '💵 Завдаток' },
  { key: 'debt',        label: '📛 Борг' },
  { key: 'ttn',         label: '📋 Номер ТТН' },
  { key: 'date',        label: '📅 Дата створення' },
  { key: 'statusPkg',   label: '📦 Статус посилки' },
  { key: 'tag',         label: '🏷️ Тег' },
  { key: 'address',     label: '📍 Адреса маршруту' },
  { key: 'leadBadge',   label: '🔵 Статус ліда' },
  { key: 'payBadge',    label: '💳 Статус оплати' },
  { key: 'checkBadge',  label: '✅ Контроль перевірки' },
  { key: 'route',       label: '🚐 Маршрут / Рейс' },
  { key: 'note',        label: '📝 Примітка' },
  { key: 'description', label: '📄 Опис посилки' },
  { key: 'qty',         label: '📊 Кількість позицій' },
  { key: 'estValue',    label: '💎 Оціночна вартість' },
];

const ALL_OSNOVNE_COLUMNS = [
  { key: 'sender',      label: '👤 Піб відправника' },
  { key: 'phone',       label: '📞 Телефон реєстратора' },
  { key: 'addressFrom', label: '📍 Адреса відправки' },
  { key: 'receiver',    label: '👤 Піб отримувача' },
  { key: 'phoneRecv',   label: '📱 Телефон отримувача' },
  { key: 'addressTo',   label: '📍 Адреса доставки' },
  { key: 'leadStatus',  label: '🔵 Статус ліда' },
  { key: 'tag',         label: '🏷️ Тег' },
];

const ALL_PARCEL_COLUMNS = [
  { key: 'description', label: '📄 Опис' },
  { key: 'details',     label: '📝 Деталі' },
  { key: 'qty',         label: '📊 Кількість позицій' },
  { key: 'weight',      label: '⚖️ Кг' },
  { key: 'estValue',    label: '💎 Оціночна вартість' },
  { key: 'ttn',         label: '📋 Номер ТТН' },
  { key: 'innerNum',    label: '🔢 Внутрішній №' },
  { key: 'statusPkg',   label: '📦 Статус посилки' },
  { key: 'sum',         label: '💰 Сума' },
  { key: 'currency',    label: '💱 Валюта оплати' },
  { key: 'payStatus',   label: '💳 Статус оплати' },
  { key: 'photo',       label: '📸 Фото посилки' },
  { key: 'rating',      label: '⭐ Рейтинг' },
  { key: 'ratingComment',label: '💬 Коментар рейтингу' },
];

const DEFAULT_CARD_COLS = ['phone','weight','sum','deposit','debt','ttn','date','statusPkg','tag','address','leadBadge','payBadge','checkBadge','route'];
const DEFAULT_OSNOVNE_COLS = ['sender','phone','addressFrom','receiver','phoneRecv','addressTo','leadStatus','tag'];
const DEFAULT_PARCEL_COLS = ['description','details','qty','weight','estValue','ttn','innerNum','statusPkg','sum','currency','payStatus','photo','rating','ratingComment'];

const LS_KEY_CARD = 'esco_posylki_card_cols';
const LS_KEY_OSNOVNE = 'esco_pkg_osnovne';
const LS_KEY_PARCEL = 'esco_pkg_parcel';

let colCfgMode = 'card';
let colCfgTemp = [];

function getVisibleCardColumns() {
  try { const s = localStorage.getItem(LS_KEY_CARD); if (s) return JSON.parse(s); } catch(e) {}
  return [...DEFAULT_CARD_COLS];
}
function getVisibleOsnovneColumns() {
  try { const s = localStorage.getItem(LS_KEY_OSNOVNE); if (s) return JSON.parse(s); } catch(e) {}
  return [...DEFAULT_OSNOVNE_COLS];
}
function getVisibleParcelColumns() {
  try { const s = localStorage.getItem(LS_KEY_PARCEL); if (s) return JSON.parse(s); } catch(e) {}
  return [...DEFAULT_PARCEL_COLS];
}

function getCfgDataForMode(mode) {
  if (mode === 'card') return { all: ALL_CARD_COLUMNS, saved: getVisibleCardColumns(), lsKey: LS_KEY_CARD, defaults: DEFAULT_CARD_COLS, subtitle: 'Які поля показувати на картці ліда' };
  if (mode === 'osnovne') return { all: ALL_OSNOVNE_COLUMNS, saved: getVisibleOsnovneColumns(), lsKey: LS_KEY_OSNOVNE, defaults: DEFAULT_OSNOVNE_COLS, subtitle: 'Поля на вкладці «Основне» в деталях' };
  return { all: ALL_PARCEL_COLUMNS, saved: getVisibleParcelColumns(), lsKey: LS_KEY_PARCEL, defaults: DEFAULT_PARCEL_COLS, subtitle: 'Поля на вкладці «Посилка» в деталях' };
}

function openColCfg() {
  colCfgMode = 'card';
  const cfg = getCfgDataForMode('card');
  colCfgTemp = [...cfg.saved];
  document.getElementById('colCfgOverlay').classList.add('open');
  renderCfgTabs();
  renderCfgList();
}

function closeColCfg() {
  document.getElementById('colCfgOverlay').classList.remove('open');
}

function switchCfgTab(mode) {
  colCfgMode = mode;
  const cfg = getCfgDataForMode(mode);
  colCfgTemp = [...cfg.saved];
  renderCfgTabs();
  renderCfgList();
}

function renderCfgTabs() {
  document.querySelectorAll('#colCfgTabs .colcfg-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === colCfgMode);
  });
  const cfg = getCfgDataForMode(colCfgMode);
  document.getElementById('colCfgSubtitle').textContent = cfg.subtitle;
}

function getOtherModesKeys() {
  const modes = ['card','osnovne','parcel'].filter(m => m !== colCfgMode);
  const keys = new Set();
  modes.forEach(m => {
    const cfg = getCfgDataForMode(m);
    cfg.saved.forEach(k => keys.add(k));
  });
  return keys;
}

function renderCfgList() {
  const cfg = getCfgDataForMode(colCfgMode);
  const container = document.getElementById('colCfgList');
  const otherKeys = getOtherModesKeys();

  container.innerHTML = cfg.all.map(col => {
    const isChecked = colCfgTemp.includes(col.key);
    const isInOther = false; // Don't disable — same key can be in multiple tabs
    return `
      <div class="colcfg-item ${isChecked ? 'checked' : ''}" onclick="toggleCfgCol('${col.key}')">
        <div class="colcfg-check">${isChecked ? '✓' : ''}</div>
        <span class="colcfg-item-label">${col.label}</span>
      </div>`;
  }).join('');

  document.getElementById('colCfgCount').textContent = colCfgTemp.length + ' обрано з ' + cfg.all.length;
}

function toggleCfgCol(key) {
  const idx = colCfgTemp.indexOf(key);
  if (idx >= 0) colCfgTemp.splice(idx, 1);
  else colCfgTemp.push(key);
  renderCfgList();
}

function saveColCfg() {
  if (colCfgTemp.length === 0) {
    showToast('Оберіть хоча б 1 поле', 'error');
    return;
  }
  const cfg = getCfgDataForMode(colCfgMode);
  localStorage.setItem(cfg.lsKey, JSON.stringify(colCfgTemp));
  showToast('Налаштування збережено', 'success');
  closeColCfg();
  renderCards();
}

function resetColCfg() {
  const cfg = getCfgDataForMode(colCfgMode);
  colCfgTemp = [...cfg.defaults];
  renderCfgList();
  showToast('Скинуто до стандартних', 'info');
}

// ===== [SECT-API] API MODULE =====
async function apiPost(action, params = {}) {
  if (USE_MOCK) return mockApi(action, params);

  const syncEl = document.getElementById('syncStatus');
  syncEl.textContent = '⏳ Завантаження...';
  syncEl.style.color = '#f59e0b';

  try {
    // Route through Supabase API layer (supabase-api.js)
    const data = await apiPostSupabase(action, params);

    syncEl.textContent = '✓ Синхронізовано';
    syncEl.style.color = 'rgba(255,255,255,0.5)';

    if (!data.ok) {
      console.error('API error:', data.error);
      showToast('Помилка: ' + data.error, 'error');
    }
    return data;
  } catch (err) {
    syncEl.textContent = '✗ Помилка зв\'язку';
    syncEl.style.color = '#ef4444';
    console.error('Fetch error:', err);
    showToast('Немає зв\'язку з сервером', 'error');
    return { ok: false, error: err.message };
  }
}

// ===== [SECT-TOAST] TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    padding:10px 20px;border-radius:8px;font-size:12px;font-weight:600;
    font-family:inherit;z-index:9999;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.15);
    transition:opacity 0.3s;
  `;
  toast.style.background = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ===== [SECT-MOCK] MOCK API (fallback коли нема GAS URL) =====
function mockApi(action, params) {
  // Маппінг GAS полів → фронтенд полів для пасажирів
  function gasToFrontend(pax) {
    return {
      'PKG_ID': pax['PAX_ID'] || pax['PKG_ID'] || '',
      'Напрям': pax['Напрям'] || 'УК→ЄВ',
      'Тип запису': 'Пасажир',
      'Піб відправника': pax['Піб пасажира'] || pax['Піб відправника'] || '',
      'Телефон реєстратора': pax['Телефон пасажира'] || pax['Телефон реєстратора'] || '',
      'Адреса відправки': pax['Адреса відправки'] || '',
      'Адреса в Європі': pax['Адреса прибуття'] || pax['Адреса в Європі'] || '',
      'Кг': pax['Вага багажу'] || pax['Кг'] || '',
      'Сума': pax['Сума'] || '',
      'Валюта оплати': pax['Валюта'] || pax['Валюта оплати'] || 'UAH',
      'Завдаток': pax['Завдаток'] || '0',
      'Борг': pax['Борг'] || '0',
      'Статус оплати': pax['Статус оплати'] || 'Не оплачено',
      'Статус ліда': pax['Статус ліда'] || 'Новий',
      'Статус CRM': pax['Статус CRM'] || 'Активний',
      'Номер авто': pax['Номер авто'] || '',
      'RTE_ID': pax['RTE_ID'] || '',
      'Примітка': pax['Примітка'] || '',
      'Місця': pax['Кількість місць'] || pax['Місця'] || '1',
      'Контроль перевірки': pax['Контроль перевірки'] || '',
      'Дата перевірки': pax['Дата перевірки'] || ''
    };
  }

  const MOCK_PASSENGERS = [
    {
      'PAX_ID': 'PAX_001', 'Напрям': 'УК→ЄВ',
      'Піб пасажира': 'Бондаренко Андрій Вікторович',
      'Телефон пасажира': '+380661234567',
      'Адреса відправки': 'м. Київ, вул. Саксаганського 15',
      'Адреса прибуття': 'Warszawa, ul. Marszałkowska 1',
      'Кількість місць': '2', 'Вага багажу': '25',
      'Сума': '2500', 'Валюта': 'UAH', 'Завдаток': '2500', 'Борг': '0',
      'Статус оплати': 'Оплачено', 'Статус ліда': 'Підтверджено', 'Статус CRM': 'Активний',
      'Номер авто': 'АА 1234 ВВ', 'RTE_ID': 'RTE_001', 'Примітка': '2 місця'
    },
    {
      'PAX_ID': 'PAX_002', 'Напрям': 'УК→ЄВ',
      'Піб пасажира': 'Литвиненко Оксана Ігорівна',
      'Телефон пасажира': '+380971234567',
      'Адреса відправки': 'м. Харків, вул. Сумська 25',
      'Адреса прибуття': 'Praha, Václavské nám. 1',
      'Кількість місць': '1', 'Вага багажу': '20',
      'Сума': '3000', 'Валюта': 'CZK', 'Завдаток': '1000', 'Борг': '2000',
      'Статус оплати': 'Частково', 'Статус ліда': 'В роботі', 'Статус CRM': 'Активний',
      'Номер авто': '', 'RTE_ID': '', 'Примітка': '1 місце + багаж'
    },
    {
      'PAX_ID': 'PAX_003', 'Напрям': 'ЄВ→УК',
      'Піб пасажира': 'Müller Friedrich',
      'Телефон пасажира': '+4917600112233',
      'Адреса відправки': 'Frankfurt, Zeil 15',
      'Адреса прибуття': 'м. Одеса',
      'Кількість місць': '1', 'Вага багажу': '30',
      'Сума': '55', 'Валюта': 'EUR', 'Завдаток': '55', 'Борг': '0',
      'Статус оплати': 'Оплачено', 'Статус ліда': 'Підтверджено', 'Статус CRM': 'Активний',
      'Номер авто': 'BC 4567 DE', 'RTE_ID': 'RTE_002', 'Примітка': '1 місце'
    },
    {
      'PAX_ID': 'PAX_004', 'Напрям': 'УК→ЄВ',
      'Піб пасажира': 'Ткаченко Марина Василівна',
      'Телефон пасажира': '+380501234567',
      'Адреса відправки': 'м. Вінниця, вул. Соборна 10',
      'Адреса прибуття': 'Berlin, Kurfürstendamm 5',
      'Кількість місць': '1', 'Вага багажу': '15',
      'Сума': '1800', 'Валюта': 'UAH', 'Завдаток': '0', 'Борг': '1800',
      'Статус оплати': 'Не оплачено', 'Статус ліда': 'Новий', 'Статус CRM': 'Активний',
      'Номер авто': '', 'RTE_ID': '', 'Примітка': ''
    },
    {
      'PAX_ID': 'PAX_005', 'Напрям': 'ЄВ→УК',
      'Піб пасажира': 'Kowalski Jan',
      'Телефон пасажира': '+48501234567',
      'Адреса відправки': 'Kraków, Rynek Główny 1',
      'Адреса прибуття': 'м. Львів, вул. Городоцька 50',
      'Кількість місць': '2', 'Вага багажу': '40',
      'Сума': '200', 'Валюта': 'PLN', 'Завдаток': '100', 'Борг': '100',
      'Статус оплати': 'Частково', 'Статус ліда': 'В роботі', 'Статус CRM': 'Активний',
      'Номер авто': '', 'RTE_ID': '', 'Примітка': '2 великі валізи'
    },
    {
      'PAX_ID': 'PAX_006', 'Напрям': 'УК→ЄВ',
      'Піб пасажира': 'Кравченко Олег Дмитрович',
      'Телефон пасажира': '+380671112233',
      'Адреса відправки': 'м. Запоріжжя, пр. Соборний 100',
      'Адреса прибуття': 'München, Hauptbahnhof',
      'Кількість місць': '1', 'Вага багажу': '10',
      'Сума': '2200', 'Валюта': 'UAH', 'Завдаток': '2200', 'Борг': '0',
      'Статус оплати': 'Оплачено', 'Статус ліда': 'Відмова', 'Статус CRM': 'Активний',
      'Номер авто': '', 'RTE_ID': '', 'Примітка': 'Скасував поїздку'
    }
  ];

  switch (action) {
    case 'getPassengers':
      return { ok: true, data: MOCK_PASSENGERS.map(gasToFrontend), count: MOCK_PASSENGERS.length };
    case 'getPassengerStats':
      return { ok: true, stats: { total: 6, ue: 4, eu: 2, byStatus: { 'Новий': 1, 'В роботі': 2, 'Підтверджено': 2, 'Відмова': 1 }, byPay: { 'Оплачено': 3, 'Частково': 2, 'Не оплачено': 1 }, totalDebt: 3900, totalSeats: 8 } };
    case 'addPassenger':
      return { ok: true, pax_id: 'PAX_NEW_' + Date.now() };
    case 'addParcel':
      return { ok: true, pkg_id: 'PKG_NEW_' + Date.now() };
    case 'updatePassengerField':
    case 'updateField':
      return { ok: true };
    case 'deletePassenger':
    case 'deleteParcel':
      return { ok: true };
    default:
      return { ok: true, data: [] };
  }
}

const MOCK_ROUTES = [
  { sheetName: 'Маршрут_Цюріх', rowCount: 5, paxCount: 2, parcelCount: 3, rows: null },
  { sheetName: 'Маршрут_Берлін', rowCount: 3, paxCount: 1, parcelCount: 2, rows: null },
  { sheetName: 'Маршрут_Варшава', rowCount: 4, paxCount: 2, parcelCount: 2, rows: null }
];

// ===== [SECT-INIT] INIT =====
function getBotiSession() {
  try { return JSON.parse(localStorage.getItem('boti_session') || 'null'); } catch (_) { return null; }
}

function getUserDisplayName() {
  const s = getBotiSession();
  if (!s) return '';
  return s.user_name || s.user_login || '';
}

function updateAvatarUI() {
  const name = getUserDisplayName();
  const avatar = document.getElementById('userAvatar');
  if (!avatar) return;
  if (name) {
    const initials = name.trim().split(/\s+/)
      .map(function(p) { return p[0] || ''; })
      .join('')
      .substring(0, 2)
      .toUpperCase();
    avatar.textContent = initials || '?';
    avatar.title = name;
  } else {
    avatar.textContent = '?';
    avatar.title = 'Увійти';
  }
}

function renderProfileSlots() {
  const session = getBotiSession();
  const container = document.getElementById('profileSlots');
  if (!container) return;

  if (!session) {
    container.innerHTML = '<div style="padding:16px;text-align:center;color:#6b7280;font-size:13px">Сесія відсутня. <a href="../config-crm/" style="color:var(--accent);font-weight:600">Увійти</a></div>';
    const closeNoSess = document.getElementById('profileModalClose');
    if (closeNoSess) closeNoSess.style.display = 'none';
    return;
  }

  const name = session.user_name || session.user_login || '—';
  const roleMap = { owner: 'Власник', manager: 'Менеджер', driver: 'Водій' };
  const roleLabel = roleMap[session.role] || session.role || '';
  const tenant = session.tenant_name || session.tenant_id || '';
  const initials = name.trim().split(/\s+/)
    .map(function(p) { return p[0] || ''; })
    .join('')
    .substring(0, 2)
    .toUpperCase();

  let html = '';
  html += '<div style="display:flex;align-items:center;gap:14px;padding:16px;border-radius:12px;border:2px solid var(--border);background:#f9fafb;margin-bottom:12px">';
  html += '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;flex-shrink:0">' + initials + '</div>';
  html += '<div style="flex:1;min-width:0">';
  html += '<div style="font-weight:700;font-size:15px;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</div>';
  if (roleLabel) html += '<div style="font-size:12px;color:#6b7280;margin-top:2px">' + roleLabel + '</div>';
  if (tenant)    html += '<div style="font-size:11px;color:#6b7280;margin-top:2px;opacity:.8">🏢 ' + tenant + '</div>';
  html += '</div>';
  html += '</div>';

  const roles = session.roles || [session.role];
  if (roles.indexOf('owner') !== -1) {
    html += '<button onclick="goToOwnerPanel()" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:10px;background:white;color:#6d28d9;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;transition:all .2s" onmouseover="this.style.background=\'#f5f3ff\';this.style.borderColor=\'#c4b5fd\'" onmouseout="this.style.background=\'white\';this.style.borderColor=\'var(--border)\'">';
    html += '<span>👑</span><span>Власницька панель</span>';
    html += '</button>';
  }

  html += '<button onclick="botiLogout()" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:10px;background:white;color:#dc2626;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s" onmouseover="this.style.background=\'#fef2f2\';this.style.borderColor=\'#fecaca\'" onmouseout="this.style.background=\'white\';this.style.borderColor=\'var(--border)\'">';
  html += '<span>🚪</span><span>Вийти</span>';
  html += '</button>';

  container.innerHTML = html;

  const closeBtn = document.getElementById('profileModalClose');
  if (closeBtn) closeBtn.style.display = '';
}

// ── PWA Install prompt ─────────────────────────────────────────────
var deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) banner.style.display = '';
}

function installApp() {
  if (deferredInstallPrompt) {
    // Chrome/Android — нативний промпт
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function(result) {
      if (result.outcome === 'accepted') {
        const s = getBotiSession();
        const tname = (s && s.tenant_name) || 'BotiLogistics';
        showToast(tname + ' встановлено!');
        const banner = document.getElementById('installBanner');
        if (banner) banner.style.display = 'none';
      }
      deferredInstallPrompt = null;
    });
  } else {
    // iOS / інші — показуємо інструкцію
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      showToast('Натисніть "Поділитися" (📤) внизу Safari, потім "На початковий екран"', 'info');
    } else {
      showToast('Відкрийте меню браузера (⋮) → "Додати на головний екран" або "Встановити додаток"', 'info');
    }
  }
}

function openProfileModal() {
  renderProfileSlots();
  document.getElementById('profileModal').classList.add('open');
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.remove('open');
}

function botiLogout() {
  localStorage.removeItem('boti_session');
  location.href = '../config-crm/';
}

function goToOwnerPanel() {
  try {
    const s = getBotiSession();
    if (s) {
      s.role = 'owner';
      localStorage.setItem('boti_session', JSON.stringify(s));
    }
  } catch (_) {}
  location.href = '../owner-crm/';
}

document.addEventListener('DOMContentLoaded', async function() {
  // Swap BotiLogistics brand with tenant name from session
  const _bs = getBotiSession();
  if (_bs && _bs.tenant_name) {
    const logoEl = document.querySelector('.logo');
    if (logoEl) logoEl.textContent = _bs.tenant_name;
  }

  updateAvatarUI();

  // Show install banner unless already running as installed PWA
  if (!window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) {
    showInstallBanner();
  }

  await loadData();
});

// ===== [SECT-FILTER] FILTERING =====
function filterData() {
  let data = allData.filter(p => p['Статус CRM'] !== 'Архів');

  // Direction filter
  if (currentDirection === 'ue') {
    data = data.filter(p => p['Напрям'] === 'УК→ЄВ');
  } else {
    data = data.filter(p => p['Напрям'] === 'ЄВ→УК');
  }

  // Verification filter (sidebar: Всі / В перевірці / Готові / Невідомі)
  if (currentVerifyFilter === 'checking') {
    data = data.filter(p => p['Контроль перевірки'] === 'В перевірці');
  } else if (currentVerifyFilter === 'ready') {
    data = data.filter(p => p['Контроль перевірки'] === 'Готова до маршруту');
  } else if (currentVerifyFilter === 'unknown') {
    data = data.filter(p => p['Статус ліда'] === 'Невідомий');
  }

  // Lead status filter (chip bar)
  if (currentFilter !== 'all') {
    data = data.filter(p => p['Статус ліда'] === currentFilter);
  }

  // Payment filter
  if (currentPayFilter !== 'all') {
    data = data.filter(p => p['Статус оплати'] === currentPayFilter);
  }

  // Search — шукаємо по всіх корисних полях посилки
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    data = data.filter(p => SEARCHABLE_PKG_FIELDS.some(f => {
      const v = p[f];
      if (v === undefined || v === null || v === '') return false;
      return String(v).toLowerCase().includes(q);
    }));
  }

  filteredData = data;
  return data;
}

// ===== [SECT-RENDER] RENDER CARDS =====
function renderCards() {
  try {
    // If archive mode is on, render archive cards instead
    if (showArchive) { renderArchiveCards(); return; }
    const data = filterData();
    const container = document.getElementById('cardsList');
    if (!container) { console.error('cardsList not found'); return; }

    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state">📭 Записів не знайдено</div>';
      return;
    }

    container.innerHTML = data.map(p => {
      try { return renderCard(p); }
      catch(e) { console.error('renderCard error for', p['PKG_ID'], e); return ''; }
    }).join('');
    updateCounters();
  } catch(e) {
    console.error('renderCards error:', e);
  }
}

// ===== [SECT-DETAIL] DETAIL BLOCK RENDERER =====
function renderDetailBlock(label, value, pkgId, opts = {}) {
  const v = (value !== undefined && value !== null) ? String(value).trim() : '';
  const isFilled = v && v !== '—' && v !== '0';
  const stateClass = opts.readonly ? 'readonly' : (isFilled ? 'filled' : 'empty');
  const displayVal = isFilled
    ? `<span class="val-text">${v}</span>`
    : `<span class="val-empty">—</span>`;
  const clickEdit = opts.readonly
    ? ''
    : `onclick="event.stopPropagation(); startInlineEdit(this, '${pkgId}', '${label.replace(/'/g, "\\'")}')"`;
  return `
    <div class="detail-block ${stateClass}">
      <span class="detail-block-label">${label}</span>
      <div class="detail-block-value" data-pkg="${pkgId}" data-col="${label}" ${clickEdit}>
        ${displayVal}
      </div>
    </div>`;
}

function renderDetailGrid(fields, pkgId, opts = {}) {
  return `<div class="details-grid">${fields.map(f => renderDetailBlock(f[0], f[1], pkgId, Object.assign({}, opts, f[2] || {}))).join('')}</div>`;
}

// ===== [SECT-CARD] RENDER SINGLE CARD =====
function renderCard(p) {
  const pkgId = p['PKG_ID'] || '';
  const name = p['Піб відправника'] || '';
  const phone = p['Телефон реєстратора'] || '';
  const receiver = p['Піб отримувача'] || '';
  const receiverPhone = p['Телефон отримувача'] || '';
  const direction = p['Напрям'] || '';
  const isUE = direction === 'УК→ЄВ';
  const dirBadgeClass = isUE ? 'dir-badge-ua-eu' : 'dir-badge-eu-ua';
  const dirLabel = isUE ? 'УК→ЄВ' : 'ЄВ→УК';
  const addressFrom = p['Адреса відправки'] || '';
  const addressTo = p['Адреса в Європі'] || p['Місто Нова Пошта'] || '';
  const weight = p['Кг'] || '';
  const price = p['Сума'] || '';
  const currency = p['Валюта оплати'] || '';
  const deposit = parseFloat(p['Завдаток']) || 0;
  const debt = parseFloat(p['Борг']) || 0;
  const payStatus = p['Статус оплати'] || '';
  const leadStatus = p['Статус ліда'] || '';
  const ttn = p['Номер ТТН'] || '';
  const auto = p['Номер авто'] || '';
  const note = p['Примітка'] || '';
  const dateCreated = p['Дата створення'] || '';
  const controlCheck = p['Контроль перевірки'] || '';
  const statusPkg = p['Статус посилки'] || '';
  const statusCrm = p['Статус CRM'] || '';
  const rteId = p['RTE_ID'] || '';
  const tag = p['Тег'] || '';
  const isOpen = openCardId === pkgId;

  // Status class
  let statusClass = '';
  if (controlCheck === 'Готова до маршруту') statusClass = 'status-ready';
  else if (controlCheck === 'В перевірці') statusClass = 'status-checking';
  else if (leadStatus === 'Новий') statusClass = 'status-new';
  else if (leadStatus === 'В роботі' || leadStatus === 'Активний') statusClass = 'status-work';
  else if (leadStatus === 'Підтверджено' || leadStatus === 'Зарахований') statusClass = 'status-confirmed';
  else if (leadStatus === 'Відмова') statusClass = 'status-refused';
  else if (leadStatus === 'Невідомий') statusClass = 'status-unknown';

  // Lead badge
  const leadBadgeMap = {
    'Новий': 'badge-new', 'В роботі': 'badge-work', 'Активний': 'badge-work',
    'Підтверджено': 'badge-confirmed', 'Зарахований': 'badge-confirmed',
    'Відмова': 'badge-refused', 'Невідомий': 'badge-unknown'
  };
  const leadBadge = leadStatus ? `<span class="badge ${leadBadgeMap[leadStatus] || ''}">${leadStatus}</span>` : '';

  // Pay badge + price color
  const payBadgeMap = { 'Оплачено': 'badge-paid', 'Частково': 'badge-partial', 'Не оплачено': 'badge-unpaid' };
  const payBadge = payStatus ? `<span class="badge ${payBadgeMap[payStatus] || ''}">${payStatus}</span>` : '';
  const priceColorClass = payStatus === 'Оплачено' ? 'paid' : (payStatus === 'Частково' ? 'partial' : 'unpaid');

  // Check badge
  const checkBadge = controlCheck
    ? `<span class="badge ${controlCheck === 'Готова до маршруту' ? 'badge-confirmed' : 'badge-check'}">${controlCheck === 'Готова до маршруту' ? 'Готова' : controlCheck}</span>`
    : '';

  // TTN display
  const ttnHtml = (isUE && ttn) ? `<span class="card-ttn">TTH: ${highlightMatch(ttn)}</span>` : '';

  // Route strip
  const routeStrip = rteId
    ? `<div class="card-route-strip">✅ В маршруті: ${highlightMatch(rteId)}${auto ? ' · 🚐 ' + highlightMatch(auto) : ''}</div>`
    : '';

  // Meta tags (configurable via column configurator)
  const visCols = getVisibleCardColumns();
  let metaHtml = '';
  if (visCols.includes('date') && dateCreated) metaHtml += `<span class="meta-tag">📅 ${escapeHtml(dateCreated)}</span>`;
  if (visCols.includes('statusPkg') && statusPkg) metaHtml += `<span class="meta-tag">${escapeHtml(statusPkg)}</span>`;
  if (visCols.includes('phone') && phone) metaHtml += `<span class="meta-tag">📞 ${highlightMatch(phone)}</span>`;
  if (visCols.includes('phoneRecv') && receiverPhone) metaHtml += `<span class="meta-tag">📱 ${highlightMatch(receiverPhone)}</span>`;
  if (visCols.includes('tag') && tag) metaHtml += `<span class="meta-tag ${tag === 'VIP' || tag === 'срочна' ? 'tag-vip' : ''}">#${highlightMatch(tag)}</span>`;
  if (visCols.includes('note') && note) {
    const noteShort = note.substring(0, 30) + (note.length > 30 ? '…' : '');
    metaHtml += `<span class="meta-tag">📝 ${highlightMatch(noteShort)}</span>`;
  }
  if (visCols.includes('description') && p['Опис']) {
    const descShort = (p['Опис']).substring(0, 25) + ((p['Опис']).length > 25 ? '…' : '');
    metaHtml += `<span class="meta-tag">📄 ${highlightMatch(descShort)}</span>`;
  }
  if (visCols.includes('qty') && p['Кількість позицій']) metaHtml += `<span class="meta-tag">📊 ${escapeHtml(String(p['Кількість позицій']))} шт</span>`;
  if (visCols.includes('estValue') && p['Оціночна вартість']) metaHtml += `<span class="meta-tag">💎 ${escapeHtml(String(p['Оціночна вартість']))}</span>`;

  // ===== TAB PANELS =====
  // 📦 Посилка (configurable)
  const visParcel = getVisibleParcelColumns();
  const allParcelFields = {
    'description': ['Опис', p['Опис'] || ''],
    'details': ['Деталі', p['Деталі'] || ''],
    'qty': ['Кількість позицій', p['Кількість позицій'] || ''],
    'weight': ['Кг', weight],
    'estValue': ['Оціночна вартість', p['Оціночна вартість'] || ''],
    'ttn': ['Номер ТТН', ttn],
    'innerNum': ['Внутрішній №', p['Внутрішній №'] || ''],
    'statusPkg': ['Статус посилки', statusPkg],
    'sum': ['Сума', price],
    'currency': ['Валюта оплати', currency],
    'payStatus': ['Статус оплати', payStatus],
    'photo': ['Фото посилки', p['Фото посилки'] || ''],
    'rating': ['Рейтинг', p['Рейтинг'] || ''],
    'ratingComment': ['Коментар рейтингу', p['Коментар рейтингу'] || ''],
  };
  const tabParcel = renderDetailGrid(visParcel.filter(k => allParcelFields[k]).map(k => allParcelFields[k]), pkgId);

  // 📄 Основне (configurable)
  const visOsn = getVisibleOsnovneColumns();
  const allOsnovneFields = {
    'sender': ['Піб відправника', name],
    'phone': ['Телефон реєстратора', phone],
    'addressFrom': ['Адреса відправки', addressFrom],
    'receiver': ['Піб отримувача', receiver],
    'phoneRecv': ['Телефон отримувача', receiverPhone],
    'addressTo': [isUE ? 'Адреса в Європі' : 'Місто Нова Пошта', addressTo],
    'leadStatus': ['Статус ліда', leadStatus],
    'tag': ['Тег', tag],
  };
  const tabBasic = renderDetailGrid(visOsn.filter(k => allOsnovneFields[k]).map(k => allOsnovneFields[k]), pkgId);

  // 💰 НП (тільки для УК→ЄВ)
  const tabNP = isUE ? renderDetailGrid([
    ['Сума НП', p['Сума НП'] || ''],
    ['Валюта НП', p['Валюта НП'] || ''],
    ['Форма НП', p['Форма НП'] || ''],
    ['Статус НП', p['Статус НП'] || ''],
  ], pkgId) : '';

  // 💰 Фінанси
  const tabFinance = renderDetailGrid([
    ['Сума', price],
    ['Валюта оплати', currency],
    ['Завдаток', p['Завдаток'] || ''],
    ['Валюта завдатку', p['Валюта завдатку'] || ''],
    ['Форма оплати', p['Форма оплати'] || ''],
    ['Статус оплати', payStatus],
    ['Борг', debt ? String(debt) : '', {readonly: true}],
    ['Примітка оплати', p['Примітка оплати'] || ''],
  ], pkgId);

  // 🚖 Рейс
  const tabRoute = renderDetailGrid([
    ['Дата відправки', p['Дата відправки'] || ''],
    ['Таймінг', p['Таймінг'] || ''],
    ['Номер авто', auto],
    ['RTE_ID', rteId, {readonly: true}],
    ['Дата отримання', p['Дата отримання'] || ''],
  ], pkgId);

  // ⚙ Системні
  const tabSystem = renderDetailGrid([
    ['PKG_ID', pkgId, {readonly: true}],
    ['Ід_смарт', p['Ід_смарт'] || '', {readonly: true}],
    ['Дата створення', dateCreated, {readonly: true}],
    ['SOURCE_SHEET', p['SOURCE_SHEET'] || '', {readonly: true}],
    ['CLI_ID', p['CLI_ID'] || '', {readonly: true}],
    ['ORDER_ID', p['ORDER_ID'] || '', {readonly: true}],
    ['Статус CRM', statusCrm],
    ['Контроль перевірки', controlCheck],
    ['Дата перевірки', p['Дата перевірки'] || '', {readonly: true}],
    ['Примітка', note],
    ['Примітка СМС', p['Примітка СМС'] || ''],
  ], pkgId);

  // NP tab HTML
  const npTabBtn = isUE ? `<div class="detail-tab" data-tab="np" onclick="event.stopPropagation(); switchTab('${pkgId}', 'np')">💰 НП</div>` : '';
  const npTabPanel = isUE ? `<div class="detail-tab-panel" data-tab-panel="np">${tabNP}</div>` : '';

  // Tracking button only for УК→ЄВ with ТТН
  const trackBtn = (isUE && ttn) ? `<button onclick="event.stopPropagation(); window.open('https://novaposhta.ua/tracking/?cargo_number=${ttn}', '_blank')">📦 Трекінг</button>` : '';

  return `
    <div class="lead-card ${statusClass}" data-id="${pkgId}">
      <div class="card-header" onclick="toggleCard('${pkgId}')">
        <div class="card-top-row">
          <input type="checkbox" class="card-checkbox" onclick="event.stopPropagation(); toggleSelect('${pkgId}')" ${selectedIds.has(pkgId) ? 'checked' : ''}>
          <span class="dir-badge ${dirBadgeClass}">${dirLabel}</span>
          ${visCols.includes('ttn') ? ttnHtml : ''}
          ${visCols.includes('weight') && weight ? `<span class="badge-weight">⚖️ ${weight} кг</span>` : ''}
          <div class="card-finance">
            ${visCols.includes('sum') && price ? `<span class="card-price ${priceColorClass}">${price} ${currency}</span>` : ''}
            ${visCols.includes('deposit') && deposit > 0 ? `<span class="card-deposit">завд:${deposit}</span>` : ''}
            ${visCols.includes('debt') && debt > 0 ? `<span class="card-debt">борг:${debt}</span>` : ''}
          </div>
          <button class="card-actions-toggle" onclick="event.stopPropagation(); toggleActions('${pkgId}', this)" title="Дії">▼</button>
        </div>
        <div class="card-row2-wrap">
          <div class="card-row2">
            <span class="card-pkgid">${highlightMatch(pkgId)}</span>
            <span class="card-sender-recv">👤 ${name ? highlightMatch(name) : '—'} → ${receiver ? highlightMatch(receiver) : '—'}</span>
            ${visCols.includes('leadBadge') ? leadBadge : ''} ${visCols.includes('payBadge') ? payBadge : ''} ${visCols.includes('checkBadge') ? checkBadge : ''}
          </div>
          ${visCols.includes('address') && (addressFrom || addressTo) ? `<div class="card-address">📍 ${addressFrom && addressTo ? highlightMatch(addressFrom) + ' → ' + highlightMatch(addressTo) : highlightMatch(addressFrom || addressTo)}</div>` : ''}
          ${metaHtml ? `<div class="card-meta-tags">${metaHtml}</div>` : ''}
        </div>
      </div>
      ${visCols.includes('route') ? routeStrip : ''}
      <div class="card-actions" id="actions-${pkgId}">
        <button onclick="event.stopPropagation(); window.open('tel:${phone}')">📞 Дзвінок</button>
        <button onclick="event.stopPropagation(); openMessenger('${phone}')">💬 Писати</button>
        ${trackBtn}
        <button onclick="event.stopPropagation(); startVerification('${pkgId}')" style="${controlCheck === 'В перевірці' ? 'background:var(--info);color:#fff;' : ''}">🔍 ${controlCheck === 'В перевірці' ? 'В перевірці' : 'В перевірку'}</button>
        ${controlCheck === 'В перевірці' ? `<button onclick="event.stopPropagation(); completeVerification('${pkgId}')" style="background:var(--success);color:#fff;">✅ Готово</button>` : ''}
        ${controlCheck === 'Готова до маршруту' ? `<span style="display:inline-flex;align-items:center;padding:6px 12px;background:#dcfce7;color:#166534;border-radius:8px;font-size:12px;font-weight:600;">✅ Готова</span>` : ''}
        <button onclick="event.stopPropagation(); openRouteModal('${pkgId}')">🚖 Маршрут</button>
        ${leadStatus !== 'Невідомий' ? `<button onclick="event.stopPropagation(); setLeadUnknown('${pkgId}')" style="background:#fef3c7;color:#92400e;">❓ Невідомий</button>` : `<span style="display:inline-flex;align-items:center;padding:6px 12px;background:#fef3c7;color:#92400e;border-radius:8px;font-size:12px;font-weight:600;">❓ Невідомий</span>`}
        <button class="btn-danger" onclick="event.stopPropagation(); deleteRecord('${pkgId}')">🗑️</button>
      </div>
      <div class="card-details ${isOpen ? 'open' : ''}" id="details-${pkgId}">
        <div class="detail-tabs">
          <div class="detail-tab active" data-tab="parcel" onclick="event.stopPropagation(); switchTab('${pkgId}', 'parcel')">📦 Посилка</div>
          <div class="detail-tab" data-tab="basic" onclick="event.stopPropagation(); switchTab('${pkgId}', 'basic')">📄 Основне</div>
          ${npTabBtn}
          <div class="detail-tab" data-tab="finance" onclick="event.stopPropagation(); switchTab('${pkgId}', 'finance')">💰 Фінанси</div>
          <div class="detail-tab" data-tab="route" onclick="event.stopPropagation(); switchTab('${pkgId}', 'route')">🚖 Рейс</div>
          <div class="detail-tab" data-tab="system" onclick="event.stopPropagation(); switchTab('${pkgId}', 'system')">⚙ Системні</div>
        </div>
        <div class="detail-tab-panel active" data-tab-panel="parcel">${tabParcel}</div>
        <div class="detail-tab-panel" data-tab-panel="basic">${tabBasic}</div>
        ${npTabPanel}
        <div class="detail-tab-panel" data-tab-panel="finance">${tabFinance}</div>
        <div class="detail-tab-panel" data-tab-panel="route">${tabRoute}</div>
        <div class="detail-tab-panel" data-tab-panel="system">${tabSystem}</div>
      </div>
    </div>
  `;
}

// ===== [SECT-INTERACT] INTERACTIONS (toggle, inline edit, save) =====
function toggleCard(pkgId) {
  openCardId = openCardId === pkgId ? null : pkgId;
  document.querySelectorAll('.card-details').forEach(el => {
    el.classList.toggle('open', el.id === 'details-' + pkgId && openCardId === pkgId);
  });
}

function toggleActions(pkgId, btn) {
  const panel = document.getElementById('actions-' + pkgId);
  if (panel) {
    panel.classList.toggle('open');
    if (btn) btn.classList.toggle('open');
  }
}

function switchTab(pkgId, tabName) {
  const card = document.querySelector(`.lead-card[data-id="${pkgId}"]`);
  if (!card) return;
  card.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  card.querySelectorAll('.detail-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tabPanel === tabName));
}

// ===== [SECT-DROPDOWN] FIELD OPTIONS (dropdown lists) =====
function getFieldOptions(col) {
  const swissAddrs = SWISS_POINTS.map(sp => `${sp.city} — ${sp.addr}`);
  const opts = {
    'Статус ліда':      ['Новий', 'В роботі', 'Підтверджено', 'Відмова'],
    'Статус оплати':    ['Не оплачено', 'Частково', 'Оплачено'],
    'Статус посилки':   ['Прийнято', 'В дорозі', 'На складі', 'Доставлено', 'Видано', 'Невідомий'],
    'Статус CRM':       ['Активний', 'Архів'],
    'Валюта оплати':    ['UAH', 'EUR', 'CHF', 'USD', 'PLN', 'CZK'],
    'Валюта завдатку':  ['UAH', 'EUR', 'CHF', 'USD', 'PLN', 'CZK'],
    'Валюта НП':        ['UAH', 'EUR', 'CHF', 'USD'],
    'Форма НП':         ['Готівка', 'Картка', 'Частково'],
    'Статус НП':        ['Ми оплатили', 'Відправник оплатив', 'Наложний платіж'],
    'Форма оплати':     ['Готівка', 'Картка', 'Частково'],
    'Адреса відправки': swissAddrs,
    'Адреса в Європі':  swissAddrs,
    'Контроль перевірки': ['', 'В перевірці', 'Готова до маршруту'],
    'Тег':              ['', 'VIP', 'срочна', 'крихке', 'великогабарит'],
  };
  return opts[col] || null;
}

function _isAddressField(col) {
  return col === 'Адреса відправки' || col === 'Адреса в Європі';
}

function startInlineEdit(el, pkgId, col) {
  // If dropdown or input already exists — skip
  if (el.querySelector('.qe-dropdown-wrap') || el.querySelector('input')) return;

  const valEl = el.querySelector('.val-text, .val-empty');
  const currentVal = valEl && valEl.classList.contains('val-text') ? valEl.textContent.trim() : '';
  const options = getFieldOptions(col);

  el.innerHTML = '';

  if (_isAddressField(col)) {
    _createAddressCombo(el, pkgId, col, currentVal, options || []);
  } else if (options) {
    _createQeDropdown(el, pkgId, col, currentVal, options);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentVal;
    input.onblur = function() { saveInlineEdit(pkgId, col, input.value, el); };
    input.onkeydown = function(e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { restoreBlock(el, currentVal, pkgId, col); }
    };
    el.appendChild(input);
    input.focus();
  }
}

function _createAddressCombo(el, pkgId, col, currentVal, suggestions) {
  const wrap = document.createElement('div');
  wrap.className = 'qe-address-combo';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'qe-address-input';
  input.value = currentVal;
  input.placeholder = 'Введіть адресу або оберіть точку';
  wrap.appendChild(input);

  const list = document.createElement('div');
  list.className = 'qe-address-suggestions';

  function _positionList() {
    const rect = input.getBoundingClientRect();
    list.style.top = rect.bottom + 'px';
    list.style.left = rect.left + 'px';
    list.style.width = rect.width + 'px';
  }

  function renderSuggestions(filter) {
    list.innerHTML = '';
    const q = (filter || '').toLowerCase();
    const filtered = suggestions.filter(s => !q || s.toLowerCase().includes(q));
    if (filtered.length === 0) { list.classList.remove('open'); return; }
    filtered.forEach(function(opt) {
      const item = document.createElement('div');
      item.className = 'qe-address-suggest-item' + (opt === input.value ? ' active' : '');
      item.textContent = opt;
      item.addEventListener('mousedown', function(e) {
        e.preventDefault();
        input.value = opt;
        list.classList.remove('open');
        _comboCleanup();
        saveInlineEdit(pkgId, col, opt, el);
      });
      list.appendChild(item);
    });
    list.classList.add('open');
    _positionList();
  }

  wrap.appendChild(list);
  el.appendChild(wrap);

  // Show suggestions on focus
  input.addEventListener('focus', function() { renderSuggestions(input.value); });
  input.addEventListener('input', function() { renderSuggestions(input.value); });
  input.addEventListener('blur', function() {
    list.classList.remove('open');
    _comboCleanup();
    saveInlineEdit(pkgId, col, input.value.trim(), el);
  });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { _comboCleanup(); restoreBlock(el, currentVal, pkgId, col); }
  });

  // Overflow fix
  const cardDetails = el.closest('.card-details');
  const tabPanel = el.closest('.detail-tab-panel');
  if (cardDetails) cardDetails.classList.add('editing-active');
  if (tabPanel) tabPanel.classList.add('editing-active');

  // Reposition on scroll
  function onScroll() { if (list.classList.contains('open')) _positionList(); }
  window.addEventListener('scroll', onScroll, true);

  function _comboCleanup() {
    window.removeEventListener('scroll', onScroll, true);
    document.querySelectorAll('.editing-active').forEach(function(e) { e.classList.remove('editing-active'); });
  }

  input.focus();
}

function _createQeDropdown(el, pkgId, col, currentVal, options) {
  const wrap = document.createElement('div');
  wrap.className = 'qe-dropdown-wrap open';

  // --- Trigger ---
  const sel = document.createElement('div');
  sel.className = 'qe-dropdown-selected';
  sel.textContent = currentVal || '— Оберіть —';
  // DIRECT handler: toggle open/close
  sel.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    wrap.classList.toggle('open');
    if (wrap.classList.contains('open')) _positionDropdownList(wrap);
  });
  wrap.appendChild(sel);

  // --- List ---
  const list = document.createElement('div');
  list.className = 'qe-dropdown-list';

  // Helper: make one item
  function makeItem(label, val, isActive, isClear) {
    const item = document.createElement('div');
    item.className = 'qe-dropdown-item' + (isActive ? ' active' : '') + (isClear ? ' qe-dropdown-item-clear' : '');
    item.innerHTML = '<span class="dd-icon">' + (isActive ? '✓' : '') + '</span> ' + label;
    // DIRECT handler: pick value
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      _qeCleanup();
      saveInlineEdit(pkgId, col, val, el);
    });
    return item;
  }

  list.appendChild(makeItem('— Очистити —', '', false, true));
  options.forEach(function(opt) {
    if (opt === '') return;
    list.appendChild(makeItem(opt, opt, opt === currentVal, false));
  });

  wrap.appendChild(list);
  el.appendChild(wrap);

  // Overflow fix
  const cardDetails = el.closest('.card-details');
  const tabPanel = el.closest('.detail-tab-panel');
  if (cardDetails) cardDetails.classList.add('editing-active');
  if (tabPanel) tabPanel.classList.add('editing-active');

  // Position
  _positionDropdownList(wrap);

  // --- Outside click: close & restore ---
  function onOutsideClick(e) {
    if (wrap.contains(e.target)) return;
    _qeCleanup();
    restoreBlock(el, currentVal, pkgId, col);
  }

  // --- Escape ---
  function onEscape(e) {
    if (e.key === 'Escape') {
      _qeCleanup();
      restoreBlock(el, currentVal, pkgId, col);
    }
  }

  // --- Scroll reposition ---
  function onScroll() {
    if (wrap.classList.contains('open')) _positionDropdownList(wrap);
  }

  // Cleanup all listeners
  function _qeCleanup() {
    document.removeEventListener('click', onOutsideClick, true);
    document.removeEventListener('keydown', onEscape);
    window.removeEventListener('scroll', onScroll, true);
    document.querySelectorAll('.editing-active').forEach(function(e) { e.classList.remove('editing-active'); });
  }

  // Attach listeners with slight delay so creation click doesn't trigger close
  setTimeout(function() {
    document.addEventListener('click', onOutsideClick, true);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('scroll', onScroll, true);
  }, 20);
}

// Position fixed list below trigger
function _positionDropdownList(wrap) {
  var sel = wrap.querySelector('.qe-dropdown-selected');
  var list = wrap.querySelector('.qe-dropdown-list');
  if (!sel || !list) return;
  var rect = sel.getBoundingClientRect();
  list.style.left = rect.left + 'px';
  list.style.top = rect.bottom + 'px';
  list.style.width = Math.max(rect.width, 180) + 'px';
}

function saveInlineEdit(pkgId, col, value, el) {
  const item = allData.find(p => p['PKG_ID'] === pkgId);
  var oldVal = item ? item[col] : undefined;
  if (item) item[col] = value;
  restoreBlock(el, value, pkgId, col);
  // Mark block as changed while saving
  const block = el.closest('.detail-block');
  if (block) block.className = 'detail-block changed';
  // Instantly patch card header (no full re-render)
  updateCardHeader(pkgId);
  apiPost('updateField', { pkg_id: pkgId, col, value }).then(res => {
    if (res.ok) {
      showToast('Збережено', 'success');
      if (block) block.className = 'detail-block ' + (value ? 'filled' : 'empty');
    } else {
      // Revert on error
      if (item) item[col] = oldVal;
      updateCardHeader(pkgId);
      restoreBlock(el, oldVal, pkgId, col);
      showToast('Помилка збереження', 'error');
    }
  });
}

// Targeted DOM patch — updates card header without re-rendering entire card list
function updateCardHeader(pkgId) {
  var p = allData.find(function(x) { return x['PKG_ID'] === pkgId; });
  if (!p) return;
  var cardEl = document.querySelector('.lead-card[data-id="' + pkgId + '"]');
  if (!cardEl) return;
  var visCols = getVisibleCardColumns();

  // 1. Finance: price + currency + deposit + debt
  var financeEl = cardEl.querySelector('.card-finance');
  if (financeEl) {
    var price = p['Сума'] || '';
    var currency = p['Валюта оплати'] || '';
    var deposit = parseFloat(p['Завдаток']) || 0;
    var debt = parseFloat(p['Борг']) || 0;
    var payStatus = p['Статус оплати'] || '';
    var priceColorClass = payStatus === 'Оплачено' ? 'paid' : (payStatus === 'Частково' ? 'partial' : 'unpaid');
    var html = '';
    if (visCols.includes('sum') && price) html += '<span class="card-price ' + priceColorClass + '">' + price + ' ' + currency + '</span>';
    if (visCols.includes('deposit') && deposit > 0) html += '<span class="card-deposit">завд:' + deposit + '</span>';
    if (visCols.includes('debt') && debt > 0) html += '<span class="card-debt">борг:' + debt + '</span>';
    financeEl.innerHTML = html;
  }

  // 2. Sender → Receiver name
  var nameEl = cardEl.querySelector('.card-sender-recv');
  if (nameEl) {
    var sender = p['Піб відправника'] || '—';
    var receiver = p['Піб отримувача'] || '—';
    nameEl.innerHTML = '👤 ' + sender + ' → ' + receiver;
  }

  // 3. Weight badge
  var weightBadge = cardEl.querySelector('.badge-weight');
  var weight = p['Кг'] || '';
  if (visCols.includes('weight')) {
    if (weight) {
      if (weightBadge) {
        weightBadge.innerHTML = '⚖️ ' + weight + ' кг';
      } else {
        // Insert before card-finance
        if (financeEl) financeEl.insertAdjacentHTML('beforebegin', '<span class="badge-weight">⚖️ ' + weight + ' кг</span>');
      }
    } else if (weightBadge) {
      weightBadge.remove();
    }
  }

  // 4. Pay status badge
  var badgesRow = cardEl.querySelector('.card-row2');
  if (badgesRow && visCols.includes('payBadge')) {
    var payStatus2 = p['Статус оплати'] || '';
    var payBadgeMap = { 'Оплачено': 'badge-paid', 'Частково': 'badge-partial', 'Не оплачено': 'badge-unpaid' };
    var oldPayBadge = badgesRow.querySelector('.badge-paid, .badge-partial, .badge-unpaid');
    if (payStatus2) {
      var newBadgeHtml = '<span class="badge ' + (payBadgeMap[payStatus2] || '') + '">' + payStatus2 + '</span>';
      if (oldPayBadge) oldPayBadge.outerHTML = newBadgeHtml;
    } else if (oldPayBadge) {
      oldPayBadge.remove();
    }
  }

  // 5. Address
  var addressEl = cardEl.querySelector('.card-address');
  if (visCols.includes('address')) {
    var addrFrom = p['Адреса відправки'] || '';
    var addrTo = p['Адреса в Європі'] || p['Місто Нова Пошта'] || '';
    if (addressEl) {
      if (addrTo) addressEl.innerHTML = '📍 ' + (addrFrom ? addrFrom + ' → ' : '') + addrTo;
      else addressEl.remove();
    }
  }
}

function restoreBlock(el, value, pkgId, col) {
  // Remove editing-active classes
  document.querySelectorAll('.editing-active').forEach(function(e) { e.classList.remove('editing-active'); });
  const v = value ? value.trim() : '';
  el.innerHTML = v
    ? `<span class="val-text">${v}</span>`
    : `<span class="val-empty">—</span>`;
}

function toggleSelect(pkgId) {
  if (selectedIds.has(pkgId)) selectedIds.delete(pkgId);
  else selectedIds.add(pkgId);
  updateBulkMenu();
  // Highlight selected card
  const card = document.querySelector(`.lead-card[data-id="${pkgId}"]`);
  if (card) card.classList.toggle('selected', selectedIds.has(pkgId));
}

// ===== [SECT-BULK] BULK ACTION MENU =====
let sidebarWasCollapsedBeforeBulk = false;

function updateBulkMenu() {
  const menu = document.getElementById('bulkMenu');
  const countEl = document.getElementById('bulkCount');
  const sidebar = document.getElementById('sidebar');
  if (!menu || !countEl) return;
  const n = selectedIds.size;
  countEl.textContent = n;
  const appLayout = document.querySelector('.app-layout');
  if (n > 0) {
    menu.classList.add('visible');
    if (window.innerWidth > 900) {
      if (appLayout) appLayout.style.marginLeft = '250px';
      // Auto-collapse main sidebar
      if (sidebar && !sidebar.classList.contains('collapsed')) {
        sidebarWasCollapsedBeforeBulk = false;
        sidebar.classList.add('collapsed');
        updateSidebarToggleBtn();
      }
    }
  } else {
    menu.classList.remove('visible');
    if (appLayout) appLayout.style.marginLeft = '';
    // Restore sidebar if we collapsed it
    if (window.innerWidth > 900 && sidebar && !sidebarWasCollapsedBeforeBulk) {
      sidebar.classList.remove('collapsed');
      updateSidebarToggleBtn();
    }
  }
}

function clearSelection() {
  selectedIds.clear();
  document.querySelectorAll('.card-checkbox').forEach(cb => cb.checked = false);
  document.querySelectorAll('.lead-card.selected').forEach(el => el.classList.remove('selected'));
  updateBulkMenu();
}

function bulkSelectAll() {
  const visible = filterData();
  if (selectedIds.size === visible.length) {
    // Deselect all if all are selected
    clearSelection();
    return;
  }
  visible.forEach(p => selectedIds.add(p['PKG_ID']));
  document.querySelectorAll('.card-checkbox').forEach(cb => cb.checked = true);
  document.querySelectorAll('.lead-card').forEach(el => el.classList.add('selected'));
  updateBulkMenu();
}

function getSelectedIds() {
  return Array.from(selectedIds);
}

function afterBulkAction() {
  clearSelection();
  renderCards();
}

// Stub: Видалити
// Масове видалення (= архівування)
async function bulkDelete() {
  const ids = getSelectedIds();
  if (ids.length === 0) return;
  const reason = prompt('Причина архівування ' + ids.length + ' посилок (або залиште порожнім):', '');
  if (reason === null) return;
  // Оновити локально
  ids.forEach(function(pkgId) {
    var item = allData.find(function(p) { return p['PKG_ID'] === pkgId; });
    if (item) item['Статус CRM'] = 'Архів';
  });
  renderCards();
  updateCounters();
  // Відправити на сервер
  for (var i = 0; i < ids.length; i++) {
    await apiPost('deleteParcel', { pkg_id: ids[i], reason: reason, archived_by: 'CRM' });
  }
  showToast('Архівовано ' + ids.length + ' посилок', 'success');
  afterBulkAction();
}

// Масове архівування (аліас bulkDelete)
async function bulkArchive() {
  return bulkDelete();
}

// ===== [SECT-VERIFY] VERIFICATION (перевірка посилок) =====

// Перевести лід в перевірку
function startVerification(pkgId) {
  const item = allData.find(p => p['PKG_ID'] === pkgId);
  if (!item) return;

  const isAlreadyChecking = item['Контроль перевірки'] === 'В перевірці';
  if (isAlreadyChecking) {
    showToast('Вже в перевірці', 'info');
    return;
  }

  // Оновити локально
  item['Контроль перевірки'] = 'В перевірці';
  item['Дата перевірки'] = new Date().toISOString();
  item['Статус ліда'] = 'В роботі';
  renderCards();
  updateCounters();
  showToast('Переведено в перевірку', 'success');

  // Відправити на сервер
  apiPost('updateField', { pkg_id: pkgId, col: 'Контроль перевірки', value: 'В перевірці' });
  apiPost('updateField', { pkg_id: pkgId, col: 'Статус ліда', value: 'В роботі' });
}

// Завершити перевірку — позначити як "Готово"
function completeVerification(pkgId) {
  const item = allData.find(p => p['PKG_ID'] === pkgId);
  if (!item) return;

  if (item['Контроль перевірки'] === 'Готова до маршруту') {
    showToast('Вже позначено як готова', 'info');
    return;
  }

  // Оновити локально
  item['Контроль перевірки'] = 'Готова до маршруту';
  item['Дата перевірки'] = new Date().toISOString();
  item['Статус ліда'] = 'Підтверджено';
  renderCards();
  updateCounters();
  showToast('Перевірку завершено — готова до маршруту', 'success');

  // Відправити на сервер
  apiPost('updateField', { pkg_id: pkgId, col: 'Контроль перевірки', value: 'Готова до маршруту' });
  apiPost('updateField', { pkg_id: pkgId, col: 'Статус ліда', value: 'Підтверджено' });
}

// Призначити статус "Невідомий" ліду
function setLeadUnknown(pkgId) {
  const item = allData.find(p => p['PKG_ID'] === pkgId);
  if (!item) return;
  if (item['Статус ліда'] === 'Невідомий') {
    showToast('Вже невідомий', 'info');
    return;
  }
  item['Статус ліда'] = 'Невідомий';
  renderCards();
  updateCounters();
  showToast('Статус: Невідомий', 'success');
  apiPost('updateField', { pkg_id: pkgId, col: 'Статус ліда', value: 'Невідомий' });
}

// Змінити статус перевірки (bulk)
function bulkSetVerifyStatus(status) {
  const ids = getSelectedIds();
  if (ids.length === 0) return;

  // Оновити локально кожен запис
  ids.forEach(id => {
    const item = allData.find(p => p['PKG_ID'] === id);
    if (item) {
      item['Контроль перевірки'] = status;
      item['Дата перевірки'] = new Date().toISOString();
      if (status === 'В перевірці') {
        item['Статус ліда'] = 'В роботі';
      } else if (status === 'Готова до маршруту') {
        item['Статус ліда'] = 'Підтверджено';
      }
    }
  });

  renderCards();
  updateCounters();
  showToast(`${ids.length} записів → "${status}"`, 'success');

  // Відправити на сервер
  ids.forEach(id => {
    apiPost('updateField', { pkg_id: id, col: 'Контроль перевірки', value: status });
    if (status === 'В перевірці') {
      apiPost('updateField', { pkg_id: id, col: 'Статус ліда', value: 'В роботі' });
    } else if (status === 'Готова до маршруту') {
      apiPost('updateField', { pkg_id: id, col: 'Статус ліда', value: 'Підтверджено' });
    }
  });

  afterBulkAction();
}

// Масове додавання в маршрут
function bulkAddToRoute() {
  const ids = getSelectedIds();
  if (ids.length === 0) return;
  if (routes.length === 0) {
    showToast('Маршрути не завантажені', 'error');
    return;
  }
  _routeModalPkgIds = ids;
  _routeModalMode = 'bulk';
  showRoutePickerModal('🗺️ Перенести в маршрут', 'Додати ' + ids.length + ' посилок в маршрут:');
}

// Видалити з маршруту
async function bulkRemoveFromRoute() {
  const ids = getSelectedIds();
  if (ids.length === 0) return;
  if (!confirm('Видалити ' + ids.length + ' записів з маршруту?')) return;

  var success = 0;
  for (var i = 0; i < ids.length; i++) {
    var item = allData.find(function(p) { return p['PKG_ID'] === ids[i]; });
    var rteId = item ? item['RTE_ID'] : '';
    if (!rteId) continue;
    try {
      var res = await apiPost('removeFromRoute', { pkg_id: ids[i], rte_id: rteId });
      if (res.ok) {
        success++;
        if (item) item['RTE_ID'] = '';
      }
    } catch(e) {}
  }
  showToast('Видалено з маршруту: ' + success, success > 0 ? 'success' : 'error');
  afterBulkAction();
}

// Stub: Оптимізація
function bulkOptimizeRoute() {
  const ids = getSelectedIds();
  if (ids.length === 0) return;
  console.log('bulkOptimizeRoute:', ids);
  showToast(`Оптимізація маршруту: ${ids.length} посилок (заглушка)`, 'info');
}

function setDirection(dir) {
  currentDirection = dir;
  // Update desktop sidebar items
  document.querySelectorAll('.sidebar [data-dir]').forEach(el => {
    el.className = 'sidebar-item' + (el.dataset.dir === dir ? (dir === 'ue' ? ' active-ue' : ' active-eu') : '');
  });
  // Update mobile sidebar items
  document.querySelectorAll('#mobileSidebar [data-dir]').forEach(el => {
    el.className = 'mob-item' + (el.dataset.dir === dir ? (dir === 'ue' ? ' active-ue' : ' active-eu') : '');
  });
  // Switch back to parcels view if in route/other view
  if (currentView !== 'parcels') backToParcels();
  else renderCards();
  closeMobileSidebar();
}

function setView(view) {
  // Update bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach((el, i) => {
    el.classList.toggle('active', (view === 'parcels' && i === 0) || (view === 'passengers' && i === 1));
  });
  if (view === 'parcels' && currentView !== 'parcels') backToParcels();
  else { currentView = view; renderCards(); }
  closeMobileSidebar();
}

function setStatusFilter(status) {
  currentFilter = status;
  document.querySelectorAll('#filterBar .filter-chip').forEach(el => {
    el.classList.toggle('active', el.dataset.status === status);
  });
  renderCards();
}

function setPayFilter(pay) {
  currentPayFilter = pay;
  document.querySelectorAll('#payFilterBar .filter-chip').forEach(el => {
    el.classList.toggle('active', el.dataset.pay === pay);
  });
  renderCards();
}

function onSearch(value) {
  searchQuery = value.trim();
  renderCards();
}

// ===== [SECT-SIDEBAR] SIDEBAR =====
function toggleMobSection(titleEl) {
  var body = titleEl.nextElementSibling;
  var toggle = titleEl.querySelector('.mob-toggle');
  if (body) body.classList.toggle('mob-collapsed');
  if (toggle) toggle.classList.toggle('open');
}

function toggleSection(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.toggle');
  body.classList.toggle('hidden');
  toggle.classList.toggle('open');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  // Remember manual state so bulk menu doesn't restore it
  if (selectedIds.size > 0 && sidebar.classList.contains('collapsed')) {
    sidebarWasCollapsedBeforeBulk = true;
  }
  updateSidebarToggleBtn();
}

function updateSidebarToggleBtn() {
  const btn = document.getElementById('sidebarToggleBtn');
  const sidebar = document.getElementById('sidebar');
  if (btn && sidebar) {
    btn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
  }
}

function toggleMobileSidebar() {
  document.getElementById('mobileSidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function closeMobileSidebar() {
  document.getElementById('mobileSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ===== [SECT-ROUTES] ROUTES SIDEBAR & VIEW =====
var HIDDEN_SHEETS = ['Взірець', 'Зведення рейсів'];

function renderRouteSidebar() {
  var isActive = function(view, i) { return currentView === view && activeRouteIdx === i; };

  // Routes — desktop + mobile
  var routeHtml = routes.map(function(r, i) {
    return '<div class="sidebar-item ' + (isActive('route', i) ? 'active-route' : '') + '" onclick="openRouteView(' + i + ')">' +
      (r.city || r.sheetName) +
      ' <span style="font-size:10px;color:var(--text-secondary)">👤' + (r.paxCount || 0) + ' 📦' + (r.parcelCount || 0) + '</span>' +
    '</div>';
  }).join('');
  var mobRouteHtml = routes.map(function(r, i) {
    return '<div class="mob-item ' + (isActive('route', i) ? 'active-route' : '') + '" onclick="openRouteView(' + i + ');closeMobileSidebar();">' +
      (r.city || r.sheetName) +
      ' <span class="badge-count">👤' + (r.paxCount || 0) + ' 📦' + (r.parcelCount || 0) + '</span>' +
    '</div>';
  }).join('') || '<div style="padding:8px 14px;color:var(--text-secondary);font-size:12px;font-style:italic;">Немає маршрутів</div>';

  var el = document.getElementById('routesSidebar');
  if (el) el.innerHTML = routeHtml;
  var mobEl = document.getElementById('mobRoutesSidebar');
  if (mobEl) mobEl.innerHTML = mobRouteHtml;

  // Dispatches — desktop + mobile
  var dispHtml = dispatches.map(function(d, i) {
    return '<div class="sidebar-item ' + (isActive('dispatch', i) ? 'active-route' : '') + '" onclick="openDispatchView(' + i + ')">' +
      (d.city || d.sheetName) + ' <span style="font-size:10px;color:var(--text-secondary)">' + (d.rowCount || 0) + '</span>' +
    '</div>';
  }).join('');
  var mobDispHtml = dispatches.map(function(d, i) {
    return '<div class="mob-item ' + (isActive('dispatch', i) ? 'active-route' : '') + '" onclick="openDispatchView(' + i + ');closeMobileSidebar();">' +
      (d.city || d.sheetName) + ' <span class="badge-count">' + (d.rowCount || 0) + '</span>' +
    '</div>';
  }).join('') || '<div style="padding:8px 14px;color:var(--text-secondary);font-size:12px;font-style:italic;">Немає відправок</div>';

  var dispEl = document.getElementById('dispatchSidebar');
  if (dispEl) dispEl.innerHTML = dispHtml;
  var mobDispEl = document.getElementById('mobDispatchSidebar');
  if (mobDispEl) mobDispEl.innerHTML = mobDispHtml;

  // Expenses — desktop + mobile
  var expHtml = expenses.map(function(e, i) {
    return '<div class="sidebar-item ' + (isActive('expenses', i) ? 'active-route' : '') + '" onclick="openExpensesView(' + i + ')">' +
      (e.city || e.sheetName) + ' <span style="font-size:10px;color:var(--text-secondary)">' + (e.rowCount || 0) + '</span>' +
    '</div>';
  }).join('');
  var mobExpHtml = expenses.map(function(e, i) {
    return '<div class="mob-item ' + (isActive('expenses', i) ? 'active-route' : '') + '" onclick="openExpensesView(' + i + ');closeMobileSidebar();">' +
      (e.city || e.sheetName) + ' <span class="badge-count">' + (e.rowCount || 0) + '</span>' +
    '</div>';
  }).join('') || '<div style="padding:8px 14px;color:var(--text-secondary);font-size:12px;font-style:italic;">Немає витрат</div>';

  var expEl = document.getElementById('expensesSidebar');
  if (expEl) expEl.innerHTML = expHtml;
  var mobExpEl = document.getElementById('mobExpensesSidebar');
  if (mobExpEl) mobExpEl.innerHTML = mobExpHtml;
}

// ===== SWITCH VIEW =====
function switchMainView(view) {
  currentView = view;
  document.getElementById('cardsList').style.display = view === 'parcels' ? '' : 'none';
  document.getElementById('routeView').style.display = view !== 'parcels' ? '' : 'none';
  renderRouteSidebar();
}

function backToParcels() {
  activeRouteIdx = null;
  switchMainView('parcels');
  renderCards();
}

// ===== ROUTE HELPERS =====
var allRouteSheets = [];
function showConfirm(msg, cb) { if (confirm(msg)) cb(true); else cb(false); }
function formatTripDate(d) { if (!d) return '—'; var s = String(d); if (s.match(/^\d{4}-\d{2}-\d{2}/)) { var p = s.split('-'); return p[2].substring(0,2) + '.' + p[1] + '.' + p[0]; } return s; }
function getDirectionCode(dir) { var d = (dir || '').toLowerCase(); return (d.indexOf('єв') === 0 || d.indexOf('eu') === 0 || d.indexOf('європа') === 0) ? 'eu-ua' : 'ua-eu'; }
function openMessengerPopup(phone, smartId) { var clean = (phone || '').replace(/[^+\d]/g, ''); var grid = document.getElementById('messengerGrid'); if (!grid) return; grid.innerHTML = '<a href="viber://chat?number=' + clean + '" style="display:block;padding:10px;margin:4px 0;background:#7360f2;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;text-align:center;">Viber</a><a href="https://t.me/' + clean + '" style="display:block;padding:10px;margin:4px 0;background:#0088cc;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;text-align:center;">Telegram</a><a href="https://wa.me/' + clean.replace('+','') + '" style="display:block;padding:10px;margin:4px 0;background:#25d366;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;text-align:center;">WhatsApp</a>'; document.getElementById('messengerOverlay').classList.add('show'); }
function closeMessengerPopup() { var el = document.getElementById('messengerOverlay'); if (el) el.classList.remove('show'); }
function promptDeleteLinkedSheets(baseName) { if (activeRouteIdx !== null) activeRouteIdx = null; loadRoutes(); }
function setCount(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
function refreshRouteView() { if (activeRouteIdx !== null) openRoute(activeRouteIdx, true); }
function openRouteView(idx) { openRoute(idx); }
function archiveFromRoute(rteId, sheetName, name) { deleteFromRoute(rteId, sheetName, name); }
function routeBulkArchive() { routeBulkDeleteFromRoute(); }
function routeBulkDeleteFull() { routeBulkDeleteFromRoute(); }
function optimizeRouteOrder() { showToast('Оптимізація порядку — в розробці'); }

function showRoutesView() {
    switchMainView('route');
    if (routes.length === 0) loadRoutes();
    else renderRoutes();
}

async function loadRoutes(forceRefresh) {
    if (forceRefresh) _routeForceRefresh = true;
    const loading = document.getElementById('routesLoading');
    const errEl = document.getElementById('routesError');
    const list = document.getElementById('routesList');
    loading.style.display = 'block';
    loading.textContent = '⏳ Завантаження списку маршрутів...';
    errEl.style.display = 'none';
    list.innerHTML = '';

    try {
        // ШВИДКИЙ запит: тільки імена аркушів + кількість рядків
        const res = await apiPost('getRoutesList', { forceRefresh: !!forceRefresh });
        loading.style.display = 'none';
        var routeList = res.routes || res.data || [];
        if (res.ok && routeList.length) {
            // Зберігаємо список аркушів (rows ще не завантажені)
            allRouteSheets = routeList.map(s => ({
                sheetName: s.sheetName,
                city: s.city || s.sheetName.replace(/^Маршрут_/, ''),
                rowCount: s.rowCount,
                paxCount: s.paxCount || 0,
                parcelCount: s.parcelCount || 0,
                headers: [],
                rows: null // null = ще не завантажено
            }));
            // Бекенд вже категоризує: routes/dispatches/expenses
            // Аркуші можуть називатися "Цюріх" або "Маршрут_Цюріх"
            routes = allRouteSheets.filter(s => {
                const n = (s.sheetName || '');
                return n !== 'Маршрут_Шаблон' && n !== 'Взірець';
            });
            setCount('pcCountRoutes', routes.length);
            setCount('mobileCountRoutes', routes.length);
            renderRouteSidebar();
            renderRoutes();
        } else {
            errEl.style.display = 'block';
            errEl.textContent = '❌ ' + (res.error || 'Не вдалось завантажити маршрути');
        }
    } catch (e) {
        loading.style.display = 'none';
        errEl.style.display = 'block';
        errEl.textContent = '❌ Помилка: ' + e.message;
    }
}

// Завантажити дані одного аркуша маршруту (lazy loading)
async function loadRouteSheetData(idx, forceRefresh) {
    const sheet = routes[idx];
    if (!sheet) return;
    if (sheet.rows != null && sheet.rows.length > 0 && !forceRefresh) return; // вже завантажено

    const loading = document.getElementById('routesLoading');
    if (loading) {
        loading.style.display = 'block';
        loading.textContent = '⏳ Завантаження даних маршруту ' + (sheet.sheetName || '') + '...';
    }

    try {
        console.log('[loadRouteSheetData] Requesting sheet:', sheet.sheetName);
        const res = await apiPost('getRouteSheet', { sheetName: sheet.sheetName, forceRefresh: !!forceRefresh });
        console.log('[loadRouteSheetData] Response:', JSON.stringify(res).substring(0, 500));
        if (loading) loading.style.display = 'none';
        if (res.ok && res.data) {
            sheet.headers = res.data.headers || [];
            sheet.rows = res.data.rows || [];
            sheet.rowCount = res.data.rowCount || 0;
            console.log('[loadRouteSheetData] Loaded', sheet.rows.length, 'rows for', sheet.sheetName);
            // Оновити також в allRouteSheets
            const allIdx = allRouteSheets.findIndex(s => s.sheetName === sheet.sheetName);
            if (allIdx !== -1) allRouteSheets[allIdx] = sheet;
        } else {
            console.error('[loadRouteSheetData] API error:', res.error || 'Unknown error', 'Full response:', res);
            showToast('❌ Помилка завантаження маршруту: ' + (res.error || 'Невідома помилка'));
            sheet.rows = [];
            sheet.rowCount = 0;
        }
    } catch (e) {
        if (loading) loading.style.display = 'none';
        console.error('[loadRouteSheetData] Network error:', e.message, e);
        showToast('❌ Помилка мережі: ' + e.message);
        sheet.rows = [];
        sheet.rowCount = 0;
    }
}

// Ключові колонки для відображення маршрутів (скорочена таблиця)
const ROUTE_DISPLAY_COLS = [
    'RTE_ID', 'Тип запису', 'Піб пасажира', 'Телефон пасажира',
    'Дата рейсу', 'Номер авто', 'Водій', 'Місце в авто',
    'Адреса прибуття', 'Сума', 'Валюта', 'Статус оплати', 'Статус'
];

function toggleMobileRoutesList() {
    toggleMobileSection('routes');
}

// ── Відкрити конкретний маршрут ──
async function openRoute(idx, forceRefresh) {
    activeRouteIdx = idx;
    // Одразу підсвітити активний маршрут в sidebar
    document.querySelectorAll('.route-sidebar-item').forEach(function(el, i) {
        el.classList.toggle('active', i === idx);
    });
    var needForce = forceRefresh || _routeForceRefresh;
    _routeForceRefresh = false;
    // Lazy load: завантажити дані аркуша, якщо ще не завантажені або force
    try {
        if (routes[idx] && (routes[idx].rows === null || needForce)) {
            showLoader('Завантаження маршруту...');
            await loadRouteSheetData(idx, needForce);
            hideLoader();
        }
    } catch(e) {
        hideLoader();
        showToast('❌ Помилка завантаження маршруту: ' + (e.message || ''));
    }
    showRoutesView();
}

// ── Згортальний дашборд маршруту ──
function toggleRouteDashboard() {
    var content = document.getElementById('routeDashContent');
    var toggle = document.getElementById('routeDashToggle');
    if (!content) return;
    var isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    if (toggle) toggle.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

// ── Розгортальні секції фільтрів (Статуси / Фінанси) ──
function toggleRteFilterSection(section, btn) {
    var id = section === 'status' ? 'rteStatusFilters' : 'rtePayFilters';
    var el = document.getElementById(id);
    if (!el) return;
    var isHidden = el.classList.contains('rte-filter-hidden');
    el.classList.toggle('rte-filter-hidden', !isHidden);
    el.classList.toggle('rte-filter-visible', isHidden);
    btn.classList.toggle('open', isHidden);
}

// ── Фільтри маршруту ──
function setRouteTypeFilter(val, btn) {
    routeTypeFilter = val;
    document.querySelectorAll('#rteFilterAll,#rteFilterPax,#rteFilterParcel').forEach(b => b.classList.remove('active'));
    document.getElementById('rteFilterAll')?.classList.remove('active');
    if (btn) btn.classList.add('active');
    renderRoutes();
}
function setRouteStatusFilter(val, btn) {
    routeStatusFilter = val;
    document.querySelectorAll('#rteStatusNew,#rteStatusWork,#rteStatusConfirmed,#rteStatusRefused').forEach(b => b.classList.remove('active'));
    document.getElementById('rteFilterAll')?.classList.remove('active');
    document.getElementById('rteToggleStatus')?.classList.add('active');
    if (btn) btn.classList.add('active');
    renderRoutes();
}
function setRoutePayFilter(val, btn) {
    routePayFilter = val;
    document.querySelectorAll('#rtePayUnpaid,#rtePayPartial,#rtePayPaid').forEach(b => b.classList.remove('active'));
    document.getElementById('rteFilterAll')?.classList.remove('active');
    document.getElementById('rteTogglePay')?.classList.add('active');
    if (btn) btn.classList.add('active');
    renderRoutes();
}
function toggleRtePanel(panel) {
    var statusEl = document.getElementById('rtePanelStatus');
    var payEl = document.getElementById('rtePanelPay');
    if (panel === 'status') {
        var isOpen = statusEl.style.display !== 'none';
        statusEl.style.display = isOpen ? 'none' : 'block';
        if (payEl) payEl.style.display = 'none';
    } else {
        var isOpen = payEl.style.display !== 'none';
        payEl.style.display = isOpen ? 'none' : 'block';
        if (statusEl) statusEl.style.display = 'none';
    }
}
function rteResetAll(btn) {
    routeTypeFilter = 'all'; routeStatusFilter = 'all'; routePayFilter = 'all';
    document.querySelectorAll('#rteFilterAll,#rteFilterPax,#rteFilterParcel,#rteToggleStatus,#rteTogglePay').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#rteStatusNew,#rteStatusWork,#rteStatusConfirmed,#rteStatusRefused').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#rtePayUnpaid,#rtePayPartial,#rtePayPaid').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    var s = document.getElementById('rtePanelStatus'); if (s) s.style.display = 'none';
    var p = document.getElementById('rtePanelPay'); if (p) p.style.display = 'none';
    renderRoutes();
}
function getFilteredRouteRows(rows) {
    let filtered = rows;
    if (routeTypeFilter === 'pax') filtered = filtered.filter(r => (r['Тип запису'] || '').includes('Пасажир'));
    if (routeTypeFilter === 'parcel') filtered = filtered.filter(r => (r['Тип запису'] || '').includes('Посилк'));
    if (routeStatusFilter !== 'all') filtered = filtered.filter(r => (r['Статус'] || '') === routeStatusFilter);
    if (routePayFilter !== 'all') filtered = filtered.filter(r => (r['Статус оплати'] || '') === routePayFilter);
    return filtered;
}

// ── Рендер вмісту обраного маршруту ──
function renderRoutes() {
    const list = document.getElementById('routesList');
    const headerBar = document.getElementById('routeHeaderBar');
    const headerEmpty = document.getElementById('routeHeaderEmpty');
    const filtersBar = document.getElementById('routeFiltersBar');
    const title = document.getElementById('routeViewTitle');
    const subtitle = document.getElementById('routeSubtitle');
    if (!list) return;

    if (routes.length === 0) {
        if (headerBar) headerBar.style.display = 'none';
        if (headerEmpty) headerEmpty.style.display = 'flex';
        if (filtersBar) filtersBar.style.display = 'none';
        list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);"><div style="font-size:40px;margin-bottom:8px;">🗺️</div><div style="font-size:13px;font-weight:600;">Активних маршрутів не знайдено</div><div style="font-size:11px;margin-top:4px;">Створіть новий маршрут через меню зліва</div></div>';
        return;
    }

    if (activeRouteIdx === null || activeRouteIdx >= routes.length) {
        if (headerBar) headerBar.style.display = 'none';
        if (headerEmpty) headerEmpty.style.display = 'flex';
        if (filtersBar) filtersBar.style.display = 'none';
        list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);"><div style="font-size:40px;margin-bottom:8px;">👈</div><div style="font-size:13px;font-weight:600;">Оберіть маршрут у меню зліва</div></div>';
        return;
    }

    const sheet = routes[activeRouteIdx];
    const rows = sheet.rows || [];
    const name = (sheet.sheetName || 'Маршрут');

    const paxCount = rows.filter(r => (r['Тип запису'] || '').includes('Пасажир')).length;
    const parcelCount = rows.filter(r => (r['Тип запису'] || '').includes('Посилк')).length;

    // Show route header bar + filters
    if (headerBar) headerBar.style.display = 'block';
    if (headerEmpty) headerEmpty.style.display = 'none';
    if (filtersBar) filtersBar.style.display = 'block';
    if (title) title.textContent = '🚐 ' + name;
    if (subtitle) subtitle.textContent = '👤 ' + paxCount + ' пасажирів · 📦 ' + parcelCount + ' посилок · ' + rows.length + ' записів';

    const filtered = getFilteredRouteRows(rows);
    let html = '';

    if (filtered.length === 0) {
        html += '<div style="padding:40px;text-align:center;color:var(--text-secondary);font-size:13px;">' +
            (rows.length === 0 ? 'Маршрут порожній — перенесіть посилки з головного списку' : 'Немає записів за обраним фільтром') + '</div>';
    } else {
        html += filtered.map((r, idx) => renderRouteCard(r, idx, sheet.sheetName)).join('');
    }

    list.innerHTML = html;
    renderRouteSidebar();
    updateRouteBulkToolbar();
}

// ── Рендер картки ліда маршруту (card-style як в CRM) ──
function renderRouteCard(r, idx, sheetName) {
    const rteId = r['RTE_ID'] || '';
    const type = r['Тип запису'] || '';
    const name = r['Піб пасажира'] || '—';
    const phone = String(r['Телефон пасажира'] || '—');
    const recipName = r['Піб отримувача'] || '';
    const recipPhone = String(r['Телефон отримувача'] || '');
    const date = r['Дата рейсу'] || '';
    const direction = r['Напрям'] || '';
    const auto = r['Номер авто'] || '';
    const seat = r['Місце в авто'] || '';
    const seats = r['Кількість місць'] || 1;
    const from = r['Адреса відправки'] || '';
    const to = r['Адреса прибуття'] || r['Адреса отримувача'] || '';
    const price = r['Сума'] || '';
    const curr = r['Валюта'] || '';
    const deposit = r['Завдаток'] || '';
    const depositCurr = r['Валюта завдатку'] || '';
    const payStatus = r['Статус оплати'] || '';
    const status = r['Статус'] || '';
    const driver = r['Водій'] || '';
    const weight = r['Вага багажу'] || '';
    const weightPrice = r['Ціна багажу'] || '';
    const weightCurr = r['Валюта багажу'] || '';
    const note = r['Примітка'] || '';
    const phoneReg = r['Телефон реєстратора'] || '';
    const smartId = r['Ід_смарт'] || '';

    const statusClass = status === 'Підтверджено' ? 'status-confirmed' :
        status === 'Відмова' ? 'status-refused' :
        status === 'Новий' ? 'status-new' :
        status === 'В роботі' ? 'status-work' : '';

    const dirCode = getDirectionCode(direction);
    const isUE = dirCode === 'ua-eu';
    const dirLabel = direction ? (isUE ? 'UA → EU' : 'EU → UA') : '';
    const dirCls = isUE ? 'dir-badge-ua-eu' : 'dir-badge-eu-ua';

    const payBadge = payStatus === 'Оплачено' ? '<span class="badge badge-paid">Оплачено</span>' :
        payStatus === 'Частково' ? '<span class="badge badge-partial">Частково</span>' :
        payStatus === 'Не оплачено' ? '<span class="badge badge-unpaid">Не оплачено</span>' : '';

    const lsBadge = status === 'Підтверджено' ? '<span class="badge badge-confirmed">Підтверджено</span>' :
        status === 'В роботі' ? '<span class="badge badge-work">В роботі</span>' :
        status === 'Новий' ? '<span class="badge badge-new">Новий</span>' :
        status === 'Відмова' ? '<span class="badge badge-refused">Відмова</span>' : '';

    const isPax = type.includes('Пасажир');
    const typeIcon = isPax ? '👤' : '📦';
    const displayDate = date ? formatTripDate(date) : '—';
    const isSelected = routeSelectedIds.has(rteId);
    const isDetailsOpen = routeOpenDetailsId === rteId;
    const isActionsOpen = routeOpenActionsId === rteId;
    const safeSheet = (sheetName || '').replace(/'/g, "\\'");
    // Для посилок у заголовку показуємо "відправник → отримувач" (як у списку
    // посилок) та телефон отримувача (бо водій дзвонить саме йому при доставці).
    // Для пасажирів — одне ПІБ і телефон пасажира.
    const headerName = isPax ? name : (`${name || '—'} → ${recipName || '—'}`);
    const headerPhone = isPax ? phone : (recipPhone || phone);
    const cleanPhone = (headerPhone || '').replace(/[^+\d]/g, '');

    // Розбивка деталей на 4 вкладки (як у звичайному списку посилок),
    // щоб не було "сміттєвої" грид-стіни. Поля без DB-колонки в routes
    // (Тел. реєстратора, Ціна/Валюта багажу) залишаємо для відображення —
    // backend сам мовчки пропустить їх при спробі редагування.
    const ttn = r['Номер ТТН'] || '';
    const desc = r['Опис'] || r['Опис посилки'] || '';
    const contactsFields = isPax ? [
        {label: 'ПІБ', key: 'Піб пасажира', value: name},
        {label: 'Телефон', key: 'Телефон пасажира', value: phone},
        {label: 'Тел. реєстратора', key: 'Телефон реєстратора', value: phoneReg},
        {label: 'Напрям', key: 'Напрям', value: direction},
        {label: 'Статус', key: 'Статус', value: status},
    ] : [
        {label: 'Відправник', key: 'Піб відправника', value: name},
        {label: 'Тел. відправника', key: 'Телефон відправника', value: phone},
        {label: 'Отримувач', key: 'Піб отримувача', value: recipName || '—'},
        {label: 'Тел. отримувача', key: 'Телефон отримувача', value: recipPhone || '—'},
        {label: 'Напрям', key: 'Напрям', value: direction},
        {label: 'Статус', key: 'Статус', value: status},
        {label: 'Номер ТТН', key: 'Номер ТТН', value: ttn},
        {label: 'Опис', key: 'Опис', value: desc},
        {label: 'Вага (кг)', key: 'Вага посилки', value: weight},
    ];
    const financeFields = [
        {label: 'Сума', key: 'Сума', value: price},
        {label: 'Валюта', key: 'Валюта', value: curr},
        {label: 'Завдаток', key: 'Завдаток', value: deposit},
        {label: 'Валюта завдатку', key: 'Валюта завдатку', value: depositCurr},
        {label: 'Статус оплати', key: 'Статус оплати', value: payStatus},
        {label: 'Ціна багажу', key: 'Ціна багажу', value: weightPrice},
        {label: 'Валюта багажу', key: 'Валюта багажу', value: weightCurr},
    ];
    const tripFields = [
        {label: 'Дата рейсу', key: 'Дата рейсу', value: displayDate},
        {label: 'Кількість місць', key: 'Кількість місць', value: seats},
        {label: 'Номер авто', key: 'Номер авто', value: auto},
        {label: 'Місце в авто', key: 'Місце в авто', value: seat},
        {label: 'Водій', key: 'Водій', value: driver},
        {label: 'Адреса відправки', key: 'Адреса відправки', value: from},
        {label: 'Адреса прибуття', key: 'Адреса прибуття', value: to},
    ];
    const noteFields = [
        {label: 'Примітка', key: 'Примітка', value: note},
    ];

    function renderRouteFieldsGrid(fields) {
        return '<div class="details-grid">' + fields.map(f => {
            const val = f.value || '—';
            const safeKey = f.key.replace(/'/g, "\\'");
            return `<div class="detail-block">
                <div class="detail-block-label">${f.label}</div>
                <div class="detail-block-value" id="rdv-${rteId}-${f.key}">${val}</div>
                <div class="detail-block-actions">
                    <button class="detail-micro-btn" onclick="event.stopPropagation(); startRouteInlineEdit('${rteId}','${safeKey}','${safeSheet}')">✏️</button>
                </div>
            </div>`;
        }).join('') + '</div>';
    }

    const contactsIcon = isPax ? '👤' : '📦';
    const contactsLabel = isPax ? 'Контакти' : 'Посилка';

    return `<div class="route-card ${statusClass} ${isSelected ? 'selected' : ''}" id="rte-card-${rteId}">
        <div class="route-card-header" onclick="toggleRouteDetails('${rteId}')">
            <div class="route-card-top">
                <div class="card-checkbox-wrap" onclick="event.stopPropagation()">
                    <input class="card-checkbox" type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleRouteSelect('${rteId}',this.checked)">
                </div>
                ${dirLabel ? `<span class="card-direction ${dirCls}">${dirLabel}</span>` : ''}
                <span class="route-card-phone">${headerPhone || '—'}</span>
                <span class="route-card-seats">${seats}м</span>
                <span class="route-card-date">${displayDate}</span>
                ${seat ? `<span style="background:#e0e7ff;color:#3730a3;font-size:10px;padding:2px 8px;border-radius:4px;font-weight:700;">💺 ${seat}</span>` : ''}
                <span class="route-card-price">${price ? price + ' ' + curr : ''}</span>
            </div>
            <div class="route-card-info">
                <span style="font-size:12px;">${typeIcon}</span>
                <span class="route-card-name">${headerName}</span>
                <span style="color:var(--text-secondary);font-size:10px;">${rteId}</span>
                ${lsBadge} ${payBadge}
            </div>
            ${(from || to) ? `<div class="route-card-route">📍 ${from || '—'} → ${to || '—'}</div>` : ''}
            <div class="route-card-meta">
                ${auto ? `<span>🚐 ${auto}</span>` : ''}
                ${driver ? `<span>🧑 ${driver}</span>` : ''}
                ${weight ? `<span>📦 ${weight}</span>` : ''}
                ${note ? `<span>📝 ${note.substring(0, 30)}${note.length > 30 ? '...' : ''}</span>` : ''}
            </div>
        </div>
        <div class="route-card-details ${isDetailsOpen ? 'show' : ''}" id="rte-details-${rteId}" data-rte-id="${rteId}">
            <div class="detail-tabs">
                <div class="detail-tab active" data-tab="contacts" onclick="event.stopPropagation(); switchRouteTab('${rteId}','contacts')">${contactsIcon} ${contactsLabel}</div>
                <div class="detail-tab" data-tab="finance" onclick="event.stopPropagation(); switchRouteTab('${rteId}','finance')">💰 Фінанси</div>
                <div class="detail-tab" data-tab="trip" onclick="event.stopPropagation(); switchRouteTab('${rteId}','trip')">🚖 Рейс</div>
                <div class="detail-tab" data-tab="note" onclick="event.stopPropagation(); switchRouteTab('${rteId}','note')">📝 Примітка</div>
            </div>
            <div class="detail-tab-panel active" data-tab-panel="contacts">${renderRouteFieldsGrid(contactsFields)}</div>
            <div class="detail-tab-panel" data-tab-panel="finance">${renderRouteFieldsGrid(financeFields)}</div>
            <div class="detail-tab-panel" data-tab-panel="trip">${renderRouteFieldsGrid(tripFields)}</div>
            <div class="detail-tab-panel" data-tab-panel="note">${renderRouteFieldsGrid(noteFields)}</div>
            <!-- Кнопки дій для ліда: 2 рядки -->
            <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
                <button class="btn-card-action btn-call" style="flex:1 1 calc(33% - 6px)" onclick="event.stopPropagation(); window.open('tel:${cleanPhone}')">📞 Дзвінок</button>
                <button class="btn-card-action btn-write" style="flex:1 1 calc(33% - 6px)" onclick="event.stopPropagation(); openMessengerPopup('${cleanPhone}','${smartId}')">✉️ Писати</button>
                <button class="btn-card-action btn-edit" style="flex:1 1 calc(33% - 6px)" onclick="event.stopPropagation(); openRouteEditModal('${rteId}','${safeSheet}')">✏️ Редагувати</button>
                <button class="btn-card-action" style="flex:1 1 calc(33% - 6px);background:#ede9fe;color:#7c3aed;" onclick="event.stopPropagation(); transferRouteLeadModal('${rteId}','${safeSheet}')">🔄 Пересадити</button>
                <button class="btn-card-action" style="flex:1 1 calc(33% - 6px);background:#f3f4f6;color:#6b7280;" onclick="event.stopPropagation(); archiveFromRoute('${rteId}','${safeSheet}','${name.replace(/'/g,"\\'")}')">📦 Архів</button>
                <button class="btn-card-action btn-delete" style="flex:1 1 calc(33% - 6px)" onclick="event.stopPropagation(); deleteFromRoute('${rteId}','${safeSheet}','${name.replace(/'/g,"\\'")}')">🗑️ Видалити</button>
            </div>
        </div>
    </div>`;
}

// ── Перемикач вкладок розгорнутої картки маршруту ──
function switchRouteTab(rteId, tabName) {
    const card = document.getElementById('rte-details-' + rteId);
    if (!card) return;
    card.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    card.querySelectorAll('.detail-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tabPanel === tabName));
}

// ── Деталі картки маршруту ──
function toggleRouteDetails(rteId) {
    if (routeOpenDetailsId === rteId) {
        routeOpenDetailsId = null;
    } else {
        routeOpenDetailsId = rteId;
    }
    renderRoutes();
}

// ── Вибір лідів маршруту ──
function toggleRouteSelect(rteId, checked) {
    if (checked) routeSelectedIds.add(rteId); else routeSelectedIds.delete(rteId);
    updateRouteBulkToolbar();
    const card = document.getElementById('rte-card-' + rteId);
    if (card) card.classList.toggle('selected', checked);
}

function toggleRouteSelectAll() {
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    const filtered = getFilteredRouteRows(sheet.rows || []);
    const allSelected = filtered.length > 0 && filtered.every(r => routeSelectedIds.has(r['RTE_ID']));
    if (allSelected) {
        // Всі вибрані — знімаємо всі
        routeSelectedIds.clear();
    } else {
        // Не всі вибрані — вибираємо всі
        filtered.forEach(r => routeSelectedIds.add(r['RTE_ID']));
    }
    _routeToolbarForceOpen = true;
    renderRoutes();
}
function clearRouteSelection() {
    routeSelectedIds.clear();
    _routeToolbarForceOpen = false;
    updateRouteBulkToolbar();
    renderRoutes();
}
function updateRouteBulkToolbar() {
    const tb = document.getElementById('routeBulkToolbar');
    const ct = document.getElementById('routeBulkCount');
    if (!tb) return;
    if (routeSelectedIds.size > 0 || _routeToolbarForceOpen) {
        tb.classList.add('show');
        ct.textContent = routeSelectedIds.size + ' обрано';
    } else {
        tb.classList.remove('show');
    }
}

// ── Inline edit для полів маршруту ──
function startRouteInlineEdit(rteId, colName, sheetName) {
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    const row = (sheet.rows || []).find(r => r['RTE_ID'] === rteId);
    if (!row) return;
    const val = row[colName] || '';
    const el = document.getElementById('rdv-' + rteId + '-' + colName);
    if (!el) return;

    // Select fields
    const selectOpts = {
        'Статус': ['Новий','В роботі','Підтверджено','Відмова'],
        'Статус оплати': ['Не оплачено','Частково','Оплачено'],
        'Валюта': ['UAH','EUR','CHF','USD','CZK','PLN'],
        'Валюта завдатку': ['UAH','EUR','CHF','USD','CZK','PLN'],
        'Валюта багажу': ['UAH','EUR','CHF','USD','CZK','PLN']
    };

    if (selectOpts[colName]) {
        const opts = selectOpts[colName].map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');
        el.innerHTML = `<select class="detail-inline-edit" onchange="saveRouteInlineEdit('${rteId}','${colName}','${sheetName}',this.value)" onblur="cancelRouteInlineEdit('${rteId}','${colName}')">${opts}</select>`;
        el.querySelector('select').focus();
    } else if (colName === 'Дата рейсу') {
        el.innerHTML = `<input class="detail-inline-edit" type="date" value="${val}" onchange="saveRouteInlineEdit('${rteId}','${colName}','${sheetName}',this.value)" onblur="cancelRouteInlineEdit('${rteId}','${colName}')">`;
        el.querySelector('input').focus();
    } else {
        el.innerHTML = `<input class="detail-inline-edit" type="text" value="${val}" onkeydown="if(event.key==='Enter')saveRouteInlineEdit('${rteId}','${colName}','${sheetName}',this.value);if(event.key==='Escape')cancelRouteInlineEdit('${rteId}','${colName}')" onblur="saveRouteInlineEdit('${rteId}','${colName}','${sheetName}',this.value)">`;
        el.querySelector('input').focus();
    }
}
async function saveRouteInlineEdit(rteId, colName, sheetName, newVal) {
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    const row = (sheet.rows || []).find(r => r['RTE_ID'] === rteId);
    if (!row) return;
    const oldVal = row[colName] || '';
    if (String(newVal) === String(oldVal)) { cancelRouteInlineEdit(rteId, colName); return; }

    row[colName] = newVal;
    const el = document.getElementById('rdv-' + rteId + '-' + colName);
    if (el) el.textContent = newVal || '—';

    const res = await apiPost('updateRouteField', { sheet: sheetName, rte_id: rteId, col: colName, value: newVal });
    if (res.ok) {
        // Мерджимо свіжий GAS-keyed рядок назад у локальний sheet.rows —
        // без цього картка показує стару інфу (бо ми писали під одним GAS
        // ключем, а рендер читає інший аліас тієї ж колонки).
        if (res.data && typeof res.data === 'object') {
            Object.assign(row, res.data);
        }
        showToast('✅ Збережено');
        renderRoutes();
    } else {
        showToast('❌ Помилка: ' + (res.error || ''));
        row[colName] = oldVal;
        if (el) el.textContent = oldVal || '—';
    }
}
function cancelRouteInlineEdit(rteId, colName) {
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    const row = (sheet.rows || []).find(r => r['RTE_ID'] === rteId);
    if (!row) return;
    const el = document.getElementById('rdv-' + rteId + '-' + colName);
    if (el) el.textContent = row[colName] || '—';
}

// ── Редагувати лід маршруту через модалку ──
function openRouteEditModal(rteId, sheetName) {
    // Використовуємо inline edit у деталях картки
    toggleRouteDetails(rteId);
    showToast('Використовуйте ✏️ біля кожного поля для редагування');
}

// ── Видалити лід з маршруту ──
async function deleteFromRoute(rteId, sheetName, leadName) {
    showConfirm('Прибрати «' + leadName + '» з маршруту? (лід залишиться в CRM)', async (yes) => {
        if (!yes) return;
        showLoader('Видалення з маршруту...');
        const res = await apiPost('deleteFromSheet', { sheet: sheetName, id_col: 'RTE_ID', id_val: rteId });
        hideLoader();
        if (res.ok) {
            const sheet = routes[activeRouteIdx];
            if (sheet) sheet.rows = (sheet.rows || []).filter(r => r['RTE_ID'] !== rteId);
            routeSelectedIds.delete(rteId);
            showToast('✅ Прибрано з маршруту');
            renderRoutes();
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

// ── Bulk видалити з маршруту (тільки з аркуша, ліди залишаються в CRM) ──
async function routeBulkDeleteFromRoute() {
    if (routeSelectedIds.size === 0) return;
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    showConfirm('Прибрати ' + routeSelectedIds.size + ' записів з маршруту? (ліди залишаться в CRM)', async (yes) => {
        if (!yes) return;
        showLoader('Видалення з маршруту...');
        let ok = 0, fail = 0;
        for (const rteId of routeSelectedIds) {
            const res = await apiPost('deleteFromSheet', { sheet: sheet.sheetName, id_col: 'RTE_ID', id_val: rteId });
            if (res.ok) { ok++; sheet.rows = (sheet.rows || []).filter(r => r['RTE_ID'] !== rteId); }
            else fail++;
        }
        hideLoader();
        routeSelectedIds.clear();
        _routeToolbarForceOpen = false;
        updateRouteBulkToolbar();
        showToast('✅ Прибрано з маршруту: ' + ok + (fail ? ', помилок: ' + fail : ''));
        renderRoutes();
    });
}

// ── Пересадити лід в інший маршрут ──
function transferRouteLeadModal(rteId, sheetName) {
    const otherRoutes = routes.filter((r, i) => i !== activeRouteIdx);
    if (otherRoutes.length === 0) { showToast('⚠️ Немає інших маршрутів для пересадки'); return; }

    const opts = otherRoutes.map(r => {
        const n = (r.sheetName || '');
        return `<button class="messenger-popup-item" onclick="doTransferRouteLead('${rteId}','${sheetName}','${r.sheetName}')" style="padding:10px;font-size:12px;">🗺️ ${n}</button>`;
    }).join('');

    const grid = document.getElementById('messengerGrid');
    grid.innerHTML = opts;
    document.getElementById('messengerOverlay').classList.add('show');
}

async function doTransferRouteLead(rteId, fromSheet, toSheet) {
    closeMessengerPopup();
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    const row = (sheet.rows || []).find(r => r['RTE_ID'] === rteId);
    if (!row) return;

    showLoader('Пересадка...');
    // Add to new route
    const addRes = await apiPost('addToRoute', { sheetName: toSheet, leads: [row] });
    if (!addRes.ok) { hideLoader(); showToast('❌ ' + (addRes.error || 'Помилка додавання')); return; }
    // Delete from old route
    const delRes = await apiPost('deleteFromSheet', { sheet: fromSheet, id_col: 'RTE_ID', id_val: rteId });
    hideLoader();
    if (delRes.ok) {
        // Видаляємо зі старого маршруту
        sheet.rows = (sheet.rows || []).filter(r => r['RTE_ID'] !== rteId);
        routeSelectedIds.delete(rteId);
        // Інвалідуємо дані цільового маршруту щоб при відкритті перезавантажив
        var targetRoute = routes.find(function(r) { return r.sheetName === toSheet; });
        if (targetRoute) { targetRoute.rows = null; targetRoute.paxCount = (targetRoute.paxCount || 0) + 1; }
        renderRouteSidebar();
        renderRoutes();
        showToast('✅ Пересаджено в ' + toSheet);
    } else {
        showToast('⚠️ Додано в новий маршрут, але не видалено зі старого');
    }
}

// ── Bulk пересадка ──
function routeBulkTransfer() {
    if (routeSelectedIds.size === 0) return;
    const otherRoutes = routes.filter((r, i) => i !== activeRouteIdx);
    if (otherRoutes.length === 0) { showToast('⚠️ Немає інших маршрутів'); return; }

    const opts = otherRoutes.map(r => {
        const n = (r.sheetName || '');
        return `<button class="messenger-popup-item" onclick="doBulkTransfer('${r.sheetName}')" style="padding:10px;font-size:12px;">🗺️ ${n}</button>`;
    }).join('');

    const grid = document.getElementById('messengerGrid');
    grid.innerHTML = opts;
    document.getElementById('messengerOverlay').classList.add('show');
}

async function doBulkTransfer(toSheet) {
    closeMessengerPopup();
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    showLoader('Пересадка ' + routeSelectedIds.size + ' записів...');

    const leadsToMove = (sheet.rows || []).filter(r => routeSelectedIds.has(r['RTE_ID']));
    const addRes = await apiPost('addToRoute', { sheetName: toSheet, leads: leadsToMove });
    if (!addRes.ok) { hideLoader(); showToast('❌ ' + (addRes.error || 'Помилка')); return; }

    let ok = 0;
    for (const rteId of routeSelectedIds) {
        const res = await apiPost('deleteFromSheet', { sheet: sheet.sheetName, id_col: 'RTE_ID', id_val: rteId });
        if (res.ok) { ok++; sheet.rows = (sheet.rows || []).filter(r => r['RTE_ID'] !== rteId); }
    }
    // Інвалідуємо цільовий маршрут
    var targetRoute = routes.find(function(r) { return r.sheetName === toSheet; });
    if (targetRoute) { targetRoute.rows = null; targetRoute.paxCount = (targetRoute.paxCount || 0) + ok; }
    hideLoader();
    routeSelectedIds.clear();
    _routeToolbarForceOpen = false;
    updateRouteBulkToolbar();
    renderRouteSidebar();
    renderRoutes();
    showToast('✅ Пересаджено: ' + ok + ' в ' + toSheet);
}

// ── Створення нового маршруту ──
function promptCreateRoute() {
    const nameInput = prompt('Введіть назву нового маршруту:');
    if (!nameInput || !nameInput.trim()) return;
    const routeName = nameInput.trim();
    createRoute(routeName);
}

async function createRoute(routeName) {
    showLoader('Створення маршруту...');
    try {
        const res = await apiPost('createRoute', { name: routeName });
        hideLoader();
        if (res.ok) {
            showToast('✅ Маршрут "' + routeName + '" створено');
            await loadRoutes();
        } else {
            showToast('❌ ' + (res.error || 'Помилка створення'));
        }
    } catch (e) {
        hideLoader();
        showToast('❌ Помилка: ' + e.message);
    }
}

// ── Видалення маршруту ──
function confirmDeleteRoute(idx) {
    const sheet = routes[idx];
    if (!sheet) return;
    const name = sheet.sheetName || '';
    const baseName = name;

    showConfirm('Ви впевнені, що хочете видалити маршрут "' + baseName + '"?\nВсі ліди з маршруту потраплять в архів.', async function(yes) {
        if (!yes) return;
        showLoader('Видалення маршруту...');
        try {
            const res = await apiPost('deleteRoute', { name: baseName });
            hideLoader();
            if (res.ok) {
                showToast('✅ Маршрут "' + baseName + '" видалено');
                // Запитаємо про видалення Відправки та Витрат
                promptDeleteLinkedSheets(baseName);
            } else {
                showToast('❌ ' + (res.error || 'Помилка видалення'));
            }
        } catch (e) {
            hideLoader();
            showToast('❌ Помилка: ' + e.message);
        }
    });
}

function promptDeleteLinkedSheets(baseName) {
    // Перевіряємо чи існують пов'язані аркуші
    const hasDispatch = allRouteSheets.some(s => s.sheetName === 'Відправка ' + baseName || s.sheetName === 'Відправка_' + baseName);
    const hasExpenses = allRouteSheets.some(s => s.sheetName === 'Витрати ' + baseName || s.sheetName === 'Витрати_' + baseName);

    if (!hasDispatch && !hasExpenses) {
        // Нічого пов'язаного — просто перезавантажуємо
        if (activeRouteIdx !== null) activeRouteIdx = null;
        loadRoutes();
        return;
    }

    const sheets = [];
    if (hasDispatch) sheets.push('Відправка');
    if (hasExpenses) sheets.push('Витрати');

    showConfirm('Видалити також пов\'язані аркуші (' + sheets.join(', ') + ') для "' + baseName + '"?', async function(yes) {
        if (yes) {
            showLoader('Видалення пов\'язаних аркушів...');
            try {
                await apiPost('deleteLinkedSheets', { name: baseName });
                hideLoader();
                showToast('✅ Пов\'язані аркуші видалено');
            } catch (e) {
                hideLoader();
                showToast('❌ Помилка: ' + e.message);
            }
        }
        if (activeRouteIdx !== null) activeRouteIdx = null;
        loadRoutes();
    });
}
// ===== DISPATCH VIEW =====
function openDispatchView(idx) {
  activeRouteIdx = idx;
  switchMainView('dispatch');
  showToast('Завантаження відправки...', 'info');

  var d = dispatches[idx];
  apiPost('getDispatchSheet', { sheetName: d.sheetName }).then(function(res) {
    if (!res.ok) { showToast('Помилка: ' + res.error, 'error'); return; }
    routeData = res.data.rows || [];
    renderDispatchView(d);
  }).catch(function() { showToast('Помилка завантаження', 'error'); });
}

function refreshDispatchView() {
  if (activeRouteIdx !== null && dispatches[activeRouteIdx]) openDispatchView(activeRouteIdx);
}

function renderDispatchView(disp) {
  var cityName = disp.city || disp.sheetName;

  // Count totals
  var totalWeight = 0, totalSum = 0;
  routeData.forEach(function(r) {
    totalWeight += parseFloat(r['Вага']) || 0;
    totalSum += parseFloat(r['Сума']) || 0;
  });

  document.getElementById('routeHeader').innerHTML =
    '<div class="route-header-left">' +
      '<div class="route-header-title">📥 Відправка — ' + cityName + '</div>' +
      '<div class="route-header-stats">📦 ' + routeData.length + ' записів · ⚖️ ' + totalWeight.toFixed(1) + ' кг · 💰 ' + totalSum + '</div>' +
    '</div>' +
    '<div class="route-header-actions">' +
      '<button onclick="openDispatchPrintDialog()">🖨️ Друк списку</button>' +
      '<button onclick="refreshDispatchView()">🔄 Оновити</button>' +
      '<button onclick="backToParcels()">← Назад</button>' +
    '</div>';

  document.getElementById('routeFilters').innerHTML = '';

  var html = '<table class="route-table"><thead><tr>' +
    '<th>Дата оформлення</th><th>Внутрішній №</th><th>Відправник</th><th>Тел. відправника</th>' +
    '<th>Отримувач</th><th>Тел. отримувача</th><th>Адреса</th>' +
    '<th>Опис</th><th>Вага</th><th>Сума</th><th>Завдаток</th><th>Борг</th><th>Оплата</th><th>Статус</th>' +
  '</tr></thead><tbody>';

  routeData.forEach(function(r, i) {
    var pay = r['Статус оплати'] || '';
    var payColor = pay === 'Оплачено' ? '#22c55e' : pay === 'Частково' ? '#fbbf24' : '#ef4444';
    var status = r['Статус'] || '';
    var statusColor = status === 'Доставлено' ? '#22c55e' : status === 'В дорозі' ? '#3b82f6' : '#94a3b8';
    var desc = r['Опис посилки'] || '';

    html += '<tr onclick="openDispatchDetail(' + i + ')">' +
      '<td style="white-space:nowrap;font-size:11px;">' + (r['Дата створення'] || '—') + '</td>' +
      '<td style="font-weight:600;">' + (r['Внутрішній №'] || '—') + '</td>' +
      '<td>' + (r['Піб відправника'] || '—') + '</td>' +
      '<td style="font-size:11px;">' + (r['Телефон відправника'] || '—') + '</td>' +
      '<td>' + (r['Піб отримувача'] || '—') + '</td>' +
      '<td style="font-size:11px;">' + (r['Телефон отримувача'] || '—') + '</td>' +
      '<td title="' + (r['Адреса отримувача'] || '') + '">' + ((r['Адреса отримувача'] || '').substring(0, 20) || '—') + '</td>' +
      '<td title="' + desc + '">' + (desc.substring(0, 20) || '—') + (desc.length > 20 ? '...' : '') + '</td>' +
      '<td>' + (r['Вага'] || '—') + '</td>' +
      '<td>' + (r['Сума'] || '—') + ' ' + (r['Валюта'] || '') + '</td>' +
      '<td>' + (r['Завдаток'] || '—') + '</td>' +
      '<td style="font-weight:600;color:#ef4444;">' + (r['Борг'] || '—') + '</td>' +
      '<td><span class="route-status-badge" style="background:' + payColor + '20;color:' + payColor + '">' + (pay || '—') + '</span></td>' +
      '<td><span class="route-status-badge" style="background:' + statusColor + '20;color:' + statusColor + '">' + (status || '—') + '</span></td>' +
    '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('routeTableWrap').innerHTML = html;
}

var currentDispatchIdx = null;

function openDispatchDetail(idx) {
  currentDispatchIdx = idx;
  var r = routeData[idx];
  if (!r) return;
  var overlay = document.getElementById('routeDetailOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'routeDetailOverlay';
    overlay.className = 'route-detail-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) closeRouteDetail(); };
    document.body.appendChild(overlay);
  }

  var html = '<div class="route-detail-panel" id="dispatchDetailPanel">' +
    '<button class="detail-close" onclick="closeRouteDetail()">✕</button>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
      '<h3 style="margin:0;">📥 Відправка <span style="font-size:12px;font-weight:400;color:var(--text-secondary);">' + (r['DISPATCH_ID'] || '') + '</span></h3>' +
      '<div style="display:flex;gap:6px;">' +
        '<button class="dispatch-action-btn" onclick="printSingleDispatch(' + idx + ')" title="Друк">🖨️ Друк</button>' +
      '</div>' +
    '</div>';

  // Read-only sections
  html += renderRouteDetailSection('Відправник', [
    ['Піб відправника', r['Піб відправника']], ['Телефон відправника', r['Телефон відправника']],
    ['CLI_ID', r['CLI_ID']], ['ID_смарт клієнта', r['ID_смарт клієнта']]
  ]);
  html += renderRouteDetailSection('Отримувач', [
    ['Піб отримувача', r['Піб отримувача']], ['Телефон отримувача', r['Телефон отримувача']],
    ['Адреса отримувача', r['Адреса отримувача']]
  ]);
  html += renderRouteDetailSection('Посилка', [
    ['Внутрішній №', r['Внутрішній №']], ['Вага', r['Вага']],
    ['Опис посилки', r['Опис посилки']],
    ['Фото', r['Фото посилки'] ? '<a href="' + r['Фото посилки'] + '" target="_blank" style="color:var(--info);">📷 Переглянути</a>' : '']
  ]);

  html += renderRouteDetailSection('Фінанси', [
    ['Сума', r['Сума']], ['Валюта', r['Валюта']],
    ['Завдаток', r['Завдаток']], ['Валюта завдатку', r['Валюта завдатку']],
    ['Форма оплати', r['Форма оплати']], ['Статус оплати', r['Статус оплати']],
    ['Борг', r['Борг']]
  ]);

  html += renderRouteDetailSection('Рейс', [
    ['Дата створення', r['Дата створення']], ['Дата рейсу', r['Дата рейсу']],
    ['Водій', r['Водій']], ['Номер авто', r['Номер авто']],
    ['AUTO_ID', r['AUTO_ID']], ['RTE_ID', r['RTE_ID']]
  ]);

  html += renderRouteDetailSection('Статус / Системні', [
    ['DISPATCH_ID', r['DISPATCH_ID']], ['PKG_ID', r['PKG_ID']],
    ['Статус', r['Статус']], ['Примітка', r['Примітка']]
  ]);

  html += '</div>';
  overlay.innerHTML = html;
  overlay.classList.add('open');
}

// NOTE: dispatch details are READ-ONLY for manager.
// Creation / edits / status updates happen in driver-crm (водії).

// ===== DISPATCH PRINT LIST =====
var dispPrintCols = [
  { key: '№',                  label: '№',           on: true,  getter: function(r,i){ return i+1; } },
  { key: 'Внутрішній №',       label: 'Внутр. №',    on: true  },
  { key: 'Піб відправника',    label: 'Відправник',   on: true  },
  { key: 'Телефон відправника', label: 'Тел. відпр.',  on: true  },
  { key: 'Піб отримувача',     label: 'Отримувач',    on: true  },
  { key: 'Телефон отримувача',  label: 'Тел. отрим.',  on: true  },
  { key: 'Адреса отримувача',   label: 'Адреса',       on: true  },
  { key: 'Опис посилки',        label: 'Опис',         on: true  },
  { key: 'Вага',                label: 'Вага',         on: true  },
  { key: 'Сума',                label: 'Сума',         on: true  },
  { key: 'Валюта',              label: 'Валюта',       on: false },
  { key: 'Завдаток',            label: 'Завдаток',     on: false },
  { key: 'Борг',                label: 'Борг',         on: false },
  { key: 'Форма оплати',        label: 'Оплата',       on: false },
  { key: 'Статус оплати',       label: 'Статус опл.',  on: false },
  { key: 'Статус',              label: 'Статус',       on: false },
  { key: 'Примітка',            label: 'Примітка',     on: true  },
  { key: 'Дата створення',      label: 'Дата',         on: false }
];

function openDispatchPrintDialog() {
  if (!routeData || routeData.length === 0) {
    showToast('Немає записів для друку', 'error');
    return;
  }

  var overlay = document.getElementById('dispPrintOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dispPrintOverlay';
    overlay.className = 'route-detail-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.classList.remove('open'); };
    document.body.appendChild(overlay);
  }

  var d = dispatches[activeRouteIdx];
  var cityName = d ? (d.city || d.sheetName) : '';

  var html = '<div class="disp-print-dialog">' +
    '<button class="detail-close" onclick="document.getElementById(\'dispPrintOverlay\').classList.remove(\'open\')">✕</button>' +
    '<h3>🖨️ Друк списку відправок</h3>' +
    '<div class="disp-print-sub">' + cityName + ' — ' + routeData.length + ' записів</div>' +

    '<div class="disp-print-cols-title">Оберіть колонки для друку:</div>' +
    '<div class="disp-print-cols">';

  dispPrintCols.forEach(function(c, i) {
    html += '<label class="disp-print-col-check">' +
      '<input type="checkbox" ' + (c.on ? 'checked' : '') + ' onchange="dispPrintCols[' + i + '].on=this.checked; updateDispPrintPreview();" />' +
      '<span>' + c.label + '</span>' +
    '</label>';
  });

  html += '</div>' +
    '<div class="disp-print-actions">' +
      '<button onclick="selectAllDispPrintCols(true)">Вибрати всі</button>' +
      '<button onclick="selectAllDispPrintCols(false)">Зняти всі</button>' +
    '</div>' +
    '<div class="disp-print-preview-wrap"><div id="dispPrintPreview"></div></div>' +
    '<div style="text-align:center;padding:12px;">' +
      '<button class="dispatch-action-btn save-btn" onclick="executeDispatchPrint()" style="background:var(--info);color:#fff;padding:10px 32px;font-size:14px;">🖨️ Друкувати</button>' +
    '</div>' +
  '</div>';

  overlay.innerHTML = html;
  overlay.classList.add('open');
  updateDispPrintPreview();
}

function selectAllDispPrintCols(state) {
  dispPrintCols.forEach(function(c) { c.on = state; });
  var checks = document.querySelectorAll('.disp-print-col-check input');
  checks.forEach(function(cb) { cb.checked = state; });
  updateDispPrintPreview();
}

function updateDispPrintPreview() {
  var el = document.getElementById('dispPrintPreview');
  if (!el) return;
  var activeCols = dispPrintCols.filter(function(c) { return c.on; });
  if (activeCols.length === 0) { el.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Оберіть хоча б одну колонку</div>'; return; }

  var previewRows = routeData.slice(0, 5); // show max 5 rows in preview
  var html = '<table class="disp-print-table"><thead><tr>';
  activeCols.forEach(function(c) { html += '<th>' + c.label + '</th>'; });
  html += '</tr></thead><tbody>';
  previewRows.forEach(function(r, i) {
    html += '<tr>';
    activeCols.forEach(function(c) {
      var val = c.getter ? c.getter(r, i) : (r[c.key] || '');
      html += '<td>' + val + '</td>';
    });
    html += '</tr>';
  });
  if (routeData.length > 5) {
    html += '<tr><td colspan="' + activeCols.length + '" style="text-align:center;color:#999;font-style:italic;">... ще ' + (routeData.length - 5) + ' записів</td></tr>';
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}

function executeDispatchPrint() {
  var activeCols = dispPrintCols.filter(function(c) { return c.on; });
  if (activeCols.length === 0) { showToast('Оберіть хоча б одну колонку', 'error'); return; }

  var d = dispatches[activeRouteIdx];
  var cityName = d ? (d.city || d.sheetName) : '';
  var dateNow = new Date().toLocaleDateString('uk-UA');

  var printWin = window.open('', '_blank', 'width=1000,height=700');
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<title>Список відправок — ' + cityName + '</title>' +
    '<style>' +
      'body{font-family:Arial,sans-serif;padding:12px;color:#333;font-size:11px;margin:0;}' +
      'h1{font-size:16px;margin:0 0 2px;}' +
      '.sub{color:#666;font-size:11px;margin-bottom:10px;}' +
      'table{width:100%;border-collapse:collapse;}' +
      'th,td{border:1px solid #999;padding:3px 5px;text-align:left;font-size:10px;vertical-align:top;}' +
      'th{background:#e8e8e8;font-weight:700;white-space:nowrap;}' +
      'tr:nth-child(even){background:#f9f9f9;}' +
      '.totals{margin-top:8px;font-size:11px;font-weight:600;}' +
      '.no-print{margin-bottom:10px;}' +
      '@media print{.no-print{display:none!important;} body{padding:6px;} @page{size:landscape;margin:8mm;}}' +
    '</style></head><body>' +
    '<div class="no-print">' +
      '<button onclick="window.print()" style="padding:6px 16px;font-size:13px;cursor:pointer;">🖨️ Друкувати</button>' +
      '<button onclick="window.close()" style="padding:6px 16px;font-size:13px;cursor:pointer;margin-left:6px;">✕ Закрити</button>' +
    '</div>' +
    '<h1>Список відправок — ' + cityName + '</h1>' +
    '<div class="sub">Дата друку: ' + dateNow + ' | Кількість: ' + routeData.length + '</div>';

  // Table header
  html += '<table><thead><tr>';
  activeCols.forEach(function(c) { html += '<th>' + c.label + '</th>'; });
  html += '</tr></thead><tbody>';

  // Table rows
  var totalW = 0, totalS = 0;
  routeData.forEach(function(r, i) {
    html += '<tr>';
    activeCols.forEach(function(c) {
      var val = c.getter ? c.getter(r, i) : (r[c.key] || '');
      html += '<td>' + val + '</td>';
    });
    html += '</tr>';
    totalW += parseFloat(r['Вага']) || 0;
    totalS += parseFloat(r['Сума']) || 0;
  });

  html += '</tbody></table>';
  html += '<div class="totals">Всього: ' + routeData.length + ' посилок · Вага: ' + totalW.toFixed(1) + ' кг · Сума: ' + totalS.toFixed(0) + '</div>';
  html += '</body></html>';

  printWin.document.write(html);
  printWin.document.close();
}

function printSingleDispatch(idx) {
  var r = routeData[idx];
  if (!r) return;
  var d = dispatches[activeRouteIdx];
  var cityName = d ? (d.city || d.sheetName) : '';
  var printWin = window.open('', '_blank', 'width=800,height=600');
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<title>Відправка ' + (r['DISPATCH_ID'] || '') + '</title>' +
    '<style>' +
      'body{font-family:Arial,sans-serif;padding:20px;color:#333;font-size:12px;}' +
      'h1{font-size:16px;margin:0 0 4px;}' +
      '.sub{color:#666;font-size:11px;margin-bottom:12px;}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:12px;}' +
      'th,td{border:1px solid #ccc;padding:4px 8px;text-align:left;font-size:11px;}' +
      'th{background:#f5f5f5;font-weight:600;width:35%;}' +
      '.section{font-size:12px;font-weight:700;background:#e8e8e8;padding:4px 8px;}' +
      '.footer{margin-top:24px;display:flex;justify-content:space-between;}' +
      '.sign-line{border-top:1px solid #333;width:180px;text-align:center;padding-top:3px;font-size:10px;}' +
      '@media print{.no-print{display:none!important;} body{padding:10px;}}' +
    '</style></head><body>' +
    '<div class="no-print" style="margin-bottom:8px;">' +
      '<button onclick="window.print()" style="padding:6px 14px;cursor:pointer;">🖨️ Друкувати</button>' +
      '<button onclick="window.close()" style="padding:6px 14px;cursor:pointer;margin-left:6px;">✕ Закрити</button>' +
    '</div>' +
    '<h1>Відправка №' + (r['Внутрішній №'] || r['DISPATCH_ID'] || '—') + '</h1>' +
    '<div class="sub">' + cityName + ' | Дата: ' + (r['Дата створення'] || '—') + ' | Водій: ' + (r['Водій'] || '—') + ' | Авто: ' + (r['Номер авто'] || '—') + '</div>' +
    '<table>' +
    '<tr class="section"><td colspan="2">Відправник / Отримувач</td></tr>' +
    '<tr><th>Відправник</th><td>' + (r['Піб відправника'] || '—') + ' | ' + (r['Телефон відправника'] || '') + '</td></tr>' +
    '<tr><th>Отримувач</th><td>' + (r['Піб отримувача'] || '—') + ' | ' + (r['Телефон отримувача'] || '') + '</td></tr>' +
    '<tr><th>Адреса</th><td>' + (r['Адреса отримувача'] || '—') + '</td></tr>' +
    '<tr class="section"><td colspan="2">Посилка</td></tr>' +
    '<tr><th>Внутр. № / Вага</th><td>' + (r['Внутрішній №'] || '—') + ' | ' + (r['Вага'] || '—') + ' кг</td></tr>' +
    '<tr><th>Опис</th><td>' + (r['Опис посилки'] || '—') + '</td></tr>' +
    '<tr class="section"><td colspan="2">Фінанси</td></tr>' +
    '<tr><th>Сума / Завдаток</th><td>' + (r['Сума'] || '0') + ' ' + (r['Валюта'] || '') + ' | Завдаток: ' + (r['Завдаток'] || '0') + '</td></tr>' +
    '<tr><th>Борг</th><td style="font-weight:700;">' + (r['Борг'] || '0') + '</td></tr>' +
    '<tr><th>Примітка</th><td>' + (r['Примітка'] || '—') + '</td></tr>' +
    '</table>' +
    '<div class="footer">' +
      '<div class="sign-line">Відправник</div>' +
      '<div class="sign-line">Менеджер</div>' +
      '<div class="sign-line">Водій</div>' +
    '</div></body></html>';
  printWin.document.write(html);
  printWin.document.close();
}

// ===== EXPENSES VIEW =====
function openExpensesView(idx) {
  activeRouteIdx = idx;
  switchMainView('expenses');
  showToast('Завантаження витрат...', 'info');

  var e = expenses[idx];
  apiPost('getExpensesSheet', { sheetName: e.sheetName }).then(function(res) {
    if (!res.ok) { showToast('Помилка: ' + res.error, 'error'); return; }
    routeData = res.data.rows || [];
    renderExpensesView(e);
  }).catch(function() { showToast('Помилка завантаження', 'error'); });
}

function refreshExpensesView() {
  if (activeRouteIdx !== null && expenses[activeRouteIdx]) openExpensesView(activeRouteIdx);
}

function renderExpensesView(exp) {
  var cityName = exp.city || exp.sheetName;

  document.getElementById('routeHeader').innerHTML =
    '<div class="route-header-left">' +
      '<div class="route-header-title">💰 Витрати — ' + cityName + '</div>' +
      '<div class="route-header-stats">' + routeData.length + ' записів <span class="readonly-badge">READ-ONLY</span></div>' +
    '</div>' +
    '<div class="route-header-actions">' +
      '<button onclick="refreshExpensesView()">🔄 Оновити</button>' +
      '<button onclick="backToParcels()">← Назад</button>' +
    '</div>';

  document.getElementById('routeFilters').innerHTML = '';

  var html = '<table class="route-table"><thead><tr>' +
    '<th>Дата</th><th>Водій</th><th>Авто</th><th>Бензин</th><th>Їжа</th><th>Паркування</th><th>Толл</th><th>Штраф</th><th>Всього</th><th>Чайові</th>' +
  '</tr></thead><tbody>';

  routeData.forEach(function(r) {
    html += '<tr>' +
      '<td>' + (r['Дата рейсу'] || '—') + '</td>' +
      '<td>' + (r['Водій'] || '—') + '</td>' +
      '<td>' + (r['Номер авто'] || '—') + '</td>' +
      '<td>' + (r['Бензин'] || '—') + '</td>' +
      '<td>' + (r['Їжа'] || '—') + '</td>' +
      '<td>' + (r['Паркування'] || '—') + '</td>' +
      '<td>' + (r['Толл на дорозі'] || '—') + '</td>' +
      '<td>' + (r['Штраф'] || '—') + '</td>' +
      '<td style="font-weight:700">' + (r['Всього витрат'] || '—') + ' ' + (r['Валюта витрат'] || '') + '</td>' +
      '<td>' + (r['Чайові'] || '—') + '</td>' +
    '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('routeTableWrap').innerHTML = html;
}

// ===== SUMMARY VIEW =====
function openSummaryView() {
  activeRouteIdx = null;
  switchMainView('summary');
  showToast('Завантаження зведення...', 'info');

  apiPost('getRouteSheet', { sheetName: 'Зведення рейсів' }).then(function(res) {
    if (!res.ok) { showToast('Помилка: ' + res.error, 'error'); return; }
    routeData = res.data.rows || [];
    renderSummaryView();
  }).catch(function() { showToast('Помилка завантаження', 'error'); });
}

function renderSummaryView() {
  document.getElementById('routeHeader').innerHTML =
    '<div class="route-header-left">' +
      '<div class="route-header-title">📊 Зведення рейсів</div>' +
      '<div class="route-header-stats">' + routeData.length + ' рейсів <span class="readonly-badge">READ-ONLY</span></div>' +
    '</div>' +
    '<div class="route-header-actions">' +
      '<button onclick="refreshRouteView()">🔄 Оновити</button>' +
      '<button onclick="backToParcels()">← Назад</button>' +
    '</div>';

  document.getElementById('routeFilters').innerHTML = '';

  var html = '<table class="route-table"><thead><tr>' +
    '<th>RTE_ID</th><th>Дата</th><th>Місто</th><th>Водій</th><th>Авто</th><th>Статус</th><th>Примітка</th>' +
  '</tr></thead><tbody>';

  routeData.forEach(function(r) {
    var st = r['Статус'] || '';
    var stColor = st === 'Закрито' ? '#22c55e' : '#f97316';
    html += '<tr>' +
      '<td>' + (r['RTE_ID'] || '—') + '</td>' +
      '<td>' + (r['Дата рейсу'] || '—') + '</td>' +
      '<td>' + (r['Місто'] || '—') + '</td>' +
      '<td>' + (r['Водій'] || '—') + '</td>' +
      '<td>' + (r['Номер авто'] || '—') + '</td>' +
      '<td><span class="route-status-badge" style="background:' + stColor + '20;color:' + stColor + '">' + (st || '—') + '</span></td>' +
      '<td>' + (r['Примітка'] || '—') + '</td>' +
    '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('routeTableWrap').innerHTML = html;
}

// ===== OPEN ROUTE MODAL (from parcel card) =====
function openRouteModal(pkgId) {
  if (routes.length === 0) {
    showToast('Маршрути не завантажені', 'error');
    return;
  }
  _routeModalPkgIds = [pkgId];
  _routeModalMode = 'single';
  showRoutePickerModal('🗺️ Перенести в маршрут', 'Обрати маршрут для посилки:');
}

function closeRouteDetail() {
  var overlay = document.getElementById('routeDetailOverlay');
  if (overlay) overlay.classList.remove('open');
}

// Shared route picker modal state
var _routeModalPkgIds = [];
var _routeModalMode = 'single'; // 'single' or 'bulk'

function showRoutePickerModal(title, subtitle) {
  var overlay = document.getElementById('routeDetailOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'routeDetailOverlay';
    overlay.className = 'route-detail-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) closeRouteDetail(); };
    document.body.appendChild(overlay);
  }

  var routeButtons = '';
  if (routes.length === 0) {
    routeButtons = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:12px;">Немає доступних маршрутів.<br>Створіть маршрут у меню зліва.</div>';
  } else {
    routeButtons = routes.map(function(r, i) {
      var name = r.city || (r.sheetName || '').replace(/^Маршрут_/, '');
      return '<button class="route-pick-btn" onclick="doAssignToRoute(' + i + ')">' +
        '<span>🗺️ ' + name + '</span>' +
        '<span style="font-size:10px;color:var(--text-secondary);font-weight:400;">👤' + (r.paxCount||0) + ' · 📦' + (r.parcelCount||0) + '</span>' +
      '</button>';
    }).join('');
  }

  overlay.innerHTML =
    '<div class="route-detail-panel">' +
      '<div class="route-modal-header">' +
        '<span class="route-modal-title">' + title + '</span>' +
        '<button class="route-modal-close" onclick="closeRouteDetail()">×</button>' +
      '</div>' +
      '<div class="route-modal-body">' +
        '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;">' + subtitle + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' + routeButtons + '</div>' +
      '</div>' +
      '<div class="route-modal-footer">' +
        '<button onclick="closeRouteDetail()" style="padding:6px 16px;border:1px solid var(--border);border-radius:6px;background:#fff;font-family:inherit;font-size:12px;cursor:pointer;">Скасувати</button>' +
      '</div>' +
    '</div>';
  overlay.classList.add('open');
}

async function doAssignToRoute(routeIdx) {
  var route = routes[routeIdx];
  var ids = _routeModalPkgIds;
  var routeName = route.city || route.sheetName;
  closeRouteDetail();

  showToast('Додаємо ' + ids.length + ' запис(ів) в ' + routeName + '...', 'info');

  var success = 0;
  for (var i = 0; i < ids.length; i++) {
    try {
      var res = await apiPost('addToRoute', {
        pkg_id: ids[i],
        sheet_name: route.sheetName,
        rte_id: route.sheetName
      });
      if (res.ok) {
        success++;
        var item = allData.find(function(p) { return p['PKG_ID'] === ids[i]; });
        if (item) item['RTE_ID'] = route.sheetName;
      }
    } catch(e) {}
  }

  // Інвалідуємо кеш доданого маршруту: інакше при відкритті в sidebar
  // відобразяться старі rows без щойно доданих посилок.
  if (route) {
    route.rows = null;
    route.rowCount = (route.rowCount || 0) + success;
    route.parcelCount = (route.parcelCount || 0) + success;
    var allIdx = (typeof allRouteSheets !== 'undefined') ? allRouteSheets.findIndex(function(s) { return s.sheetName === route.sheetName; }) : -1;
    if (allIdx !== -1) {
      allRouteSheets[allIdx].rows = null;
      allRouteSheets[allIdx].rowCount = route.rowCount;
      allRouteSheets[allIdx].parcelCount = route.parcelCount;
    }
  }

  showToast('Додано в ' + routeName + ': ' + success + ' з ' + ids.length, success > 0 ? 'success' : 'error');
  if (_routeModalMode === 'bulk') afterBulkAction();
  else renderCards();

  // Якщо юзер прямо зараз відкритий саме на цьому маршруті — перерендеримо одразу
  if (typeof activeRouteIdx !== 'undefined' && activeRouteIdx === routeIdx) {
    try { await loadRouteSheetData(routeIdx, true); renderRoutes(); } catch(_) {}
  }
  // Оновлюємо лічильники в sidebar
  if (typeof renderRouteSidebar === 'function') renderRouteSidebar();
}

// ===== [SECT-COUNTERS] COUNTERS =====
function updateCounters() {
  try {
    const active = allData.filter(p => p['Статус CRM'] !== 'Архів');
    const ue = active.filter(p => p['Напрям'] === 'УК→ЄВ');
    const eu = active.filter(p => p['Напрям'] === 'ЄВ→УК');
    const setCount = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setCount('countUe', ue.length);
    setCount('countEu', eu.length);
    setCount('mobCountUe', ue.length);
    setCount('mobCountEu', eu.length);
    const dirData = currentDirection === 'ue' ? ue : eu;
    var cAll = dirData.length;
    var cChecking = dirData.filter(p => p['Контроль перевірки'] === 'В перевірці').length;
    var cReady = dirData.filter(p => p['Контроль перевірки'] === 'Готова до маршруту').length;
    var cUnknown = dirData.filter(p => p['Статус ліда'] === 'Невідомий').length;
    setCount('countAll', cAll);
    setCount('countChecking', cChecking);
    setCount('countReady', cReady);
    setCount('countUnknown', cUnknown);
    // Mobile counters
    setCount('mobCountAll', cAll);
    setCount('mobCountChecking', cChecking);
    setCount('mobCountReady', cReady);
    setCount('mobCountUnknown', cUnknown);
  } catch(e) { console.error('updateCounters error:', e); }
}

// ===== [SECT-STUBS] PLACEHOLDER FUNCTIONS =====
function setFilter(f) {
  currentVerifyFilter = f;
  // Update mobile sidebar active state
  document.querySelectorAll('#mobileSidebar .mob-item').forEach(el => {
    const onclickAttr = el.getAttribute('onclick') || '';
    if (onclickAttr.includes('setFilter')) {
      el.classList.toggle('active', onclickAttr.includes("'" + f + "'"));
    }
  });
  renderCards();
  updateCounters();
  closeMobileSidebar();
}

function setVerFilter(f) {
  currentVerifyFilter = f;
  // Update desktop sidebar
  document.querySelectorAll('.sidebar [data-filter]').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === f);
  });
  // Update mobile sidebar
  document.querySelectorAll('#mobileSidebar [data-mfilter]').forEach(el => {
    el.classList.toggle('active', el.dataset.mfilter === f);
  });
  // Switch back to parcels view if in route/other view
  if (currentView !== 'parcels') backToParcels();
  else renderCards();
  updateCounters();
}
// startEdit/saveEdit replaced by startInlineEdit/saveInlineEdit

function openMessenger(phone) {
  const clean = phone.replace(/[^+\d]/g, '');
  const menu = document.createElement('div');
  menu.style.cssText = 'position:fixed;inset:0;z-index:700;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
  menu.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:20px;min-width:250px;text-align:center;">
      <div style="font-weight:700;margin-bottom:12px;">Написати ${phone}</div>
      <a href="viber://chat?number=${clean}" style="display:block;padding:10px;margin:4px 0;background:#7360f2;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Viber</a>
      <a href="https://t.me/${clean}" style="display:block;padding:10px;margin:4px 0;background:#0088cc;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Telegram</a>
      <a href="https://wa.me/${clean.replace('+','')}" style="display:block;padding:10px;margin:4px 0;background:#25d366;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">WhatsApp</a>
      <button onclick="this.closest('div').parentElement.remove()" style="margin-top:10px;padding:8px 20px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-family:inherit;">Скасувати</button>
    </div>
  `;
  document.body.appendChild(menu);
  menu.addEventListener('click', e => { if (e.target === menu) menu.remove(); });
}

// openRouteModal defined in SECT-ROUTE-MODAL above

// ===== [SECT-ARCHIVE] ARCHIVE SYSTEM =====

// Архівувати посилку з причиною
async function deleteRecord(pkgId) {
  const reason = prompt('Причина архівування (або залиште порожнім):', '');
  if (reason === null) return; // Натиснув Cancel

  const item = allData.find(p => p['PKG_ID'] === pkgId);
  if (item) {
    item['Статус CRM'] = 'Архів';
    item['DATE_ARCHIVE'] = new Date().toISOString();
    item['ARCHIVE_REASON'] = reason;
  }
  renderCards();
  updateCounters();

  const res = await apiPost('deleteParcel', { pkg_id: pkgId, reason: reason, archived_by: 'CRM' });
  if (res.ok) showToast('Архівовано', 'success');
}

// Перемкнути вид Архів / Активні
async function toggleArchiveView() {
  showArchive = !showArchive;
  var btn = document.getElementById('archiveToggleBtn');
  if (btn) {
    if (showArchive) {
      btn.style.background = 'var(--primary)';
      btn.style.color = '#fff';
      btn.innerHTML = '🗄️ Архів (активний) <span class="badge-count" id="countArchive" style="background:#fff;color:var(--primary);"></span>';
    } else {
      btn.style.background = '';
      btn.style.color = '';
      btn.innerHTML = '🗄️ Архів <span class="badge-count" id="countArchive"></span>';
    }
  }

  if (showArchive) {
    showToast('Завантаження архіву...', 'info');
    var dir = currentDirection === 'ue' ? 'ue' : 'eu';
    var res = await apiPost('getArchive', { direction: dir });
    if (res.ok) {
      archiveData = res.data || [];
      var countEl = document.getElementById('countArchive');
      if (countEl) countEl.textContent = archiveData.length;
      renderArchiveCards();
    } else {
      showToast('Помилка завантаження архіву', 'error');
      showArchive = false;
      if (btn) { btn.style.background = ''; btn.style.color = ''; btn.innerHTML = '🗄️ Архів <span class="badge-count" id="countArchive"></span>'; }
    }
  } else {
    archiveData = [];
    renderCards();
  }
}

// Рендер архівних карток
function renderArchiveCards() {
  const container = document.getElementById('cardsList');
  if (!container) return;

  if (archiveData.length === 0) {
    container.innerHTML = '<div class="empty-state">🗄️ Архів порожній</div>';
    return;
  }

  // Панель масових дій
  var massBar = '<div style="padding:8px 12px;background:#fef3c7;border-radius:8px;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
    '<span style="font-size:13px;font-weight:600;color:#92400e;">🗄️ Архів — ' + archiveData.length + ' записів</span>' +
    '<label style="margin-left:auto;font-size:12px;cursor:pointer;color:#92400e;">' +
      '<input type="checkbox" id="archSelectAll" onchange="archiveSelectAll(this.checked)"> Вибрати всі' +
    '</label>' +
    '<button onclick="archiveMassRestore()" style="background:var(--success);color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;">♻️ Відновити вибрані</button>' +
    '<button onclick="archiveMassDelete()" style="background:var(--danger);color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;">🗑️ Видалити назавжди</button>' +
  '</div>';

  container.innerHTML = massBar + archiveData.map(function(p) { return renderArchiveCard(p); }).join('');
}

// Архівна картка — такий самий вигляд як активна, але з архівними діями
function renderArchiveCard(p) {
  var pkgId = p['PKG_ID'] || '';
  var name = p['Піб відправника'] || '—';
  var phone = p['Телефон реєстратора'] || '';
  var receiver = p['Піб отримувача'] || '—';
  var receiverPhone = p['Телефон отримувача'] || '';
  var direction = p['Напрям'] || '';
  var isUE = direction === 'УК→ЄВ';
  var dirLabel = isUE ? 'УК→ЄВ' : 'ЄВ→УК';
  var dirClass = isUE ? 'dir-badge-ua-eu' : 'dir-badge-eu-ua';
  var addressTo = p['Адреса в Європі'] || p['Місто Нова Пошта'] || p['Адреса отримувача'] || '';
  var addressFrom = p['Адреса відправки'] || '';
  var weight = p['Кг'] || '';
  var price = p['Сума'] || '';
  var currency = p['Валюта оплати'] || '';
  var ttn = p['Номер ТТН'] || '';
  var dateArchive = p['DATE_ARCHIVE'] || '';
  var reason = p['ARCHIVE_REASON'] || '';
  var archivedBy = p['ARCHIVED_BY'] || '';
  var dateCreated = p['Дата створення'] || '';
  var leadStatus = p['Статус ліда'] || '';
  var payStatus = p['Статус оплати'] || '';
  var deposit = parseFloat(p['Завдаток']) || 0;
  var debt = parseFloat(p['Борг']) || 0;
  var isChecked = archiveSelectedIds.has(pkgId);
  var isOpen = openCardId === pkgId;

  var ttnHtml = (isUE && ttn) ? '<span class="card-ttn">TTH: ' + ttn + '</span>' : '';

  // Lead badge
  var leadBadgeMap = { 'Новий': 'badge-new', 'В роботі': 'badge-work', 'Активний': 'badge-work', 'Підтверджено': 'badge-confirmed', 'Зарахований': 'badge-confirmed', 'Відмова': 'badge-refused', 'Невідомий': 'badge-unknown' };
  var leadBadge = leadStatus ? '<span class="badge ' + (leadBadgeMap[leadStatus] || '') + '">' + leadStatus + '</span>' : '';

  // Pay badge
  var payBadgeMap = { 'Оплачено': 'badge-paid', 'Частково': 'badge-partial', 'Не оплачено': 'badge-unpaid' };
  var payBadge = payStatus ? '<span class="badge ' + (payBadgeMap[payStatus] || '') + '">' + payStatus + '</span>' : '';
  var priceColorClass = payStatus === 'Оплачено' ? 'paid' : (payStatus === 'Частково' ? 'partial' : 'unpaid');

  // Detail tabs (read-only)
  var tabParcel = renderDetailGrid([
    ['Опис', p['Опис'] || ''], ['Деталі', p['Деталі'] || ''],
    ['Кількість позицій', p['Кількість позицій'] || ''], ['Кг', weight],
    ['Номер ТТН', ttn], ['Внутрішній №', p['Внутрішній №'] || ''],
    ['Статус посилки', p['Статус посилки'] || ''],
  ].map(function(f) { return [f[0], f[1], {readonly:true}]; }), pkgId);

  var tabBasic = renderDetailGrid([
    ['Піб відправника', name], ['Телефон реєстратора', phone],
    ['Адреса відправки', addressFrom],
    ['Піб отримувача', receiver], ['Телефон отримувача', receiverPhone],
    [isUE ? 'Адреса в Європі' : 'Місто Нова Пошта', addressTo],
    ['Статус ліда', leadStatus], ['Тег', p['Тег'] || ''],
  ].map(function(f) { return [f[0], f[1], {readonly:true}]; }), pkgId);

  var tabFinance = renderDetailGrid([
    ['Сума', price], ['Валюта оплати', currency],
    ['Завдаток', p['Завдаток'] || ''], ['Валюта завдатку', p['Валюта завдатку'] || ''],
    ['Форма оплати', p['Форма оплати'] || ''], ['Статус оплати', payStatus],
    ['Борг', debt ? String(debt) : '', {readonly:true}],
  ].map(function(f) { return [f[0], f[1], f[2] || {readonly:true}]; }), pkgId);

  var tabArchive = renderDetailGrid([
    ['ARCHIVE_ID', p['ARCHIVE_ID'] || '', {readonly:true}],
    ['DATE_ARCHIVE', dateArchive, {readonly:true}],
    ['ARCHIVED_BY', archivedBy, {readonly:true}],
    ['ARCHIVE_REASON', reason, {readonly:true}],
    ['SOURCE_SHEET', p['SOURCE_SHEET'] || '', {readonly:true}],
  ], pkgId);

  return '<div class="lead-card" data-id="' + pkgId + '" style="border-left:4px solid #94a3b8;">' +
    '<div class="card-header" onclick="toggleCard(\'' + pkgId + '\')">' +
      '<div class="card-top-row">' +
        '<input type="checkbox" class="card-checkbox" onclick="event.stopPropagation(); archiveToggleSelect(\'' + pkgId + '\')" ' + (isChecked ? 'checked' : '') + '>' +
        '<span class="dir-badge ' + dirClass + '">' + dirLabel + '</span>' +
        ttnHtml +
        (weight ? '<span class="badge-weight">⚖️ ' + weight + ' кг</span>' : '') +
        '<div class="card-finance">' +
          (price ? '<span class="card-price ' + priceColorClass + '">' + price + ' ' + currency + '</span>' : '') +
          (deposit > 0 ? '<span class="card-deposit">завд:' + deposit + '</span>' : '') +
          (debt > 0 ? '<span class="card-debt">борг:' + debt + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="card-row2-wrap">' +
        '<div class="card-row2">' +
          '<span class="card-pkgid">' + pkgId + '</span>' +
          '<span class="card-sender-recv">👤 ' + name + ' → ' + receiver + '</span>' +
          '<span class="badge" style="background:#fee2e2;color:#991b1b;">Архів</span>' +
          leadBadge + ' ' + payBadge +
        '</div>' +
        ((addressFrom || addressTo) ? '<div class="card-address">📍 ' + (addressFrom && addressTo ? addressFrom + ' → ' + addressTo : (addressFrom || addressTo)) + '</div>' : '') +
        '<div class="card-meta-tags">' +
          (dateCreated ? '<span class="meta-tag">📅 ' + dateCreated + '</span>' : '') +
          (dateArchive ? '<span class="meta-tag" style="color:#991b1b;">🗄️ ' + dateArchive + '</span>' : '') +
          (reason ? '<span class="meta-tag">📝 ' + reason + '</span>' : '') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card-actions" id="actions-' + pkgId + '" style="display:flex;padding:8px 12px;gap:8px;">' +
      '<button onclick="event.stopPropagation(); restoreFromArchive(\'' + pkgId + '\')" style="background:var(--success);color:#fff;">♻️ Відновити</button>' +
      '<button onclick="event.stopPropagation(); permanentDelete(\'' + pkgId + '\')" class="btn-danger">🗑️ Видалити назавжди</button>' +
    '</div>' +
    '<div class="card-details ' + (isOpen ? 'open' : '') + '" id="details-' + pkgId + '">' +
      '<div class="detail-tabs">' +
        '<div class="detail-tab active" data-tab="parcel" onclick="event.stopPropagation(); switchTab(\'' + pkgId + '\', \'parcel\')">📦 Посилка</div>' +
        '<div class="detail-tab" data-tab="basic" onclick="event.stopPropagation(); switchTab(\'' + pkgId + '\', \'basic\')">📄 Основне</div>' +
        '<div class="detail-tab" data-tab="finance" onclick="event.stopPropagation(); switchTab(\'' + pkgId + '\', \'finance\')">💰 Фінанси</div>' +
        '<div class="detail-tab" data-tab="archive" onclick="event.stopPropagation(); switchTab(\'' + pkgId + '\', \'archive\')">🗄️ Архів</div>' +
      '</div>' +
      '<div class="detail-tab-panel active" data-tab-panel="parcel">' + tabParcel + '</div>' +
      '<div class="detail-tab-panel" data-tab-panel="basic">' + tabBasic + '</div>' +
      '<div class="detail-tab-panel" data-tab-panel="finance">' + tabFinance + '</div>' +
      '<div class="detail-tab-panel" data-tab-panel="archive">' + tabArchive + '</div>' +
    '</div>' +
  '</div>';
}

// ===== ARCHIVE SELECTION & MASS ACTIONS =====
var archiveSelectedIds = new Set();

function archiveToggleSelect(pkgId) {
  if (archiveSelectedIds.has(pkgId)) archiveSelectedIds.delete(pkgId);
  else archiveSelectedIds.add(pkgId);
}

function archiveSelectAll(checked) {
  archiveSelectedIds.clear();
  if (checked) {
    archiveData.forEach(function(p) {
      if (p['PKG_ID']) archiveSelectedIds.add(p['PKG_ID']);
    });
  }
  renderArchiveCards();
}

// Відновити з архіву (одну)
async function restoreFromArchive(pkgId) {
  if (!confirm('Відновити посилку ' + pkgId + ' з архіву?')) return;
  showToast('Відновлення...', 'info');
  const res = await apiPost('restoreFromArchive', { pkg_id: pkgId });
  if (res.ok) {
    archiveData = archiveData.filter(function(p) { return p['PKG_ID'] !== pkgId; });
    archiveSelectedIds.delete(pkgId);
    var countEl = document.getElementById('countArchive');
    if (countEl) countEl.textContent = archiveData.length;
    renderArchiveCards();
    showToast('Відновлено з архіву', 'success');
  } else {
    showToast(res.error || 'Помилка відновлення', 'error');
  }
}

// Видалити назавжди (одну)
async function permanentDelete(pkgId) {
  if (!confirm('ВИДАЛИТИ НАЗАВЖДИ посилку ' + pkgId + '? Це неможливо скасувати!')) return;
  showToast('Видалення...', 'info');
  const res = await apiPost('permanentDelete', { pkg_id: pkgId });
  if (res.ok) {
    archiveData = archiveData.filter(function(p) { return p['PKG_ID'] !== pkgId; });
    archiveSelectedIds.delete(pkgId);
    var countEl = document.getElementById('countArchive');
    if (countEl) countEl.textContent = archiveData.length;
    renderArchiveCards();
    showToast('Видалено назавжди', 'success');
  } else {
    showToast(res.error || 'Помилка видалення', 'error');
  }
}

// Масове відновлення
async function archiveMassRestore() {
  if (archiveSelectedIds.size === 0) { showToast('Виберіть посилки', 'warning'); return; }
  if (!confirm('Відновити ' + archiveSelectedIds.size + ' посилок з архіву?')) return;
  showToast('Відновлення ' + archiveSelectedIds.size + ' посилок...', 'info');
  var ids = Array.from(archiveSelectedIds);
  var success = 0;
  for (var i = 0; i < ids.length; i++) {
    var res = await apiPost('restoreFromArchive', { pkg_id: ids[i] });
    if (res.ok) success++;
  }
  archiveSelectedIds.clear();
  // Перезавантажити архів
  var dir = currentDirection === 'ue' ? 'ue' : 'eu';
  var archRes = await apiPost('getArchive', { direction: dir });
  if (archRes.ok) {
    archiveData = archRes.data || [];
    var countEl = document.getElementById('countArchive');
    if (countEl) countEl.textContent = archiveData.length;
  }
  renderArchiveCards();
  showToast('Відновлено ' + success + ' з ' + ids.length, 'success');
}

// Масове видалення назавжди
async function archiveMassDelete() {
  if (archiveSelectedIds.size === 0) { showToast('Виберіть посилки', 'warning'); return; }
  if (!confirm('ВИДАЛИТИ НАЗАВЖДИ ' + archiveSelectedIds.size + ' посилок? Це неможливо скасувати!')) return;
  showToast('Видалення...', 'info');
  var ids = Array.from(archiveSelectedIds);
  var res = await apiPost('permanentDelete', { pkg_ids: ids });
  if (res.ok) {
    archiveData = archiveData.filter(function(p) { return !archiveSelectedIds.has(p['PKG_ID']); });
    archiveSelectedIds.clear();
    var countEl = document.getElementById('countArchive');
    if (countEl) countEl.textContent = archiveData.length;
    renderArchiveCards();
    showToast('Видалено ' + (res.deleted || ids.length) + ' записів', 'success');
  } else {
    showToast(res.error || 'Помилка видалення', 'error');
  }
}

function createRoute() { alert('Створення нового маршруту'); }

// ===== [SECT-ADDFORM] ADD PARCEL FORM =====
function openAddForm() {
  addFormDirection = currentDirection;
  document.getElementById('fDirection').value = addFormDirection;
  clearAddForm();
  setAddDirection(addFormDirection);
  initSwissPoints();
  document.getElementById('addFormOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAddForm() {
  document.getElementById('addFormOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function setAddDirection(dir) {
  addFormDirection = dir;
  document.getElementById('fDirection').value = dir;

  const ueBtn = document.getElementById('addDirUe');
  const euBtn = document.getElementById('addDirEu');
  const header = document.getElementById('addSheetHeader');
  const saveBtn = document.getElementById('addBtnSave');
  const smsTextarea = document.getElementById('fSmsText');

  ueBtn.className = 'add-dir-btn' + (dir === 'ue' ? ' active-ue' : '');
  euBtn.className = 'add-dir-btn' + (dir === 'eu' ? ' active-eu' : '');

  header.className = 'add-sheet-header dir-' + dir;
  saveBtn.className = 'add-btn-save dir-' + dir;

  document.getElementById('fEuSection').style.display = dir === 'eu' ? '' : 'none';
  document.getElementById('fUeSection').style.display = dir === 'ue' ? '' : 'none';

  if (dir === 'ue') {
    smsTextarea.placeholder = 'Турко Сергій +41797856664 Цюріх, документи 2кг';
  } else {
    smsTextarea.placeholder = 'Іванов Петро +380631234567 Київ, вул. Хрещатик';
  }
}

function clearAddForm() {
  const ids = [
    'fSmsText','fSender','fPhone','fAddressFrom','fEstValue','fWeight',
    'fReceiver','fPhoneReceiver','fCityNP','fAddrCity','fAddrStreet',
    'fAddrHouse','fAddrApt','fReceiverUE','fPhoneReceiverUE','fAddressTo',
    'fTTN','fWeightUE','fEstValueUE','fDescription','fQty','fSum','fNote',
    'fCity','fPayStatus','fPayForm','fTag'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('fQty').value = '1';
  document.getElementById('fCurrency').value = 'UAH';
  document.getElementById('duplicateWarning').classList.remove('visible');
  document.getElementById('duplicateWarning').textContent = '';
  setDeliveryType('np');
}

function initSwissPoints() {
  ['Sender', 'Receiver'].forEach(suffix => {
    const list = document.getElementById('swissList' + suffix);
    if (!list) return;
    if (!SWISS_POINTS.length) {
      list.innerHTML = '<div class="add-swiss-item" style="opacity:.6;cursor:default">Адрес ще не додано — налаштуйте у Власницькій панелі</div>';
      return;
    }
    list.innerHTML = SWISS_POINTS.map((pt, i) => `
      <div class="add-swiss-item" onclick="selectSwissPoint('${suffix}', ${i})">
        <span class="add-swiss-city">${pt.city}</span>
        <span class="add-swiss-addr">${pt.addr.length > 40 ? pt.addr.substring(0, 40) + '...' : pt.addr}</span>
      </div>
    `).join('');
  });
}

function toggleSwissList(type) {
  const suffix = type === 'sender' ? 'Sender' : 'Receiver';
  document.getElementById('swissList' + suffix).classList.toggle('open');
}

function selectSwissPoint(suffix, idx) {
  const pt = SWISS_POINTS[idx];
  const fieldId = suffix === 'Sender' ? 'fAddressFrom' : 'fAddressTo';
  document.getElementById(fieldId).value = pt.addr ? (pt.city + ' — ' + pt.addr) : pt.city;
  document.getElementById('swissList' + suffix).classList.remove('open');
}

function toggleAddSection(titleEl) {
  const body = titleEl.nextElementSibling;
  const arrow = titleEl.querySelector('span:last-child');
  if (body.style.display === 'none') {
    body.style.display = '';
    if (arrow) arrow.textContent = '▲ Згорнути';
  } else {
    body.style.display = 'none';
    if (arrow) arrow.textContent = '▼ Розгорнути';
  }
}

function setDeliveryType(type) {
  deliveryType = type;
  const btns = document.querySelectorAll('.add-delivery-btn');
  btns[0].classList.toggle('active', type === 'np');
  btns[1].classList.toggle('active', type === 'address');
  document.getElementById('fNpBlock').style.display = type === 'np' ? '' : 'none';
  document.getElementById('fAddrBlock').style.display = type === 'address' ? '' : 'none';
}

// ===== [SECT-SMS] SMS PARSER =====
function parseSmsText() {
  const text = document.getElementById('fSmsText').value.trim();
  if (!text) { showToast('Вставте текст для розпізнавання', 'info'); return; }

  // Phone patterns
  const phones = text.match(/\+?\d[\d\s\-()]{8,}/g) || [];
  const cleanPhones = phones.map(p => p.replace(/[\s\-()]/g, ''));

  // Weight: "2кг", "5 кг", "2.5кг"
  const weightMatch = text.match(/(\d+[.,]?\d*)\s*кг/i);
  const weight = weightMatch ? weightMatch[1].replace(',', '.') : '';

  // NP: "Київ 174", "Одеса №5", "Львів відділення 12"
  const npMatch = text.match(/([\wа-яіїєґА-ЯІЇЄҐ']+)\s+(?:№|відділення\s*)?(\d{1,4})/);

  // Swiss city detection
  const swissCities = SWISS_POINTS.map(p => p.city.toLowerCase());
  let foundSwiss = '';
  swissCities.forEach((city, i) => {
    if (text.toLowerCase().includes(city)) {
      foundSwiss = SWISS_POINTS[i].city + ' — ' + SWISS_POINTS[i].addr;
    }
  });

  // Name: first 2-3 capitalized words
  const words = text.split(/[\s,;]+/);
  const nameWords = [];
  for (const w of words) {
    if (/^[A-ZА-ЯІЇЄҐ][a-zа-яіїєґ']+$/.test(w) && nameWords.length < 3) {
      nameWords.push(w);
    } else if (nameWords.length > 0) break;
  }
  const name = nameWords.join(' ');

  if (addFormDirection === 'eu') {
    // EU→UA: sender in Europe, receiver in Ukraine
    if (name) document.getElementById('fSender').value = name;
    if (cleanPhones[0]) document.getElementById('fPhone').value = cleanPhones[0];
    if (foundSwiss) document.getElementById('fAddressFrom').value = foundSwiss;
    if (cleanPhones[1]) document.getElementById('fPhoneReceiver').value = cleanPhones[1];
    if (npMatch) document.getElementById('fCityNP').value = npMatch[1] + ' ' + npMatch[2];
    if (weight) document.getElementById('fWeight').value = weight;

    // Open receiver section if data detected
    if (cleanPhones[1] || npMatch) {
      document.getElementById('fReceiverSection').style.display = '';
      const arrow = document.querySelector('#fEuSection .sec-receiver span:last-child');
      if (arrow) arrow.textContent = '▲ Згорнути';
    }
  } else {
    // UA→EU: receiver in Europe
    if (name) document.getElementById('fReceiverUE').value = name;
    if (cleanPhones[0]) document.getElementById('fPhoneReceiverUE').value = cleanPhones[0];
    if (foundSwiss) document.getElementById('fAddressTo').value = foundSwiss;
    if (weight) document.getElementById('fWeightUE').value = weight;
  }

  // Check for duplicate
  if (cleanPhones[0]) checkDuplicatePhone(cleanPhones[0]);

  const filled = [name, cleanPhones[0], weight, foundSwiss, npMatch ? 'NP' : ''].filter(Boolean);
  showToast(`Розпізнано: ${filled.length} полів`, 'success');
}

// ===== [SECT-DUPL] DUPLICATE CHECK =====
function checkDuplicatePhone(phone) {
  if (!phone || phone.length < 8) {
    document.getElementById('duplicateWarning').classList.remove('visible');
    return;
  }
  const clean = phone.replace(/[\s\-()]/g, '');
  const dup = allData.find(p =>
    (p['Телефон реєстратора'] || '').replace(/[\s\-()]/g, '').includes(clean) ||
    clean.includes((p['Телефон реєстратора'] || '').replace(/[\s\-()]/g, ''))
  );
  const warn = document.getElementById('duplicateWarning');
  if (dup) {
    warn.textContent = '⚠️ Можливий дублікат: ' + (dup['Піб відправника'] || '') + ' — ' + (dup['Телефон реєстратора'] || '') + ' (ID: ' + dup['PKG_ID'] + ')';
    warn.classList.add('visible');
  } else {
    warn.classList.remove('visible');
  }
}

// ===== [SECT-SAVE] SAVE PARCEL =====
async function saveParcel() {
  const dir = addFormDirection;
  let errors = [];
  let data = {};

  if (dir === 'eu') {
    // EU → UA
    const sender = document.getElementById('fSender').value.trim();
    const phone = document.getElementById('fPhone').value.trim();
    const addressFrom = document.getElementById('fAddressFrom').value.trim();
    const receiver = document.getElementById('fReceiver').value.trim();
    const phoneReceiver = document.getElementById('fPhoneReceiver').value.trim();

    if (!sender) errors.push('Піб відправника');
    if (!phone) errors.push('Телефон відправника');
    if (!addressFrom) errors.push('Адреса відправника');
    if (!receiver) errors.push('ПІБ отримувача');
    if (!phoneReceiver) errors.push('Телефон отримувача');

    let addressTo = '';
    if (deliveryType === 'np') {
      const cityNP = document.getElementById('fCityNP').value.trim();
      if (!cityNP) errors.push('Нова Пошта (місто + відділення)');
      addressTo = 'НП: ' + cityNP;
    } else {
      const addrCity = document.getElementById('fAddrCity').value.trim();
      const addrStreet = document.getElementById('fAddrStreet').value.trim();
      const addrHouse = document.getElementById('fAddrHouse').value.trim();
      const addrApt = document.getElementById('fAddrApt').value.trim();
      if (!addrCity) errors.push('Місто');
      if (!addrStreet) errors.push('Вулиця');
      if (!addrHouse) errors.push('Будинок');
      addressTo = [addrCity, addrStreet, 'буд.' + addrHouse, addrApt ? 'кв.' + addrApt : ''].filter(Boolean).join(', ');
    }

    if (errors.length > 0) {
      showToast('Заповніть: ' + errors.join(', '), 'error');
      return;
    }

    data = {
      'Напрям': 'ЄВ→УК',
      'Піб відправника': sender,
      'Телефон реєстратора': phone,
      'Адреса відправки': addressFrom,
      'Піб отримувача': receiver,
      'Телефон отримувача': phoneReceiver,
      'Адреса в Європі': addressTo,
      'Кг': document.getElementById('fWeight').value || '',
      'Оціночна вартість': document.getElementById('fEstValue').value || ''
    };
  } else {
    // UA → EU
    const receiverUE = document.getElementById('fReceiverUE').value.trim();
    const phoneReceiverUE = document.getElementById('fPhoneReceiverUE').value.trim();
    const addressTo = document.getElementById('fAddressTo').value.trim();

    if (!receiverUE) errors.push('Піб отримувача');
    if (!phoneReceiverUE) errors.push('Телефон отримувача');
    if (!addressTo) errors.push('Адреса в Європі');

    if (errors.length > 0) {
      showToast('Заповніть: ' + errors.join(', '), 'error');
      return;
    }

    data = {
      'Напрям': 'УК→ЄВ',
      'Піб отримувача': receiverUE,
      'Телефон отримувача': phoneReceiverUE,
      'Адреса в Європі': addressTo,
      'Номер ТТН': document.getElementById('fTTN').value || '',
      'Кг': document.getElementById('fWeightUE').value || '',
      'Оціночна вартість': document.getElementById('fEstValueUE').value || '',
      'Опис': document.getElementById('fDescription').value || '',
      'Кількість позицій': document.getElementById('fQty').value || '1',
      'Сума': document.getElementById('fSum').value || '',
      'Валюта оплати': document.getElementById('fCurrency').value || 'UAH',
      'Примітка': document.getElementById('fNote').value || ''
    };
  }

  // Common extra fields (Місто/Статус оплати/Форма оплати/Тег)
  const _val = (id) => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  const _city = _val('fCity');
  const _payStatus = _val('fPayStatus');
  const _payForm = _val('fPayForm');
  const _tag = _val('fTag');
  if (_city) data['Місто Нова Пошта'] = _city;
  if (_payStatus) data['Статус оплати'] = _payStatus;
  if (_payForm) data['Форма оплати'] = _payForm;
  if (_tag) data['Тег'] = _tag;

  // Save to server
  const saveBtn = document.getElementById('addBtnSave');
  saveBtn.textContent = '⏳ Збереження...';
  saveBtn.disabled = true;

  try {
    const sheetName = dir === 'eu' ? 'Реєстрація ТТН єв-УК' : 'Реєстрація ТТН УК-єв';
    const res = await apiPost('addParcel', { sheet: sheetName, data });

    if (res.ok) {
      // Add locally with correct frontend field names
      const newItem = {
        'PKG_ID': res.pkg_id || ('PKG_' + Date.now()),
        'Напрям': data['Напрям'],
        'Піб відправника': data['Піб відправника'] || '',
        'Телефон реєстратора': data['Телефон реєстратора'] || '',
        'Адреса відправки': data['Адреса відправки'] || '',
        'Піб отримувача': data['Піб отримувача'] || '',
        'Телефон отримувача': data['Телефон отримувача'] || '',
        'Адреса в Європі': data['Адреса в Європі'] || '',
        'Номер ТТН': data['Номер ТТН'] || '',
        'Опис': data['Опис'] || '',
        'Кількість позицій': data['Кількість позицій'] || '1',
        'Кг': data['Кг'] || '',
        'Оціночна вартість': data['Оціночна вартість'] || '',
        'Сума': data['Сума'] || '',
        'Валюта оплати': data['Валюта оплати'] || 'UAH',
        'Завдаток': '',
        'Борг': data['Сума'] || '0',
        'Статус оплати': 'Не оплачено',
        'Статус ліда': 'Новий',
        'Статус CRM': 'Активний',
        'Контроль перевірки': '',
        'Дата перевірки': '',
        'Номер авто': '',
        'RTE_ID': '',
        'Примітка': data['Примітка'] || '',
        'Тип запису': 'Посилка',
        'Дата створення': new Date().toLocaleDateString('uk-UA')
      };
      allData.unshift(newItem);
      renderCards();
      updateCounters();
      closeAddForm();
      showToast('Посилку додано!', 'success');
    } else {
      showToast('Помилка збереження: ' + (res.error || ''), 'error');
    }
  } catch (err) {
    showToast('Помилка: ' + err.message, 'error');
  } finally {
    saveBtn.textContent = 'Зберегти';
    saveBtn.disabled = false;
  }
}

function showLoader() {
  const el = document.getElementById('fullscreenLoader');
  if (el) { el.classList.remove('hidden'); }
}
function hideLoader() {
  const el = document.getElementById('fullscreenLoader');
  if (el) { el.classList.add('hidden'); }
}

async function loadRoutePointsCatalog() {
  try {
    const res = await apiPost('getRoutePoints', { route_group: 'ua-es-wed' });
    if (!res.ok || !Array.isArray(res.data)) return;
    SWISS_POINTS = res.data
      .filter(p => p.name_ua)
      .map(p => ({ city: p.name_ua, addr: p.location_name || '' }));
    // If the form is already rendered, refresh the dropdown contents.
    try { initSwissPoints(); } catch (_) {}
  } catch (e) {
    console.warn('loadRoutePointsCatalog failed:', e);
  }
}

async function loadData() {
  if (isLoading) return;
  isLoading = true;
  showLoader();

  try {
    const [dataRes, statsRes, routesRes] = await Promise.all([
      apiPost('getAll', { sheet: 'all', filter: {} }),
      apiPost('getStats', {}),
      apiPost('getRoutesList', {}),
      loadRoutePointsCatalog()
    ]);

    if (dataRes.ok) {
      allData = dataRes.data || [];
      allData.forEach(p => { if (!p['Тип запису']) p['Тип запису'] = 'Посилка'; });
      // DEBUG: показати ключі першого запису
      if (allData.length > 0) {
        console.log('=== DEBUG: Ключі першого запису ===');
        console.log(JSON.stringify(Object.keys(allData[0])));
        console.log('=== DEBUG: Перший запис ===');
        console.log(JSON.stringify(allData[0], null, 2));
      }
    }

    if (statsRes.ok) {
      stats = statsRes.stats || {};
    }

    if (routesRes && routesRes.ok) {
      routes = (routesRes.routes || routesRes.data || []).map(function(r) {
        r.rows = r.rows || null;  // ensure rows is null for lazy loading
        return r;
      });
      dispatches = routesRes.dispatches || [];
      expenses = routesRes.expenses || [];
      routeSummary = routesRes.summary || null;
      try { renderRouteSidebar(); } catch(e) { console.warn('renderRouteSidebar:', e); }
    }
  } catch (err) {
    console.error('loadData error:', err);
  } finally {
    isLoading = false;
    hideLoader();
  }

  try {
    renderCards();
    updateCounters();
    showToast('Дані оновлено (' + allData.length + ' посилок)', 'success');
  } catch(e) {
    console.error('render error:', e);
  }
}
