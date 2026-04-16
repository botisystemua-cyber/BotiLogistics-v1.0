// ============================================================
// EscoExpress CRM — GAS Backend: ПОСИЛКИ (Posylki_crm_v3)
// Deploy: Web App → Execute as: Me → Access: Anyone
// 52 колонки | УК→ЄВ + ЄВ→УК | Перевірка | Маршрути | НП
// ============================================================

// ===== БАЗИ ДАНИХ (Google Sheets) =====
var DB = {
  POSYLKI:  '1_vfEhdLEM2SVTBiu_3eDilMs1HlKxvPrJBbiHYjgrJo',
  MARHRUT:  '10SZhKV08BJyvWoMwhT0iddtWzYrDYFjCM8xgqViuE3Y',
  KLIYENTU: '1KW2Vh_E7OxggNB_NOzWmVM8siHzHr_mG8C939YXDC38',
  FINANCE:  '1AhID7Ust45sA4PCAUjWJz515qnxzQGSj5wGQ7K8Jbu0',
  CONFIG:   '1hZ67tuQYukugO_TjNsOS3IjovBR5hWMg-JmGAq3udBE',
  ARCHIVE:  '19Ftljah5eX07RLHJaBrvYV7hStxspxcJVi6VATGZvF0'
};

// ===== НАЗВИ АРКУШІВ =====
var SHEETS = {
  UE: 'Реєстрація ТТН УК-єв',
  EU: 'Виклик Курєра ЄВ-ук',
  PHOTO: 'Фото посилок'
};

// ===== 52 КОЛОНКИ УК→ЄВ (A-AZ) =====
var PKG_UE_COLS = [
  'PKG_ID',                // A  — унікальний ID
  'Ід_смарт',             // B  — Smartsender ID
  'Напрям',                // C  — УК→ЄВ
  'SOURCE_SHEET',          // D  — джерело заявки
  'Дата створення',        // E  — дата подачі
  'Піб відправника',       // F  — хто відправляє
  'Телефон реєстратора',   // G  — телефон відправника
  'Адреса відправки',      // H  — адреса в УК
  'Піб отримувача',        // I  — хто отримує в ЄВ
  'Телефон отримувача',    // J  — телефон отримувача
  'Адреса в Європі',       // K  — адреса доставки в ЄВ
  'Внутрішній №',          // L  — авто-номер (маршрут+дата+послідовність)
  'Номер ТТН',             // M  — штрих-код НП
  'Опис',                  // N  — категорія товарів
  'Деталі',                // O  — деталізація вмісту
  'Кількість позицій',     // P  — штук
  'Кг',                    // Q  — вага
  'Оціночна вартість',     // R  — вартість від клієнта
  'Сума НП',               // S  — вартість доставки НП
  'Валюта НП',             // T  — UAH
  'Форма НП',              // U  — готівка/карта
  'Статус НП',             // V  — статус платежу НП
  'Сума',                  // W  — сума від клієнта
  'Валюта оплати',         // X  — CHF/EUR/UAH
  'Завдаток',              // Y  — завдаток
  'Валюта завдатку',       // Z  — валюта завдатку
  'Форма оплати',          // AA — готівка/карта/переказ
  'Статус оплати',         // AB — Повністю/Частково/Очікування
  'Борг',                  // AC — авто: Сума - Завдаток
  'Примітка оплати',       // AD — коментар про оплату
  'Дата відправки',        // AE — коли вирушає в маршрут
  'Таймінг',               // AF — ранок/день/вечір
  'Номер авто',            // AG — номер машини
  'RTE_ID',                // AH — ID маршруту
  'Дата отримання',        // AI — коли адресат отримав
  'Статус посилки',        // AJ — В дорозі/Доставлено/Втрачено/Затримано
  'Статус ліда',           // AK — Новий/Активний/Зарахований
  'Статус CRM',            // AL — Активний/На паузі/Завершено
  'Контроль перевірки',    // AM — хто перевіряв (dropdown)
  'Дата перевірки',        // AN — коли перевіряв (авто)
  'Фото посилки',          // AO — URL фото
  'Рейтинг',              // AP — 1-5
  'Коментар рейтингу',     // AQ — коментар якості
  'Тег',                   // AR — VIP/срочна/проблемна
  'Примітка',              // AS — загальні коментарі
  'Примітка СМС',          // AT — для СМС-повідомлення
  'CLI_ID',                // AU — ID клієнта
  'ORDER_ID',              // AV — ID замовлення
  'DATE_ARCHIVE',          // AW — дата архівування
  'ARCHIVED_BY',           // AX — хто архівував
  'ARCHIVE_REASON',        // AY — причина
  'ARCHIVE_ID'             // AZ — ID архіву
];

// ===== 51 КОЛОНКА ЄВ→УК =====
var PKG_EU_COLS = [
  'PKG_ID', 'Ід_смарт', 'Напрям', 'SOURCE_SHEET', 'Дата створення',
  'Піб відправника', 'Телефон реєстратора', 'Адреса відправки',
  'Піб отримувача', 'Телефон отримувача', 'Місто Нова Пошта',
  'Внутрішній №', 'НП активна',
  'Опис', 'Деталі', 'Кількість позицій', 'Кг', 'Оціночна вартість',
  'Сума НП', 'Валюта НП', 'Форма НП', 'Статус НП',
  'Сума', 'Валюта оплати', 'Завдаток', 'Валюта завдатку', 'Форма оплати',
  'Статус оплати', 'Борг', 'Примітка оплати',
  'Дата відправки', 'Таймінг', 'Номер авто', 'RTE_ID',
  'Дата отримання', 'Статус посилки', 'Статус ліда', 'Статус CRM',
  'Контроль перевірки', 'Дата перевірки', 'Фото посилки',
  'Рейтинг', 'Коментар рейтингу', 'Тег', 'Примітка', 'Примітка СМС',
  'CLI_ID', 'ORDER_ID', 'DATE_ARCHIVE', 'ARCHIVED_BY', 'ARCHIVE_REASON'
];

// ===== ФОТО (12 колонок) =====
var PHOTO_COLS = [
  'PHOTO_ID', 'PKG_ID', 'Номер ТТН', 'Штрих-код ТТН',
  'Тип фото', 'Фото посилки', 'Хто завантажив', 'Роль',
  'Коментар', 'Статус перевірки', 'Ід реєстратора', 'Час'
];

// ===== ФІНАНСИ =====
var FINANCE_COLS = [
  'PAY_ID', 'Дата створення', 'Хто вніс', 'Роль',
  'CLI_ID', 'PAX_ID', 'PKG_ID', 'RTE_ID', 'CAL_ID',
  'Ід_смарт', 'Тип платежу', 'Сума', 'Валюта',
  'Форма оплати', 'Статус платежу', 'Борг сума', 'Борг валюта',
  'Дата погашення', 'Примітка', 'DATE_ARCHIVE', 'ARCHIVED_BY'
];

