// ============================================
// BOTILOGISTICS DRIVERS CRM v2.0
// Єдиний Apps Script для таблиці Marhrut_Test
// ID: 1Ku__ll0kDvp5dCeaS6QdnHrGGeoic-rykib6N1L7jeQ
// ============================================
//
// СТРУКТУРА:
//   Маршрут_1/2/3  — пасажири + посилки (поле "Тип запису")
//   Відправка_1/2/3 — відправлення (read-only для водія)
//   Витрати_1/2/3  — витрати (поки не використовується)
//   *_Шаблон       — шаблони, ігноруються
//   Зведення рейсів — зведення, ігнорується
// ============================================

var SPREADSHEET_ID = '1Ku__ll0kDvp5dCeaS6QdnHrGGeoic-rykib6N1L7jeQ';
var SHEET_LOGS = 'Логи водіїв';

var STATUS_COLORS = {
  'pending':     { bg: '#fffbf0', border: '#ffc107', font: '#ffc107' },
  'in-progress': { bg: '#e3f2fd', border: '#2196F3', font: '#2196F3' },
  'completed':   { bg: '#e8f5e9', border: '#4CAF50', font: '#4CAF50' },
  'cancelled':   { bg: '#ffebee', border: '#dc3545', font: '#dc3545' }
};

// ============================================
// КОЛОНКИ — Маршрут (50 колонок, A-AX)
// Пасажири та посилки в одному листі
// ============================================
var COL = {
  RTE_ID: 0,            // A
  TYPE: 1,              // B — "Пасажир" або "Посилка"
  DIRECTION: 2,         // C — Напрям
  SOURCE_SHEET: 3,      // D
  ITEM_ID: 4,           // E — PAX_ID / PKG_ID
  DATE_CREATED: 5,      // F
  DATE_TRIP: 6,         // G — Дата рейсу
  TIMING: 7,            // H
  AUTO_ID: 8,           // I
  AUTO_NUM: 9,          // J — Номер авто
  DRIVER: 10,           // K — Водій
  DRIVER_PHONE: 11,     // L
  CITY: 12,             // M — Місто
  SEAT: 13,             // N — Місце в авто
  PAX_NAME: 14,         // O — Піб пасажира
  PAX_PHONE: 15,        // P — Телефон пасажира
  ADDR_FROM: 16,        // Q — Адреса відправки
  ADDR_TO: 17,          // R — Адреса прибуття
  SEATS_COUNT: 18,      // S — Кількість місць
  BAGGAGE_WEIGHT: 19,   // T — Вага багажу
  SENDER_NAME: 20,      // U — Піб відправника
  RECIPIENT_NAME: 21,   // V — Піб отримувача
  RECIPIENT_PHONE: 22,  // W — Телефон отримувача
  RECIPIENT_ADDR: 23,   // X — Адреса отримувача
  INTERNAL_NUM: 24,     // Y — Внутрішній №
  TTN: 25,              // Z — Номер ТТН
  PKG_DESC: 26,         // AA — Опис посилки
  PKG_WEIGHT: 27,       // AB — Кг посилки
  AMOUNT: 28,           // AC — Сума
  CURRENCY: 29,         // AD — Валюта
  DEPOSIT: 30,          // AE — Завдаток
  DEPOSIT_CURRENCY: 31, // AF — Валюта завдатку
  PAY_FORM: 32,         // AG — Форма оплати
  PAY_STATUS: 33,       // AH — Статус оплати
  DEBT: 34,             // AI — Борг
  PAY_NOTE: 35,         // AJ — Примітка оплати
  STATUS: 36,           // AK — Статус (водій змінює)
  STATUS_CRM: 37,       // AL — Статус CRM
  TAG: 38,              // AM — Тег
  RATING_DRIVER: 39,    // AN
  COMMENT_DRIVER: 40,   // AO
  RATING_MANAGER: 41,   // AP
  COMMENT_MANAGER: 42,  // AQ
  NOTE: 43,             // AR — Примітка
  SMS_NOTE: 44,         // AS — Примітка СМС
  CLI_ID: 45,           // AT
  DATE_ARCHIVE: 46,     // AU
  ARCHIVED_BY: 47,      // AV
  ARCHIVE_REASON: 48,   // AW
  ARCHIVE_ID: 49        // AX
};
var TOTAL_COLS = 50;

