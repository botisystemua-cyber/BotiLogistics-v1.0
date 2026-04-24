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
        // start_url → директорний URL cargo-crm, щоб якщо юзер встановить
        // звідси, додаток відкривався саме на cargo.
        params.push('start=' + encodeURIComponent('cargo-crm/'));
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
let routeDateFilter = null; // null | 'DD.MM.YYYY' — фільтр по 'Дата отримання' (дата візиту водія)
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
  { key: 'sender',      label: '👤 ПІБ відправника' },
  { key: 'receiver',    label: '👤 ПІБ отримувача' },
  { key: 'phone',       label: '📞 Телефон реєстратора' },
  { key: 'phoneRecv',   label: '📱 Телефон отримувача' },
  { key: 'weight',      label: '⚖️ Вага (кг)' },
  { key: 'sum',         label: '💰 Сума' },
  { key: 'deposit',     label: '💵 Завдаток' },
  { key: 'debt',        label: '📛 Борг' },
  { key: 'ttn',         label: '📋 Номер ТТН' },
  { key: 'smartId',     label: '🆔 Ід_смарт' },
  { key: 'innerNum',    label: '🔢 Внутрішній №' },
  { key: 'date',        label: '📅 Дата створення' },
  { key: 'receivedDate',label: '📅 Дата отримання' },
  { key: 'statusPkg',   label: '📦 Статус посилки' },
  { key: 'tag',         label: '🏷️ Тег' },
  { key: 'address',     label: '📍 Адреса маршруту' },
  { key: 'leadBadge',   label: '🔵 Статус ліда' },
  { key: 'payBadge',    label: '💳 Статус оплати' },
  { key: 'checkBadge',  label: '✅ Контроль перевірки' },
  { key: 'note',        label: '📝 Примітка' },
  { key: 'description', label: '📄 Опис посилки' },
  { key: 'qty',         label: '📊 Кількість позицій' },
  { key: 'estValue',    label: '💎 Оціночна вартість' },
];

const ALL_OSNOVNE_COLUMNS = [
  { key: 'sender',      label: '👤 Піб відправника' },
  { key: 'phone',       label: '📞 Телефон реєстратора' },
  { key: 'senderPhone', label: '📞 Телефон відправника' },
  { key: 'addressFrom', label: '📍 Адреса відправки' },
  { key: 'receiver',    label: '👤 Піб отримувача' },
  { key: 'phoneRecv',   label: '📱 Телефон отримувача' },
  { key: 'addressTo',   label: '📍 Адреса доставки' },
  { key: 'leadStatus',  label: '🔵 Статус ліда' },
  { key: 'tag',         label: '🏷️ Тег' },
  { key: 'ttn',         label: '📋 Номер ТТН' },
  { key: 'innerNum',    label: '🔢 Внутрішній №' },
  { key: 'smartId',     label: '🆔 Ід_смарт' },
  { key: 'ttnDate',     label: '📅 Дата створення накладної' },
  { key: 'dispatchDate',label: '📅 Дата відправки' },
  { key: 'receivedDate',label: '📅 Дата отримання' },
  { key: 'note',        label: '📝 Примітка' },
  { key: 'noteSms',     label: '💬 Примітка СМС' },
  { key: 'description', label: '📄 Опис' },
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
  { key: 'payForm',     label: '💳 Форма оплати' },
  { key: 'deposit',     label: '💵 Завдаток' },
  { key: 'depositCurrency', label: '💱 Валюта завдатку' },
  { key: 'debt',        label: '📛 Борг' },
  { key: 'payNote',     label: '📝 Примітка оплати' },
  { key: 'npAmount',    label: '💰 Сума НП' },
  { key: 'npCurrency',  label: '💱 Валюта НП' },
  { key: 'npForm',      label: '💳 Форма НП' },
  { key: 'npStatus',    label: '💳 Статус НП' },
  { key: 'ttnDate',     label: '📅 Дата створення накладної' },
  { key: 'dispatchDate',label: '📅 Дата відправки' },
  { key: 'receivedDate',label: '📅 Дата отримання' },
  { key: 'photo',       label: '📸 Фото посилки' },
  { key: 'rating',      label: '⭐ Рейтинг' },
  { key: 'ratingComment',label: '💬 Коментар рейтингу' },
  { key: 'tag',         label: '🏷️ Тег' },
  { key: 'note',        label: '📝 Примітка' },
  { key: 'noteSms',     label: '💬 Примітка СМС' },
  { key: 'timing',      label: '⏱️ Таймінг' },
];

const DEFAULT_CARD_COLS = ['sender','receiver','phone','weight','sum','deposit','debt','ttn','smartId','date','receivedDate','statusPkg','tag','address','leadBadge','payBadge','checkBadge'];
const DEFAULT_OSNOVNE_COLS = ['sender','phone','addressFrom','receiver','phoneRecv','addressTo','leadStatus','tag'];
const DEFAULT_PARCEL_COLS = ['description','details','qty','weight','estValue','ttn','innerNum','statusPkg','sum','currency','payStatus','photo','rating','ratingComment'];

const LS_KEY_CARD = 'esco_posylki_card_cols';
const LS_KEY_OSNOVNE = 'esco_pkg_osnovne';
const LS_KEY_PARCEL = 'esco_pkg_parcel';
const LS_KEY_DEFAULT_TAB = 'esco_pkg_default_tab';
const DEFAULT_TAB_PKG = 'parcel';
const ALLOWED_TABS = ['parcel','basic','np','finance','route','system'];

let colCfgMode = 'card';
let colCfgTemp = [];

// Мапінг localStorage-ключів на ключі у users.ui_prefs (jsonb).
// DB тепер — source of truth; localStorage слугує sync-fallback'ом на
// випадок холодного рендеру (до того як sbLoadUiPrefs() повернеться).
const UI_PREFS_MAP = {
  [LS_KEY_CARD]:        'cargo_card_cols',
  [LS_KEY_OSNOVNE]:     'cargo_osnovne_cols',
  [LS_KEY_PARCEL]:      'cargo_parcel_cols',
  [LS_KEY_DEFAULT_TAB]: 'cargo_default_tab',
};

function _readUiPref(lsKey, fallback) {
  // 1) DB-кеш (source of truth після логіну)
  const prefKey = UI_PREFS_MAP[lsKey];
  if (prefKey && typeof window.sbGetUiPrefsSync === 'function') {
    const prefs = window.sbGetUiPrefsSync();
    if (prefs && prefs[prefKey] !== undefined && prefs[prefKey] !== null) return prefs[prefKey];
  }
  // 2) localStorage (legacy або write-through cache)
  try {
    const s = localStorage.getItem(lsKey);
    if (s != null && s !== '') {
      // default_tab — скаляр, решта — jsonArray
      return lsKey === LS_KEY_DEFAULT_TAB ? s : JSON.parse(s);
    }
  } catch (e) { /* ignore */ }
  return fallback;
}

function _writeUiPref(lsKey, value) {
  // Write-through: спочатку БД, потім localStorage (як кеш / offline fallback)
  const prefKey = UI_PREFS_MAP[lsKey];
  if (prefKey && typeof window.sbSaveUiPref === 'function') {
    // Fire-and-forget — UI не чекає на мережу
    window.sbSaveUiPref(prefKey, value);
  }
  try {
    localStorage.setItem(lsKey, lsKey === LS_KEY_DEFAULT_TAB ? String(value) : JSON.stringify(value));
  } catch (e) { /* quota? ignore */ }
}

// Одноразова міграція: якщо в БД ще не було налаштувань (новий юзер чи
// перший вхід після оновлення), а в localStorage залишились з попередніх
// сесій — заливаємо їх у БД, щоб нічого не втратити. Виконується раз
// після sbLoadUiPrefs().
async function _migrateLegacyColPrefsToDb(prefs) {
  if (!prefs || typeof window.sbSaveUiPref !== 'function') return;
  const pairs = [
    [LS_KEY_CARD,        'cargo_card_cols',    'array'],
    [LS_KEY_OSNOVNE,     'cargo_osnovne_cols', 'array'],
    [LS_KEY_PARCEL,      'cargo_parcel_cols',  'array'],
    [LS_KEY_DEFAULT_TAB, 'cargo_default_tab',  'scalar'],
  ];
  for (const [lsKey, prefKey, type] of pairs) {
    if (prefs[prefKey] !== undefined && prefs[prefKey] !== null) continue; // в БД вже є
    const raw = localStorage.getItem(lsKey);
    if (raw == null || raw === '') continue;
    try {
      const parsed = type === 'array' ? JSON.parse(raw) : raw;
      await window.sbSaveUiPref(prefKey, parsed);
    } catch (e) { /* bad legacy value — пропускаємо */ }
  }
}

function getDefaultTab() {
  const v = _readUiPref(LS_KEY_DEFAULT_TAB, null);
  if (v && ALLOWED_TABS.includes(v)) return v;
  return DEFAULT_TAB_PKG;
}
function setDefaultTab(tab) {
  if (!ALLOWED_TABS.includes(tab)) return;
  _writeUiPref(LS_KEY_DEFAULT_TAB, tab);
}

function getVisibleCardColumns() {
  const v = _readUiPref(LS_KEY_CARD, null);
  return Array.isArray(v) ? v : [...DEFAULT_CARD_COLS];
}
function getVisibleOsnovneColumns() {
  const v = _readUiPref(LS_KEY_OSNOVNE, null);
  return Array.isArray(v) ? v : [...DEFAULT_OSNOVNE_COLS];
}
function getVisibleParcelColumns() {
  const v = _readUiPref(LS_KEY_PARCEL, null);
  return Array.isArray(v) ? v : [...DEFAULT_PARCEL_COLS];
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
  const sel = document.getElementById('colCfgDefaultTab');
  if (sel) sel.value = getDefaultTab();
  renderCfgTabs();
  renderCfgList();
}

function onDefaultTabChange(tab) {
  setDefaultTab(tab);
  showToast('Вкладку за замовчуванням збережено', 'success');
  renderCards();
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
  // Write-through: DB (source of truth) + localStorage (sync кеш).
  _writeUiPref(cfg.lsKey, colCfgTemp);
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
// Copy-to-clipboard helper: використовується клік по ТТН / телефону на
// картці ліда. Працює через navigator.clipboard (сучасні браузери) із
// fallback на document.execCommand для iOS Safari у PWA. Показує toast.
function copyToClipboard(text, successMsg) {
  const value = String(text || '');
  if (!value) return;
  const ok = () => showToast('📋 ' + (successMsg || 'Скопійовано') + ': ' + value, 'success');
  const fail = () => showToast('Не вдалось скопіювати', 'error');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).then(ok).catch(() => _fallbackCopy(value, ok, fail));
  } else {
    _fallbackCopy(value, ok, fail);
  }
}
function _fallbackCopy(value, ok, fail) {
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const done = document.execCommand('copy');
    document.body.removeChild(ta);
    done ? ok() : fail();
  } catch (e) { fail(); }
}

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

  // Per-user UI-налаштування з БД (users.ui_prefs). Не блокуємо основний
  // init — якщо завантажиться пізніше за renderCards, він просто
  // ре-рендериться з новими налаштуваннями. До цього працює legacy
  // localStorage-кеш (для старих юзерів, які вже мали свої налаштування).
  if (typeof window.sbLoadUiPrefs === 'function') {
    window.sbLoadUiPrefs().then(async function(prefs) {
      await _migrateLegacyColPrefsToDb(prefs);
      // Фінальний ре-рендер з акуратно завантаженими налаштуваннями
      if (typeof renderCards === 'function') renderCards();
    }).catch(function() { /* не падаємо навіть якщо БД недоступна */ });
  }

  // Show install banner unless already running as installed PWA
  if (!window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) {
    showInstallBanner();
  }

  await loadData();
  loadUnreadCounts().then(() => renderCards());

  // Якщо сторінка відкрита через сканер (index.html?scan=<ТТН>[&pkg=…][&unknown=1])
  // — одразу переходимо в розділ «Перевірка» і показуємо меню дій для ТТН.
  handleScanReturn();

  // Автооновлення при поверненні в CRM зі сканера / іншої вкладки.
  // Скан «Зберегти» пише прямо в БД (scan_ttn RPC), а клієнт про це не
  // знає — без цього слухача новий «Невідомий» з'являється тільки після
  // F5. Троттлимо, щоб не штормити loadData при кожному фокусі.
  var _lastAutoReload = 0;
  function _maybeAutoReload() {
    var now = Date.now();
    if (now - _lastAutoReload < 1500) return;
    _lastAutoReload = now;
    loadData().then(function() { renderCards(); updateCounters(); }).catch(function(){});
  }
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') _maybeAutoReload();
  });
  window.addEventListener('pageshow', function(e) {
    // bfcache-restored сторінки теж треба оновити
    if (e.persisted) _maybeAutoReload();
  });
});

// ===== [SECT-SCANRETURN] SCANNER → CRM HAND-OFF =====
// Сканер (scaner_ttn.html) після успішного скану редіректить сюди з
// ?scan=<ТТН>&pkg=<PKG_ID>[&unknown=1]. CRM відкриває «Перевірка»:
//   — знайдений лід → пошуковий бар + меню «➕ В перевірку / ✏️ Редагувати / 🗑️ Видалити»
//   — unknown=1 (type=new у scan_ttn) → розділ «Невідомі» з тим самим ТТН
// `sessionStorage._scanReturnTTN` тримаємо, щоб дії меню повертали оператора
// на сторінку сканера (коротке коло «скан → дія → скан»).
function handleScanReturn() {
  const params = new URLSearchParams(window.location.search);
  const ttn = params.get('scan');
  if (!ttn) return;
  const pkgId = params.get('pkg') || '';
  const isUnknown = params.get('unknown') === '1';
  try {
    sessionStorage.setItem('_scanReturnTTN', ttn);
    if (pkgId)    sessionStorage.setItem('_scanReturnPkg', pkgId);
    if (isUnknown) sessionStorage.setItem('_scanReturnUnknown', '1');
  } catch(_) {}

  // Прибираємо параметри з URL, щоб F5 не повторював сценарій
  try { history.replaceState({}, '', 'index.html'); } catch(_) {}

  setTimeout(() => {
    setVerFilter(isUnknown ? 'unknown' : 'ready');
    const inp = document.getElementById('verifySearchInput');
    if (inp) {
      inp.value = ttn;
      onVerifySearchInput(ttn);
      inp.focus();
    }
    renderScanReturnBanner();
    // Для нового Невідомого ліда одразу відкриваємо Заповнити —
    // оператор щойно сканував, ми знаємо яку посилку він хоче заповнити.
    if (isUnknown && pkgId) {
      setTimeout(() => openFillModal(pkgId), 350);
    }
    showToast('🔍 ТТН зі сканера: ' + ttn, 'info');
  }, 50);
}

function clearScanReturn() {
  try {
    sessionStorage.removeItem('_scanReturnTTN');
    sessionStorage.removeItem('_scanReturnPkg');
    sessionStorage.removeItem('_scanReturnUnknown');
  } catch(_) {}
  const b = document.getElementById('scanReturnBanner');
  if (b) b.remove();
}
function hasScanReturn() {
  try { return !!sessionStorage.getItem('_scanReturnTTN'); } catch(_) { return false; }
}
function getScanReturnPkg() {
  try { return sessionStorage.getItem('_scanReturnPkg') || ''; } catch(_) { return ''; }
}
function getScanReturnTTN() {
  try { return sessionStorage.getItem('_scanReturnTTN') || ''; } catch(_) { return ''; }
}
function isScanReturnUnknown() {
  try { return sessionStorage.getItem('_scanReturnUnknown') === '1'; } catch(_) { return false; }
}
function backToScanner() {
  clearScanReturn();
  // resume=1 → сканер пропустить стартовий екран і одразу запустить камеру
  // з останнім обраним режимом (зручніше, ніж знову обирати «Сканувати»/«Перевірка»)
  window.location.href = 'scaner_ttn.html?resume=1';
}

// Банер «зі сканера» на верху списку з 4 діями для Невідомих (C5):
// Заповнити / Сканувати далі / Видалити / Зберегти. Для відомих лідів
// достатньо verify-пошуку (C3), банер не показуємо.
function renderScanReturnBanner() {
  const existing = document.getElementById('scanReturnBanner');
  if (existing) existing.remove();
  if (!hasScanReturn() || !isScanReturnUnknown()) return;

  const ttn = getScanReturnTTN();
  const pkg = getScanReturnPkg();

  const banner = document.createElement('div');
  banner.id = 'scanReturnBanner';
  banner.className = 'scan-return-banner';
  banner.innerHTML =
    '<div class="scan-return-info">' +
      '<span class="scan-return-icon">📡</span>' +
      '<div>' +
        '<div class="scan-return-title">Нова ТТН зі сканера</div>' +
        '<div class="scan-return-ttn">' + escapeHtmlVerify(ttn) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="scan-return-actions">' +
      '<button class="scan-return-btn fill" onclick="scanReturnAction(\'fill\')">📝 Заповнити</button>' +
      '<button class="scan-return-btn next" onclick="scanReturnAction(\'next\')">🔙 Сканувати далі</button>' +
      '<button class="scan-return-btn save" onclick="scanReturnAction(\'save\')">💾 Зберегти</button>' +
      '<button class="scan-return-btn del" onclick="scanReturnAction(\'del\')">🗑️ Видалити</button>' +
    '</div>';

  // Вставляємо над картками
  const mainSect = document.querySelector('.main-content') || document.body;
  const firstChild = mainSect.firstChild;
  mainSect.insertBefore(banner, firstChild);

  banner.dataset.pkg = pkg;
}

async function scanReturnAction(action) {
  const pkg = getScanReturnPkg();

  if (action === 'fill') {
    if (pkg) openFillModal(pkg);
    else showToast('PKG_ID не знайдено', 'error');
    return;
  }

  if (action === 'next') {
    backToScanner();
    return;
  }

  if (action === 'save') {
    // «Зберегти» — ТТН уже збережена RPC scan_ttn'ом; просто закриваємо
    // банер і лишаємо оператора в CRM, щоб далі редагувати вручну.
    clearScanReturn();
    showToast('💾 ТТН збережено в «Невідомі»', 'success');
    return;
  }

  if (action === 'del') {
    if (!pkg) { showToast('PKG_ID не знайдено', 'error'); return; }
    if (!confirm('Видалити (архівувати) новий невідомий ТТН зі сканера?')) return;
    const res = await apiPost('deleteParcel', {
      pkg_id: pkg, reason: 'scan unknown — discarded', archived_by: 'scanner'
    });
    if (!res || !res.ok) {
      showToast((res && res.error) || 'Не вдалося видалити', 'error');
      return;
    }
    // Прибираємо з локального кешу
    const idx = (allData || []).findIndex(p => p['PKG_ID'] === pkg);
    if (idx >= 0) allData.splice(idx, 1);
    showToast('Видалено', 'success');
    backToScanner();
  }
}