// ============================================================
// doPost — UNIVERSAL ROUTER
// ============================================================
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var result;

    switch (action) {
      // ── READ ──
      case 'getAll':                    result = apiGetAll(body); break;
      case 'getOne':                    result = apiGetOne(body); break;
      case 'getStats':                  result = apiGetStats(body); break;
      case 'getPayments':              result = apiGetPayments(body); break;
      case 'getPhotos':                result = apiGetPhotos(body); break;
      case 'getOrderInfo':             result = apiGetOrderInfo(body); break;
      case 'getVerificationStats':     result = apiGetVerificationStats(body); break;

      // ── CREATE ──
      case 'addParcel':                result = apiAddParcel(body); break;
      case 'addPhoto':                 result = apiAddPhoto(body); break;

      // ── UPDATE ──
      case 'updateField':             result = apiUpdateField(body); break;
      case 'checkDuplicates':         result = apiCheckDuplicates(body); break;

      // ── DELETE / ARCHIVE ──
      case 'deleteParcel':            result = apiDeleteParcel(body); break;
      case 'getArchive':              result = apiGetArchive(body); break;
      case 'restoreFromArchive':      result = apiRestoreFromArchive(body); break;
      case 'permanentDelete':         result = apiPermanentDelete(body); break;

      // ── VERIFICATION ──
      case 'scanTTN':                 result = apiScanTTN(body); break;
      case 'findDuplicatesByRecipient': result = apiFindDuplicatesByRecipient(body); break;
      case 'assignRouteNumber':       result = apiAssignRouteNumber(body); break;
      case 'completeVerification':    result = apiCompleteVerification(body); break;
      case 'rejectVerification':      result = apiRejectVerification(body); break;

      // ── ROUTES ──
      case 'getRoutesList':           result = apiGetRoutesList(body); break;
      case 'getRouteSheet':           result = apiGetRouteSheet(body); break;
      case 'getRouteByRteId':         result = apiGetRouteByRteId(body); break;
      case 'addToRoute':              result = apiAddToRoute(body); break;
      case 'removeFromRoute':         result = apiRemoveFromRoute(body); break;
      case 'createRoute':             result = apiCreateRoute(body); break;
      case 'deleteRoute':             result = apiDeleteRoute(body); break;
      case 'updateRouteField':        result = apiUpdateRouteField(body); break;

      // ── DISPATCH ──
      case 'getDispatches':           result = apiGetDispatches(body); break;
      case 'updateDispatch':          result = apiUpdateDispatch(body); break;
      case 'getDispatchByRoute':      result = apiGetDispatchByRoute(body); break;

      // ── EXPENSES & SUMMARY ──
      case 'getExpenses':             result = apiGetExpenses(body); break;
      case 'getSummary':              result = apiGetSummary(body); break;

      // ── NOVA POSHTA ──
      case 'trackParcel':             result = apiTrackParcel(body); break;
      case 'checkNpApiKey':           result = apiCheckNpApiKey(body); break;

      // ── CLIENT CHAT ──
      case 'getClientMessages':       result = apiGetClientMessages(body); break;
      case 'sendManagerMessage':      result = apiSendManagerMessage(body); break;
      case 'markClientRead':          result = apiMarkClientRead(body); break;
      case 'getUnreadCounts':         result = apiGetUnreadCounts(body); break;

      default:
        result = { ok: false, error: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: err.message,
      stack: err.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function genId(prefix) {
  var d = new Date();
  var dateStr = Utilities.formatDate(d, 'Europe/Kiev', 'yyyyMMdd');
  var rnd = Math.random().toString(36).substr(2, 4).toUpperCase();
  return prefix + '-' + dateStr + '-' + rnd;
}

function today() {
  return Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd');
}

function now() {
  return Utilities.formatDate(new Date(), 'Europe/Kiev', 'dd.MM.yyyy HH:mm:ss');
}

function normalizeHeaders(rawHeaders) {
  return rawHeaders.map(function(h) {
    return String(h).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  });
}

function getSheetFromDb(dbKey, sheetName) {
  var ss = SpreadsheetApp.openById(DB[dbKey]);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Аркуш "' + sheetName + '" не знайдено в ' + dbKey);
  return sheet;
}

function getUeSheet() { return getSheetFromDb('POSYLKI', SHEETS.UE); }
function getEuSheet() { return getSheetFromDb('POSYLKI', SHEETS.EU); }
function getPhotoSheet() { return getSheetFromDb('POSYLKI', SHEETS.PHOTO); }

function getAllData(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { headers: [], data: [] };

  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headers = normalizeHeaders(rawHeaders);
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return { headers: headers, data: data };
}

function rowToObj(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var val = row[i];
    if (val instanceof Date) {
      val = Utilities.formatDate(val, 'Europe/Kiev', 'dd.MM.yyyy');
    }
    obj[headers[i]] = (val !== undefined && val !== null) ? String(val) : '';
  }
  return obj;
}

function objToRow(headers, obj) {
  return headers.map(function(h) {
    return (obj[h] !== undefined && obj[h] !== null) ? obj[h] : '';
  });
}

function findRow(sheet, colName, value) {
  var all = getAllData(sheet);
  var colIdx = all.headers.indexOf(colName);
  if (colIdx === -1) return null;

  for (var i = 0; i < all.data.length; i++) {
    if (String(all.data[i][colIdx]) === String(value)) {
      return { rowNum: i + 2, headers: all.headers, data: all.data[i] };
    }
  }
  return null;
}

function findAllRows(sheet, colName, value) {
  var all = getAllData(sheet);
  var colIdx = all.headers.indexOf(colName);
  if (colIdx === -1) return [];

  var results = [];
  for (var i = 0; i < all.data.length; i++) {
    if (String(all.data[i][colIdx]) === String(value)) {
      results.push({ rowNum: i + 2, headers: all.headers, data: all.data[i] });
    }
  }
  return results;
}

function calcDebt(obj) {
  var suma = parseFloat(obj['Сума']) || 0;
  var zavd = parseFloat(obj['Завдаток']) || 0;
  return Math.max(0, suma - zavd);
}

/**
 * Побудова об'єкта посилки з даних аркуша
 */
function pkgObjFromData(headers, data, sheetName, rowNum) {
  var obj = rowToObj(headers, data);
  obj._sheet = sheetName;
  obj._rowNum = rowNum;
  obj['Борг'] = String(calcDebt(obj));
  return obj;
}

/**
 * Пошук посилки в обох аркушах за PKG_ID
 */
function findPkgInBoth(pkgId) {
  // Спочатку УК→ЄВ
  var sheetUe = getUeSheet();
  var found = findRow(sheetUe, 'PKG_ID', pkgId);
  if (found) {
    return { sheet: sheetUe, sheetName: SHEETS.UE, rowNum: found.rowNum, headers: found.headers, data: found.data };
  }
  // Потім ЄВ→УК
  var sheetEu = getEuSheet();
  found = findRow(sheetEu, 'PKG_ID', pkgId);
  if (found) {
    return { sheet: sheetEu, sheetName: SHEETS.EU, rowNum: found.rowNum, headers: found.headers, data: found.data };
  }
  return null;
}

/**
 * Завантажити всі посилки з одного аркуша
 */
function loadSheetParcels(sheet, sheetName) {
  var all = getAllData(sheet);
  var results = [];
  for (var i = 0; i < all.data.length; i++) {
    var obj = pkgObjFromData(all.headers, all.data[i], sheetName, i + 2);
    if (!obj['PKG_ID'] && !obj['Піб відправника']) continue;
    results.push(obj);
  }
  return results;
}

// ============================================================
// READ ENDPOINTS
// ============================================================

/**
 * apiGetAll — отримати всі посилки
 * params: { sheet: 'all'|'ue'|'eu', filter: { statusPkg, statusLid, statusOplata, statusCrm, tag, search } }
 */
function apiGetAll(params) {
  var sheetFilter = params.sheet || 'all';
  var filter = params.filter || {};
  var parcels = [];

  if (sheetFilter === 'all' || sheetFilter === 'ue') {
    parcels = parcels.concat(loadSheetParcels(getUeSheet(), SHEETS.UE));
  }
  if (sheetFilter === 'all' || sheetFilter === 'eu') {
    parcels = parcels.concat(loadSheetParcels(getEuSheet(), SHEETS.EU));
  }

  var results = [];
  var search = (filter.search || '').toLowerCase().trim();

  for (var i = 0; i < parcels.length; i++) {
    var p = parcels[i];

    // Пропустити архів
    if (p['Статус CRM'] === 'Архів') continue;

    // Фільтр за статусом CRM
    if (filter.statusCrm && filter.statusCrm !== 'all' && p['Статус CRM'] !== filter.statusCrm) continue;

    // Фільтр за статусом посилки
    if (filter.statusPkg && filter.statusPkg !== 'all' && p['Статус посилки'] !== filter.statusPkg) continue;

    // Фільтр за статусом ліда
    if (filter.statusLid && filter.statusLid !== 'all' && p['Статус ліда'] !== filter.statusLid) continue;

    // Фільтр за статусом оплати
    if (filter.statusOplata && filter.statusOplata !== 'all' && p['Статус оплати'] !== filter.statusOplata) continue;

    // Фільтр за тегом
    if (filter.tag && filter.tag !== 'all' && p['Тег'] !== filter.tag) continue;

    // Пошук
    if (search) {
      var searchIn = [
        p['Піб відправника'], p['Піб отримувача'],
        p['Телефон реєстратора'], p['Телефон отримувача'],
        p['PKG_ID'], p['Номер ТТН'], p['Внутрішній №']
      ].join(' ').toLowerCase();
      if (searchIn.indexOf(search) === -1) continue;
    }

    results.push(p);
  }

  return { ok: true, data: results, count: results.length };
}

/**
 * apiGetOne — отримати одну посилку за PKG_ID
 * params: { pkg_id }
 */
function apiGetOne(params) {
  var found = findPkgInBoth(params.pkg_id);
  if (!found) {
    return { ok: false, error: 'Посилку не знайдено: ' + params.pkg_id };
  }
  var obj = pkgObjFromData(found.headers, found.data, found.sheetName, found.rowNum);
  return { ok: true, data: obj };
}

/**
 * apiGetStats — статистика по посилках
 */
function apiGetStats(params) {
  var allUe = loadSheetParcels(getUeSheet(), SHEETS.UE);
  var allEu = loadSheetParcels(getEuSheet(), SHEETS.EU);
  var all = allUe.concat(allEu);

  var stats = {
    total: 0, ue: 0, eu: 0,
    byStatus: { 'Новий': 0, 'Активний': 0, 'Зарахований': 0, 'Невідомий': 0, 'Відмова': 0 },
    byPay: { 'Повністю': 0, 'Частково': 0, 'Очікування': 0, 'Не оплачено': 0 },
    byPkgStatus: { 'В дорозі': 0, 'Доставлено': 0, 'Втрачено': 0, 'Затримано': 0 },
    totalDebt: 0
  };

  for (var i = 0; i < all.length; i++) {
    var p = all[i];
    if (p['Статус CRM'] === 'Архів') continue;

    stats.total++;
    if (p['Напрям'] === 'УК→ЄВ') stats.ue++;
    else if (p['Напрям'] === 'ЄВ→УК') stats.eu++;

    var ls = p['Статус ліда'];
    if (stats.byStatus[ls] !== undefined) stats.byStatus[ls]++;

    var ps = p['Статус оплати'];
    if (stats.byPay[ps] !== undefined) stats.byPay[ps]++;

    var pkgSt = p['Статус посилки'];
    if (stats.byPkgStatus[pkgSt] !== undefined) stats.byPkgStatus[pkgSt]++;

    stats.totalDebt += calcDebt(p);
  }

  return { ok: true, stats: stats };
}

/**
 * apiGetPayments — платежі по посилці
 * params: { pkg_id }
 */
function apiGetPayments(params) {
  var sheet = getSheetFromDb('FINANCE', 'Платежі');
  var rows = findAllRows(sheet, 'PKG_ID', params.pkg_id);
  var payments = rows.map(function(r) { return rowToObj(r.headers, r.data); });

  // Сортуємо за датою (новіші спочатку)
  payments.sort(function(a, b) {
    return (b['Дата створення'] || '').localeCompare(a['Дата створення'] || '');
  });

  var totalPaid = 0;
  for (var i = 0; i < payments.length; i++) {
    if (payments[i]['Статус платежу'] === 'Оплачено') {
      totalPaid += parseFloat(payments[i]['Сума']) || 0;
    }
  }

  return { ok: true, data: payments, summary: { totalPaid: totalPaid, count: payments.length } };
}

/**
 * apiGetPhotos — фото посилки
 * params: { pkg_id }
 */
function apiGetPhotos(params) {
  var sheet = getPhotoSheet();
  var rows = findAllRows(sheet, 'PKG_ID', params.pkg_id);
  var photos = rows.map(function(r) { return rowToObj(r.headers, r.data); });
  return { ok: true, data: photos, count: photos.length };
}

/**
 * apiGetOrderInfo — інформація про замовлення
 * params: { pkg_id }
 */
function apiGetOrderInfo(params) {
  var found = findPkgInBoth(params.pkg_id);
  if (!found) return { ok: false, error: 'Посилку не знайдено' };

  var obj = rowToObj(found.headers, found.data);
  return {
    ok: true,
    data: {
      pkg_id: obj['PKG_ID'],
      order_id: obj['ORDER_ID'],
      cli_id: obj['CLI_ID'],
      sender: obj['Піб відправника'],
      receiver: obj['Піб отримувача'],
      status: obj['Статус посилки'],
      payment: obj['Статус оплати'],
      debt: String(calcDebt(obj))
    }
  };
}

/**
 * apiGetVerificationStats — статистика перевірки
 */
function apiGetVerificationStats(params) {
  var allUe = loadSheetParcels(getUeSheet(), SHEETS.UE);
  var allEu = loadSheetParcels(getEuSheet(), SHEETS.EU);
  var all = allUe.concat(allEu);

  var counts = { all: 0, checking: 0, ready: 0, unknown: 0, noPhoto: 0, incomplete: 0 };

  for (var i = 0; i < all.length; i++) {
    var p = all[i];
    if (p['Статус CRM'] === 'Архів') continue;

    var ctrl = p['Контроль перевірки'];
    if (ctrl === 'В перевірці' || ctrl === 'Готова до маршруту' || p['Статус ліда'] === 'Невідомий') {
      counts.all++;
    }
    if (ctrl === 'В перевірці') counts.checking++;
    if (ctrl === 'Готова до маршруту') counts.ready++;
    if (p['Статус ліда'] === 'Невідомий') counts.unknown++;
    if (!p['Фото посилки']) counts.noPhoto++;

    // Перевірка повноти даних
    if (!p['Кг'] || !p['Кількість позицій'] || !p['Опис'] || !p['Сума']) {
      counts.incomplete++;
    }
  }

  return { ok: true, counts: counts };
}

// ============================================================
// CREATE ENDPOINTS
// ============================================================

/**
 * apiAddParcel — створити нову посилку
 * params: { sheet: 'ue'|'eu', data: { sender, phone, addressFrom, receiver, ... } }
 */
function apiAddParcel(params) {
  var isUE = (params.sheet || 'ue') === 'ue';
  var cols = isUE ? PKG_UE_COLS : PKG_EU_COLS;
  var sheet = isUE ? getUeSheet() : getEuSheet();
  var d = params.data || {};

  var pkgId = genId('PKG');

  var obj = {};
  cols.forEach(function(col) { obj[col] = ''; });

  // Системні поля
  obj['PKG_ID'] = pkgId;
  obj['Напрям'] = isUE ? 'УК→ЄВ' : 'ЄВ→УК';
  obj['SOURCE_SHEET'] = isUE ? SHEETS.UE : SHEETS.EU;
  obj['Дата створення'] = now();
  obj['Статус ліда'] = 'Новий';
  obj['Статус CRM'] = 'Активний';
  obj['Статус посилки'] = '';
  obj['Статус оплати'] = d['Статус оплати'] || 'Очікування';

  // Відправник УК
  obj['Піб відправника'] = d['Піб відправника'] || d.sender || '';
  obj['Телефон реєстратора'] = d['Телефон реєстратора'] || d.phone || '';
  obj['Адреса відправки'] = d['Адреса відправки'] || d.addressFrom || '';

  // Отримувач ЄВ
  obj['Піб отримувача'] = d['Піб отримувача'] || d.receiver || '';
  obj['Телефон отримувача'] = d['Телефон отримувача'] || d.phoneRecv || '';

  // Адреса доставки (різна для UE/EU)
  if (isUE) {
    obj['Адреса в Європі'] = d['Адреса в Європі'] || d.addressTo || '';
    obj['Номер ТТН'] = d['Номер ТТН'] || d.ttn || '';
  } else {
    obj['Місто Нова Пошта'] = d['Місто Нова Пошта'] || d.addressTo || '';
  }

  // Дані посилки
  obj['Опис'] = d['Опис'] || d.description || '';
  obj['Деталі'] = d['Деталі'] || d.details || '';
  obj['Кількість позицій'] = d['Кількість позицій'] || d.qty || '';
  obj['Кг'] = d['Кг'] || d.weight || '';
  obj['Оціночна вартість'] = d['Оціночна вартість'] || d.estimatedPrice || '';

  // Оплата
  obj['Сума'] = d['Сума'] || d.suma || '';
  obj['Валюта оплати'] = d['Валюта оплати'] || d.currency || 'CHF';
  obj['Завдаток'] = d['Завдаток'] || d.deposit || '0';
  obj['Валюта завдатку'] = d['Валюта завдатку'] || d.depositCurrency || '';
  obj['Форма оплати'] = d['Форма оплати'] || d.payForm || '';

  // Борг (авто)
  obj['Борг'] = String(calcDebt(obj));

  // Додаткові
  obj['Ід_смарт'] = d['Ід_смарт'] || d.smartId || '';
  obj['Примітка'] = d['Примітка'] || d.note || '';
  obj['Тег'] = d['Тег'] || d.tag || '';
  obj['CLI_ID'] = d['CLI_ID'] || '';

  // Отримати заголовки з таблиці
  var all = getAllData(sheet);
  var headers = all.headers.length > 0 ? all.headers : cols;
  var row = objToRow(headers, obj);
  sheet.appendRow(row);

  return { ok: true, pkg_id: pkgId, data: obj };
}

/**
 * apiAddPhoto — додати фото посилки
 * params: { pkg_id, url, type, who, role, comment }
 */
function apiAddPhoto(params) {
  var sheet = getPhotoSheet();
  var photoId = genId('PHOTO');

  // Знайти посилку для ТТН
  var found = findPkgInBoth(params.pkg_id);
  var ttn = '';
  if (found) {
    var obj = rowToObj(found.headers, found.data);
    ttn = obj['Номер ТТН'] || '';
  }

  var photoObj = {};
  PHOTO_COLS.forEach(function(c) { photoObj[c] = ''; });

  photoObj['PHOTO_ID'] = photoId;
  photoObj['PKG_ID'] = params.pkg_id;
  photoObj['Номер ТТН'] = ttn;
  photoObj['Тип фото'] = params.type || 'Посилка';
  photoObj['Фото посилки'] = params.url || '';
  photoObj['Хто завантажив'] = params.who || '';
  photoObj['Роль'] = params.role || 'Перевіряючий';
  photoObj['Коментар'] = params.comment || '';
  photoObj['Статус перевірки'] = 'Новий';
  photoObj['Час'] = now();

  var all = getAllData(sheet);
  var headers = all.headers.length > 0 ? all.headers : PHOTO_COLS;
  sheet.appendRow(objToRow(headers, photoObj));

  // Оновити поле Фото посилки в основній таблиці
  if (found && params.url) {
    var photoIdx = found.headers.indexOf('Фото посилки');
    if (photoIdx !== -1) {
      found.sheet.getRange(found.rowNum, photoIdx + 1).setValue(params.url);
    }
  }

  return { ok: true, photo_id: photoId };
}

// ============================================================
// UPDATE ENDPOINTS
// ============================================================

/**
 * apiUpdateField — оновити одне поле посилки
 * params: { pkg_id, col, value }
 */
function apiUpdateField(params) {
  var found = findPkgInBoth(params.pkg_id);
  if (!found) {
    return { ok: false, error: 'Посилку не знайдено: ' + params.pkg_id };
  }

  var colIdx = found.headers.indexOf(params.col);
  if (colIdx === -1) {
    return { ok: false, error: 'Колонку не знайдено: ' + params.col };
  }

  found.sheet.getRange(found.rowNum, colIdx + 1).setValue(params.value);

  // Авто-перерахунок боргу при зміні Суми або Завдатку
  if (params.col === 'Сума' || params.col === 'Завдаток') {
    var obj = rowToObj(found.headers, found.data);
    obj[params.col] = params.value;
    var newDebt = calcDebt(obj);
    var debtIdx = found.headers.indexOf('Борг');
    if (debtIdx !== -1) {
      found.sheet.getRange(found.rowNum, debtIdx + 1).setValue(String(newDebt));
    }
  }

  return { ok: true, pkg_id: params.pkg_id, col: params.col, value: params.value };
}

/**
 * apiCheckDuplicates — перевірка дублікатів
 * params: { pib, phone }
 */
function apiCheckDuplicates(params) {
  var pib = (params.pib || '').toLowerCase().trim();
  var phone = (params.phone || '').replace(/\s+/g, '').trim();
  if (!pib && !phone) return { ok: true, duplicates: [], count: 0 };

  var allParcels = loadSheetParcels(getUeSheet(), SHEETS.UE)
    .concat(loadSheetParcels(getEuSheet(), SHEETS.EU));

  var duplicates = [];
  for (var i = 0; i < allParcels.length; i++) {
    var p = allParcels[i];
    if (p['Статус CRM'] === 'Архів') continue;

    var nameLower = (p['Піб відправника'] || '').toLowerCase();
    var phoneClean = (p['Телефон реєстратора'] || '').replace(/\s+/g, '');

    if ((pib && nameLower.indexOf(pib) !== -1) || (phone && phoneClean.indexOf(phone) !== -1)) {
      duplicates.push(p);
    }
  }

  return { ok: true, duplicates: duplicates, count: duplicates.length };
}

// ============================================================
// DELETE ENDPOINT
// ============================================================

/**
 * apiDeleteParcel — архівація посилки
 * 1. Копіює ВЕСЬ рядок 1:1 в DB.ARCHIVE "Посилки" + метадані
 * 2. ВИДАЛЯЄ рядок з основної таблиці
 * params: { pkg_id, reason, archived_by }
 */
function apiDeleteParcel(params) {
  var found = findPkgInBoth(params.pkg_id);
  if (!found) {
    return { ok: false, error: 'Посилку не знайдено: ' + params.pkg_id };
  }

  var archiveId = genId('ARC');
  var dateArchive = now();
  var archivedBy = params.archived_by || 'CRM';
  var reason = params.reason || '';

  // 1. Зібрати повний об'єкт посилки
  var pkgObj = {};
  for (var i = 0; i < found.headers.length; i++) {
    pkgObj[found.headers[i]] = found.data[i] !== undefined ? found.data[i] : '';
  }

  // Додати архівні метадані
  pkgObj['ARCHIVE_ID'] = archiveId;
  pkgObj['DATE_ARCHIVE'] = dateArchive;
  pkgObj['ARCHIVED_BY'] = archivedBy;
  pkgObj['ARCHIVE_REASON'] = reason;
  pkgObj['Статус CRM'] = 'Архів';

  // 2. Записати в DB.ARCHIVE → "Посилки"
  // Структура архіву: ті самі колонки що й джерело
  try {
    var archiveSheet = getSheetFromDb('ARCHIVE', 'Посилки');
    var archHeaders = normalizeHeaders(archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0]);

    var archRow = archHeaders.map(function(h) {
      return pkgObj[h] !== undefined ? pkgObj[h] : '';
    });

    archiveSheet.appendRow(archRow);
  } catch(e) {
    Logger.log('Archive write error: ' + e.message);
    return { ok: false, error: 'Помилка запису в архів: ' + e.message };
  }

  // 3. Видалити рядок з основної таблиці
  found.sheet.deleteRow(found.rowNum);

  return { ok: true, pkg_id: params.pkg_id, archive_id: archiveId };
}