// ============================================
// КОЛОНКИ — Відправка (28 колонок)
// ============================================
var COL_SHIP = {
  DISPATCH_ID: 0,       // A
  DATE_CREATED: 1,      // B
  RTE_ID: 2,            // C
  DATE_TRIP: 3,         // D
  AUTO_ID: 4,           // E
  AUTO_NUM: 5,          // F
  DRIVER: 6,            // G
  CLI_ID: 7,            // H
  SMART_ID: 8,          // I
  SENDER_PHONE: 9,      // J
  SENDER_NAME: 10,      // K
  RECIPIENT_NAME: 11,   // L
  RECIPIENT_PHONE: 12,  // M
  RECIPIENT_ADDR: 13,   // N
  INTERNAL_NUM: 14,     // O
  WEIGHT: 15,           // P
  DESCRIPTION: 16,      // Q
  PHOTO: 17,            // R
  AMOUNT: 18,           // S
  CURRENCY: 19,         // T
  DEPOSIT: 20,          // U
  DEPOSIT_CURRENCY: 21, // V
  PAY_FORM: 22,         // W
  PAY_STATUS: 23,       // X
  DEBT: 24,             // Y
  STATUS: 25,           // Z
  PKG_ID: 26,           // AA
  NOTE: 27              // AB
};
var TOTAL_COLS_SHIP = 28;

// Ігноровані листи
var EXCLUDE_PATTERNS = ['шаблон', 'зведення', 'логи', 'template'];

// ============================================
// doGet
// ============================================
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'health';
    var sheet = (e && e.parameter) ? (e.parameter.sheet || '') : '';

    switch (action) {
      case 'health':
        return respond({ success: true, version: '2.0', service: 'BotiLogistics Drivers CRM', timestamp: new Date().toISOString() });
      case 'getAvailableRoutes':
        return respond(getAvailableRoutes());
      case 'getPassengers':
        if (!sheet) return respond({ success: false, error: 'Не вказано sheet' });
        return respond(getPassengers(sheet));
      case 'getPackages':
        if (!sheet) return respond({ success: false, error: 'Не вказано sheet' });
        return respond(getPackages(sheet));
      case 'getShippingItems':
        if (!sheet) return respond({ success: false, error: 'Не вказано sheet' });
        return respond(getShippingItems(sheet));
      default:
        return respond({ success: false, error: 'Невідома GET дія: ' + action });
    }
  } catch (err) {
    return respond({ success: false, error: err.toString() });
  }
}

// ============================================
// doPost
// ============================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respond({ success: false, error: 'Порожній запит (немає postData)' });
    }
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var payload = data.payload || data;

    switch (action) {
      case 'getAvailableRoutes':
        return respond(getAvailableRoutes());
      case 'getPassengers':
        return respond(getPassengers(payload.sheetName || ''));
      case 'getPackages':
        return respond(getPackages(payload.sheetName || ''));
      case 'getShippingItems':
        return respond(getShippingItems(payload.sheetName || ''));
      case 'updateDriverStatus':
        return respond(handleDriverStatusUpdate(data));
      case 'addRouteItem':
        return respond(handleAddRouteItem(data));
      default:
        return respond({ success: false, error: 'Невідома дія: ' + action });
    }
  } catch (err) {
    return respond({ success: false, error: err.toString() });
  }
}

// ============================================
// getAvailableRoutes — динамічний список
// ============================================
// Маршрути відомі заздалегідь — не скануємо таблицю (занадто повільно)
var KNOWN_ROUTES = ['Маршрут_1', 'Маршрут_2', 'Маршрут_3'];
var KNOWN_SHIPPING = [
  { name: 'Відправка_1', label: 'Відправка 1' },
  { name: 'Відправка_2', label: 'Відправка 2' },
  { name: 'Відправка_3', label: 'Відправка 3' },
];

function getAvailableRoutes() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var routes = [];
  for (var i = 0; i < KNOWN_ROUTES.length; i++) {
    var count = 0;
    try {
      var sheet = ss.getSheetByName(KNOWN_ROUTES[i]);
      if (sheet) count = Math.max(0, sheet.getLastRow() - 1);
    } catch (e) { /* sheet not found */ }
    routes.push({ name: KNOWN_ROUTES[i], count: count });
  }
  var shipping = [];
  for (var j = 0; j < KNOWN_SHIPPING.length; j++) {
    var sCount = 0;
    try {
      var sSheet = ss.getSheetByName(KNOWN_SHIPPING[j].name);
      if (sSheet) sCount = Math.max(0, sSheet.getLastRow() - 1);
    } catch (e) { /* sheet not found */ }
    shipping.push({ name: KNOWN_SHIPPING[j].name, label: KNOWN_SHIPPING[j].label, count: sCount });
  }
  return { success: true, routes: routes, shipping: shipping };
}