// ===== [SECT-FILTER] FILTERING =====
// Нові (24 год): посилка вважається новою, якщо з моменту її створення
// минуло менше 24 годин. Логіка симетрична passenger-crm.
function isNew24h(p) {
  const raw = p && p['Дата створення'];
  if (!raw) return false;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return false;
  return (Date.now() - d.getTime()) < 24 * 60 * 60 * 1000;
}

function filterData() {
  let data = allData.filter(p => p['Статус CRM'] !== 'Архів');

  // Direction filter
  if (currentDirection === 'new24') {
    data = data.filter(p => isNew24h(p));
  } else if (currentDirection === 'ue') {
    data = data.filter(p => p['Напрям'] === 'УК→ЄВ');
  } else {
    data = data.filter(p => p['Напрям'] === 'ЄВ→УК');
  }

  // Verification filter (sidebar: Всі / В перевірці / Готові / Невідомі / Відхилені)
  if (currentVerifyFilter === 'checking') {
    data = data.filter(p => p['Контроль перевірки'] === 'В перевірці');
  } else if (currentVerifyFilter === 'ready') {
    data = data.filter(p => p['Контроль перевірки'] === 'Готова до маршруту');
  } else if (currentVerifyFilter === 'unknown') {
    data = data.filter(p => p['Статус ліда'] === 'Невідомий');
  } else if (currentVerifyFilter === 'rejected') {
    data = data.filter(p => p['Контроль перевірки'] === 'Відхилено');
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

// Короткий формат дати для readonly-полів: 21.05.2026 10:32 (без секунд)
function fmtShortDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (_) { return String(iso); }
}

// ===== [SECT-CARD] RENDER SINGLE CARD =====
function renderCard(p, routeCtx) {
  // routeCtx (optional) = { rteId, sheetName } — передається коли картка
  // рендериться всередині режиму «Маршрути». Тоді додаємо:
  //   • class="route-card" + data-lead-id + data-rte-id (для SortableJS
  //     drag-n-drop і route-drop handler'а).
  //   • Checkbox працює з routeSelectedIds і викликає toggleRouteSelect,
  //     щоб bulk-дії маршруту (зняти з маршруту, архівувати, оптимізувати)
  //     бачили правильний набір обраних.
  const _routeCtx = routeCtx || null;
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
  const npPlaces = parseInt(p['Місця НП'], 10) || 0;
  const itemCount = parseInt(p['Кількість позицій'], 10) || 0;
  const photoUrl = p['Фото посилки'] || '';
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
  else if (controlCheck === 'Відхилено') statusClass = 'status-refused';
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
  const ttnHtml = (isUE && ttn) ? `<span class="card-ttn copyable" onclick="event.stopPropagation(); copyToClipboard('${String(ttn).replace(/'/g, "\\'")}', 'ТТН скопійовано')" title="Клац — скопіювати ТТН">TTH: ${highlightMatch(ttn)}</span>` : '';

  // Route strip — завжди видимий. Зелений «✅ В маршруті» якщо призначено,
  // жовтий «⚠️ Без маршруту» якщо ще ні. Клік — відкриває модалку призначення
  // (як на пасажирській картці «Призначити рейс»).
  const routeStrip = rteId
    ? `<div class="card-route-strip has-route" onclick="event.stopPropagation(); openRouteModal('${pkgId}')">
         <span class="card-route-text">✅ В маршруті: ${highlightMatch(rteId)}${auto ? ' · 🚐 ' + highlightMatch(auto) : ''}</span>
         <span class="card-route-arrow">›</span>
       </div>`
    : `<div class="card-route-strip no-route" onclick="event.stopPropagation(); openRouteModal('${pkgId}')">
         <span class="card-route-text">⚠️ Без маршруту — натисніть щоб призначити</span>
         <span class="card-route-arrow">›</span>
       </div>`;

  // Meta tags (configurable via column configurator)
  const visCols = getVisibleCardColumns();
  let metaHtml = '';
  if (visCols.includes('date') && dateCreated) metaHtml += `<span class="meta-tag">📅 ${escapeHtml(dateCreated)}</span>`;
  if (visCols.includes('receivedDate') && p['Дата отримання']) {
    // Дата візиту — коли водій заїде на адресу. У UA→EU це доставка до отримувача,
    // у EU→UA це коли кур'єр забере у відправника. Одна колонка для обох.
    metaHtml += `<span class="meta-tag" style="background:#fef3c7;color:#92400e;">📅 Візит: ${escapeHtml(formatTripDate(p['Дата отримання']))}</span>`;
  }
  if (visCols.includes('statusPkg') && statusPkg) metaHtml += `<span class="meta-tag">${escapeHtml(statusPkg)}</span>`;
  if (visCols.includes('smartId') && p['Ід_смарт']) metaHtml += `<span class="meta-tag">🆔 ${highlightMatch(String(p['Ід_смарт']))}</span>`;
  if (visCols.includes('innerNum') && p['Внутрішній №']) metaHtml += `<span class="meta-tag">🔢 №${highlightMatch(String(p['Внутрішній №']))}</span>`;
  if (visCols.includes('phone') && phone) {
    const _sp = String(phone).replace(/'/g, "\\'");
    metaHtml += `<span class="meta-tag copyable" onclick="event.stopPropagation(); copyToClipboard('${_sp}', 'Номер скопійовано')" title="Клац — скопіювати номер">📞 ${highlightMatch(phone)}</span>`;
  }
  if (visCols.includes('phoneRecv') && receiverPhone) {
    const _sr = String(receiverPhone).replace(/'/g, "\\'");
    metaHtml += `<span class="meta-tag copyable" onclick="event.stopPropagation(); copyToClipboard('${_sr}', 'Номер скопійовано')" title="Клац — скопіювати номер">📱 ${highlightMatch(receiverPhone)}</span>`;
  }
  if (visCols.includes('tag') && tag) metaHtml += `<span class="meta-tag ${tag === 'VIP' || tag === 'срочна' ? 'tag-vip' : ''}">#${highlightMatch(tag)}</span>`;
  if (visCols.includes('note') && note) {
    const noteShort = note.substring(0, 30) + (note.length > 30 ? '…' : '');
    metaHtml += `<span class="meta-tag">📝 ${highlightMatch(noteShort)}</span>`;
  }
  if (visCols.includes('description') && p['Опис']) {
    const descShort = (p['Опис']).substring(0, 25) + ((p['Опис']).length > 25 ? '…' : '');
    metaHtml += `<span class="meta-tag">📄 ${highlightMatch(descShort)}</span>`;
  }
  // itemCount уже показано як badge-item-count у верхньому ряді — meta-tag не дублюємо
  if (visCols.includes('estValue') && p['Оціночна вартість']) metaHtml += `<span class="meta-tag">💎 ${escapeHtml(String(p['Оціночна вартість']))}</span>`;

  // ===== TAB PANELS =====
  // Єдиний пул редагованих полів — обидві вкладки беруть з нього, щоб
  // користувач міг винести будь-яку колонку у «Основне» чи «Посилка».
  const allDetailFields = {
    'sender':         ['Піб відправника', name],
    'phone':          ['Телефон реєстратора', phone],
    'senderPhone':    ['Телефон відправника', p['Телефон відправника'] || ''],
    'addressFrom':    ['Адреса відправки', addressFrom],
    'receiver':       ['Піб отримувача', receiver],
    'phoneRecv':      ['Телефон отримувача', receiverPhone],
    'addressTo':      [isUE ? 'Адреса в Європі' : 'Місто Нова Пошта', addressTo],
    'leadStatus':     ['Статус ліда', leadStatus],
    'tag':            ['Тег', tag],
    'description':    ['Опис', p['Опис'] || ''],
    'details':        ['Деталі', p['Деталі'] || ''],
    'qty':            ['Кількість позицій', p['Кількість позицій'] || ''],
    'weight':         ['Кг', weight],
    'estValue':       ['Оціночна вартість', p['Оціночна вартість'] || ''],
    'ttn':            ['Номер ТТН', ttn],
    'innerNum':       ['Внутрішній №', p['Внутрішній №'] || ''],
    'smartId':        ['Ід_смарт', p['Ід_смарт'] || '', {readonly: true}],
    'statusPkg':      ['Статус посилки', statusPkg],
    'sum':            ['Сума', price],
    'currency':       ['Валюта оплати', currency],
    'payStatus':      ['Статус оплати', payStatus],
    'payForm':        ['Форма оплати', p['Форма оплати'] || ''],
    'deposit':        ['Завдаток', p['Завдаток'] || ''],
    'depositCurrency':['Валюта завдатку', p['Валюта завдатку'] || ''],
    'debt':           ['Борг', debt ? String(debt) : '', {readonly: true}],
    'payNote':        ['Примітка оплати', p['Примітка оплати'] || ''],
    'npAmount':       ['Сума НП', p['Сума НП'] || ''],
    'npCurrency':     ['Валюта НП', p['Валюта НП'] || ''],
    'npForm':         ['Форма НП', p['Форма НП'] || ''],
    'npStatus':       ['Статус НП', p['Статус НП'] || ''],
    'ttnDate':        ['Дата створення накладної', p['Дата створення накладної'] || ''],
    'dispatchDate':   ['Дата відправки', p['Дата відправки'] || ''],
    'receivedDate':   ['Дата отримання', p['Дата отримання'] || ''],
    'photo':          ['Фото посилки', p['Фото посилки'] || ''],
    'rating':         ['Рейтинг', p['Рейтинг'] || ''],
    'ratingComment': ['Коментар рейтингу', p['Коментар рейтингу'] || ''],
    'note':           ['Примітка', note],
    'noteSms':        ['Примітка СМС', p['Примітка СМС'] || ''],
    'timing':         ['Таймінг', p['Таймінг'] || ''],
  };

  // 📦 Посилка (configurable)
  const visParcel = getVisibleParcelColumns();
  const tabParcel = renderDetailGrid(visParcel.filter(k => allDetailFields[k]).map(k => allDetailFields[k]), pkgId);

  // 📄 Основне (configurable)
  const visOsn = getVisibleOsnovneColumns();
  const tabBasic = renderDetailGrid(visOsn.filter(k => allDetailFields[k]).map(k => allDetailFields[k]), pkgId);

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
  ], pkgId) +
  `<div style="padding:8px 0 4px;">
    <button onclick="event.stopPropagation(); showPaymentHistory('${pkgId}')" style="padding:6px 14px;background:var(--info);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">💳 Історія платежів</button>
    <div id="payHistory-${pkgId}" style="display:none;margin-top:8px;"></div>
  </div>`;

  // 🚖 Рейс — показуємо тільки коли посилка в маршруті
  // Дані рейсу (дата відправки, авто, RTE_ID) — спільні для всього маршруту,
  // редагуються в розділі «Маршрути» на рівні рейсу, тому тут readonly.
  // Таймінг і Дата отримання — специфіка цієї посилки, редагуються.
  const inRoute = !!rteId;
  const tabRoute = inRoute
    ? renderDetailGrid([
        ['Дата відправки', p['Дата відправки'] || ''],
        ['Номер авто', auto, {readonly: true}],
        ['RTE_ID', rteId, {readonly: true}],
        ['Таймінг', p['Таймінг'] || ''],
        ['Дата отримання', p['Дата отримання'] || ''],
      ], pkgId)
    : '<div style="padding:16px;color:var(--text-secondary);font-size:13px;text-align:center;">📭 Посилка не прикріплена до маршруту.<br><span style="font-size:12px;">Натисніть «🚖 Маршрут» у меню дій, щоб додати.</span></div>';

  // ⚙ Системні
  const tabSystem = renderDetailGrid([
    ['PKG_ID', pkgId, {readonly: true}],
    ['Ід_смарт', p['Ід_смарт'] || '', {readonly: true}],
    ['Дата створення', dateCreated, {readonly: true}],
    ['Дата створення накладної', p['Дата створення накладної'] || ''],
    ['Дата відправки', p['Дата відправки'] || ''],
    ['Дата отримання', p['Дата отримання'] || ''],
    ['SOURCE_SHEET', p['SOURCE_SHEET'] || '', {readonly: true}],
    ['CLI_ID', p['CLI_ID'] || '', {readonly: true}],
    ['ORDER_ID', p['ORDER_ID'] || '', {readonly: true}],
    ['Статус CRM', statusCrm],
    ['Контроль перевірки', controlCheck],
    ['Дата перевірки', fmtShortDate(p['Дата перевірки']), {readonly: true}],
    // Аудит переходу у «В перевірці» — WHO + WHEN + звідки (CRM чи сканер)
    ['Ким перевірено', p['Ким перевірено'] || '', {readonly: true}],
    ['Дата переходу в перевірку', fmtShortDate(p['Дата переходу в перевірку']), {readonly: true}],
    ['Джерело перевірки', p['Джерело перевірки'] || '', {readonly: true}],
    ['Примітка', note],
    ['Примітка СМС', p['Примітка СМС'] || ''],
  ], pkgId);

  // Default tab: user-configurable. If 'np' chosen but card isn't УК→ЄВ, fall back to 'parcel'.
  let _defTab = getDefaultTab();
  if (_defTab === 'np' && !isUE) _defTab = 'parcel';
  const _act = (t) => _defTab === t ? ' active' : '';

  // NP tab HTML
  const npTabBtn = isUE ? `<div class="detail-tab${_act('np')}" data-tab="np" onclick="event.stopPropagation(); switchTab('${pkgId}', 'np')">💰 НП</div>` : '';
  const npTabPanel = isUE ? `<div class="detail-tab-panel${_act('np')}" data-tab-panel="np">${tabNP}</div>` : '';

  // Tracking button only for УК→ЄВ with ТТН
  const trackBtn = (isUE && ttn) ? `<button onclick="event.stopPropagation(); window.open('https://novaposhta.ua/tracking/?cargo_number=${ttn}', '_blank')">📦 Трекінг</button>` : '';

  // Route-context: додатковий клас .route-card для SortableJS + data-rte-id /
  // data-lead-id. Checkbox прив'язуємо до routeSelectedIds/toggleRouteSelect.
  const _rootCls   = _routeCtx ? `lead-card route-card ${statusClass}` : `lead-card ${statusClass}`;
  const _rootAttrs = _routeCtx
    ? `data-id="${pkgId}" data-rte-id="${_routeCtx.rteId || ''}" data-lead-id="${pkgId}"`
    : `data-id="${pkgId}"`;
  const _cbChecked = _routeCtx
    ? (routeSelectedIds && routeSelectedIds.has(_routeCtx.rteId) ? 'checked' : '')
    : (selectedIds.has(pkgId) ? 'checked' : '');
  const _cbHandler = _routeCtx
    ? `onchange="event.stopPropagation(); toggleRouteSelect('${_routeCtx.rteId}', this.checked)"`
    : `onclick="event.stopPropagation(); toggleSelect('${pkgId}')"`;

  return `
    <div class="${_rootCls}" ${_rootAttrs}>
      <div class="card-header" onclick="toggleCard('${pkgId}')">
        <div class="card-top-row">
          <input type="checkbox" class="card-checkbox" ${_cbHandler} ${_cbChecked}>
          <span class="dir-badge ${dirBadgeClass}">${dirLabel}</span>
          ${isNew24h(p) ? '<span class="badge badge-new24">🆕 NEW</span>' : ''}
          ${visCols.includes('ttn') ? ttnHtml : ''}
          ${npPlaces > 1 ? `<span class="badge-np-places" title="Місць НП: ${npPlaces} фізичних коробок з тим самим ТТН">📥 ${npPlaces}</span>` : ''}
          ${itemCount > 1 ? `<span class="badge-item-count" title="Кількість позицій: ${itemCount} речей всередині">🧾 ${itemCount}</span>` : ''}
          ${weight ? `<span class="badge-weight" title="Вага">⚖️ ${weight} кг</span>` : ''}
          ${photoUrl ? `<a href="${escapeHtml(photoUrl)}" target="_blank" onclick="event.stopPropagation();" class="badge-photo" title="Відкрити фото посилки">📷</a>` : ''}
          <div class="card-finance">
            ${visCols.includes('sum') && price ? `<span class="card-price ${priceColorClass}">${price} ${currency}</span>` : ''}
            ${visCols.includes('deposit') && deposit > 0 ? `<span class="card-deposit">завд:${deposit}</span>` : ''}
            ${visCols.includes('debt') && debt > 0 ? `<span class="card-debt">борг:${debt}</span>` : ''}
            ${(() => {
              // Підсвічуємо НП-борг жовтим, коли ми оплатили Нову Пошту —
              // оператор одразу бачить «цей лід має нам повернути X за НП».
              const npAmt = parseFloat(p['Сума НП']) || 0;
              const npCur = p['Валюта НП'] || 'UAH';
              if (npAmt <= 0) return '';
              return `<span class="card-np-debt" title="Ми оплатили Нову Пошту — клієнт має повернути">🚚 НП: ${npAmt} ${npCur}</span>`;
            })()}
          </div>
          <button class="card-actions-toggle" onclick="event.stopPropagation(); toggleActions('${pkgId}', this)" title="Дії">▼</button>
        </div>
        <div class="card-row2-wrap">
          <div class="card-row2">
            ${(() => {
              // Відправник / отримувач — два окремих тоггли. pkg_id прибрано —
              // його видно в деталях на вкладці «⚙ Системні» (readonly).
              // Вважаємо порожнім не лише null/''/whitespace, але й звичайні
              // заглушки-плейсхолдери («невідомо», «(невідомо)», «—» тощо),
              // які міг залишити сканер у новому ліді до ручного заповнення.
              const isEmptyName = (v) => {
                const s = String(v || '').trim().toLowerCase().replace(/[()«»\s]/g, '');
                return !s || s === 'невідомо' || s === 'невідома' || s === 'невідомий'
                         || s === '—' || s === '-' || s === 'unknown' || s === 'нема';
              };
              const showSender = visCols.includes('sender');
              const showRecv   = visCols.includes('receiver');
              if (!showSender && !showRecv) return '';
              const parts = [];
              if (showSender && !isEmptyName(name))     parts.push(highlightMatch(name));
              if (showRecv   && !isEmptyName(receiver)) parts.push(highlightMatch(receiver));
              if (parts.length === 0) return '';
              return `<span class="card-sender-recv">👤 ${parts.join(' → ')}</span>`;
            })()}
            ${(_unreadCounts[pkgId] || 0) > 0 ? `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;animation:pulse-badge 2s infinite;" title="${_unreadCounts[pkgId]} нових повідомлень">${_unreadCounts[pkgId]}</span>` : ''}
            ${visCols.includes('leadBadge') ? leadBadge : ''} ${visCols.includes('payBadge') ? payBadge : ''} ${visCols.includes('checkBadge') ? checkBadge : ''}
          </div>
          ${visCols.includes('address') && (addressFrom || addressTo) ? (() => {
              // Безпечний ескейп для single-quoted onclick
              const sqEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
              const safeFrom = sqEsc(addressFrom);
              const safeTo   = sqEsc(addressTo);
              const mapBtn = (safe) => `<button class="card-address-map-btn" onclick="event.stopPropagation(); openMap('${safe}')" title="Відкрити в Google Maps">🗺</button>`;
              if (addressFrom && addressTo) {
                return `<div class="card-address">📍 ${highlightMatch(addressFrom)}${mapBtn(safeFrom)} → ${highlightMatch(addressTo)}${mapBtn(safeTo)}</div>`;
              }
              const one = addressFrom || addressTo;
              const oneSafe = addressFrom ? safeFrom : safeTo;
              return `<div class="card-address">📍 ${highlightMatch(one)}${mapBtn(oneSafe)}</div>`;
            })() : ''}
          ${metaHtml ? `<div class="card-meta-tags">${metaHtml}</div>` : ''}
        </div>
      </div>
      ${routeStrip}
      <div class="card-actions" id="actions-${pkgId}">
        <button onclick="event.stopPropagation(); window.open('tel:${phone}')">📞 Дзвінок</button>
        <button onclick="event.stopPropagation(); openMessenger('${phone}','${pkgId}')">💬 Писати</button>
        ${trackBtn}
        <button onclick="event.stopPropagation(); startVerification('${pkgId}')" style="${controlCheck === 'В перевірці' ? 'background:var(--info);color:#fff;' : ''}">🔍 ${controlCheck === 'В перевірці' ? 'В перевірці' : 'В перевірку'}</button>
        ${controlCheck === 'В перевірці' ? `<button onclick="event.stopPropagation(); completeVerification('${pkgId}')" style="background:var(--success);color:#fff;">✅ Готово</button>` : ''}
        ${controlCheck === 'В перевірці' ? `<button onclick="event.stopPropagation(); rejectVerification('${pkgId}')" style="background:var(--danger);color:#fff;">❌ Відхилити</button>` : ''}
        ${controlCheck === 'Готова до маршруту' ? `<span style="display:inline-flex;align-items:center;padding:6px 12px;background:#dcfce7;color:#166534;border-radius:8px;font-size:12px;font-weight:600;">✅ Готова</span>` : ''}
        ${controlCheck === 'Відхилено' ? `<span style="display:inline-flex;align-items:center;padding:6px 12px;background:#fee2e2;color:#991b1b;border-radius:8px;font-size:12px;font-weight:600;">❌ Відхилено</span>` : ''}
        ${leadStatus !== 'Невідомий' ? `<button onclick="event.stopPropagation(); setLeadUnknown('${pkgId}')" style="background:#fef3c7;color:#92400e;">❓ Невідомий</button>` : `<span style="display:inline-flex;align-items:center;padding:6px 12px;background:#fef3c7;color:#92400e;border-radius:8px;font-size:12px;font-weight:600;">❓ Невідомий</span>`}
        <button class="btn-danger" onclick="event.stopPropagation(); deleteRecord('${pkgId}')">🗑️</button>
      </div>
      <div class="card-details ${isOpen ? 'open' : ''}" id="details-${pkgId}">
        <div class="detail-tabs">
          <div class="detail-tab${_act('parcel')}" data-tab="parcel" onclick="event.stopPropagation(); switchTab('${pkgId}', 'parcel')">📦 Посилка</div>
          <div class="detail-tab${_act('basic')}" data-tab="basic" onclick="event.stopPropagation(); switchTab('${pkgId}', 'basic')">📄 Основне</div>
          ${npTabBtn}
          <div class="detail-tab${_act('finance')}" data-tab="finance" onclick="event.stopPropagation(); switchTab('${pkgId}', 'finance')">💰 Фінанси</div>
          <div class="detail-tab${_act('route')}" data-tab="route" onclick="event.stopPropagation(); switchTab('${pkgId}', 'route')">🚖 Рейс</div>
          <div class="detail-tab${_act('system')}" data-tab="system" onclick="event.stopPropagation(); switchTab('${pkgId}', 'system')">⚙ Системні</div>
        </div>
        <div class="detail-tab-panel${_act('parcel')}" data-tab-panel="parcel">${tabParcel}</div>
        <div class="detail-tab-panel${_act('basic')}" data-tab-panel="basic">${tabBasic}</div>
        ${npTabPanel}
        <div class="detail-tab-panel${_act('finance')}" data-tab-panel="finance">${tabFinance}</div>
        <div class="detail-tab-panel${_act('route')}" data-tab-panel="route">${tabRoute}</div>
        <div class="detail-tab-panel${_act('system')}" data-tab-panel="system">${tabSystem}</div>
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
    'Статус посилки':   ['Зареєстровано', 'Оформлення', 'Доставка', 'Доставлено', 'Невідомо'],
    'Статус CRM':       ['Активний', 'Архів'],
    'Валюта оплати':    ['UAH', 'EUR', 'CHF', 'USD', 'PLN', 'CZK'],
    'Валюта завдатку':  ['UAH', 'EUR', 'CHF', 'USD', 'PLN', 'CZK'],
    'Валюта НП':        ['UAH', 'EUR', 'CHF', 'USD'],
    'Форма НП':         ['Готівка', 'Картка', 'Частково'],
    'Статус НП':        ['Ми оплатили', 'Відправник оплатив', 'Наложний платіж'],
    'Форма оплати':     ['Готівка', 'Картка', 'Частково'],
    'Адреса відправки': swissAddrs,
    'Адреса в Європі':  swissAddrs,
    'Контроль перевірки': ['', 'В перевірці', 'Готова до маршруту', 'Відхилено'],
    'Тег':              ['', 'VIP', 'срочна', 'крихке', 'великогабарит'],
  };
  return opts[col] || null;
}