// ============================================================
// ARCHIVE ENDPOINTS
// ============================================================

/**
 * apiGetArchive — отримати архівні посилки з DB.ARCHIVE "Посилки"
 * Повертає ПОВНІ дані (такі ж як getAll) + архівні метадані
 * params: { direction: 'all'|'ue'|'eu' }
 */
function apiGetArchive(params) {
  var direction = params.direction || 'all';
  var result = [];

  try {
    var archiveSheet = getSheetFromDb('ARCHIVE', 'Посилки');
    var data = archiveSheet.getDataRange().getValues();
    if (data.length < 2) return { ok: true, data: [] };

    var headers = normalizeHeaders(data[0]);

    for (var i = 1; i < data.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var val = data[i][j];
        if (val instanceof Date) {
          obj[headers[j]] = Utilities.formatDate(val, 'Europe/Kiev', 'dd.MM.yyyy HH:mm');
        } else {
          obj[headers[j]] = val !== undefined && val !== null ? String(val) : '';
        }
      }

      if (!obj['PKG_ID'] && !obj['Піб відправника']) continue;

      // Фільтр за напрямом
      if (direction === 'ue' && obj['Напрям'] !== 'УК→ЄВ') continue;
      if (direction === 'eu' && obj['Напрям'] !== 'ЄВ→УК') continue;

      obj['_sheet'] = obj['SOURCE_SHEET'] || '';
      obj['_isArchive'] = true;
      result.push(obj);
    }
  } catch(e) {
    return { ok: false, error: 'Помилка читання архіву: ' + e.message };
  }

  result.reverse();
  return { ok: true, data: result };
}