// ============================================
// Допоміжна — читає рядки одного типу з маршрутного листа
// typeFilter: 'пасажир' або 'посилка'
// ============================================
function isExcludedSheet_(name) {
  var lower = name.toLowerCase();
  for (var i = 0; i < EXCLUDE_PATTERNS.length; i++) {
    if (lower.indexOf(EXCLUDE_PATTERNS[i]) !== -1) return true;
  }
  return false;
}

function readRouteByType_(sheetName, typeFilter) {
  if (!sheetName) return { success: false, error: 'Не вказано маршрут' };
  if (isExcludedSheet_(sheetName)) return { success: false, error: 'Аркуш заборонено читати: ' + sheetName };

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Аркуш не знайдено: ' + sheetName };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, items: [], sheetName: sheetName };

  var readCols = Math.min(sheet.getLastColumn(), TOTAL_COLS);
  var data = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();
  var items = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var type = str(row[COL.TYPE]).toLowerCase();
    if (type !== typeFilter) continue;

    var itemId = str(row[COL.ITEM_ID]);
    if (!itemId) continue;

    var item = {
      rowNum: i + 2,
      rteId: str(row[COL.RTE_ID]),
      type: str(row[COL.TYPE]),
      direction: str(row[COL.DIRECTION]),
      itemId: itemId,
      dateCreated: str(row[COL.DATE_CREATED]),
      dateTrip: str(row[COL.DATE_TRIP]),
      timing: str(row[COL.TIMING]),
      autoNum: str(row[COL.AUTO_NUM]),
      driver: str(row[COL.DRIVER]),
      city: str(row[COL.CITY]),
      amount: str(row[COL.AMOUNT]),
      currency: str(row[COL.CURRENCY]),
      deposit: str(row[COL.DEPOSIT]),
      depositCurrency: str(row[COL.DEPOSIT_CURRENCY]),
      payForm: str(row[COL.PAY_FORM]),
      payStatus: str(row[COL.PAY_STATUS]),
      debt: str(row[COL.DEBT]),
      payNote: str(row[COL.PAY_NOTE]),
      status: str(row[COL.STATUS]) || 'pending',
      statusCrm: str(row[COL.STATUS_CRM]),
      tag: str(row[COL.TAG]),
      note: str(row[COL.NOTE]),
      smsNote: str(row[COL.SMS_NOTE]),
      sheet: sheetName
    };

    if (typeFilter === 'пасажир') {
      item.name = str(row[COL.PAX_NAME]);
      item.phone = str(row[COL.PAX_PHONE]);
      item.addrFrom = str(row[COL.ADDR_FROM]);
      item.addrTo = str(row[COL.ADDR_TO]);
      item.seatsCount = str(row[COL.SEATS_COUNT]);
      item.baggageWeight = str(row[COL.BAGGAGE_WEIGHT]);
      item.seat = str(row[COL.SEAT]);
    } else {
      item.senderName = str(row[COL.SENDER_NAME]);
      item.recipientName = str(row[COL.RECIPIENT_NAME]);
      item.recipientPhone = str(row[COL.RECIPIENT_PHONE]);
      item.recipientAddr = str(row[COL.RECIPIENT_ADDR]);
      item.internalNum = str(row[COL.INTERNAL_NUM]);
      item.ttn = str(row[COL.TTN]);
      item.pkgDesc = str(row[COL.PKG_DESC]);
      item.pkgWeight = str(row[COL.PKG_WEIGHT]);
    }

    items.push(item);
  }

  return { success: true, items: items, count: items.length, sheetName: sheetName };
}

function getPassengers(sheetName) {
  return readRouteByType_(sheetName, 'пасажир');
}

function getPackages(sheetName) {
  return readRouteByType_(sheetName, 'посилка');
}