function _isAddressField(col) {
  return col === 'Адреса відправки' || col === 'Адреса в Європі';
}

// Дата-поля для inline-редагування: рендеримо <input type="date">, а у БД
// лежить просто YYYY-MM-DD (колонки типу date).
const _DATE_FIELDS = new Set([
  'Дата відправки', 'Дата отримання', 'Дата створення накладної',
]);
function _isDateField(col) { return _DATE_FIELDS.has(col); }
function _toDateInputValue(v) {
  if (!v) return '';
  const s = String(v);
  // ISO timestamp → take YYYY-MM-DD; plain date → leave as-is.
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
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
  } else if (_isDateField(col)) {
    const input = document.createElement('input');
    input.type = 'date';
    input.value = _toDateInputValue(currentVal);
    input.onblur = function() { saveInlineEdit(pkgId, col, input.value, el); };
    input.onkeydown = function(e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { restoreBlock(el, currentVal, pkgId, col); }
    };
    el.appendChild(input);
    input.focus();
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

// ---------- Scan TTN (camera scanner page) ----------

function openScannerPage() {
  // Відкриваємо камерний сканер ТТН
  window.location.href = 'scaner_ttn.html';
}

// ---------- Verify search (top-of-section quick lookup + mark-unknown) ----------
//
// Shown only while a Перевірка filter is active (set by setVerFilter).
// Hidden when the operator moves to another sidebar section (direction / pay
// filter / status chip / route view). Queries the in-memory `allData` across
// 5 fields user confirmed: ТТН, Ід_смарт, адреса, відправник, отримувач.
//
// Per result:  «➕ В перевірку» — posts Контроль перевірки='В перевірці'
//              (supabase-api translates it to scan_status='checked' for us,
//              so scanner pipeline and manual pipeline stay synced).
// Empty:       «⚠️ Позначити невідомим» — creates a new package with
//              Статус ліда='Невідомий', query text stored as ТТН. Operator
//              then edits the rest of the fields in the normal card UI.

let isVerifyActive = false;
let verifySearchDebounce = null;

const VERIFY_SEARCH_FIELDS = [
  'Номер ТТН', 'Ід_смарт', 'Адреса в Європі',
  'Піб відправника', 'Піб отримувача',
];

function showVerifyPanel() {
  isVerifyActive = true;
  const p = document.getElementById('verifySearchPanel');
  if (p) p.style.display = 'block';
}

function hideVerifyPanel() {
  isVerifyActive = false;
  const p = document.getElementById('verifySearchPanel');
  if (p) p.style.display = 'none';
  clearVerifySearch();
}

function clearVerifySearch() {
  const input = document.getElementById('verifySearchInput');
  const clear = document.getElementById('verifySearchClear');
  const res   = document.getElementById('verifySearchResults');
  if (input) input.value = '';
  if (clear) clear.style.display = 'none';
  if (res)   { res.style.display = 'none'; res.innerHTML = ''; }
}

function onVerifySearchInput(raw) {
  const q = (raw || '').trim();
  const clear = document.getElementById('verifySearchClear');
  const res   = document.getElementById('verifySearchResults');
  if (clear) clear.style.display = q ? 'flex' : 'none';
  if (!q) { if (res) { res.style.display = 'none'; res.innerHTML = ''; } return; }

  // Minimum 2 chars — prevents dumping 1000-row results on a single letter.
  if (q.length < 2) {
    res.style.display = 'block';
    res.innerHTML = '<div class="verify-empty">Введіть мінімум 2 символи…</div>';
    return;
  }

  clearTimeout(verifySearchDebounce);
  verifySearchDebounce = setTimeout(() => renderVerifySearchResults(q), 150);
}

function verifyHitStatus(p) {
  // Returns { label, cls } describing where the package sits in the QC
  // pipeline — so the operator knows if it's already in перевірка before
  // pressing «➕». Mirrors the sidebar filter taxonomy.
  //
  // Пріоритет: у маршруті > Невідомий > Контроль перевірки.
  // «В маршруті» перекриває все, бо це фінальний стан для оператора.
  const rteId = p['RTE_ID'];
  if (rteId) return { label: '🚖 В маршруті (' + rteId + ')', cls: 'in-route' };
  const leadStatus = p['Статус ліда'];
  if (leadStatus === 'Невідомий') return { label: 'Невідомий', cls: 'unknown' };
  const v = p['Контроль перевірки'];
  if (v === 'В перевірці')        return { label: 'Вже в перевірці', cls: 'checking' };
  if (v === 'Готова до маршруту') return { label: '✅ Готова до маршруту', cls: 'ready' };
  if (v === 'Відхилено')          return { label: '❌ Відхилено', cls: 'rejected' };
  return { label: '', cls: '' };
}

function renderVerifySearchResults(q) {
  const res = document.getElementById('verifySearchResults');
  if (!res) return;
  res.style.display = 'block';

  const ql = q.toLowerCase();
  const hits = (allData || []).filter(p => VERIFY_SEARCH_FIELDS.some(f => {
    const v = p[f];
    return v != null && v !== '' && String(v).toLowerCase().includes(ql);
  })).slice(0, 20); // cap to keep dropdown lightweight

  if (hits.length === 0) {
    res.innerHTML =
      '<div class="verify-empty">' +
        'Нічого не знайдено' +
        '<div><button class="verify-mark-unknown-btn" onclick="verifyMarkUnknown()">' +
          '⚠️ Позначити невідомим «' + escapeHtmlVerify(q) + '»' +
        '</button></div>' +
      '</div>';
    return;
  }

  res.innerHTML = hits.map(p => {
    const pkgId = p['PKG_ID'] || '';
    const ttn   = p['Номер ТТН'] || '(без ТТН)';
    const sender    = p['Піб відправника'] || '—';
    const recipient = p['Піб отримувача']  || '—';
    const st = verifyHitStatus(p);
    // Термінальні стани (готова до маршруту / у маршруті / відхилено / невідомий)
    // → ховаємо меню дій, лишаємо лише клікабельний бейдж-статус, щоб оператор
    // бачив, що лід уже закрито для перевірки.
    const isTerminal = ['ready','in-route','rejected','unknown'].includes(st.cls);
    const pkgEsc = escapeHtmlVerify(pkgId);
    const actions = isTerminal
      ? '<div class="verify-search-hit-terminal ' + st.cls + '" onclick="openCardById(\'' + pkgEsc + '\')">' +
          escapeHtmlVerify(st.label) +
        '</div>'
      : '<div class="verify-search-hit-actions">' +
          '<button class="verify-act-btn add" onclick="verifyAddToCheck(\'' + pkgEsc + '\', this)">➕ В перевірку</button>' +
          '<button class="verify-act-btn edit" onclick="verifyOpenEdit(\'' + pkgEsc + '\')">✏️ Редагувати</button>' +
          '<button class="verify-act-btn del" onclick="verifyRemoveFromCheck(\'' + pkgEsc + '\', this)">🗑️ Видалити з перевірки</button>' +
        '</div>';
    return '<div class="verify-search-hit" data-pkg="' + pkgEsc + '">' +
             '<div class="verify-search-hit-info">' +
               '<div class="verify-search-hit-ttn">' + escapeHtmlVerify(ttn) + '</div>' +
               '<div class="verify-search-hit-meta">' +
                 escapeHtmlVerify(sender) + ' → ' + escapeHtmlVerify(recipient) +
               '</div>' +
               (st.label && !isTerminal
                 ? '<div class="verify-search-hit-status ' + st.cls + '">' + st.label + '</div>'
                 : '') +
             '</div>' +
             actions +
           '</div>';
  }).join('');
}

// Відкрити картку ліда за PKG_ID (використовується у бейджах-статусах
// «Готова до маршруту / В маршруті / Відхилено / Невідомий» у результатах
// пошуку Перевірки).
function openCardById(pkgId) {
  if (!pkgId) return;
  clearScanReturn();
  openCardId = pkgId;
  clearVerifySearch();
  renderCards();
  setTimeout(() => {
    const el = document.querySelector('.lead-card[data-id="' + pkgId + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 60);
}

// Standalone escape — renderCards has its own escapeHtml but it lives deeper
// in the file; a local helper keeps this section self-contained.
function escapeHtmlVerify(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

async function verifyAddToCheck(pkgId, btn) {
  if (!pkgId) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }

  const res = await apiPost('updateField', {
    pkg_id: pkgId, col: 'Контроль перевірки', value: 'В перевірці'
  });

  if (!res || !res.ok) {
    if (btn) { btn.disabled = false; btn.textContent = '➕ В перевірку'; }
    showToast((res && res.error) || 'Помилка додавання', 'error');
    return;
  }

  // Reflect the change in the in-memory list so filters/counters update
  // without a full reload.
  const row = (allData || []).find(p => p['PKG_ID'] === pkgId);
  if (row) row['Контроль перевірки'] = 'В перевірці';

  if (btn) {
    btn.textContent = '✓ Вже в перевірці';
    btn.classList.add('success');
    btn.disabled = true;
  }

  renderCards();
  updateCounters();
  showToast('Додано в перевірку', 'success');

  // Якщо оператор прийшов зі сканера — коротким колом повертаємо назад
  // сканувати наступну ТТН; інакше лишаємо в CRM.
  if (hasScanReturn()) {
    setTimeout(() => backToScanner(), 400);
  }
}

// Видалити з перевірки (скидає scan_status до 'received' через api-мапінг
// у supabase-api.js — колонку 'Контроль перевірки' = '').
async function verifyRemoveFromCheck(pkgId, btn) {
  if (!pkgId) return;
  if (!confirm('Видалити «' + pkgId + '» з перевірки?')) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }

  const res = await apiPost('updateField', {
    pkg_id: pkgId, col: 'Контроль перевірки', value: ''
  });

  if (!res || !res.ok) {
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Видалити з перевірки'; }
    showToast((res && res.error) || 'Помилка видалення', 'error');
    return;
  }

  const row = (allData || []).find(p => p['PKG_ID'] === pkgId);
  if (row) { row['Контроль перевірки'] = ''; row['Дата перевірки'] = ''; }

  renderCards();
  updateCounters();
  showToast('Знято з перевірки', 'success');

  if (hasScanReturn()) {
    setTimeout(() => backToScanner(), 400);
  } else {
    // Оновити випадайку результатів, щоб кнопка не була застарілою
    const input = document.getElementById('verifySearchInput');
    if (input && input.value) onVerifySearchInput(input.value);
  }
}

// «Редагувати» — відкрити модалку швидкого заповнення пріоритетних полів.
function verifyOpenEdit(pkgId) {
  if (!pkgId) return;
  openFillModal(pkgId);
}

// ===== [SECT-FILLMODAL] FILL MODAL (quick-fill priority fields) =====
// Показується або з кнопки «Заповнити» на картці (в перевірці / невідомий),
// або з «✏️ Редагувати» у результатах verify-пошуку. Містить 11 полів,
// з яких обов'язкове лише «Телефон отримувача».
const _FILL_FIELDS = [
  ['fill_phoneRecv',   'Телефон отримувача'],
  ['fill_phoneSender', 'Телефон відправника'],
  ['fill_addressTo',   'Адреса в Європі'],
  ['fill_innerNum',    'Внутрішній №'],
  ['fill_description', 'Опис'],
  ['fill_qty',         'Кількість позицій'],
  ['fill_npPlaces',    'Місця НП'],
  ['fill_weight',      'Вага'],
  ['fill_sum',         'Сума'],
  ['fill_currency',    'Валюта оплати'],
  ['fill_payStatus',   'Статус оплати'],
  ['fill_statusPkg',   'Статус посилки'],
  ['fill_photoUrl',    'Фото посилки'],
  ['fill_messengers',  'Месенджери'],
  ['fill_extraPhones', 'Ще телефони'],
];

// Поля, що зберігають JSON-масив у hidden → треба порівнювати як масиви
const _FILL_JSONB_FIELDS = new Set(['fill_messengers', 'fill_extraPhones']);
const _FILL_MAX_EXTRA_PHONES = 2; // разом з головним = 3 номери

function openFillModal(pkgId) {
  if (!pkgId) return;
  const row = (allData || []).find(p => p['PKG_ID'] === pkgId);
  if (!row) { showToast('Лід не знайдено', 'error'); return; }

  document.getElementById('fillPkgId').value = pkgId;
  _FILL_FIELDS.forEach(([inputId, col]) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    const cur = row[col];
    // JSONB (messengers / extra phones) — hidden input з JSON.stringify
    if (_FILL_JSONB_FIELDS.has(inputId)) {
      const arr = Array.isArray(cur) ? cur : [];
      el.value = JSON.stringify(arr);
      if (inputId === 'fill_messengers') _applyFillMessengersUI(arr);
      else if (inputId === 'fill_extraPhones') _applyFillExtraPhonesUI(arr);
      return;
    }
    if (cur != null && cur !== '') {
      el.value = cur;
    } else if (inputId === 'fill_currency') {
      // Валюта за замовчуванням — EUR (основний напрямок UA↔EU).
      el.value = 'EUR';
    } else if (el.tagName === 'SELECT') {
      // select: лишаємо <option selected>, що стоїть у HTML
    } else {
      el.value = '';
    }
    // Якщо на полі висить country-selector — синхронізуємо прапор
    if (el._cpApi) el._cpApi.syncFromValue();
  });

  // Фото посилки: ставимо превʼю якщо URL уже є
  const photoUrl = row['Фото посилки'] || '';
  const prev = document.getElementById('fill_photoPreview');
  const clr = document.getElementById('fill_photoClear');
  const fileInput = document.getElementById('fill_photoInput');
  if (fileInput) fileInput.value = '';
  if (prev) {
    if (photoUrl) { prev.src = photoUrl; prev.style.display = ''; if (clr) clr.style.display = ''; }
    else { prev.src = ''; prev.style.display = 'none'; if (clr) clr.style.display = 'none'; }
  }

  document.getElementById('fillOverlay').classList.add('open');
  setTimeout(() => {
    const rcv = document.getElementById('fill_phoneRecv');
    if (rcv) rcv.focus();
  }, 100);
}

function closeFillModal() {
  document.getElementById('fillOverlay').classList.remove('open');
}

// 💬 Месенджери у fill-модалці — toggle + UI-підсвічення
function _getFillMessengers() {
  const hidden = document.getElementById('fill_messengers');
  if (!hidden) return [];
  try { return JSON.parse(hidden.value || '[]'); } catch (_) { return []; }
}
function _applyFillMessengersUI(arr) {
  const hidden = document.getElementById('fill_messengers');
  if (hidden) hidden.value = JSON.stringify(arr || []);
  const grid = document.getElementById('fill_messengersGrid');
  if (!grid) return;
  Array.from(grid.querySelectorAll('.fill-msg-btn')).forEach(b => {
    b.classList.toggle('active', (arr || []).indexOf(b.getAttribute('data-msg')) !== -1);
  });
}
function toggleFillMessenger(key /*, btn */) {
  const cur = _getFillMessengers();
  const i = cur.indexOf(key);
  if (i === -1) cur.push(key); else cur.splice(i, 1);
  _applyFillMessengersUI(cur);
}

// 📞 Додаткові номери отримувача — динамічні inputs + «+»
function _getFillExtraPhones() {
  const hidden = document.getElementById('fill_extraPhones');
  if (!hidden) return [];
  try { return JSON.parse(hidden.value || '[]'); } catch (_) { return []; }
}
function _syncFillExtraPhones() {
  const box = document.getElementById('fill_extraPhonesBox');
  const hidden = document.getElementById('fill_extraPhones');
  if (!box || !hidden) return;
  const arr = Array.from(box.querySelectorAll('input.fill-phone-extra'))
    .map(i => (i.value || '').trim())
    .filter(v => !!v);
  hidden.value = JSON.stringify(arr);
}
function _applyFillExtraPhonesUI(arr) {
  const box = document.getElementById('fill_extraPhonesBox');
  const hidden = document.getElementById('fill_extraPhones');
  if (!box || !hidden) return;
  arr = Array.isArray(arr) ? arr : [];
  box.innerHTML = '';
  arr.slice(0, _FILL_MAX_EXTRA_PHONES).forEach(p => _appendFillExtraPhoneInput(p));
  hidden.value = JSON.stringify(arr);
}
function _appendFillExtraPhoneInput(initial) {
  const box = document.getElementById('fill_extraPhonesBox');
  if (!box) return;
  const count = box.querySelectorAll('input.fill-phone-extra').length;
  if (count >= _FILL_MAX_EXTRA_PHONES) return;
  const wrap = document.createElement('div');
  wrap.className = 'fill-phone-row';
  const inp = document.createElement('input');
  inp.type = 'tel';
  inp.className = 'fill-phone-extra';
  inp.placeholder = '+380… або +48… +420…';
  inp.value = initial || '';
  // Спочатку додаємо input у DOM — тільки потім attach, бо він переміщає
  // input усередину wrapper зі селектом.
  wrap.appendChild(inp);
  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'fill-phone-rm';
  rm.textContent = '×';
  rm.title = 'Прибрати цей номер';
  rm.onclick = () => { wrap.remove(); _syncFillExtraPhones(); };
  wrap.appendChild(rm);
  box.appendChild(wrap);
  if (window.CountryPhone) {
    // Для додаткового номера дефолт — Польща (типово «другий номер — EU»).
    // Якщо клієнт з іншої країни, оператор обере зі списку.
    const cpDefault = initial ? 'UA' : 'PL';
    window.CountryPhone.attach(inp, {
      theme: 'light',
      defaultCountry: cpDefault,
      onChange: () => {
        _syncFillExtraPhones();
        _scheduleClientSuggestions(0);
      },
    });
  } else {
    attachPhoneNormalization(inp, '+380');
    inp.addEventListener('input', _syncFillExtraPhones);
    inp.addEventListener('blur', _syncFillExtraPhones);
  }
  // Лукап клієнта і по додаткових номерах — з debounce, щоб не спамити API.
  inp.addEventListener('input', () => _scheduleClientSuggestions(400));
  inp.addEventListener('blur',  () => setTimeout(_refreshClientSuggestions, 150));
  if (!initial) setTimeout(() => inp.focus(), 50);
}
function addFillExtraPhone() {
  const box = document.getElementById('fill_extraPhonesBox');
  if (!box) return;
  const count = box.querySelectorAll('input.fill-phone-extra').length;
  if (count >= _FILL_MAX_EXTRA_PHONES) {
    showToast('Максимум 3 номери (1 основний + 2 додаткові)', 'info');
    return;
  }
  _appendFillExtraPhoneInput('');
}

// ===== [SECT-PHONE-NORMALIZE] Нормалізація телефону =====
// «0639763485»        → «+380639763485»  (українська звичка писати без коду)
// «639763485»         → «+380639763485»  (9 цифр — припускаємо UA)
// «380639763485»      → «+380639763485»  (без плюса)
// «+380 63 976-34-85» → «+380639763485»  (прибрати форматування)
// «+48 607 123 456»   → «+48607123456»    (польський номер лишається як є)
// «+420 123 456 789»  → «+420123456789»   (чеський номер лишається)
function normalizePhoneIntl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  // Витягуємо тільки цифри
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  // Якщо вводять 0XXXXXXXXX (10 цифр) — українське ведуче 0 замінюємо на 380
  if (digits.length === 10 && digits.startsWith('0')) return '+380' + digits.slice(1);
  // Якщо рівно 9 цифр — UA без коду і без нуля
  if (digits.length === 9) return '+380' + digits;
  // Все інше (380... / 48... / 420... / 49...) — вже має код, просто +
  return '+' + digits;
}