/**
 * apiRestoreFromArchive — відновити посилку з архіву
 * 1. Читає повний рядок з DB.ARCHIVE "Посилки"
 * 2. Додає рядок назад в основну таблицю (УК→ЄВ або ЄВ→УК)
 * 3. Видаляє з архіву
 * params: { pkg_id }
 */
function apiRestoreFromArchive(params) {
  var pkgId = params.pkg_id;

  try {
    var archiveSheet = getSheetFromDb('ARCHIVE', 'Посилки');
    var archData = archiveSheet.getDataRange().getValues();
    var archHeaders = normalizeHeaders(archData[0]);
    var pkgIdIdx = archHeaders.indexOf('PKG_ID');

    if (pkgIdIdx === -1) return { ok: false, error: 'PKG_ID колонка не знайдена в архіві' };

    // Знайти рядок в архіві (з кінця — найновіший)
    var archRowIdx = -1;
    var archRowData = null;
    for (var i = archData.length - 1; i >= 1; i--) {
      if (String(archData[i][pkgIdIdx]) === pkgId) {
        archRowIdx = i;
        archRowData = archData[i];
        break;
      }
    }

    if (archRowIdx === -1) return { ok: false, error: 'Посилку не знайдено в архіві: ' + pkgId };

    // Зібрати об'єкт з архівних даних
    var archObj = {};
    for (var j = 0; j < archHeaders.length; j++) {
      archObj[archHeaders[j]] = archRowData[j] !== undefined ? archRowData[j] : '';
    }

    // Визначити цільовий аркуш
    var direction = archObj['Напрям'] || '';
    var targetSheet, targetCols;
    if (direction === 'ЄВ→УК') {
      targetSheet = getEuSheet();
      targetCols = PKG_EU_COLS;
    } else {
      targetSheet = getUeSheet();
      targetCols = PKG_UE_COLS;
    }

    // Очистити архівні метадані
    archObj['Статус CRM'] = 'Активний';
    archObj['DATE_ARCHIVE'] = '';
    archObj['ARCHIVED_BY'] = '';
    archObj['ARCHIVE_REASON'] = '';
    archObj['ARCHIVE_ID'] = '';

    // Записати рядок в цільову таблицю
    var targetHeaders = normalizeHeaders(targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0]);
    var newRow = targetHeaders.map(function(h) {
      return archObj[h] !== undefined ? archObj[h] : '';
    });
    targetSheet.appendRow(newRow);

    // Видалити з архіву
    archiveSheet.deleteRow(archRowIdx + 1);

    return { ok: true, pkg_id: pkgId };

  } catch(e) {
    return { ok: false, error: 'Помилка відновлення: ' + e.message };
  }
}