// ============================================
// getShippingItems — відправка (read-only)
// ============================================
function getShippingItems(sheetName) {
  try {
    if (!sheetName) return { success: false, error: 'Не вказано маршрут' };
    if (isExcludedSheet_(sheetName)) return { success: false, error: 'Аркуш заборонено читати: ' + sheetName };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'Аркуш не знайдено: ' + sheetName };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, items: [], count: 0, sheetName: sheetName };

    // Знаходимо реальний останній рядок через DISPATCH_ID (A)
    var idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var realLast = 0;
    for (var t = 0; t < idCol.length; t++) {
      if (String(idCol[t][0] || '').trim()) realLast = t + 1;
    }
    if (realLast === 0) return { success: true, items: [], count: 0, sheetName: sheetName };

    var readCols = Math.min(sheet.getLastColumn(), TOTAL_COLS_SHIP);
    var data = sheet.getRange(2, 1, realLast, readCols).getValues();
    var items = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var senderName = str(row[COL_SHIP.SENDER_NAME]);
      var dispatchId = str(row[COL_SHIP.DISPATCH_ID]);
      if (!senderName && !dispatchId) continue;

      items.push({
        rowNum: i + 2,
        dispatchId: dispatchId,
        dateCreated: str(row[COL_SHIP.DATE_CREATED]),
        dateTrip: str(row[COL_SHIP.DATE_TRIP]),
        autoNum: str(row[COL_SHIP.AUTO_NUM]),
        driver: str(row[COL_SHIP.DRIVER]),
        senderPhone: str(row[COL_SHIP.SENDER_PHONE]),
        senderName: senderName,
        recipientName: str(row[COL_SHIP.RECIPIENT_NAME]),
        recipientPhone: str(row[COL_SHIP.RECIPIENT_PHONE]),
        recipientAddr: str(row[COL_SHIP.RECIPIENT_ADDR]),
        internalNum: str(row[COL_SHIP.INTERNAL_NUM]),
        weight: str(row[COL_SHIP.WEIGHT]),
        description: str(row[COL_SHIP.DESCRIPTION]),
        photo: str(row[COL_SHIP.PHOTO]),
        amount: str(row[COL_SHIP.AMOUNT]),
        currency: str(row[COL_SHIP.CURRENCY]),
        deposit: str(row[COL_SHIP.DEPOSIT]),
        payForm: str(row[COL_SHIP.PAY_FORM]),
        payStatus: str(row[COL_SHIP.PAY_STATUS]),
        debt: str(row[COL_SHIP.DEBT]),
        status: str(row[COL_SHIP.STATUS]),
        pkgId: str(row[COL_SHIP.PKG_ID]),
        note: str(row[COL_SHIP.NOTE]),
        sheet: sheetName
      });
    }

    return { success: true, items: items, count: items.length, sheetName: sheetName };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// handleDriverStatusUpdate — водій змінює "Статус" (col AK)
// Шукає за ITEM_ID (PAX_ID / PKG_ID)
// ============================================
var VALID_STATUSES = ['pending', 'in-progress', 'completed', 'cancelled'];