// Приєднує нормалізацію до inputEl: paste + blur переводить у канонічний вигляд,
// focus на пустому полі одразу ставить +380 як стартовий префікс.
function attachPhoneNormalization(inputEl, defaultPrefix = '+380') {
  if (!inputEl || inputEl._phoneNormAttached) return;
  inputEl._phoneNormAttached = true;

  inputEl.addEventListener('focus', () => {
    if (!inputEl.value) inputEl.value = defaultPrefix;
  });
  inputEl.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    inputEl.value = normalizePhoneIntl(pasted);
    inputEl.dispatchEvent(new Event('change'));
  });
  inputEl.addEventListener('blur', () => {
    if (inputEl.value && inputEl.value !== defaultPrefix) {
      inputEl.value = normalizePhoneIntl(inputEl.value);
    }
  });
}

// ===== [SECT-CLIENT-LOOKUP] Пошук клієнта за телефоном (Phase A) =====
// Підтягує попередні адреси та імена отримувачів із таблиці packages
// по номеру телефону. Якщо є декілька варіантів — показує список,
// оператор обирає потрібну. Phase B (окрема таблиця clients_directory
// з тригером + бекфіл) — готується окремо.

async function lookupClientByPhone(phone, column) {
  const ph = (phone || '').trim();
  if (ph.length < 5) return [];
  const tenantId = (getBotiSession() && getBotiSession().tenant_id) || '';
  if (!tenantId) return [];
  // Порівнюємо по ОСТАННІХ 9 цифрах, щоб працювало незалежно від формату:
  //  +380639763485  → 639763485
  //  380639763485   → 639763485
  //  0639763485     → 639763485  (перша 0 відсікається)
  //  063 976-34-85  → 639763485
  const digits = ph.replace(/\D/g, '');
  if (digits.length < 5) return [];
  const tail = digits.length >= 9 ? digits.slice(-9) : digits;
  // Колонка пошуку: recipient_phone (default) або sender_phone — щоб лукап
  // по номеру відправника витягав його попередні посилки і адреси куди він шле.
  const col = (column === 'sender_phone') ? 'sender_phone' : 'recipient_phone';
  try {
    const url = SUPABASE_URL + '/rest/v1/packages' +
      '?tenant_id=eq.' + encodeURIComponent(tenantId) +
      '&' + col + '=ilike.*' + encodeURIComponent(tail) + '*' +
      '&is_archived=eq.false' +
      '&select=pkg_id,recipient_name,recipient_address,nova_poshta_city,created_at,recipient_phone,sender_phone,messengers' +
      '&order=created_at.desc&limit=20';
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY
      }
    });
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    // Дедупимо по (name, address) — рахуємо кількість повторів
    const byKey = {};
    rows.forEach(r => {
      const name = (r.recipient_name || '').trim();
      const addr = (r.recipient_address || r.nova_poshta_city || '').trim();
      if (!name && !addr) return;
      const key = name + '|' + addr;
      if (!byKey[key]) byKey[key] = { name, address: addr, count: 0, last: r.created_at, messengers: {} };
      byKey[key].count++;
      if (r.created_at > byKey[key].last) byKey[key].last = r.created_at;
      // union месенджерів по всіх збігах
      (Array.isArray(r.messengers) ? r.messengers : []).forEach(m => {
        byKey[key].messengers[m] = true;
      });
    });
    return Object.values(byKey).map(it => ({
      name: it.name, address: it.address, count: it.count, last: it.last,
      messengers: Object.keys(it.messengers),
    })).sort((a, b) => b.last.localeCompare(a.last));
  } catch (e) {
    console.warn('[client lookup]', e);
    return [];
  }
}

// Мульти-пошук: прокидаємо масив { phone, column } — кожен телефон іде
// у свою колонку (recipient_phone для отримувача+extra, sender_phone для
// відправника). Результати мержимо по (name,address), месенджери юньонимо,
// count складаємо, last беремо найсвіжіший. Одна картка навіть якщо клієнт
// знайшовся по 2+ номерах — так оператор бачить єдиний запис з усіма
// відмітками мес-в.
async function lookupClientsMulti(queries) {
  const valid = (queries || []).filter(q => {
    const d = (q.phone || '').replace(/\D/g, '');
    return d.length >= 5;
  });
  if (!valid.length) return [];
  const results = await Promise.all(
    valid.map(q => lookupClientByPhone(q.phone, q.column))
  );
  const byKey = {};
  results.forEach(arr => {
    (arr || []).forEach(it => {
      const key = (it.name || '') + '|' + (it.address || '');
      if (!byKey[key]) {
        byKey[key] = { name: it.name, address: it.address, count: 0,
                       last: it.last || '', messengers: {} };
      }
      byKey[key].count += (it.count || 1);
      if (it.last && it.last > byKey[key].last) byKey[key].last = it.last;
      (it.messengers || []).forEach(m => { byKey[key].messengers[m] = true; });
    });
  });
  return Object.values(byKey).map(it => ({
    name: it.name, address: it.address, count: it.count, last: it.last,
    messengers: Object.keys(it.messengers),
  })).sort((a, b) => (b.last || '').localeCompare(a.last || ''));
}

function _renderClientSuggestions(container, items, onPick) {
  container.innerHTML = '';
  if (!items || !items.length) { container.classList.remove('show'); return; }
  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'client-suggestion';
    row.innerHTML =
      '<div class="client-suggestion-main">' +
        '<div class="client-suggestion-name">👤 ' + escapeHtml(it.name || '(без імені)') + '</div>' +
        '<div class="client-suggestion-addr">📍 ' + escapeHtml(it.address || '—') + '</div>' +
      '</div>' +
      '<span class="client-suggestion-count">×' + it.count + '</span>' +
      '<span class="client-suggestion-apply">Застосувати →</span>';
    row.addEventListener('click', () => onPick(it));
    container.appendChild(row);
  });
  container.classList.add('show');
}

// Shared debounced refresh — запускається з будь-якого телефону у fill-модалці
// (основний отримувач, відправник, або динамічні «ще телефони»).
let _fillSugTimer = null;
function _scheduleClientSuggestions(delay) {
  if (typeof delay !== 'number') delay = 400;
  clearTimeout(_fillSugTimer);
  _fillSugTimer = setTimeout(_refreshClientSuggestions, delay);
}

async function _refreshClientSuggestions() {
  const sugBox = document.getElementById('fill_clientSuggestions');
  if (!sugBox) return;
  const recv   = (document.getElementById('fill_phoneRecv')   || {}).value || '';
  const sender = (document.getElementById('fill_phoneSender') || {}).value || '';
  const extras = Array.from(
    document.querySelectorAll('#fill_extraPhonesBox input.fill-phone-extra')
  ).map(i => (i.value || '').trim()).filter(Boolean);

  const queries = [];
  if (recv.trim())   queries.push({ phone: recv,   column: 'recipient_phone' });
  if (sender.trim()) queries.push({ phone: sender, column: 'sender_phone'    });
  extras.forEach(p => queries.push({ phone: p, column: 'recipient_phone' }));

  const items = await lookupClientsMulti(queries);
  _renderClientSuggestions(sugBox, items, (picked) => {
    const addrEl = document.getElementById('fill_addressTo');
    if (addrEl) addrEl.value = picked.address || addrEl.value;
    if (Array.isArray(picked.messengers) && picked.messengers.length) {
      _applyFillMessengersUI(picked.messengers);
    }
    sugBox.classList.remove('show');
  });
}

// Прив'язуємо listener'и до статичних телефонів (recv + sender). Extra-поля
// підв'язуються при створенні у _appendFillExtraPhoneInput.
function _bindPhoneInputForLookup(el) {
  if (!el || el._lookupBound) return;
  el._lookupBound = true;
  el.addEventListener('change', () => _scheduleClientSuggestions(0));
  el.addEventListener('blur',   () => setTimeout(_refreshClientSuggestions, 150));
  el.addEventListener('input',  () => _scheduleClientSuggestions(400));
}

// CRM fill-modal: слухач на телефонах (recv + sender) + нормалізація формату
document.addEventListener('DOMContentLoaded', () => {
  // Селектор країни + нормалізація для всіх tel-полів у fill-модалці
  ['fill_phoneRecv', 'fill_phoneSender'].forEach(id => {
    const el = document.getElementById(id);
    if (el && window.CountryPhone) window.CountryPhone.attach(el, { theme: 'light', defaultCountry: 'UA' });
    else if (el) attachPhoneNormalization(el); // fallback якщо скрипт не завантажився
  });

  if (!document.getElementById('fill_clientSuggestions')) return;
  _bindPhoneInputForLookup(document.getElementById('fill_phoneRecv'));
  _bindPhoneInputForLookup(document.getElementById('fill_phoneSender'));
});

// Фото-аплоад для CRM fill-модалки — використовує той самий бакет
// `package-photos` що і сканер. На зміну file input → upload до Storage
// → URL кладемо в hidden #fill_photoUrl. Кнопка Очистити прибирає URL.
const _STORAGE_BUCKET_FILL = 'package-photos';
document.addEventListener('DOMContentLoaded', () => {
  const fi = document.getElementById('fill_photoInput');
  if (fi) fi.addEventListener('change', onFillPhotoPick);
});

async function onFillPhotoPick(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const pkgId = document.getElementById('fillPkgId').value || 'unknown';
  let ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  if (!['jpg','jpeg','png','webp'].includes(ext)) ext = 'jpg';
  const tenantId = (getBotiSession() && getBotiSession().tenant_id) || 'tn';
  const path = `${tenantId}/${pkgId}-${Date.now()}.${ext}`;

  showToast('⏳ Завантаження фото…', 'info');
  try {
    const { data, error } = await sb.storage
      .from(_STORAGE_BUCKET_FILL)
      .upload(path, file, { contentType: file.type || `image/${ext}`, upsert: true });
    if (error) throw error;
    const url = `${SUPABASE_URL}/storage/v1/object/public/${_STORAGE_BUCKET_FILL}/${path}`;
    const hidden = document.getElementById('fill_photoUrl');
    if (hidden) hidden.value = url;
    const prev = document.getElementById('fill_photoPreview');
    const clr = document.getElementById('fill_photoClear');
    if (prev) { prev.src = url; prev.style.display = ''; }
    if (clr) clr.style.display = '';
    showToast('📷 Фото додано — натисни Зберегти', 'success');
  } catch (err) {
    console.error('[fill_photo] upload error:', err);
    showToast('Помилка фото: ' + (err.message || err), 'error');
  }
}

function clearFillPhoto() {
  const hidden = document.getElementById('fill_photoUrl');
  if (hidden) hidden.value = '';
  const fi = document.getElementById('fill_photoInput');
  if (fi) fi.value = '';
  const prev = document.getElementById('fill_photoPreview');
  const clr = document.getElementById('fill_photoClear');
  if (prev) { prev.src = ''; prev.style.display = 'none'; }
  if (clr) clr.style.display = 'none';
}

async function saveFillModal() {
  const pkgId = document.getElementById('fillPkgId').value;
  if (!pkgId) return;

  const phoneRecv = (document.getElementById('fill_phoneRecv').value || '').trim();
  if (!phoneRecv) {
    showToast('Телефон отримувача — обов\'язкове поле', 'error');
    document.getElementById('fill_phoneRecv').focus();
    return;
  }

  const btn = document.getElementById('fillSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Збереження…'; }

  // Порівнюємо з поточним рядком і відправляємо лише ті колонки, що
  // справді змінилися — так ми не дзвонимо в updateField даремно, і не
  // створюємо фантомних записів change_logs/audit_logs.
  // Перед read'ом hidden — синхронізуємо динамічні inputs
  _syncFillExtraPhones();

  const row = (allData || []).find(p => p['PKG_ID'] === pkgId) || {};
  const toUpdate = [];
  for (const [inputId, col] of _FILL_FIELDS) {
    const el = document.getElementById(inputId);
    if (!el) continue;
    // JSONB (messengers / extra_phones) — порівнюємо як масиви, а не рядки
    if (_FILL_JSONB_FIELDS.has(inputId)) {
      let newArr = [];
      try { newArr = JSON.parse(el.value || '[]'); } catch (_) { newArr = []; }
      if (!Array.isArray(newArr)) newArr = [];
      const oldArr = Array.isArray(row[col]) ? row[col] : [];
      // Для extra_phones порядок важливий (UA-первинний, EU-другий),
      // для messengers — ні.
      const ordered = (inputId === 'fill_extraPhones');
      const aS = ordered ? newArr.join('|') : newArr.slice().sort().join(',');
      const bS = ordered ? oldArr.join('|') : oldArr.slice().sort().join(',');
      if (aS !== bS) toUpdate.push([col, newArr]);
      continue;
    }
    const newVal = (el.value == null ? '' : String(el.value)).trim();
    const oldVal = (row[col] == null ? '' : String(row[col])).trim();
    if (newVal !== oldVal) toUpdate.push([col, newVal]);
  }

  let failed = 0;
  for (const [col, val] of toUpdate) {
    try {
      const r = await apiPost('updateField', { pkg_id: pkgId, col, value: val });
      if (r && r.ok) {
        if (row) row[col] = val;
      } else {
        failed++;
      }
    } catch (_) { failed++; }
  }

  // Авто-перехід «Невідомий» → «В перевірці» після заповнення:
  // оператор щойно оформив ТТН — логічно, що далі йде перевірка
  // (а не лишати лід у Невідомих).
  const wasUnknown = (row && (row['Статус ліда'] || '').trim()) === 'Невідомий';
  if (wasUnknown) {
    try {
      const r1 = await apiPost('updateField', { pkg_id: pkgId, col: 'Статус ліда', value: 'Готова' });
      if (r1 && r1.ok && row) row['Статус ліда'] = 'Готова';
    } catch (_) {}
    try {
      const r2 = await apiPost('updateField', { pkg_id: pkgId, col: 'Контроль перевірки', value: 'В перевірці' });
      if (r2 && r2.ok && row) row['Контроль перевірки'] = 'В перевірці';
    } catch (_) {}
  }

  if (btn) { btn.disabled = false; btn.textContent = '💾 Зберегти'; }

  if (failed > 0) {
    showToast('Збережено з помилками: ' + failed, 'error');
  } else {
    showToast('Збережено (' + toUpdate.length + ' полів)', 'success');
  }

  closeFillModal();
  renderCards();
  updateCounters();

  // Коротке коло «скан → заповнення → наступний скан»
  if (hasScanReturn()) {
    setTimeout(() => backToScanner(), 400);
  }
}