/**
 * apiPermanentDelete — видалити назавжди з архіву
 * params: { pkg_id } або { pkg_ids: [...] } для масового видалення
 */
function apiPermanentDelete(params) {
  var pkgIds = params.pkg_ids || [params.pkg_id];
  var deleted = 0;

  try {
    var archiveSheet = getSheetFromDb('ARCHIVE', 'Посилки');
    var archData = archiveSheet.getDataRange().getValues();
    var archHeaders = normalizeHeaders(archData[0]);
    var pkgIdIdx = archHeaders.indexOf('PKG_ID');

    if (pkgIdIdx === -1) return { ok: false, error: 'PKG_ID колонка не знайдена' };

    // Видаляти з кінця щоб не зсувати індекси
    for (var i = archData.length - 1; i >= 1; i--) {
      var id = String(archData[i][pkgIdIdx]);
      if (pkgIds.indexOf(id) !== -1) {
        archiveSheet.deleteRow(i + 1);
        deleted++;
      }
    }
  } catch(e) {
    return { ok: false, error: 'Помилка видалення: ' + e.message };
  }

  return { ok: true, deleted: deleted };
}

// ============================================================
// VERIFICATION ENDPOINTS
// ============================================================

/**
 * apiScanTTN — сканування ТТН при прибутті посилки
 * params: { ttn }
 *
 * ТИП A: знайдено → оновити статус, показати дані + дублікати
 * ТИП B: не знайдено → створити "невідому" посилку
 */
function apiScanTTN(params) {
  var ttn = String(params.ttn || '').trim();
  if (!ttn) return { ok: false, error: 'ТТН не вказано' };

  // Шукаємо в УК→ЄВ (де є Номер ТТН)
  var sheetUe = getUeSheet();
  var found = findRow(sheetUe, 'Номер ТТН', ttn);

  if (found) {
    // ТИП A — знайдено
    var ctrlIdx = found.headers.indexOf('Контроль перевірки');
    var dateIdx = found.headers.indexOf('Дата перевірки');

    if (ctrlIdx !== -1) sheetUe.getRange(found.rowNum, ctrlIdx + 1).setValue('В перевірці');
    if (dateIdx !== -1) sheetUe.getRange(found.rowNum, dateIdx + 1).setValue(now());

    var obj = pkgObjFromData(found.headers, found.data, SHEETS.UE, found.rowNum);
    obj['Контроль перевірки'] = 'В перевірці';
    obj['Дата перевірки'] = now();

    // Шукаємо дублікати по отримувачу
    var duplicates = [];
    if (obj['Піб отримувача'] || obj['Телефон отримувача']) {
      duplicates = findDuplicatesByRecipientInternal(
        obj['PKG_ID'], obj['Піб отримувача'], obj['Телефон отримувача']
      );
    }

    return { ok: true, type: 'found', data: obj, duplicates: duplicates };
  }

  // ТИП B — не знайдено → створити нову "невідому" посилку
  var pkgId = genId('PKG');
  var newObj = {};
  PKG_UE_COLS.forEach(function(c) { newObj[c] = ''; });

  newObj['PKG_ID'] = pkgId;
  newObj['Напрям'] = 'УК→ЄВ';
  newObj['SOURCE_SHEET'] = SHEETS.UE;
  newObj['Дата створення'] = now();
  newObj['Номер ТТН'] = ttn;
  newObj['Статус ліда'] = 'Невідомий';
  newObj['Статус CRM'] = 'Активний';
  newObj['Контроль перевірки'] = 'В перевірці';
  newObj['Дата перевірки'] = now();

  var all = getAllData(sheetUe);
  var headers = all.headers.length > 0 ? all.headers : PKG_UE_COLS;
  sheetUe.appendRow(objToRow(headers, newObj));

  return { ok: true, type: 'new', data: newObj, pkg_id: pkgId };
}

/**
 * Внутрішня функція пошуку дублікатів по отримувачу
 */
function findDuplicatesByRecipientInternal(excludePkgId, recipientName, recipientPhone) {
  var allParcels = loadSheetParcels(getUeSheet(), SHEETS.UE)
    .concat(loadSheetParcels(getEuSheet(), SHEETS.EU));

  var name = (recipientName || '').toLowerCase().trim();
  var phone = (recipientPhone || '').replace(/\s+/g, '').trim();
  if (!name && !phone) return [];

  var duplicates = [];
  for (var i = 0; i < allParcels.length; i++) {
    var p = allParcels[i];
    if (p['PKG_ID'] === excludePkgId) continue;
    if (p['Статус CRM'] === 'Архів') continue;

    var pName = (p['Піб отримувача'] || '').toLowerCase();
    var pPhone = (p['Телефон отримувача'] || '').replace(/\s+/g, '');

    if ((name && pName.indexOf(name) !== -1) || (phone && pPhone.indexOf(phone) !== -1)) {
      duplicates.push(p);
    }
  }
  return duplicates;
}

/**
 * apiFindDuplicatesByRecipient — зовнішній endpoint
 * params: { pkg_id }
 */
function apiFindDuplicatesByRecipient(params) {
  var found = findPkgInBoth(params.pkg_id);
  if (!found) return { ok: false, error: 'Посилку не знайдено' };

  var obj = rowToObj(found.headers, found.data);
  var duplicates = findDuplicatesByRecipientInternal(
    params.pkg_id, obj['Піб отримувача'], obj['Телефон отримувача']
  );

  return { ok: true, duplicates: duplicates, count: duplicates.length };
}

/**
 * apiAssignRouteNumber — генерація внутрішнього номера
 * params: { pkg_id, route_base }
 * route_base: 200 → діапазон 200-299, overflow 900+
 *             500 → діапазон 500-599, overflow 800+
 */
function apiAssignRouteNumber(params) {
  var base = parseInt(params.route_base) || 200;
  var rangeStart = base;
  var rangeEnd = base + 99;
  var overflowStart = (base === 200) ? 900 : 800;

  // Зібрати всі існуючі внутрішні номери
  var allParcels = loadSheetParcels(getUeSheet(), SHEETS.UE)
    .concat(loadSheetParcels(getEuSheet(), SHEETS.EU));

  var existingNums = {};
  for (var i = 0; i < allParcels.length; i++) {
    var num = parseInt(allParcels[i]['Внутрішній №']);
    if (!isNaN(num)) existingNums[num] = true;
  }

  // Знайти наступний вільний номер
  var nextNum = rangeStart;
  while (existingNums[nextNum] && nextNum <= rangeEnd) {
    nextNum++;
  }
  // Якщо діапазон повний → overflow
  if (nextNum > rangeEnd) {
    nextNum = overflowStart;
    while (existingNums[nextNum]) {
      nextNum++;
    }
  }

  // Оновити посилку
  var found = findPkgInBoth(params.pkg_id);
  if (found) {
    var numIdx = found.headers.indexOf('Внутрішній №');
    if (numIdx !== -1) {
      found.sheet.getRange(found.rowNum, numIdx + 1).setValue(String(nextNum));
    }
  }

  return { ok: true, number: nextNum, pkg_id: params.pkg_id };
}

/**
 * apiCompleteVerification — завершити перевірку
 * params: { pkg_id, skip_validation }
 */
function apiCompleteVerification(params) {
  var found = findPkgInBoth(params.pkg_id);
  if (!found) return { ok: false, error: 'Посилку не знайдено' };

  var obj = rowToObj(found.headers, found.data);

  // Валідація (якщо не skip)
  if (!params.skip_validation) {
    if (!obj['Внутрішній №']) {
      return { ok: false, error: 'Внутрішній № обов\'язковий для завершення перевірки' };
    }
  }

  // Оновити статус
  var ctrlIdx = found.headers.indexOf('Контроль перевірки');
  if (ctrlIdx !== -1) {
    found.sheet.getRange(found.rowNum, ctrlIdx + 1).setValue('Готова до маршруту');
  }

  return { ok: true, pkg_id: params.pkg_id };
}

/**
 * apiRejectVerification — відхилити посилку
 * params: { pkg_id, reason }
 */