function handleDriverStatusUpdate(data) {
  try {
    // Валідація статусу
    if (!data.status || VALID_STATUSES.indexOf(data.status) === -1) {
      return { success: false, error: 'Невалідний статус: ' + (data.status || '(пусто)') + '. Допустимі: ' + VALID_STATUSES.join(', ') };
    }

    // Валідація маршруту — дозволяємо тільки Маршрут_*
    if (!data.routeName || !/^Маршрут_\d+$/.test(data.routeName)) {
      return { success: false, error: 'Невалідний маршрут: ' + (data.routeName || '(пусто)') };
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var now = new Date();

    // Логуємо
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_LOGS);
      logSheet.getRange(1, 1, 1, 9).setValues([[
        'Дата', 'Час', 'Водій', 'Маршрут', 'ID запису',
        'Тип', 'Статус', 'Причина', 'Телефон'
      ]]);
      logSheet.getRange(1, 1, 1, 9)
        .setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }

    logSheet.appendRow([
      Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd'),
      Utilities.formatDate(now, 'Europe/Kiev', 'HH:mm:ss'),
      data.driverId || '',
      data.routeName || '',
      data.itemId || '',
      data.itemType || '',
      data.status || '',
      data.cancelReason || '',
      data.phone || ''
    ]);

    // Оновлюємо
    var routeSheet = ss.getSheetByName(data.routeName);
    if (!routeSheet) return { success: true, message: 'Логовано (маршрут не знайдено)' };

    var allData = routeSheet.getDataRange().getValues();
    var rowsUpdated = 0;
    var targetId = str(data.itemId);

    for (var i = 1; i < allData.length; i++) {
      var rowId = str(allData[i][COL.ITEM_ID]);
      if (rowId === targetId) {
        var rowNum = i + 1;

        routeSheet.getRange(rowNum, COL.STATUS + 1).setValue(data.status);

        if (data.status === 'cancelled' && data.cancelReason) {
          var currentNote = str(routeSheet.getRange(rowNum, COL.NOTE + 1).getValue());
          var newNote = 'Скасовано: ' + data.cancelReason + (currentNote ? ' | ' + currentNote : '');
          routeSheet.getRange(rowNum, COL.NOTE + 1).setValue(newNote);
        }

        var colors = STATUS_COLORS[data.status];
        if (colors) {
          var readCols = Math.min(routeSheet.getLastColumn(), TOTAL_COLS);
          var rangeToColor = routeSheet.getRange(rowNum, 1, 1, readCols);
          rangeToColor.setBackground(colors.bg);
          rangeToColor.setBorder(true, true, true, true, true, true, colors.border, SpreadsheetApp.BorderStyle.SOLID);
          var statusCell = routeSheet.getRange(rowNum, COL.STATUS + 1);
          statusCell.setFontColor(colors.font);
          statusCell.setFontWeight('bold');
        }

        rowsUpdated++;
        break;
      }
    }

    if (rowsUpdated === 0) return { success: true, message: 'Логовано (запис не знайдено)' };
    return { success: true, message: 'Статус записано', updatedRows: rowsUpdated };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// handleAddRouteItem — водій додає пасажира або посилку
// ============================================
function handleAddRouteItem(data) {
  try {
    var routeName = data.routeName;
    if (!routeName || !/^Маршрут_\d+$/.test(routeName)) {
      return { success: false, error: 'Невалідний маршрут: ' + (routeName || '(пусто)') };
    }

    var itemType = (data.itemType || '').toLowerCase();
    if (itemType !== 'пасажир' && itemType !== 'посилка') {
      return { success: false, error: 'Невалідний тип: ' + (data.itemType || '(пусто)') };
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(routeName);
    if (!sheet) return { success: false, error: 'Аркуш не знайдено: ' + routeName };

    var now = new Date();
    var dateStr = Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(now, 'Europe/Kiev', 'HH:mm:ss');

    // Генеруємо ID
    var prefix = itemType === 'пасажир' ? 'PAX' : 'PKG';
    var itemId = prefix + '_' + dateStr.replace(/-/g, '') + '_' + timeStr.replace(/:/g, '');

    // Створюємо рядок (50 колонок)
    var row = new Array(TOTAL_COLS).fill('');
    row[COL.TYPE] = itemType === 'пасажир' ? 'Пасажир' : 'Посилка';
    row[COL.ITEM_ID] = itemId;
    row[COL.DATE_CREATED] = dateStr;
    row[COL.DATE_TRIP] = data.dateTrip || '';
    row[COL.DRIVER] = data.driverName || '';
    row[COL.CITY] = data.city || '';
    row[COL.AMOUNT] = data.amount || '';
    row[COL.CURRENCY] = data.currency || 'UAH';
    row[COL.PAY_FORM] = data.payForm || '';
    row[COL.STATUS] = 'pending';
    row[COL.NOTE] = data.note || '';

    if (itemType === 'пасажир') {
      row[COL.PAX_NAME] = data.name || '';
      row[COL.PAX_PHONE] = data.phone || '';
      row[COL.ADDR_FROM] = data.addrFrom || '';
      row[COL.ADDR_TO] = data.addrTo || '';
      row[COL.SEATS_COUNT] = data.seatsCount || '1';
      row[COL.BAGGAGE_WEIGHT] = data.baggageWeight || '';
    } else {
      row[COL.SENDER_NAME] = data.senderName || '';
      row[COL.RECIPIENT_NAME] = data.recipientName || '';
      row[COL.RECIPIENT_PHONE] = data.recipientPhone || '';
      row[COL.RECIPIENT_ADDR] = data.recipientAddr || '';
      row[COL.PKG_DESC] = data.pkgDesc || '';
      row[COL.PKG_WEIGHT] = data.pkgWeight || '';
      row[COL.TTN] = data.ttn || '';
    }

    sheet.appendRow(row);

    // Логуємо
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (logSheet) {
      logSheet.appendRow([
        dateStr, timeStr, data.driverName || '', routeName, itemId,
        data.itemType || '', 'added', '', ''
      ]);
    }

    return { success: true, message: 'Додано ' + (itemType === 'пасажир' ? 'пасажира' : 'посилку'), itemId: itemId };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// ДОПОМІЖНІ
// ============================================
function str(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, 'Europe/Kiev', 'yyyy-MM-dd');
  }
  return String(value).trim();
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('BotiLogistics CRM')
    .addItem('Список маршрутів', 'menuRoutes')
    .addToUi();
}

function menuRoutes() {
  var r = getAvailableRoutes();
  var msg = 'Маршрути: ' + r.routes.length + '\n';
  for (var i = 0; i < r.routes.length; i++) msg += '  ' + r.routes[i].name + ' — ' + r.routes[i].count + '\n';
  msg += '\nВідправки: ' + r.shipping.length + '\n';
  for (var j = 0; j < r.shipping.length; j++) msg += '  ' + r.shipping[j].name + ' — ' + r.shipping[j].count + '\n';
  SpreadsheetApp.getUi().alert('Маршрути', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