async function verifyMarkUnknown() {
  const input = document.getElementById('verifySearchInput');
  const q = (input && input.value || '').trim();
  if (!q) return;

  // Default direction matches the scanner's RPC — new leads land as UA→EU
  // (operator can flip it in the card later if needed). We only set
  // lead_status='unknown' — the sidebar's «Невідомі» filter is keyed on that
  // field alone, so the new lead lands there immediately. Контроль перевірки
  // is a GENERATED column off scan_status and can't be inserted directly.
  const data = {
    'Номер ТТН':     q,
    'Напрям':        'УК→ЄВ',
    'Статус ліда':   'Невідомий',
  };

  const res = await apiPost('addParcel', { sheet: 'Реєстрація ТТН УК-єв', data });

  if (!res || !res.ok) {
    showToast((res && res.error) || 'Не вдалося створити', 'error');
    return;
  }

  // Build a minimal local row so the just-created lead shows up in counters
  // and the list without a round-trip reload.
  const newItem = {
    'PKG_ID':          res.pkg_id || ('PKG_' + Date.now()),
    'Напрям':          data['Напрям'],
    'Номер ТТН':       q,
    'Піб відправника': '',
    'Піб отримувача':  '',
    'Статус ліда':     'Невідомий',
    'Створено':        new Date().toISOString(),
  };
  allData = allData || [];
  allData.unshift(newItem);

  // Jump the operator to the Unknown filter so they see the new row.
  setVerFilter('unknown');
  clearVerifySearch();
  showToast('Створено ліда зі статусом «Невідомий»', 'success');
}


// ---------- Start / Complete / Reject verification ----------

// Перевести лід в перевірку
function startVerification(pkgId) {
  const item = allData.find(p => p['PKG_ID'] === pkgId);
  if (!item) return;

  const isAlreadyChecking = item['Контроль перевірки'] === 'В перевірці';
  if (isAlreadyChecking) {
    showToast('Вже в перевірці', 'info');
    return;
  }

  // Аудит: хто і коли перевів у перевірку (показується у вкладці «⚙ Системні»).
  const sess = getBotiSession() || {};
  const who = sess.user_name || sess.user_login || 'CRM';
  const when = new Date().toISOString();

  // Оновити локально
  item['Контроль перевірки'] = 'В перевірці';
  item['Дата перевірки'] = when;
  item['Ким перевірено'] = who;
  item['Дата переходу в перевірку'] = when;
  item['Джерело перевірки'] = 'crm';
  item['Статус ліда'] = 'В роботі';
  renderCards();
  updateCounters();
  showToast('Переведено в перевірку', 'success');

  // Відправити на сервер (write-through у БД)
  apiPost('updateField', { pkg_id: pkgId, col: 'Контроль перевірки', value: 'В перевірці' });
  apiPost('updateField', { pkg_id: pkgId, col: 'Статус ліда', value: 'В роботі' });
  apiPost('updateField', { pkg_id: pkgId, col: 'Ким перевірено', value: who });
  apiPost('updateField', { pkg_id: pkgId, col: 'Дата переходу в перевірку', value: when });
  apiPost('updateField', { pkg_id: pkgId, col: 'Джерело перевірки', value: 'crm' });

  // Автоматично шукати дублікати
  apiPost('findDuplicatesByRecipient', { pkg_id: pkgId }).then(res => {
    if (res.ok && res.count > 0) {
      showToast(`⚠️ Знайдено ${res.count} дублікат(ів) по отримувачу`, 'info');
    }
  });
}

// Завершити перевірку — позначити як "Готово"
async function completeVerification(pkgId) {
  const item = allData.find(p => p['PKG_ID'] === pkgId);
  if (!item) return;

  if (item['Контроль перевірки'] === 'Готова до маршруту') {
    showToast('Вже позначено як готова', 'info');
    return;
  }

  // Перевірити чи є внутрішній номер
  if (!item['Внутрішній №']) {
    // Автопризначити номер
    const numRes = await apiPost('assignRouteNumber', { pkg_id: pkgId, route_base: 200 });
    if (numRes.ok) {
      item['Внутрішній №'] = String(numRes.number);
      showToast(`Присвоєно внутрішній № ${numRes.number}`, 'info');
    } else {
      showToast('Не вдалося присвоїти внутрішній №: ' + numRes.error, 'error');
      return;
    }
  }

  // Завершити верифікацію через API
  const res = await apiPost('completeVerification', { pkg_id: pkgId, skip_validation: true });
  if (!res.ok) {
    showToast('Помилка: ' + res.error, 'error');
    return;
  }

  // Оновити локально
  item['Контроль перевірки'] = 'Готова до маршруту';
  item['Дата перевірки'] = new Date().toISOString();
  item['Статус ліда'] = 'Підтверджено';
  renderCards();
  updateCounters();
  showToast('Перевірку завершено — готова до маршруту', 'success');

  apiPost('updateField', { pkg_id: pkgId, col: 'Статус ліда', value: 'Підтверджено' });
}

// Відхилити посилку з причиною
function rejectVerification(pkgId) {
  const item = allData.find(p => p['PKG_ID'] === pkgId);
  if (!item) return;

  const reason = prompt('Причина відхилення:');
  if (reason === null) return; // скасовано

  item['Контроль перевірки'] = 'Відхилено';
  item['Статус ліда'] = 'Відмова';
  item['Примітка'] = reason;
  renderCards();
  updateCounters();
  showToast('Посилку відхилено', 'success');

  apiPost('rejectVerification', { pkg_id: pkgId, reason });
}

// ---------- Assign Route Number (manual) ----------

async function assignRouteNumber(pkgId, routeBase) {
  const item = allData.find(p => p['PKG_ID'] === pkgId);
  if (!item) return;

  if (item['Внутрішній №']) {
    showToast(`Вже має внутрішній № ${item['Внутрішній №']}`, 'info');
    return;
  }

  const base = parseInt(routeBase) || 200;
  const res = await apiPost('assignRouteNumber', { pkg_id: pkgId, route_base: base });
  if (!res.ok) {
    showToast('Помилка: ' + res.error, 'error');
    return;
  }

  item['Внутрішній №'] = String(res.number);
  renderCards();
  showToast(`Присвоєно внутрішній № ${res.number}`, 'success');
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
      } else if (status === 'Відхилено') {
        item['Статус ліда'] = 'Відмова';
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
    } else if (status === 'Відхилено') {
      apiPost('updateField', { pkg_id: id, col: 'Статус ліда', value: 'Відмова' });
    }
  });

  afterBulkAction();
}

// Bulk menu segment collapse/expand — auto-expand the segment relevant to the
// current context (verify filter, route view, …). "general" is always visible.
function toggleBulkSegment(seg) {
  const el = document.querySelector('.bulk-segment[data-seg="' + seg + '"]');
  if (el) el.classList.toggle('collapsed');
}

function setBulkContext(ctx) {
  // ctx: 'general' | 'verify' | 'route'
  document.querySelectorAll('.bulk-segment').forEach(el => {
    const seg = el.dataset.seg;
    // Always keep 'general' expanded; others collapse unless they match ctx.
    const expand = seg === 'general' || seg === ctx;
    el.classList.toggle('collapsed', !expand);
  });
}