function apiRejectVerification(params) {
  var found = findPkgInBoth(params.pkg_id);
  if (!found) return { ok: false, error: 'Посилку не знайдено' };

  var updates = {
    'Статус ліда': 'Відмова',
    'Контроль перевірки': 'Відхилено',
    'Примітка': params.reason || ''
  };

  for (var col in updates) {
    var idx = found.headers.indexOf(col);
    if (idx !== -1) {
      found.sheet.getRange(found.rowNum, idx + 1).setValue(updates[col]);
    }
  }

  return { ok: true, pkg_id: params.pkg_id };
}

// ============================================================
// ROUTES ENDPOINTS
// ============================================================

/**
 * apiGetRoutesList — список всіх аркушів маршрутної таблиці
 * Категоризація: routes, dispatches, expenses, summary
 * Кеш: routesList_v3, TTL 300 сек
 */
var HIDDEN_SHEETS = ['Взірець', 'Зведення рейсів'];

function apiGetRoutesList(params) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('routesList_v3');
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* ignore */ }
  }

  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var sheets = ss.getSheets();
  var skipPattern = /^(Лог|Конфіг|Config|Log|Шаблон|Template|Маршрут_Шаблон|Відправка_Шаблон|Витрати_Шаблон)/i;

  var routes = [];
  var dispatches = [];
  var expenses = [];
  var summary = null;

  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (skipPattern.test(name)) continue;
    if (HIDDEN_SHEETS.indexOf(name) !== -1 && name !== 'Зведення рейсів') continue;

    var lastRow = sheets[i].getLastRow();
    var rowCount = Math.max(0, lastRow - 1);

    // Категоризація
    if (name === 'Зведення рейсів') {
      summary = { sheetName: name, rowCount: rowCount };
      continue;
    }
    if (name.indexOf('Відправка') === 0 || name.indexOf('Відправка_') === 0) {
      var dispCity = name.replace(/^Відправка[_ ]*/, '');
      dispatches.push({ sheetName: name, city: dispCity, rowCount: rowCount });
      continue;
    }
    if (name.indexOf('Витрати') === 0 || name.indexOf('Витрати_') === 0) {
      var expCity = name.replace(/^Витрати[_ ]*/, '');
      expenses.push({ sheetName: name, city: expCity, rowCount: rowCount });
      continue;
    }

    // Маршрутний аркуш (Цюріх, Женева, Маршрут_Назва тощо)
    var cityName = name.replace(/^Маршрут_/, '');
    var paxCount = 0, parcelCount = 0;
    if (rowCount > 0) {
      var lastCol = sheets[i].getLastColumn();
      if (lastCol > 0) {
        var headers = normalizeHeaders(sheets[i].getRange(1, 1, 1, lastCol).getValues()[0]);
        var typeIdx = headers.indexOf('Тип запису');
        if (typeIdx !== -1 && lastRow > 1) {
          var typeCol = sheets[i].getRange(2, typeIdx + 1, lastRow - 1, 1).getValues();
          for (var j = 0; j < typeCol.length; j++) {
            var t = String(typeCol[j][0]).toLowerCase();
            if (t.indexOf('пасажир') !== -1) paxCount++;
            else if (t.indexOf('посилк') !== -1) parcelCount++;
          }
        }
      }
    }

    routes.push({
      sheetName: name,
      city: cityName,
      rowCount: rowCount,
      paxCount: paxCount,
      parcelCount: parcelCount
    });
  }

  var result = { ok: true, routes: routes, dispatches: dispatches, expenses: expenses, summary: summary };

  try {
    cache.put('routesList_v3', JSON.stringify(result), 300);
  } catch(e) { /* > 100KB */ }

  return result;
}

/**
 * apiGetRouteSheet — дані одного маршруту
 * params: { sheetName }
 * Кеш: routeSheet_<name>, TTL 180 сек
 */
function apiGetRouteSheet(params) {
  var sheetName = params.sheetName;
  var cache = CacheService.getScriptCache();
  var cacheKey = 'routeSheet_' + sheetName;
  var cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* ignore */ }
  }

  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Маршрут не знайдено: ' + sheetName };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { ok: true, data: { sheetName: sheetName, headers: [], rows: [], rowCount: 0 } };
  }

  // НОРМАЛІЗАЦІЯ заголовків
  var headers = normalizeHeaders(sheet.getRange(1, 1, 1, lastCol).getValues()[0]);
  var rawData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var rows = [];
  for (var i = 0; i < rawData.length; i++) {
    // Пропустити повністю порожні рядки
    var isEmpty = true;
    for (var j = 0; j < rawData[i].length; j++) {
      if (rawData[i][j] !== '' && rawData[i][j] !== null) { isEmpty = false; break; }
    }
    if (isEmpty) continue;

    var obj = {};
    for (var k = 0; k < headers.length; k++) {
      var val = rawData[i][k];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, 'Europe/Kiev', 'dd.MM.yyyy');
      }
      obj[headers[k]] = (val !== undefined && val !== null) ? String(val) : '';
    }
    obj._rowNum = i + 2;
    rows.push(obj);
  }

  var result = { ok: true, data: { sheetName: sheetName, headers: headers, rows: rows, rowCount: rows.length } };

  try {
    cache.put(cacheKey, JSON.stringify(result), 180);
  } catch(e) { /* > 100KB */ }

  return result;
}

/**
 * apiAddToRoute — додати посилку в маршрут
 * params: { pkg_id, sheet_name, rte_id, lead_data }
 *
 * КРИТИЧНО: lead_data (з фронтенду) має пріоритет.
 * Fallback: apiGetOne + маппінг всіх варіантів назв колонок.
 */
function apiAddToRoute(params) {
  var sheetName = params.sheet_name;
  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Маршрут не знайдено: ' + sheetName };

  // 1. Прочитати заголовки маршруту (з нормалізацією)
  var lastCol = sheet.getLastColumn();
  var headers = normalizeHeaders(sheet.getRange(1, 1, 1, lastCol).getValues()[0]);

  // 2. Побудувати об'єкт для рядка
  var lead = {};

  // ПРІОРИТЕТ: lead_data з фронтенду
  if (params.lead_data) {
    for (var key in params.lead_data) {
      lead[key] = params.lead_data[key];
    }
  }

  // FALLBACK: доповнити з основної таблиці
  var pkgResult = apiGetOne({ pkg_id: params.pkg_id });
  if (pkgResult.ok && pkgResult.data) {
    var p = pkgResult.data;

    // Розширений маппінг — ВСІ варіанти назв колонок
    var mapping = {
      'RTE_ID': params.rte_id || params.pkg_id,
      'PAX_ID/PKG_ID': params.pkg_id,
      'Тип запису': 'Посилка',
      'Піб відправника': p['Піб відправника'],
      'Телефон': p['Телефон реєстратора'],
      'Телефон пасажира': p['Телефон реєстратора'],
      'Телефон реєстратора': p['Телефон реєстратора'],
      'Піб отримувача': p['Піб отримувача'],
      'Телефон отримувача': p['Телефон отримувача'],
      'Адреса отримувача': p['Адреса в Європі'] || p['Місто Нова Пошта'] || '',
      'Адреса': p['Адреса відправки'],
      'Адреса відправки': p['Адреса відправки'],
      'Адреса прибуття': p['Адреса в Європі'] || p['Місто Нова Пошта'] || '',
      'Адреса в Європі': p['Адреса в Європі'] || '',
      'Місто Нова Пошта': p['Місто Нова Пошта'] || '',
      'Кг': p['Кг'],
      'Кг посилки': p['Кг'],
      'Вага багажу': p['Кг'],
      'Опис': p['Опис'],
      'Опис посилки': p['Опис'],
      'Деталі': p['Деталі'],
      'Кількість позицій': p['Кількість позицій'],
      'Номер ТТН': p['Номер ТТН'] || '',
      'Внутрішній №': p['Внутрішній №'] || '',
      'Сума': p['Сума'],
      'Валюта': p['Валюта оплати'],
      'Валюта оплати': p['Валюта оплати'],
      'Завдаток': p['Завдаток'],
      'Борг': p['Борг'],
      'Форма оплати': p['Форма оплати'],
      'Статус оплати': p['Статус оплати'],
      'Статус': p['Статус ліда'],
      'Статус ліда': p['Статус ліда'],
      'PKG_ID': params.pkg_id,
      'Примітка': p['Примітка'] || '',
      'Тег': p['Тег'] || '',
      'Напрям': p['Напрям'] || ''
    };

    // Заповнити тільки порожні поля (lead_data має пріоритет)
    for (var mk in mapping) {
      if (!lead[mk] && mapping[mk]) {
        lead[mk] = mapping[mk];
      }
    }
  }

  // 3. Гарантувати обов'язкові поля
  lead['RTE_ID'] = lead['RTE_ID'] || params.rte_id || params.pkg_id;
  lead['PAX_ID/PKG_ID'] = lead['PAX_ID/PKG_ID'] || params.pkg_id;
  lead['Тип запису'] = lead['Тип запису'] || 'Посилка';

  // 4. Записати рядок
  var row = headers.map(function(h) { return lead[h] || ''; });
  sheet.appendRow(row);

  // 5. Оновити RTE_ID в основній таблиці посилок
  var rteId = lead['RTE_ID'] || sheetName;
  apiUpdateField({ pkg_id: params.pkg_id, col: 'RTE_ID', value: rteId });

  // 6. Інвалідувати кеш
  var cache = CacheService.getScriptCache();
  cache.remove('routeSheet_' + sheetName);
  cache.remove('routesList_v3');

  return { ok: true, pkg_id: params.pkg_id, route: sheetName };
}

