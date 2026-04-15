// ================================================================
// PWA: Manifest + Install
// ================================================================
(function() {
    // Read session
    var _sess = null;
    try { _sess = JSON.parse(localStorage.getItem('boti_session') || 'null'); } catch(_) {}
    var _tenantName = (_sess && _sess.tenant_name) ? _sess.tenant_name : '';
    var _logoUrl = (_sess && _sess.logo_url) ? _sess.logo_url : '';
    window.__botiTenantName = _tenantName;

    // Set cookie so PHP can read tenant name for Safari meta tags
    if (_tenantName) {
        document.cookie = 'boti_tenant=' + encodeURIComponent(_tenantName) + ';path=/;max-age=31536000;SameSite=Lax';
    }
    if (_logoUrl) {
        document.cookie = 'boti_logo=' + encodeURIComponent(_logoUrl) + ';path=/;max-age=31536000;SameSite=Lax';
    }

    // Update manifest link (defined in HTML as <link rel="manifest" href="manifest.php" id="pwaManifest">)
    var manifestLink = document.getElementById('pwaManifest') || document.querySelector('link[rel="manifest"]');
    if (manifestLink && _tenantName) {
        var params = 'name=' + encodeURIComponent(_tenantName);
        if (_logoUrl) params += '&logo=' + encodeURIComponent(_logoUrl);
        manifestLink.href = '../manifest.php?' + params;
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
    }

    // Service Worker — спільний для passenger-crm + cargo-crm
    // (лежить на рівні /BotiLogistics-v1.0/ з scope, що покриває обидва модулі)
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

// PWA Install prompt
var deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallBanner();
});

function showInstallBanner() {
    var banner = document.getElementById('installBanner');
    if (banner) banner.style.display = '';
}

function installApp() {
    if (deferredInstallPrompt) {
        // Chrome / Android — нативний промпт
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(function(result) {
            if (result.outcome === 'accepted') {
                showToast((window.__botiTenantName || 'BotiLogistics') + ' встановлено!');
                var banner = document.getElementById('installBanner');
                if (banner) banner.style.display = 'none';
            }
            deferredInstallPrompt = null;
        });
    } else {
        // iOS / інші — показуємо інструкцію
        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            showToast('Натисніть кнопку "Поділитися" (📤) внизу Safari, потім "На початковий екран"', 6000);
        } else {
            showToast('Відкрийте меню браузера (⋮) → "Додати на головний екран" або "Встановити додаток"', 6000);
        }
    }
}

// Показуємо банер встановлення якщо ще не встановлено
window.addEventListener('DOMContentLoaded', function() {
    if (!window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) {
        showInstallBanner();
    }
});

// ================================================================
// Google Maps API init
// ================================================================
window.mapsApiReady = false;
window.mapsGeocoder = null;
window.mapsDirections = null;
function initMapsAPI() {
    window.mapsApiReady = true;
    window.mapsGeocoder = new google.maps.Geocoder();
    window.mapsDirections = new google.maps.DirectionsService();
    console.log('Google Maps API ready');
}

// ================================================================
// CONFIG
// ================================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbw3YQqn3-iyyxwbsAdgfeaj3bV1ik5cobb9D-hVftqmrSISwCSQDUZrhPW8yELvSXFy/exec';
const API_URL_ROUTES = 'https://script.google.com/macros/s/AKfycbx8ew1K34h8WMy-mAk8HBIuJ28rZmPOxSyBUDZLj9HKbEwU6fAW35OtHsKufYSHqariOw/exec';
const ROUTE_ACTIONS = [];
const COL_MAP = {
    pax_id:'PAX_ID', smartId:'Ід_смарт', direction:'Напрям', sourceSheet:'SOURCE_SHEET',
    dateCreated:'Дата створення', name:'Піб', phone:'Телефон пасажира',
    phoneReg:'Телефон реєстратора', seats:'Кількість місць',
    from:'Адреса відправки', to:'Адреса прибуття', date:'Дата виїзду',
    timing:'Таймінг', vehicle:'Номер авто', seatInCar:'Місце в авто',
    rteId:'RTE_ID', price:'Ціна квитка', currency:'Валюта квитка',
    deposit:'Завдаток', currencyDeposit:'Валюта завдатку',
    weight:'Вага багажу', weightPrice:'Ціна багажу', currencyWeight:'Валюта багажу',
    debt:'Борг', payStatus:'Статус оплати', leadStatus:'Статус ліда',
    crmStatus:'Статус CRM', tag:'Тег', note:'Примітка', noteSms:'Примітка СМС',
    cliId:'CLI_ID', bookingId:'BOOKING_ID', dateArchive:'DATE_ARCHIVE',
    archivedBy:'ARCHIVED_BY', archiveReason:'ARCHIVE_REASON', archiveId:'ARCHIVE_ID',
    calId:'CAL_ID', messenger:'Месенджер'
};
const DEFAULT_OSNOVNE_FIELDS = ['name','phone','phoneReg','direction','date','seats'];
// Поля які можна показати/сховати на картці
const CARD_FIELD_OPTIONS = [
    { key:'direction', label:'Напрям (UA→EU / EU→UA)' },
    { key:'phone', label:'Телефон пасажира' },
    { key:'seats', label:'Кількість місць' },
    { key:'date', label:'Дата виїзду' },
    { key:'price', label:'Ціна + валюта' },
    { key:'deposit', label:'Завдаток' },
    { key:'name', label:'ПІБ' },
    { key:'smartId', label:'SmartSender ID' },
    { key:'pax_id', label:'PAX_ID' },
    { key:'route', label:'Маршрут (від → до)' },
    { key:'tripDate', label:'Дата рейсу' },
    { key:'dateCreated', label:'Дата реєстрації' },
    { key:'leadStatus', label:'Статус ліда (бейдж)' },
    { key:'payStatus', label:'Статус оплати (бейдж)' },
    { key:'debt', label:'Борг (бейдж)' },
    { key:'messenger', label:'Месенджер' }
];
const DEFAULT_CARD_FIELDS = ['direction','phone','seats','date','price','deposit','name','pax_id','smartId','route','leadStatus','payStatus','debt'];
const OTHER_SECTIONS = [
    { key:'route', title:'🗺️ Маршрут', fields:['from','to','timing','vehicle','seatInCar','calId'] },
    { key:'finance', title:'💰 Фінанси', fields:['price','currency','deposit','currencyDeposit','weight','weightPrice','currencyWeight','debt'] },
    { key:'payments', title:'💳 Платежі', fields:[], readonly:true, async:true },
    { key:'statuses', title:'📊 Статуси', fields:['payStatus','leadStatus','crmStatus','tag','messenger'] },
    { key:'notes', title:'📝 Примітки', fields:['note','noteSms'] },
    { key:'system', title:'🔧 Системні', fields:['pax_id','smartId','dateCreated','sourceSheet','cliId','bookingId'], readonly:true }
];
function getManagerColsKey() {
    var name = getManagerName() || 'default';
    return 'oksi_cols_' + name.replace(/\s+/g, '_');
}
function getManagerCardKey() {
    var name = getManagerName() || 'default';
    return 'oksi_card_' + name.replace(/\s+/g, '_');
}
function getCardFields() {
    try { var s = localStorage.getItem(getManagerCardKey()); if (s) return JSON.parse(s); } catch(e) {}
    return DEFAULT_CARD_FIELDS;
}
function getOsnovneFields() {
    try { var s = localStorage.getItem(getManagerColsKey()); if (s) return JSON.parse(s); } catch(e) {}
    return DEFAULT_OSNOVNE_FIELDS;
}
function getDetailSections() {
    return [
        { key:'osnovne', title:'👤 Основне', fields: getOsnovneFields() },
        ...OTHER_SECTIONS
    ];
}
const READONLY_FIELDS = ['pax_id','smartId','dateCreated','sourceSheet','cliId','bookingId','rteId','debt','dateArchive','archivedBy','archiveReason','archiveId'];
const SELECT_OPTIONS = {
    leadStatus: ['Новий','В роботі','Підтверджено','Відмова'],
    payStatus: ['Не оплачено','Частково','Оплачено'],
    crmStatus: ['Активний','Архів'],
    currency: ['UAH','EUR','CHF','USD','PLN','CZK'],
    currencyDeposit: ['UAH','EUR','CHF','USD','PLN','CZK'],
    currencyWeight: ['UAH','EUR','CHF','USD','PLN','CZK'],
    direction: ['Україна-ЄВ','Європа-УК']
};
const LAYOUTS = {
    '1-3-3': ['D','1','2','3','4','5','6','7'],
    '2-2-3': ['D','1','2','3','4','5','6','7'],
    '2-2-2': ['D','1','2','3','4','5','6']
};

// ================================================================
// STATE
// ================================================================
let passengers = [];
let optimizedOrderIds = []; // Збережений порядок після оптимізації (масив PAX_ID)
let trips = [];
let routes = [];
let allRouteSheets = []; // Всі аркуші (включно з Відправка_, Витрати_, Шаблони)
let activeRouteIdx = null; // Індекс обраного маршруту для перегляду
let routeTypeFilter = 'all'; // all | pax | parcel
let routeStatusFilter = 'all'; // all | Новий | Підтверджено | В роботі | Відмова
let routePayFilter = 'all'; // all | Не оплачено | Частково | Оплачено
let routeSortMode = 'pickup'; // pickup | dropoff — який порядок застосовується (збір чи висадка)
let _routeSortableInstance = null; // Активний SortableJS instance на #routesList
// ── Sort Mode (режим ручного сортування маршруту) ──
// Увімкнення = явна дія менеджера через кнопку 🔧 Сортувати.
// Поза режимом drag-and-drop ВИМКНЕНО, клік по картці розгортає деталі як зазвичай.
let routeSortModeActive = false; // true коли користувач у режимі сортування
let _sortSnapshot = null;        // { mode, order[] } — зафіксований порядок на момент входу в режим (для rollback)
let _sortDirty = false;          // true якщо зроблено хоча б один drag у режимі (незбережені зміни)
let routeSelectedIds = new Set();
let routeOpenDetailsId = null;
let routeOpenActionsId = null;
let currentView = 'pax'; // 'pax' | 'trips' | 'routes'
// За замовчуванням при вході у CRM показуємо «Нові (24 год)», а не всіх.
// Якщо користувач захоче всіх — натискає «📊 Всі» в сайдбарі.
let currentDir = 'new24';
let tripTimeFilter = 'future';
let tripDirFilter = 'all';
let tripDateFilter = '';
let tripAutoFilter = 'all';
let openDetailsId = null;
let openActionsId = null;
let justAddedPaxId = null; // ID щойно доданого ліда (для підсвітки)
let activeDetailTab = {}; // { paxId: sectionKey } — зберігає активну вкладку деталей
let selectedIds = new Set();
let editingField = null;
let confirmCallback = null;
let tripCalMonth = new Date();
let tripSelectedDates = [];
let vehicleBuilderCount = 0;
let editingTripCalId = null;
let paymentsCache = {}; // Кеш платежів: { PAX_ID: [...] }

// ================================================================
// ROUTE POINTS CATALOG — точки маршруту Україна ↔ Іспанія (середа)
// ================================================================
// Довідник підтягується з passenger_route_points при старті CRM. Використовується
// у формі додавання/редагування ліда: замість вільного тексту менеджер обирає
// точку зі списку. Для міст з delivery_mode='address_and_point' (Бенідорм, Малага,
// Фуенхерола, Марбея, Сан-Педро, Естепона) додатково відкривається поле адреси.
let routePoints = [];                // Масив точок (sort_order ASC), як у БД
let routePointsById = {};            // {id → point} — швидкий доступ
let routePointsByNameNorm = {};      // {normName → point} — для матчингу SMS / legacy даних

function _normCityName(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,;:!?'"«»()]/g, '')
        .trim();
}

// Стан завантаження каталога точок: 'idle' → 'loading' → 'ready' | 'empty' | 'error'
let routePointsLoadState = 'idle';
let routePointsLoadError = '';

async function loadRoutePointsCatalog() {
    routePointsLoadState = 'loading';
    routePointsLoadError = '';
    try {
        const res = await apiPost('getRoutePoints', { route_group: 'ua-es-wed' });
        if (!res.ok) {
            routePointsLoadState = 'error';
            routePointsLoadError = res.error || 'API error';
            console.warn('[routePoints] API error:', res.error);
            return;
        }
        if (!Array.isArray(res.data) || res.data.length === 0) {
            routePoints = [];
            routePointsById = {};
            routePointsByNameNorm = {};
            routePointsLoadState = 'empty';
            console.warn('[routePoints] каталог порожній — ймовірно SQL-міграцію 2026-04-passenger-route-points.sql ще не запущено на Supabase (або seed для іншого tenant_id)');
            return;
        }
        routePoints = res.data;
        routePointsById = {};
        routePointsByNameNorm = {};
        for (const p of routePoints) {
            routePointsById[p.id] = p;
            routePointsByNameNorm[_normCityName(p.name_ua)] = p;
        }
        routePointsLoadState = 'ready';
        console.log('[routePoints] завантажено точок:', routePoints.length);
    } catch (e) {
        routePointsLoadState = 'error';
        routePointsLoadError = e && e.message ? e.message : String(e);
        console.warn('loadRoutePointsCatalog failed:', e);
    }
}

// Заповнює селекти точок відправки/прибуття у формі пасажира залежно від напрямку.
// UA→EU: порядок 1→23 (Чернівці …→ Естепона)
// EU→UA: порядок 23→1 (Естепона …→ Чернівці) — це той самий список реверснутий.
// ================================================================
// ROUTE POINTS COMBO-BOX (власний dropdown, НЕ нативний datalist)
// ================================================================
// Нативний <datalist> нестабільно працює на мобільних (особливо iOS Safari),
// тому ми робимо свій dropdown. Один контейнер #routePointDropdown на сторінку
// позиціонується position:fixed під активним полем (escape з modal overflow).
//
// API:
//   openRoutePointDropdown(which)    — показати список (which='from'|'to')
//   closeRoutePointDropdown()        — сховати
//   toggleRoutePointDropdown(which)  — для кнопки ▼
//   pickRoutePointOption(which,name) — обрати елемент списку
//   renderRoutePointDropdown(which)  — перебудувати html усередині (фільтр+сортування)

let _activeRoutePointWhich = null; // 'from' | 'to' | null

function openRoutePointDropdown(which) {
    const inputId = which === 'from' ? 'fFrom' : 'fTo';
    const input = document.getElementById(inputId);
    const dd = document.getElementById('routePointDropdown');
    if (!input || !dd) return;

    _activeRoutePointWhich = which;
    renderRoutePointDropdown(which);

    // position:fixed — екранує modal-body overflow
    const rect = input.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = vh - rect.bottom;
    const maxH = Math.min(260, Math.max(140, spaceBelow - 12));
    dd.style.left = rect.left + 'px';
    dd.style.top = (rect.bottom + 2) + 'px';
    dd.style.width = rect.width + 'px';
    dd.style.maxHeight = maxH + 'px';
    dd.classList.add('open');
}

function closeRoutePointDropdown() {
    const dd = document.getElementById('routePointDropdown');
    if (dd) dd.classList.remove('open');
    _activeRoutePointWhich = null;
}

// Перераховує позицію dropdown (коли юзер скролить форму під ним). Якщо
// активний інпут вийшов повністю за межі видимого екрану — закриваємо.
function repositionRoutePointDropdown() {
    if (!_activeRoutePointWhich) return;
    const inputId = _activeRoutePointWhich === 'from' ? 'fFrom' : 'fTo';
    const input = document.getElementById(inputId);
    const dd = document.getElementById('routePointDropdown');
    if (!input || !dd) return;
    const rect = input.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // Якщо інпут повністю поза видимою областю — ховаємо (щоб не висіло десь зверху/знизу)
    if (rect.bottom < 0 || rect.top > vh) {
        closeRoutePointDropdown();
        return;
    }
    const spaceBelow = vh - rect.bottom;
    const maxH = Math.min(260, Math.max(140, spaceBelow - 12));
    dd.style.left = rect.left + 'px';
    dd.style.top = (rect.bottom + 2) + 'px';
    dd.style.width = rect.width + 'px';
    dd.style.maxHeight = maxH + 'px';
}

function toggleRoutePointDropdown(which) {
    const dd = document.getElementById('routePointDropdown');
    if (!dd) return;
    if (dd.classList.contains('open') && _activeRoutePointWhich === which) {
        closeRoutePointDropdown();
    } else {
        openRoutePointDropdown(which);
    }
}

function renderRoutePointDropdown(which) {
    const dd = document.getElementById('routePointDropdown');
    if (!dd) return;

    // Стан каталога
    if (routePointsLoadState !== 'ready' || !routePoints.length) {
        let msg = '— немає даних —';
        if (routePointsLoadState === 'loading' || routePointsLoadState === 'idle') msg = '⏳ завантажується…';
        else if (routePointsLoadState === 'empty') msg = '⚠️ каталог порожній — запустіть SQL міграцію';
        else if (routePointsLoadState === 'error') msg = '❌ ' + (routePointsLoadError || 'помилка');
        dd.innerHTML = `<div class="combo-box-empty">${msg}</div>`;
        return;
    }

    // Порядок списку за напрямком
    const dir = (document.getElementById('fDirection') || {}).value || 'ua-eu';
    const ordered = routePoints.slice();
    if (dir === 'eu-ua') ordered.reverse();

    // Фільтр за введеним у поле текстом: беремо перше слово (до коми/тире),
    // нормалізуємо й шукаємо підрядок у назвах каталогу
    const inputId = which === 'from' ? 'fFrom' : 'fTo';
    const input = document.getElementById(inputId);
    const raw = input ? input.value : '';
    const firstToken = raw.split(/[,;/]|\s+[—–-]\s+/)[0] || '';
    const normFilter = _normCityName(firstToken);
    const filtered = normFilter
        ? ordered.filter(p => _normCityName(p.name_ua).includes(normFilter))
        : ordered;

    if (filtered.length === 0) {
        dd.innerHTML = '<div class="combo-box-empty">Немає збігів у каталозі — можна написати своє</div>';
        return;
    }

    const flagByCountry = {
        UA: '🇺🇦', MD: '🇲🇩', RO: '🇷🇴', SK: '🇸🇰', CZ: '🇨🇿', DE: '🇩🇪', ES: '🇪🇸',
        PL: '🇵🇱', AT: '🇦🇹', HU: '🇭🇺', CH: '🇨🇭', IT: '🇮🇹', FR: '🇫🇷'
    };
    dd.innerHTML = filtered.map(p => {
        const flag = flagByCountry[p.country_code] || '';
        const loc = p.location_name ? `<span class="combo-box-loc">${p.location_name}</span>` : '';
        // Inline обробників немає — використовуємо делегований click listener
        // на контейнері #routePointDropdown (wired у DOMContentLoaded), який
        // вміє відрізнити свайп (scroll) від тапу (select) через трекінг
        // touchmove дельти > 8px по вертикалі. Дані про елемент у data-*.
        const escapedName = String(p.name_ua).replace(/"/g, '&quot;');
        return `<div class="combo-box-item" data-which="${which}" data-name="${escapedName}">
                    <span class="combo-box-flag">${flag}</span>
                    <span class="combo-box-name">${p.name_ua}</span>
                    ${loc}
                </div>`;
    }).join('');
}

function pickRoutePointOption(which, name) {
    const inputId = which === 'from' ? 'fFrom' : 'fTo';
    const input = document.getElementById(inputId);
    if (!input) return;
    input.value = name;
    closeRoutePointDropdown();
    suggestPriceFromRoute();
}

// Гарантує завантаження каталога перед використанням. Викликається з openAddModal/
// openEditPax, щоб уникнути race condition якщо модалка відкрита до init-Promise.all.
async function ensureRoutePointsLoaded() {
    if (routePointsLoadState === 'ready') return;
    if (routePointsLoadState === 'loading') return; // init вже в роботі
    await loadRoutePointsCatalog();
}

// Спроба зіставити введений текст з каталожним містом за нормалізованою назвою.
// Розрізає "Малага, Calle Mayor 15" / "Бенідорм - вул Х" по першому роздільнику,
// бере перше слово й шукає збіг у routePointsByNameNorm. Повертає point або null.
function findRoutePointByText(text) {
    if (!text) return null;
    const raw = String(text).trim();
    if (!raw) return null;
    // Розрізаємо по комі, тире, em-dash, слеш — беремо перший шматок
    const cityPart = raw.split(/\s*[,;/]\s*|\s+[—–-]\s+/)[0].trim();
    return routePointsByNameNorm[_normCityName(cityPart)] || null;
}

// Викликається on input у fFrom/fTo.
// - Якщо dropdown поки закритий або належить іншому полю — відкрити для цього
//   (щоб юзер бачив список коли починає друкувати)
// - Якщо відкритий для цього самого поля — перерендер з новим фільтром
// - У кінці — спроба підставити ціну за каталогом
function onRoutePointTextChange(which) {
    if (_activeRoutePointWhich !== which) {
        openRoutePointDropdown(which);
    } else {
        renderRoutePointDropdown(which);
    }
    suggestPriceFromRoute();
}

// Якщо обидві точки введені і матчаться з каталогом — шукаємо збіг у матриці
// passenger_route_prices. При збігу підставляємо ціну у #fPrice (менеджер
// може виправити вручну). Якщо збігу немає — не чіпаємо існуюче значення.
async function suggestPriceFromRoute() {
    const fromEl = document.getElementById('fFrom');
    const toEl = document.getElementById('fTo');
    const currSel = document.getElementById('fCurrency');
    const priceEl = document.getElementById('fPrice');
    if (!fromEl || !toEl || !priceEl) return;

    const fromPoint = findRoutePointByText(fromEl.value);
    const toPoint   = findRoutePointByText(toEl.value);
    if (!fromPoint || !toPoint) return;
    if (fromPoint.id === toPoint.id) return;

    const currency = (currSel && currSel.value) || 'EUR';
    try {
        const res = await apiPost('getRoutePrice', {
            from_point_id: fromPoint.id,
            to_point_id: toPoint.id,
            currency
        });
        if (res.ok && res.data && res.data.price != null) {
            // Підставляємо тільки якщо поле порожнє або містить попередньо підставлену ціну
            const prev = priceEl.value.trim();
            const wasAutoFilled = priceEl.dataset.autoFilled === '1';
            if (!prev || wasAutoFilled) {
                priceEl.value = res.data.price;
                priceEl.dataset.autoFilled = '1';
                priceEl.classList.add('price-auto-suggested');
                setTimeout(() => priceEl.classList.remove('price-auto-suggested'), 1500);
            }
        }
    } catch (e) {
        console.warn('suggestPriceFromRoute:', e);
    }
}

// Зчитує текстове значення поля і повертає об'єкт { text, point } де point —
// знайдена каталожна точка або null. text зберігається як-є у
// passengers.departure_address / arrival_address, тому legacy-ліди з довільним
// вільним текстом працюють без змін.
function readRoutePointCombined(which) {
    const id = which === 'from' ? 'fFrom' : 'fTo';
    const el = document.getElementById(id);
    const text = el ? el.value.trim() : '';
    const point = findRoutePointByText(text);
    return { text, point };
}

// Скидає поля точок у формі до порожнього стану
function resetRoutePointInputs() {
    ['fFrom','fTo'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const priceEl = document.getElementById('fPrice');
    if (priceEl) { priceEl.dataset.autoFilled = ''; priceEl.classList.remove('price-auto-suggested'); }
}

// ================================================================
// MANAGER LOGIN — 3 слоти, без пароля, localStorage
// ================================================================
var MANAGER_SLOTS_KEY = 'oksi_manager_slots';
var MANAGER_ACTIVE_KEY = 'oksi_manager_name';

function getManagerSlots() {
    try {
        var s = localStorage.getItem(MANAGER_SLOTS_KEY);
        if (s) { var arr = JSON.parse(s); if (Array.isArray(arr) && arr.length === 3) return arr; }
    } catch(e) {}
    return ['Менеджер 1', 'Менеджер 2', 'Менеджер 3'];
}

function saveManagerSlots(slots) {
    localStorage.setItem(MANAGER_SLOTS_KEY, JSON.stringify(slots));
}

function getManagerName() {
    // Prefer boti_session (set by config-crm login) over legacy per-device slot
    try {
        var s = JSON.parse(localStorage.getItem('boti_session') || 'null');
        if (s && s.user_name) return s.user_name;
        if (s && s.user_login) return s.user_login;
    } catch (_) {}
    return localStorage.getItem(MANAGER_ACTIVE_KEY) || '';
}

function getBotiSession() {
    try { return JSON.parse(localStorage.getItem('boti_session') || 'null'); } catch (_) { return null; }
}

function setManagerName(name) {
    localStorage.setItem(MANAGER_ACTIVE_KEY, name);
    updateAvatarUI();
}

function updateAvatarUI() {
    var name = getManagerName();
    var avatar = document.querySelector('.user-avatar');
    if (avatar && name) {
        var parts = name.trim().split(/\s+/);
        avatar.textContent = parts.map(function(p) { return p[0]; }).join('').substring(0, 2).toUpperCase();
        avatar.title = name;
    } else if (avatar) {
        avatar.textContent = '?';
        avatar.title = 'Увійти';
    }
}

function renderManagerSlots() {
    var session = getBotiSession();
    var container = document.getElementById('managerSlots');
    if (!container) return;

    if (!session) {
        container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:13px">Сесія відсутня. <a href="../config-crm/" style="color:var(--accent);font-weight:600">Увійти</a></div>';
        var closeBtnNoSess = document.getElementById('managerModalClose');
        if (closeBtnNoSess) closeBtnNoSess.style.display = 'none';
        return;
    }

    var name = session.user_name || session.user_login || '—';
    var roleMap = { owner: 'Власник', manager: 'Менеджер', driver: 'Водій' };
    var roleLabel = roleMap[session.role] || session.role || '';
    var tenant = session.tenant_name || session.tenant_id || '';
    var initials = name.trim().split(/\s+/).map(function(p) { return p[0]; }).join('').substring(0, 2).toUpperCase();

    var html = '';
    html += '<div style="display:flex;align-items:center;gap:14px;padding:16px;border-radius:12px;border:2px solid var(--border);background:var(--bg-secondary, #f9fafb);margin-bottom:12px">';
    html += '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;flex-shrink:0">' + initials + '</div>';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-weight:700;font-size:15px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</div>';
    if (roleLabel) html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">' + roleLabel + '</div>';
    if (tenant)    html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;opacity:.8">🏢 ' + tenant + '</div>';
    html += '</div>';
    html += '</div>';

    // "Owner Panel" button — only if user has owner role
    var roles = session.roles || [session.role];
    if (roles.indexOf('owner') !== -1) {
        html += '<button onclick="goToOwnerPanel()" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:10px;background:white;color:#6d28d9;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;transition:all .2s" onmouseover="this.style.background=\'#f5f3ff\';this.style.borderColor=\'#c4b5fd\'" onmouseout="this.style.background=\'white\';this.style.borderColor=\'var(--border)\'">';
        html += '<span>👑</span><span>Власницька панель</span>';
        html += '</button>';
    }

    html += '<button onclick="botiLogout()" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:10px;background:white;color:#dc2626;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s" onmouseover="this.style.background=\'#fef2f2\';this.style.borderColor=\'#fecaca\'" onmouseout="this.style.background=\'white\';this.style.borderColor=\'var(--border)\'">';
    html += '<span>🚪</span><span>Вийти</span>';
    html += '</button>';

    container.innerHTML = html;

    // Always allow closing — user is already logged in via config-crm
    var closeBtn = document.getElementById('managerModalClose');
    if (closeBtn) closeBtn.style.display = '';
}

function selectManager(idx) {
    var slots = getManagerSlots();
    setManagerName(slots[idx]);
    closeModal('managerModal');
    showToast('Вхід: ' + slots[idx]);
    checkOnboardingAutoStart();
}

function renameManager(idx) {
    var slots = getManagerSlots();
    var newName = prompt('Нове ім\'я для слота ' + (idx + 1) + ':', slots[idx]);
    if (newName !== null && newName.trim()) {
        var oldName = slots[idx];
        var oldKey = 'oksi_cols_' + oldName.replace(/\s+/g, '_');
        slots[idx] = newName.trim();
        saveManagerSlots(slots);
        // Мігруємо налаштування на нове ім'я
        var newSuffix = newName.trim().replace(/\s+/g, '_');
        var oldSuffix = oldName.replace(/\s+/g, '_');
        ['oksi_cols_', 'oksi_card_'].forEach(function(prefix) {
            var oldData = localStorage.getItem(prefix + oldSuffix);
            if (oldData) {
                localStorage.setItem(prefix + newSuffix, oldData);
                localStorage.removeItem(prefix + oldSuffix);
            }
        });
        // Якщо перейменовуємо активного — оновити активне ім'я
        if (getManagerName() === oldName) {
            setManagerName(newName.trim());
        }
        renderManagerSlots();
    }
}

function openManagerModal() {
    renderManagerSlots();
    openModal('managerModal');
}

// ================================================================
// PRESENCE — онлайн-статус менеджерів
// ================================================================
var HEARTBEAT_INTERVAL = 30000; // 30 сек
var PRESENCE_CHECK_INTERVAL = 30000; // 30 сек
var _heartbeatTimer = null;
var _presenceTimer = null;

function startPresence() {
    sendHeartbeat();
    fetchOnlineManagers();
    _heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    _presenceTimer = setInterval(fetchOnlineManagers, PRESENCE_CHECK_INTERVAL);
}

function getDeviceInfo() {
    var ua = navigator.userAgent || '';
    var device = 'Desktop';
    var os = 'Unknown';
    var browser = 'Unknown';

    // OS
    if (/iPhone/.test(ua)) { device = 'iPhone'; os = 'iOS'; }
    else if (/iPad/.test(ua)) { device = 'iPad'; os = 'iOS'; }
    else if (/Android/.test(ua)) {
        os = 'Android';
        device = /Mobile/.test(ua) ? 'Android Phone' : 'Android Tablet';
    }
    else if (/Mac OS/.test(ua)) { os = 'macOS'; }
    else if (/Windows/.test(ua)) { os = 'Windows'; }
    else if (/Linux/.test(ua)) { os = 'Linux'; }

    // Browser
    if (/CriOS|Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
    else if (/Firefox|FxiOS/.test(ua)) browser = 'Firefox';
    else if (/Edg/.test(ua)) browser = 'Edge';
    else if (/Opera|OPR/.test(ua)) browser = 'Opera';

    // PWA mode
    var isPWA = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

    return { device: device, os: os, browser: browser, pwa: !!isPWA };
}

function sendHeartbeat() {
    var name = getManagerName();
    if (!name) return;
    var devInfo = getDeviceInfo();
    apiPost('heartbeat', { manager: name, device: devInfo.device, os: devInfo.os, browser: devInfo.browser, pwa: devInfo.pwa }).catch(function() {});
}

function fetchOnlineManagers() {
    apiPost('getOnlineManagers', {}).then(function(res) {
        if (res.ok) renderPresenceBar(res.managers || []);
    }).catch(function() {});
}

function renderPresenceBar(managers) {
    var bar = document.getElementById('presenceBar');
    if (!bar) return;
    var myName = getManagerName();
    var colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    // Показуємо інших менеджерів (не себе)
    var others = managers.filter(function(m) { return m.name !== myName; });

    if (others.length === 0) {
        bar.innerHTML = '';
        return;
    }

    bar.innerHTML = others.map(function(m, i) {
        var initials = m.name.trim().split(/\s+/).map(function(p) { return p[0]; }).join('').substring(0, 2).toUpperCase();
        var color = colors[i % colors.length];
        var deviceIcon = '';
        if (m.device) {
            if (m.device.indexOf('iPhone') >= 0 || m.device.indexOf('Android Phone') >= 0) deviceIcon = '\uD83D\uDCF1';
            else if (m.device.indexOf('iPad') >= 0 || m.device.indexOf('Tablet') >= 0) deviceIcon = '\uD83D\uDCBB';
            else deviceIcon = '\uD83D\uDDA5\uFE0F';
        }
        var title = m.name + ' — онлайн' + (m.device ? '\n' + deviceIcon + ' ' + m.device : '');
        return '<div class="hdr-avatar presence-dot" style="background:' + color + '" title="' + title + '">' +
            initials + '</div>';
    }).join('');
}

// Запускаємо після завантаження
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(startPresence, 2000);
});

// ================================================================
// API
// ================================================================
var _apiActiveRequests = 0;

async function apiPost(action, data) {
    console.log('[apiPost → Supabase]', action);
    _apiActiveRequests++;
    if (_apiActiveRequests === 1) setSyncStatus('loading');
    try {
        const result = await apiPostSupabase(action, { manager: getManagerName(), ...data });
        _apiActiveRequests = Math.max(0, _apiActiveRequests - 1);
        if (_apiActiveRequests === 0) setSyncStatus('ok');
        return result;
    } catch (e) {
        _apiActiveRequests = Math.max(0, _apiActiveRequests - 1);
        setSyncStatus('error');
        console.error('API error:', e);
        showToast('❌ Помилка мережі');
        return { ok: false, error: e.message };
    }
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Replace BotiLogistics logo with company name from session
    var _bs = getBotiSession();
    if (_bs && _bs.tenant_name) {
        var logoEl = document.querySelector('.logo');
        if (logoEl) logoEl.textContent = _bs.tenant_name;
    }

    // Запит менеджера при першому відкритті
    updateAvatarUI();
    if (!getManagerName()) {
        openManagerModal();
    }

    showLoader('Завантаження...');
    Promise.all([
        apiPost('getAll', { sheet: 'all' }),
        apiPost('getTrips', { filter: {} }),
        loadRoutePointsCatalog()
    ]).then(([paxRes, tripRes]) => {
        hideLoader();
        if (paxRes.ok) passengers = paxRes.data;
        if (tripRes.ok) trips = tripRes.data;
        updateAllCounts();
        updateTripFilterDropdown();
        updateTripAutoFilterDropdown();
        render();
        // Підтягуємо маршрути для сайдбару
        loadRoutes();
    }).catch(() => { hideLoader(); render(); });

    setInterval(silentSync, 30000);

    // Route points form listeners: перемалювати dropdown якщо він відкритий
    // при зміні напрямку (порядок точок реверсується). Тексти у fFrom/fTo не
    // чіпаємо — це combo-box з вільним вводом.
    const fDirEl = document.getElementById('fDirection');
    if (fDirEl) {
        fDirEl.addEventListener('change', function () {
            if (_activeRoutePointWhich) renderRoutePointDropdown(_activeRoutePointWhich);
        });
    }

    // Закривати dropdown при кліку/тапі поза combo-box і поза самим dropdown
    const _handleOutsideRoutePoint = function (e) {
        if (!_activeRoutePointWhich) return;
        const t = e.target;
        if (t && t.closest && (t.closest('.combo-box') || t.closest('#routePointDropdown'))) return;
        closeRoutePointDropdown();
    };
    document.addEventListener('mousedown', _handleOutsideRoutePoint, true);
    document.addEventListener('touchstart', _handleOutsideRoutePoint, true);

    // Делегований click на елементах списку з відрізненням tap/swipe на мобільних.
    // Проблема: якщо вішати onclick на кожен .combo-box-item, мобільний браузер
    // фаєрить click навіть коли юзер робив свайп (скрол списку) — бо дельта
    // руху < браузерного порогу кліку. Результат: при спробі прокрутити список
    // одразу вибирається перший елемент.
    // Рішення: трекати touchstart/touchmove, і у click-хендлері перевіряти
    // наш власний прапорець «рухався» (поріг 8px вертикально) — якщо так,
    // ігноруємо клік (юзер скролив).
    let _ddTouchStartY = 0;
    let _ddTouchMoved = false;
    const _ddElForListeners = document.getElementById('routePointDropdown');
    if (_ddElForListeners) {
        _ddElForListeners.addEventListener('touchstart', function (e) {
            if (!e.touches || !e.touches.length) return;
            _ddTouchStartY = e.touches[0].clientY;
            _ddTouchMoved = false;
        }, { passive: true });
        _ddElForListeners.addEventListener('touchmove', function (e) {
            if (!e.touches || !e.touches.length) return;
            const dy = Math.abs(e.touches[0].clientY - _ddTouchStartY);
            if (dy > 8) _ddTouchMoved = true;
        }, { passive: true });
        _ddElForListeners.addEventListener('click', function (e) {
            const item = e.target && e.target.closest && e.target.closest('.combo-box-item');
            if (!item) return;
            if (_ddTouchMoved) {
                // Скрол, не вибираємо — просто скидаємо стан
                _ddTouchMoved = false;
                return;
            }
            const which = item.getAttribute('data-which');
            const name = item.getAttribute('data-name');
            if (which && name) {
                pickRoutePointOption(which, name);
            }
        });
    }

    // Перепозиціонувати dropdown при скролі батьківського контейнера (напр.
    // modal-body). НЕ закриваємо — інакше юзер не зможе прокрутити список:
    // скрол всередині dropdown сам по собі тригерив би закриття.
    // Scroll target — це ЗАВЖДИ елемент, в якому встановлено overflow-y: auto.
    // У нас overflow мають два елементи: сам #routePointDropdown і modal-body.
    // Перший ігноруємо (юзер крутить список), другий — рухає dropdown слідом.
    document.addEventListener('scroll', function (e) {
        if (!_activeRoutePointWhich) return;
        const t = e.target;
        if (t && t.id === 'routePointDropdown') return;
        repositionRoutePointDropdown();
    }, true);
    const fCurrEl = document.getElementById('fCurrency');
    if (fCurrEl) fCurrEl.addEventListener('change', function () {
        const priceEl = document.getElementById('fPrice');
        if (priceEl) priceEl.dataset.autoFilled = ''; // валюта змінилась — дозволяємо перезапис
        suggestPriceFromRoute();
    });
    // Якщо менеджер збив авто-ціну вручну — знімаємо прапорець, щоб ми не перезаписали знову
    const fPriceEl = document.getElementById('fPrice');
    if (fPriceEl) fPriceEl.addEventListener('input', function () {
        fPriceEl.dataset.autoFilled = '';
    });

    // Автозапуск навчання якщо вже залогінений і ще не проходив
    checkOnboardingAutoStart();
});

// ================================================================
// SILENT SYNC
// ================================================================

// ── Перевірка чи є нова версія сайту (Service Worker).
// Повертає true якщо знайдено нову версію і клієнт має перезавантажитись.
// Повертає false якщо актуальна версія або SW недоступний.
function checkAndUpdateApp() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(false);
    return navigator.serviceWorker.getRegistration().then(function(reg) {
        if (!reg) return false;
        // Тригеримо перевірку sw.js на сервері.
        // Якщо байти sw.js не збігаються — браузер інсталює нового worker'а.
        return reg.update().then(function() {
            var newWorker = reg.waiting || reg.installing;
            if (!newWorker) return false; // актуальна версія
            // Якщо worker ще installing — почекати поки стане installed.
            var waitInstalled = new Promise(function(resolve) {
                if (newWorker.state === 'installed' || newWorker.state === 'activated') {
                    resolve();
                    return;
                }
                newWorker.addEventListener('statechange', function handler() {
                    if (newWorker.state === 'installed' || newWorker.state === 'activated') {
                        newWorker.removeEventListener('statechange', handler);
                        resolve();
                    }
                });
            });
            return waitInstalled.then(function() {
                // Коли нова версія стане controller'ом — перезавантажити сторінку.
                return new Promise(function(resolve) {
                    var done = false;
                    function onControllerChange() {
                        if (done) return;
                        done = true;
                        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                        resolve(true);
                    }
                    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
                    // Попросити waiting worker активуватись
                    try { newWorker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
                    // Safety-net: якщо controllerchange не стрельнув за 3 сек — вважати що ок
                    setTimeout(function() {
                        if (done) return;
                        done = true;
                        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                        resolve(true);
                    }, 3000);
                });
            });
        });
    }).catch(function(e) {
        console.warn('checkAndUpdateApp failed:', e);
        return false;
    });
}

function silentSync(manual, force) {
    if (manual) {
        // Ручна синхронізація:
        // 1) Перевірити чи є нова версія додатку на сервері
        // 2) Якщо так — активувати нового Service Worker'а й перезавантажити
        // 3) Якщо ні — зробити звичайну синхронізацію даних
        showLoader('🔄 Перевірка оновлень...');
        return checkAndUpdateApp().then(function(hasNew) {
            if (hasNew) {
                showLoader('✨ Знайдено нову версію, оновлення...');
                // Почекати пів секунди щоб SW встиг повністю активуватись, потім reload
                setTimeout(function() { location.reload(); }, 500);
                return;
            }
            // Актуальна версія — просто оновлюємо дані
            showLoader('🔄 Синхронізація всіх даних...');
            return Promise.all([
                apiPost('getAll', { sheet: 'all' }),
                apiPost('getTrips', { filter: {} }),
                apiPost('getRoutesList', {})
            ]).then(([paxRes, tripRes, routeRes]) => {
                hideLoader();
                if (paxRes.ok) { passengers = paxRes.data; applyOptimizedOrder(); }
                if (tripRes.ok) trips = tripRes.data;
                if (routeRes.ok && routeRes.data) {
                    var newList = routeRes.data;
                    allRouteSheets = newList.map(function(s) {
                        var existing = allRouteSheets.find(function(e) { return e.sheetName === s.sheetName; });
                        return { sheetName: s.sheetName, rowCount: s.rowCount,
                            paxCount: s.paxCount || 0, parcelCount: s.parcelCount || 0,
                            headers: existing ? existing.headers : [],
                            rows: existing ? existing.rows : null };
                    });
                    routes = allRouteSheets.filter(s => {
                        const n = (s.sheetName || '');
                        return n && n !== 'Маршрут_Шаблон';
                    });
                    setCount('pcCountRoutes', routes.length);
                    setCount('mobileCountRoutes', routes.length);
                    renderRouteSidebar();
                    // Перезавантажуємо дані всіх маршрутів у фоні (замінить старі rows коли прийдуть)
                    routes.forEach(function(s, idx) {
                        loadRouteSheetData(idx, true).catch(function() {});
                    });
                }
                updateAllCounts();
                updateTripFilterDropdown();
                updateTripAutoFilterDropdown();
                render();
                if (currentView === 'trips') renderTrips();
                updateSyncTime();
                showToast('✅ Актуальна версія. Оновлено: ' + (passengers ? passengers.length : 0) + ' пасажирів, ' + trips.length + ' рейсів, ' + (archivedPassengers ? archivedPassengers.length : 0) + ' в архіві');
            }).catch((e) => {
                hideLoader();
                showToast('❌ Помилка синхронізації: ' + (e.message || 'мережа'));
            });
        });
    }

    // Автоматична тиха синхронізація (без лоадера)
    // Якщо не await-режим — пропускаємо коли відкрита модалка
    if (!manual && !force && document.querySelector('.modal-overlay.show')) return Promise.resolve();
    if (!manual && !force && document.querySelector('.bottom-sheet-overlay.show')) return Promise.resolve();

    return Promise.all([
        apiPost('getAll', { sheet: 'all' }),
        apiPost('getTrips', { filter: {} }),
        apiPost('getRoutesList', {})
    ]).then(([paxRes, tripRes, routeRes]) => {
        if (paxRes.ok) {
            passengers = paxRes.data;
            applyOptimizedOrder();
            // Якщо щойно додали ліда — тримаємо його зверху
            if (justAddedPaxId) {
                const idx = passengers.findIndex(p => p['PAX_ID'] === justAddedPaxId);
                if (idx > 0) {
                    const [pax] = passengers.splice(idx, 1);
                    passengers.unshift(pax);
                }
            }
        }
        if (tripRes.ok) trips = tripRes.data;
        if (routeRes.ok && routeRes.data) {
            var newList = routeRes.data;
            allRouteSheets = newList.map(function(s) {
                var existing = allRouteSheets.find(function(e) { return e.sheetName === s.sheetName; });
                return { sheetName: s.sheetName, rowCount: s.rowCount,
                    paxCount: s.paxCount || 0, parcelCount: s.parcelCount || 0,
                    headers: existing ? existing.headers : [],
                    rows: existing ? existing.rows : null };
            });
            routes = allRouteSheets.filter(s => {
                const n = (s.sheetName || '');
                return n && n !== 'Маршрут_Шаблон';
            });
            setCount('pcCountRoutes', routes.length);
            setCount('mobileCountRoutes', routes.length);
            renderRouteSidebar();
            routes.forEach(function(s, idx) {
                loadRouteSheetData(idx, true).catch(function() {});
            });
        }
        updateAllCounts();
        updateTripFilterDropdown();
        updateTripAutoFilterDropdown();
        render();
        if (currentView === 'trips') renderTrips();
        updateSyncTime();
    }).catch(() => {});
}

function updateSyncTime() {
    setSyncStatus('ok');
}

function setSyncStatus(status) {
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        avatar.classList.remove('sync-ok', 'sync-error', 'sync-loading');
        avatar.classList.add('sync-' + status);
    }
}

// ================================================================
// VIEW SWITCHING
// ================================================================
function goToCargoModule() {
    var sess = getBotiSession();
    var modules = (sess && Array.isArray(sess.modules)) ? sess.modules : [];
    if (modules.indexOf('cargo') !== -1) {
        location.href = '../cargo-crm/';
    } else {
        showToast('📦 Модуль Посилки ще не підключений. Зверніться до BotiSystem для підключення.', 4000);
    }
}

function showPaxView(dir) {
    currentView = 'pax';
    currentDir = dir || 'all';
    document.getElementById('passengersView').classList.remove('hidden');
    document.getElementById('tripsView').classList.remove('active');
    document.getElementById('routesView').style.display = 'none';
    document.getElementById('archiveView').style.display = 'none';
    updatePcSidebarActive();
    updateMobileSidebarActive();
    updateNavActive('pax');
    render();
}

function showTripsView() {
    currentView = 'trips';
    document.getElementById('passengersView').classList.add('hidden');
    document.getElementById('tripsView').classList.add('active');
    document.getElementById('routesView').style.display = 'none';
    document.getElementById('archiveView').style.display = 'none';
    updatePcSidebarActive();
    updateMobileSidebarActive();
    updateNavActive('trips');
    renderTrips();
}

function showRoutesView() {
    currentView = 'routes';
    document.getElementById('passengersView').classList.add('hidden');
    document.getElementById('tripsView').classList.remove('active');
    document.getElementById('routesView').style.display = 'block';
    document.getElementById('archiveView').style.display = 'none';
    updatePcSidebarActive();
    updateMobileSidebarActive();
    updateNavActive('routes');
    if (routes.length === 0 && allRouteSheets.length === 0) loadRoutes();
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
        console.log('[loadRoutes] Запит getRoutesList → API_URL_ROUTES:', API_URL_ROUTES);
        const res = await apiPost('getRoutesList', { forceRefresh: !!forceRefresh });
        console.log('[loadRoutes] Відповідь:', JSON.stringify(res).substring(0, 500));
        loading.style.display = 'none';
        if (res.ok && res.data) {
            // Зберігаємо список аркушів (rows ще не завантажені)
            allRouteSheets = res.data.map(s => ({
                sheetName: s.sheetName,
                rowCount: s.rowCount,
                paxCount: s.paxCount || 0,
                parcelCount: s.parcelCount || 0,
                headers: [],
                rows: null // null = ще не завантажено
            }));
            routes = allRouteSheets.filter(s => {
                const n = (s.sheetName || '');
                return n && n !== 'Маршрут_Шаблон';
            });
            setCount('pcCountRoutes', routes.length);
            setCount('mobileCountRoutes', routes.length);
            renderRouteSidebar();
            renderRoutes();
            // Prefetch: завантажуємо дані всіх маршрутів паралельно у фоні
            routes.forEach(function(s, idx) {
                if (s.rows === null) loadRouteSheetData(idx, false).catch(function() {});
            });
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
    if (sheet.rows !== null && !forceRefresh) return; // вже завантажено

    // Показуємо лоадер тільки при першому завантаженні, не при фоновому оновленні
    const loading = document.getElementById('routesLoading');
    const showLoading = sheet.rows === null;
    if (loading && showLoading) {
        loading.style.display = 'block';
        loading.textContent = '⏳ Завантаження даних маршруту ' + (sheet.sheetName || '') + '...';
    }

    try {
        console.log('[loadRouteSheetData] Запит getRouteSheet:', sheet.sheetName);
        const res = await apiPost('getRouteSheet', { sheetName: sheet.sheetName, forceRefresh: !!forceRefresh });
        console.log('[loadRouteSheetData] Відповідь:', JSON.stringify(res).substring(0, 500));
        if (loading) loading.style.display = 'none';
        if (res.ok && res.data) {
            sheet.headers = res.data.headers || [];
            sheet.rows = res.data.rows || [];
            sheet.rowCount = res.data.rowCount || 0;
            // pickup/dropoff order arrays (stored on placeholder row)
            sheet.pickupOrder  = Array.isArray(res.data.pickup_order)  ? res.data.pickup_order  : [];
            sheet.dropoffOrder = Array.isArray(res.data.dropoff_order) ? res.data.dropoff_order : [];
            // Оновити також в allRouteSheets
            const allIdx = allRouteSheets.findIndex(s => s.sheetName === sheet.sheetName);
            if (allIdx !== -1) allRouteSheets[allIdx] = sheet;
            // Перерендерити якщо цей маршрут зараз відкритий
            if (currentView === 'routes' && activeRouteIdx === idx && !_showingExpenses) {
                renderRoutes();
            }
        } else {
            console.error('loadRouteSheetData API error:', res.error || 'Unknown error');
            showToast('❌ Помилка завантаження маршруту: ' + (res.error || 'Невідома помилка'));
            sheet.rows = [];
            sheet.rowCount = 0;
        }
    } catch (e) {
        if (loading) loading.style.display = 'none';
        console.error('loadRouteSheetData error:', e);
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

// ── Рендер списку маршрутів в сайдбарах ──
function renderRouteSidebar() {
    // Ховаємо лоадер
    const pcLoading = document.getElementById('pcRoutesLoading');
    if (pcLoading) pcLoading.style.display = 'none';

    // Оновлюємо лічильники: якщо rows завантажені — рахуємо з них, інакше — залишаємо з API
    routes.forEach(function(sheet) {
        if (sheet.rows !== null) {
            sheet.paxCount = sheet.rows.filter(r => (r['Тип запису'] || '').includes('Пасажир')).length;
            sheet.parcelCount = sheet.rows.filter(r => (r['Тип запису'] || '').includes('Посилк')).length;
        }
        // paxCount/parcelCount вже встановлені з getRoutesList якщо rows ще null
    });

    // PC sidebar
    const pcList = document.getElementById('pcRoutesList');
    if (pcList) {
        if (routes.length === 0) {
            pcList.innerHTML = '<div style="padding:10px 14px;font-size:11px;color:var(--text-secondary);">Немає маршрутів</div>';
        } else {
            pcList.innerHTML = routes.map((sheet, idx) => {
                const name = (sheet.sheetName || '');
                const isActive = activeRouteIdx === idx && currentView === 'routes';
                const pax = sheet.paxCount || 0;
                const parcels = sheet.parcelCount || 0;
                const countLabel = '👤<span style="color:#d97706;font-weight:800;">' + pax + '</span> 📦<span style="color:#d97706;font-weight:800;">' + parcels + '</span>';
                return `<div class="pc-sidebar-item route-sidebar-item${isActive ? ' active' : ''}" onclick="openRoute(${idx})" style="position:relative;">
                    <span>
                        <span class="item-icon">🗺️</span>
                        <span class="item-text">${name}</span>
                    </span>
                    <span class="item-count" style="font-size:9px;">${countLabel}</span>
                </div>`;
            }).join('');
        }
    }
    // Mobile sidebar
    const mobList = document.getElementById('mobileRoutesList');
    if (mobList) {
        if (routes.length === 0) {
            mobList.innerHTML = '<div style="padding:8px 14px;font-size:11px;color:rgba(255,255,255,0.5);">Немає маршрутів</div>';
        } else {
            mobList.innerHTML = routes.map((sheet, idx) => {
                const name = (sheet.sheetName || '');
                const pax = sheet.paxCount || 0;
                const parcels = sheet.parcelCount || 0;
                const countLabel = '👤<span style="color:#fbbf24;font-weight:800;">' + pax + '</span> 📦<span style="color:#fbbf24;font-weight:800;">' + parcels + '</span>';
                return `<div class="side-menu-item" onclick="openRoute(${idx}); closeSideMenu();" style="padding:8px 14px;font-size:12px;">
                    <span class="side-menu-item-left">🗺️ ${name}</span>
                    <span style="font-size:10px;letter-spacing:0.5px;">${countLabel}</span>
                </div>`;
            }).join('') + `<div class="side-menu-item" onclick="promptCreateRoute(); closeSideMenu();" style="color:#7c3aed;padding:8px 14px;font-size:12px;">
                <span class="side-menu-item-left">➕ Новий маршрут</span>
            </div>`;
        }
    }
}

function toggleMobileRoutesList() {
    toggleMobileSection('routes');
}

// ── Відкрити конкретний маршрут ──
var _routeForceRefresh = false;
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
function toggleRouteDash() {
    var content = document.getElementById('routeDashContent');
    var toggle = document.getElementById('routeDashToggle');
    if (!content) return;
    var isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    if (toggle) toggle.textContent = isOpen ? '▼' : '▲';
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

// ── Ідентифікатор ліда (PAX_ID / PKG_ID) рядка маршруту ──
// Обидва поля мапляться на одну БД-колонку `pax_id_or_pkg_id`, тому значення однакове.
function getRowLeadId(r) {
    return r && (r['PAX_ID'] || r['PKG_ID'] || '');
}

// ── Сортування рядків маршруту за збереженим порядком (масив PAX/PKG ID) ──
// Рядки, чий ID є в orderIds — виставляються в тому самому порядку.
// Решта (нові ліди, додані після збереження) — йдуть у кінець у вихідному порядку.
function sortRowsByStoredOrder(rows, orderIds) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return rows.slice();
    const idSet = new Set(orderIds);
    const byId = new Map();
    for (const r of rows) {
        const id = getRowLeadId(r);
        if (id && !byId.has(id)) byId.set(id, r);
    }
    const ordered = [];
    const used = new Set();
    for (const id of orderIds) {
        if (byId.has(id) && !used.has(id)) {
            ordered.push(byId.get(id));
            used.add(id);
        }
    }
    // Додати рядки, яких нема в збереженому порядку (нові або ті, що ще не сортувались)
    for (const r of rows) {
        const id = getRowLeadId(r);
        if (!id || !idSet.has(id) || !used.has(id)) {
            // Запобігти дублюванню для одного й того самого id
            if (id && used.has(id)) continue;
            ordered.push(r);
            if (id) used.add(id);
        }
    }
    return ordered;
}

// ── Перемикач режиму порядку (Збір / Висадка) ──
function setRouteSortMode(mode, btn) {
    if (mode !== 'pickup' && mode !== 'dropoff') return;
    if (mode === routeSortMode) return;

    // Якщо ми в sort mode і попередній режим має незбережені зміни —
    // не можна мовчки перемкнутись, бо це втратить дані.
    if (routeSortModeActive && _sortDirty) {
        const prevLabel = routeSortMode === 'dropoff' ? 'ВИСАДКИ' : 'ЗБОРУ';
        showConfirm(
            'У вас є незбережені зміни порядку <b>' + prevLabel + '</b>.<br><br>' +
            '<b>Так</b> — зберегти і перейти<br>' +
            '<b>Ні</b> — скасувати зміни і перейти',
            async function(yes) {
                const sheet = routes[activeRouteIdx];
                if (yes) {
                    // Save (silent — без confirm-діалогу всередині)
                    const savingMode = (_sortSnapshot && _sortSnapshot.mode) || routeSortMode;
                    const orderToSave = savingMode === 'dropoff'
                        ? (sheet.dropoffOrder || [])
                        : (sheet.pickupOrder  || []);
                    const payload = { sheetName: sheet.sheetName };
                    if (savingMode === 'dropoff') payload.dropoff_order = orderToSave;
                    else payload.pickup_order = orderToSave;
                    showLoader('Збереження порядку...');
                    try {
                        const res = await apiPost('setRouteOrder', payload);
                        hideLoader();
                        if (!res || !res.ok) {
                            showToast('❌ ' + ((res && res.error) || 'Не вдалося зберегти'));
                            return; // лишаємось у попередньому режимі
                        }
                        showToast('✅ Порядок ' + (savingMode === 'dropoff' ? 'висадки' : 'збору') + ' збережено');
                    } catch (e) {
                        hideLoader();
                        showToast('❌ ' + e.message);
                        return;
                    }
                } else {
                    // Discard — відкат до snapshot попереднього режиму
                    if (sheet && _sortSnapshot) _rollbackToSnapshot(sheet, _sortSnapshot);
                    showToast('↩️ Зміни попереднього режиму скасовано');
                }
                // Перемкнути режим + зробити новий snapshot для нового режиму
                routeSortMode = mode;
                _sortSnapshot = _takeSortSnapshot(sheet, mode);
                _sortDirty = false;
                _applySortModeUI(mode);
                updateSortBanner();
                renderRoutes();
            }
        );
        return;
    }

    routeSortMode = mode;
    // Якщо в режимі сортування (без dirty) — просто перезняти snapshot для нового режиму.
    if (routeSortModeActive) {
        const sheet = routes[activeRouteIdx];
        if (sheet) _sortSnapshot = _takeSortSnapshot(sheet, mode);
        _sortDirty = false;
        updateSortBanner();
    }
    _applySortModeUI(mode);
    renderRoutes();
}

// ── Синхронізувати UI-стан кнопок Збір/Висадка (захований в меню Статуси) ──
function _applySortModeUI(mode) {
    const pickupBtn  = document.getElementById('rteSortPickup');
    const dropoffBtn = document.getElementById('rteSortDropoff');
    if (pickupBtn)  pickupBtn.classList.toggle('active', mode === 'pickup');
    if (dropoffBtn) dropoffBtn.classList.toggle('active', mode === 'dropoff');
}

// ── Ініціалізація drag-and-drop (SortableJS) на списку маршруту ──
// Викликається ТІЛЬКИ у sort mode (коли routeSortModeActive === true).
// Поза sort mode drag-and-drop повністю вимкнено — картки read-only.
function initRouteSortable() {
    const list = document.getElementById('routesList');
    if (!list) return;
    // Якщо sort mode не активний — знищити instance (якщо був) і вийти.
    if (!routeSortModeActive) {
        if (_routeSortableInstance && typeof _routeSortableInstance.destroy === 'function') {
            try { _routeSortableInstance.destroy(); } catch (e) { /* ignore */ }
            _routeSortableInstance = null;
        }
        list.classList.remove('sort-mode-on');
        return;
    }
    if (typeof Sortable === 'undefined') {
        console.warn('SortableJS not loaded — drag-and-drop disabled');
        return;
    }
    // Знищити попередній instance (якщо є) — завжди перестворюємо після renderRoutes.
    if (_routeSortableInstance && typeof _routeSortableInstance.destroy === 'function') {
        try { _routeSortableInstance.destroy(); } catch (e) { /* ignore */ }
        _routeSortableInstance = null;
    }
    list.classList.add('sort-mode-on');
    _routeSortableInstance = Sortable.create(list, {
        animation: 150,
        // Без handle — вся картка захоплюється. Деталі/дії приховано,
        // короткий клік у sort mode нічого не відкриває (guard у toggleRouteDetails),
        // тож користувач безпечно тягне будь-де на картці.
        draggable: '.route-card',
        ghostClass: 'route-card-ghost',
        chosenClass: 'route-card-chosen',
        dragClass: 'route-card-drag',
        // Мобільна затримка ~350 мс: тримай палець на місці, щоб «схопити».
        // Якщо почнеш скролити раніше — браузер забирає touch на скрол (touch-action: pan-y).
        delay: 350,
        delayOnTouchOnly: true,
        // touchStartThreshold > 0: якщо палець зрушився більше ніж на N пікселів
        // під час delay — SortableJS СКАСОВУЄ підготовку drag, і touch лишається для скролу.
        touchStartThreshold: 8,
        // forceFallback вимкнено — щоб не перехоплювати touch за межами drag.
        // На мобільних SortableJS і так використовує touch polyfill.
        onEnd: handleRouteDrop
    });
}

// ── Обробник завершення drag'n'drop (filter-aware, ЛОКАЛЬНИЙ) ──
// У sort mode НЕ зберігає на сервер — лише оновлює локальний порядок
// у sheet.pickupOrder / sheet.dropoffOrder і позначає _sortDirty=true.
// Збереження на сервер відбувається через saveRouteSortChanges().
function handleRouteDrop(evt) {
    try {
        if (!routeSortModeActive) return; // Параноя: drop поза sort mode — ігнорувати.
        if (activeRouteIdx < 0 || !routes[activeRouteIdx]) return;
        const sheet = routes[activeRouteIdx];

        // Повний старий порядок для поточного режиму.
        const activeOrder = routeSortMode === 'dropoff'
            ? (sheet.dropoffOrder || [])
            : (sheet.pickupOrder  || []);
        const rawRows = sheet.rows || [];
        const fullOrdered = sortRowsByStoredOrder(rawRows, activeOrder);
        const fullOldIds = fullOrdered.map(getRowLeadId).filter(Boolean);

        // Новий порядок видимих карток у DOM (після drag).
        const list = document.getElementById('routesList');
        if (!list) return;
        const visibleCards = list.querySelectorAll('.route-card[data-lead-id]');
        const newVisibleIds = [];
        visibleCards.forEach(c => {
            const id = c.getAttribute('data-lead-id');
            if (id) newVisibleIds.push(id);
        });
        if (newVisibleIds.length === 0) return;

        // Walk-and-substitute: на позиціях видимих елементів підставляємо новий порядок.
        // Приховані (через фільтр) залишаються на своїх місцях.
        const visibleSet = new Set(newVisibleIds);
        const fullNewIds = [];
        let vCursor = 0;
        for (const oldId of fullOldIds) {
            if (visibleSet.has(oldId)) {
                fullNewIds.push(newVisibleIds[vCursor] || oldId);
                vCursor++;
            } else {
                fullNewIds.push(oldId);
            }
        }

        // Якщо порядок не змінився — нічого не робити.
        if (fullNewIds.length === fullOldIds.length &&
            fullNewIds.every((id, i) => id === fullOldIds[i])) {
            return;
        }

        // ЛОКАЛЬНЕ оновлення (НЕ API!) — фактичне збереження буде по кнопці «💾 Зберегти».
        if (routeSortMode === 'dropoff') {
            sheet.dropoffOrder = fullNewIds;
        } else {
            sheet.pickupOrder = fullNewIds;
        }
        _sortDirty = true;
        updateSortBanner();
    } catch (e) {
        console.error('handleRouteDrop error:', e);
        showToast('❌ Помилка drag-and-drop: ' + e.message, 'error');
    }
}

// ── SORT MODE: вхід у режим сортування ──
async function enterRouteSortMode() {
    if (routeSortModeActive) return;
    if (activeRouteIdx === null || activeRouteIdx < 0 || !routes[activeRouteIdx]) {
        showToast('Оберіть маршрут');
        return;
    }
    const sheet = routes[activeRouteIdx];
    // Lazy-load: якщо рядки ще не підвантажені (напр. користувач натиснув
    // Сортувати одразу після відкриття маршруту), підтягнути їх з API.
    if (!sheet.rows) {
        showLoader('Завантаження маршруту...');
        try {
            await loadRouteSheetData(activeRouteIdx, true);
        } catch (e) {
            hideLoader();
            showToast('❌ Не вдалося завантажити маршрут: ' + (e && e.message || 'мережа'));
            return;
        }
        hideLoader();
    }
    const rawRows = (routes[activeRouteIdx] && routes[activeRouteIdx].rows) || [];
    if (rawRows.length < 2) {
        showToast('У маршруті менше 2 записів — нема що сортувати');
        return;
    }
    // Зняти snapshot ПОТОЧНОГО режиму (pickup або dropoff) для можливого rollback.
    _sortSnapshot = _takeSortSnapshot(routes[activeRouteIdx], routeSortMode);
    _sortDirty = false;
    routeSortModeActive = true;
    document.body.classList.add('route-sort-active');
    // Встановити beforeunload щоб не втратити зміни при закритті вкладки.
    window.addEventListener('beforeunload', _sortBeforeUnloadHandler);
    // Показати банер + нижню панель, оновити хінт.
    const banner = document.getElementById('routeSortBanner');
    const actionBar = document.getElementById('routeSortActionBar');
    if (banner) banner.style.display = 'flex';
    if (actionBar) actionBar.style.display = 'flex';
    updateSortBanner();
    // Перерендерити — renderRoutes() сам викличе initRouteSortable() з увімкненим SortableJS.
    renderRoutes();
    showToast('🔧 Режим сортування активний');
}

// ── Зняти snapshot порядку для заданого режиму (pickup | dropoff) ──
function _takeSortSnapshot(sheet, mode) {
    const order = mode === 'dropoff'
        ? (sheet.dropoffOrder || [])
        : (sheet.pickupOrder  || []);
    return { mode, order: order.slice() };
}

// ── Відкотити порядок до snapshot'а ──
function _rollbackToSnapshot(sheet, snap) {
    if (!snap) return;
    if (snap.mode === 'dropoff') {
        sheet.dropoffOrder = (snap.order || []).slice();
    } else {
        sheet.pickupOrder  = (snap.order || []).slice();
    }
}

// ── beforeunload handler (встановлюється/знімається при вході/виході з sort mode) ──
function _sortBeforeUnloadHandler(e) {
    if (_sortDirty) {
        e.preventDefault();
        e.returnValue = 'У вас незбережені зміни порядку в маршруті. Закрити сторінку?';
        return e.returnValue;
    }
}

// ── Оновити текст банера (мінімальний: іконка + позначка dirty) ──
function updateSortBanner() {
    const el = document.getElementById('routeSortBannerLabel');
    if (!el) return;
    const dot = _sortDirty ? ' ●' : '';
    el.textContent = '🔧 Режим сортування' + dot;
}

// ── SORT MODE: вихід з режиму (внутрішня чистка) ──
function _exitSortModeInternal() {
    routeSortModeActive = false;
    _sortSnapshot = null;
    _sortDirty = false;
    document.body.classList.remove('route-sort-active');
    window.removeEventListener('beforeunload', _sortBeforeUnloadHandler);
    const banner = document.getElementById('routeSortBanner');
    const actionBar = document.getElementById('routeSortActionBar');
    if (banner) banner.style.display = 'none';
    if (actionBar) actionBar.style.display = 'none';
    if (_routeSortableInstance && typeof _routeSortableInstance.destroy === 'function') {
        try { _routeSortableInstance.destroy(); } catch (e) { /* ignore */ }
        _routeSortableInstance = null;
    }
    const list = document.getElementById('routesList');
    if (list) list.classList.remove('sort-mode-on');
}

// ── SORT MODE: Зберегти зміни на сервер ──
async function saveRouteSortChanges() {
    if (!routeSortModeActive) return;
    if (activeRouteIdx === null || !routes[activeRouteIdx]) { _exitSortModeInternal(); renderRoutes(); return; }
    const sheet = routes[activeRouteIdx];
    const sheetName = sheet.sheetName || sheet.name;
    // Якщо нічого не мінялось — просто вихід без API-запиту.
    if (!_sortDirty) {
        _exitSortModeInternal();
        renderRoutes();
        showToast('Режим сортування вимкнено (без змін)');
        return;
    }
    const savingMode = (_sortSnapshot && _sortSnapshot.mode) || routeSortMode;
    const orderToSave = savingMode === 'dropoff'
        ? (sheet.dropoffOrder || [])
        : (sheet.pickupOrder  || []);
    const modeLabel = savingMode === 'dropoff' ? 'ВИСАДКИ' : 'ЗБОРУ';
    showConfirm(
        'Зберегти новий порядок <b>' + modeLabel + '</b> у маршруті «' + sheetName + '»?<br><br>' +
        '<span style="color:var(--text-secondary);font-size:11px;">Цей порядок побачать водії й інші менеджери після синхронізації.</span>',
        async function(yes) {
            if (!yes) return; // лишаємось у режимі сортування
            showLoader('Збереження порядку...');
            try {
                const payload = { sheetName };
                if (savingMode === 'dropoff') {
                    payload.dropoff_order = orderToSave;
                } else {
                    payload.pickup_order = orderToSave;
                }
                const res = await apiPost('setRouteOrder', payload);
                hideLoader();
                if (!res || !res.ok) {
                    showToast('❌ ' + ((res && res.error) || 'Не вдалося зберегти порядок'));
                    return;
                }
                _exitSortModeInternal();
                renderRoutes();
                showToast(savingMode === 'dropoff'
                    ? '✅ Порядок висадки збережено'
                    : '✅ Порядок збору збережено');
            } catch (e) {
                hideLoader();
                showToast('❌ Помилка: ' + e.message);
            }
        }
    );
}

// ── SORT MODE: Скасувати зміни та вийти з режиму ──
function cancelRouteSortChanges() {
    if (!routeSortModeActive) return;
    const sheet = routes[activeRouteIdx];
    // Якщо не було змін — просто вихід.
    if (!_sortDirty) {
        _exitSortModeInternal();
        renderRoutes();
        showToast('Режим сортування вимкнено');
        return;
    }
    showConfirm(
        'Скасувати всі зміни порядку?<br><br>' +
        '<span style="color:var(--danger);font-size:11px;">Незбережений порядок буде втрачено.</span>',
        function(yes) {
            if (!yes) return; // лишаємось у режимі редагування
            if (sheet && _sortSnapshot) _rollbackToSnapshot(sheet, _sortSnapshot);
            _exitSortModeInternal();
            renderRoutes();
            showToast('↩️ Зміни порядку скасовано');
        }
    );
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
    const rawRows = sheet.rows || [];
    const name = (sheet.sheetName || 'Маршрут');

    // Застосувати збережений порядок (pickup або dropoff) ДО фільтрації,
    // щоб фільтри лише приховували рядки, а відносний порядок лишався.
    const activeOrder = routeSortMode === 'dropoff'
        ? (sheet.dropoffOrder || [])
        : (sheet.pickupOrder || []);
    const rows = sortRowsByStoredOrder(rawRows, activeOrder);

    const paxCount = rawRows.length > 0 ? rawRows.filter(r => (r['Тип запису'] || '').includes('Пасажир')).length : (sheet.paxCount || 0);
    const parcelCount = rawRows.length > 0 ? rawRows.filter(r => (r['Тип запису'] || '').includes('Посилк')).length : (sheet.parcelCount || 0);

    // Show route header bar + filters
    if (headerBar) headerBar.style.display = 'block';
    if (headerEmpty) headerEmpty.style.display = 'none';
    if (filtersBar) filtersBar.style.display = 'block';
    if (title) title.textContent = '🚐 ' + name;
    if (subtitle) subtitle.textContent = '👤 ' + paxCount + ' пасажирів · 📦 ' + parcelCount + ' посилок · ' + rawRows.length + ' записів';
    _showingExpenses = false;
    updateRouteDashButtons();

    // Синхронізувати стан кнопок режиму Збір/Висадка
    const pickupBtn  = document.getElementById('rteSortPickup');
    const dropoffBtn = document.getElementById('rteSortDropoff');
    if (pickupBtn)  pickupBtn.classList.toggle('active', routeSortMode === 'pickup');
    if (dropoffBtn) dropoffBtn.classList.toggle('active', routeSortMode === 'dropoff');

    const filtered = getFilteredRouteRows(rows);
    let html = '';

    if (filtered.length === 0) {
        html += '<div style="padding:40px;text-align:center;color:var(--text-secondary);font-size:13px;">' +
            (rawRows.length === 0 ? 'Маршрут порожній — перенесіть посилки з головного списку' : 'Немає записів за обраним фільтром') + '</div>';
    } else {
        html += filtered.map((r, idx) => renderRouteCard(r, idx, sheet.sheetName)).join('');
    }

    list.innerHTML = html;
    renderRouteSidebar();
    updateRouteBulkToolbar();
    // Ініціалізувати drag-and-drop на списку маршруту (після innerHTML)
    initRouteSortable();
}

// ── Витрати маршруту: окремий вигляд замість карток маршруту ──
var _showingExpenses = false;
var CATEGORY_LABELS = { fuel:'⛽ Бензин', food:'🍔 Їжа', parking:'🅿️ Паркування', toll:'🛣️ Толл', fine:'⚠️ Штраф', customs:'🏛️ Митниця', topUp:'📱 Поповнення', other:'📝 Інше', tips:'💵 Чайові' };
var CATEGORY_COLORS = { fuel:'#f59e0b', food:'#f97316', parking:'#3b82f6', toll:'#8b5cf6', fine:'#ef4444', customs:'#10b981', topUp:'#06b6d4', other:'#6b7280', tips:'#ec4899' };

function updateRouteDashButtons() {
    var btnExp = document.getElementById('btnRouteExpenses');
    var btnBack = document.getElementById('btnRouteBack');
    if (btnExp) {
        btnExp.style.background = _showingExpenses ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)';
        btnExp.style.fontWeight = _showingExpenses ? '800' : '600';
        btnExp.style.display = _showingExpenses ? 'none' : '';
    }
    if (btnBack) btnBack.style.display = _showingExpenses ? '' : 'none';
}

function toggleRouteExpensesView() {
    if (_showingExpenses) {
        _showingExpenses = false;
        updateRouteDashButtons();
        renderRoutes();
        return;
    }
    _showingExpenses = true;
    updateRouteDashButtons();
    var sheet = routes[activeRouteIdx];
    if (!sheet) return;
    loadAndRenderExpenses(sheet.sheetName);
}

async function loadAndRenderExpenses(sheetName) {
    var list = document.getElementById('routesList');
    var filtersBar = document.getElementById('routeFiltersBar');
    if (filtersBar) filtersBar.style.display = 'none';
    if (!list) return;

    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);"><div style="font-size:30px;margin-bottom:8px;">⏳</div><div style="font-size:13px;">Завантаження витрат...</div></div>';

    var expSheetName = sheetName.replace('Маршрут_', 'Витрати_');

    try {
        var data = await apiPost('getExpenses', { sheetName: expSheetName });

        if (!data.ok && !data.success) {
            list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">❌ ' + (data.error || 'Помилка') + '</div>';
            return;
        }

        var items = data.items || [];
        var advance = data.advance;
        var html = '';

        // ── Статистика ──
        var byCurrency = {};
        items.forEach(function(e) {
            var cur = e.currency || 'CHF';
            byCurrency[cur] = (byCurrency[cur] || 0) + e.amount;
        });

        html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">';

        // Аванс
        if (advance && (advance.cash > 0 || advance.card > 0)) {
            html += '<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 22px;flex:1;min-width:140px;">';
            html += '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">💳 Аванс</div>';
            if (advance.cash > 0) html += '<div style="font-size:24px;font-weight:800;color:var(--text-primary);">' + advance.cash + ' <span style="font-size:14px;color:var(--text-secondary);">' + advance.cashCurrency + '</span></div>';
            if (advance.card > 0) html += '<div style="font-size:24px;font-weight:800;color:var(--text-primary);">' + advance.card + ' <span style="font-size:14px;color:var(--text-secondary);">' + advance.cardCurrency + '</span></div>';
            html += '</div>';
        }

        // Витрачено
        var curEntries = Object.entries(byCurrency);
        html += '<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 22px;flex:1;min-width:140px;">';
        html += '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">💰 Витрачено</div>';
        if (curEntries.length === 0) {
            html += '<div style="font-size:24px;font-weight:800;color:var(--text-secondary);">0</div>';
        } else {
            curEntries.forEach(function(e) {
                html += '<div style="font-size:24px;font-weight:800;color:var(--text-primary);">' + e[1].toFixed(2) + ' <span style="font-size:14px;color:var(--text-secondary);">' + e[0] + '</span></div>';
            });
        }
        html += '</div>';

        // Залишок
        if (advance && (advance.cash > 0 || advance.card > 0)) {
            var advTotal = advance.cash + advance.card;
            var advCur = advance.cashCurrency || advance.cardCurrency || 'UAH';
            var spent = byCurrency[advCur] || 0;
            var remaining = advTotal - spent;
            var isPositive = remaining >= 0;
            html += '<div style="background:' + (isPositive ? '#f0fdf4' : '#fef2f2') + ';border:1px solid ' + (isPositive ? '#bbf7d0' : '#fecaca') + ';border-radius:14px;padding:18px 22px;flex:1;min-width:140px;">';
            html += '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">📊 Залишок</div>';
            html += '<div style="font-size:24px;font-weight:800;color:' + (isPositive ? '#16a34a' : '#dc2626') + ';">' + remaining.toFixed(2) + ' <span style="font-size:14px;color:var(--text-secondary);">' + advCur + '</span></div>';
            html += '</div>';
        }

        // Записів
        html += '<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 22px;flex:1;min-width:100px;text-align:center;">';
        html += '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">📋 Записів</div>';
        html += '<div style="font-size:24px;font-weight:800;color:var(--text-primary);">' + items.length + '</div>';
        html += '</div>';

        html += '</div>';

        // ── Список записів ──
        if (items.length === 0) {
            html += '<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:14px;">Витрат ще немає</div>';
        } else {
            html += '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:10px;">Записи витрат</div>';
            items.forEach(function(e) {
                var color = CATEGORY_COLORS[e.category] || '#6b7280';
                var label = CATEGORY_LABELS[e.category] || e.category;
                html += '<div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;">';
                html += '<div style="width:42px;height:42px;border-radius:10px;background:' + color + '20;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">' + (CATEGORY_LABELS[e.category] || '📝').split(' ')[0] + '</div>';
                html += '<div style="flex:1;min-width:0;">';
                html += '<div style="font-size:14px;font-weight:700;color:var(--text-primary);">' + label.split(' ').slice(1).join(' ') + '</div>';
                if (e.description) html += '<div style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + e.description + '</div>';
                html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' + (e.dateTrip || '') + ' · ' + (e.driver || '') + '</div>';
                html += '</div>';
                html += '<div style="text-align:right;flex-shrink:0;margin-right:8px;">';
                html += '<div style="font-size:18px;font-weight:800;color:var(--text-primary);">' + e.amount + '</div>';
                html += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);">' + (e.currency || 'CHF') + '</div>';
                html += '</div>';
                html += '</div>';
            });
        }

        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Помилка: ' + e.message + '</div>';
    }
}

// ── Рендер картки ліда маршруту (card-style як в CRM) ──
function renderRouteCard(r, idx, sheetName) {
    const rteId = r['RTE_ID'] || r['PAX_ID / PKG_ID'] || r['PAX_ID/PKG_ID'] || ('row_' + idx);
    r._resolvedId = rteId; // зберігаємо для пошуку
    const type = r['Тип запису'] || '';
    // Для посилок основне ПІБ у БД лежить у sender_name ('Піб відправника'),
    // а passenger_name порожній. Fallback щоб картка не показувала "—".
    const name = r['Піб пасажира'] || r['Піб відправника'] || '—';
    const phone = String(r['Телефон пасажира'] || r['Телефон відправника'] || '—');
    const recipName = r['Піб отримувача'] || '';
    const recipPhone = String(r['Телефон отримувача'] || '');
    const ttn = r['Номер ТТН'] || '';
    const desc = r['Опис'] || r['Опис посилки'] || '';
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
    // Для посилок у заголовку — пара "відправник → отримувач" і телефон отримувача
    // (саме йому водій дзвонить при доставці). Для пасажирів — як було.
    const headerName = isPax ? name : (`${name || '—'} → ${recipName || '—'}`);
    const headerPhone = isPax ? phone : (recipPhone || phone);
    const cleanPhone = (headerPhone || '').replace(/[^+\d]/g, '');
    const leadId = r['PAX_ID'] || r['PKG_ID'] || '';

    // Для пасажира — старий плаский grid (не чіпаємо).
    // Для посилки — 4 вкладки (Посилка/Фінанси/Рейс/Примітка) як в cargo-crm.
    const allFields = [
        {label: 'ПІБ', key: 'Піб пасажира', value: name},
        {label: 'Телефон', key: 'Телефон пасажира', value: phone},
        {label: 'Тел. реєстратора', key: 'Телефон реєстратора', value: phoneReg},
        {label: 'Напрям', key: 'Напрям', value: direction},
        {label: 'Дата рейсу', key: 'Дата рейсу', value: displayDate},
        {label: 'Кількість місць', key: 'Кількість місць', value: seats},
        {label: 'Номер авто', key: 'Номер авто', value: auto},
        {label: 'Місце в авто', key: 'Місце в авто', value: seat},
        {label: 'Водій', key: 'Водій', value: driver},
        {label: 'Адреса відправки', key: 'Адреса відправки', value: from},
        {label: 'Адреса прибуття', key: 'Адреса прибуття', value: to},
        {label: 'Сума', key: 'Сума', value: price},
        {label: 'Валюта', key: 'Валюта', value: curr},
        {label: 'Завдаток', key: 'Завдаток', value: deposit},
        {label: 'Валюта завдатку', key: 'Валюта завдатку', value: depositCurr},
        {label: 'Вага багажу', key: 'Вага багажу', value: weight},
        {label: 'Ціна багажу', key: 'Ціна багажу', value: weightPrice},
        {label: 'Валюта багажу', key: 'Валюта багажу', value: weightCurr},
        {label: 'Статус оплати', key: 'Статус оплати', value: payStatus},
        {label: 'Статус', key: 'Статус', value: status},
        {label: 'Примітка', key: 'Примітка', value: note}
    ];

    // Поля табу "Посилка" для !isPax — дзеркало cargo-crm.
    const pkgContactsFields = [
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
    const pkgFinanceFields = [
        {label: 'Сума', key: 'Сума', value: price},
        {label: 'Валюта', key: 'Валюта', value: curr},
        {label: 'Завдаток', key: 'Завдаток', value: deposit},
        {label: 'Валюта завдатку', key: 'Валюта завдатку', value: depositCurr},
        {label: 'Статус оплати', key: 'Статус оплати', value: payStatus},
        {label: 'Ціна багажу', key: 'Ціна багажу', value: weightPrice},
        {label: 'Валюта багажу', key: 'Валюта багажу', value: weightCurr},
    ];
    const pkgTripFields = [
        {label: 'Дата рейсу', key: 'Дата рейсу', value: displayDate},
        {label: 'Кількість місць', key: 'Кількість місць', value: seats},
        {label: 'Номер авто', key: 'Номер авто', value: auto},
        {label: 'Місце в авто', key: 'Місце в авто', value: seat},
        {label: 'Водій', key: 'Водій', value: driver},
        {label: 'Адреса відправки', key: 'Адреса відправки', value: from},
        {label: 'Адреса прибуття', key: 'Адреса прибуття', value: to},
    ];
    const pkgNoteFields = [
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
            ${isPax ? `
            <div class="details-grid">
                ${allFields.map(f => {
                    const val = f.value || '—';
                    const safeVal = String(f.value || '').replace(/'/g, "\\'");
                    const safeKey = f.key.replace(/'/g, "\\'");
                    return `<div class="detail-block">
                        <div class="detail-block-label">${f.label}</div>
                        <div class="detail-block-value" id="rdv-${rteId}-${f.key}">${val}</div>
                        <div class="detail-block-actions">
                            <button class="detail-micro-btn" onclick="event.stopPropagation(); startRouteInlineEdit('${rteId}','${safeKey}','${safeSheet}')">✏️</button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
            ` : `
            <div class="detail-tabs">
                <div class="detail-tab active" data-tab="contacts" onclick="event.stopPropagation(); switchRouteTab('${rteId}','contacts')">📦 Посилка</div>
                <div class="detail-tab" data-tab="finance" onclick="event.stopPropagation(); switchRouteTab('${rteId}','finance')">💰 Фінанси</div>
                <div class="detail-tab" data-tab="trip" onclick="event.stopPropagation(); switchRouteTab('${rteId}','trip')">🚖 Рейс</div>
                <div class="detail-tab" data-tab="note" onclick="event.stopPropagation(); switchRouteTab('${rteId}','note')">📝 Примітка</div>
            </div>
            <div class="detail-tab-panel active" data-tab-panel="contacts">${renderRouteFieldsGrid(pkgContactsFields)}</div>
            <div class="detail-tab-panel" data-tab-panel="finance">${renderRouteFieldsGrid(pkgFinanceFields)}</div>
            <div class="detail-tab-panel" data-tab-panel="trip">${renderRouteFieldsGrid(pkgTripFields)}</div>
            <div class="detail-tab-panel" data-tab-panel="note">${renderRouteFieldsGrid(pkgNoteFields)}</div>
            `}
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

// ── Перемикач вкладок розгорнутої картки маршруту (лише для посилок) ──
function switchRouteTab(rteId, tabName) {
    const card = document.getElementById('rte-details-' + rteId);
    if (!card) return;
    card.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    card.querySelectorAll('.detail-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tabPanel === tabName));
}

// ── Деталі картки маршруту ──
function toggleRouteDetails(rteId) {
    // У режимі сортування картки — клік нічого не робить.
    // Тап + утримання → drag, короткий тап → ігнор (щоб не відкривати деталі).
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
var _routeToolbarForceOpen = false;

function toggleRouteSelectAll() {
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    const filtered = getFilteredRouteRows(sheet.rows || []);
    const allSelected = filtered.length > 0 && filtered.every(r => routeSelectedIds.has(r._resolvedId || r['RTE_ID']));
    if (allSelected) {
        // Всі вибрані — знімаємо всі
        routeSelectedIds.clear();
    } else {
        // Не всі вибрані — вибираємо всі
        filtered.forEach(r => routeSelectedIds.add(r._resolvedId || r['RTE_ID']));
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
    const row = (sheet.rows || []).find(r => r._resolvedId === rteId || r['RTE_ID'] === rteId);
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
    const row = (sheet.rows || []).find(r => r._resolvedId === rteId || r['RTE_ID'] === rteId);
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
    const row = (sheet.rows || []).find(r => r._resolvedId === rteId || r['RTE_ID'] === rteId);
    if (!row) return;
    const el = document.getElementById('rdv-' + rteId + '-' + colName);
    if (el) el.textContent = row[colName] || '—';
}

// ── Редагувати лід маршруту через модалку ──
function openRouteEditModal(rteId, sheetName) {
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    const r = (sheet.rows || []).find(row => row._resolvedId === rteId || row['RTE_ID'] === rteId);
    if (!r) return;

    // Використовуємо ту саму модалку пасажира але з route-контекстом
    editingPaxId = rteId;
    document.getElementById('paxModalTitle').textContent = '✏️ Редагувати (маршрут)';
    document.getElementById('smsParserWrap').style.display = 'none';
    document.getElementById('duplicateWarning').className = 'duplicate-warning';
    document.getElementById('duplicateWarning').textContent = '';

    const dir = String(r['Напрям'] || '').toLowerCase().trim();
    const isEuUa = dir.startsWith('єв') || dir.startsWith('eu') || dir.startsWith('європа');
    document.getElementById('fDirection').value = isEuUa ? 'eu-ua' : 'ua-eu';
    document.getElementById('fName').value = r['Піб пасажира'] || '';
    document.getElementById('fPhone').value = r['Телефон пасажира'] || '';
    document.getElementById('fPhoneReg').value = r['Телефон реєстратора'] || '';
    document.getElementById('fSeats').value = r['Кількість місць'] || 1;
    // Route points: заповнюємо datalist автопідказок + ставимо текст як є.
    // Вільний текст для legacy-лідів одразу видно й можна редагувати.
    resetRoutePointInputs();
    document.getElementById('fFrom').value = r['Адреса відправки'] || '';
    document.getElementById('fTo').value = r['Адреса прибуття'] || '';
    document.getElementById('fPrice').value = r['Сума'] || '';
    document.getElementById('fDeposit').value = r['Завдаток'] || '';
    document.getElementById('fTiming').value = '';
    document.getElementById('fWeight').value = r['Вага багажу'] || '';
    document.getElementById('fWeightPrice').value = r['Ціна багажу'] || '';
    document.getElementById('fNote').value = r['Примітка'] || '';
    const _set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    _set('fMessenger', r['Месенджер']);
    _set('fSeatNumber', r['Місце в авто']);
    _set('fPayStatus', r['Статус оплати']);
    _set('fPayForm', r['Форма оплати']);
    _set('fTag', r['Тег']);

    const rawDate = r['Дата рейсу'] || '';
    let dateVal = '';
    if (rawDate) {
        const s = String(rawDate);
        if (s.includes('T')) dateVal = s.split('T')[0];
        else if (s.match(/^\d{4}-\d{2}-\d{2}$/)) dateVal = s;
        else if (s.match(/^\d{2}\.\d{2}\.\d{4}$/)) { const pts = s.split('.'); dateVal = pts[2]+'-'+pts[1]+'-'+pts[0]; }
    }
    document.getElementById('fDate').value = dateVal;

    const currEl = document.getElementById('fCurrency');
    if (currEl) currEl.value = r['Валюта'] || 'EUR';
    const currDepEl = document.getElementById('fCurrencyDeposit');
    if (currDepEl) currDepEl.value = r['Валюта завдатку'] || 'EUR';
    const currWtEl = document.getElementById('fCurrencyWeight');
    if (currWtEl) currWtEl.value = r['Валюта багажу'] || 'EUR';

    const saveBtn = document.getElementById('paxSaveBtn');
    if (saveBtn) {
        saveBtn.textContent = '💾 Оновити';
        saveBtn.setAttribute('data-route-sheet', sheetName);
    }
    openModal('passengerModal');
}

// ── Видалити лід з маршруту ──
async function deleteFromRoute(rteId, sheetName, leadName) {
    showConfirm('Прибрати «' + leadName + '» з маршруту? (лід залишиться в CRM)', async (yes) => {
        if (!yes) return;
        const sheet = routes[activeRouteIdx];
        const row = sheet ? (sheet.rows || []).find(r => r._resolvedId === rteId || r['RTE_ID'] === rteId) : null;
        const idInfo = row ? getRouteRowIdInfo(row) : { id_col: 'RTE_ID', id_val: rteId };
        showLoader('Видалення з маршруту...');
        const res = await apiPost('deleteFromSheet', { sheet: sheetName, id_col: idInfo.id_col, id_val: idInfo.id_val });
        hideLoader();
        if (res.ok) {
            if (sheet) sheet.rows = (sheet.rows || []).filter(r => (r._resolvedId || r['RTE_ID']) !== rteId);
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
        // Збираємо інфо для видалення по кожному рядку
        const deleteInfos = [];
        for (const row of (sheet.rows || [])) {
            const resolvedId = row._resolvedId || row['RTE_ID'];
            if (!routeSelectedIds.has(resolvedId)) continue;
            const idInfo = getRouteRowIdInfo(row);
            if (idInfo) deleteInfos.push({ ...idInfo, resolvedId });
        }
        let ok = 0, fail = 0;
        for (const info of deleteInfos) {
            const res = await apiPost('deleteFromSheet', { sheet: sheet.sheetName, id_col: info.id_col, id_val: info.id_val });
            if (res.ok) { ok++; sheet.rows = (sheet.rows || []).filter(r => (r._resolvedId || r['RTE_ID']) !== info.resolvedId); }
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

// ── Визначити правильну колонку та значення ID для рядка маршруту ──
function getRouteRowIdInfo(row) {
    if (row['RTE_ID']) return { id_col: 'RTE_ID', id_val: row['RTE_ID'] };
    if (row['PAX_ID / PKG_ID']) return { id_col: 'PAX_ID / PKG_ID', id_val: row['PAX_ID / PKG_ID'] };
    if (row['PAX_ID/PKG_ID']) return { id_col: 'PAX_ID/PKG_ID', id_val: row['PAX_ID/PKG_ID'] };
    return null;
}

// ── Очистити row від фронтенд-властивостей перед відправкою на бекенд ──
function cleanRowForApi(row) {
    const clean = {};
    for (const key of Object.keys(row)) {
        if (!key.startsWith('_')) clean[key] = row[key];
    }
    return clean;
}

// ── Нормалізація телефону для пошуку дублікатів ──
// 0671234567 = +380671234567 = 380671234567 → 671234567
function normalizePhoneForDup(s) {
    var digits = String(s || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.indexOf('380') === 0) digits = digits.slice(3);
    else if (digits.charAt(0) === '0') digits = digits.slice(1);
    return digits;
}

// ── Знайти дублікати в маршруті ──
// Перевіряє: 1) PAX_ID збіг, 2) телефон збіг (нормалізований)
// Повертає масив { name, phone, reason } для кожного дубля
function findRouteDuplicates(targetSheet, leadsToAdd, excludeRteIds) {
    if (!targetSheet || !Array.isArray(targetSheet.rows)) return [];
    var skip = excludeRteIds instanceof Set ? excludeRteIds : new Set(excludeRteIds || []);

    var existingPaxIds = new Set();
    var existingPhones = {}; // phone → name
    for (var i = 0; i < targetSheet.rows.length; i++) {
        var r = targetSheet.rows[i];
        if (!(String(r['Тип запису'] || '').indexOf('Пасажир') !== -1)) continue;
        // Пропустити рядки які зараз пересаджуємо (пересадка в той самий маршрут)
        var rid = r._resolvedId || r['RTE_ID'];
        if (rid && skip.has(rid)) continue;
        var pid = r['PAX_ID / PKG_ID'] || r['PAX_ID/PKG_ID'] || r['PAX_ID'] || r['PKG_ID'] || '';
        if (pid) existingPaxIds.add(String(pid));
        var ph = normalizePhoneForDup(r['Телефон пасажира']);
        if (ph && !existingPhones[ph]) existingPhones[ph] = r['Піб пасажира'] || '';
    }

    var dups = [];
    for (var j = 0; j < leadsToAdd.length; j++) {
        var lead = leadsToAdd[j];
        var leadPid = lead['PAX_ID'] || lead['PAX_ID / PKG_ID'] || lead['PAX_ID/PKG_ID'] || '';
        var leadPhone = normalizePhoneForDup(lead['Телефон пасажира']);
        var leadName = lead['Піб пасажира'] || lead['Піб'] || 'Без імені';
        var reason = null;
        if (leadPid && existingPaxIds.has(String(leadPid))) {
            reason = 'вже в цьому маршруті';
        } else if (leadPhone && existingPhones[leadPhone]) {
            var matchName = existingPhones[leadPhone];
            reason = matchName && matchName !== leadName
                ? 'телефон збігається з: ' + matchName
                : 'телефон вже в маршруті';
        }
        if (reason) dups.push({ name: leadName, reason: reason });
        // Додаємо лід в існуючі сети, щоб наступні ліди в цьому ж пакеті
        // могли бути виявлені як дублі (важливо для bulk додавання трьох
        // однакових лідів у пустий маршрут)
        if (leadPid) existingPaxIds.add(String(leadPid));
        if (leadPhone && !existingPhones[leadPhone]) existingPhones[leadPhone] = leadName;
    }
    return dups;
}

// ── Перевірити дублі і запитати підтвердження ──
// Повертає Promise<boolean>: true = можна продовжити, false = скасовано
function checkAndConfirmDuplicates(targetSheet, leadsData, excludeRteIds) {
    return new Promise(function(resolve) {
        var dups = findRouteDuplicates(targetSheet, leadsData, excludeRteIds);
        if (!dups.length) { resolve(true); return; }
        var list = dups.map(function(d) { return '• <b>' + d.name + '</b> — ' + d.reason; }).join('<br>');
        var word = dups.length === 1 ? 'дублікат' : (dups.length < 5 ? 'дублікати' : 'дублікатів');
        var msg = '⚠️ Знайдено ' + dups.length + ' ' + word + ' у маршруті:\n\n' + list + '\n\nВсе одно додати?';
        showConfirm(msg, function(yes) { resolve(!!yes); });
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

    document.getElementById('messengerPopupTitle').textContent = '🔄 Пересадити в маршрут:';
    const grid = document.getElementById('messengerGrid');
    grid.innerHTML = opts;
    document.getElementById('messengerOverlay').classList.add('show');
}

async function doTransferRouteLead(rteId, fromSheet, toSheet) {
    closeMessengerPopup();
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;
    const row = (sheet.rows || []).find(r => r._resolvedId === rteId || r['RTE_ID'] === rteId);
    if (!row) return;

    // Визначаємо правильну колонку і значення для видалення
    const idInfo = getRouteRowIdInfo(row);
    if (!idInfo) { showToast('❌ Не вдалося визначити ID запису'); return; }

    // Перевірка дублікатів у цільовому маршруті
    const targetIdx = routes.findIndex(function(r) { return r.sheetName === toSheet; });
    if (targetIdx !== -1) {
        const targetSheet = routes[targetIdx];
        if (targetSheet.rows === null || targetSheet.rows === undefined) {
            showLoader('Перевірка маршруту...');
            await loadRouteSheetData(targetIdx, false);
            hideLoader();
        }
        const canProceed = await checkAndConfirmDuplicates(targetSheet, [cleanRowForApi(row)]);
        if (!canProceed) return;
    }

    showLoader('Пересадка...');
    // Add to new route (без фронтенд-властивостей)
    const addRes = await apiPost('addToRoute', { sheetName: toSheet, leads: [cleanRowForApi(row)] });
    if (!addRes.ok) { hideLoader(); showToast('❌ ' + (addRes.error || 'Помилка додавання')); return; }
    // Delete from old route (з правильним id_col)
    const delRes = await apiPost('deleteFromSheet', { sheet: fromSheet, id_col: idInfo.id_col, id_val: idInfo.id_val });
    hideLoader();
    if (delRes.ok) {
        // Видаляємо зі старого маршруту
        sheet.rows = (sheet.rows || []).filter(r => (r._resolvedId || r['RTE_ID']) !== rteId);
        routeSelectedIds.delete(rteId);
        // Інвалідуємо дані цільового маршруту щоб при відкритті перезавантажив
        var targetRoute = routes.find(function(r) { return r.sheetName === toSheet; });
        if (targetRoute) { targetRoute.rows = null; targetRoute.paxCount = (targetRoute.paxCount || 0) + 1; }
        renderRouteSidebar();
        renderRoutes();
        showToast('✅ Пересаджено в ' + toSheet);
    } else {
        showToast('⚠️ Додано в новий маршрут, але не видалено зі старого: ' + (delRes.error || ''));
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

    document.getElementById('messengerPopupTitle').textContent = '🔄 Перенести ' + routeSelectedIds.size + ' записів в:';
    const grid = document.getElementById('messengerGrid');
    grid.innerHTML = opts;
    document.getElementById('messengerOverlay').classList.add('show');
}

async function doBulkTransfer(toSheet) {
    closeMessengerPopup();
    const sheet = routes[activeRouteIdx];
    if (!sheet) return;

    // Збираємо рядки для переносу та їхні ID-дані для видалення
    const leadsToMove = [];
    const deleteInfos = [];
    for (const row of (sheet.rows || [])) {
        const resolvedId = row._resolvedId || row['RTE_ID'];
        if (!routeSelectedIds.has(resolvedId)) continue;
        leadsToMove.push(cleanRowForApi(row));
        const idInfo = getRouteRowIdInfo(row);
        if (idInfo) deleteInfos.push({ ...idInfo, resolvedId });
    }

    if (leadsToMove.length === 0) { showToast('⚠️ Не знайдено записів для переносу'); return; }

    // Перевірка дублікатів у цільовому маршруті
    const targetIdx = routes.findIndex(function(r) { return r.sheetName === toSheet; });
    if (targetIdx !== -1) {
        const targetSheet = routes[targetIdx];
        if (targetSheet.rows === null || targetSheet.rows === undefined) {
            showLoader('Перевірка маршруту...');
            await loadRouteSheetData(targetIdx, false);
            hideLoader();
        }
        const canProceed = await checkAndConfirmDuplicates(targetSheet, leadsToMove);
        if (!canProceed) return;
    }

    showLoader('Пересадка ' + leadsToMove.length + ' записів...');
    const addRes = await apiPost('addToRoute', { sheetName: toSheet, leads: leadsToMove });
    if (!addRes.ok) { hideLoader(); showToast('❌ ' + (addRes.error || 'Помилка додавання')); return; }

    let ok = 0;
    let failed = 0;
    for (const info of deleteInfos) {
        const res = await apiPost('deleteFromSheet', { sheet: sheet.sheetName, id_col: info.id_col, id_val: info.id_val });
        if (res.ok) {
            ok++;
            sheet.rows = (sheet.rows || []).filter(r => (r._resolvedId || r['RTE_ID']) !== info.resolvedId);
        } else {
            failed++;
        }
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
    if (failed > 0) {
        showToast('⚠️ Перенесено: ' + ok + ', не видалено зі старого: ' + failed);
    } else {
        showToast('✅ Пересаджено: ' + ok + ' в ' + toSheet);
    }
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

function updatePcSidebarActive() {
    ['pcAllPax','pcNew24','pcUaEu','pcEuUa','pcTrips','pcArchive'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    document.querySelectorAll('.route-sidebar-item').forEach(el => el.classList.remove('active'));
    if (currentView === 'archive') {
        document.getElementById('pcArchive')?.classList.add('active');
    } else if (currentView === 'routes') {
        // active стан встановлюється в renderRouteSidebar
    } else if (currentView === 'trips') {
        document.getElementById('pcTrips')?.classList.add('active');
    } else {
        const map = { all:'pcAllPax', new24:'pcNew24', 'ua-eu':'pcUaEu', 'eu-ua':'pcEuUa' };
        document.getElementById(map[currentDir] || 'pcAllPax')?.classList.add('active');
    }
}

function updateMobileSidebarActive() {
    ['mobileAllPax','mobileNew24','mobileUaEu','mobileEuUa','mobileTrips'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    if (currentView === 'routes') {
        // active стан через openRoute
    } else if (currentView === 'trips') {
        document.getElementById('mobileTrips')?.classList.add('active');
    } else {
        const map = { all:'mobileAllPax', new24:'mobileNew24', 'ua-eu':'mobileUaEu', 'eu-ua':'mobileEuUa' };
        document.getElementById(map[currentDir] || 'mobileAllPax')?.classList.add('active');
    }
}

function updateNavActive(tab) {
    document.getElementById('navPax')?.classList.toggle('active', tab === 'pax');
}

// ================================================================
// COUNTS
// ================================================================
function updateAllCounts() {
    const allPax = passengers.filter(p => (p['Статус CRM'] || 'Активний') !== 'Архів');
    const uaeu = allPax.filter(p => isDir(p, 'ua-eu'));
    const euua = allPax.filter(p => isDir(p, 'eu-ua'));

    const new24 = allPax.filter(p => isNew24h(p));

    setCount('pcCountAll', allPax.length);
    setCount('pcCountNew24', new24.length);
    setCount('pcCountUaEu', uaeu.length);
    setCount('pcCountEuUa', euua.length);
    setCount('pcCountTrips', trips.length);
    setCount('mobileCountAll', allPax.length);
    setCount('mobileCountNew24', new24.length);
    setCount('mobileCountUaEu', uaeu.length);
    setCount('mobileCountEuUa', euua.length);
    setCount('mobileCountTrips', trips.length);

    // PWA Badge: лічильник на іконці додатку
    updateAppBadge(new24.length);

    // Оновити календар пасажирів
    renderPaxCalendar();
}

function setCount(id, n) { const el = document.getElementById(id); if (el) el.textContent = n; }

// PWA App Badge — показує лічильник на іконці додатку на телефоні
function updateAppBadge(count) {
    // 1. navigator.setAppBadge — працює на Android (Chrome PWA) та десктоп
    if ('setAppBadge' in navigator) {
        if (count > 0) {
            navigator.setAppBadge(count).catch(() => {});
        } else {
            navigator.clearAppBadge().catch(() => {});
        }
    }
    // 2. Оновлюємо title сторінки — видно в табах і на деяких платформах
    const _s = getBotiSession();
    const baseTitle = (_s && _s.tenant_name) ? _s.tenant_name + ' CRM' : 'BotiLogistics CRM';
    document.title = count > 0 ? '(' + count + ') ' + baseTitle : baseTitle;

    // 3. Динамічний favicon з лічильником (працює скрізь)
    if (count > 0) {
        updateFaviconBadge(count);
    } else {
        restoreOriginalFavicon();
    }
}

// Малюємо червоний кружок з числом на favicon
let _originalFaviconHref = null;
function updateFaviconBadge(count) {
    const link = document.querySelector('link[rel="icon"]');
    if (!link) return;
    if (!_originalFaviconHref) _originalFaviconHref = link.href;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        const size = 64;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);

        // Червоний кружок
        const r = size * 0.28;
        const cx = size - r - 2;
        const cy = r + 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Число
        ctx.fillStyle = 'white';
        ctx.font = 'bold ' + (r * 1.3) + 'px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(count > 99 ? '99+' : String(count), cx, cy + 1);

        link.href = c.toDataURL('image/png');
    };
    img.src = _originalFaviconHref;
}

function restoreOriginalFavicon() {
    if (_originalFaviconHref) {
        const link = document.querySelector('link[rel="icon"]');
        if (link) link.href = _originalFaviconHref;
    }
}

// Перевірка напрямку пасажира.
// ВАЖЛИВО: використовуємо startsWith замість includes, бо "Україна-Європа"
// містить і "Ук" і "Євр" — includes рахувало б лід в обидва напрямки!
function isDir(p, dir) {
    const d = String(p['Напрям'] || '').toLowerCase().trim();
    // "Україна-Європа" = ua-eu, "Європа-Україна" = eu-ua
    // Check what the direction STARTS with to avoid double-counting
    const startsUA = d.startsWith('ук') || d.startsWith('ua') || d.startsWith('україна');
    const startsEU = d.startsWith('єв') || d.startsWith('eu') || d.startsWith('європа');
    if (dir === 'ua-eu') return startsUA;
    if (dir === 'eu-ua') return startsEU;
    return true;
}

// ================================================================
// NEW 24H HELPER
// ================================================================
function isNew24h(p) {
    const raw = p['Дата створення'];
    if (!raw) return false;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return false;
    return (Date.now() - d.getTime()) < 24 * 60 * 60 * 1000;
}

// ================================================================
// FILTERS
// ================================================================
function applyFilters() { render(); }

function onSearchInput() {
    if (currentView === 'trips') return;
    render();
}

function getFilteredPassengers() {
    const search = (document.getElementById('globalSearch')?.value || '').toLowerCase().trim();
    const leadStatus = document.getElementById('filterLeadStatus')?.value || 'all';
    const payStatus = document.getElementById('filterPayStatus')?.value || 'all';
    const tripFilter = document.getElementById('filterTrip')?.value || 'all';

    return passengers.filter(p => {
        if ((p['Статус CRM'] || 'Активний') === 'Архів') return false;
        if (currentDir === 'new24') { if (!isNew24h(p)) return false; }
        else if (currentDir !== 'all' && !isDir(p, currentDir)) return false;
        if (leadStatus !== 'all' && p['Статус ліда'] !== leadStatus) return false;
        if (payStatus !== 'all' && p['Статус оплати'] !== payStatus) return false;
        if (tripFilter === 'none' && p['CAL_ID']) return false;
        if (tripFilter === 'none' && !p['CAL_ID']) { /* pass */ }
        else if (tripFilter !== 'all' && tripFilter !== 'none' && p['CAL_ID'] !== tripFilter) return false;
        // Фільтр по даті з календаря пасажирів
        if (paxCalSelectedDate) {
            var depDate = formatTripDate(p['Дата виїзду'] || '');
            if (depDate !== paxCalSelectedDate) return false;
        }
        if (search) {
            const name = String(p['Піб'] || '').toLowerCase();
            const phone = String(p['Телефон пасажира'] || '');
            if (!name.includes(search) && !phone.includes(search)) return false;
        }
        return true;
    });
}

function updateTripFilterDropdown() {
    const sel = document.getElementById('filterTrip');
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="all">Всі</option><option value="none">⚠️ Без рейсу</option>';
    trips.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.cal_id;
        opt.textContent = (t.city || '?') + ' ' + formatTripDate(t.date) + ' (' + (t.direction || '') + ')';
        sel.appendChild(opt);
    });
    sel.value = val;
}

// ================================================================
// RENDER PASSENGERS (CARDS)
// ================================================================
function render() {
    if (currentView !== 'pax') return;
    const list = document.getElementById('cardsList');
    const filtered = getFilteredPassengers();

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Немає пасажирів</div><div class="empty-state-sub">Додайте нового пасажира</div></div>';
        return;
    }

    list.innerHTML = filtered.map(p => renderCard(p)).join('');
}

function renderCard(p) {
    const id = p['PAX_ID'] || '';
    const dir = String(p['Напрям'] || '');
    const dirCode = getDirectionCode(dir);
    const isUaEu = dirCode === 'ua-eu';
    const dirLabel = isUaEu ? 'UA → EU' : 'EU → UA';
    const dirColorClass = isUaEu ? 'dir-badge-ua-eu' : 'dir-badge-eu-ua';
    const phone = String(p['Телефон пасажира'] || '');
    const cleanPhone = phone.replace(/[^+\d]/g, '');
    const seats = p['Кількість місць'] || 1;
    const date = formatTripDate(p['Дата виїзду'] || '');
    const price = p['Ціна квитка'] || '';
    const curr = p['Валюта квитка'] || '';
    const name = p['Піб'] || '';
    const calId = p['CAL_ID'] || '';
    const seatInCar = p['Місце в авто'] || '';
    const leadStatus = p['Статус ліда'] || '';
    const payStatus = p['Статус оплати'] || '';
    // --- Додаткові поля на картці ліда ---
    const fromAddr = p['Адреса відправки'] || '';   // Маршрут: адреса відправки
    const toAddr = p['Адреса прибуття'] || '';       // Маршрут: адреса прибуття
    const smartId = p['Ід_смарт'] || '';             // SmartSender ID (якщо є)
    const dateCreated = formatTripDate(p['Дата створення'] || ''); // Дата реєстрації (без часу)

    // Борг
    const priceN = parseFloat(p['Ціна квитка']) || 0;
    const wpN = parseFloat(p['Ціна багажу']) || 0;
    const depN = parseFloat(p['Завдаток']) || 0;
    const debt = Math.max(0, priceN + wpN - depN);

    const statusClass = leadStatus === 'Новий' ? 'status-new' : leadStatus === 'В роботі' ? 'status-work' : leadStatus === 'Підтверджено' ? 'status-confirmed' : leadStatus === 'Відмова' ? 'status-refused' : '';
    const isRecent24h = isNew24h(p);
    const isOpen = openDetailsId === id;
    const isActionsOpen = openActionsId === id;

    // --- Маршрут: рядок "📍 Львів 🗺 → Бенідорм 🗺" на картці ---
    // Кожна адреса клікабельна — відкриває Google Maps. Для точок з каталогу
    // (passenger_route_points) підтягнуться координати; для вільного тексту
    // Google сам спробує знайти.
    const safeFromAddr = fromAddr.replace(/'/g, "\\'");
    const safeToAddr = toAddr.replace(/'/g, "\\'");
    const fromMapBtn = fromAddr ? `<button class="card-route-map-btn" onclick="event.stopPropagation(); openRoutePointMap('${safeFromAddr}')" title="Відкрити в картах">🗺</button>` : '';
    const toMapBtn = toAddr ? `<button class="card-route-map-btn" onclick="event.stopPropagation(); openRoutePointMap('${safeToAddr}')" title="Відкрити в картах">🗺</button>` : '';
    const routeHtml = (fromAddr || toAddr)
        ? `<div class="card-route"><span class="card-route-icon">📍</span> <span class="card-route-text">${fromAddr || '?'}</span>${fromMapBtn} → <span class="card-route-text">${toAddr || '?'}</span>${toMapBtn}</div>`
        : '';

    // Trip strip — повна ширина внизу картки
    let tripStrip = '';
    const tripDDHtml = `<div class="trip-assign-dd" id="tripDD-${id}"></div>`;
    if (calId) {
        const trip = trips.find(t => t.cal_id === calId);
        const tripDate = trip ? formatTripDate(trip.date) : '';
        const tripCity = trip ? (trip.city || '') : '';
        const tripAuto = trip ? (trip.auto_name || '') : '';
        const tripFree = trip ? (parseInt(trip.free_seats) || 0) : '';
        tripStrip = `<div class="trip-assign-wrap" style="position:relative">
            <div class="card-trip-strip has-trip" onclick="event.stopPropagation(); toggleTripAssignDD('${id}')">
                <span class="card-trip-icon">🚐</span>
                <span class="card-trip-text">${tripDate} — ${tripCity}</span>
                <span class="card-trip-detail">${tripAuto}${tripFree !== '' ? ' · ' + tripFree + ' вільн.' : ''}</span>
                <span class="card-trip-arrow">›</span>
            </div>
            ${tripDDHtml}
        </div>`;
    } else {
        tripStrip = `<div class="trip-assign-wrap" style="position:relative">
            <div class="card-trip-strip no-trip" onclick="event.stopPropagation(); toggleTripAssignDD('${id}')">
                <span class="card-trip-icon">⚠️</span>
                <span class="card-trip-text empty">Без рейсу — натисніть щоб призначити</span>
                <span class="card-trip-arrow">›</span>
            </div>
            ${tripDDHtml}
        </div>`;
    }

    // Lead status badge
    const lsBadge = leadStatus === 'Новий' ? '<span class="badge badge-new">Новий</span>' :
        leadStatus === 'В роботі' ? '<span class="badge badge-work">В роботі</span>' :
        leadStatus === 'Підтверджено' ? '<span class="badge badge-confirmed">Підтверджено</span>' :
        leadStatus === 'Відмова' ? '<span class="badge badge-refused">Відмова</span>' : '';

    // Pay badge
    const payBadge = payStatus === 'Оплачено' ? '<span class="badge badge-paid">Оплачено</span>' :
        payStatus === 'Частково' ? '<span class="badge badge-partial">Частково</span>' :
        '<span class="badge badge-unpaid">Не оплачено</span>';

    // Trip date from assigned trip
    let tripDateStr = '';
    if (calId) {
        const trip = trips.find(t => t.cal_id === calId);
        if (trip) tripDateStr = formatTripDate(trip.date);
    }

    var cf = getCardFields();
    const justAddedClass = justAddedPaxId === id ? 'just-added' : '';

    return `<div class="lead-card ${statusClass} ${selectedIds.has(id)?'selected':''} ${justAddedClass}" data-pax-id="${id}">
        <div class="card-header" onclick="smartToggleDetails(event, '${id}')">
            <div class="card-header-top">
                <div class="card-checkbox-wrap" onclick="event.stopPropagation()">
                    <input class="card-checkbox" type="checkbox" ${selectedIds.has(id)?'checked':''} onchange="toggleSelect('${id}',this.checked)">
                </div>
                <div class="card-body">
                    <div class="card-top-row">
                        ${cf.includes('direction') ? `<span class="card-direction ${dirColorClass}">${dirLabel}</span>` : ''}
                        ${cf.includes('phone') ? `<span class="card-phone">${phone}</span>` : ''}
                        ${cf.includes('seats') ? `<span class="card-seats">${seats}м</span>` : ''}
                        ${cf.includes('date') ? `<span class="card-date">${date || '—'}</span>` : ''}
                        ${cf.includes('price') || cf.includes('deposit') ? `<div class="card-price-wrap">
                            ${cf.includes('price') ? `<span class="card-price">${price ? price + ' ' + curr : '—'}</span>` : ''}
                            ${cf.includes('deposit') ? `<span class="card-deposit ${depN > 0 ? 'has-deposit' : ''}">${depN > 0 ? 'завд: ' + depN + ' ' + (p['Валюта завдатку'] || curr) : 'без завдатку'}</span>` : ''}
                        </div>` : ''}
                    </div>
                    <div class="card-row2-wrap">
                        <div class="card-info-row">
                            ${cf.includes('pax_id') ? `<span class="card-id">${id}</span>` : ''}
                            ${cf.includes('smartId') ? `<span class="card-smart-id" onclick="event.stopPropagation(); copyToClipboard('${smartId || ''}'); this.style.background='#d8b4fe'; setTimeout(()=>this.style.background='',400);" title="Натисни щоб скопіювати">SS: ${smartId || '—'}</span>` : ''}
                            ${cf.includes('name') ? `<span class="card-name">${name}</span>` : ''}
                            ${isRecent24h ? '<span class="badge badge-new24">🆕 NEW</span>' : ''}
                            ${cf.includes('leadStatus') ? lsBadge : ''} ${cf.includes('payStatus') ? payBadge : ''}
                            ${cf.includes('debt') && debt > 0 ? '<span class="badge badge-debt">Борг: '+debt+'</span>' : ''}
                        </div>
                        ${cf.includes('route') ? routeHtml : ''}
                        <div class="card-meta-row">
                            ${cf.includes('tripDate') && tripDateStr ? '<span class="card-meta-tag">🗓 Рейс: '+tripDateStr+'</span>' : ''}
                            ${cf.includes('dateCreated') && dateCreated && dateCreated !== '—' ? '<span class="card-meta-tag">📅 Реєстр: '+dateCreated+'</span>' : ''}
                        </div>
                    </div>
                </div>
                <!-- Стрілочка ▼ розгортки меню дій (крутиться 180° при open) -->
                <div class="card-right-section">
                    <button class="card-actions-toggle ${isActionsOpen?'open':''}" onclick="event.stopPropagation(); toggleCardActions('${id}')" title="Дії">▼</button>
                </div>
            </div>
            ${tripStrip}
        </div>
        <div class="card-details ${isOpen?'show':''}" id="details-${id}">${isOpen ? renderDetails(p) : ''}</div>
        <!-- === ПАНЕЛЬ ДІЙ ЛІДА: 4 кнопки в ряд (flex). Показується при ▼ === -->
        <div class="card-actions ${isActionsOpen?'show':''}" id="actions-${id}">
            <button class="btn-card-action btn-call" onclick="window.open('tel:${cleanPhone}')">📞 Дзвінок</button>
            <button class="btn-card-action btn-write" onclick="event.stopPropagation(); openMessengerPopup('${cleanPhone}','${smartId}')">✉️ Писати</button>
            <button class="btn-card-action btn-edit" onclick="event.stopPropagation(); openEditPax('${id}')">✏️ Редагувати</button>
            <button class="btn-card-action" style="background:#ede9fe;color:#7c3aed;" onclick="event.stopPropagation(); toggleTripAssignDD('${id}')">🚐 Рейс</button>
            <button class="btn-card-action" style="background:#f3f4f6;color:#6b7280;" onclick="event.stopPropagation(); archivePax('${id}','${name}')">📦 Архів</button>
            <button class="btn-card-action btn-delete" onclick="deletePax('${id}','${p._sheet||''}','${name}')">🗑️ Видалити</button>
        </div>
    </div>`;
}

// ================================================================
// DETAILS PANEL
// ================================================================
function renderDetailFields(p, fields, isReadonly) {
    const ADDRESS_FIELDS = ['from','to'];
    let html = '<div class="details-grid">';
    fields.forEach(key => {
        const colName = COL_MAP[key] || key;
        const val = p[colName] || '';
        const isRO = READONLY_FIELDS.includes(key) || isReadonly;
        const DATE_KEYS = ['date','dateCreated','dateArchive'];
        const safeVal = String(val).replace(/'/g,"\\'");
        let displayVal = val || '—';
        // Format date fields (strip ISO time)
        if (DATE_KEYS.includes(key) && val && key !== 'timing') {
            displayVal = formatTripDate(val);
        }
        // Direction styled badge
        if (key === 'direction' && val) {
            const isUE = getDirectionCode(val) === 'ua-eu';
            const dLabel = isUE ? 'UA → EU' : 'EU → UA';
            const dCls = isUE ? 'dir-badge-ua-eu' : 'dir-badge-eu-ua';
            displayVal = `<span class="card-direction ${dCls}" style="font-size:13px;padding:4px 12px;">${dLabel}</span>`;
        }
        const mapBtn = (ADDRESS_FIELDS.includes(key) && val)
            ? `<button class="detail-micro-btn" onclick="event.stopPropagation(); openRoutePointMap('${safeVal}')" title="Карта">🗺️</button>`
            : '';
        html += `<div class="detail-block">
            <div class="detail-block-label">${colName}</div>
            <div class="detail-block-value ${val?'':'empty'}" id="dv-${p['PAX_ID']}-${key}">${displayVal}</div>
            ${!isRO ? `<div class="detail-block-actions">
                <button class="detail-micro-btn" onclick="event.stopPropagation(); startInlineEdit('${p['PAX_ID']}','${key}','${p._sheet||''}')">✏️</button>
                ${mapBtn}
                <button class="detail-micro-btn" onclick="event.stopPropagation(); copyToClipboard('${safeVal}')">📋</button>
            </div>` : `<div class="detail-block-actions">${mapBtn}<button class="detail-micro-btn" onclick="event.stopPropagation(); copyToClipboard('${safeVal}')">📋</button></div>`}
        </div>`;
    });
    html += '</div>';
    return html;
}

function renderDetails(p) {
    const sections = getDetailSections();
    const paxId = p['PAX_ID'];
    const savedTab = activeDetailTab[paxId] || sections[0].key;
    const savedIdx = sections.findIndex(s => s.key === savedTab);
    const activeIdx = savedIdx >= 0 ? savedIdx : 0;

    // Tabs row (horizontal)
    let tabsHtml = '<div class="detail-accordion-tabs">';
    sections.forEach((section, i) => {
        const countLabel = section.async ? '' : `<span class="tab-count">${section.fields.length}</span>`;
        tabsHtml += `<div class="detail-tab ${i===activeIdx?'active':''}" onclick="event.stopPropagation(); switchDetailTab('${paxId}','${section.key}',this)" data-section="${section.key}">
            ${section.title} ${countLabel}
        </div>`;
    });
    tabsHtml += '</div>';

    // Panels (render active tab immediately)
    let panelsHtml = '';
    sections.forEach((section, i) => {
        const panelId = `panel-${paxId}-${section.key}`;
        const isActive = i === activeIdx;
        panelsHtml += `<div class="detail-tab-panel ${isActive?'active':''}" id="${panelId}" data-section-key="${section.key}" data-pax-id="${paxId}" data-readonly="${section.readonly||false}" data-async="${section.async||false}">
            ${isActive ? (section.async && section.key === 'payments' ? '' : renderDetailFields(p, section.fields, section.readonly)) : ''}
        </div>`;
    });

    // Lazy-load payments if it's the active tab
    if (sections[activeIdx] && sections[activeIdx].async && sections[activeIdx].key === 'payments') {
        setTimeout(() => {
            const panel = document.getElementById(`panel-${paxId}-payments`);
            if (panel) loadPaymentsTab(paxId, panel);
        }, 0);
    }

    return tabsHtml + panelsHtml;
}

function switchDetailTab(paxId, sectionKey, tabEl) {
    // Find the card details container
    const card = tabEl.closest('.card-details');
    if (!card) return;

    // Зберігаємо активну вкладку
    activeDetailTab[paxId] = sectionKey;

    // Deactivate all tabs and panels
    card.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    card.querySelectorAll('.detail-tab-panel').forEach(p => p.classList.remove('active'));

    // Activate clicked tab
    tabEl.classList.add('active');

    // Activate target panel
    const panel = card.querySelector(`#panel-${paxId}-${sectionKey}`);
    if (!panel) return;
    panel.classList.add('active');

    // Lazy-load: render content on first open
    if (!panel.innerHTML.trim()) {
        const sections = getDetailSections();
        const section = sections.find(s => s.key === sectionKey);
        const p = passengers.find(x => x['PAX_ID'] === paxId);
        if (section && p) {
            if (section.async && sectionKey === 'payments') {
                loadPaymentsTab(paxId, panel);
            } else {
                panel.innerHTML = renderDetailFields(p, section.fields, section.readonly);
            }
        }
    }
}

// ================================================================
// PAYMENTS TAB — Async loading
// ================================================================
async function loadPaymentsTab(paxId, panel) {
    panel.innerHTML = '<div class="payments-loading"><span class="pay-spinner"></span> Завантаження платежів...</div>';

    // Використовуємо кеш якщо є
    if (paymentsCache[paxId]) {
        panel.innerHTML = renderPaymentsPanel(paxId, paymentsCache[paxId]);
        return;
    }

    const res = await apiPost('getPayments', { pax_id: paxId });
    if (res.ok) {
        paymentsCache[paxId] = res.data || [];
        panel.innerHTML = renderPaymentsPanel(paxId, res.data || []);
    } else {
        panel.innerHTML = '<div class="payments-empty">Помилка завантаження платежів</div>';
    }
}

function renderPaymentsPanel(paxId, payments) {
    if (!payments || payments.length === 0) {
        return '<div class="payments-empty">Платежів поки немає</div>';
    }

    let html = '<table class="payments-table"><thead><tr>';
    html += '<th>Дата</th><th>Сума</th><th>Валюта</th><th>Тип</th><th>Хто вніс</th><th>Борг після</th><th>Статус</th>';
    html += '</tr></thead><tbody>';

    let totalReceived = 0;
    let lastDebt = 0;
    let lastCurrency = '';

    payments.forEach(p => {
        const sum = parseFloat(p['Сума']) || 0;
        const isReturn = p['Тип платежу'] === 'Повернення';
        totalReceived += isReturn ? -sum : sum;
        lastDebt = parseFloat(p['Борг сума']) || 0;
        lastCurrency = p['Борг валюта'] || p['Валюта'] || '';

        html += `<tr>
            <td>${p['Дата створення'] || '—'}</td>
            <td style="font-weight:700;color:${isReturn ? 'var(--danger)' : 'var(--success)'}">${isReturn ? '-' : '+'}${sum}</td>
            <td>${p['Валюта'] || '—'}</td>
            <td>${p['Тип платежу'] || '—'}</td>
            <td>${p['Хто вніс'] || '—'}</td>
            <td style="font-weight:700;color:${lastDebt > 0 ? 'var(--danger)' : 'var(--success)'}">${p['Борг сума']}</td>
            <td>${p['Статус платежу'] || '—'}</td>
        </tr>`;
    });

    html += '</tbody></table>';

    // Підсумок
    const pax = passengers.find(x => x['PAX_ID'] === paxId);
    const currency = (pax && pax['Валюта квитка']) || lastCurrency || 'UAH';
    const currentDebt = pax ? calcDebtFrontend(pax) : lastDebt;

    html += `<div class="payments-summary">
        <div class="pay-sum-item">
            <span class="pay-sum-label">Загалом отримано:</span>
            <span class="pay-sum-value">${totalReceived} ${payments[0] ? payments[0]['Валюта'] || currency : currency}</span>
        </div>
        <div class="pay-sum-item">
            <span class="pay-sum-label">Поточний борг:</span>
            <span class="${currentDebt > 0 ? 'pay-sum-debt' : 'pay-sum-value'}">${currentDebt} ${currency}</span>
        </div>
    </div>`;

    return html;
}

function calcDebtFrontend(p) {
    const price = parseFloat(p['Ціна квитка']) || 0;
    const wp = parseFloat(p['Ціна багажу']) || 0;
    const dep = parseFloat(p['Завдаток']) || 0;
    return Math.max(0, price + wp - dep);
}

function openMap(address) {
    window.open('https://www.google.com/maps/search/' + encodeURIComponent(address), '_blank');
}

// Відкриває адресу у Google Maps. Якщо адреса починається з назви каталожної
// точки (passenger_route_points) — переходимо за збереженими координатами
// (точніше й швидше, ніж текстовий пошук). Інакше — звичайний пошук за текстом.
function openRoutePointMap(address) {
    if (!address) return;
    const str = String(address).trim();
    // Витягуємо "Місто" з "Місто — вул. ..." якщо є роздільник
    const cityPart = str.split(/\s+[—–-]\s+/)[0].trim();
    const point = routePointsByNameNorm[_normCityName(cityPart)];
    if (point && point.lat != null && point.lon != null) {
        // Для точок з адресною доставкою, якщо менеджер дописав адресу, відкриваємо
        // пошук за повним рядком адреси (щоб карта знайшла конкретний будинок),
        // інакше — прив'язуємось до координат локації (АЗС/вокзал).
        const hasExtraAddr = str !== cityPart;
        if (hasExtraAddr && point.delivery_mode === 'address_and_point') {
            window.open('https://www.google.com/maps/search/' + encodeURIComponent(str), '_blank');
        } else {
            window.open('https://www.google.com/maps/search/?api=1&query=' + point.lat + ',' + point.lon, '_blank');
        }
        return;
    }
    // Fallback — звичайний пошук за текстом (legacy ліди)
    window.open('https://www.google.com/maps/search/' + encodeURIComponent(str), '_blank');
}

// Розумний клік — не розгортати якщо юзер виділив текст або клікнув на інтерактивний елемент
function smartToggleDetails(e, id) {
    // Якщо є виділений текст — не розгортати (юзер копіює)
    var sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;

    // Якщо клік був на інтерактивному елементі — не розгортати
    var tag = e.target.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A' || tag === 'SELECT') return;
    if (e.target.closest && (e.target.closest('button') || e.target.closest('a') || e.target.closest('.card-trip-strip') || e.target.closest('.card-checkbox-wrap') || e.target.closest('.card-actions-toggle'))) return;

    toggleDetails(id);
}

function toggleDetails(id) {
    if (openDetailsId === id) {
        openDetailsId = null;
        delete activeDetailTab[id];
    } else {
        openDetailsId = id;
        const p = passengers.find(x => x['PAX_ID'] === id);
        if (p) {
            // При відкритті деталей — знімаємо статус "Новий" → "В роботі"
            if (p['Статус ліда'] === 'Новий') {
                p['Статус ліда'] = 'В роботі';
                const sheet = p._sheet || '';
                apiPost('updatePassenger', { pax_id: id, sheet, data: { leadStatus: 'В роботі' } });
                updateAllCounts();
            }
            const el = document.getElementById('details-' + id);
            if (el) el.innerHTML = renderDetails(p);
        }
    }
    render();
}

function toggleCardActions(id) {
    if (openActionsId === id) {
        openActionsId = null;
    } else {
        openActionsId = id;
        // Закриваємо деталі при відкритті дій — щоб не було хаосу на мобільному
        if (openDetailsId === id) {
            openDetailsId = null;
            delete activeDetailTab[id];
        }
    }
    render();
}

// ================================================================
// POPUP МЕСЕНДЖЕРІВ: Viber, Telegram, WhatsApp, SmartSender
// Відкривається кнопкою "Писати" з панелі дій ліда
// Popup = окремий overlay (#messengerOverlay) по центру екрану
// ================================================================

// Відкрити popup з кнопками месенджерів
// phone — телефон пасажира, smartId — ID SmartSender (може бути пустий)
function openMessengerPopup(phone, smartId) {
    document.getElementById('messengerPopupTitle').textContent = '✉️ Написати через:';
    const grid = document.getElementById('messengerGrid');
    const cleanPhone = (phone || '').replace(/[^+\d]/g, '');
    var smartBtn = `<button class="messenger-popup-item" onclick="openSmartSender('${smartId || ''}')">🤖 <span style="color:#ff6600">Smart</span></button>`;
    grid.innerHTML = `
        <button class="messenger-popup-item" onclick="closeMessengerPopup(); window.open('tel:${cleanPhone}')">📞 <span style="color:var(--primary)">Дзвінок</span></button>
        <button class="messenger-popup-item" onclick="openMessenger('viber','${cleanPhone}')">💬 <span style="color:#7360f2">Viber</span></button>
        <button class="messenger-popup-item" onclick="openMessenger('telegram','${cleanPhone}')">✈️ <span style="color:#0088cc">Telegram</span></button>
        <button class="messenger-popup-item" onclick="openMessenger('whatsapp','${cleanPhone}')">📱 <span style="color:#25d366">WhatsApp</span></button>
        ${smartBtn}
    `;
    document.getElementById('messengerOverlay').classList.add('show');
}

// Закрити popup месенджерів
function closeMessengerPopup() {
    document.getElementById('messengerOverlay').classList.remove('show');
}

// Відкрити конкретний месенджер з контактом
// type = 'viber' | 'telegram' | 'whatsapp' | 'smartsender'
// contact = телефон або smartsender ID
function openMessenger(type, contact) {
    closeMessengerPopup();
    if (!contact) { showToast('⚠️ Контакт не вказаний'); return; }
    var phone = contact.replace(/[^+\d]/g, '');
    var phoneNoPlus = phone.replace('+', '');
    switch (type) {
        case 'viber':
            window.open('viber://chat?number=%2B' + phoneNoPlus, '_blank');
            break;
        case 'telegram':
            window.open('https://t.me/+' + phoneNoPlus, '_blank');
            break;
        case 'whatsapp':
            window.open('https://wa.me/' + phoneNoPlus, '_blank');
            break;
    }
}

// ── Smart Sender: копіює ID + відкриває консоль пошуку контактів ──
// [ПРОЕКТ] Посилання Smart Sender — змінити для нового проекту:
const SMART_SENDER_CONSOLE_URL = 'https://console.smartsender.com/contacts?project=esko-proek-131349';
function openSmartSender(smartId) {
    closeMessengerPopup();
    if (!smartId || !smartId.trim()) { showToast('⚠️ Немає Ід_смарт'); return; }
    copyToClipboard(smartId.trim());
    showToast('📋 SS ID скопійовано — вставте в пошук');
    window.open(SMART_SENDER_CONSOLE_URL, '_blank');
}

// ================================================================
// РЕДАГУВАННЯ ПАСАЖИРА: відкриває ту саму форму що й "Додати",
// але всі поля заповнені існуючими даними ліда.
// Кнопка зберегти показує "Оновити" замість "Зберегти".
// При збереженні викликає apiPost('updatePassenger') замість addPassenger.
// editingPaxId = null → режим створення, інакше → режим редагування
// ================================================================
let editingPaxId = null;

// Відкрити форму редагування ліда з передзаповненими полями
function openEditPax(id) {
    const p = passengers.find(x => x['PAX_ID'] === id);
    if (!p) return;
    editingPaxId = id; // Запам'ятовуємо який лід редагуємо
    var sb = document.getElementById('paxSaveBtn'); if (sb) sb.removeAttribute('data-route-sheet');

    document.getElementById('paxModalTitle').textContent = '✏️ Редагувати пасажира';
    document.getElementById('smsParserWrap').style.display = 'none'; // Ховаємо SMS парсер при редагуванні
    document.getElementById('duplicateWarning').className = 'duplicate-warning';
    document.getElementById('duplicateWarning').textContent = '';

    // Заповнюємо всі поля форми існуючими даними ліда
    const dir = String(p['Напрям'] || '').toLowerCase().trim();
    const isEuUa = dir.startsWith('єв') || dir.startsWith('eu') || dir.startsWith('європа');
    document.getElementById('fDirection').value = isEuUa ? 'eu-ua' : 'ua-eu';
    document.getElementById('fName').value = p['Піб'] || '';
    document.getElementById('fPhone').value = p['Телефон пасажира'] || '';
    document.getElementById('fPhoneReg').value = p['Телефон реєстратора'] || '';
    document.getElementById('fSeats').value = p['Кількість місць'] || 1;
    // Route points: просто виставляємо збережений текст у combo-box поля.
    // Вільний текст (legacy або кастомний) одразу видно й можна редагувати.
    resetRoutePointInputs();
    document.getElementById('fFrom').value = p['Адреса відправки'] || '';
    document.getElementById('fTo').value = p['Адреса прибуття'] || '';
    document.getElementById('fPrice').value = p['Ціна квитка'] || '';
    // Позначаємо ціну як введену вручну, щоб авто-підстановка не перезаписала
    const _fp = document.getElementById('fPrice'); if (_fp) _fp.dataset.autoFilled = '';
    document.getElementById('fDeposit').value = p['Завдаток'] || '';
    document.getElementById('fTiming').value = p['Таймінг'] || '';
    document.getElementById('fWeight').value = p['Вага багажу'] || '';
    document.getElementById('fWeightPrice').value = p['Ціна багажу'] || '';
    document.getElementById('fNote').value = p['Примітка'] || '';
    const _setP = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    _setP('fMessenger', p['Месенджер']);
    _setP('fSeatNumber', p['Місце в авто']);
    _setP('fPayStatus', p['Статус оплати']);
    _setP('fPayForm', p['Форма оплати']);
    _setP('fTag', p['Тег']);

    // Date — convert from various formats to YYYY-MM-DD for input[type=date]
    const rawDate = p['Дата виїзду'] || '';
    let dateVal = '';
    if (rawDate) {
        const s = String(rawDate);
        if (s.includes('T')) {
            dateVal = s.split('T')[0];
        } else if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateVal = s;
        } else if (s.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
            const parts = s.split('.');
            dateVal = parts[2] + '-' + parts[1] + '-' + parts[0];
        }
    }
    document.getElementById('fDate').value = dateVal;

    // Currency
    const currEl = document.getElementById('fCurrency');
    if (currEl) currEl.value = p['Валюта квитка'] || 'UAH';
    const currDepEl = document.getElementById('fCurrencyDeposit');
    if (currDepEl) currDepEl.value = p['Валюта завдатку'] || 'UAH';
    const currWtEl = document.getElementById('fCurrencyWeight');
    if (currWtEl) currWtEl.value = p['Валюта багажу'] || 'UAH';

    const saveBtn = document.getElementById('paxSaveBtn');
    if (saveBtn) saveBtn.textContent = '💾 Оновити';
    openModal('passengerModal');
}

// ================================================================
// INLINE EDIT
// ================================================================
function startInlineEdit(paxId, key, sheet) {
    const p = passengers.find(x => x['PAX_ID'] === paxId);
    if (!p) return;
    const colName = COL_MAP[key] || key;
    const val = p[colName] || '';
    const el = document.getElementById('dv-' + paxId + '-' + key);
    if (!el) return;

    // Seat picker — visual modal instead of text input
    if (key === 'seatInCar') {
        openSeatPicker(paxId, sheet);
        return;
    }

    if (SELECT_OPTIONS[key]) {
        const opts = SELECT_OPTIONS[key].map(o => `<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('');
        el.innerHTML = `<select class="detail-inline-edit" onchange="saveInline('${paxId}','${key}','${sheet}',this.value)" onblur="cancelInline('${paxId}','${key}')">${opts}</select>`;
        el.querySelector('select').focus();
    } else if (key === 'date') {
        el.innerHTML = `<input class="detail-inline-edit" type="date" value="${val}" onchange="saveInline('${paxId}','${key}','${sheet}',this.value)" onblur="cancelInline('${paxId}','${key}')">`;
        el.querySelector('input').focus();
    } else {
        el.innerHTML = `<input class="detail-inline-edit" type="text" value="${val}" onkeydown="if(event.key==='Enter')saveInline('${paxId}','${key}','${sheet}',this.value);if(event.key==='Escape')cancelInline('${paxId}','${key}')" onblur="saveInline('${paxId}','${key}','${sheet}',this.value)">`;
        el.querySelector('input').focus();
    }
}

async function saveInline(paxId, key, sheet, newVal) {
    const colName = COL_MAP[key] || key;
    const p = passengers.find(x => x['PAX_ID'] === paxId);
    if (!p) return;
    const oldVal = p[colName] || '';
    if (String(newVal) === String(oldVal)) { cancelInline(paxId, key); return; }

    // Direction change → move between sheets
    if (key === 'direction') {
        const el = document.getElementById('dv-' + paxId + '-' + key);
        if (el) el.textContent = newVal || '—';
        const targetDir = String(newVal).includes('Європа') ? 'eu-ua' : 'ua-eu';
        showLoader('Зміна напряму...');
        const res = await apiPost('moveDirection', { pax_id: paxId, target_dir: targetDir });
        hideLoader();
        if (res.ok) {
            showToast('✅ Напрям змінено');
            silentSync();
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
            if (el) el.textContent = oldVal || '—';
        }
        return;
    }

    p[colName] = newVal;
    const el = document.getElementById('dv-' + paxId + '-' + key);
    if (el) el.textContent = formatFieldDisplay(key, newVal);

    const shName = sheet || p._sheet || '';
    const payload = { sheet: shName, pax_id: paxId, col: colName, value: newVal };
    // Передаємо ім'я менеджера при зміні завдатку
    if (key === 'deposit') {
        payload.manager = getManagerName();
    }
    const res = await apiPost('updateField', payload);
    if (res.ok) {
        showToast('✅ Збережено');
        // Інвалідуємо кеш платежів при зміні фінансових полів
        if (['deposit','price','weightPrice'].includes(key)) {
            delete paymentsCache[paxId];
            // Оновлюємо локальний борг та статус оплати
            const debt = calcDebtFrontend(p);
            p['Борг'] = debt;
            const dep = parseFloat(p['Завдаток']) || 0;
            if (dep === 0) p['Статус оплати'] = 'Не оплачено';
            else if (debt > 0) p['Статус оплати'] = 'Частково';
            else p['Статус оплати'] = 'Оплачено';
        }
        render();
    } else {
        showToast('❌ Помилка: ' + (res.error || ''));
        p[colName] = oldVal;
        if (el) el.textContent = formatFieldDisplay(key, oldVal);
    }
}

function formatFieldDisplay(key, val) {
    if (!val) return '—';
    const DATE_KEYS = ['date','dateCreated','dateArchive'];
    if (DATE_KEYS.includes(key)) return formatTripDate(val);
    return val;
}

function cancelInline(paxId, key) {
    const p = passengers.find(x => x['PAX_ID'] === paxId);
    if (!p) return;
    const colName = COL_MAP[key] || key;
    const el = document.getElementById('dv-' + paxId + '-' + key);
    if (el) el.textContent = formatFieldDisplay(key, p[colName]);
}

// ================================================================
// ADD / DELETE PASSENGER
// ================================================================
function openAddModal() {
    editingPaxId = null;
    document.getElementById('paxModalTitle').textContent = '➕ Новий пасажир';
    document.getElementById('duplicateWarning').className = 'duplicate-warning';
    document.getElementById('duplicateWarning').textContent = '';
    ['fName','fPhone','fPhoneReg','fFrom','fTo','fPrice','fDeposit','fTiming','fWeight','fWeightPrice','fNote'].forEach(id => {
        const el = document.getElementById(id); if (el) { el.value = ''; el.style.border = ''; el.style.backgroundColor = ''; }
    });
    ['fDate','fSeats','fDirection'].forEach(id => {
        const el = document.getElementById(id); if (el) { el.style.border = ''; el.style.backgroundColor = ''; }
    });
    document.getElementById('fSeats').value = '1';
    document.getElementById('fDate').value = '';
    document.getElementById('fDirection').value = currentDir === 'eu-ua' ? 'eu-ua' : 'ua-eu';
    document.getElementById('fCurrency').value = 'EUR';
    document.getElementById('fCurrencyDeposit').value = 'EUR';
    document.getElementById('fCurrencyWeight').value = 'EUR';
    // Route points: нічого попередньо рендерити не треба — dropdown
    // будується на open. Якщо каталог не готовий — фоново підтягнемо,
    // щоб при натиску ▼ одразу показати список.
    resetRoutePointInputs();
    if (routePointsLoadState !== 'ready') {
        ensureRoutePointsLoaded();
    }
    // Скидаємо SMS парсер
    document.getElementById('smsInput').value = '';
    document.getElementById('smsParseResult').style.display = 'none';
    document.getElementById('smsParserBody').style.display = 'block';
    document.getElementById('smsParserToggle').textContent = 'Згорнути ▲';
    document.getElementById('smsParserWrap').style.display = 'block';
    const saveBtn = document.getElementById('paxSaveBtn');
    if (saveBtn) saveBtn.textContent = '💾 Зберегти';
    openModal('passengerModal');
}

// ================================================================
// SMS PARSER — розпізнавання тексту повідомлення
// ================================================================
function toggleSmsParser() {
    const body = document.getElementById('smsParserBody');
    const btn = document.getElementById('smsParserToggle');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        btn.textContent = 'Згорнути ▲';
    } else {
        body.style.display = 'none';
        btn.textContent = 'Розгорнути ▼';
    }
}

// Словник міст для розпізнавання напряму та адреси
const KNOWN_CITIES_EU = ['цюріх','цюріха','цюріху','женева','женеви','женеву','берн','берна','базель','базеля','люцерн','люцерна','лозанна','лозанни','лозанну','берлін','берліна','берліну','мюнхен','мюнхена','мюнхену','франкфурт','франкфурта','гамбург','гамбурга','відень','відня','відні','прага','праги','прагу','празі','варшава','варшави','варшаву','краків','кракова','вроцлав','вроцлава','братислава','братислави','братиславу','будапешт','будапешта','будапешту','бухарест','бухареста','мілан','мілана','рим','рима','риму','париж','парижа','парижу','амстердам','амстердама','брюссель','брюсселя','мадрид','мадрида','мадриду','мадрід','мадріда','барселона','барселони','барселону','лісабон','лісабона'];
const KNOWN_CITIES_UA = ['київ','києва','києву','києві','львів','львова','львову','львові','одеса','одеси','одесу','одесі','харків','харкова','харкову','харкові','дніпро','дніпра','запоріжжя','запоріжжі','вінниця','вінниці','вінницю','тернопіль','тернополя','тернополі','івано-франківськ','івано-франківська','рівне','рівного','луцьк','луцька','чернівці','чернівців','ужгород','ужгорода','мукачево','мукачева','хмельницький','хмельницького','полтава','полтави','полтаву','черкаси','черкас','житомир','житомира','суми','сум','миколаїв','миколаєва','херсон','херсона','кропивницький','кропивницького','чернігів','чернігова'];

// Словник кількості
const NUM_WORDS = {'один':1,'одна':1,'одного':1,'два':2,'дві':2,'двох':2,'три':3,'трьох':3,'чотири':4,'чотирьох':4,"п'ять":5,'пять':5,'шість':6,'сім':7,'вісім':8,"дев'ять":9,'десять':10};

function parseSmsText() {
    const raw = document.getElementById('smsInput').value.trim();
    if (!raw) return;

    const text = raw.toLowerCase();
    const result = [];

    // 1. Дата: шукаємо формати dd.mm, dd.mm.yy, dd.mm.yyyy, dd/mm
    const dateMatch = text.match(/(\d{1,2})[\.\/](\d{1,2})(?:[\.\/](\d{2,4}))?/);
    if (dateMatch) {
        let day = dateMatch[1].padStart(2, '0');
        let month = dateMatch[2].padStart(2, '0');
        let year = dateMatch[3] || new Date().getFullYear().toString();
        if (year.length === 2) year = '20' + year;
        const dateStr = year + '-' + month + '-' + day;
        document.getElementById('fDate').value = dateStr;
        result.push('📅 Дата: ' + day + '.' + month + '.' + year);
        onDateChanged();
    }

    // 2. Телефон: міжнародні (+41.., +49.., +380..) та українські (0XX..., 380...)
    let phone = '';
    // Міжнародний формат: +XX... (від 9 до 15 цифр, можливі пробіли/тире/дужки)
    const intlMatch = raw.match(/(\+[\d\s\-()]{9,22})/);
    // Український формат: 0XXXXXXXXX або 380XXXXXXXXX
    const uaMatch = raw.match(/(?<!\d)\+?3?8?(0\d{9})(?!\d)/);
    if (intlMatch) {
        phone = intlMatch[1].replace(/[\s\-()]/g, '');
    } else if (uaMatch) {
        phone = '+380' + uaMatch[1].slice(1);
    }
    const phoneMatch = phone.length >= 10;
    if (phoneMatch) {
        document.getElementById('fPhone').value = phone;
        result.push('📞 Телефон: ' + phone);
    }

    // 3. Кількість місць
    let seats = 1;
    const seatsNumMatch = text.match(/(\d+)\s*(?:пасажир|місц|особ|людин|чоловік)/);
    if (seatsNumMatch) {
        seats = parseInt(seatsNumMatch[1]);
    } else {
        for (const [word, num] of Object.entries(NUM_WORDS)) {
            if (text.includes(word + ' пасажир') || text.includes(word + ' місц') || text.includes(word + ' особ') || text.includes(word + ' людин')) {
                seats = num; break;
            }
        }
    }
    if (seats > 1) {
        document.getElementById('fSeats').value = seats;
        result.push('💺 Місць: ' + seats);
    }

    // 4. Міста — визначаємо напрям та адреси
    let fromCity = '', toCity = '', direction = '';

    // Шукаємо формат "Місто-Місто" або "Місто до Місто" або "з Місто в Місто"
    const routeMatch = text.match(/(?:з\s+)?(\S+)\s*[-–—→⟶>]+\s*(\S+)/);
    const toMatch = text.match(/(?:до|в|на)\s+([а-яіїєґ']+)/i);
    const fromMatch = text.match(/(?:з|від|із)\s+([а-яіїєґ']+)/i);

    // Перевірка всіх відомих міст у тексті
    const foundEU = KNOWN_CITIES_EU.filter(c => text.includes(c));
    const foundUA = KNOWN_CITIES_UA.filter(c => text.includes(c));

    if (routeMatch) {
        const c1 = routeMatch[1].replace(/[,.:]/g, '');
        const c2 = routeMatch[2].replace(/[,.:]/g, '');
        const c1isUA = KNOWN_CITIES_UA.some(c => c1.includes(c));
        const c2isEU = KNOWN_CITIES_EU.some(c => c2.includes(c));
        const c1isEU = KNOWN_CITIES_EU.some(c => c1.includes(c));
        const c2isUA = KNOWN_CITIES_UA.some(c => c2.includes(c));
        if (c1isUA && c2isEU) { fromCity = c1; toCity = c2; direction = 'ua-eu'; }
        else if (c1isEU && c2isUA) { fromCity = c1; toCity = c2; direction = 'eu-ua'; }
        else { fromCity = c1; toCity = c2; }
    } else {
        if (toMatch) toCity = toMatch[1];
        if (fromMatch) fromCity = fromMatch[1];
        if (!fromCity && foundUA.length > 0) fromCity = foundUA[0];
        if (!toCity && foundEU.length > 0) toCity = foundEU[0];
    }

    // Визначаємо напрям якщо ще не визначено
    if (!direction) {
        const toCityLower = toCity.toLowerCase();
        const fromCityLower = fromCity.toLowerCase();
        if (KNOWN_CITIES_EU.some(c => toCityLower.includes(c))) direction = 'ua-eu';
        else if (KNOWN_CITIES_UA.some(c => toCityLower.includes(c))) direction = 'eu-ua';
        else if (KNOWN_CITIES_UA.some(c => fromCityLower.includes(c))) direction = 'ua-eu';
        else if (KNOWN_CITIES_EU.some(c => fromCityLower.includes(c))) direction = 'eu-ua';
    }

    if (direction) {
        document.getElementById('fDirection').value = direction;
        result.push('🧭 Напрям: ' + (direction === 'ua-eu' ? 'UA→EU' : 'EU→UA'));
    }
    // 4b. Конкретні адреси: "виїзд:", "відправка:", "забрати:", "прибуття:", "доставка:" тощо
    let fromAddress = '', toAddress = '';
    const addrFromMatch = raw.match(/(?:виїзд|відправ\w*|забрати|посадка|адреса\s+відправ\w*)\s*[:：]\s*(.+)/i);
    const addrToMatch = raw.match(/(?:прибут\w*|доставк\w*|привезти|висадка|адреса\s+прибут\w*)\s*[:：]\s*(.+)/i);
    // Просте "адреса:" без уточнення — визначаємо за напрямом або fromCity
    const addrGenericMatch = !addrFromMatch && !addrToMatch ? raw.match(/адреса\s*[:：]\s*(.+)/i) : null;
    if (addrFromMatch) {
        fromAddress = addrFromMatch[1].replace(/[\+]?\d{10,}.*$/, '').replace(/\n.*$/, '').trim();
    }
    if (addrToMatch) {
        toAddress = addrToMatch[1].replace(/[\+]?\d{10,}.*$/, '').replace(/\n.*$/, '').trim();
    }
    if (addrGenericMatch) {
        const addr = addrGenericMatch[1].replace(/[\+]?\d{10,}.*$/, '').replace(/\n.*$/, '').trim();
        // Визначаємо куди поставити: якщо напрям EU→UA, адреса — це відправка (EU сторона)
        // Якщо UA→EU, адреса — це відправка (UA сторона). За замовчуванням — відправка.
        fromAddress = addr;
    }

    if (fromCity || fromAddress) {
        let fromVal = '';
        if (fromAddress) {
            fromVal = fromAddress;
        } else {
            fromVal = fromCity.charAt(0).toUpperCase() + fromCity.slice(1);
        }
        document.getElementById('fFrom').value = fromVal;
        result.push('📍 Звідки: ' + fromVal);
    }
    if (toCity || toAddress) {
        let toVal = '';
        if (toAddress) {
            toVal = toAddress;
        } else {
            toVal = toCity.charAt(0).toUpperCase() + toCity.slice(1);
        }
        document.getElementById('fTo').value = toVal;
        result.push('📍 Куди: ' + toVal);
    }
    // Якщо SMS розпізнало обидві точки й вони є у каталозі — спробуємо авто-ціну
    suggestPriceFromRoute();

    // 5. Час: шукаємо HH:MM
    const timeMatch = text.match(/(\d{1,2}):(\d{2})(?!\d)/);
    if (timeMatch && parseInt(timeMatch[1]) < 24) {
        document.getElementById('fTiming').value = timeMatch[1].padStart(2,'0') + ':' + timeMatch[2];
        result.push('🕐 Час: ' + timeMatch[1].padStart(2,'0') + ':' + timeMatch[2]);
    }

    // 6. ПІБ — шукаємо слова з великої літери (ім'я та прізвище)
    // Видаляємо адресні рядки з тексту перед пошуком імені
    let rawForName = raw;
    if (fromAddress) rawForName = rawForName.replace(fromAddress, '');
    if (toAddress) rawForName = rawForName.replace(toAddress, '');
    // Видаляємо рядки з ключовими словами адрес
    rawForName = rawForName.replace(/(?:виїзд|відправ\w*|забрати|прибут\w*|доставк\w*|привезти|посадка|висадка|адреса\w*)\s*[:：][^\n]*/gi, '');
    const nameWords = rawForName.match(/[А-ЯІЇЄҐ][а-яіїєґ''-]+/g);
    if (nameWords) {
        // Фільтруємо — виключаємо міста (з урахуванням відмінків) та службові слова
        const excludeExact = ['до','від','людини','людин','пасажир','пасажири','пасажирів','місць','місце','їхати','іхати','їду','потрібно'];
        // Додаємо частини складених назв міст (Івано-Франківськ → "івано", "франківськ")
        if (fromCity && fromCity.includes('-')) fromCity.split('-').forEach(p => { if (p.length >= 3) excludeExact.push(p); });
        if (toCity && toCity.includes('-')) toCity.split('-').forEach(p => { if (p.length >= 3) excludeExact.push(p); });
        const allCities = [...KNOWN_CITIES_EU, ...KNOWN_CITIES_UA];
        // Додаємо розпізнані міста (fromCity/toCity) щоб виключити їх відмінкові форми
        if (fromCity) allCities.push(fromCity.toLowerCase());
        if (toCity) allCities.push(toCity.toLowerCase());
        const nameParts = nameWords.filter(w => {
            const wl = w.toLowerCase();
            if (wl.length <= 1) return false;
            if (excludeExact.includes(wl)) return false;
            // Перевірка на місто (включаючи відмінкові форми)
            if (allCities.includes(wl)) return false;
            return true;
        });
        if (nameParts.length >= 1) {
            const fullName = nameParts.slice(0, 3).join(' ');
            document.getElementById('fName').value = fullName;
            result.push('👤 ПІБ: ' + fullName);
        }
    }

    // Підсвічуємо нерозпізнані поля червоним
    const fieldsToCheck = [
        { id: 'fDate', recognized: !!dateMatch },
        { id: 'fPhone', recognized: !!phoneMatch },
        { id: 'fSeats', recognized: seats > 1 },
        { id: 'fDirection', recognized: !!direction },
        { id: 'fFrom', recognized: !!fromCity },
        { id: 'fTo', recognized: !!toCity },
        { id: 'fName', recognized: !!(nameWords && nameWords.length >= 1 && document.getElementById('fName').value) },
    ];
    fieldsToCheck.forEach(f => {
        const el = document.getElementById(f.id);
        if (!el) return;
        if (!f.recognized) {
            el.style.border = '2px solid #dc2626';
            el.style.backgroundColor = '#fef2f2';
        } else {
            el.style.border = '';
            el.style.backgroundColor = '';
        }
    });

    // Показуємо результат
    const resEl = document.getElementById('smsParseResult');
    if (result.length > 0) {
        resEl.style.display = 'block';
        resEl.style.background = '';
        resEl.style.color = '';
        resEl.innerHTML = '✅ Розпізнано: ' + result.join(' · ');
    } else {
        resEl.style.display = 'block';
        resEl.style.background = '#fef2f2';
        resEl.style.color = '#dc2626';
        resEl.textContent = '⚠️ Не вдалось розпізнати дані. Заповніть форму вручну.';
    }
}

// ================================================================
// FORM — автопідказка рейсу при виборі дати
// ================================================================
let selectedFormCalId = '';

// Перевірка чи є рейси на обрану дату
function onDateChanged() {
    const date = document.getElementById('fDate').value;
    const panel = document.getElementById('tripSuggestPanel');
    const resultDiv = document.getElementById('tripSuggestResult');
    selectedFormCalId = '';
    resultDiv.style.display = 'none';

    if (!date) { panel.style.display = 'none'; return; }

    // Перевіряємо чи є рейси на цю дату
    const parts = date.split('-');
    const dateFormatted = parts[2] + '.' + parts[1] + '.' + parts[0];
    const dirSel = document.getElementById('fDirection').value;

    const matching = trips.filter(t => {
        if (t.status === 'Архів' || t.status === 'Виконано' || t.status === 'Видалено') return false;
        var tDate = formatTripDate(t.date);
        if (tDate !== dateFormatted) return false;
        const tDir = String(t.direction || '').toLowerCase();
        if (dirSel === 'ua-eu' && !tDir.match(/ук|ua|україна/)) return false;
        if (dirSel === 'eu-ua' && !tDir.match(/єв|eu|європа/)) return false;
        return true;
    });

    panel.style.display = matching.length > 0 ? 'block' : 'none';
}

// Відкрити модалку вибору рейсу з форми додавання
function openFormTripModal() {
    // Створюємо тимчасовий "фейковий" pax для визначення напряму
    const dirSel = document.getElementById('fDirection').value;
    const fakePax = { 'PAX_ID': '__form__', 'Напрям': dirSel === 'eu-ua' ? 'Європа-УК' : 'Україна-ЄВ' };

    // Тимчасово додаємо в масив
    passengers.push(fakePax);

    openTripModal(['__form__'], 'form', function(calId) {
        // Callback — рейс обрано
        selectedFormCalId = calId;
        var trip = trips.find(t => t.cal_id === calId);
        var resultDiv = document.getElementById('tripSuggestResult');
        if (trip && resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.textContent = '✅ Обрано: ' + formatTripDate(trip.date) + ' — ' + (trip.auto_name || '') + ' (' + (trip.city || '') + ')';
        }
    });
    // НЕ видаляємо fakePax тут — він потрібен для selectTripDate → getMatchingTrips
    // Видалення відбувається в closeTripModal()
}

async function savePassenger() {
    const saveBtn = document.getElementById('paxSaveBtn');
    const name = document.getElementById('fName').value.trim();
    const phone = document.getElementById('fPhone').value.trim();
    const dir = document.getElementById('fDirection').value;
    if (!name || !phone) { showToast('⚠️ ПІБ та Телефон обов\'язкові'); return; }

    // Візуальний відгук — блокуємо кнопку та показуємо стан
    const origText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Збереження...';
    saveBtn.style.opacity = '0.7';

    const date = document.getElementById('fDate').value || '';
    // Route points: збираємо "Місто — Адреса" з селектів + input-ів адреси.
    // Якщо точку не вибрано — fallback на текст у прихованому fFrom/fTo.
    const fromCombined = readRoutePointCombined('from');
    const toCombined = readRoutePointCombined('to');
    const formData = {
        name, phone,
        phoneReg: document.getElementById('fPhoneReg').value.trim(),
        seats: document.getElementById('fSeats').value || 1,
        from: fromCombined.text,
        to: toCombined.text,
        date,
        timing: document.getElementById('fTiming').value.trim(),
        price: document.getElementById('fPrice').value.trim(),
        currency: document.getElementById('fCurrency').value,
        deposit: document.getElementById('fDeposit').value.trim(),
        currencyDeposit: document.getElementById('fCurrencyDeposit').value,
        weight: document.getElementById('fWeight').value.trim(),
        weightPrice: document.getElementById('fWeightPrice').value.trim(),
        currencyWeight: document.getElementById('fCurrencyWeight').value,
        note: document.getElementById('fNote').value.trim(),
        messenger: (document.getElementById('fMessenger')||{}).value?.trim() || '',
        seatNumber: (document.getElementById('fSeatNumber')||{}).value?.trim() || '',
        payStatus: (document.getElementById('fPayStatus')||{}).value || '',
        payForm: (document.getElementById('fPayForm')||{}).value || '',
        tag: (document.getElementById('fTag')||{}).value?.trim() || ''
    };

    // === РЕЖИМ РЕДАГУВАННЯ МАРШРУТУ: оновлюємо поля через updateRouteField ===
    const routeSheet = saveBtn ? saveBtn.getAttribute('data-route-sheet') : null;
    if (editingPaxId && routeSheet) {
        showLoader('Збереження маршруту...');
        // Маппінг: назви колонок МАРШРУТНОЇ таблиці (не пасажирської!)
        const fieldMap = {
            'Піб пасажира': name,
            'Телефон пасажира': phone,
            'Кількість місць': formData.seats,
            'Адреса відправки': formData.from,
            'Адреса прибуття': formData.to,
            'Дата рейсу': formData.date,
            'Таймінг': formData.timing,
            'Сума': formData.price,
            'Валюта': formData.currency,
            'Завдаток': formData.deposit,
            'Валюта завдатку': formData.currencyDeposit,
            'Вага багажу': formData.weight,
            'Примітка': formData.note,
            'Месенджер': formData.messenger,
            'Місце в авто': formData.seatNumber,
            'Статус оплати': formData.payStatus,
            'Форма оплати': formData.payForm,
            'Тег': formData.tag
        };
        const res = await apiPost('updateRouteFields', { sheet: routeSheet, rte_id: editingPaxId, fields: fieldMap });
        if (res.ok) {
            // Оновлюємо локальні дані маршруту
            const rSheet = routes[activeRouteIdx];
            if (rSheet) {
                const row = (rSheet.rows || []).find(r => r._resolvedId === editingPaxId || r['RTE_ID'] === editingPaxId);
                if (row) { for (const [col, value] of Object.entries(fieldMap)) row[col] = value || ''; }
            }
            closeModal('passengerModal');
            editingPaxId = null;
            if (saveBtn) { saveBtn.removeAttribute('data-route-sheet'); }
            renderRoutes();
            showToast('✅ Оновлено');
        } else {
            showToast('❌ Помилка: ' + (res.error || 'Невідома'));
        }
        hideLoader();
        saveBtn.disabled = false; saveBtn.textContent = origText; saveBtn.style.opacity = '1';
        return;
    }

    // === РЕЖИМ РЕДАГУВАННЯ: оновлюємо існуючого пасажира через updatePassenger API ===
    // Пропускає перевірку дублікатів, оновлює локальні дані після успіху
    if (editingPaxId) {
        showLoader('Збереження...');
        const p = passengers.find(x => x['PAX_ID'] === editingPaxId);
        const sheet = p ? (p._sheet || (dir === 'eu-ua' ? 'eu' : 'ue')) : (dir === 'eu-ua' ? 'eu' : 'ue');
        const res = await apiPost('updatePassenger', { pax_id: editingPaxId, sheet, data: formData });
        if (res.ok) {
            // Update local data
            if (p) {
                p['Піб'] = name;
                p['Телефон пасажира'] = phone;
                p['Телефон реєстратора'] = formData.phoneReg;
                p['Кількість місць'] = formData.seats;
                p['Адреса відправки'] = formData.from;
                p['Адреса прибуття'] = formData.to;
                p['Дата виїзду'] = date;
                p['Таймінг'] = formData.timing;
                p['Ціна квитка'] = formData.price;
                p['Валюта квитка'] = formData.currency;
                p['Завдаток'] = formData.deposit;
                p['Валюта завдатку'] = formData.currencyDeposit;
                p['Вага багажу'] = formData.weight;
                p['Ціна багажу'] = formData.weightPrice;
                p['Валюта багажу'] = formData.currencyWeight;
                p['Примітка'] = formData.note;
            }
            // Одразу закриваємо і рендеримо — дані вже оновлені локально
            hideLoader();
            editingPaxId = null;
            closeModal('passengerModal');
            render();
            showToast('✅ Пасажира оновлено');
            // Фонова синхронізація
            silentSync(false, true);
        } else {
            hideLoader();
            showToast('❌ ' + (res.error || 'Помилка збереження'));
        }
        saveBtn.disabled = false; saveBtn.textContent = origText; saveBtn.style.opacity = '';
        return;
    }

    // CREATE MODE — локальна перевірка дублікатів (надійніша за API)
    const nameLower = name.toLowerCase().trim();
    const phoneDigits = phone.replace(/\D/g, ''); // тільки цифри
    // Також перевіряємо останні 9 цифр (без коду країни)
    const phoneTail = phoneDigits.length >= 9 ? phoneDigits.slice(-9) : phoneDigits;
    let localExact = null, localSoft = null;
    for (const p of passengers) {
        const pName = String(p['Піб'] || '').toLowerCase().trim();
        const pDigits = String(p['Телефон пасажира'] || '').replace(/\D/g, '');
        const pTail = pDigits.length >= 9 ? pDigits.slice(-9) : pDigits;
        const pDate = String(p['Дата виїзду'] || '').trim();
        const phoneMatch = phoneTail && pTail && (phoneDigits === pDigits || phoneTail === pTail);
        if (pName === nameLower && phoneMatch && pDate === date && nameLower && date) {
            localExact = p; break;
        }
        if (!localSoft && pName === nameLower && phoneMatch && nameLower) {
            localSoft = p;
        }
    }
    if (localExact) {
        saveBtn.disabled = false; saveBtn.textContent = origText; saveBtn.style.opacity = '';
        showConfirm('❌ Точний дублікат!\n\n' + localExact['Піб'] + '\n' + localExact['Телефон пасажира'] + '\n\nТакий запис вже існує. Скасувати?', function(yes) {});
        return;
    }
    if (localSoft) {
        const confirmed = await new Promise(resolve => {
            showConfirm('⚠️ Схожий запис знайдено!\n\n' + localSoft['Піб'] + '\n' + localSoft['Телефон пасажира'] + '\n\nЗберегти все одно?', resolve);
        });
        if (!confirmed) {
            saveBtn.disabled = false; saveBtn.textContent = origText; saveBtn.style.opacity = '';
            return;
        }
    }

    showLoader('Збереження...');
    const res = await apiPost('addPassenger', {
        sheet: dir === 'eu-ua' ? 'eu' : 'ue',
        data: formData
    });
    if (res.ok) {
        // Оптимістичне оновлення — одразу додаємо ліда в локальний масив
        const newPax = {
            'PAX_ID': res.pax_id,
            'Піб': name,
            'Телефон пасажира': phone,
            'Телефон реєстратора': formData.phoneReg,
            'Кількість місць': formData.seats,
            'Адреса відправки': formData.from,
            'Адреса прибуття': formData.to,
            'Дата виїзду': date,
            'Таймінг': formData.timing,
            'Ціна квитка': formData.price,
            'Валюта квитка': formData.currency,
            'Завдаток': formData.deposit,
            'Валюта завдатку': formData.currencyDeposit,
            'Вага багажу': formData.weight,
            'Ціна багажу': formData.weightPrice,
            'Валюта багажу': formData.currencyWeight,
            'Примітка': formData.note,
            'Напрям': dir === 'eu-ua' ? 'Європа-Україна' : 'Україна-Європа',
            'Статус ліда': 'Новий',
            'Статус оплати': 'Не оплачено',
            'Статус CRM': 'Активний',
            'Дата створення': new Date().toISOString(),
            'CAL_ID': selectedFormCalId || '',
            _sheet: dir === 'eu-ua' ? 'eu' : 'ue'
        };
        passengers.unshift(newPax);

        // Призначаємо рейс паралельно (не чекаємо)
        if (selectedFormCalId) {
            apiPost('assignTrip', { cal_id: selectedFormCalId, pax_ids: [res.pax_id] });
        }
        selectedFormCalId = '';

        // Одразу закриваємо модалку і показуємо ліда зверху
        hideLoader();
        closeModal('passengerModal');
        justAddedPaxId = res.pax_id;
        updateAllCounts();
        render();

        // Скрол до нового ліда + підсвітка
        setTimeout(() => {
            const el = document.querySelector('[data-pax-id="' + res.pax_id + '"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Прибираємо підсвітку через 3 секунди
            setTimeout(() => { justAddedPaxId = null; }, 3000);
        }, 100);

        showToast('✅ Пасажир додано: ' + res.pax_id);

        // Фонова синхронізація — підтягне точні дані з сервера
        silentSync(false, true);
    } else {
        hideLoader();
        showToast('❌ ' + (res.error || 'Помилка'));
    }
    saveBtn.disabled = false; saveBtn.textContent = origText; saveBtn.style.opacity = '';
}

async function deletePax(paxId, sheet, name) {
    showConfirm('Видалити пасажира «' + name + '»?', async (yes) => {
        if (!yes) return;
        showLoader('Видалення...');
        const res = await apiPost('archivePassenger', { pax_ids: [paxId], reason: 'Видалено', archived_by: 'Менеджер' });
        hideLoader();
        if (res.ok) {
            passengers = passengers.filter(p => p['PAX_ID'] !== paxId);
            showToast('✅ Видалено (збережено в архіві)');
            openDetailsId = null; openActionsId = null;
            render(); updateAllCounts();
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

// ================================================================
// TRIPS RENDERING
// ================================================================
function renderTrips() {
    const grid = document.getElementById('tripsGrid');
    if (!grid) return;
    autoColorMap = {};
    const filtered = getFilteredTrips();

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-state-icon">🚐</div>
            <div class="empty-state-text">Рейсів ще немає</div>
            <div class="empty-state-sub">Створіть перший рейс</div>
            <button class="bs-btn primary" style="margin-top:12px;" onclick="openNewTripForm()">➕ Створити перший рейс</button>
        </div>`;
        return;
    }

    grid.innerHTML = filtered.map(t => renderTripCard(t)).join('');
}

// Універсальна функція визначення напрямку з будь-якого формату
function getDirectionCode(val) {
    const d = String(val || '').toLowerCase();
    // Точні коди
    if (d === 'ua-eu') return 'ua-eu';
    if (d === 'eu-ua') return 'eu-ua';
    if (d === 'bt') return 'other';
    // Текстові варіанти (порядок важливий: "Європа-Україна" = eu-ua, перевіряємо першим)
    if (d.match(/європа.?україна|єв.*ук|eu.*ua/)) return 'eu-ua';
    if (d.match(/україна.?європа|ук.*єв|ua.*eu/)) return 'ua-eu';
    // Одне слово — визначаємо за контекстом
    if (d.match(/європа|єв/)) return 'eu-ua';
    if (d.match(/україна|ук/)) return 'ua-eu';
    return 'other';
}

function getTripDirection(t) {
    return getDirectionCode(t.direction);
}

function cleanAutoName(name) {
    if (!name) return '';
    return String(name).replace(/\s*\(\d{4}-\d{2}-\d{2}T[\d:.]+Z?\)\s*/g, '').trim();
}

function getFilteredTrips() {
    return trips.filter(t => {
        // Hide archived/done
        if (t.status === 'Архів' || t.status === 'Виконано' || t.status === 'Видалено') return false;
        // Time filter
        if (tripTimeFilter !== 'all') {
            const parts = String(t.date || '').split('.');
            let tDate;
            if (parts.length === 3) tDate = new Date(parts[2], parts[1]-1, parts[0]);
            else tDate = new Date(t.date);
            const today = new Date(); today.setHours(0,0,0,0);
            if (tripTimeFilter === 'future' && tDate < today) return false;
            if (tripTimeFilter === 'past' && tDate >= today) return false;
        }
        // Dir filter
        if (tripDirFilter !== 'all') {
            if (getTripDirection(t) !== tripDirFilter) return false;
        }
        // Date filter
        if (tripDateFilter) {
            const fd = formatTripDate(t.date);
            const parts = tripDateFilter.split('-');
            const target = parts[2] + '.' + parts[1] + '.' + parts[0];
            if (fd !== target) return false;
        }
        // Auto filter
        if (tripAutoFilter !== 'all') {
            const autoName = cleanAutoName(t.auto_name);
            if (autoName !== tripAutoFilter) return false;
        }
        return true;
    });
}

const AUTO_COLORS = [
    { bg: '#ede9fe', color: '#5b21b6' },
    { bg: '#fce7f3', color: '#9d174d' },
    { bg: '#dbeafe', color: '#1e40af' },
    { bg: '#d1fae5', color: '#065f46' },
    { bg: '#fef3c7', color: '#92400e' },
    { bg: '#ffe4e6', color: '#9f1239' },
    { bg: '#e0f2fe', color: '#075985' },
    { bg: '#f0fdf4', color: '#166534' },
    { bg: '#fdf4ff', color: '#86198f' },
    { bg: '#ecfdf5', color: '#047857' },
];
let autoColorMap = {};

function getAutoColor(name) {
    if (!name) return AUTO_COLORS[0];
    if (autoColorMap[name]) return autoColorMap[name];
    const idx = Object.keys(autoColorMap).length % AUTO_COLORS.length;
    autoColorMap[name] = AUTO_COLORS[idx];
    return autoColorMap[name];
}

function renderTripCard(t) {
    const maxS = parseInt(t.max_seats) || 0;
    const occ = parseInt(t.occupied) || 0;
    const isOverbooked = occ > maxS && maxS > 0;
    const pct = maxS > 0 ? Math.round(occ / maxS * 100) : 0;
    const barPct = Math.min(pct, 100);
    const dir = getTripDirection(t);
    const isUaEu = dir === 'ua-eu';
    const isEuUa = dir === 'eu-ua';
    const dirLabel = isUaEu ? 'UA → EU' : isEuUa ? 'EU → UA' : (t.direction || '↔');
    const dirCssClass = isUaEu ? 'dir-ua-eu' : isEuUa ? 'dir-eu-ua' : 'dir';
    const cardDirClass = isUaEu ? 'trip-dir-ua-eu' : isEuUa ? 'trip-dir-eu-ua' : '';
    const statusCls = t.status === 'Повний' ? 'trip-status-full' : t.status === 'Виконано' ? 'trip-status-done' : (t.status === 'Архів' || t.status === 'Видалено') ? 'trip-status-archive' : 'trip-status-open';
    const safeCalId = String(t.cal_id || '').replace(/'/g, "\\'");
    const safeCity = String(t.city || '').replace(/'/g, "\\'");
    const safeDate = String(t.date || '').replace(/'/g, "\\'");
    const noCalId = !t.cal_id || !String(t.cal_id).trim();
    const autoName = cleanAutoName(t.auto_name);
    const autoClr = getAutoColor(autoName);
    const fillClass = isOverbooked ? 'overbooked' : pct >= 100 ? 'full' : '';
    const progressColor = isOverbooked ? 'color:#dc2626;font-weight:700;' : '';
    const overbookBadge = isOverbooked ? ` <span class="trip-overbook-badge">+${occ - maxS} зайвих</span>` : '';

    return `<div class="trip-card ${cardDirClass} ${noCalId ? 'trip-no-id' : ''} ${isOverbooked ? 'trip-overbooked' : ''}">
        <div class="trip-card-header">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="trip-card-city">${t.city || '—'}</span>
                <span class="trip-status-badge ${statusCls}">${t.status || 'Відкритий'}</span>
            </div>
            <div class="trip-card-meta">
                <span class="trip-card-tag ${dirCssClass}">${dirLabel}</span>
                <span class="trip-card-tag date">${formatTripDate(t.date)}</span>
            </div>
            <div class="trip-card-meta" style="margin-top:4px;">
                <span class="trip-card-tag auto" style="background:${autoClr.bg};color:${autoClr.color};">${autoName || '—'}</span>
            </div>
            ${noCalId ? '<div style="color:#dc2626;font-size:10px;font-weight:700;margin-top:4px;">CAL_ID порожній — видалення неможливе</div>' : ''}
        </div>
        <div class="trip-card-body">
            <div class="trip-progress">
                <div class="trip-progress-text" style="${progressColor}" onclick="showTripPassengers('${safeCalId}')" title="Натисніть щоб побачити пасажирів">${occ} з ${maxS} місць зайнято${overbookBadge}</div>
                <div class="trip-progress-bar"><div class="trip-progress-fill ${fillClass}" style="width:${barPct}%"></div></div>
            </div>
            <div class="trip-card-actions">
                <button class="trip-action-btn" onclick="editTrip('${safeCalId}')">✏️ Редагувати</button>
                <button class="trip-action-btn" onclick="showTripPassengers('${safeCalId}')">👥 Пасажири</button>
                <button class="trip-action-btn" onclick="cancelTrip('${safeCalId}','${safeCity}','${safeDate}')">🚫 Скасувати</button>
                <button class="trip-action-btn danger" onclick="deleteTrip('${safeCalId}','${safeCity}','${safeDate}')">🗑️ Видалити</button>
            </div>
        </div>
    </div>`;
}

function setTripTimeFilter(btn, val) {
    tripTimeFilter = val;
    document.querySelectorAll('.trip-filter-btn[data-time]').forEach(b => b.classList.toggle('active', b.dataset.time === val));
    renderTrips();
}

function setTripDirFilter(btn, val) {
    tripDirFilter = val;
    document.querySelectorAll('.trip-filter-btn[data-dir]').forEach(b => b.classList.toggle('active', b.dataset.dir === val));
    renderTrips();
}

function setTripDateFilter(val) {
    tripDateFilter = val || '';
    const toggle = document.getElementById('tcalToggle');
    const label = document.getElementById('tcalLabel');
    if (val) {
        const p = val.split('-');
        label.textContent = p[2] + '.' + p[1] + '.' + p[0];
        toggle.classList.add('has-date');
    } else {
        label.textContent = 'Дата рейсу';
        toggle.classList.remove('has-date');
    }
    renderTrips();
}

// ── TRIP CALENDAR WIDGET ──
let tcalMonth = new Date().getMonth();
let tcalYear = new Date().getFullYear();
let tcalClickInside = false;
document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.tcal-wrap')) tcalClickInside = true;
});

function toggleTripCalendar() {
    const dd = document.getElementById('tcalDropdown');
    if (dd.classList.contains('show')) { dd.classList.remove('show'); return; }
    dd.classList.add('show');
    renderTripCalendarWidget();
}

function closeTripCalendar() {
    document.getElementById('tcalDropdown').classList.remove('show');
}

function getTripDateMap() {
    const map = {};
    trips.forEach(t => {
        if (t.status === 'Архів' || t.status === 'Виконано') return;
        const fd = formatTripDate(t.date);
        if (!fd || fd === '—') return;
        if (!map[fd]) map[fd] = { uaeu: 0, euua: 0, pax: 0, maxSeats: 0, overbooked: false };
        const dir = getTripDirection(t);
        if (dir === 'ua-eu') map[fd].uaeu++;
        else if (dir === 'eu-ua') map[fd].euua++;
        const occ = parseInt(t.occupied) || 0;
        const maxS = parseInt(t.max_seats) || 0;
        map[fd].pax += occ;
        map[fd].maxSeats += maxS;
        if (occ > maxS && maxS > 0) map[fd].overbooked = true;
    });
    return map;
}

function renderTripCalendarWidget() {
    const dd = document.getElementById('tcalDropdown');
    const tripMap = getTripDateMap();
    const monthNames = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
    const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

    const firstDay = new Date(tcalYear, tcalMonth, 1);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(tcalYear, tcalMonth + 1, 0).getDate();
    const prevMonthDays = new Date(tcalYear, tcalMonth, 0).getDate();

    const today = new Date(); today.setHours(0,0,0,0);
    const selectedKey = tripDateFilter ? (() => { const p = tripDateFilter.split('-'); return p[2]+'.'+p[1]+'.'+p[0]; })() : '';

    let daysHtml = '';
    // Previous month
    for (let i = startDow - 1; i >= 0; i--) {
        const d = prevMonthDays - i;
        const m = tcalMonth === 0 ? 12 : tcalMonth;
        const y = tcalMonth === 0 ? tcalYear - 1 : tcalYear;
        const key = String(d).padStart(2,'0') + '.' + String(m).padStart(2,'0') + '.' + y;
        const info = tripMap[key];
        daysHtml += renderCalDay(d, key, info, true, false, selectedKey);
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        const key = String(d).padStart(2,'0') + '.' + String(tcalMonth+1).padStart(2,'0') + '.' + tcalYear;
        const isToday = d === today.getDate() && tcalMonth === today.getMonth() && tcalYear === today.getFullYear();
        const info = tripMap[key];
        daysHtml += renderCalDay(d, key, info, false, isToday, selectedKey);
    }
    // Next month
    const totalCells = startDow + daysInMonth;
    const remaining = (7 - totalCells % 7) % 7;
    for (let d = 1; d <= remaining; d++) {
        const m = tcalMonth === 11 ? 1 : tcalMonth + 2;
        const y = tcalMonth === 11 ? tcalYear + 1 : tcalYear;
        const key = String(d).padStart(2,'0') + '.' + String(m).padStart(2,'0') + '.' + y;
        const info = tripMap[key];
        daysHtml += renderCalDay(d, key, info, true, false, selectedKey);
    }

    dd.innerHTML = `
        <div class="tcal-header">
            <span class="tcal-month-label">${monthNames[tcalMonth]} ${tcalYear}</span>
            <div class="tcal-nav">
                <button class="tcal-nav-btn" onclick="tcalPrev()">&larr;</button>
                <button class="tcal-nav-btn" onclick="tcalNext()">&rarr;</button>
            </div>
        </div>
        <div class="tcal-weekdays">${dayNames.map(d => '<span class="tcal-wd">'+d+'</span>').join('')}</div>
        <div class="tcal-days">${daysHtml}</div>
        <div class="tcal-footer">
            <div class="tcal-legend">
                <span class="tcal-legend-item"><span class="tcal-legend-dot" style="background:#2563eb;"></span> UA→EU</span>
                <span class="tcal-legend-item"><span class="tcal-legend-dot" style="background:#059669;"></span> EU→UA</span>
                <span class="tcal-legend-item"><span class="tcal-legend-dot" style="background:#dc2626;"></span> Перебір</span>
            </div>
            <div style="display:flex;gap:4px;">
                <button class="tcal-footer-btn today-btn" onclick="tcalToday()">Сьогодні</button>
                <button class="tcal-footer-btn clear-btn" onclick="tcalClear()">Скинути</button>
            </div>
        </div>`;
}

function renderCalDay(d, key, info, otherMonth, isToday, selectedKey) {
    const hasTrip = !!info;
    const isSelected = key === selectedKey;
    let cls = 'tcal-day';
    if (otherMonth) cls += ' other-month';
    if (isToday) cls += ' today';
    if (hasTrip) cls += ' has-trip';
    if (isSelected) cls += ' selected';
    if (info && info.overbooked) cls += ' overbooked';

    let dotsHtml = '';
    let paxHtml = '';
    if (info) {
        if (info.overbooked) {
            dotsHtml = '<span class="dot-overbooked"></span>';
        } else if (info.uaeu > 0 && info.euua > 0) {
            dotsHtml = '<span class="dot-ua-eu"></span><span class="dot-eu-ua"></span>';
        } else if (info.uaeu > 0) {
            dotsHtml = '<span class="dot-ua-eu"></span>';
        } else if (info.euua > 0) {
            dotsHtml = '<span class="dot-eu-ua"></span>';
        }
        const paxStyle = info.overbooked ? ' style="color:#d97706;font-weight:800;"' : '';
        paxHtml = `<span class="tcal-pax"${paxStyle} onclick="event.stopPropagation();showTripPassengersByDate('${key}')" title="Пасажири">${info.pax}</span>`;
    }

    const onclick = hasTrip ? ` onclick="tcalSelectDate('${key}')"` : '';
    return `<button class="${cls}"${onclick}>
        <span>${d}</span>
        ${dotsHtml ? `<div class="tcal-dots">${dotsHtml}</div>` : ''}
        ${paxHtml}
    </button>`;
}

// Показати список пасажирів рейсу (по cal_id)
function showTripPassengers(calId) {
    const trip = trips.find(t => t.cal_id === calId);
    const tripPax = passengers.filter(p => p['CAL_ID'] === calId);
    const maxS = trip ? (parseInt(trip.max_seats) || 0) : 0;
    const city = trip ? (trip.city || '—') : '—';
    const date = trip ? formatTripDate(trip.date) : '';
    renderPaxPopup(tripPax, city + ' ' + date, maxS);
}

// Показати список пасажирів по даті (всі рейси на цю дату)
function showTripPassengersByDate(dateKey) {
    const matchTrips = trips.filter(t => {
        if (t.status === 'Архів' || t.status === 'Виконано') return false;
        return formatTripDate(t.date) === dateKey;
    });
    const calIds = matchTrips.map(t => t.cal_id);
    const tripPax = passengers.filter(p => calIds.includes(p['CAL_ID']));
    const maxS = matchTrips.reduce((s, t) => s + (parseInt(t.max_seats) || 0), 0);
    renderPaxPopup(tripPax, 'Рейси на ' + dateKey, maxS);
}

function renderPaxPopup(tripPax, title, maxSeats) {
    // Remove existing popup
    document.querySelectorAll('.trip-pax-popup, .trip-pax-popup-overlay').forEach(el => el.remove());

    const totalSeats = tripPax.reduce((s, p) => s + (parseInt(p['Кількість місць']) || 1), 0);
    const isOver = totalSeats > maxSeats && maxSeats > 0;

    let paxHtml = '';
    if (tripPax.length === 0) {
        paxHtml = '<div style="text-align:center;color:#9ca3af;padding:20px;">Немає пасажирів</div>';
    } else {
        tripPax.forEach(p => {
            const name = p['Піб'] || 'Без імені';
            const phone = String(p['Телефон пасажира'] || '');
            const seats = parseInt(p['Кількість місць']) || 1;
            const status = p['Статус ліда'] || '';
            const statusCls = status === 'Підтверджено' ? 'color:#059669' : status === 'Відмова' ? 'color:#dc2626' : status === 'В роботі' ? 'color:#d97706' : 'color:#6b7280';
            paxHtml += `<div class="pax-item">
                <div>
                    <div style="font-weight:600;">${name}</div>
                    <div style="font-size:11px;color:#6b7280;">${phone}</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="${statusCls};font-size:11px;font-weight:600;">${status}</span>
                    <span class="pax-seats">${seats} м.</span>
                </div>
            </div>`;
        });
    }

    const counterStyle = isOver ? 'color:#dc2626;font-weight:700;' : '';
    const overWarning = isOver ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;margin-bottom:12px;color:#dc2626;font-size:12px;font-weight:600;">
        ⚠️ Перебір на ${totalSeats - maxSeats} місць! Призначено ${totalSeats}, макс. ${maxSeats}
    </div>` : '';

    const overlay = document.createElement('div');
    overlay.className = 'trip-pax-popup-overlay';
    overlay.onclick = () => { overlay.remove(); popup.remove(); };
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    popup.className = 'trip-pax-popup';
    popup.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;">${title}</h3>
            <button onclick="document.querySelectorAll('.trip-pax-popup,.trip-pax-popup-overlay').forEach(e=>e.remove())" style="border:none;background:none;font-size:20px;cursor:pointer;color:#6b7280;">&times;</button>
        </div>
        ${overWarning}
        <div style="${counterStyle}font-size:13px;margin-bottom:8px;">Пасажирів: ${tripPax.length} | Місць: ${totalSeats} / ${maxSeats}</div>
        ${paxHtml}
    `;
    document.body.appendChild(popup);
}

function tcalSelectDate(key) {
    const parts = key.split('.');
    const isoDate = parts[2] + '-' + parts[1] + '-' + parts[0];
    if (tripDateFilter === isoDate) {
        setTripDateFilter('');
    } else {
        setTripDateFilter(isoDate);
    }
    renderTripCalendarWidget();
}

function tcalPrev() {
    tcalMonth--;
    if (tcalMonth < 0) { tcalMonth = 11; tcalYear--; }
    renderTripCalendarWidget();
}

function tcalNext() {
    tcalMonth++;
    if (tcalMonth > 11) { tcalMonth = 0; tcalYear++; }
    renderTripCalendarWidget();
}

function tcalToday() {
    const now = new Date();
    tcalMonth = now.getMonth();
    tcalYear = now.getFullYear();
    renderTripCalendarWidget();
}

function tcalClear() {
    setTripDateFilter('');
    closeTripCalendar();
}

function setTripAutoFilter(val) {
    tripAutoFilter = val || 'all';
    renderTrips();
}

function updateTripAutoFilterDropdown() {
    const sel = document.getElementById('tripAutoFilter');
    if (!sel) return;
    const autos = new Set();
    trips.forEach(t => {
        if (t.status === 'Архів' || t.status === 'Виконано') return;
        const name = cleanAutoName(t.auto_name);
        if (name) autos.add(name);
    });
    const prev = sel.value;
    sel.innerHTML = '<option value="all">Всі авто</option>';
    [...autos].sort().forEach(a => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        sel.appendChild(opt);
    });
    if ([...autos].includes(prev)) sel.value = prev;
    else { tripAutoFilter = 'all'; sel.value = 'all'; }
}

// ================================================================
// TRIP FORM
// ================================================================
function openNewTripForm() {
    editingTripCalId = null;
    document.getElementById('tripFormTitle').textContent = '🚐 Новий рейс';
    document.getElementById('tfCity').value = '';
    document.querySelectorAll('#tfDirectionOptions .layout-option').forEach((el,i) => el.classList.toggle('active', i===0));
    document.getElementById('vehicleBuilders').innerHTML = '';
    vehicleBuilderCount = 0;
    tripSelectedDates = [];
    addVehicleBuilder();
    renderTripCalendar();
    renderSelectedDates();
    document.getElementById('tripFormOverlay').classList.add('show');
}

function closeTripForm() {
    document.getElementById('tripFormOverlay').classList.remove('show');
}

function selectTripDir(el) {
    el.parentElement.querySelectorAll('.layout-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
}

function addVehicleBuilder() {
    vehicleBuilderCount++;
    const idx = vehicleBuilderCount;
    const html = `<div class="vehicle-builder" id="vb-${idx}">
        <div class="vehicle-builder-header">
            <span class="vehicle-builder-title">🚐 Авто ${idx}</span>
            <button class="vehicle-remove-btn" onclick="document.getElementById('vb-${idx}').remove()">×</button>
        </div>
        <div class="bs-row">
            <div class="bs-field"><label class="bs-label">Назва</label><input class="bs-input vb-name" placeholder="Mercedes Sprinter"></div>
            <div class="bs-field"><label class="bs-label">Держ. номер</label><input class="bs-input vb-plate" placeholder="AA0000BB"></div>
        </div>
        <div class="bs-field">
            <label class="bs-label">Тип розкладки</label>
            <div class="layout-options vb-layouts">
                <div class="layout-option active" data-layout="1-3-3" onclick="selectLayout(this,${idx})">1-3-3</div>
                <div class="layout-option" data-layout="2-2-3" onclick="selectLayout(this,${idx})">2-2-3</div>
                <div class="layout-option" data-layout="2-2-2" onclick="selectLayout(this,${idx})">2-2-2</div>
                <div class="layout-option" data-layout="bus" onclick="selectLayout(this,${idx})">Автобус</div>
            </div>
        </div>
        <div class="bs-row" style="align-items:center;">
            <div class="bs-field"><label class="bs-label">Кількість місць</label>
                <div class="seat-counter">
                    <button onclick="changeSeatCount(${idx},-1)">−</button>
                    <span class="vb-seats-num" id="vbSeats-${idx}">7</span>
                    <button onclick="changeSeatCount(${idx},1)">+</button>
                </div>
            </div>
            <div class="bs-field"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="checkbox" class="vb-reserve" style="width:16px;height:16px;">
                <span class="bs-label" style="margin:0;">+ Резервне R1</span>
            </label></div>
        </div>
        <div class="seat-preview" id="seatPreview-${idx}"></div>
    </div>`;
    document.getElementById('vehicleBuilders').insertAdjacentHTML('beforeend', html);
    updateSeatPreview(idx);
}

function selectLayout(el, idx) {
    el.parentElement.querySelectorAll('.layout-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    const layout = el.dataset.layout;
    const all = LAYOUTS[layout] || [];
    const seats = layout === 'bus' ? 20 : all.filter(s => s !== 'D').length;
    document.getElementById('vbSeats-' + idx).textContent = seats;
    updateSeatPreview(idx);
}

function changeSeatCount(idx, delta) {
    const el = document.getElementById('vbSeats-' + idx);
    const cur = parseInt(el.textContent) || 0;
    const nv = Math.max(1, cur + delta);
    el.textContent = nv;
    updateSeatPreview(idx);
}

function updateSeatPreview(idx) {
    const container = document.getElementById('seatPreview-' + idx);
    if (!container) return;
    const vb = document.getElementById('vb-' + idx);
    const layoutEl = vb.querySelector('.vb-layouts .layout-option.active');
    const layout = layoutEl ? layoutEl.dataset.layout : '1-3-3';
    const seats = parseInt(document.getElementById('vbSeats-' + idx).textContent) || 7;
    const hasReserve = vb.querySelector('.vb-reserve')?.checked;

    let seatNames = [];
    if (layout === 'bus') {
        for (let i = 1; i <= seats; i++) seatNames.push(String(i));
    } else {
        seatNames = (LAYOUTS[layout] || []).slice(0, seats);
    }
    if (hasReserve) seatNames.push('8');

    const cols = layout === '1-3-3' ? 4 : layout === '2-2-3' ? 5 : layout === '2-2-2' ? 5 : Math.min(seats, 5);
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.innerHTML = seatNames.map(s => {
        const cls = s === 'D' ? 'driver' : '';
        return `<div class="seat-preview-item ${cls}">${s}</div>`;
    }).join('');
}

// ================================================================
// SEAT PICKER — Visual seat selection
// ================================================================
let seatPickerPaxId = null;
let seatPickerSheet = null;
let seatPickerSelected = '';

function detectLayout(trip) {
    // Try trip.layout first — but only if it's a valid layout name
    const validLayouts = ['1-3-3', '2-2-3', '2-2-2', 'bus'];
    const raw = String(trip.layout || '').trim();
    if (validLayouts.includes(raw)) return raw;

    // Fallback: guess from max_seats
    const ms = parseInt(trip.max_seats) || 7;
    if (ms >= 20) return 'bus';
    if (ms === 6) return '2-2-2';
    if (ms === 7) return '1-3-3';
    return '1-3-3';
}

function openSeatPicker(paxId, sheet) {
    const p = passengers.find(x => x['PAX_ID'] === paxId);
    if (!p) return;
    seatPickerPaxId = paxId;
    seatPickerSheet = sheet;
    seatPickerSelected = p['Місце в авто'] || '';

    const calId = p['CAL_ID'] || '';
    if (!calId) { renderSeatPickerNoTrip(); return; }

    const trip = trips.find(t => t.cal_id === calId);
    if (!trip) { renderSeatPickerNoTrip(); return; }

    const occupiedMap = getOccupiedSeats(calId, paxId);
    renderSeatPickerModal(trip, occupiedMap);
}

function getOccupiedSeats(calId, excludePaxId) {
    const map = {};
    passengers.forEach(p => {
        if (p['CAL_ID'] === calId && p['PAX_ID'] !== excludePaxId) {
            const seat = (p['Місце в авто'] || '').trim();
            if (seat) {
                const name = p['Піб'] || 'Пасажир';
                const parts = name.split(' ');
                map[seat] = parts.length > 1 ? parts[0] + ' ' + parts[1].charAt(0) + '.' : parts[0];
            }
        }
    });
    return map;
}

function getSeatRows(layout, maxSeats, hasReserve) {
    if (layout === 'bus') {
        const rows = [];
        for (let i = 1; i <= maxSeats; i += 4) {
            const row = [];
            row.push({ name: String(i), type: 'seat' });
            if (i + 1 <= maxSeats) row.push({ name: String(i+1), type: 'seat' });
            row.push({ type: 'aisle' });
            if (i + 2 <= maxSeats) row.push({ name: String(i+2), type: 'seat' });
            if (i + 3 <= maxSeats) row.push({ name: String(i+3), type: 'seat' });
            rows.push(row);
        }
        return rows;
    }

    // 2-2-3: 4 columns, 3 rows
    // Front: D  2  |  4  7
    // Mid:   _  _  |  _  6
    // Back:  8  1  |  3  5
    if (layout === '2-2-3') {
        const rows = [
            [{ name: 'D', type: 'driver' }, { name: '2', type: 'seat' }, { type: 'aisle' }, { name: '4', type: 'seat' }, { name: '7', type: 'seat' }],
            [{ type: 'empty' }, { type: 'empty' }, { type: 'aisle' }, { type: 'empty' }, { name: '6', type: 'seat' }],
            [hasReserve ? { name: '8', type: 'seat' } : { type: 'empty' }, { name: '1', type: 'seat' }, { type: 'aisle' }, { name: '3', type: 'seat' }, { name: '5', type: 'seat' }]
        ];
        return rows;
    }

    // 1-3-3: 3 columns, 3 rows
    // Front: D  |  3  6
    // Mid:   7  |  2  5
    // Back:  8  |  1  4
    if (layout === '1-3-3') {
        const rows = [
            [{ name: 'D', type: 'driver' }, { type: 'aisle' }, { name: '3', type: 'seat' }, { name: '6', type: 'seat' }],
            [{ name: '7', type: 'seat' }, { type: 'aisle' }, { name: '2', type: 'seat' }, { name: '5', type: 'seat' }],
            [hasReserve ? { name: '8', type: 'seat' } : { type: 'empty' }, { type: 'aisle' }, { name: '1', type: 'seat' }, { name: '4', type: 'seat' }]
        ];
        return rows;
    }

    // 2-2-2: 4 columns, 2 rows
    // Front: D  2  |  4  6
    // Back:  8  1  |  3  5
    if (layout === '2-2-2') {
        const rows = [
            [{ name: 'D', type: 'driver' }, { name: '2', type: 'seat' }, { type: 'aisle' }, { name: '4', type: 'seat' }, { name: '6', type: 'seat' }],
            [hasReserve ? { name: '8', type: 'seat' } : { type: 'empty' }, { name: '1', type: 'seat' }, { type: 'aisle' }, { name: '3', type: 'seat' }, { name: '5', type: 'seat' }]
        ];
        return rows;
    }

    // Generic fallback
    const names = (LAYOUTS[layout] || []).slice(0, maxSeats);
    const rows = [];
    for (let i = 0; i < names.length; i += 3) {
        rows.push(names.slice(i, i + 3).map(s => ({ name: s, type: s === 'D' ? 'driver' : 'seat' })));
    }
    return rows;
}

function buildSeatHtml(seatObj, occupiedMap) {
    const s = seatObj;
    if (s.type === 'aisle') return '<div class="sp-car-aisle"></div>';
    if (s.type === 'empty') return '<div class="sp-seat sp-empty"></div>';
    if (s.type === 'driver') {
        return `<div class="sp-seat sp-driver"><div class="sp-seat-num">${s.name}</div><div style="font-size:10px;color:#a16207;">Водій</div></div>`;
    }
    const isOcc = occupiedMap[s.name];
    const isSel = seatPickerSelected === s.name;
    if (isOcc) {
        return `<div class="sp-seat sp-occupied"><div class="sp-seat-num">${s.name}</div><div class="sp-occ-name">${isOcc}</div></div>`;
    }
    if (isSel) {
        return `<div class="sp-seat sp-selected" onclick="seatPickerSelect('${s.name}')"><div class="sp-seat-check">✓</div><div class="sp-seat-num">${s.name}</div></div>`;
    }
    return `<div class="sp-seat sp-free" onclick="seatPickerSelect('${s.name}')"><div class="sp-seat-ico"></div><div class="sp-seat-num">${s.name}</div></div>`;
}

function renderSeatsGrid(rows, occupiedMap) {
    let html = '';
    rows.forEach(row => {
        html += '<div class="sp-car-row">';
        row.forEach(s => { html += buildSeatHtml(s, occupiedMap); });
        html += '</div>';
    });
    return html;
}

function renderSeatPickerNoTrip() {
    const html = `<div class="seat-picker-overlay" id="seatPickerOverlay" onclick="if(event.target===this)closeSeatPicker()">
        <div class="seat-picker-modal">
            <div class="seat-picker-header">
                <h3>Вибір місця</h3>
                <button class="seat-picker-close" onclick="closeSeatPicker()">✕</button>
            </div>
            <div class="seat-picker-no-trip">
                <span class="sp-nt-icon">🚐</span>
                <div class="sp-nt-title">Рейс не призначено</div>
                <div class="sp-nt-msg">Спочатку призначте рейс пасажиру, тоді можна буде обрати місце в авто</div>
            </div>
            <div class="seat-picker-footer">
                <button class="btn-cancel" onclick="closeSeatPicker()">Закрити</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function renderSeatPickerModal(trip, occupiedMap) {
    const layout = detectLayout(trip);
    const maxSeats = parseInt(trip.max_seats) || 7;
    const autoName = cleanAutoName(trip.auto_name) || 'Авто';
    const hasReserve = trip.reserve === true || trip.reserve === 'true';
    const rows = getSeatRows(layout, maxSeats, hasReserve);
    const seatsHtml = renderSeatsGrid(rows, occupiedMap);
    const tripDate = formatTripDate(trip.date);
    const tripCity = trip.city || '';
    const occ = Object.keys(occupiedMap).length;
    const free = maxSeats - occ;

    const html = `<div class="seat-picker-overlay" id="seatPickerOverlay" onclick="if(event.target===this)closeSeatPicker()">
        <div class="seat-picker-modal">
            <div class="seat-picker-header">
                <h3>Вибір місця</h3>
                <button class="seat-picker-close" onclick="closeSeatPicker()">✕</button>
            </div>
            <div class="seat-picker-body">
                <div class="seat-picker-trip-info">
                    <span class="sp-auto-icon">🚐</span>
                    <div class="sp-auto-details">
                        <div class="sp-auto-name">${autoName}</div>
                        <div>${tripDate} · ${tripCity} · <span style="color:#16a34a;font-weight:700;">${free} вільн.</span> / ${maxSeats} місць</div>
                    </div>
                </div>
                <div class="sp-car-wrap">
                    <div class="sp-car-shape">
                        <div class="sp-car-front"></div>
                        <div class="sp-car-seats" id="seatPickerGrid">
                            ${seatsHtml}
                        </div>
                    </div>
                </div>
                <div class="sp-legend">
                    <div class="sp-legend-item"><div class="sp-legend-dot l-free"></div>Вільне</div>
                    <div class="sp-legend-item"><div class="sp-legend-dot l-sel"></div>Обрано</div>
                    <div class="sp-legend-item"><div class="sp-legend-dot l-occ"></div>Зайняте</div>
                    <div class="sp-legend-item"><div class="sp-legend-dot l-drv"></div>Водій</div>
                </div>
            </div>
            <div class="seat-picker-footer">
                <button class="btn-clear" onclick="seatPickerSelect('')">Скинути</button>
                <button class="btn-cancel" onclick="closeSeatPicker()">Скасувати</button>
                <button class="btn-save" onclick="saveSeatPicker()">Зберегти</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function seatPickerSelect(seatName) {
    seatPickerSelected = (seatPickerSelected === seatName) ? '' : seatName;
    // Re-render grid
    const p = passengers.find(x => x['PAX_ID'] === seatPickerPaxId);
    if (!p) return;
    const calId = p['CAL_ID'] || '';
    const trip = trips.find(t => t.cal_id === calId);
    if (!trip) return;
    const occupiedMap = getOccupiedSeats(calId, seatPickerPaxId);
    const layout = detectLayout(trip);
    const hasReserve = trip.reserve === true || trip.reserve === 'true';
    const rows = getSeatRows(layout, parseInt(trip.max_seats) || 7, hasReserve);
    const grid = document.getElementById('seatPickerGrid');
    if (grid) grid.innerHTML = renderSeatsGrid(rows, occupiedMap);
}

async function saveSeatPicker() {
    if (!seatPickerPaxId) return;
    const paxId = seatPickerPaxId;
    const shName = seatPickerSheet || '';
    const p = passengers.find(x => x['PAX_ID'] === paxId);
    if (!p) return;

    const colName = 'Місце в авто';
    const oldVal = p[colName] || '';
    const newVal = seatPickerSelected;
    if (newVal === oldVal) { closeSeatPicker(); return; }

    p[colName] = newVal;
    closeSeatPicker();

    const el = document.getElementById('dv-' + paxId + '-seatInCar');
    if (el) el.textContent = newVal || '—';

    const sheet = shName || p._sheet || '';
    const res = await apiPost('updateField', { sheet: sheet, pax_id: paxId, col: colName, value: newVal });
    if (res.ok) {
        showToast('✅ Місце збережено: ' + (newVal || 'скинуто'));
        render();
    } else {
        showToast('❌ ' + (res.error || 'Помилка'));
        p[colName] = oldVal;
        if (el) el.textContent = oldVal || '—';
    }
}

function closeSeatPicker() {
    const ov = document.getElementById('seatPickerOverlay');
    if (ov) ov.remove();
    seatPickerPaxId = null;
    seatPickerSheet = null;
}

// Trip calendar
function renderTripCalendar() {
    const cal = document.getElementById('tripCalendar');
    if (!cal) return;
    const y = tripCalMonth.getFullYear(), m = tripCalMonth.getMonth();
    const months = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
    const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
    const firstDay = new Date(y, m, 1);
    let startDay = firstDay.getDay() - 1; if (startDay < 0) startDay = 6;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    let html = `<div class="trip-cal-header">
        <button onclick="tripCalMonth.setMonth(tripCalMonth.getMonth()-1);renderTripCalendar()">◀</button>
        <span class="trip-cal-title">${months[m]} ${y}</span>
        <button onclick="tripCalMonth.setMonth(tripCalMonth.getMonth()+1);renderTripCalendar()">▶</button>
    </div>`;
    html += '<div class="trip-cal-weekdays">' + days.map(d => `<div class="trip-cal-weekday">${d}</div>`).join('') + '</div>';
    html += '<div class="trip-cal-days">';

    for (let i = 0; i < startDay; i++) html += '<div class="trip-cal-day other"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(y, m, d);
        const dateStr = String(d).padStart(2,'0') + '.' + String(m+1).padStart(2,'0') + '.' + y;
        const isToday = dt.getTime() === today.getTime();
        const isSel = tripSelectedDates.includes(dateStr);
        html += `<div class="trip-cal-day ${isToday?'today':''} ${isSel?'selected':''}" onclick="toggleTripDate('${dateStr}')">${d}</div>`;
    }
    html += '</div>';
    cal.innerHTML = html;
}

function toggleTripDate(dateStr) {
    // Edit mode is single-date: each calendar row in DB is exactly one
    // route_date, so picking a new day must REPLACE the current one,
    // not add to it. Otherwise saveTrip → sbUpdateTrip uses dates[0]
    // (the old date) and the new pick is silently ignored.
    if (editingTripCalId) {
        tripSelectedDates = [dateStr];
        renderTripCalendar();
        renderSelectedDates();
        return;
    }
    const idx = tripSelectedDates.indexOf(dateStr);
    if (idx >= 0) tripSelectedDates.splice(idx, 1);
    else tripSelectedDates.push(dateStr);
    renderTripCalendar();
    renderSelectedDates();
}

function renderSelectedDates() {
    const el = document.getElementById('selectedDates');
    if (!el) return;
    el.innerHTML = tripSelectedDates.map(d => `<span class="selected-date-tag">${d} <button onclick="removeTripDate('${d}')">×</button></span>`).join('');
}

function removeTripDate(d) {
    tripSelectedDates = tripSelectedDates.filter(x => x !== d);
    renderTripCalendar();
    renderSelectedDates();
}

// Save trip
async function saveTrip() {
    const city = document.getElementById('tfCity').value.trim();
    if (!city) { showToast('⚠️ Вкажіть місто'); return; }
    if (tripSelectedDates.length === 0) { showToast('⚠️ Виберіть дати'); return; }

    const dirEl = document.querySelector('#tfDirectionOptions .layout-option.active');
    const dir = dirEl ? dirEl.dataset.dir : 'ua-eu';

    // Collect vehicles
    const vbs = document.querySelectorAll('.vehicle-builder');
    if (vbs.length === 0) { showToast('⚠️ Додайте авто'); return; }

    const vehicles = [];
    vbs.forEach(vb => {
        const name = vb.querySelector('.vb-name')?.value || '';
        const plate = vb.querySelector('.vb-plate')?.value || '';
        const layoutEl = vb.querySelector('.vb-layouts .layout-option.active');
        const layout = layoutEl ? layoutEl.dataset.layout : '1-3-3';
        const seatsEl = vb.querySelector('.vb-seats-num');
        const seats = seatsEl ? parseInt(seatsEl.textContent) : 7;
        const reserve = vb.querySelector('.vb-reserve')?.checked || false;
        vehicles.push({ name, plate, layout, seats, reserve });
    });

    showLoader('Створення рейсу...');
    const action = editingTripCalId ? 'updateTrip' : 'createTrip';
    const payload = editingTripCalId
        ? { cal_id: editingTripCalId, city, dir, vehicles, dates: tripSelectedDates }
        : { city, dir, vehicles, dates: tripSelectedDates };

    const res = await apiPost(action, payload);

    if (res.ok) {
        // Optimistic merge so the new rows are visible immediately,
        // even before silentSync resolves.
        if (Array.isArray(res.data)) {
            // create → array of inserted rows
            trips = trips.concat(res.data);
        } else if (res.data && (res.data.cal_id || res.data.CAL_ID)) {
            // update → single row
            const updatedId = res.data.cal_id || res.data.CAL_ID;
            const idx = trips.findIndex(t => (t.cal_id || t.CAL_ID) === updatedId);
            if (idx >= 0) trips[idx] = res.data;
            else trips.push(res.data);
        }

        closeTripForm();
        showTripsView();
        hideLoader();
        showToast('✅ Рейс ' + (editingTripCalId ? 'оновлено' : 'створено'));

        // Refresh from server in background; re-render trips view when done.
        silentSync(false, true).then(() => {
            if (currentView === 'trips') renderTrips();
        });
    } else {
        hideLoader();
        showToast('❌ ' + (res.error || 'Помилка'));
    }
}

// Edit trip
function editTrip(calId) {
    const t = trips.find(x => x.cal_id === calId);
    if (!t) return;
    editingTripCalId = calId;
    document.getElementById('tripFormTitle').textContent = '✏️ Редагувати рейс';
    document.getElementById('tfCity').value = t.city || '';

    // Set direction
    const dirMap = { 'Україна-ЄВ': 'ua-eu', 'Європа-УК': 'eu-ua', 'Загальний': 'bt' };
    const dir = dirMap[t.direction] || 'ua-eu';
    document.querySelectorAll('#tfDirectionOptions .layout-option').forEach(el => el.classList.toggle('active', el.dataset.dir === dir));

    // Clear and add one vehicle
    document.getElementById('vehicleBuilders').innerHTML = '';
    vehicleBuilderCount = 0;
    addVehicleBuilder();

    // Fill vehicle
    const vb = document.querySelector('.vehicle-builder');
    if (vb) {
        const nameInput = vb.querySelector('.vb-name');
        if (nameInput) nameInput.value = t.auto_name || '';
        const layoutBtns = vb.querySelectorAll('.vb-layouts .layout-option');
        layoutBtns.forEach(b => b.classList.toggle('active', b.dataset.layout === t.layout));
        const seatsEl = vb.querySelector('.vb-seats-num');
        if (seatsEl) seatsEl.textContent = t.max_seats || 7;
    }

    // Calendar renders dateStr as DD.MM.YYYY, so normalise the trip's
    // date (which arrives as ISO YYYY-MM-DD from Supabase) to the same
    // shape — otherwise the day square doesn't highlight as selected
    // and any subsequent toggle leaves a mixed-format array that
    // sbUpdateTrip can't save.
    tripSelectedDates = t.date ? [formatTripDate(t.date)] : [];
    renderTripCalendar();
    renderSelectedDates();
    updateSeatPreview(1);
    document.getElementById('tripFormOverlay').classList.add('show');
}

// Archive trip
function cancelTrip(calId, city, date) {
    showConfirm('Скасувати рейс «' + city + ' ' + date + '»?\nРейс залишиться у списку зі статусом "Скасований".', async (yes) => {
        if (!yes) return;
        showLoader('Скасування рейсу...');
        var res = await apiPost('updateTrip', { cal_id: calId, data: { 'Статус рейсу': 'Скасований' } });
        if (!res.ok) { hideLoader(); showToast('❌ ' + (res.error || '')); return; }
        const t = trips.find(x => x.cal_id === calId || x.CAL_ID === calId);
        if (t) { t.status = 'Скасований'; t['Статус рейсу'] = 'Скасований'; }
        updateAllCounts();
        updateTripFilterDropdown();
        if (currentView === 'trips') renderTrips();
        else render();
        hideLoader();
        showToast('✅ Рейс скасовано');
    });
}
// Legacy alias
function archiveTrip(calId, city, date) { return cancelTrip(calId, city, date); }

// Delete trip
function deleteTrip(calId, city, date) {
    if (!calId || !String(calId).trim()) {
        showToast('❌ CAL_ID порожній — неможливо видалити');
        return;
    }
    showConfirm('⚠️ ВИДАЛИТИ НАЗАВЖДИ рейс «' + city + ' ' + date + '»?\n\nЦе остаточно — відновлення неможливе.\nПасажири залишаться без рейсу.', async (yes) => {
        if (!yes) return;
        showLoader('Видалення рейсу...');
        var res = await apiPost('deleteTripPermanent', { cal_id: calId });
        if (!res.ok) { hideLoader(); showToast('❌ ' + (res.error || 'Невідома помилка')); return; }
        // Видаляємо з локального масиву одразу
        trips = trips.filter(t => t.cal_id !== calId && t.CAL_ID !== calId);
        // Знімаємо CAL_ID у пасажирів що були на цьому рейсі
        passengers.forEach(p => { if (p['CAL_ID'] === calId) p['CAL_ID'] = ''; });
        // Перерендерюємо інтерфейс
        updateAllCounts();
        updateTripFilterDropdown();
        if (currentView === 'trips') renderTrips();
        else render();
        hideLoader();
        showToast('✅ Рейс видалено');
    });
}

// ================================================================
// UTILS
// ================================================================
function toggleSelect(id, checked) {
    if (checked) selectedIds.add(id); else selectedIds.delete(id);
    updateBulkToolbar();
}

function clearSelection() {
    selectedIds.clear();
    updateBulkToolbar();
    closeBulkTripDd();
    render();
}

// ── Вибрати всі / зняти всі ──
function toggleSelectAll() {
    const filtered = getFilteredPassengers();
    if (selectedIds.size >= filtered.length) {
        // Всі вже вибрані — знімаємо
        selectedIds.clear();
    } else {
        // Вибираємо всі видимі
        filtered.forEach(p => selectedIds.add(p['PAX_ID']));
    }
    updateBulkToolbar();
    render();
}

// ── Модалка вибору маршруту ──
function openRouteAssignModal() {
    if (selectedIds.size === 0) return;
    const list = document.getElementById('routeAssignList');
    const title = document.getElementById('routeAssignTitle');
    title.textContent = '🗺️ Перенести ' + selectedIds.size + ' лід(ів) в маршрут';

    if (routes.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:12px;">Немає доступних маршрутів.<br>Створіть маршрут у меню зліва.</div>';
    } else {
        list.innerHTML = routes.map((sheet, idx) => {
            const name = (sheet.sheetName || '');
            const rows = sheet.rows || [];
            const pax = rows.filter(r => (r['Тип запису'] || '').includes('Пасажир')).length;
            const parcels = rows.filter(r => (r['Тип запису'] || '').includes('Посилк')).length;
            return `<button onclick="assignToRoute(${idx})" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border:2px solid #e2e8f0;border-radius:10px;background:white;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;transition:all .2s;" onmouseover="this.style.borderColor='#7c3aed';this.style.background='#faf5ff'" onmouseout="this.style.borderColor='#e2e8f0';this.style.background='white'">
                <span>🗺️ ${name}</span>
                <span style="font-size:10px;color:var(--text-secondary);font-weight:400;">👤${pax} · 📦${parcels}</span>
            </button>`;
        }).join('');
    }
    openModal('routeAssignModal');
}

async function assignToRoute(routeIdx) {
    const sheet = routes[routeIdx];
    if (!sheet) return;
    const sheetName = sheet.sheetName;
    const paxIds = Array.from(selectedIds);

    // Збираємо дані лідів для переносу
    const leadsData = paxIds.map(id => {
        const p = passengers.find(x => x['PAX_ID'] === id);
        if (!p) return null;
        return {
            'RTE_ID': p['PAX_ID'],
            'PAX_ID': p['PAX_ID'],
            'Тип запису': 'Пасажир',
            'Піб пасажира': p['Піб'] || '',
            'Телефон пасажира': p['Телефон пасажира'] || '',
            'Телефон реєстратора': p['Телефон реєстратора'] || '',
            'Дата рейсу': p['Дата виїзду'] || '',
            'Напрям': p['Напрям'] || '',
            'Адреса відправки': p['Адреса відправки'] || '',
            'Адреса прибуття': p['Адреса прибуття'] || '',
            'Номер авто': p['Номер авто'] || '',
            'Місце в авто': p['Місце в авто'] || '',
            'Кількість місць': p['Кількість місць'] || 1,
            'Сума': p['Ціна квитка'] || '',
            'Валюта': p['Валюта квитка'] || '',
            'Завдаток': p['Завдаток'] || '',
            'Валюта завдатку': p['Валюта завдатку'] || '',
            'Статус оплати': p['Статус оплати'] || 'Не оплачено',
            'Статус': p['Статус ліда'] || 'Новий',
            'Вага багажу': p['Вага багажу'] || '',
            'Ціна багажу': p['Ціна багажу'] || '',
            'Валюта багажу': p['Валюта багажу'] || '',
            'Примітка': p['Примітка'] || ''
        };
    }).filter(Boolean);

    if (leadsData.length === 0) return;

    closeModal('routeAssignModal');

    // Перевірка дублікатів — підвантажити дані маршруту якщо ще не завантажено
    if (sheet.rows === null || sheet.rows === undefined) {
        showLoader('Перевірка маршруту...');
        await loadRouteSheetData(routeIdx, false);
        hideLoader();
    }
    const canProceed = await checkAndConfirmDuplicates(sheet, leadsData);
    if (!canProceed) return;

    showLoader('Переносимо ' + leadsData.length + ' лід(ів) в маршрут...');

    try {
        const res = await apiPost('addToRoute', { sheetName: sheetName, leads: leadsData });
        hideLoader();
        if (res.ok) {
            showToast('✅ ' + leadsData.length + ' лід(ів) перенесено в ' + sheetName);
            clearSelection();
            await loadRoutes(); // Оновити маршрути
            // Авто-оптимізація: запропонувати оптимізувати порядок
            autoOptimizeRoutePrompt(routeIdx, sheetName);
        } else {
            showToast('❌ ' + (res.error || 'Помилка переносу'));
        }
    } catch (e) {
        hideLoader();
        showToast('❌ Помилка: ' + e.message);
    }
}

function updateBulkToolbar() {
    const tb = document.getElementById('bulkToolbar');
    const ct = document.getElementById('bulkCount');
    if (selectedIds.size > 0) {
        tb.classList.add('show');
        ct.textContent = selectedIds.size + ' обрано';
    } else {
        tb.classList.remove('show');
        closeBulkTripDd();
    }
}

function openSideMenu() {
    // На мобільному (≤900px — той самий breakpoint що й у media-queries CSS) два
    // тулбари масових дій (#bulkToolbar для пасажирів і #routeBulkToolbar для
    // маршрутів) налазять один на одного внизу екрану, якщо обидва мають
    // виділені елементи. Коли юзер відкриває ліве меню розділів — скидаємо
    // будь-які поточні виділення, щоб обидва тулбари зникли й не плутали UI.
    // На десктопі (≥901px) нічого не чіпаємо — там простору достатньо.
    try {
        if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
            if (typeof selectedIds !== 'undefined' && selectedIds.size > 0) {
                clearSelection();
            }
            if (typeof routeSelectedIds !== 'undefined' && routeSelectedIds.size > 0) {
                clearRouteSelection();
            }
        }
    } catch (_) { /* matchMedia недоступне в дуже старих браузерах — ігноруємо */ }
    document.getElementById('sideMenu').classList.add('open');
    document.getElementById('sideMenuOverlay').classList.add('show');
}
function closeSideMenu() {
    document.getElementById('sideMenu').classList.remove('open');
    document.getElementById('sideMenuOverlay').classList.remove('show');
    // Згорнути всі секції щоб при наступному відкритті меню все було закрите
    document.querySelectorAll('.mobile-section-content').forEach(function(el) { el.style.display = 'none'; });
    document.querySelectorAll('.mobile-section-toggle').forEach(function(el) { el.classList.remove('open'); });
}

function toggleMobileSection(section) {
    const name = section.charAt(0).toUpperCase() + section.slice(1);
    const content = document.getElementById('mobileSection' + name);
    const toggle = document.getElementById('mobileToggle' + name);
    if (!content) return;
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    if (toggle) toggle.classList.toggle('open', !isOpen);
    // Для маршрутів — підвантажити якщо ще не завантажено
    if (section === 'routes' && !isOpen && routes.length === 0) loadRoutes();
    // Для календаря — рендеримо при відкритті
    if (section === 'paxCal' && !isOpen) renderPaxCalendar();
}

function togglePcSection(section) {
    const content = document.getElementById('pcSection' + section.charAt(0).toUpperCase() + section.slice(1));
    const header = content?.previousElementSibling;
    if (content) content.classList.toggle('collapsed');
    if (header) header.classList.toggle('collapsed');
    // Для календаря — рендеримо при відкритті
    if (section === 'paxCal' && content && !content.classList.contains('collapsed')) renderPaxCalendar();
}

function togglePcSidebar() {
    const sidebar = document.getElementById('pcSidebar');
    const btn = document.getElementById('pcSidebarCollapseBtn');
    const isCollapsed = sidebar.classList.toggle('collapsed-sidebar');
    btn.textContent = isCollapsed ? '▶' : '◀';
    btn.style.left = isCollapsed ? '0px' : '300px';
}

// ================================================================
// COLLAPSIBLE FILTERS (PC & Mobile)
// ================================================================
function togglePaxFilters() {
    var panel = document.getElementById('paxFilterPanel');
    var arrow = document.getElementById('paxFilterArrow');
    if (!panel) return;
    var isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.classList.toggle('open', !isOpen);
}
function toggleMobileFilters(e) {
    if (e) e.stopPropagation();
    var panel = document.getElementById('mobileFilterPanel');
    var arrow = document.getElementById('mobileFilterArrow');
    if (!panel) return;
    var isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.classList.toggle('open', !isOpen);
}

// ================================================================
// PASSENGER CALENDAR — календар з кількістю пасажирів по датах
// ================================================================
var paxCalMonth = new Date();
var paxCalSelectedDate = null;
var paxCalDirFilter = 'all'; // 'all', 'ua-eu', 'eu-ua'

function renderPaxCalendar() {
    var containers = [document.getElementById('paxCalendarPC'), document.getElementById('paxCalendarMobile')];
    var y = paxCalMonth.getFullYear(), m = paxCalMonth.getMonth();
    var months = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
    var days = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
    var firstDay = new Date(y, m, 1);
    var startDay = firstDay.getDay() - 1; if (startDay < 0) startDay = 6;
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var today = new Date(); today.setHours(0,0,0,0);

    // Рахуємо пасажирів по датах
    var dateCounts = {};
    passengers.forEach(function(p) {
        if ((p['Статус CRM'] || 'Активний') === 'Архів') return;
        if (paxCalDirFilter !== 'all' && !isDir(p, paxCalDirFilter)) return;
        var dep = formatTripDate(p['Дата виїзду'] || '');
        if (!dep || dep === '—') return;
        var parts = dep.split('.');
        if (parts.length < 3) return;
        var pm = parseInt(parts[1], 10) - 1;
        var py = parseInt(parts[2], 10);
        if (py === y && pm === m) {
            dateCounts[dep] = (dateCounts[dep] || 0) + 1;
        }
    });

    var html = '<div class="pax-cal">';
    // Direction filter
    html += '<div class="pax-cal-dir">';
    html += '<button class="pax-cal-dir-btn' + (paxCalDirFilter === 'all' ? ' active' : '') + '" onclick="setPaxCalDir(\'all\')">Всі</button>';
    html += '<button class="pax-cal-dir-btn' + (paxCalDirFilter === 'ua-eu' ? ' active' : '') + '" onclick="setPaxCalDir(\'ua-eu\')">UA→EU</button>';
    html += '<button class="pax-cal-dir-btn' + (paxCalDirFilter === 'eu-ua' ? ' active' : '') + '" onclick="setPaxCalDir(\'eu-ua\')">EU→UA</button>';
    html += '</div>';
    // Header
    html += '<div class="pax-cal-header">';
    html += '<button class="pax-cal-nav" onclick="paxCalMonth.setMonth(paxCalMonth.getMonth()-1);renderPaxCalendar()">◀</button>';
    html += '<span class="pax-cal-title">' + months[m] + ' ' + y + '</span>';
    html += '<button class="pax-cal-nav" onclick="paxCalMonth.setMonth(paxCalMonth.getMonth()+1);renderPaxCalendar()">▶</button>';
    html += '</div>';
    // Weekdays
    html += '<div class="pax-cal-weekdays">';
    days.forEach(function(d) { html += '<div class="pax-cal-wd">' + d + '</div>'; });
    html += '</div>';
    // Days
    html += '<div class="pax-cal-days">';
    for (var i = 0; i < startDay; i++) html += '<div class="pax-cal-day empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
        var dt = new Date(y, m, d);
        var dateStr = String(d).padStart(2, '0') + '.' + String(m + 1).padStart(2, '0') + '.' + y;
        var isToday = dt.getTime() === today.getTime();
        var isSel = paxCalSelectedDate === dateStr;
        var cnt = dateCounts[dateStr] || 0;
        html += '<div class="pax-cal-day' + (isToday ? ' today' : '') + (isSel ? ' selected' : '') + '" onclick="selectPaxCalDate(\'' + dateStr + '\')">';
        html += '<span class="pax-cal-num">' + d + '</span>';
        if (cnt > 0) html += '<span class="pax-cal-badge">' + cnt + '</span>';
        html += '</div>';
    }
    html += '</div>';
    // Reset button
    if (paxCalSelectedDate) {
        html += '<button class="pax-cal-reset" onclick="selectPaxCalDate(null)">✕ Скинути фільтр дати</button>';
    }
    html += '</div>';

    containers.forEach(function(el) { if (el) el.innerHTML = html; });
}

function selectPaxCalDate(dateStr) {
    if (paxCalSelectedDate === dateStr || dateStr === null) {
        paxCalSelectedDate = null;
    } else {
        paxCalSelectedDate = dateStr;
        // На мобільному — закрити бокове меню щоб одразу бачити пасажирів
        if (window.innerWidth <= 900) closeSideMenu();
    }
    renderPaxCalendar();
    render();
}

function setPaxCalDir(dir) {
    paxCalDirFilter = dir;
    renderPaxCalendar();
}

function openModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

// ================================================================
// COLUMN CONFIGURATOR
// ================================================================
let colCfgTemp = []; // temporary selection while modal is open

function getAllColumnKeys() {
    return Object.keys(COL_MAP);
}

var cfgActiveTab = 'card'; // 'card' | 'osnovne'
var cardCfgTemp = [];

function openColumnConfigurator() {
    cfgActiveTab = 'card';
    colCfgTemp = [...getOsnovneFields()];
    cardCfgTemp = [...getCardFields()];
    switchCfgTab('card');
    openModal('columnModal');
}

function switchCfgTab(tab) {
    cfgActiveTab = tab;
    var btnCard = document.getElementById('cfgTabCard');
    var btnOsn = document.getElementById('cfgTabOsnovne');
    if (btnCard) { btnCard.style.borderBottom = tab === 'card' ? '2px solid var(--primary)' : 'none'; btnCard.style.color = tab === 'card' ? 'var(--primary)' : 'var(--text-secondary)'; }
    if (btnOsn) { btnOsn.style.borderBottom = tab === 'osnovne' ? '2px solid var(--primary)' : 'none'; btnOsn.style.color = tab === 'osnovne' ? 'var(--primary)' : 'var(--text-secondary)'; }
    var label = document.getElementById('colCfgLabel');
    if (label) label.textContent = tab === 'card' ? 'Що показувати на картці пасажира в списку' : 'Які поля показувати у вкладці «Основне» при натисканні на ліда';
    renderColumnConfigurator();
}

function renderColumnConfigurator() {
    var list = document.getElementById('colCfgList');
    if (!list) return;

    if (cfgActiveTab === 'card') {
        list.innerHTML = CARD_FIELD_OPTIONS.map(function(f) {
            var isSel = cardCfgTemp.includes(f.key);
            return '<div class="col-cfg-item ' + (isSel ? 'checked' : '') + '" onclick="toggleColCfg(\'' + f.key + '\')">' +
                '<div class="col-check">' + (isSel ? '✓' : '') + '</div>' +
                '<div class="col-name">' + f.label + '</div></div>';
        }).join('');
    } else {
        var allKeys = getAllColumnKeys();
        var otherFields = new Set();
        OTHER_SECTIONS.forEach(function(s) { s.fields.forEach(function(f) { otherFields.add(f); }); });
        list.innerHTML = allKeys.map(function(key) {
            var colName = COL_MAP[key] || key;
            var isSel = colCfgTemp.includes(key);
            var isInOther = otherFields.has(key) && !isSel;
            return '<div class="col-cfg-item ' + (isSel ? 'checked' : '') + ' ' + (isInOther ? 'greyed' : '') + '" onclick="toggleColCfg(\'' + key + '\')">' +
                '<div class="col-check">' + (isSel ? '✓' : '') + '</div>' +
                '<div class="col-name">' + colName + '</div></div>';
        }).join('');
    }
}

function toggleColCfg(key) {
    if (cfgActiveTab === 'card') {
        var idx = cardCfgTemp.indexOf(key);
        if (idx >= 0) cardCfgTemp.splice(idx, 1); else cardCfgTemp.push(key);
    } else {
        var idx = colCfgTemp.indexOf(key);
        if (idx >= 0) colCfgTemp.splice(idx, 1); else colCfgTemp.push(key);
    }
    renderColumnConfigurator();
}

function saveColumnConfig() {
    if (cfgActiveTab === 'osnovne' && colCfgTemp.length === 0) { showToast('Оберіть хоча б одну колонку'); return; }
    if (cfgActiveTab === 'card' && cardCfgTemp.length === 0) { showToast('Оберіть хоча б один елемент'); return; }
    localStorage.setItem(getManagerColsKey(), JSON.stringify(colCfgTemp));
    localStorage.setItem(getManagerCardKey(), JSON.stringify(cardCfgTemp));
    closeModal('columnModal');
    if (openDetailsId) {
        var p = passengers.find(function(x) { return x['PAX_ID'] === openDetailsId; });
        if (p) {
            var el = document.getElementById('details-' + openDetailsId);
            if (el) el.innerHTML = renderDetails(p);
        }
    }
    render();
    showToast('✅ Налаштування збережено');
}

function resetDefaultColumns() {
    if (cfgActiveTab === 'card') {
        cardCfgTemp = [...DEFAULT_CARD_FIELDS];
    } else {
        colCfgTemp = [...DEFAULT_OSNOVNE_FIELDS];
    }
    renderColumnConfigurator();
}

function showLoader(text) { document.getElementById('loaderText').textContent = text || 'Завантаження...'; document.getElementById('globalLoader').classList.add('show'); }
function hideLoader() { document.getElementById('globalLoader').classList.remove('show'); }

function showToast(msg, duration) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration || 2500);
}

function showConfirm(text, cb) {
    document.getElementById('confirmText').innerHTML = text.replace(/\n/g, '<br>');
    confirmCallback = cb;
    document.getElementById('confirmOverlay').classList.add('show');
}
function confirmResult(yes) {
    document.getElementById('confirmOverlay').classList.remove('show');
    if (confirmCallback) confirmCallback(yes);
    confirmCallback = null;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => showToast('📋 Скопійовано')).catch(() => {});
}

// ================================================================
// TRIP ASSIGN — Single lead dropdown
// ================================================================
let openTripDDId = null;

function toggleTripAssignDD(paxId) {
    // Close any other open dropdown
    if (openTripDDId && openTripDDId !== paxId) {
        const prev = document.getElementById('tripDD-' + openTripDDId);
        if (prev) prev.classList.remove('show');
    }

    const dd = document.getElementById('tripDD-' + paxId);
    if (!dd) return;

    // Відкриваємо модальне вікно замість дропдауну
    openTripModal([paxId]);
}

// ================================================================
// TRIP ASSIGN MODAL — двокрокове вікно (дата → авто)
// ================================================================

// Стан модалки
let tmPaxIds = [];        // Для кого призначаємо
let tmSelectedCalId = ''; // Обраний рейс
let tmSelectedDate = '';  // Обрана дата
let tmMode = 'assign';    // 'assign' | 'form' (з форми додавання)
let tmFormCallback = null; // Callback для форми

// Форматування дати: ISO/будь-який → "dd.MM"
function formatTripDate(raw) {
    if (!raw) return '—';
    var s = String(raw);
    // ISO формат "2026-03-04T08:00:00.000Z" → "04.03.2026"
    if (s.includes('T')) s = s.split('T')[0];
    // "2026-03-04" → "04.03.2026"
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
        var p = s.split('-');
        return p[2] + '.' + p[1] + '.' + p[0];
    }
    return s;
}

// Коротка дата для пілюлі "04 бер"
function formatDatePill(raw) {
    if (!raw) return { day: '—', num: '?', month: '' };
    var formatted = formatTripDate(raw);
    var parts = formatted.split('.');
    if (parts.length < 3) return { day: '', num: formatted, month: '' };
    var dayNum = parts[0];
    var monthNum = parseInt(parts[1]);
    var months = ['','січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'];
    var dayNames = ['нд','пн','вт','ср','чт','пт','сб'];
    var dateObj = new Date(parseInt(parts[2]), monthNum - 1, parseInt(dayNum));
    var dayName = dayNames[dateObj.getDay()] || '';
    return { day: dayName, num: dayNum, month: months[monthNum] || '' };
}

// Отримати напрямок пасажирів
function getPaxDirection(paxIds) {
    var dirs = { ue: false, eu: false };
    paxIds.forEach(function(id) {
        var p = passengers.find(function(x) { return x['PAX_ID'] === id; });
        if (!p) return;
        var d = String(p['Напрям'] || '').toLowerCase().trim();
        if (d.startsWith('ук') || d.startsWith('ua') || d.startsWith('україна')) dirs.ue = true;
        if (d.startsWith('єв') || d.startsWith('eu') || d.startsWith('європа')) dirs.eu = true;
    });
    return dirs;
}

// Фільтруємо рейси по напряму
function getMatchingTrips(paxIds) {
    var dirs = getPaxDirection(paxIds);
    return trips.filter(function(t) {
        if (t.status === 'Архів' || t.status === 'Виконано' || t.status === 'Видалено') return false;
        var tDir = String(t.direction || '').toLowerCase().trim();
        var tIsUE = tDir.startsWith('ук') || tDir.startsWith('ua') || tDir.startsWith('україна');
        var tIsEU = tDir.startsWith('єв') || tDir.startsWith('eu') || tDir.startsWith('європа');
        if (dirs.ue && tIsUE) return true;
        if (dirs.eu && tIsEU) return true;
        return false;
    });
}

// Унікальні дати з рейсів
function getUniqueDates(tripsList) {
    var dateMap = {};
    tripsList.forEach(function(t) {
        var d = formatTripDate(t.date);
        if (!dateMap[d]) dateMap[d] = { raw: t.date, formatted: d, count: 0, totalFree: 0 };
        dateMap[d].count++;
        dateMap[d].totalFree += (parseInt(t.free_seats) || 0);
    });
    var arr = Object.values(dateMap);
    arr.sort(function(a,b) { return a.formatted > b.formatted ? 1 : -1; });
    return arr;
}

// ВІДКРИТИ модальне вікно призначення рейсу
function openTripModal(paxIds, mode, callback) {
    tmPaxIds = paxIds || [];
    tmSelectedCalId = '';
    tmSelectedDate = '';
    tmMode = mode || 'assign';
    tmFormCallback = callback || null;

    var overlay = document.getElementById('tripAssignOverlay');
    var title = document.getElementById('tmTitle');
    var foot = document.getElementById('tmFoot');

    // Заголовок
    if (mode === 'form') {
        title.textContent = 'Обрати рейс для нового пасажира';
    } else if (tmPaxIds.length > 1) {
        title.textContent = 'Призначити рейс (' + tmPaxIds.length + ' лідів)';
    } else {
        var p = passengers.find(function(x) { return x['PAX_ID'] === tmPaxIds[0]; });
        title.textContent = p ? 'Рейс: ' + (p['Піб'] || tmPaxIds[0]) : 'Призначити рейс';
    }

    // Кнопка "Зняти" якщо вже призначено (тільки для 1 пасажира)
    if (tmPaxIds.length === 1) {
        var px = passengers.find(function(x) { return x['PAX_ID'] === tmPaxIds[0]; });
        if (px && px['CAL_ID']) {
            foot.innerHTML = '<button class="btn-unassign" onclick="doUnassignTrip()">✕ Зняти з рейсу</button>' +
                '<button class="btn-cancel" onclick="closeTripModal()">Скасувати</button>' +
                '<button class="btn-save" id="tmSaveBtn" disabled onclick="confirmTripAssign()">Призначити</button>';
        } else {
            foot.innerHTML = '<button class="btn-cancel" onclick="closeTripModal()">Скасувати</button>' +
                '<button class="btn-save" id="tmSaveBtn" disabled onclick="confirmTripAssign()">Призначити</button>';
        }
    } else {
        foot.innerHTML = '<button class="btn-cancel" onclick="closeTripModal()">Скасувати</button>' +
            '<button class="btn-save" id="tmSaveBtn" disabled onclick="confirmTripAssign()">Призначити</button>';
    }

    // Показуємо крок 1 — дати
    renderTripModalStep1();
    overlay.classList.add('show');
}

function closeTripModal() {
    document.getElementById('tripAssignOverlay').classList.remove('show');
    // Видаляємо фейкового пасажира __form__ (якщо був створений з форми додавання)
    passengers = passengers.filter(p => p['PAX_ID'] !== '__form__');
    tmPaxIds = [];
    tmSelectedCalId = '';
    tmSelectedDate = '';
}

// КРОК 1 — вибір дати
function renderTripModalStep1() {
    document.getElementById('tmStep').textContent = 'Крок 1 — оберіть дату';
    var saveBtn = document.getElementById('tmSaveBtn');
    if (saveBtn) saveBtn.disabled = true;
    tmSelectedCalId = '';
    tmSelectedDate = '';

    var matchTrips = getMatchingTrips(tmPaxIds);

    if (matchTrips.length === 0) {
        document.getElementById('tmBody').innerHTML =
            '<div class="tm-no-vehicles">Немає доступних рейсів для цього напряму</div>';
        return;
    }

    var dates = getUniqueDates(matchTrips);

    var html = '<div class="tm-section-label">Доступні дати</div><div class="tm-dates-grid">';
    dates.forEach(function(d) {
        var pill = formatDatePill(d.raw);
        html += '<div class="tm-date-pill" onclick="selectTripDate(\'' + d.formatted + '\')" id="tm-date-' + d.formatted.replace(/\./g,'-') + '">' +
            '<div class="tm-date-day">' + pill.day + '</div>' +
            '<div class="tm-date-num">' + pill.num + '</div>' +
            '<div class="tm-date-month">' + pill.month + '</div>' +
            '<div class="tm-date-trips">' + d.count + ' рейс' + (d.count > 1 ? 'ів' : '') + '</div>' +
        '</div>';
    });
    html += '</div>';

    document.getElementById('tmBody').innerHTML = html;
}

// Вибрано дату → показуємо авто (крок 2)
function selectTripDate(dateFormatted) {
    tmSelectedDate = dateFormatted;
    tmSelectedCalId = '';
    var saveBtn = document.getElementById('tmSaveBtn');
    if (saveBtn) saveBtn.disabled = true;

    document.getElementById('tmStep').textContent = 'Крок 2 — оберіть авто';

    var matchTrips = getMatchingTrips(tmPaxIds);
    var forDate = matchTrips.filter(function(t) {
        return formatTripDate(t.date) === dateFormatted;
    });

    // Оновлюємо вибір дати
    document.querySelectorAll('.tm-date-pill').forEach(function(el) { el.classList.remove('active'); });
    var activeEl = document.getElementById('tm-date-' + dateFormatted.replace(/\./g,'-'));
    if (activeEl) activeEl.classList.add('active');

    // Рендеримо авто під датами
    var vehiclesDiv = document.getElementById('tmVehicles');
    if (!vehiclesDiv) {
        var body = document.getElementById('tmBody');
        body.innerHTML += '<div class="tm-section-label">Авто на ' + dateFormatted + '</div><div id="tmVehicles"></div>';
        vehiclesDiv = document.getElementById('tmVehicles');
    } else {
        // Оновлюємо заголовок
        var labels = document.querySelectorAll('.tm-section-label');
        if (labels.length > 1) labels[1].textContent = 'Авто на ' + dateFormatted;
    }

    if (forDate.length === 0) {
        vehiclesDiv.innerHTML = '<div class="tm-no-vehicles">Немає авто на цю дату</div>';
        return;
    }

    var html = '';
    forDate.forEach(function(t) {
        var free = parseInt(t.free_seats) || 0;
        var max = parseInt(t.max_seats) || 0;
        var occ = parseInt(t.occupied) || 0;
        var isFull = free <= 0;
        var isOverbooked = occ > max && max > 0;
        var dDir = getTripDirection(t);
        var dIsUaEu = dDir === 'ua-eu';
        var dirBadge = '<span class="card-direction ' + (dIsUaEu ? 'dir-badge-ua-eu' : 'dir-badge-eu-ua') + '" style="font-size:9px;padding:2px 6px;">' + (dIsUaEu ? 'UA→EU' : 'EU→UA') + '</span>';
        var overBadge = isOverbooked ? '<div style="color:#dc2626;font-size:10px;font-weight:700;">⚠️ +' + (occ - max) + ' зайвих</div>' : '';
        var seatColor = isOverbooked ? 'red' : free > 2 ? 'green' : 'red';
        var seatLabel = isOverbooked ? occ + '/' + max : free + '/' + max;
        html += '<div class="tm-vehicle-card ' + (isFull ? 'full' : '') + '" id="tm-veh-' + t.cal_id + '" onclick="selectTripVehicle(\'' + t.cal_id + '\')" style="' + (isOverbooked ? 'border-color:#dc2626;' : '') + '">' +
            '<div class="tm-vehicle-icon">🚐</div>' +
            '<div class="tm-vehicle-info">' +
                '<div class="tm-vehicle-name">' + dirBadge + ' ' + (t.auto_name || 'Авто') + '</div>' +
                '<div class="tm-vehicle-route">' + (t.city || '—') + '</div>' +
                overBadge +
            '</div>' +
            '<div class="tm-vehicle-seats">' +
                '<div class="tm-vehicle-free ' + seatColor + '">' + seatLabel + '</div>' +
                '<div class="tm-vehicle-label">' + (isOverbooked ? 'перебір!' : isFull ? 'Повний' : 'вільних') + '</div>' +
            '</div>' +
        '</div>';
    });
    vehiclesDiv.innerHTML = html;
}

// Вибрано авто → активуємо кнопку "Призначити"
function selectTripVehicle(calId) {
    tmSelectedCalId = calId;
    document.querySelectorAll('.tm-vehicle-card').forEach(function(el) { el.classList.remove('active'); });
    var el = document.getElementById('tm-veh-' + calId);
    if (el) el.classList.add('active');
    var saveBtn = document.getElementById('tmSaveBtn');
    if (saveBtn) saveBtn.disabled = false;
}

// Підтвердження — надсилаємо API
async function confirmTripAssign() {
    if (!tmSelectedCalId) return;

    // Зберігаємо значення ДО закриття модалки (closeTripModal обнуляє їх)
    var calId = tmSelectedCalId;
    var paxIds = tmPaxIds.slice();
    var mode = tmMode;
    var callback = tmFormCallback;

    // Якщо з форми додавання — callback і закриваємо
    if (mode === 'form' && callback) {
        closeTripModal();
        callback(calId);
        return;
    }

    // Перевіряємо чи вистачає місць
    var trip = trips.find(function(t) { return t.cal_id === calId; });
    if (trip) {
        var free = parseInt(trip.free_seats) || 0;
        var max = parseInt(trip.max_seats) || 0;
        var newSeats = 0;
        paxIds.forEach(function(id) {
            var p = passengers.find(function(x) { return x['PAX_ID'] === id; });
            if (p) newSeats += parseInt(p['Кількість місць']) || 1;
        });
        if (free < newSeats && max > 0) {
            var shortage = newSeats - free;
            showConfirm('⚠️ Не вистачає ' + shortage + ' місць! (Вільних: ' + free + ', потрібно: ' + newSeats + '). Все одно призначити?', function(yes) {
                if (yes) doAssignTrip(calId, paxIds);
            });
            return;
        }
    }

    doAssignTrip(calId, paxIds);
}

async function doAssignTrip(calId, paxIds) {
    // Показуємо лоадер ДО закриття модалки
    showLoader('Призначаю рейс...');
    closeTripModal();

    var res = await apiPost('assignTrip', { cal_id: calId, pax_ids: paxIds });

    if (res.ok) {
        // Оновлюємо локальний стан
        paxIds.forEach(function(id) {
            var p = passengers.find(function(x) { return x['PAX_ID'] === id; });
            if (p) {
                p['CAL_ID'] = calId;
                if (p['Статус ліда'] === 'Новий') p['Статус ліда'] = 'В роботі';
            }
        });
        // Оновлюємо free_seats та occupied в рейсі
        var trip = trips.find(function(t) { return t.cal_id === calId; });
        if (trip) {
            var assigned = passengers.filter(function(px) { return px['CAL_ID'] === calId; });
            var usedSeats = 0;
            assigned.forEach(function(px) { usedSeats += parseInt(px['Кількість місць']) || 1; });
            trip.occupied = usedSeats;
            trip.free_seats = Math.max(0, (parseInt(trip.max_seats) || 0) - usedSeats);
        }
        hideLoader();
        var maxS = trip ? (parseInt(trip.max_seats) || 0) : 0;
        if (trip && trip.occupied > maxS && maxS > 0) {
            showToast('⚠️ Рейс призначено, але перебір на ' + (trip.occupied - maxS) + ' місць!');
        } else {
            showToast('✅ Рейс призначено');
        }
        render();
        updateAllCounts();
        silentSync();
    } else {
        hideLoader();
        showToast('❌ ' + (res.error || 'Помилка'));
    }
}

// Зняти з рейсу (кнопка в модалці)
async function doUnassignTrip() {
    // Зберігаємо ДО закриття
    var paxId = tmPaxIds.length > 0 ? tmPaxIds[0] : '';
    if (!paxId) return;

    var p = passengers.find(function(x) { return x['PAX_ID'] === paxId; });
    if (!p) return;

    var oldCalId = p['CAL_ID'];
    showLoader('Знімаю з рейсу...');
    closeTripModal();

    var res = await apiPost('unassignTrip', { pax_ids: [paxId] });
    if (res.ok) {
        p['CAL_ID'] = '';
        // Оновлюємо free_seats та occupied у рейсі
        if (oldCalId) {
            var trip = trips.find(function(t) { return t.cal_id === oldCalId; });
            if (trip) {
                var assigned = passengers.filter(function(px) { return px['CAL_ID'] === oldCalId; });
                var usedSeats = 0;
                assigned.forEach(function(px) { usedSeats += parseInt(px['Кількість місць']) || 1; });
                trip.occupied = usedSeats;
                trip.free_seats = Math.max(0, (parseInt(trip.max_seats) || 0) - usedSeats);
            }
        }
        hideLoader();
        showToast('✅ Знято з рейсу');
        render();
        updateAllCounts();
        silentSync();
    } else {
        hideLoader();
        showToast('❌ ' + (res.error || 'Помилка'));
    }
}

// ================================================================
// BULK TRIP ASSIGN
// ================================================================
// Масове призначення — відкриваємо ту саму модалку
function openBulkTripDropdown(e) {
    e.stopPropagation();
    const paxIds = Array.from(selectedIds);
    if (paxIds.length === 0) return;
    openTripModal(paxIds);
}

function closeBulkTripDd() {
    const dd = document.getElementById('bulkTripDd');
    if (dd) dd.classList.remove('show');
}

// bulkAssignTrip — більше не використовується, замінено на openTripModal

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    // Close trip assign dropdown
    if (openTripDDId && !e.target.closest('.trip-assign-wrap')) {
        const dd = document.getElementById('tripDD-' + openTripDDId);
        if (dd) dd.classList.remove('show');
        openTripDDId = null;
    }
    // Close bulk dropdown
    if (!e.target.closest('.bulk-toolbar')) {
        closeBulkTripDd();
    }
    // Close trip calendar (skip if click was inside calendar — target may be detached after re-render)
    if (!e.target.closest('.tcal-wrap') && !tcalClickInside) {
        const dd = document.getElementById('tcalDropdown');
        if (dd) dd.classList.remove('show');
    }
    tcalClickInside = false;
});

// ================================================================
// ROUTE OPTIMIZATION WITH DISTANCE & TIME
// ================================================================
let optimizePassengersList = [];
let optimizeBy = 'from'; // 'from' or 'to'
const OPTIMIZE_MAX_WAYPOINTS = 23;

function _optSleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function runOptimization() {
    const filtered = getFilteredPassengers();
    if (!filtered.length) return showToast('Немає заявок для оптимізації');
    window._optimizeRouteContext = null;
    openOptimizeModal(filtered);
}

function bulkOptimize() {
    const selected = [...selectedIds].map(id => passengers.find(p => p['PAX_ID'] === id)).filter(Boolean);
    if (!selected.length) return showToast('Оберіть пасажирів');
    window._optimizeRouteContext = null;
    openOptimizeModal(selected);
}

function openOptimizeModal(passengersList) {
    optimizePassengersList = passengersList;
    optimizeBy = 'from';
    document.getElementById('optimizeCount').textContent = passengersList.length;
    // Reset selects and custom inputs
    document.getElementById('optimizeStartSelect').value = '';
    document.getElementById('optimizeEndSelect').value = '';
    document.getElementById('optimizeStart').value = '';
    document.getElementById('optimizeEnd').value = '';
    document.getElementById('optimizeStart').style.display = 'none';
    document.getElementById('optimizeEnd').style.display = 'none';
    document.getElementById('optFrom').classList.add('selected');
    document.getElementById('optTo').classList.remove('selected');
    document.getElementById('optimizeFormBody').style.display = 'block';
    document.getElementById('optimizeResultBody').style.display = 'none';
    document.getElementById('optimizeLoadingBody').style.display = 'none';
    document.getElementById('optimizeFormFooter').style.display = 'flex';
    document.getElementById('optimizeResultFooter').style.display = 'none';
    document.getElementById('optimizeModal').classList.add('show');
}

// Handle point select (show/hide custom input)
function onOptPointSelect(which) {
    const sel = document.getElementById(which === 'start' ? 'optimizeStartSelect' : 'optimizeEndSelect');
    const inp = document.getElementById(which === 'start' ? 'optimizeStart' : 'optimizeEnd');
    if (sel.value === '__custom__') {
        inp.style.display = 'block';
        inp.focus();
    } else {
        inp.style.display = 'none';
        inp.value = '';
    }
}

// Get selected address (from select or custom input)
function getOptAddress(which) {
    const sel = document.getElementById(which === 'start' ? 'optimizeStartSelect' : 'optimizeEndSelect');
    const inp = document.getElementById(which === 'start' ? 'optimizeStart' : 'optimizeEnd');
    if (sel.value === '__custom__') return inp.value.trim();
    return sel.value || '';
}

function selectOptimizeBy(by) {
    optimizeBy = by;
    document.getElementById('optFrom').classList.toggle('selected', by === 'from');
    document.getElementById('optTo').classList.toggle('selected', by === 'to');
}

// Geocode via Google Maps JS API
function geocodeClient(address) {
    return new Promise(resolve => {
        if (!window.mapsGeocoder) return resolve(null);
        let settled = false;
        const timeout = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 10000);
        try {
            window.mapsGeocoder.geocode({ address }, (results, status) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (status === 'OK' && results && results[0]) {
                    resolve({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
                } else {
                    resolve(null);
                }
            });
        } catch(e) { if (!settled) { settled = true; clearTimeout(timeout); resolve(null); } }
    });
}

// Google Directions API — optimize waypoints + get legs (distance/time)
function optimizeDirectionsClient(geocodedPassengers, startCoords, endCoords) {
    return new Promise((resolve, reject) => {
        if (!window.mapsDirections) return reject(new Error('Maps API not ready'));
        let settled = false;
        const timeout = setTimeout(() => { if (!settled) { settled = true; reject(new Error('Directions timeout')); } }, 30000);

        const waypoints = geocodedPassengers.map(p => ({
            location: new google.maps.LatLng(p.coords.lat, p.coords.lng),
            stopover: true
        }));

        const origin = new google.maps.LatLng(startCoords.lat, startCoords.lng);
        let destination, routeWaypoints;

        if (endCoords) {
            destination = new google.maps.LatLng(endCoords.lat, endCoords.lng);
            routeWaypoints = waypoints;
        } else {
            destination = waypoints[waypoints.length - 1].location;
            routeWaypoints = waypoints.slice(0, -1);
        }

        window.mapsDirections.route({
            origin, destination,
            waypoints: routeWaypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING
        }, (response, status) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (status === 'OK') {
                const route = response.routes[0];
                const order = route.waypoint_order;
                const legs = route.legs; // legs has distance & duration for each segment
                let finalOrder;
                if (endCoords) {
                    finalOrder = order;
                } else {
                    finalOrder = order.slice();
                    finalOrder.push(geocodedPassengers.length - 1);
                }
                resolve({ order: finalOrder, legs });
            } else {
                reject(new Error('Directions API: ' + status));
            }
        });
    });
}

// Fallback: Nearest Neighbor
function nearestNeighborClient(geocodedPassengers, startCoords) {
    const n = geocodedPassengers.length;
    if (n === 0) return [];
    if (n === 1) return [0];

    function haversine(c1, c2) {
        const R = 6371;
        const dLat = (c2.lat - c1.lat) * Math.PI / 180;
        const dLng = (c2.lng - c1.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(c1.lat*Math.PI/180) * Math.cos(c2.lat*Math.PI/180) * Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    let currentIdx = 0, minDist = Infinity;
    for (let i = 0; i < n; i++) {
        const d = haversine(startCoords, geocodedPassengers[i].coords);
        if (d < minDist) { minDist = d; currentIdx = i; }
    }

    const visited = Array(n).fill(false);
    const tour = [currentIdx];
    visited[currentIdx] = true;

    for (let step = 1; step < n; step++) {
        let nearest = -1, nearDist = Infinity;
        for (let j = 0; j < n; j++) {
            if (!visited[j]) {
                const d = haversine(geocodedPassengers[currentIdx].coords, geocodedPassengers[j].coords);
                if (d < nearDist) { nearDist = d; nearest = j; }
            }
        }
        if (nearest === -1) break;
        tour.push(nearest);
        visited[nearest] = true;
        currentIdx = nearest;
    }
    return tour;
}

// Generate Google Maps links (chunks of 25)
function generateOptimizeMapLinks(orderedPassengers, startAddr, endAddr) {
    const MAX_PER_MAP = 25;
    const links = [];
    if (orderedPassengers.length === 0) return links;

    const perChunk = MAX_PER_MAP - 1;
    let chunkStart = 0;
    while (chunkStart < orderedPassengers.length) {
        const chunkEnd = Math.min(chunkStart + perChunk, orderedPassengers.length);
        const chunk = orderedPassengers.slice(chunkStart, chunkEnd);
        const origin = chunkStart === 0 ? (startAddr || 'Ужгород') : orderedPassengers[chunkStart - 1].address;
        let destination, waypointItems;
        if (chunkEnd >= orderedPassengers.length && endAddr) {
            destination = endAddr;
            waypointItems = chunk;
        } else {
            destination = chunk[chunk.length - 1].address;
            waypointItems = chunk.slice(0, -1);
        }
        let url = 'https://www.google.com/maps/dir/' + encodeURIComponent(origin);
        waypointItems.forEach(p => { url += '/' + encodeURIComponent(p.address); });
        url += '/' + encodeURIComponent(destination);
        links.push({ url, from: chunkStart + 1, to: chunkEnd, total: orderedPassengers.length });
        chunkStart = chunkEnd;
    }
    return links;
}

// Format duration (seconds -> human readable)
function formatDuration(seconds) {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return h + ' год ' + m + ' хв';
    return m + ' хв';
}

// Format distance (meters -> km)
function formatDistance(meters) {
    if (!meters) return '—';
    if (meters < 1000) return meters + ' м';
    return (meters / 1000).toFixed(1) + ' км';
}

// MAIN OPTIMIZATION
// Застосувати збережений оптимізований порядок до масиву passengers
function applyOptimizedOrder() {
    if (!optimizedOrderIds.length) return;
    const idSet = new Set(optimizedOrderIds);
    const byId = {};
    for (const p of passengers) byId[p['PAX_ID']] = p;
    const ordered = [];
    for (const id of optimizedOrderIds) {
        if (byId[id]) { ordered.push(byId[id]); delete byId[id]; }
    }
    // Решту (не оптимізовані або нові) — додати в кінець
    for (const p of passengers) {
        if (!idSet.has(p['PAX_ID'])) ordered.push(p);
    }
    passengers = ordered;
}

async function startOptimization() {
    if (!optimizePassengersList.length) return;
    if (!window.mapsApiReady || !window.mapsGeocoder) {
        showToast('Google Maps API не завантажено. Перезавантажте сторінку.');
        return;
    }

    // UI -> loading
    document.getElementById('optimizeFormBody').style.display = 'none';
    document.getElementById('optimizeLoadingBody').style.display = 'block';
    document.getElementById('optimizeFormFooter').style.display = 'none';

    function updateOptStatus(text, progress) {
        const el = document.getElementById('optimizeLoadingText');
        const pr = document.getElementById('optimizeLoadingProgress');
        if (el && text) el.textContent = text;
        if (pr && progress !== undefined) pr.textContent = progress;
    }

    const startAddress = getOptAddress('start') || 'Ужгород';
    const endAddress = getOptAddress('end');
    const addrField = optimizeBy === 'from' ? 'Адреса відправки' : 'Адреса прибуття';
    const optimizeLabel = optimizeBy === 'from' ? 'Адреса ВІДПРАВКИ' : 'Адреса ПРИБУТТЯ';

    try {
        // 1. Collect passengers with addresses
        const allPassengers = optimizePassengersList.map(p => ({
            paxId: p['PAX_ID'] || '',
            name: p['Піб'] || '',
            phone: p['Телефон пасажира'] || '',
            seats: p['Кількість місць'] || 1,
            fromAddr: p['Адреса відправки'] || '',
            toAddr: p['Адреса прибуття'] || '',
            address: p[addrField] || '',
            coords: null,
            _origData: p
        }));

        const withAddress = allPassengers.filter(p => p.address && p.address.trim());
        const withoutAddress = allPassengers.filter(p => !p.address || !p.address.trim());

        if (withAddress.length === 0) {
            throw new Error('Жоден пасажир не має адреси ("' + addrField + '")');
        }

        // 2. Geocode all addresses
        updateOptStatus('Геокодування адрес...', '0 / ' + withAddress.length);
        const geocoded = [];
        const notGeocodedList = [];

        for (let i = 0; i < withAddress.length; i++) {
            const shortAddr = withAddress[i].address.length > 30 ? withAddress[i].address.substring(0, 30) + '...' : withAddress[i].address;
            updateOptStatus('📍 ' + shortAddr, (i + 1) + ' / ' + withAddress.length);
            const coords = await geocodeClient(withAddress[i].address);
            if (coords) {
                withAddress[i].coords = coords;
                geocoded.push(withAddress[i]);
            } else {
                notGeocodedList.push({ paxId: withAddress[i].paxId, name: withAddress[i].name, address: withAddress[i].address });
            }
            if (i < withAddress.length - 1) await _optSleep(150);
        }

        if (geocoded.length === 0) {
            throw new Error('Жодну адресу не вдалось геокодувати!');
        }

        // 3. Geocode start & end
        updateOptStatus('📍 Геокодування старту...', '');
        const startCoords = await geocodeClient(startAddress) || { lat: 48.6209, lng: 22.2879 };
        let endCoords = null;
        if (endAddress) {
            updateOptStatus('📍 Геокодування фінішу...', '');
            endCoords = await geocodeClient(endAddress);
        }

        // 4. Optimize route
        updateOptStatus('🗺️ Оптимізація маршруту...', geocoded.length + ' точок');
        let optimizedOrder = null;
        let legs = null;
        let method = '';

        if (geocoded.length <= OPTIMIZE_MAX_WAYPOINTS) {
            try {
                const result = await optimizeDirectionsClient(geocoded, startCoords, endCoords);
                optimizedOrder = result.order;
                legs = result.legs;
                method = 'Google Directions API (реальні дороги)';
            } catch(e) {
                console.warn('Directions fallback:', e.message);
            }
        }

        if (!optimizedOrder || optimizedOrder.length === 0) {
            optimizedOrder = nearestNeighborClient(geocoded, startCoords);
            method = 'Nearest Neighbor (по прямій)';
        }

        // 5. Build ordered list with distance/time info
        const orderedPassengers = optimizedOrder.map(idx => geocoded[idx]);
        const mapLinks = generateOptimizeMapLinks(orderedPassengers, startAddress, endAddress);

        // Build leg info (distance, duration, cumulative ETA)
        const legInfo = [];
        let cumulativeTime = 0;
        let cumulativeDist = 0;
        if (legs && legs.length > 0) {
            for (let i = 0; i < orderedPassengers.length; i++) {
                const legIdx = i; // leg[0] = start→first point, leg[1] = first→second, etc.
                if (legIdx < legs.length) {
                    const dist = legs[legIdx].distance ? legs[legIdx].distance.value : 0;
                    const dur = legs[legIdx].duration ? legs[legIdx].duration.value : 0;
                    cumulativeDist += dist;
                    cumulativeTime += dur;
                    legInfo.push({
                        segmentDist: dist,
                        segmentTime: dur,
                        totalDist: cumulativeDist,
                        totalTime: cumulativeTime,
                        segmentDistText: legs[legIdx].distance ? legs[legIdx].distance.text : '',
                        segmentTimeText: legs[legIdx].duration ? legs[legIdx].duration.text : ''
                    });
                } else {
                    legInfo.push({ segmentDist: 0, segmentTime: 0, totalDist: cumulativeDist, totalTime: cumulativeTime, segmentDistText: '', segmentTimeText: '' });
                }
            }
        }

        // 5b. Зберегти оптимізований порядок — переживає silentSync
        optimizedOrderIds = orderedPassengers.map(p => p.paxId);
        lastOptimizedPassengers = orderedPassengers;
        applyOptimizedOrder();

        // 6. Show result
        document.getElementById('optimizeLoadingBody').style.display = 'none';
        showOptimizationResult({
            optimizeBy: optimizeLabel,
            start: startAddress,
            end: endAddress || '(остання точка)',
            stats: { total: withAddress.length, geocoded: geocoded.length, optimized: orderedPassengers.length },
            method,
            mapLinks,
            orderedPassengers,
            legInfo,
            notGeocodedList,
            totalDist: cumulativeDist,
            totalTime: cumulativeTime
        });

        // Перерендерити список карток у оптимізованому порядку
        render();

    } catch(err) {
        console.error('Optimize error:', err);
        document.getElementById('optimizeFormBody').style.display = 'block';
        document.getElementById('optimizeLoadingBody').style.display = 'none';
        document.getElementById('optimizeFormFooter').style.display = 'flex';
        showToast(err.message);
    }
}

function showOptimizationResult(data) {
    document.getElementById('optimizeResultBody').style.display = 'block';
    document.getElementById('optimizeResultFooter').style.display = 'flex';

    let html = '<div class="optimize-result-header">✅ Маршрут оптимізовано!</div>';

    // Stats
    html += '<div class="optimize-stats">';
    html += '<div class="optimize-stat-row"><span class="optimize-stat-label">📋 По:</span><span class="optimize-stat-value">' + data.optimizeBy + '</span></div>';
    html += '<div class="optimize-stat-row"><span class="optimize-stat-label">📍 Старт:</span><span class="optimize-stat-value">' + data.start + '</span></div>';
    html += '<div class="optimize-stat-row"><span class="optimize-stat-label">🏁 Фініш:</span><span class="optimize-stat-value">' + data.end + '</span></div>';
    html += '<div class="optimize-stat-row"><span class="optimize-stat-label">👥 Пасажирів:</span><span class="optimize-stat-value">' + data.stats.optimized + ' / ' + data.stats.total + '</span></div>';
    html += '<div class="optimize-stat-row"><span class="optimize-stat-label">🗺️ Метод:</span><span class="optimize-stat-value">' + data.method + '</span></div>';
    if (data.totalDist > 0) {
        html += '<div class="optimize-stat-row"><span class="optimize-stat-label">📏 Загальна відстань:</span><span class="optimize-stat-value">' + formatDistance(data.totalDist) + '</span></div>';
        html += '<div class="optimize-stat-row"><span class="optimize-stat-label">⏱️ Загальний час:</span><span class="optimize-stat-value">' + formatDuration(data.totalTime) + '</span></div>';
    }
    html += '</div>';

    // Route table with distance/time per stop
    html += '<div style="overflow-x:auto;margin-bottom:16px;">';
    html += '<table class="optimize-route-table">';
    html += '<thead><tr><th>#</th><th>Пасажир</th><th>Адреса</th><th>Відстань</th><th>Час їзди</th><th>ETA від старту</th></tr></thead>';
    html += '<tbody>';
    data.orderedPassengers.forEach((p, i) => {
        const leg = data.legInfo[i] || {};
        html += '<tr>';
        html += '<td><span class="opt-order-num">' + (i + 1) + '</span></td>';
        html += '<td><strong>' + (p.name || '—') + '</strong><br><small style="color:var(--text-secondary)">' + (p.phone || '') + (p.seats > 1 ? ' · ' + p.seats + 'м' : '') + '</small></td>';
        html += '<td style="max-width:180px;word-break:break-word;">' + (p.address || '—') + '</td>';
        html += '<td><span class="opt-dist-badge">' + (leg.segmentDistText || '—') + '</span></td>';
        html += '<td><span class="opt-time-badge">' + (leg.segmentTimeText || '—') + '</span></td>';
        html += '<td><span class="opt-eta-badge">' + formatDuration(leg.totalTime) + '</span></td>';
        html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Not geocoded
    if (data.notGeocodedList && data.notGeocodedList.length > 0) {
        html += '<div class="optimize-not-geocoded">';
        html += '<div class="optimize-not-geocoded-title">⚠️ Не вдалось знайти адреси (' + data.notGeocodedList.length + '):</div>';
        html += '<div class="optimize-not-geocoded-list">';
        data.notGeocodedList.forEach(item => {
            html += '<div class="optimize-not-geocoded-item"><strong>' + item.paxId + '</strong> ' + (item.name ? '(' + item.name + ')' : '') + '<br><small>' + item.address + '</small></div>';
        });
        html += '</div></div>';
    }

    // Map links
    html += '<div class="optimize-map-links">';
    if (data.mapLinks.length === 1) {
        html += '<a href="' + data.mapLinks[0].url + '" target="_blank" class="optimize-map-btn">🗺️ Відкрити маршрут на карті</a>';
    } else {
        data.mapLinks.forEach((link, i) => {
            html += '<a href="' + link.url + '" target="_blank" class="optimize-map-btn">🗺️ Частина ' + (i + 1) + ' (точки ' + link.from + '-' + link.to + ')</a>';
        });
    }
    html += '</div>';

    document.getElementById('optimizeResultBody').innerHTML = html;

    // Якщо оптимізуємо маршрут — показати кнопку "Зберегти порядок"
    const routeWrap = document.getElementById('optRouteSelectWrap');
    if (window._optimizeRouteContext) {
        routeWrap.innerHTML = '<button class="btn-save" style="background:var(--purple);" onclick="reorderRouteAfterOptimize()">💾 Зберегти порядок в маршруті</button>';
    } else {
        routeWrap.innerHTML = '<button class="btn-save" style="background:var(--purple);" onclick="toggleOptRouteDropdown()">🗺️ В маршрут</button>'
            + '<div id="optRouteDropdown" style="display:none;position:absolute;bottom:100%;left:0;min-width:260px;background:white;border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:6px;margin-bottom:6px;max-height:250px;overflow-y:auto;z-index:999;"></div>';
    }
}

// ================================================================
// "В МАРШРУТ" з результатів оптимізації
// ================================================================
let lastOptimizedPassengers = []; // Зберігаємо останніх оптимізованих для переносу

function toggleOptRouteDropdown() {
    const dd = document.getElementById('optRouteDropdown');
    if (dd.style.display === 'block') { dd.style.display = 'none'; return; }
    if (routes.length === 0) {
        dd.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-secondary);font-size:12px;">Немає доступних маршрутів</div>';
    } else {
        dd.innerHTML = routes.map((sheet, idx) => {
            const name = (sheet.sheetName || '');
            const rows = sheet.rows || [];
            const pax = rows.filter(r => (r['Тип запису'] || '').includes('Пасажир')).length;
            return '<button onclick="saveOptimizedToRoute(' + idx + ')" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;border:none;background:white;cursor:pointer;border-radius:6px;font-size:12px;font-family:inherit;transition:background 0.15s;" onmouseover="this.style.background=\'#f0f4f8\'" onmouseout="this.style.background=\'white\'">'
                + '<span style="font-weight:700;">🗺️ ' + name + '</span>'
                + '<span style="color:var(--text-secondary);font-size:11px;">👤' + pax + '</span>'
                + '</button>';
        }).join('');
    }
    dd.style.display = 'block';
    // Закрити по кліку поза
    setTimeout(() => {
        document.addEventListener('click', function closeOptDD(e) {
            if (!document.getElementById('optRouteSelectWrap')?.contains(e.target)) {
                dd.style.display = 'none';
                document.removeEventListener('click', closeOptDD);
            }
        });
    }, 10);
}

async function saveOptimizedToRoute(routeIdx) {
    const sheet = routes[routeIdx];
    if (!sheet) return;
    document.getElementById('optRouteDropdown').style.display = 'none';

    // Використовуємо збережений оптимізований порядок
    const paxIds = optimizedOrderIds.length ? optimizedOrderIds : lastOptimizedPassengers.map(p => p.paxId);
    if (!paxIds.length) return showToast('Немає даних для переносу');

    const leadsData = paxIds.map(id => {
        const p = passengers.find(x => x['PAX_ID'] === id);
        if (!p) return null;
        return {
            'RTE_ID': p['PAX_ID'],
            'PAX_ID': p['PAX_ID'],
            'Тип запису': 'Пасажир',
            'Піб пасажира': p['Піб'] || '',
            'Телефон пасажира': p['Телефон пасажира'] || '',
            'Телефон реєстратора': p['Телефон реєстратора'] || '',
            'Дата рейсу': p['Дата виїзду'] || '',
            'Напрям': p['Напрям'] || '',
            'Адреса відправки': p['Адреса відправки'] || '',
            'Адреса прибуття': p['Адреса прибуття'] || '',
            'Номер авто': p['Номер авто'] || '',
            'Місце в авто': p['Місце в авто'] || '',
            'Кількість місць': p['Кількість місць'] || 1,
            'Сума': p['Ціна квитка'] || '',
            'Валюта': p['Валюта квитка'] || '',
            'Завдаток': p['Завдаток'] || '',
            'Валюта завдатку': p['Валюта завдатку'] || '',
            'Статус оплати': p['Статус оплати'] || 'Не оплачено',
            'Статус': p['Статус ліда'] || 'Новий',
            'Вага багажу': p['Вага багажу'] || '',
            'Ціна багажу': p['Ціна багажу'] || '',
            'Валюта багажу': p['Валюта багажу'] || '',
            'Примітка': p['Примітка'] || ''
        };
    }).filter(Boolean);

    if (!leadsData.length) return showToast('Не знайдено пасажирів');

    closeModal('optimizeModal');

    // Перевірка дублікатів
    if (sheet.rows === null || sheet.rows === undefined) {
        showLoader('Перевірка маршруту...');
        await loadRouteSheetData(routeIdx, false);
        hideLoader();
    }
    const canProceed = await checkAndConfirmDuplicates(sheet, leadsData);
    if (!canProceed) return;

    showLoader('Переносимо ' + leadsData.length + ' лід(ів) в маршрут...');

    try {
        const res = await apiPost('addToRoute', { sheetName: sheet.sheetName, leads: leadsData });
        hideLoader();
        if (res.ok) {
            showToast('✅ ' + leadsData.length + ' лід(ів) перенесено в ' + sheet.sheetName + ' (оптимізований порядок)');
            clearSelection();
            loadRoutes();
        } else {
            showToast('❌ ' + (res.error || 'Помилка переносу'));
        }
    } catch (e) {
        hideLoader();
        showToast('❌ Помилка: ' + e.message);
    }
}

// ================================================================
// ОПТИМІЗАЦІЯ ПОРЯДКУ В МАРШРУТІ
// ================================================================
async function optimizeRouteOrder() {
    if (activeRouteIdx === null || activeRouteIdx >= routes.length) return showToast('Оберіть маршрут');
    const sheet = routes[activeRouteIdx];
    const rows = sheet.rows || [];
    const paxRows = rows.filter(r => (r['Тип запису'] || '').includes('Пасажир'));

    if (paxRows.length < 2) return showToast('Потрібно мінімум 2 пасажири для оптимізації');

    // Конвертуємо рядки маршруту в формат для оптимізації
    const fakePax = paxRows.map(r => ({
        'PAX_ID': r['RTE_ID'] || '',
        'Піб': r['Піб пасажира'] || '',
        'Телефон пасажира': r['Телефон пасажира'] || '',
        'Кількість місць': r['Кількість місць'] || 1,
        'Адреса відправки': r['Адреса відправки'] || '',
        'Адреса прибуття': r['Адреса прибуття'] || '',
    }));

    openOptimizeModal(fakePax);
    // Зберігаємо контекст маршруту для збереження порядку після оптимізації
    window._optimizeRouteContext = {
        sheetName: sheet.sheetName,
        allRows: rows,
        paxRows: paxRows
    };
}

// Авто-пропозиція оптимізувати порядок після додавання лідів
function autoOptimizeRoutePrompt(routeIdx, sheetName) {
    const idx = routes.findIndex(r => r.sheetName === sheetName);
    if (idx === -1) return;
    const sheet = routes[idx];
    const paxRows = (sheet.rows || []).filter(r => (r['Тип запису'] || '').includes('Пасажир'));
    if (paxRows.length < 2) return;

    const name = sheetName;
    showConfirm('Оптимізувати порядок пасажирів у маршруті "' + name + '"? (' + paxRows.length + ' пасажирів)', function() {
        activeRouteIdx = idx;
        optimizeRouteOrder();
    });
}

// Зберегти оптимізований порядок у маршруті (легковагий підхід — без видалення/переставлення рядків).
// Пише масив PAX_ID у placeholder-рядок: pickup_order якщо optimizeBy='from', dropoff_order якщо 'to'.
async function reorderRouteAfterOptimize() {
    const ctx = window._optimizeRouteContext;
    if (!ctx || !optimizedOrderIds.length) return;

    const sheetName = ctx.sheetName;
    const paxRows = ctx.paxRows;

    // В optimizeRouteOrder() ми ремапили: fakePax['PAX_ID'] = r['RTE_ID'].
    // Тому optimizedOrderIds містить RTE_ID, а не реальні PAX_ID лідів.
    // Мапимо RTE_ID → PAX_ID через paxRows.
    const rteToLead = new Map();
    for (const r of paxRows) {
        const rteId = r._resolvedId || r['RTE_ID'];
        const leadId = r['PAX_ID'] || r['PKG_ID'] || '';
        if (rteId && leadId) rteToLead.set(rteId, leadId);
    }

    // Побудувати впорядкований масив PAX_ID у порядку оптимізації.
    const orderedLeadIds = [];
    const seen = new Set();
    for (const rteId of optimizedOrderIds) {
        const leadId = rteToLead.get(rteId);
        if (leadId && !seen.has(leadId)) {
            orderedLeadIds.push(leadId);
            seen.add(leadId);
        }
    }
    // Додати пасажирів, які не потрапили в оптимізацію (нові / без адреси) — в кінець.
    for (const r of paxRows) {
        const leadId = r['PAX_ID'] || r['PKG_ID'] || '';
        if (leadId && !seen.has(leadId)) {
            orderedLeadIds.push(leadId);
            seen.add(leadId);
        }
    }

    if (!orderedLeadIds.length) {
        showToast('Немає лідів для збереження порядку');
        return;
    }

    // Визначити режим (pickup чи dropoff) на основі того, за чим оптимізували.
    const mode = optimizeBy === 'to' ? 'dropoff' : 'pickup';
    const payload = { sheetName };
    if (mode === 'dropoff') {
        payload.dropoff_order = orderedLeadIds;
    } else {
        payload.pickup_order = orderedLeadIds;
    }

    showLoader('Збереження порядку в маршруті...');
    try {
        const res = await apiPost('setRouteOrder', payload);
        hideLoader();
        if (!res || !res.ok) {
            showToast('❌ ' + ((res && res.error) || 'Не вдалося зберегти порядок'));
            return;
        }
        // Оновити локальний кеш порядку на sheet та перемкнути режим відображення.
        const idx = routes.findIndex(r => r.sheetName === sheetName);
        if (idx !== -1) {
            if (mode === 'dropoff') {
                routes[idx].dropoffOrder = orderedLeadIds;
            } else {
                routes[idx].pickupOrder = orderedLeadIds;
            }
            // Перемикаємось на режим, у якому щойно зберегли, щоб користувач одразу бачив результат.
            routeSortMode = mode;
        }
        closeModal('optimizeModal');
        if (activeRouteIdx !== null && routes[activeRouteIdx]) {
            renderRoutes();
        }
        showToast(mode === 'dropoff'
            ? '✅ Порядок висадки збережено в маршруті'
            : '✅ Порядок збору збережено в маршруті');
        window._optimizeRouteContext = null;
    } catch (e) {
        hideLoader();
        showToast('❌ Помилка: ' + e.message);
    }
}

// ================================================================
// ARCHIVE VIEW & FUNCTIONS
// ================================================================
let archiveSelectedIds = new Set();
let archivedPassengers = []; // Окремий масив — дані з Archive_crm_v3
let archiveTotal = 0;
let archiveHasMore = false;
let archiveLoading = false;
const ARCHIVE_PAGE_SIZE = 50;

async function loadArchive(append) {
    if (archiveLoading) return;
    archiveLoading = true;
    try {
        const offset = append ? archivedPassengers.length : 0;
        const res = await apiPost('getArchive', { offset: offset, limit: ARCHIVE_PAGE_SIZE });
        if (res.ok) {
            if (append) {
                archivedPassengers = archivedPassengers.concat(res.rows || []);
            } else {
                archivedPassengers = res.rows || [];
            }
            archiveTotal = res.total || archivedPassengers.length;
            archiveHasMore = res.hasMore || false;
            if (currentView === 'archive') renderArchive();
        }
    } catch (e) {
        console.error('loadArchive error:', e);
    } finally {
        archiveLoading = false;
    }
}

function showArchiveView() {
    currentView = 'archive';
    document.getElementById('passengersView').classList.add('hidden');
    document.getElementById('tripsView').classList.remove('active');
    document.getElementById('routesView').style.display = 'none';
    document.getElementById('archiveView').style.display = 'block';
    updatePcSidebarActive();
    updateMobileSidebarActive();
    showLoader('📦 Завантаження архіву...');
    loadArchive().then(function() { hideLoader(); }).catch(function() { hideLoader(); });
}

function getArchivedPassengers() {
    const search = (document.getElementById('archiveSearch')?.value || '').toLowerCase().trim();
    return archivedPassengers.filter(p => {
        if (search) {
            const name = String(p['Піб'] || '').toLowerCase();
            const phone = String(p['Телефон пасажира'] || '');
            if (!name.includes(search) && !phone.includes(search)) return false;
        }
        return true;
    });
}

function renderArchive() {
    const list = document.getElementById('archiveList');
    const subtitle = document.getElementById('archiveSubtitle');
    if (!list) return;

    const archived = getArchivedPassengers();
    subtitle.textContent = (archiveTotal > archived.length ? archived.length + ' з ' + archiveTotal : archived.length) + ' записів в архіві';

    if (archived.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);font-size:13px;">📦 Архів порожній</div>';
        return;
    }

    let cardsHtml = archived.map(p => {
        const id = p['PAX_ID'] || '';
        const name = p['Піб'] || '—';
        const phone = String(p['Телефон пасажира'] || '—');
        const from = p['Адреса відправки'] || '';
        const to = p['Адреса прибуття'] || '';
        const date = p['Дата виїзду'] || '';
        const reason = p['ARCHIVE_REASON'] || '';
        const archDate = p['DATE_ARCHIVE'] || '';
        const archivedBy = p['ARCHIVED_BY'] || '';
        const dir = p['Напрям'] || '';
        const isSelected = archiveSelectedIds.has(id);
        const dirLabel = dir.includes('ua-eu') || dir.includes('UA→EU') ? 'UA→EU' : dir.includes('eu-ua') || dir.includes('EU→UA') ? 'EU→UA' : '';
        const dirCls = dirLabel === 'UA→EU' ? 'dir-badge-ua-eu' : dirLabel === 'EU→UA' ? 'dir-badge-eu-ua' : '';
        const isFromRoute = reason.indexOf('маршрут') !== -1;

        return `<div class="pax-card ${isSelected ? 'selected' : ''}" style="border-left:3px solid ${isFromRoute ? '#f59e0b' : '#9ca3af'};opacity:0.85;" id="arc-${id}">
            <div class="card-top">
                <div class="card-checkbox-wrap" onclick="event.stopPropagation()">
                    <input class="card-checkbox" type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleArchiveSelect('${id}',this.checked)">
                </div>
                ${dirLabel ? '<span class="card-direction ' + dirCls + '">' + dirLabel + '</span>' : ''}
                <span class="card-phone">${phone}</span>
                <span class="card-date">${date}</span>
            </div>
            <div class="card-info">
                <span class="card-name">${name}</span>
                ${isFromRoute
                    ? '<span style="font-size:9px;background:#fef3c7;color:#b45309;padding:2px 6px;border-radius:4px;font-weight:700;">🚐 З маршруту</span>'
                    : '<span style="font-size:9px;background:#f3f4f6;color:#6b7280;padding:2px 6px;border-radius:4px;">📦 Архів</span>'}
            </div>
            ${(from || to) ? '<div class="card-route">📍 ' + (from || '—') + ' → ' + (to || '—') + '</div>' : ''}
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
                ${archDate ? '<span style="font-size:10px;color:#6b7280;">📅 ' + archDate + '</span>' : ''}
                ${archivedBy ? '<span style="font-size:10px;color:#6b7280;">👤 ' + archivedBy + '</span>' : ''}
                ${reason ? '<span style="font-size:10px;color:#6b7280;">💬 ' + reason + '</span>' : ''}
            </div>
            ${isFromRoute ? '' : `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
                <button class="btn-card-action" style="background:#d1fae5;color:#059669;" onclick="event.stopPropagation(); restorePax('${id}','${name}')">♻️ Відновити</button>
            </div>`}
        </div>`;
    }).join('');

    // Кнопка "Завантажити ще" якщо є ще записи
    if (archiveHasMore) {
        cardsHtml += `<div style="text-align:center;padding:16px;">
            <button onclick="loadArchive(true)" style="padding:8px 24px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text-primary);cursor:pointer;font-size:13px;">
                Завантажити ще (${archivedPassengers.length} з ${archiveTotal})
            </button>
        </div>`;
    }

    list.innerHTML = cardsHtml;

    updateArchiveBulkToolbar();
}

// ── Архівування пасажира ──
function archivePax(paxId, name) {
    showConfirm('Архівувати пасажира «' + name + '»?', async function(yes) {
        if (!yes) return;
        showLoader('Архівування...');
        const res = await apiPost('archivePassenger', { pax_ids: [paxId], reason: 'Ручне архівування', archived_by: 'Менеджер' });
        hideLoader();
        if (res.ok) {
            // Фізично перенесено в Archive_crm_v3 — видаляємо з локального масиву
            passengers = passengers.filter(x => x['PAX_ID'] !== paxId);
            showToast('✅ Архівовано');
            render(); updateAllCounts();
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

// ── Масове архівування ──
function bulkArchive() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    showConfirm('Архівувати ' + ids.length + ' пасажир(ів)?', async function(yes) {
        if (!yes) return;
        showLoader('Архівування ' + ids.length + ' записів...');
        const res = await apiPost('archivePassenger', { pax_ids: ids, reason: 'Масове архівування', archived_by: 'Менеджер' });
        hideLoader();
        if (res.ok) {
            // Фізично перенесено — видаляємо з локального масиву
            passengers = passengers.filter(x => !ids.includes(x['PAX_ID']));
            showToast('✅ Архівовано ' + (res.archived || ids.length) + ' записів');
            clearSelection();
            render(); updateAllCounts();
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

// ── Масове видалення ──
function bulkDelete() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    showConfirm('🗑️ Видалити ' + ids.length + ' пасажир(ів)?\n\n(Переміщення в архів з позначкою "Видалено")', async function(yes) {
        if (!yes) return;
        showLoader('Видалення ' + ids.length + ' записів...');
        const res = await apiPost('deletePassenger', { pax_ids: ids });
        hideLoader();
        if (res.ok) {
            passengers = passengers.filter(x => !ids.includes(x['PAX_ID']));
            showToast('✅ Видалено ' + ids.length + ' записів');
            clearSelection();
            render(); updateAllCounts();
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

// ── Smart Sender: Теги ──
// [ПРОЕКТ] URL PHP proxy для тегування — змінити для нового проекту:
const TAG_API_URL = 'https://botisystem.com/BotiLogistics-v1.0/proxy.php';
var _tagTargetIds = [];

function openTagModal(singlePaxId) {
    _tagTargetIds = [];
    if (singlePaxId) {
        _tagTargetIds = [singlePaxId];
    } else {
        _tagTargetIds = Array.from(selectedIds);
    }
    if (!_tagTargetIds.length) { showToast('Оберіть лідів'); return; }

    const noSmart = _tagTargetIds.filter(id => {
        const p = passengers.find(x => x['PAX_ID'] === id);
        return !p || !p['Ід_смарт'] || String(p['Ід_смарт']).trim() === '';
    });

    document.getElementById('tagNameInput').value = '';
    const resultEl = document.getElementById('tagResult');
    resultEl.style.display = 'none';
    resultEl.innerHTML = '';

    const names = _tagTargetIds.map(id => {
        const p = passengers.find(x => x['PAX_ID'] === id);
        const ss = p ? String(p['Ід_смарт'] || '').trim() : '';
        return (p ? (p['Піб'] || id) : id) + (ss ? ' <span style="color:#7c3aed;">(SS: ' + ss + ')</span>' : '');
    });
    let info = _tagTargetIds.length === 1
        ? 'Лід: <b>' + names[0] + '</b>'
        : 'Лідів: <b>' + _tagTargetIds.length + '</b> (' + names.slice(0, 3).join(', ') + (_tagTargetIds.length > 3 ? '...' : '') + ')';
    if (noSmart.length > 0) {
        info += '<br><span style="color:var(--danger);">⚠️ ' + noSmart.length + ' без Ід_смарт — буде пропущено</span>';
    }
    document.getElementById('tagTargetInfo').innerHTML = info;
    document.getElementById('tagModalTitle').textContent = _tagTargetIds.length === 1 ? '🏷 Присвоїти тег' : '🏷 Теги (' + _tagTargetIds.length + ' лідів)';
    openModal('tagModal');
    setTimeout(() => document.getElementById('tagNameInput').focus(), 100);
}

async function applyTag() {
    const tagName = document.getElementById('tagNameInput').value.trim();
    if (!tagName) { showToast('Введіть назву тегу'); return; }

    const targets = _tagTargetIds.map(id => {
        const p = passengers.find(x => x['PAX_ID'] === id);
        return { paxId: id, smartId: p ? String(p['Ід_смарт'] || '').trim() : '', name: p ? (p['Піб'] || id) : id };
    }).filter(t => t.smartId);

    if (!targets.length) { showToast('Немає лідів з Ід_смарт'); return; }

    const resultEl = document.getElementById('tagResult');
    resultEl.style.display = 'block';
    resultEl.innerHTML = '⏳ Надсилаю тег «' + tagName + '» для ' + targets.length + ' контакт(ів)...';
    resultEl.style.background = '#f0f9ff';
    resultEl.style.color = '#0369a1';

    let ok = 0, fail = 0;
    let html = '';

    for (const t of targets) {
        try {
            const res = await fetch(TAG_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: t.smartId, tagName: tagName })
            });
            const data = await res.json();
            if (data.state) {
                ok++;
                html += '<div style="color:#059669;">✅ ' + t.name + ' <span style="color:#7c3aed;font-size:10px;">(SS: ' + t.smartId + ')</span>' + (data.note ? ' — вже був' : '') + '</div>';
                const p = passengers.find(x => x['PAX_ID'] === t.paxId);
                if (p) {
                    const old = p['Тег'] || '';
                    if (!old.includes(tagName)) {
                        p['Тег'] = old ? old + ', ' + tagName : tagName;
                    }
                }
            } else {
                fail++;
                html += '<div style="color:#dc2626;">❌ ' + t.name + ' <span style="color:#7c3aed;font-size:10px;">(SS: ' + t.smartId + ')</span>: ' + (data.error || 'Помилка') + '</div>';
            }
        } catch (e) {
            fail++;
            html += '<div style="color:#dc2626;">❌ ' + t.name + ' <span style="color:#7c3aed;font-size:10px;">(SS: ' + t.smartId + ')</span>: ' + e.message + '</div>';
        }
    }

    resultEl.innerHTML = '<div style="margin-bottom:6px;font-size:12px;"><b>Результат:</b> ✅ ' + ok + ' / ❌ ' + fail + '</div>' + html;
    resultEl.style.background = fail === 0 ? '#f0fdf4' : '#fef2f2';
    resultEl.style.color = '#1f2937';

    if (ok > 0) {
        showToast('✅ Тег «' + tagName + '» додано: ' + ok + ' контакт(ів)');
        for (const t of targets) {
            const p = passengers.find(x => x['PAX_ID'] === t.paxId);
            if (p) {
                await apiPost('updateField', { sheet: p._sheet || '', pax_id: t.paxId, col: 'Тег', value: p['Тег'] || tagName });
            }
        }
        render();
    }
}

// ── Відновлення з архіву ──
function restorePax(paxId, name) {
    showConfirm('Відновити пасажира «' + name + '»?', async function(yes) {
        if (!yes) return;
        showLoader('Відновлення...');
        const res = await apiPost('restorePassenger', { pax_ids: [paxId] });
        hideLoader();
        if (res.ok) {
            // Фізично повернено в Passengers — видаляємо з локального архіву, перезавантажуємо пасажирів
            archivedPassengers = archivedPassengers.filter(x => x['PAX_ID'] !== paxId);
            showToast('✅ Відновлено');
            renderArchive(); updateAllCounts();
            silentSync(); // Перезавантажити пасажирів щоб побачити відновленого
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

// ── Повне видалення (з архіву назавжди) ──
function deletePaxPermanent(paxId, sheet, name) {
    showConfirm('⚠️ УВАГА! Видалити «' + name + '» НАЗАВЖДИ? Цю дію не можна скасувати!', async function(yes) {
        if (!yes) return;
        showLoader('Видалення...');
        const res = await apiPost('deleteFromArchive', { pax_ids: [paxId] });
        hideLoader();
        if (res.ok) {
            archivedPassengers = archivedPassengers.filter(p => p['PAX_ID'] !== paxId);
            archiveSelectedIds.delete(paxId);
            showToast('✅ Видалено назавжди');
            renderArchive(); updateAllCounts();
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

// ── Archive selection ──
function toggleArchiveSelect(id, checked) {
    if (checked) archiveSelectedIds.add(id);
    else archiveSelectedIds.delete(id);
    updateArchiveBulkToolbar();
}

function toggleArchiveSelectAll() {
    const archived = getArchivedPassengers();
    if (archiveSelectedIds.size === archived.length) {
        archiveSelectedIds.clear();
    } else {
        archived.forEach(p => archiveSelectedIds.add(p['PAX_ID']));
    }
    renderArchive();
}

function clearArchiveSelection() {
    archiveSelectedIds.clear();
    updateArchiveBulkToolbar();
    renderArchive();
}

function updateArchiveBulkToolbar() {
    const tb = document.getElementById('archiveBulkToolbar');
    const ct = document.getElementById('archiveBulkCount');
    if (!tb) return;
    if (archiveSelectedIds.size > 0) {
        tb.classList.add('show');
        ct.textContent = archiveSelectedIds.size + ' обрано';
    } else {
        tb.classList.remove('show');
    }
}

// ── Масове відновлення з архіву ──
function archiveBulkRestore() {
    const allIds = Array.from(archiveSelectedIds);
    if (!allIds.length) return;
    // Exclude passengers archived from a route — they can't be restored from
    // here (their route row is already gone, so restoring would leave a
    // ghost lead with stale trip data). User must add them back manually.
    const ids = allIds.filter(id => {
        const p = archivedPassengers.find(x => x['PAX_ID'] === id);
        const reason = p ? String(p['ARCHIVE_REASON'] || '') : '';
        return reason.indexOf('маршрут') === -1;
    });
    const skipped = allIds.length - ids.length;
    if (!ids.length) {
        showToast('⚠️ Архівовані з маршруту не можна відновити');
        return;
    }
    showConfirm('Відновити ' + ids.length + ' записів з архіву?' + (skipped ? ' (' + skipped + ' з маршруту пропущено)' : ''), async function(yes) {
        if (!yes) return;
        showLoader('Відновлення ' + ids.length + ' записів...');
        const res = await apiPost('restorePassenger', { pax_ids: ids });
        hideLoader();
        if (res.ok) {
            archivedPassengers = archivedPassengers.filter(x => !ids.includes(x['PAX_ID']));
            showToast('✅ Відновлено ' + (res.restored || ids.length) + ' записів');
            clearArchiveSelection();
            renderArchive(); updateAllCounts();
            silentSync(); // Перезавантажити пасажирів
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

// ── Масове повне видалення з архіву ──
function archiveBulkDelete() {
    const ids = Array.from(archiveSelectedIds);
    if (!ids.length) return;
    showConfirm('⚠️ УВАГА! Видалити ' + ids.length + ' записів НАЗАВЖДИ? Цю дію не можна скасувати!', async function(yes) {
        if (!yes) return;
        showLoader('Видалення ' + ids.length + ' записів...');
        const res = await apiPost('deleteFromArchive', { pax_ids: ids });
        hideLoader();
        if (res.ok) {
            archivedPassengers = archivedPassengers.filter(p => !ids.includes(p['PAX_ID']));
            showToast('✅ Видалено назавжди ' + (res.deleted || ids.length) + ' записів');
            clearArchiveSelection();
            renderArchive(); updateAllCounts();
        } else {
            showToast('❌ ' + (res.error || 'Помилка'));
        }
    });
}

// ================================================================
// ROUTE ARCHIVE & DELETE FUNCTIONS
// ================================================================

// Архівувати з маршруту (видалити з маршруту + архівувати в CRM)
async function archiveFromRoute(rteId, sheetName, leadName) {
    showConfirm('Архівувати «' + leadName + '» і видалити з маршруту?', async function(yes) {
        if (!yes) return;
        showLoader('Архівування...');
        try {
            // Знаходимо PAX_ID з даних маршруту для архівації в CRM
            var sheet = routes[activeRouteIdx];
            var row = sheet ? (sheet.rows || []).find(function(r) { return r._resolvedId === rteId || r['RTE_ID'] === rteId; }) : null;
            var paxId = row ? (row['PAX_ID / PKG_ID'] || row['PAX_ID/PKG_ID'] || row['PAX_ID'] || row['PKG_ID'] || '') : '';
            // Fallback: find passenger by phone+name if legacy route row has empty pax_id
            if (!paxId && row) {
                var normPhone = function(s) { return String(s || '').replace(/\D/g, ''); };
                var phone = normPhone(row['Телефон пасажира'] || row['Телефон отримувача'] || row['Телефон відправника']);
                var name = String(row['Піб пасажира'] || row['Піб отримувача'] || row['Піб відправника'] || '').trim().toLowerCase();
                if (phone) {
                    var found = passengers.find(function(p) {
                        if (normPhone(p['Телефон пасажира']) !== phone) return false;
                        if (name && String(p['Піб'] || '').trim().toLowerCase() !== name) return false;
                        return true;
                    });
                    if (found && found['PAX_ID']) paxId = found['PAX_ID'];
                }
            }
            if (paxId) {
                await apiPost('archivePassenger', { pax_ids: [paxId], reason: 'Архівовано з маршруту', archived_by: getManagerName() || 'Менеджер' });
            } else {
                console.warn('[archive] no pax_id for route row', row);
            }
            // Видаляємо з маршруту з правильним id_col
            var idInfo = row ? getRouteRowIdInfo(row) : { id_col: 'RTE_ID', id_val: rteId };
            await apiPost('deleteFromSheet', { sheet: sheetName, id_col: idInfo.id_col, id_val: idInfo.id_val });
            // Оновлюємо локальні дані
            if (sheet) sheet.rows = (sheet.rows || []).filter(r => (r._resolvedId || r['RTE_ID']) !== rteId);
            if (paxId) passengers = passengers.filter(x => x['PAX_ID'] !== paxId);
            routeSelectedIds.delete(rteId);
            hideLoader();
            updateAllCounts();
            renderRoutes();
            showToast('✅ Архівовано і видалено з маршруту');
        } catch (e) {
            hideLoader();
            showToast('❌ Помилка: ' + e.message);
        }
    });
}

// Видалення з маршруту + архівування з CRM (soft delete)
async function deleteFromRouteFull(rteId, sheetName, leadName) {
    showConfirm('Видалити «' + leadName + '» з маршруту і з CRM?', async function(yes) {
        if (!yes) return;
        showLoader('Видалення...');
        try {
            const sheet = routes[activeRouteIdx];
            const row = sheet ? (sheet.rows || []).find(r => r._resolvedId === rteId || r['RTE_ID'] === rteId) : null;
            const idInfo = row ? getRouteRowIdInfo(row) : { id_col: 'RTE_ID', id_val: rteId };
            const paxId = row ? (row['PAX_ID / PKG_ID'] || row['PAX_ID/PKG_ID'] || row['PAX_ID'] || row['PKG_ID'] || rteId) : rteId;
            await apiPost('deleteFromSheet', { sheet: sheetName, id_col: idInfo.id_col, id_val: idInfo.id_val });
            await apiPost('deletePassenger', { pax_ids: [paxId], reason: 'Видалено з маршруту і CRM', archived_by: getManagerName() || 'Менеджер' });
            // Оновлюємо локальні дані
            if (sheet) sheet.rows = (sheet.rows || []).filter(r => (r._resolvedId || r['RTE_ID']) !== rteId);
            passengers = passengers.filter(x => x['PAX_ID'] !== paxId);
            routeSelectedIds.delete(rteId);
            hideLoader();
            updateAllCounts();
            renderRoutes();
            showToast('✅ Видалено з маршруту і CRM');
        } catch (e) {
            hideLoader();
            showToast('❌ Помилка: ' + e.message);
        }
    });
}

// Масове архівування з маршруту
function routeBulkArchive() {
    const ids = Array.from(routeSelectedIds);
    if (!ids.length) return;
    showConfirm('Архівувати ' + ids.length + ' записів і видалити з маршруту?', async function(yes) {
        if (!yes) return;
        if (activeRouteIdx === null) return;
        const sheet = routes[activeRouteIdx];
        if (!sheet) return;
        showLoader('Архівування...');
        try {
            // Збираємо реальні PAX_ID та інфо для видалення
            const paxIds = [];
            const deleteInfos = [];
            const normPhone = (s) => String(s || '').replace(/\D/g, '');
            for (const row of (sheet.rows || [])) {
                const resolvedId = row._resolvedId || row['RTE_ID'];
                if (!routeSelectedIds.has(resolvedId)) continue;
                let paxId = row['PAX_ID / PKG_ID'] || row['PAX_ID/PKG_ID'] || row['PAX_ID'] || row['PKG_ID'] || '';
                // Fallback for legacy route rows with empty pax_id_or_pkg_id:
                // look up the passenger by phone (+ name) in the local list.
                if (!paxId) {
                    const phone = normPhone(row['Телефон пасажира'] || row['Телефон отримувача'] || row['Телефон відправника']);
                    const name = String(row['Піб пасажира'] || row['Піб отримувача'] || row['Піб відправника'] || '').trim().toLowerCase();
                    if (phone) {
                        const found = passengers.find(p => {
                            if (normPhone(p['Телефон пасажира']) !== phone) return false;
                            if (name && String(p['Піб'] || '').trim().toLowerCase() !== name) return false;
                            return true;
                        });
                        if (found && found['PAX_ID']) paxId = found['PAX_ID'];
                    }
                }
                if (paxId) paxIds.push(paxId);
                const idInfo = getRouteRowIdInfo(row);
                if (idInfo) deleteInfos.push({ ...idInfo, resolvedId });
            }
            if (paxIds.length === 0) {
                hideLoader();
                showToast('⚠️ Не вдалося знайти PAX_ID — архівація неможлива. Додайте пасажира в маршрут заново.');
                return;
            }
            // Архівуємо в CRM по реальних PAX_ID
            if (paxIds.length > 0) {
                await apiPost('archivePassenger', { pax_ids: paxIds, reason: 'Архівовано з маршруту', archived_by: getManagerName() || 'Менеджер' });
            }
            // Видаляємо з маршруту з правильним id_col
            for (const info of deleteInfos) {
                await apiPost('deleteFromSheet', { sheet: sheet.sheetName, id_col: info.id_col, id_val: info.id_val });
                sheet.rows = (sheet.rows || []).filter(r => (r._resolvedId || r['RTE_ID']) !== info.resolvedId);
            }
            passengers = passengers.filter(x => !paxIds.includes(x['PAX_ID']));
            hideLoader();
            showToast('✅ Архівовано ' + deleteInfos.length + ' записів');
            routeSelectedIds.clear();
            _routeToolbarForceOpen = false;
            updateRouteBulkToolbar();
            updateAllCounts();
            renderRoutes();
        } catch (e) {
            hideLoader();
            showToast('❌ Помилка: ' + e.message);
        }
    });
}

// Масове повне видалення з маршруту + CRM
function routeBulkDeleteFull() {
    const ids = Array.from(routeSelectedIds);
    if (!ids.length) return;
    showConfirm('Видалити ' + ids.length + ' записів з маршруту і з CRM?', async function(yes) {
        if (!yes) return;
        if (activeRouteIdx === null) return;
        const sheet = routes[activeRouteIdx];
        if (!sheet) return;
        showLoader('Видалення...');
        try {
            for (const rteId of ids) {
                await apiPost('deleteFromSheet', { sheet: sheet.sheetName, id_col: 'RTE_ID', id_val: rteId });
                sheet.rows = (sheet.rows || []).filter(r => (r._resolvedId || r['RTE_ID']) !== rteId);
            }
            await apiPost('deletePassenger', { pax_ids: ids, reason: 'Видалено з маршруту і CRM', archived_by: getManagerName() || 'Менеджер' });
            passengers = passengers.filter(x => !ids.includes(x['PAX_ID']));
            hideLoader();
            showToast('✅ Видалено ' + ids.length + ' записів (збережено в архіві)');
            routeSelectedIds.clear();
            _routeToolbarForceOpen = false;
            updateRouteBulkToolbar();
            updateAllCounts();
            renderRoutes();
            updateAllCounts();
        } catch (e) {
            hideLoader();
            showToast('❌ Помилка: ' + e.message);
        }
    });
}

// ================================================================
// ONBOARDING — навчання з підсвіткою кнопок
// ================================================================
const OB_KEY = 'oksi_onboard_done';
const OB_CAT_KEY = 'oksi_onboard_cats';
let _obStep = 0, _obCat = null, _obSteps = [];

const OB_CATS = [
    {
        id: 'start', icon: '🚀', name: 'Початок роботи', color: '#ede9fe',
        desc: 'Вхід, зміна імені, встановлення, меню',
        steps: [
            { t: '#userAvatar', title: '👤 Аватар менеджера', desc: 'Натисніть щоб обрати менеджера або переключитись між слотами' },
            { t: '.burger-btn', title: '☰ Бічне меню', desc: 'Фільтри пасажирів, рейси, маршрути та архів' },
            { t: '.search-box', title: '🔍 Пошук', desc: 'Швидкий пошук по ПІБ або телефону пасажира' },
            { t: '#presenceBar', title: '👥 Онлайн', desc: 'Аватари менеджерів що зараз працюють в системі' }
        ]
    },
    {
        id: 'nav', icon: '📱', name: 'Нижня навігація', color: '#dbeafe',
        desc: 'Основні кнопки внизу екрану',
        steps: [
            { t: '#navPax', title: '👥 Пасажири', desc: 'Показати список всіх пасажирів' },
            { t: '#navParcels', title: '📦 Посилки', desc: 'Модуль посилок (окреме підключення)' },
            { t: '.nav-item[onclick*="silentSync"]', title: '🔄 Синхронізація', desc: 'Вручну оновити дані з Google Sheets' },
            { t: '.nav-item[onclick*="openColumnConfigurator"]', title: '⚙️ Колонки', desc: 'Налаштувати які поля показувати на картках' },
            { t: '.nav-item[onclick*="openAddModal"]', title: '➕ Додати', desc: 'Створити нового пасажира (є SMS-парсер!)' }
        ]
    },
    {
        id: 'passengers', icon: '👥', name: 'Робота з пасажирами', color: '#d1fae5',
        desc: 'Картки, редагування, месенджери',
        steps: [
            { t: '.nav-item[onclick*="openAddModal"]', title: '➕ Додати пасажира', desc: 'Заповніть ПІБ і телефон. Є SMS-парсер — вставте текст і дані заповняться автоматично!' },
            { t: '.search-box', title: '🔍 Пошук', desc: 'Введіть ПІБ або телефон — список фільтрується на льоту' },
            { t: '.lead-card', title: '📋 Натисніть на картку', desc: 'Картка розгорнеться і покаже деталі: ПІБ, адреси, дати, примітки. Кожне поле можна редагувати на місці!', act: 'expand' },
            { t: '.card-actions-toggle', title: '▼ Стрілка справа', desc: 'Натисніть ▼ — з\'являться кнопки: 📞 Дзвінок, ✉️ Писати, ✏️ Редагувати, 🚐 Рейс, 📦 Архів, 🗑️ Видалити', act: 'actions' },
            { t: '.card-checkbox', title: '☑️ Галочка зліва', desc: 'Поставте галочку на картці — внизу з\'явиться панель масових дій', act: 'check' },
            { t: '#bulkToolbar', title: '⚡ Панель масових дій', desc: '🚐 Рейс, 🗺️ Маршрут, ⚡ Оптимізація, 📦 Архів — все для обраних пасажирів', act: 'showBulk' }
        ]
    },
    {
        id: 'trips', icon: '🚐', name: 'Рейси', color: '#fef3c7',
        desc: 'Створення, календар, призначення, місця',
        steps: [
            { t: '.burger-btn', title: '🚐 Відкрити рейси', desc: 'Меню ☰ → "Рейси" → "Управління рейсами" — список всіх рейсів' },
            { t: null, title: '➕ Створити рейс', desc: 'У розділі рейсів "Новий рейс": напрямок, дати в календарі, авто, розкладка місць' },
            { t: null, title: '🪑 Розкладка місць', desc: 'Оберіть тип авто та кількість місць. Можна додати кілька авто до одного рейсу' },
            { t: null, title: '📌 Призначити пасажира', desc: 'На картці пасажира "🚐 Рейс" → оберіть дату → авто → підтвердіть' },
            { t: null, title: '📅 Календар рейсів', desc: 'Кольорові точки показують дати рейсів. Натисніть на дату — побачите рейси' },
            { t: null, title: '📦 Архів / 🗑️ Видалити', desc: 'На картці рейсу кнопки архівування та видалення. Архівований рейс можна відновити' }
        ]
    },
    {
        id: 'bulk', icon: '☑️', name: 'Масові дії', color: '#fce7f3',
        desc: 'Галочки → рейс, маршрут, оптимізація',
        steps: [
            { t: null, title: '☑️ Вибір галочками', desc: 'Поставте ☑ на картках — внизу з\'явиться панель масових дій' },
            { t: '#bulkToolbar .assign', title: '🚐 Рейс (масово)', desc: 'Призначити обраних пасажирів на рейс одним натиском' },
            { t: '#bulkToolbar .route', title: '🗺️ Маршрут (масово)', desc: 'Додати обраних до маршруту для планування збору' },
            { t: '#bulkToolbar .optimize', title: '⚡ Оптимізація', desc: 'Оптимізувати порядок за адресами → отримати маршрут Google Maps' },
            { t: null, title: '📦 Архів (масово)', desc: 'Архівувати обраних пасажирів. З архіву можна відновити' }
        ]
    },
    {
        id: 'routes', icon: '🗺️', name: 'Маршрути', color: '#e0e7ff',
        desc: 'Аркуші маршрутів, перенос, видалення',
        steps: [
            { t: '.burger-btn', title: '🗺️ Маршрути', desc: 'Меню ☰ → "Маршрути". Кожен маршрут — окремий аркуш для групи пасажирів' },
            { t: null, title: '➕ Створити маршрут', desc: 'У меню "➕ Новий маршрут" → введіть назву (напр. "Київ-Варшава 25.03")' },
            { t: null, title: '↔️ Перенос', desc: 'У маршруті натисніть на пасажира → "Перенести" в інший маршрут' },
            { t: null, title: '🗑️ Видалення', desc: 'Видалення маршруту не видаляє пасажирів з основної бази' }
        ]
    },
    {
        id: 'archive', icon: '📦', name: 'Архів', color: '#fee2e2',
        desc: 'Архів, відновлення, видалення назавжди',
        steps: [
            { t: '.burger-btn', title: '📦 Архів', desc: 'Меню ☰ → "Пасажири" → "📦 Архів" — список архівованих лідів' },
            { t: null, title: '♻️ Відновити', desc: 'Натисніть "♻️ Відновити" — пасажир повернеться в основний список' },
            { t: null, title: '🗑️ Видалити назавжди', desc: 'УВАГА: незворотня дія! Дані видаляються з Google Sheets повністю' }
        ]
    }
];

// ── Каталог категорій ──
function obOpenCatalog() {
    const list = document.getElementById('obCatalogList');
    const done = obGetDoneCats();
    let h = '';
    OB_CATS.forEach(c => {
        const ok = done.includes(c.id);
        h += '<div class="ob-cat" onclick="obStartCat(\'' + c.id + '\')">';
        h += '<div class="ob-cat-icon" style="background:' + c.color + '">' + c.icon + '</div>';
        h += '<div class="ob-cat-info"><div class="ob-cat-name">' + c.name + '</div><div class="ob-cat-desc">' + c.desc + '</div></div>';
        h += '<div class="ob-cat-badge ' + (ok ? 'done' : 'new') + '">' + (ok ? '✓' : c.steps.length + ' кр.') + '</div>';
        h += '</div>';
    });
    list.innerHTML = h;
    document.getElementById('obCatalog').classList.add('show');
}
function obCloseCatalog() { document.getElementById('obCatalog').classList.remove('show'); }
function obGetDoneCats() { try { return JSON.parse(localStorage.getItem(OB_CAT_KEY) || '[]'); } catch(e) { return []; } }
function obMarkCatDone(id) { const d = obGetDoneCats(); if (!d.includes(id)) { d.push(id); localStorage.setItem(OB_CAT_KEY, JSON.stringify(d)); } }

// ── Запуск категорії ──
function obStartCat(catId) {
    obCloseCatalog();
    const cat = OB_CATS.find(c => c.id === catId);
    if (!cat) return;
    _obCat = cat; _obSteps = cat.steps; _obStep = 0;
    document.getElementById('obOverlay').classList.add('show');
    obRender();
}

// ── Backward compat ──
function startOnboarding() { obOpenCatalog(); }
function openOnboardCatalog() { obOpenCatalog(); }
function closeOnboardCatalog() { obCloseCatalog(); }

// ── Виконати дію для кроку ──
function obDoAction(act) {
    // Знаходимо першу картку пасажира
    const firstCard = document.querySelector('.lead-card');
    if (!firstCard) return;
    const paxId = firstCard.getAttribute('data-pax-id');
    if (!paxId) return;

    if (act === 'expand') {
        // Розгорнути деталі першої картки
        if (openDetailsId !== paxId) toggleDetails(paxId);
    } else if (act === 'actions') {
        // Показати панель дій першої картки
        if (openDetailsId) { openDetailsId = null; render(); }
        if (openActionsId !== paxId) { openActionsId = paxId; render(); }
    } else if (act === 'check') {
        // Поставити галочку на першій картці
        openActionsId = null; openDetailsId = null;
        if (!selectedIds.has(paxId)) { selectedIds.add(paxId); updateBulkToolbar(); render(); }
    } else if (act === 'showBulk') {
        // Показати bulk toolbar (якщо нема вибраних — вибрати першого)
        if (selectedIds.size === 0 && paxId) { selectedIds.add(paxId); updateBulkToolbar(); render(); }
    }
}

// ── Прибрати демо-зміни ──
function obCleanup() {
    if (openDetailsId) { openDetailsId = null; }
    if (openActionsId) { openActionsId = null; }
    if (selectedIds.size > 0) { selectedIds.clear(); updateBulkToolbar(); }
    render();
}

// ── Render step ──
function obRender() {
    const s = _obSteps[_obStep], total = _obSteps.length;
    const spotlight = document.getElementById('obSpotlight');
    const tip = document.getElementById('obTooltip');

    // Виконати дію (розгорнути картку, показати чекбокс тощо)
    if (s.act) obDoAction(s.act);

    document.getElementById('obTitle').textContent = s.title;
    document.getElementById('obDesc').textContent = s.desc;
    document.getElementById('obCounter').textContent = (_obStep + 1) + ' / ' + total;

    // Buttons
    let bh = '';
    if (_obStep > 0) bh += '<button class="ob-btn ob-btn-back" onclick="obBack()">←</button>';
    bh += '<button class="ob-btn ob-btn-next" onclick="obNext()">' + (_obStep === total - 1 ? 'Готово ✓' : 'Далі →') + '</button>';
    document.getElementById('obBtns').innerHTML = bh;

    // Невелика затримка щоб DOM оновився після action
    setTimeout(function() { obPosition(s); }, 50);
}

function obPosition(s) {
    const spotlight = document.getElementById('obSpotlight');
    const tip = document.getElementById('obTooltip');

    // Для act-кроків шукаємо реальний елемент після дії
    let el = null;
    if (s.act === 'expand') {
        el = document.querySelector('.card-details.show');
    } else if (s.act === 'actions') {
        el = document.querySelector('.card-actions.show');
    } else if (s.act === 'check') {
        el = document.querySelector('.card-checkbox:checked');
        if (el) el = el.closest('.card-checkbox-wrap') || el;
    } else if (s.act === 'showBulk') {
        el = document.querySelector('#bulkToolbar.show') || document.getElementById('bulkToolbar');
    } else if (s.t) {
        el = document.querySelector(s.t);
    }

    if (el) {
        const r = el.getBoundingClientRect();
        // Якщо елемент невидимий або за межами екрану — fallback на center
        if (r.width === 0 && r.height === 0) { obPositionCenter(spotlight, tip); return; }
        const pad = 6;
        spotlight.style.display = 'block';
        spotlight.style.left = (r.left - pad) + 'px';
        spotlight.style.top = (r.top - pad) + 'px';
        spotlight.style.width = (r.width + pad * 2) + 'px';
        spotlight.style.height = (r.height + pad * 2) + 'px';

        const spaceBelow = window.innerHeight - r.bottom;
        const tipH = 130;
        tip.classList.remove('arrow-top', 'arrow-bottom', 'arrow-none');

        if (spaceBelow > tipH + 20) {
            tip.style.top = (r.bottom + 12) + 'px';
            tip.style.bottom = 'auto';
            tip.classList.add('arrow-top');
        } else {
            tip.style.top = 'auto';
            tip.style.bottom = (window.innerHeight - r.top + 12) + 'px';
            tip.classList.add('arrow-bottom');
        }
        let left = Math.max(16, Math.min(r.left, window.innerWidth - 316));
        tip.style.left = left + 'px';
        tip.style.right = 'auto';
        tip.style.transform = 'none';
        const arrowPos = Math.max(16, Math.min(r.left + r.width / 2 - left, 280));
        tip.style.setProperty('--arrow-left', arrowPos + 'px');

        // Скрол до елемента якщо не видно
        if (r.top < 40 || r.bottom > window.innerHeight - 20) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(function() { obPosition(s); }, 400);
            return;
        }
    } else {
        obPositionCenter(spotlight, tip);
    }

    tip.style.animation = 'none'; tip.offsetHeight; tip.style.animation = '';
}

function obPositionCenter(spotlight, tip) {
    spotlight.style.display = 'none';
    tip.classList.remove('arrow-top', 'arrow-bottom');
    tip.classList.add('arrow-none');
    tip.style.top = '50%';
    tip.style.left = '50%';
    tip.style.right = 'auto';
    tip.style.bottom = 'auto';
    tip.style.transform = 'translate(-50%, -50%)';
}

function obNext() {
    if (_obStep < _obSteps.length - 1) { _obStep++; obRender(); }
    else { obFinish(true); }
}
function obBack() {
    if (_obStep > 0) { _obStep--; obRender(); }
}
function obSkip() { obFinish(false); }

function obFinish(completed) {
    document.getElementById('obOverlay').classList.remove('show');
    obCleanup(); // прибрати демо-розгортання карток, галочки тощо
    if (completed && _obCat) obMarkCatDone(_obCat.id);
    localStorage.setItem(OB_KEY, Date.now());
    apiPost('logOnboarding', {
        completed: !!completed,
        category: _obCat ? _obCat.id : '',
        categoryName: _obCat ? _obCat.name : '',
        stepsViewed: _obStep + 1,
        totalSteps: _obSteps.length
    });
}

// Навчання тільки по кнопці — без автозапуску
function checkOnboardingAutoStart() { }

// ================================================================
// Video modal
// ================================================================
function openVideoModal() {
    window.open('https://youtu.be/dXhlCFwPJiY', '_blank');
}