// Масове видалення з перевірки — повертає Контроль перевірки в порожнє (scan_status='received')
function bulkRemoveFromVerify() {
  const ids = getSelectedIds();
  if (ids.length === 0) return;
  if (!confirm('Видалити ' + ids.length + ' записів з перевірки?')) return;

  ids.forEach(id => {
    const item = allData.find(p => p['PKG_ID'] === id);
    if (item) {
      item['Контроль перевірки'] = '';
      item['Дата перевірки'] = '';
    }
  });

  renderCards();
  updateCounters();
  showToast(ids.length + ' записів знято з перевірки', 'success');

  ids.forEach(id => {
    apiPost('updateField', { pkg_id: id, col: 'Контроль перевірки', value: '' });
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
  // Перехід у секцію «Напрямок» → інші секції згортаються, їхні фільтри скидаються.
  setActiveSidebarSection('direction');
  currentDirection = dir;
  // active-клас: для напрямків — кольоровий (active-ue / active-eu),
  // для «Нові (24 год)» — нейтральний active.
  const activeCls = dir === 'ue' ? 'active-ue' : (dir === 'eu' ? 'active-eu' : 'active');
  // Update desktop sidebar items
  document.querySelectorAll('.sidebar [data-dir]').forEach(el => {
    el.className = 'sidebar-item' + (el.dataset.dir === dir ? ' ' + activeCls : '');
  });
  // Update mobile sidebar items
  document.querySelectorAll('#mobileSidebar [data-dir]').forEach(el => {
    el.className = 'mob-item' + (el.dataset.dir === dir ? ' ' + activeCls : '');
  });
  // Moved out of Перевірка section → hide the verify search bar.
  hideVerifyPanel();
  // Bulk-menu context back to general (user left Перевірка).
  setBulkContext('general');
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
// === Sidebar accordion: one section active at a time + filter reset ===
// Коли юзер переключає секцію меню, попередня автоматично згортається і її
// фільтри скидаються до дефолту — так жодний «застарілий» фільтр не тягнеться
// у новий контекст. Той самий патерн що ми реалізували у passenger-crm.
// null = жодна секція sidebar не активна (всі згорнуті за замовчуванням —
// чистий вхід у CRM, оператор сам обирає куди заглядати).
var _activeSidebarSection = null;
// Відправку/Витрати/Зведення перенесено всередину «Маршрути» як підсекції,
// тож вони більше не в топ-рівні.
var _SIDEBAR_SECTIONS = ['direction', 'verify', 'routes'];

// Підсекції всередині «Маршрути» (dispatch / expenses) — також mutual-exclusive:
// відкрита лише одна, інша згортається. Зведення — просто кнопка, не акордеон.
var _activeRoutesSubSection = null;
var _ROUTES_SUBSECTIONS = ['dispatch', 'expenses'];

function setActiveRoutesSubSection(name) {
  _activeRoutesSubSection = name;
  // Desktop
  _ROUTES_SUBSECTIONS.forEach(function(s) {
    var sec = document.querySelector('.sidebar .sidebar-sub-section[data-sub="' + s + '"]');
    if (!sec) return;
    var body = sec.querySelector('.sidebar-sub-body');
    var toggle = sec.querySelector('.sub-toggle');
    if (body) body.classList.toggle('hidden', s !== name);
    if (toggle) toggle.classList.toggle('open', s === name);
  });
  // Mobile
  _ROUTES_SUBSECTIONS.forEach(function(s) {
    var sec = document.querySelector('#mobileSidebar .mob-sub-section[data-sub="' + s + '"]');
    if (!sec) return;
    var body = sec.querySelector('.mob-sub-body');
    var toggle = sec.querySelector('.mob-sub-toggle');
    if (body) body.classList.toggle('mob-collapsed', s !== name);
    if (toggle) toggle.classList.toggle('open', s === name);
  });
}

function toggleSubSection(header) {
  var sec = header.closest('.sidebar-sub-section');
  var name = sec && sec.getAttribute('data-sub');
  if (!name) return;
  var body = sec.querySelector('.sidebar-sub-body');
  var isCollapsed = body && body.classList.contains('hidden');
  // Відкриваємо Маршрути-секцію (якщо раптом закрита), бо sub-section живе всередині.
  if (_activeSidebarSection !== 'routes') setActiveSidebarSection('routes');
  setActiveRoutesSubSection(isCollapsed ? name : null);
}

function toggleMobSubSection(titleEl) {
  var sec = titleEl.closest('.mob-sub-section');
  var name = sec && sec.getAttribute('data-sub');
  if (!name) return;
  var body = sec.querySelector('.mob-sub-body');
  var isCollapsed = body && body.classList.contains('mob-collapsed');
  if (_activeSidebarSection !== 'routes') setActiveSidebarSection('routes');
  setActiveRoutesSubSection(isCollapsed ? name : null);
}

// Повертає фільтр секції до дефолту. Не чіпає інші секції.
function _resetSidebarSectionFilter(name) {
  if (name === 'direction') {
    currentDirection = 'ue';
    // Підсвічуємо дефолтний таб (UE) — і desktop, і mobile
    document.querySelectorAll('.sidebar [data-dir]').forEach(function(el) {
      el.className = 'sidebar-item' + (el.dataset.dir === 'ue' ? ' active-ue' : '');
    });
    document.querySelectorAll('#mobileSidebar [data-dir]').forEach(function(el) {
      el.className = 'mob-item' + (el.dataset.dir === 'ue' ? ' active-ue' : '');
    });
  } else if (name === 'verify') {
    currentVerifyFilter = 'all';
    document.querySelectorAll('.sidebar [data-filter]').forEach(function(el) {
      el.className = 'sidebar-item' + (el.dataset.filter === 'all' ? ' active' : '');
    });
    document.querySelectorAll('#mobileSidebar [data-mfilter]').forEach(function(el) {
      el.className = 'mob-item' + (el.dataset.mfilter === 'all' ? ' active' : '');
    });
    if (typeof hideVerifyPanel === 'function') hideVerifyPanel();
    if (typeof setBulkContext === 'function') setBulkContext('general');
  }
  // routes/dispatch/expenses — це списки навігації, власного «фільтра списку
  // посилок» не тримають, тож скидати нічого. Активний маршрут (activeRouteIdx)
  // скидається в backToParcels, не тут.
}

// Відкриває одну секцію і згортає решту. Якщо попередня секція існувала і
// відрізнялась — скидаємо її фільтри. name=null → згорнути всі (режим архів/зведення).
function setActiveSidebarSection(name) {
  var prev = _activeSidebarSection;
  if (prev && prev !== name) {
    _resetSidebarSectionFilter(prev);
  }
  _activeSidebarSection = name;
  // Desktop
  _SIDEBAR_SECTIONS.forEach(function(s) {
    var sec = document.querySelector('.sidebar .sidebar-section[data-section="' + s + '"]');
    if (!sec) return;
    var body = sec.querySelector('.sidebar-section-body');
    var toggle = sec.querySelector('.toggle');
    if (body) body.classList.toggle('hidden', s !== name);
    if (toggle) toggle.classList.toggle('open', s === name);
  });
  // Mobile
  _SIDEBAR_SECTIONS.forEach(function(s) {
    var sec = document.querySelector('#mobileSidebar .mob-section[data-section="' + s + '"]');
    if (!sec) return;
    var body = sec.querySelector('.mob-section-body');
    var toggle = sec.querySelector('.mob-toggle');
    if (body) body.classList.toggle('mob-collapsed', s !== name);
    if (toggle) toggle.classList.toggle('open', s === name);
  });
  // Якщо фільтр скинувся і ми на головному списку — перерендеримо.
  if (prev && prev !== name && currentView === 'parcels') {
    if (typeof renderCards === 'function') renderCards();
  }
}

function toggleMobSection(titleEl) {
  var sec = titleEl.closest('.mob-section');
  var name = sec && sec.getAttribute('data-section');
  if (!name) {
    // Fallback для секцій без data-section (Зведення/Архів — single items)
    var body = titleEl.nextElementSibling;
    var toggle = titleEl.querySelector('.mob-toggle');
    if (body) body.classList.toggle('mob-collapsed');
    if (toggle) toggle.classList.toggle('open');
    return;
  }
  var body = sec.querySelector('.mob-section-body');
  var isCollapsed = body && body.classList.contains('mob-collapsed');
  if (isCollapsed) {
    // Розгортаємо → інші згортаються автоматично + фільтри попередньої скидаються.
    setActiveSidebarSection(name);
  } else {
    // Вже відкрита — класичний toggle: згортаємо лише її (юзер явно хоче закрити).
    if (body) body.classList.add('mob-collapsed');
    var tg = titleEl.querySelector('.mob-toggle');
    if (tg) tg.classList.remove('open');
    _activeSidebarSection = null;
  }
}

function toggleSection(header) {
  var sec = header.closest('.sidebar-section');
  var name = sec && sec.getAttribute('data-section');
  if (!name) {
    // Fallback для секцій без data-section
    var body0 = header.nextElementSibling;
    var tg0 = header.querySelector('.toggle');
    if (body0) body0.classList.toggle('hidden');
    if (tg0) tg0.classList.toggle('open');
    return;
  }
  var body = sec.querySelector('.sidebar-section-body');
  var isCollapsed = body && body.classList.contains('hidden');
  if (isCollapsed) {
    setActiveSidebarSection(name);
  } else {
    if (body) body.classList.add('hidden');
    var tg = header.querySelector('.toggle');
    if (tg) tg.classList.remove('open');
    _activeSidebarSection = null;
  }
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
  // Verify search panel only makes sense inside the parcels list; hide it
  // when switching to route/dispatch/etc., re-show on return if user was in
  // Перевірка before.
  const vsp = document.getElementById('verifySearchPanel');
  if (vsp) vsp.style.display = (view === 'parcels' && isVerifyActive) ? 'block' : 'none';
  // Bulk-menu: route view → Маршрут category, parcels view → keep current
  // (verify if user is in Перевірка, else general).
  if (view !== 'parcels') setBulkContext('route');
  else setBulkContext(isVerifyActive ? 'verify' : 'general');
  renderRouteSidebar();
}

function backToParcels() {
  activeRouteIdx = null;
  switchMainView('parcels');
  // Повернення у список посилок → меню згорнуте повністю (як при першому
  // заході у CRM). Оператор сам клацне заголовок коли треба.
  if (typeof setActiveSidebarSection === 'function') setActiveSidebarSection(null);
  renderCards();
}

// ===== ROUTE HELPERS =====
var allRouteSheets = [];
function showConfirm(msg, cb) { if (confirm(msg)) cb(true); else cb(false); }
function formatTripDate(d) { if (!d) return '—'; var s = String(d); if (s.match(/^\d{4}-\d{2}-\d{2}/)) { var p = s.split('-'); return p[2].substring(0,2) + '.' + p[1] + '.' + p[0]; } return s; }
function getDirectionCode(dir) { var d = (dir || '').toLowerCase(); return (d.indexOf('єв') === 0 || d.indexOf('eu') === 0 || d.indexOf('європа') === 0) ? 'eu-ua' : 'ua-eu'; }
function openMessengerPopup(phone, smartId) { var clean = (phone || '').replace(/[^+\d]/g, ''); var grid = document.getElementById('messengerGrid'); if (!grid) return; grid.innerHTML = '<a href="viber://chat?number=' + clean + '" style="display:block;padding:10px;margin:4px 0;background:#7360f2;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;text-align:center;">Viber</a><a href="https://t.me/' + clean + '" style="display:block;padding:10px;margin:4px 0;background:#0088cc;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;text-align:center;">Telegram</a><a href="https://wa.me/' + clean.replace('+','') + '" style="display:block;padding:10px;margin:4px 0;background:#25d366;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;text-align:center;">WhatsApp</a>'; document.getElementById('messengerOverlay').classList.add('show'); }

// Відкриває адресу у Google Maps (пошук за текстом). Викликається з кнопки 🗺
// біля адреси на картці ліда. Ескейпимо тут, бо у onclick передали вже
// escaped string (single-quote), проте на всяк випадок — ще раз санітайз.
function openMap(address) {
  if (!address) return;
  const clean = String(address).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  window.open('https://www.google.com/maps/search/' + encodeURIComponent(clean), '_blank');
}
function closeMessengerPopup() { var el = document.getElementById('messengerOverlay'); if (el) el.classList.remove('show'); }
function promptDeleteLinkedSheets(baseName) { if (activeRouteIdx !== null) activeRouteIdx = null; loadRoutes(); }

// ── ВИДАЛИТИ маршрут ─────────────────────────────────────────
// За домовленістю з продакт-овнером: видалення маршруту = архівувати ВСІ
// посилки в ньому + видалити сам route placeholder (як і в passenger-crm).
async function confirmDeleteRoute(idx) {
    if (idx === null || idx === undefined || idx < 0 || !routes[idx]) {
        showToast('Оберіть маршрут');
        return;
    }
    const sheet = routes[idx];
    const name = sheet.sheetName || '';
    const rawRows = sheet.rows || [];
    const pkgRows = rawRows.filter(r => !(r['Тип запису'] || '').includes('Пасажир'));
    const paxCount = rawRows.length - pkgRows.length;

    const msg = 'Видалити маршрут «' + name + '»?\n\n' +
        'Усі посилки (' + pkgRows.length + ') потраплять в архів.' +
        (paxCount ? '\nПасажирів (' + paxCount + ') пропустимо — їх архівує passenger-crm.' : '');

    showConfirm(msg, async function(yes) {
        if (!yes) return;
        showLoader('Архівуємо посилки маршруту...');
        try {
            const pkgIds = pkgRows.map(r => r['PKG_ID'] || r['PAX_ID']).filter(Boolean);
            if (pkgIds.length) {
                const arc = await apiPost('deleteParcel', {
                    pkg_ids: pkgIds,
                    reason: 'Видалення маршруту ' + name,
                    archived_by: 'CRM'
                });
                if (!arc.ok) {
                    hideLoader();
                    showToast('❌ Архів: ' + (arc.error || 'помилка'));
                    return;
                }
            }
            const res = await apiPost('deleteRoute', { name: name });
            hideLoader();
            if (!res.ok) {
                showToast('❌ ' + (res.error || 'Помилка видалення'));
                return;
            }
            pkgIds.forEach(pid => {
                const m = allData.find(p => p['PKG_ID'] === pid);
                if (m) m['Статус CRM'] = 'Архів';
            });
            activeRouteIdx = null;
            _showingExpenses = false;
            updateRouteDashButtons();
            showToast('✅ Маршрут «' + name + '» видалено, посилок в архіві: ' + pkgIds.length);
            loadRoutes(true);
            updateCounters();
        } catch (e) {
            hideLoader();
            showToast('❌ Помилка: ' + e.message);
        }
    });
}
function setCount(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
function refreshRouteView() { if (activeRouteIdx !== null) openRoute(activeRouteIdx, true); }
function openRouteView(idx) { openRoute(idx); }
// ── Архівувати лід маршруту (справжній архів, не delete-from-sheet) ──
// Пасажирів у cargo-crm архівувати не можна (чужий домен, див. passenger-crm),
// показуємо юзеру інструкцію замість тихого видалення.
async function archiveFromRoute(rteId, sheetName, name) {
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    const row = (sheet.rows || []).find(r => r['RTE_ID'] === rteId);
    if (!row) return;
    const isPax = (row['Тип запису'] || '').includes('Пасажир');
    if (isPax) {
        showToast('👤 Пасажирів архівує passenger-crm. Перейдіть у вкладку пасажирів.', 'warning');
        return;
    }
    const pkgId = row['PKG_ID'] || row['PAX_ID'] || '';
    if (!pkgId) { showToast('❌ Немає PKG_ID для архіву', 'error'); return; }
    showConfirm('Архівувати «' + name + '» і прибрати з маршруту?', async (yes) => {
        if (!yes) return;
        showLoader('Архівування...');
        const res = await apiPost('deleteParcel', { pkg_id: pkgId, reason: 'Архів з маршруту', archived_by: 'CRM' });
        hideLoader();
        if (res.ok) {
            sheet.rows = (sheet.rows || []).filter(r => r['RTE_ID'] !== rteId);
            const mainItem = allData.find(p => p['PKG_ID'] === pkgId);
            if (mainItem) mainItem['Статус CRM'] = 'Архів';
            routeSelectedIds.delete(rteId);
            showToast('✅ Архівовано і прибрано з маршруту');
            renderRoutes();
            updateCounters();
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

// Bulk-архівація з маршруту: пасажирів пропускаємо (з тостом), посилки
// реально архівуємо через deleteParcel (який тепер і з routes чистить).
async function routeBulkArchive() {
    if (routeSelectedIds.size === 0) return;
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    const ids = Array.from(routeSelectedIds);
    const rows = ids.map(rId => (sheet.rows || []).find(r => r['RTE_ID'] === rId)).filter(Boolean);
    const paxRows = rows.filter(r => (r['Тип запису'] || '').includes('Пасажир'));
    const pkgRows = rows.filter(r => !(r['Тип запису'] || '').includes('Пасажир'));
    if (pkgRows.length === 0) {
        showToast('👤 Пасажирів архівує passenger-crm. Перейдіть у вкладку пасажирів.', 'warning');
        return;
    }
    const msg = 'Архівувати ' + pkgRows.length + ' посилок?' +
        (paxRows.length ? ' (пасажирів у виділенні: ' + paxRows.length + ' — їх пропустимо)' : '');
    showConfirm(msg, async (yes) => {
        if (!yes) return;
        showLoader('Архівування...');
        const pkgIds = pkgRows.map(r => r['PKG_ID'] || r['PAX_ID']).filter(Boolean);
        const res = await apiPost('deleteParcel', { pkg_ids: pkgIds, reason: 'Архів з маршруту', archived_by: 'CRM' });
        hideLoader();
        if (res.ok) {
            const archivedRteIds = new Set(pkgRows.map(r => r['RTE_ID']));
            sheet.rows = (sheet.rows || []).filter(r => !archivedRteIds.has(r['RTE_ID']));
            pkgIds.forEach(pid => {
                const mainItem = allData.find(p => p['PKG_ID'] === pid);
                if (mainItem) mainItem['Статус CRM'] = 'Архів';
            });
            archivedRteIds.forEach(id => routeSelectedIds.delete(id));
            _routeToolbarForceOpen = false;
            updateRouteBulkToolbar();
            showToast('✅ Архівовано: ' + pkgIds.length + (paxRows.length ? ' (пасажирів пропущено: ' + paxRows.length + ')' : ''));
            renderRoutes();
            updateCounters();
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

function routeBulkDeleteFull() { routeBulkDeleteFromRoute(); }

// ── ОПТИМІЗАЦІЯ ─────────────────────────────────────────────
// Greedy без обмежень: геокодуємо адресу отримувача, шукаємо найкоротший
// nearest-neighbour маршрут від Ужгорода (або першої точки), зберігаємо
// порядок у sheet.pickupOrder + НЕ архівує.
window.mapsApiReady = false;
function initMapsAPI() {
    try {
        window.mapsGeocoder = new google.maps.Geocoder();
        window.mapsDirections = new google.maps.DirectionsService();
        window.mapsApiReady = true;
    } catch(e) { console.warn('Maps API init failed:', e); }
}

function _optGeocodeOne(address) {
    return new Promise(function(resolve) {
        if (!window.mapsGeocoder) return resolve(null);
        var settled = false;
        var t = setTimeout(function(){ if (!settled) { settled = true; resolve(null); } }, 10000);
        try {
            window.mapsGeocoder.geocode({ address: address }, function(results, status){
                if (settled) return; settled = true; clearTimeout(t);
                if (status === 'OK' && results && results[0]) {
                    resolve({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
                } else resolve(null);
            });
        } catch(e) { if (!settled) { settled = true; clearTimeout(t); resolve(null); } }
    });
}
function _optHaversine(c1, c2) {
    var R = 6371, dLat = (c2.lat - c1.lat) * Math.PI / 180;
    var dLng = (c2.lng - c1.lng) * Math.PI / 180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(c1.lat*Math.PI/180) * Math.cos(c2.lat*Math.PI/180) *
            Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function _optNearestNeighbour(points, startCoords) {
    var n = points.length;
    if (n <= 1) return points.map(function(_, i){ return i; });
    var visited = new Array(n).fill(false);
    var tour = [];
    var cur = startCoords;
    for (var step = 0; step < n; step++) {
        var best = -1, bestDist = Infinity;
        for (var j = 0; j < n; j++) {
            if (visited[j]) continue;
            var d = _optHaversine(cur, points[j].coords);
            if (d < bestDist) { bestDist = d; best = j; }
        }
        if (best === -1) break;
        tour.push(best); visited[best] = true; cur = points[best].coords;
    }
    return tour;
}

async function optimizeRouteOrder() {
    if (activeRouteIdx === null || !routes[activeRouteIdx]) {
        showToast('Оберіть маршрут'); return;
    }
    if (!window.mapsApiReady || !window.mapsGeocoder) {
        showToast('Google Maps API ще не завантажено. Зачекайте 2-3 сек.');
        return;
    }
    var sheet = routes[activeRouteIdx];
    if (!sheet.rows) {
        showLoader('Завантаження маршруту...');
        try { await loadRouteSheetData(activeRouteIdx, true); }
        catch (e) { hideLoader(); showToast('❌ ' + e.message); return; }
        hideLoader();
    }
    var rows = sheet.rows || [];
    if (rows.length < 2) { showToast('Менше 2 точок — нема що оптимізувати'); return; }

    // Адреса для геокодування: для посилок — адреса отримувача,
    // для пасажирів (якщо є в маршруті) — адреса прибуття.
    var withAddr = rows.map(function(r) {
        var addr = r['Адреса отримувача'] || r['Адреса прибуття'] || r['Адреса доставки'] || '';
        var leadId = r['PKG_ID'] || r['PAX_ID'] || '';
        return { leadId: leadId, address: String(addr).trim() };
    }).filter(function(p) { return p.leadId && p.address; });

    if (withAddr.length === 0) {
        showToast('У жодного запису немає адреси для оптимізації');
        return;
    }

    showLoader('📍 Геокодування ' + withAddr.length + ' адрес...');
    var geocoded = [];
    var failed = [];
    for (var i = 0; i < withAddr.length; i++) {
        var c = await _optGeocodeOne(withAddr[i].address);
        if (c) { withAddr[i].coords = c; geocoded.push(withAddr[i]); }
        else failed.push(withAddr[i]);
        if (i < withAddr.length - 1) await new Promise(function(r){ setTimeout(r, 150); });
    }
    if (geocoded.length === 0) {
        hideLoader();
        showToast('❌ Жодну адресу не вдалось геокодувати');
        return;
    }

    showLoader('🗺️ Розрахунок порядку...');
    // Старт — Ужгород за замовчуванням (можна винести в settings пізніше).
    var startCoords = { lat: 48.6209, lng: 22.2879 };
    var tour = _optNearestNeighbour(geocoded, startCoords);
    var orderedIds = tour.map(function(idx){ return geocoded[idx].leadId; });
    // Додати ті, що не вдалось геокодувати — у кінець (щоб не зникали).
    failed.forEach(function(p){ if (orderedIds.indexOf(p.leadId) === -1) orderedIds.push(p.leadId); });

    showLoader('💾 Збереження порядку...');
    try {
        var res = await apiPost('setRouteOrder', { sheetName: sheet.sheetName, pickup_order: orderedIds });
        hideLoader();
        if (!res || !res.ok) { showToast('❌ ' + ((res && res.error) || 'Не вдалося зберегти')); return; }
        sheet.pickupOrder = orderedIds;
        renderRoutes();
        var msg = '✅ Маршрут оптимізовано: ' + geocoded.length + ' точок';
        if (failed.length) msg += ' (без адреси: ' + failed.length + ')';
        showToast(msg);
    } catch(e) {
        hideLoader();
        showToast('❌ ' + e.message);
    }
}

// ── SORT MODE (drag-and-drop) ────────────────────────────────
function _takeRouteSortSnapshot(sheet) {
    return { order: (sheet.pickupOrder || []).slice() };
}
function _rollbackRouteSort(sheet, snap) {
    if (!snap || !sheet) return;
    sheet.pickupOrder = (snap.order || []).slice();
}
function _sortBeforeUnloadHandler(e) {
    if (_sortDirty) {
        e.preventDefault();
        e.returnValue = 'У вас незбережені зміни порядку в маршруті. Закрити сторінку?';
        return e.returnValue;
    }
}
function updateSortBanner() {
    var el = document.getElementById('routeSortBannerLabel');
    if (!el) return;
    el.textContent = '🔧 Режим сортування' + (_sortDirty ? ' ●' : '');
}

function initRouteSortable() {
    var list = document.getElementById('routesList');
    if (!list) return;
    if (!routeSortModeActive) {
        if (_routeSortableInstance && typeof _routeSortableInstance.destroy === 'function') {
            try { _routeSortableInstance.destroy(); } catch(_){}
            _routeSortableInstance = null;
        }
        list.classList.remove('sort-mode-on');
        return;
    }
    if (typeof Sortable === 'undefined') {
        console.warn('SortableJS not loaded — drag-and-drop disabled');
        return;
    }
    if (_routeSortableInstance && typeof _routeSortableInstance.destroy === 'function') {
        try { _routeSortableInstance.destroy(); } catch(_){}
        _routeSortableInstance = null;
    }
    list.classList.add('sort-mode-on');
    _routeSortableInstance = Sortable.create(list, {
        animation: 150,
        draggable: '.route-card',
        ghostClass: 'route-card-ghost',
        chosenClass: 'route-card-chosen',
        dragClass: 'route-card-drag',
        delay: 350,
        delayOnTouchOnly: true,
        touchStartThreshold: 8,
        onEnd: handleRouteDrop
    });
}

function handleRouteDrop() {
    try {
        if (!routeSortModeActive) return;
        if (activeRouteIdx === null || !routes[activeRouteIdx]) return;
        var sheet = routes[activeRouteIdx];
        var rawRows = sheet.rows || [];
        var oldFull = sortRouteRowsByStoredOrder(rawRows, sheet.pickupOrder || []);
        var oldIds = oldFull.map(getRouteRowLeadId).filter(Boolean);

        var list = document.getElementById('routesList');
        if (!list) return;
        var newVisibleIds = [];
        list.querySelectorAll('.route-card[data-lead-id]').forEach(function(c){
            var id = c.getAttribute('data-lead-id');
            if (id) newVisibleIds.push(id);
        });
        if (!newVisibleIds.length) return;

        var visibleSet = new Set(newVisibleIds);
        var newFull = [];
        var v = 0;
        for (var i = 0; i < oldIds.length; i++) {
            var oid = oldIds[i];
            if (visibleSet.has(oid)) { newFull.push(newVisibleIds[v] || oid); v++; }
            else newFull.push(oid);
        }
        if (newFull.length === oldIds.length && newFull.every(function(id, i){ return id === oldIds[i]; })) return;

        sheet.pickupOrder = newFull;
        _sortDirty = true;
        updateSortBanner();
    } catch (e) {
        console.error('handleRouteDrop error:', e);
        showToast('❌ Помилка drag-and-drop: ' + e.message);
    }
}

async function enterRouteSortMode() {
    if (routeSortModeActive) return;
    if (activeRouteIdx === null || !routes[activeRouteIdx]) {
        showToast('Оберіть маршрут');
        return;
    }
    var sheet = routes[activeRouteIdx];
    if (!sheet.rows) {
        showLoader('Завантаження маршруту...');
        try { await loadRouteSheetData(activeRouteIdx, true); }
        catch (e) { hideLoader(); showToast('❌ ' + e.message); return; }
        hideLoader();
    }
    if ((sheet.rows || []).length < 2) {
        showToast('У маршруті менше 2 записів — нема що сортувати');
        return;
    }
    _sortSnapshot = _takeRouteSortSnapshot(sheet);
    _sortDirty = false;
    routeSortModeActive = true;
    document.body.classList.add('route-sort-active');
    window.addEventListener('beforeunload', _sortBeforeUnloadHandler);
    var banner = document.getElementById('routeSortBanner');
    var actionBar = document.getElementById('routeSortActionBar');
    if (banner) banner.style.display = 'flex';
    if (actionBar) actionBar.style.display = 'flex';
    updateSortBanner();
    renderRoutes();
    showToast('🔧 Режим сортування активний');
}

function _exitSortModeInternal() {
    routeSortModeActive = false;
    _sortSnapshot = null;
    _sortDirty = false;
    document.body.classList.remove('route-sort-active');
    window.removeEventListener('beforeunload', _sortBeforeUnloadHandler);
    var banner = document.getElementById('routeSortBanner');
    var actionBar = document.getElementById('routeSortActionBar');
    if (banner) banner.style.display = 'none';
    if (actionBar) actionBar.style.display = 'none';
    if (_routeSortableInstance && typeof _routeSortableInstance.destroy === 'function') {
        try { _routeSortableInstance.destroy(); } catch(_){}
        _routeSortableInstance = null;
    }
    var list = document.getElementById('routesList');
    if (list) list.classList.remove('sort-mode-on');
}

async function saveRouteSortChanges() {
    if (!routeSortModeActive) return;
    if (activeRouteIdx === null || !routes[activeRouteIdx]) {
        _exitSortModeInternal(); renderRoutes(); return;
    }
    var sheet = routes[activeRouteIdx];
    if (!_sortDirty) {
        _exitSortModeInternal(); renderRoutes();
        showToast('Режим сортування вимкнено (без змін)');
        return;
    }
    var orderToSave = sheet.pickupOrder || [];
    showConfirm(
        'Зберегти новий порядок у маршруті «' + sheet.sheetName + '»?\n\nПорядок побачать водії після синхронізації.',
        async function(yes) {
            if (!yes) return;
            showLoader('Збереження порядку...');
            try {
                var res = await apiPost('setRouteOrder', { sheetName: sheet.sheetName, pickup_order: orderToSave });
                hideLoader();
                if (!res || !res.ok) {
                    showToast('❌ ' + ((res && res.error) || 'Не вдалося зберегти'));
                    return;
                }
                _exitSortModeInternal();
                renderRoutes();
                showToast('✅ Порядок збережено');
            } catch (e) {
                hideLoader();
                showToast('❌ ' + e.message);
            }
        }
    );
}

function cancelRouteSortChanges() {
    if (!routeSortModeActive) return;
    var sheet = routes[activeRouteIdx];
    if (!_sortDirty) {
        _exitSortModeInternal(); renderRoutes();
        showToast('Режим сортування вимкнено');
        return;
    }
    showConfirm(
        'Скасувати всі зміни порядку?\n\nНезбережений порядок буде втрачено.',
        function(yes) {
            if (!yes) return;
            if (sheet && _sortSnapshot) _rollbackRouteSort(sheet, _sortSnapshot);
            _exitSortModeInternal();
            renderRoutes();
            showToast('↩️ Зміни порядку скасовано');
        }
    );
}

// ===========================================================
// ROUTE DASHBOARD — ВИТРАТИ / СОРТУВАТИ / ОПТИМІЗУВАТИ / ВИДАЛИТИ
// Портовано з passenger-crm (Passengers.js) для UX-консистентності.
// Адаптовано: один режим сортування (без pickup/dropoff), бо посилка має
// одну адресу отримувача.
// ===========================================================

var _showingExpenses = false;
var routeSortModeActive = false;
var _routeSortableInstance = null;
var _sortDirty = false;
var _sortSnapshot = null;
var CATEGORY_LABELS = { fuel:'⛽ Бензин', food:'🍔 Їжа', parking:'🅿️ Паркування', toll:'🛣️ Толл', fine:'⚠️ Штраф', customs:'🏛️ Митниця', topUp:'📱 Поповнення', other:'📝 Інше', tips:'💵 Чайові' };
var CATEGORY_COLORS = { fuel:'#f59e0b', food:'#f97316', parking:'#3b82f6', toll:'#8b5cf6', fine:'#ef4444', customs:'#10b981', topUp:'#06b6d4', other:'#6b7280', tips:'#ec4899' };

function updateRouteDashButtons() {
    var btnExp = document.getElementById('btnRouteExpenses');
    var btnBack = document.getElementById('btnRouteBack');
    if (btnExp) btnExp.style.display = _showingExpenses ? 'none' : '';
    if (btnBack) btnBack.style.display = _showingExpenses ? '' : 'none';
}

// ── ВИТРАТИ ─────────────────────────────────────────────────
function toggleRouteExpensesView() {
    if (_showingExpenses) {
        _showingExpenses = false;
        updateRouteDashButtons();
        renderRoutes();
        return;
    }
    if (activeRouteIdx === null || !routes[activeRouteIdx]) {
        showToast('Оберіть маршрут');
        return;
    }
    _showingExpenses = true;
    updateRouteDashButtons();
    loadAndRenderExpenses(routes[activeRouteIdx].sheetName);
}

function _expCategoryFromGasRow(gasRow) {
    // Витрати з driver-crm приходять як один рядок з кількома сумами в різних
    // полях (Бензин/Їжа/Паркування/...). Розгортаємо у плоский масив записів.
    var entries = [];
    var cur = gasRow['Валюта витрат'] || 'CHF';
    var date = gasRow['Дата рейсу'] || gasRow['Дата створення'] || '';
    var driver = gasRow['Водій'] || '';
    var note = gasRow['Примітка'] || '';
    var map = {
        fuel: 'Бензин', food: 'Їжа', parking: 'Паркування', toll: 'Толл на дорозі',
        fine: 'Штраф', customs: 'Митниця', topUp: 'Топап рахунку', other: 'Інше'
    };
    for (var key in map) {
        var v = parseFloat(gasRow[map[key]] || 0);
        if (v > 0) entries.push({
            category: key,
            amount: v,
            currency: cur,
            description: key === 'other' ? (gasRow['Опис іншого'] || note) : '',
            dateTrip: date,
            driver: driver
        });
    }
    var tips = parseFloat(gasRow['Чайові'] || 0);
    if (tips > 0) entries.push({
        category: 'tips', amount: tips,
        currency: gasRow['Валюта чайових'] || cur,
        description: '', dateTrip: date, driver: driver
    });
    return entries;
}

async function loadAndRenderExpenses(sheetName) {
    var list = document.getElementById('routesList');
    var filtersBar = document.getElementById('routeFiltersBar');
    if (filtersBar) filtersBar.style.display = 'none';
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);"><div style="font-size:30px;margin-bottom:8px;">⏳</div><div style="font-size:13px;">Завантаження витрат...</div></div>';

    try {
        var res = await apiPost('getExpensesSheet', { sheetName: sheetName });
        if (!res.ok) {
            list.innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">❌ ' + (res.error || 'Помилка') + '</div>';
            return;
        }
        var gasRows = (res.data && res.data.rows) || res.rows || [];
        var items = [];
        var advance = { cash: 0, card: 0, cashCurrency: 'CHF', cardCurrency: 'CHF' };
        gasRows.forEach(function(g) {
            items.push.apply(items, _expCategoryFromGasRow(g));
            var ac = parseFloat(g['Аванс готівка'] || 0);
            var ak = parseFloat(g['Аванс картка'] || 0);
            if (ac > 0) { advance.cash += ac; advance.cashCurrency = g['Валюта авансу готівка'] || advance.cashCurrency; }
            if (ak > 0) { advance.card += ak; advance.cardCurrency = g['Валюта авансу картка'] || advance.cardCurrency; }
        });

        var byCurrency = {};
        items.forEach(function(e) { byCurrency[e.currency || 'CHF'] = (byCurrency[e.currency || 'CHF'] || 0) + e.amount; });

        var html = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">';
        if (advance.cash > 0 || advance.card > 0) {
            html += '<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 22px;flex:1;min-width:140px;">';
            html += '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">💳 Аванс</div>';
            if (advance.cash > 0) html += '<div style="font-size:22px;font-weight:800;">' + advance.cash + ' <span style="font-size:13px;color:var(--text-secondary);">' + advance.cashCurrency + '</span></div>';
            if (advance.card > 0) html += '<div style="font-size:22px;font-weight:800;">' + advance.card + ' <span style="font-size:13px;color:var(--text-secondary);">' + advance.cardCurrency + '</span></div>';
            html += '</div>';
        }

        var curEntries = Object.entries(byCurrency);
        html += '<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 22px;flex:1;min-width:140px;">';
        html += '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">💰 Витрачено</div>';
        if (curEntries.length === 0) html += '<div style="font-size:22px;font-weight:800;color:var(--text-secondary);">0</div>';
        else curEntries.forEach(function(e) {
            html += '<div style="font-size:22px;font-weight:800;">' + e[1].toFixed(2) + ' <span style="font-size:13px;color:var(--text-secondary);">' + e[0] + '</span></div>';
        });
        html += '</div>';

        if (advance.cash > 0 || advance.card > 0) {
            var advTotal = advance.cash + advance.card;
            var advCur = advance.cashCurrency || advance.cardCurrency || 'CHF';
            var spent = byCurrency[advCur] || 0;
            var remaining = advTotal - spent;
            var ok = remaining >= 0;
            html += '<div style="background:' + (ok ? '#f0fdf4' : '#fef2f2') + ';border:1px solid ' + (ok ? '#bbf7d0' : '#fecaca') + ';border-radius:14px;padding:18px 22px;flex:1;min-width:140px;">';
            html += '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">📊 Залишок</div>';
            html += '<div style="font-size:22px;font-weight:800;color:' + (ok ? '#16a34a' : '#dc2626') + ';">' + remaining.toFixed(2) + ' <span style="font-size:13px;color:var(--text-secondary);">' + advCur + '</span></div>';
            html += '</div>';
        }

        html += '<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 22px;flex:1;min-width:100px;text-align:center;">';
        html += '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">📋 Записів</div>';
        html += '<div style="font-size:22px;font-weight:800;">' + items.length + '</div>';
        html += '</div></div>';

        if (items.length === 0) {
            html += '<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:14px;">Витрат ще немає</div>';
        } else {
            html += '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:10px;">Записи витрат</div>';
            items.forEach(function(e) {
                var color = CATEGORY_COLORS[e.category] || '#6b7280';
                var label = CATEGORY_LABELS[e.category] || e.category;
                var icon = label.split(' ')[0];
                var name = label.split(' ').slice(1).join(' ');
                html += '<div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;">';
                html += '<div style="width:42px;height:42px;border-radius:10px;background:' + color + '20;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">' + icon + '</div>';
                html += '<div style="flex:1;min-width:0;">';
                html += '<div style="font-size:14px;font-weight:700;">' + name + '</div>';
                if (e.description) html += '<div style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + e.description + '</div>';
                html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' + (e.dateTrip || '') + (e.driver ? ' · ' + e.driver : '') + '</div>';
                html += '</div>';
                html += '<div style="text-align:right;flex-shrink:0;">';
                html += '<div style="font-size:18px;font-weight:800;">' + e.amount + '</div>';
                html += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);">' + (e.currency || 'CHF') + '</div>';
                html += '</div></div>';
            });
        }

        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">❌ Помилка: ' + e.message + '</div>';
    }
}

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
            // Збережений порядок stops (з placeholder-рядка routes).
            sheet.pickupOrder = Array.isArray(res.data.pickup_order) ? res.data.pickup_order : [];
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
    // Вхід у маршрут — це перехід у секцію «Маршрути»: інші згортаються,
    // фільтри Напрямок/Перевірка повертаються до дефолту.
    setActiveSidebarSection('routes');
    // При перемиканні маршруту скидаємо фільтр дат — у новому свої дати.
    if (activeRouteIdx !== idx) routeDateFilter = null;
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
// Helper: «Дата отримання» живе у таблиці `packages`, а не у `routes`
// (route-row тримає тільки snapshot базових полів). Шукаємо оригінал
// у allData за PKG_ID і читаємо дату звідти; якщо нема — порожньо.
function _getRouteRowReceivedDate(r) {
    const leadId = (r && (r['PKG_ID'] || r['PAX_ID'])) || '';
    if (!leadId) return '';
    const p = allData.find(x => (x['PKG_ID'] || '') === leadId);
    if (!p) return '';
    return formatTripDate(p['Дата отримання'] || '');
}

function getFilteredRouteRows(rows) {
    let filtered = rows;
    if (routeTypeFilter === 'pax') filtered = filtered.filter(r => (r['Тип запису'] || '').includes('Пасажир'));
    if (routeTypeFilter === 'parcel') filtered = filtered.filter(r => (r['Тип запису'] || '').includes('Посилк'));
    if (routeStatusFilter !== 'all') filtered = filtered.filter(r => (r['Статус'] || '') === routeStatusFilter);
    if (routePayFilter !== 'all') filtered = filtered.filter(r => (r['Статус оплати'] || '') === routePayFilter);
    if (routeDateFilter) {
        filtered = filtered.filter(r => _getRouteRowReceivedDate(r) === routeDateFilter);
    }
    return filtered;
}

// Унікальні «Дати отримання» серед лідів маршруту — для чіпів дат візиту.
// У UA→EU це коли привозимо отримувачу, у EU→UA — коли забираємо у відправника;
// з точки зору водія — «дата візиту на адресу в Європі», тому підпис нейтральний.
function getRouteUniqueDates(rows) {
    const set = new Set();
    (rows || []).forEach(r => {
        const d = _getRouteRowReceivedDate(r);
        if (d && d !== '—') set.add(d);
    });
    return Array.from(set).sort((a, b) => {
        const [da, ma, ya] = a.split('.');
        const [db, mb, yb] = b.split('.');
        return (ya + ma + da).localeCompare(yb + mb + db);
    });
}

function setRouteDateFilter(dateStr) {
    // Повторний клік по активному чіпу знімає фільтр.
    routeDateFilter = (routeDateFilter === dateStr) ? null : dateStr;
    renderRoutes();
}

// ── Сортування рядків маршруту за збереженим порядком (масив PKG_ID) ──
function getRouteRowLeadId(r) { return r && (r['PKG_ID'] || r['PAX_ID'] || ''); }
function sortRouteRowsByStoredOrder(rows, orderIds) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return rows.slice();
    const idSet = new Set(orderIds);
    const byId = new Map();
    for (const r of rows) {
        const id = getRouteRowLeadId(r);
        if (id && !byId.has(id)) byId.set(id, r);
    }
    const ordered = [];
    const used = new Set();
    for (const id of orderIds) {
        if (byId.has(id) && !used.has(id)) { ordered.push(byId.get(id)); used.add(id); }
    }
    for (const r of rows) {
        const id = getRouteRowLeadId(r);
        if (!id || !idSet.has(id) || !used.has(id)) {
            if (id && used.has(id)) continue;
            ordered.push(r);
            if (id) used.add(id);
        }
    }
    return ordered;
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

    // Якщо зараз показуємо витрати — не перерендерювати картки маршруту
    // (інакше експенс-блок зникне після першого оновлення).
    if (_showingExpenses) {
        if (headerBar) headerBar.style.display = 'block';
        if (headerEmpty) headerEmpty.style.display = 'none';
        return;
    }

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
    const rawRows = sheet.rows || [];
    const name = (sheet.sheetName || 'Маршрут');

    // Застосувати збережений порядок ДО фільтрації (фільтри лише ховають).
    const rows = sortRouteRowsByStoredOrder(rawRows, sheet.pickupOrder || []);

    const paxCount = rawRows.filter(r => (r['Тип запису'] || '').includes('Пасажир')).length;
    const parcelCount = rawRows.filter(r => (r['Тип запису'] || '').includes('Посилк')).length;

    // Show route header bar + filters
    if (headerBar) headerBar.style.display = 'block';
    if (headerEmpty) headerEmpty.style.display = 'none';
    if (filtersBar) filtersBar.style.display = 'block';
    if (title) title.textContent = '🚐 ' + name;
    if (subtitle) subtitle.textContent = '👤 ' + paxCount + ' пасажирів · 📦 ' + parcelCount + ' посилок · ' + rawRows.length + ' записів';

    // Чіпи дат візиту — над списком. Унікальні 'Дата отримання' беруться
    // з rawRows (до інших фільтрів), щоб всі наявні дати завжди були видно.
    const uniqueDates = getRouteUniqueDates(rawRows);
    const filtered = getFilteredRouteRows(rows);
    let html = '';

    if (uniqueDates.length > 0) {
        html += '<div class="route-date-chips">';
        html += '<span class="route-date-chips-label">📅 Дата візиту:</span>';
        uniqueDates.forEach(d => {
            const active = (routeDateFilter === d);
            const cnt = rawRows.filter(r => _getRouteRowReceivedDate(r) === d).length;
            html += '<button class="route-date-chip' + (active ? ' active' : '') + '" ' +
                'onclick="setRouteDateFilter(\'' + d + '\')" ' +
                'title="' + (active ? 'Зняти фільтр' : 'Показати тільки ' + d) + '">' +
                d + ' <span class="route-date-chip-cnt">' + cnt + '</span>' +
                (active ? ' ×' : '') +
                '</button>';
        });
        html += '</div>';
    }

    if (filtered.length === 0) {
        html += '<div style="padding:40px;text-align:center;color:var(--text-secondary);font-size:13px;">' +
            (rawRows.length === 0 ? 'Маршрут порожній — перенесіть посилки з головного списку' : 'Немає записів за обраним фільтром') + '</div>';
    } else {
        // Використовуємо основний renderCard() щоб картка ліда виглядала
        // ідентично у всіх контекстах (Напрямок / Перевірка / Маршрути).
        // Знаходимо оригінал у allData за PKG_ID і передаємо routeCtx, щоб
        // картка правильно працювала у маршруті (SortableJS drag-n-drop,
        // route-specific чекбокси для bulk-дій). Якщо оригінал не знайдено
        // (пасажир чи видалений запис) — fallback на старий renderRouteCard.
        html += filtered.map((r, idx) => {
            const leadId = r['PKG_ID'] || r['PAX_ID'] || '';
            const p = leadId ? allData.find(x => (x['PKG_ID'] || '') === leadId) : null;
            if (p) {
                return renderCard(p, {
                    rteId: r['RTE_ID'] || '',
                    sheetName: sheet.sheetName
                });
            }
            return renderRouteCard(r, idx, sheet.sheetName);
        }).join('');
    }

    list.innerHTML = html;
    renderRouteSidebar();
    updateRouteBulkToolbar();
    initRouteSortable();
}

// ── Рендер картки ліда маршруту (card-style як в CRM) ──
function renderRouteCard(r, idx, sheetName) {
    const rteId = r['RTE_ID'] || '';
    const leadId = r['PKG_ID'] || r['PAX_ID'] || '';
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

    return `<div class="route-card ${statusClass} ${isSelected ? 'selected' : ''}" id="rte-card-${rteId}" data-rte-id="${rteId}" data-lead-id="${leadId}">
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
    // У режимі сортування не розкриваємо деталі — будь-який клік це підготовка
    // до drag-and-drop (SortableJS перехопить на 350мс delay).
    if (routeSortModeActive) return;
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
  // Зведення — не належить жодній секції, згортаємо всі.
  if (typeof setActiveSidebarSection === 'function') setActiveSidebarSection(null);
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
  // Заголовок і підзаголовок міняємо залежно від того, чи лід уже у маршруті.
  var pkg = allData.find(function(p) { return p['PKG_ID'] === pkgId; });
  var inRoute = !!(pkg && pkg['RTE_ID']);
  var title = inRoute ? '🗺️ Перенести в маршрут' : '🗺️ Призначити маршрут';
  var subtitle = inRoute
    ? 'Оберіть інший маршрут, щоб перенести посилку (або «✕ Зняти з маршруту» внизу):'
    : 'Обрати маршрут для посилки:';
  showRoutePickerModal(title, subtitle);
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

  // Визначаємо поточний маршрут(и) пакетів, щоб підсвітити в списку та
  // показати кнопку «Зняти з маршруту» у футері (якщо принаймні один уже
  // призначений). Для bulk-режиму — достатньо щоб хоча б один мав маршрут.
  var anyInRoute = false;
  var currentRteIds = new Set();
  _routeModalPkgIds.forEach(function(id) {
    var pkg = allData.find(function(p) { return p['PKG_ID'] === id; });
    if (pkg && pkg['RTE_ID']) {
      anyInRoute = true;
      currentRteIds.add(pkg['RTE_ID']);
    }
  });

  var routeButtons = '';
  if (routes.length === 0) {
    routeButtons = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:12px;">Немає доступних маршрутів.<br>Створіть маршрут у меню зліва.</div>';
  } else {
    routeButtons = routes.map(function(r, i) {
      var name = r.city || (r.sheetName || '').replace(/^Маршрут_/, '');
      var isCurrent = currentRteIds.has(r.sheetName);
      var currentMark = isCurrent ? ' <span style="color:#059669;font-size:10px;">· поточний</span>' : '';
      return '<button class="route-pick-btn' + (isCurrent ? ' route-pick-current' : '') + '" onclick="doAssignToRoute(' + i + ')">' +
        '<span>🗺️ ' + name + currentMark + '</span>' +
        '<span style="font-size:10px;color:var(--text-secondary);font-weight:400;">👤' + (r.paxCount||0) + ' · 📦' + (r.parcelCount||0) + '</span>' +
      '</button>';
    }).join('');
  }

  // Футер: «Скасувати» завжди, «✕ Зняти з маршруту» якщо лід(и) вже у маршруті.
  var unassignBtn = anyInRoute
    ? '<button onclick="doRemoveFromRoute()" style="padding:6px 16px;border:1px solid #fecaca;border-radius:6px;background:#fef2f2;color:#b91c1c;font-family:inherit;font-size:12px;cursor:pointer;font-weight:600;">✕ Зняти з маршруту</button>'
    : '';

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
      '<div class="route-modal-footer" style="display:flex;justify-content:space-between;gap:8px;">' +
        unassignBtn +
        '<button onclick="closeRouteDetail()" style="padding:6px 16px;border:1px solid var(--border);border-radius:6px;background:#fff;font-family:inherit;font-size:12px;cursor:pointer;margin-left:auto;">Скасувати</button>' +
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

// «✕ Зняти з маршруту» — викликається з футера модалки вибору маршруту.
// Знімає RTE_ID у всіх _routeModalPkgIds, локально чистить allData й
// інвалідує кеш старих маршрутів, щоб sidebar/список оновились одразу.
async function doRemoveFromRoute() {
  var ids = _routeModalPkgIds.slice();
  closeRouteDetail();
  if (!ids.length) return;

  // Збираємо зачеплені маршрути (для інвалідації кешу і оновлення лічильників)
  var affected = new Set();
  ids.forEach(function(id) {
    var pkg = allData.find(function(p) { return p['PKG_ID'] === id; });
    if (pkg && pkg['RTE_ID']) affected.add(pkg['RTE_ID']);
  });

  showToast('Знімаємо ' + ids.length + ' запис(ів) з маршруту...', 'info');

  var success = 0;
  for (var i = 0; i < ids.length; i++) {
    var pkg = allData.find(function(p) { return p['PKG_ID'] === ids[i]; });
    var rteId = pkg ? pkg['RTE_ID'] : '';
    if (!rteId) continue;
    try {
      var res = await apiPost('removeFromRoute', { pkg_id: ids[i], rte_id: rteId });
      if (res.ok) {
        success++;
        if (pkg) pkg['RTE_ID'] = '';
      }
    } catch (e) { /* ignore */ }
  }

  // Інвалідуємо кеш зачеплених маршрутів — наступне відкриття перезавантажить rows.
  affected.forEach(function(rteId) {
    var r = routes.find(function(x) { return x.sheetName === rteId; });
    if (r) {
      r.rows = null;
      r.rowCount = Math.max(0, (r.rowCount || 0) - success);
      r.parcelCount = Math.max(0, (r.parcelCount || 0) - success);
    }
    if (typeof allRouteSheets !== 'undefined') {
      var allIdx = allRouteSheets.findIndex(function(s) { return s.sheetName === rteId; });
      if (allIdx !== -1) { allRouteSheets[allIdx].rows = null; }
    }
  });

  showToast('Знято з маршруту: ' + success + ' з ' + ids.length, success > 0 ? 'success' : 'error');
  if (_routeModalMode === 'bulk') afterBulkAction();
  else renderCards();
  if (typeof renderRouteSidebar === 'function') renderRouteSidebar();
}

// ===== [SECT-COUNTERS] COUNTERS =====
function updateCounters() {
  try {
    const active = allData.filter(p => p['Статус CRM'] !== 'Архів');
    const ue = active.filter(p => p['Напрям'] === 'УК→ЄВ');
    const eu = active.filter(p => p['Напрям'] === 'ЄВ→УК');
    const new24 = active.filter(p => isNew24h(p));
    const setCount = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setCount('countUe', ue.length);
    setCount('countEu', eu.length);
    setCount('countNew24', new24.length);
    setCount('mobCountUe', ue.length);
    setCount('mobCountEu', eu.length);
    setCount('mobCountNew24', new24.length);
    const dirData = currentDirection === 'new24' ? new24 : (currentDirection === 'ue' ? ue : eu);
    var cAll = dirData.length;
    var cChecking = dirData.filter(p => p['Контроль перевірки'] === 'В перевірці').length;
    var cReady = dirData.filter(p => p['Контроль перевірки'] === 'Готова до маршруту').length;
    var cUnknown = dirData.filter(p => p['Статус ліда'] === 'Невідомий').length;
    var cRejected = dirData.filter(p => p['Контроль перевірки'] === 'Відхилено').length;
    setCount('countAll', cAll);
    setCount('countChecking', cChecking);
    setCount('countReady', cReady);
    setCount('countUnknown', cUnknown);
    setCount('countRejected', cRejected);
    // Mobile counters
    setCount('mobCountAll', cAll);
    setCount('mobCountChecking', cChecking);
    setCount('mobCountReady', cReady);
    setCount('mobCountUnknown', cUnknown);
    setCount('mobCountRejected', cRejected);
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
  // Перехід у секцію «Перевірка» → згортаємо інші, скидаємо їхні фільтри.
  setActiveSidebarSection('verify');
  currentVerifyFilter = f;
  // Update desktop sidebar
  document.querySelectorAll('.sidebar [data-filter]').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === f);
  });
  // Update mobile sidebar
  document.querySelectorAll('#mobileSidebar [data-mfilter]').forEach(el => {
    el.classList.toggle('active', el.dataset.mfilter === f);
  });
  // Entering Перевірка → reveal the search panel at the top of the list.
  showVerifyPanel();
  // Bulk-menu: auto-expand Перевірка category.
  setBulkContext('verify');
  // Switch back to parcels view if in route/other view
  if (currentView !== 'parcels') backToParcels();
  else renderCards();
  updateCounters();
}
// startEdit/saveEdit replaced by startInlineEdit/saveInlineEdit

// ===== [SECT-PAYMENTS] Payment History =====

async function showPaymentHistory(pkgId) {
  const container = document.getElementById('payHistory-' + pkgId);
  if (!container) return;

  // Toggle: якщо вже показано — сховати
  if (container.style.display === 'block') {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = '<div style="color:#94a3b8;font-size:12px;padding:8px;">⏳ Завантаження...</div>';

  const res = await apiPost('getPayments', { pkg_id: pkgId });

  if (!res.ok || !res.data || res.data.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8;font-size:12px;padding:8px;background:#f8fafc;border-radius:6px;">Платежів не знайдено</div>';
    return;
  }

  let html = '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:#f1f5f9;">' +
    '<th style="padding:4px 6px;text-align:left;border-bottom:1px solid #e2e8f0;">Дата</th>' +
    '<th style="padding:4px 6px;text-align:left;border-bottom:1px solid #e2e8f0;">Сума</th>' +
    '<th style="padding:4px 6px;text-align:left;border-bottom:1px solid #e2e8f0;">Валюта</th>' +
    '<th style="padding:4px 6px;text-align:left;border-bottom:1px solid #e2e8f0;">Форма</th>' +
    '<th style="padding:4px 6px;text-align:left;border-bottom:1px solid #e2e8f0;">Статус</th>' +
    '<th style="padding:4px 6px;text-align:left;border-bottom:1px solid #e2e8f0;">Примітка</th>' +
  '</tr></thead><tbody>';

  res.data.forEach(p => {
    const date = p.created_at ? new Date(p.created_at).toLocaleDateString('uk-UA') : '—';
    const statusColor = p.status === 'completed' ? '#22c55e' : p.status === 'pending' ? '#fbbf24' : '#94a3b8';
    html += '<tr>' +
      '<td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;">' + date + '</td>' +
      '<td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;font-weight:600;">' + (p.amount || '—') + '</td>' +
      '<td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;">' + (p.currency || '—') + '</td>' +
      '<td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;">' + (p.payment_form || '—') + '</td>' +
      '<td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;"><span style="color:' + statusColor + '">' + (p.status || '—') + '</span></td>' +
      '<td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;color:#64748b;">' + (p.notes || '') + '</td>' +
    '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ===== [SECT-MESSENGER] Messenger popup + Client Chat =====

let _unreadCounts = {}; // { cli_id: count }
let _chatCliId = null;
let _chatPhone = null;
let _chatPollTimer = null;
let _chatMessages = [];

function openMessenger(phone, pkgId) {
  const clean = phone.replace(/[^+\d]/g, '');
  // Знайти pkg_id для чату (якщо не передано)
  const item = pkgId ? allData.find(p => p['PKG_ID'] === pkgId) : allData.find(p => {
    const phones = [p['Телефон реєстратора']||'', p['Телефон відправника']||'', p['Телефон отримувача']||''];
    return phones.some(ph => ph.replace(/[^+\d]/g, '') === clean);
  });
  const chatId = item ? item['PKG_ID'] : null;
  // Месенджери, відмічені при створенні/редагуванні ліда.
  // Невідмічені показуємо приглушеними, але клікабельними — месенджер
  // може й бути, просто не відмітили.
  const markedArr = (item && Array.isArray(item['Месенджери'])) ? item['Месенджери'] : [];
  const marked = new Set(markedArr);
  const dim = (on) => on ? '' : 'opacity:0.35;filter:grayscale(70%);';

  const menu = document.createElement('div');
  menu.style.cssText = 'position:fixed;inset:0;z-index:700;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
  menu.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:20px;min-width:260px;text-align:center;">
      <div style="font-weight:700;margin-bottom:12px;">Написати ${phone}</div>
      <a href="viber://chat?number=${clean}" style="display:block;padding:10px;margin:4px 0;background:#7360f2;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;${dim(marked.has('viber'))}">💜 Viber${marked.has('viber') ? '' : ' <span style=\"font-size:10px;font-weight:400;\">(не відмічено)</span>'}</a>
      <a href="https://t.me/${clean}" style="display:block;padding:10px;margin:4px 0;background:#0088cc;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;${dim(marked.has('telegram'))}">✈️ Telegram${marked.has('telegram') ? '' : ' <span style=\"font-size:10px;font-weight:400;\">(не відмічено)</span>'}</a>
      <a href="https://wa.me/${clean.replace('+','')}" style="display:block;padding:10px;margin:4px 0;background:#25d366;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;${dim(marked.has('whatsapp'))}">💚 WhatsApp${marked.has('whatsapp') ? '' : ' <span style=\"font-size:10px;font-weight:400;\">(не відмічено)</span>'}</a>
      ${chatId ? `<button onclick="this.closest('div').parentElement.remove();openClientChat('${chatId}','${clean}')" style="display:block;width:100%;padding:10px;margin:4px 0;background:#8b5cf6;color:#fff;border-radius:8px;border:none;font-weight:600;cursor:pointer;font-family:inherit;font-size:14px;${dim(marked.has('chat'))}">💬 Чат CRM${marked.has('chat') ? '' : ' <span style=\"font-size:10px;font-weight:400;\">(не відмічено)</span>'}</button>` : ''}
      <button onclick="this.closest('div').parentElement.remove()" style="margin-top:10px;padding:8px 20px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-family:inherit;">Скасувати</button>
    </div>
  `;
  document.body.appendChild(menu);
  menu.addEventListener('click', e => { if (e.target === menu) menu.remove(); });
}

// ---------- Chat overlay ----------

function _ensureChatOverlay() {
  if (document.getElementById('chatOverlay')) return;
  const el = document.createElement('div');
  el.id = 'chatOverlay';
  el.className = 'confirm-overlay';
  el.style.cssText = 'z-index:1100;';
  el.onclick = (e) => { if (e.target === el) closeClientChat(); };
  el.innerHTML = `
    <div style="background:#fff;width:100%;max-width:440px;height:80vh;max-height:600px;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;background:#f8fafc;">
        <span style="font-size:16px;font-weight:700;flex:1;" id="chatTitle">💬 Чат</span>
        <button onclick="closeClientChat()" style="border:none;background:none;font-size:22px;cursor:pointer;color:#64748b;">&times;</button>
      </div>
      <div id="chatMessages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px;background:#f5f7fa;"></div>
      <div style="padding:8px 12px;border-top:1px solid #e2e8f0;display:flex;gap:8px;background:#fff;">
        <input type="text" id="chatInput" placeholder="Написати повідомлення..." style="flex:1;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;" onkeydown="if(event.key==='Enter')sendChatMessage()">
        <button onclick="sendChatMessage()" style="padding:8px 14px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;">➤</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
}

function openClientChat(cliId, phone) {
  _ensureChatOverlay();
  _chatCliId = cliId;
  _chatPhone = phone;
  document.getElementById('chatTitle').textContent = '💬 Чат · ' + (phone || cliId);
  document.getElementById('chatMessages').innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:12px;">⏳ Завантаження...</div>';
  document.getElementById('chatInput').value = '';
  document.getElementById('chatOverlay').classList.add('active');
  loadChatMessages();
  _chatPollTimer = setInterval(loadChatMessages, 10000);
}

function closeClientChat() {
  const el = document.getElementById('chatOverlay');
  if (el) el.classList.remove('active');
  if (_chatPollTimer) { clearInterval(_chatPollTimer); _chatPollTimer = null; }
  _chatCliId = null;
}

async function loadChatMessages() {
  if (!_chatCliId) return;
  try {
    const res = await apiPost('getClientMessages', { cli_id: _chatCliId });
    if (res.ok && res.data) {
      _chatMessages = res.data;
      _renderChatMessages();
      await apiPost('markClientRead', { cli_id: _chatCliId });
      if (_unreadCounts[_chatCliId]) {
        delete _unreadCounts[_chatCliId];
        renderCards();
      }
    }
  } catch(e) { console.error('Chat load error:', e); }
}

function _renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!_chatMessages.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:12px;">Повідомлень поки немає. Напишіть першим!</div>';
    return;
  }
  container.innerHTML = _chatMessages.map(m => {
    const isManager = m.role === 'manager';
    const align = isManager ? 'flex-end' : 'flex-start';
    const bg = isManager ? 'var(--primary)' : '#e2e8f0';
    const color = isManager ? '#fff' : '#1e293b';
    const radius = isManager ? '12px 12px 4px 12px' : '12px 12px 12px 4px';
    const name = m.sender_name || (isManager ? 'Менеджер' : 'Клієнт');
    const time = m.date ? new Date(m.date).toLocaleString('uk-UA', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    return `<div style="align-self:${align};max-width:80%;padding:8px 12px;border-radius:${radius};background:${bg};color:${color};font-size:13px;line-height:1.4;word-wrap:break-word;">
      <div style="font-size:10px;font-weight:700;margin-bottom:2px;opacity:0.7;">${name}</div>
      ${m.text || ''}
      <div style="font-size:9px;opacity:0.5;margin-top:2px;text-align:right;">${time}</div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = (input.value || '').trim();
  if (!text || !_chatCliId) return;

  const senderName = getUserDisplayName() || 'Менеджер';
  input.value = '';
  _chatMessages.push({ role: 'manager', sender_name: senderName, text, date: new Date().toISOString() });
  _renderChatMessages();

  try {
    const res = await apiPost('sendManagerMessage', { cli_id: _chatCliId, text, sender_name: senderName });
    if (!res.ok) showToast('Помилка відправки', 'error');
  } catch(e) { showToast('Помилка: ' + e.message, 'error'); }
}

// ---------- Load unread counts on startup ----------

async function loadUnreadCounts() {
  try {
    const res = await apiPost('getUnreadCounts', {});
    if (res.ok) _unreadCounts = res.data || {};
  } catch(e) { /* ignore */ }
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
  // Архів — одноразова дія без своєї акордеон-секції. Згортаємо все меню
  // і на вході в архів, і на виході — щоб повернення у CRM завжди давало
  // чистий згорнутий стан.
  if (typeof setActiveSidebarSection === 'function') {
    setActiveSidebarSection(null);
  }
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
    var dir = currentDirection === 'eu' ? 'eu' : 'ue';
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
    ['Був у маршрутах', p['Був у маршрутах'] || '—', {readonly:true}],
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
  var dir = currentDirection === 'eu' ? 'eu' : 'ue';
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
  // 'new24' — це віртуальна вкладка (фільтр за свіжістю), не реальний напрям.
  // У формі додавання дефолтимось на 'ue', щоб не зламати валідацію.
  addFormDirection = (currentDirection === 'new24') ? 'ue' : currentDirection;
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
let _dupCheckTimer = null;

function checkDuplicatePhone(phone) {
  const warn = document.getElementById('duplicateWarning');
  if (!phone || phone.length < 6) {
    warn.classList.remove('visible');
    return;
  }

  const clean = phone.replace(/[\s\-()]/g, '');

  // 1) Швидкий локальний пошук (по всіх телефонних полях)
  const localDups = allData.filter(p => {
    const phones = [
      (p['Телефон реєстратора'] || '').replace(/[\s\-()]/g, ''),
      (p['Телефон відправника'] || '').replace(/[\s\-()]/g, ''),
      (p['Телефон отримувача'] || '').replace(/[\s\-()]/g, ''),
    ];
    return phones.some(ph => ph && (ph.includes(clean) || clean.includes(ph)));
  });

  if (localDups.length > 0) {
    _renderDupWarning(warn, localDups);
  } else {
    warn.classList.remove('visible');
  }

  // 2) Додатково — API-запит (debounce 500ms, може знайти записи з іншого напрямку)
  clearTimeout(_dupCheckTimer);
  _dupCheckTimer = setTimeout(async () => {
    const res = await apiPost('checkDuplicates', { phone: clean });
    if (res.ok && res.data && res.data.length > 0) {
      // Об'єднати з локальними (без дублів по PKG_ID)
      const allDups = [...localDups];
      const existingIds = new Set(localDups.map(d => d['PKG_ID']));
      for (const d of res.data) {
        if (!existingIds.has(d['PKG_ID'])) allDups.push(d);
      }
      if (allDups.length > 0) _renderDupWarning(warn, allDups);
    }
  }, 500);
}

function _renderDupWarning(warn, dups) {
  if (dups.length === 1) {
    const d = dups[0];
    warn.innerHTML = '⚠️ Можливий дублікат: <b>' + (d['Піб відправника'] || d['Піб отримувача'] || '?') + '</b> — ' +
      (d['Телефон реєстратора'] || d['Телефон відправника'] || d['Телефон отримувача'] || '') +
      ' <span style="opacity:.7">(ID: ' + d['PKG_ID'] + ', ' + (d['Напрям'] || '') + ')</span>';
  } else {
    warn.innerHTML = '⚠️ Знайдено <b>' + dups.length + '</b> можливих дублікатів:<br>' +
      dups.slice(0, 5).map(d =>
        '• ' + (d['Піб відправника'] || d['Піб отримувача'] || '?') + ' — ' +
        (d['Телефон реєстратора'] || d['Телефон відправника'] || d['Телефон отримувача'] || '') +
        ' <span style="opacity:.7">(' + d['PKG_ID'] + ')</span>'
      ).join('<br>') + (dups.length > 5 ? '<br>...та ще ' + (dups.length - 5) : '');
  }
  warn.classList.add('visible');
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