/**
 * apiRemoveFromRoute — видалити посилку з маршруту
 * params: { pkg_id }
 */
function apiRemoveFromRoute(params) {
  var found = findPkgInBoth(params.pkg_id);
  if (!found) return { ok: false, error: 'Посилку не знайдено' };

  // Очистити маршрутні поля
  var clearCols = ['RTE_ID', 'Номер авто', 'Дата відправки'];
  for (var i = 0; i < clearCols.length; i++) {
    var idx = found.headers.indexOf(clearCols[i]);
    if (idx !== -1) {
      found.sheet.getRange(found.rowNum, idx + 1).setValue('');
    }
  }

  // Інвалідувати кеш
  var cache = CacheService.getScriptCache();
  cache.remove('routesList_v3');

  return { ok: true, pkg_id: params.pkg_id };
}

/**
 * apiUpdateRouteField — оновити поле в маршруті
 * params: { sheet, rte_id, col, value }
 */
function apiUpdateRouteField(params) {
  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var sheet = ss.getSheetByName(params.sheet);
  if (!sheet) return { ok: false, error: 'Маршрут не знайдено: ' + params.sheet };

  // Шукаємо за RTE_ID або PAX_ID/PKG_ID
  var found = findRow(sheet, 'RTE_ID', params.rte_id);
  if (!found) {
    found = findRow(sheet, 'PAX_ID/PKG_ID', params.rte_id);
  }
  if (!found) return { ok: false, error: 'Запис не знайдено: ' + params.rte_id };

  var colIdx = found.headers.indexOf(params.col);
  if (colIdx === -1) return { ok: false, error: 'Колонку не знайдено: ' + params.col };

  sheet.getRange(found.rowNum, colIdx + 1).setValue(params.value);

  // Інвалідувати кеш
  var cache = CacheService.getScriptCache();
  cache.remove('routeSheet_' + params.sheet);

  return { ok: true };
}

/**
 * apiCreateRoute — створити новий маршрут (копіює шаблони)
 * params: { name }
 */
function apiCreateRoute(params) {
  var name = (params.name || '').trim();
  if (!name) return { ok: false, error: 'Назва маршруту не вказана' };

  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var routeName = 'Маршрут_' + name;

  // Перевірити чи не існує
  if (ss.getSheetByName(routeName)) {
    return { ok: false, error: 'Маршрут "' + routeName + '" вже існує' };
  }

  var created = [];

  // Копіювати шаблони
  var templates = [
    { from: 'Маршрут_Шаблон', to: 'Маршрут_' + name },
    { from: 'Відправка_Шаблон', to: 'Відправка_' + name },
    { from: 'Витрати_Шаблон', to: 'Витрати_' + name }
  ];

  for (var i = 0; i < templates.length; i++) {
    var tmpl = ss.getSheetByName(templates[i].from);
    if (tmpl) {
      var newSheet = tmpl.copyTo(ss);
      newSheet.setName(templates[i].to);
      created.push(templates[i].to);
    }
  }

  // Інвалідувати кеш
  var cache = CacheService.getScriptCache();
  cache.remove('routesList_v3');

  return { ok: true, created: created };
}

/**
 * apiDeleteRoute — видалити маршрут
 * params: { name }
 */
function apiDeleteRoute(params) {
  var name = (params.name || '').trim();
  if (!name) return { ok: false, error: 'Назва маршруту не вказана' };

  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var routeSheet = ss.getSheetByName('Маршрут_' + name);

  if (!routeSheet) {
    return { ok: false, error: 'Маршрут "Маршрут_' + name + '" не знайдено' };
  }

  ss.deleteSheet(routeSheet);

  // Інвалідувати кеш
  var cache = CacheService.getScriptCache();
  cache.remove('routesList_v3');
  cache.remove('routeSheet_Маршрут_' + name);

  return { ok: true, deleted: 'Маршрут_' + name };
}

/**
 * apiGetRouteByRteId — всі записи рейсу за RTE_ID (для PDF)
 * params: { sheetName, rte_id }
 */
function apiGetRouteByRteId(params) {
  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var sheet = ss.getSheetByName(params.sheetName);
  if (!sheet) return { ok: false, error: 'Аркуш не знайдено: ' + params.sheetName };

  var all = getAllData(sheet);
  var rteIdx = all.headers.indexOf('RTE_ID');
  if (rteIdx === -1) return { ok: true, data: [] };

  var rows = [];
  for (var i = 0; i < all.data.length; i++) {
    if (String(all.data[i][rteIdx]) === String(params.rte_id)) {
      rows.push(rowToObj(all.headers, all.data[i]));
    }
  }
  return { ok: true, data: rows };
}

// ============================================================
// DISPATCH ENDPOINTS
// ============================================================

/**
 * apiGetDispatches — дані аркуша Відправка
 * params: { sheetName, filters: { date_from, date_to, driver, search } }
 */
function apiGetDispatches(params) {
  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var sheet = ss.getSheetByName(params.sheetName);
  if (!sheet) return { ok: false, error: 'Аркуш не знайдено: ' + params.sheetName };

  var all = getAllData(sheet);
  var filters = params.filters || {};
  var rows = [];

  for (var i = 0; i < all.data.length; i++) {
    var isEmpty = true;
    for (var j = 0; j < all.data[i].length; j++) {
      if (all.data[i][j] !== '' && all.data[i][j] !== null) { isEmpty = false; break; }
    }
    if (isEmpty) continue;

    var obj = rowToObj(all.headers, all.data[i]);
    obj._rowNum = i + 2;

    // Фільтри
    if (filters.driver && obj['Водій'] && obj['Водій'].indexOf(filters.driver) === -1) continue;
    if (filters.search) {
      var s = filters.search.toLowerCase();
      var searchIn = [obj['Піб відправника'], obj['Піб отримувача'], obj['Телефон відправника'], obj['Телефон отримувача'], obj['DISPATCH_ID']].join(' ').toLowerCase();
      if (searchIn.indexOf(s) === -1) continue;
    }

    rows.push(obj);
  }

  return { ok: true, data: rows, count: rows.length };
}

/**
 * apiUpdateDispatch — оновити поле у Відправці
 * params: { sheetName, dispatch_id, col, value }
 */
function apiUpdateDispatch(params) {
  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var sheet = ss.getSheetByName(params.sheetName);
  if (!sheet) return { ok: false, error: 'Аркуш не знайдено: ' + params.sheetName };

  var found = findRow(sheet, 'DISPATCH_ID', params.dispatch_id);
  if (!found) return { ok: false, error: 'Запис не знайдено: ' + params.dispatch_id };

  var colIdx = found.headers.indexOf(params.col);
  if (colIdx === -1) return { ok: false, error: 'Колонку не знайдено: ' + params.col };

  sheet.getRange(found.rowNum, colIdx + 1).setValue(params.value);

  var cache = CacheService.getScriptCache();
  cache.remove('routeSheet_' + params.sheetName);

  return { ok: true };
}

/**
 * apiGetDispatchByRoute — відправки за RTE_ID (для PDF)
 * params: { sheetName, rte_id }
 */
function apiGetDispatchByRoute(params) {
  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var sheet = ss.getSheetByName(params.sheetName);
  if (!sheet) return { ok: false, error: 'Аркуш не знайдено: ' + params.sheetName };

  var all = getAllData(sheet);
  var rteIdx = all.headers.indexOf('RTE_ID');
  if (rteIdx === -1) return { ok: true, data: [] };

  var rows = [];
  for (var i = 0; i < all.data.length; i++) {
    if (String(all.data[i][rteIdx]) === String(params.rte_id)) {
      var obj = rowToObj(all.headers, all.data[i]);
      obj._rowNum = i + 2;
      rows.push(obj);
    }
  }
  return { ok: true, data: rows };
}

// ============================================================
// EXPENSES & SUMMARY ENDPOINTS
// ============================================================

/**
 * apiGetExpenses — витрати (read-only)
 * params: { sheetName, rte_id? }
 */
function apiGetExpenses(params) {
  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var sheet = ss.getSheetByName(params.sheetName);
  if (!sheet) return { ok: false, error: 'Аркуш не знайдено: ' + params.sheetName };

  var all = getAllData(sheet);
  var rows = [];
  var rteIdx = all.headers.indexOf('RTE_ID');

  for (var i = 0; i < all.data.length; i++) {
    var isEmpty = true;
    for (var j = 0; j < all.data[i].length; j++) {
      if (all.data[i][j] !== '' && all.data[i][j] !== null) { isEmpty = false; break; }
    }
    if (isEmpty) continue;

    var obj = rowToObj(all.headers, all.data[i]);

    if (params.rte_id && rteIdx !== -1 && obj['RTE_ID'] !== params.rte_id) continue;

    rows.push(obj);
  }

  return { ok: true, data: rows, count: rows.length };
}

/**
 * apiGetSummary — зведення рейсів (read-only)
 * params: { rte_id? }
 */
function apiGetSummary(params) {
  var ss = SpreadsheetApp.openById(DB.MARHRUT);
  var sheet = ss.getSheetByName('Зведення рейсів');
  if (!sheet) return { ok: false, error: 'Аркуш "Зведення рейсів" не знайдено' };

  var all = getAllData(sheet);
  var rteIdx = all.headers.indexOf('RTE_ID');
  var rows = [];

  for (var i = 0; i < all.data.length; i++) {
    var isEmpty = true;
    for (var j = 0; j < all.data[i].length; j++) {
      if (all.data[i][j] !== '' && all.data[i][j] !== null) { isEmpty = false; break; }
    }
    if (isEmpty) continue;

    var obj = rowToObj(all.headers, all.data[i]);
    if (params.rte_id && rteIdx !== -1 && obj['RTE_ID'] !== params.rte_id) continue;
    rows.push(obj);
  }

  return { ok: true, data: rows, count: rows.length };
}

// ============================================================
// NOVA POSHTA ENDPOINTS
// ============================================================

/**
 * apiTrackParcel — відстеження ТТН через API Нової Пошти
 * params: { pkg_id, ttn }
 */
function apiTrackParcel(params) {
  var ttn = params.ttn || '';

  // Якщо ТТН не передано — взяти з бази
  if (!ttn && params.pkg_id) {
    var found = findPkgInBoth(params.pkg_id);
    if (found) {
      var obj = rowToObj(found.headers, found.data);
      ttn = obj['Номер ТТН'] || '';
    }
  }

  if (!ttn) return { ok: false, error: 'ТТН не вказано' };

  // Отримати API ключ
  var npKey = getNpApiKey_();
  if (!npKey) return { ok: false, error: 'API ключ Нової Пошти не налаштований' };

  // Запит до API НП
  var payload = {
    apiKey: npKey,
    modelName: 'TrackingDocument',
    calledMethod: 'getStatusDocuments',
    methodProperties: {
      Documents: [{ DocumentNumber: ttn, Phone: '' }]
    }
  };

  var response = UrlFetchApp.fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var result = JSON.parse(response.getContentText());

  if (!result.success || !result.data || result.data.length === 0) {
    return { ok: false, error: 'НП: ' + (result.errors || []).join(', ') || 'Не знайдено' };
  }

  var track = result.data[0];
  var tracking = {
    ttn: ttn,
    status: track.Status || '',
    statusCode: track.StatusCode || '',
    cityFrom: track.CitySender || '',
    cityTo: track.CityRecipient || '',
    weight: track.DocumentWeight || '',
    cost: track.DocumentCost || '',
    deliveryDate: track.ActualDeliveryDate || track.ScheduledDeliveryDate || '',
    payerType: track.PayerType || '',
    paymentMethod: track.PaymentMethod || ''
  };

  // Оновити статус посилки в базі (якщо є pkg_id)
  if (params.pkg_id) {
    var statusMap = {
      '1': '', '2': '', '3': 'В дорозі',
      '4': 'В дорозі', '5': 'В дорозі', '6': 'В дорозі',
      '7': 'В дорозі', '8': 'В дорозі', '9': 'Доставлено',
      '10': 'Доставлено', '11': 'Доставлено', '12': 'Затримано',
      '14': 'Затримано', '101': 'Втрачено', '102': 'Втрачено',
      '103': 'Затримано', '104': 'Затримано', '106': 'Затримано',
      '111': 'Затримано', '112': 'Затримано'
    };

    var pkgStatus = statusMap[String(track.StatusCode)] || '';
    if (pkgStatus) {
      apiUpdateField({ pkg_id: params.pkg_id, col: 'Статус посилки', value: pkgStatus });
    }
  }

  return { ok: true, tracking: tracking };
}

/**
 * apiCheckNpApiKey — перевірити наявність ключа API НП
 */
function apiCheckNpApiKey(params) {
  var key = getNpApiKey_();
  return { ok: true, hasKey: !!key };
}

/**
 * Внутрішня: отримати ключ API Нової Пошти з конфігурації
 */
function getNpApiKey_() {
  try {
    var ss = SpreadsheetApp.openById(DB.CONFIG);
    var sheet = ss.getSheetByName('Config');
    if (!sheet) return null;

    var data = sheet.getDataRange().getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === 'NP_API_KEY') {
        return String(data[i][1]).trim() || null;
      }
    }
  } catch(e) { /* ігноруємо */ }
  return null;
}

// ============================================================
// ТЕСТУВАННЯ (запускати вручну в GAS редакторі)
// ============================================================

function testGetAll() {
  var result = apiGetAll({ sheet: 'all', filter: {} });
  Logger.log('Total: ' + result.count);
  Logger.log(JSON.stringify(result.data.slice(0, 2), null, 2));
}

function testGetStats() {
  var result = apiGetStats({});
  Logger.log(JSON.stringify(result.stats, null, 2));
}

function testScanTTN() {
  var result = apiScanTTN({ ttn: '59000123456789' });
  Logger.log(JSON.stringify(result, null, 2));
}

function testGetRoutesList() {
  var result = apiGetRoutesList({});
  Logger.log(JSON.stringify(result, null, 2));
}

// ══════════════════════════════════════════════════════════════
// ██  CLIENT CHAT (аркуш "Чат" в KLIYENTU)
// ══════════════════════════════════════════════════════════════

function _getChatSheet() {
  var ss = SpreadsheetApp.openById(DB.KLIYENTU);
  var sh = ss.getSheetByName('Чат');
  if (!sh) {
    sh = ss.insertSheet('Чат');
    sh.appendRow(['MESSAGE_ID','CLIENT_ID','Дата і час','Роль','Імʼя відправника','Текст повідомлення','Прочитано','BOOKING_ID','ORDER_ID']);
  }
  return sh;
}

function apiGetClientMessages(body) {
  var cliId = body.cli_id;
  if (!cliId) return { ok: false, error: 'cli_id required' };
  var sh = _getChatSheet();
  var data = sh.getDataRange().getValues();
  var messages = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(cliId)) {
      messages.push({
        message_id: data[i][0],
        cli_id: data[i][1],
        date: data[i][2],
        role: data[i][3],
        sender_name: data[i][4],
        text: data[i][5],
        read: data[i][6]
      });
    }
  }
  messages.sort(function(a,b) { return new Date(a.date) - new Date(b.date); });
  return { ok: true, data: messages };
}

function apiSendManagerMessage(body) {
  var cliId = body.cli_id;
  var text = body.text;
  var senderName = body.sender_name || 'Менеджер';
  if (!cliId || !text) return { ok: false, error: 'cli_id and text required' };
  var sh = _getChatSheet();
  var msgId = 'MSG-' + new Date().getTime().toString(36).toUpperCase();
  sh.appendRow([msgId, cliId, new Date().toISOString(), 'manager', senderName, text, '', '', '']);
  return { ok: true, data: { message_id: msgId } };
}

function apiGetUnreadCounts(body) {
  var sh = _getChatSheet();
  var data = sh.getDataRange().getValues();
  var counts = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][3] === 'client' && data[i][6] !== 'Так') {
      var cid = String(data[i][1]);
      counts[cid] = (counts[cid] || 0) + 1;
    }
  }
  return { ok: true, data: counts };
}

function apiMarkClientRead(body) {
  var cliId = body.cli_id;
  if (!cliId) return { ok: false, error: 'cli_id required' };
  var sh = _getChatSheet();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(cliId) && data[i][3] === 'client' && data[i][6] !== 'Так') {
      sh.getRange(i + 1, 7).setValue('Так');
    }
  }
  return { ok: true };
}

function testGetVerificationStats() {
  var result = apiGetVerificationStats({});
  Logger.log(JSON.stringify(result, null, 2));
}

