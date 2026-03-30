// ============================================
// BOTILOGISTICS DRIVERS CRM v1.0
// Apps Script API для таблиці "Logistics-marshrut-cargo"
// ============================================
//
// ІНСТРУКЦІЯ:
// 1. Завантаж xlsx на Google Sheets
// 2. Розширення → Apps Script → встав цей код
// 3. Deploy → New deployment → Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Скопіюй URL деплоя → встав в CRM config
// ============================================

// ============================================
// КОНФІГУРАЦІЯ
// ============================================

var SPREADSHEET_ID = '1Pd3nv3fbwZ_0YSzdG4cda-q52BQT57E0hDe7eQej6z8';

// Аркуш логів водіїв
var SHEET_LOGS = 'Логи водіїв';

// Кольори статусів
var STATUS_COLORS = {
  'pending':     { bg: '#fffbf0', border: '#ffc107', font: '#ffc107' },
  'in-progress': { bg: '#e3f2fd', border: '#2196F3', font: '#2196F3' },
  'completed':   { bg: '#e8f5e9', border: '#4CAF50', font: '#4CAF50' },
  'cancelled':   { bg: '#ffebee', border: '#dc3545', font: '#dc3545' }
};

// ============================================
// КОЛОНКИ — ОТРИМАННЯ (Маршрут 1/2/3)
// Відповідає структурі xlsx:
// A:Напрямок B:ТТН C:Вага D:Адреса E:Телефон
// F:Сума G:Статус оплати H:Оплата I:Тел.реєстратора
// J:Примітка K:Статус посилки L:ІД M:ПіБ
// N:Дата оформлення O:Таймінг P:Примітка смс
// Q:Дата отримання R:Фото S:Статус T:Автомобіль
// U:company_id V:Дата архів W:ARCHIVE_ID
// ============================================
var COL = {
  DIRECTION: 0,     // A — Напрямок
  TTN: 1,           // B — Номер ТТН
  WEIGHT: 2,        // C — Вага
  ADDRESS: 3,       // D — Адреса Отримувача
  PHONE: 4,         // E — Телефон Отримувача
  AMOUNT: 5,        // F — Сума Є
  PAY_STATUS: 6,    // G — Статус оплати
  PAYMENT: 7,       // H — Оплата
  PHONE_REG: 8,     // I — Телефон Реєстратора
  NOTE: 9,          // J — Примітка
  PARCEL_STATUS: 10,// K — Статус посилки (pending/in-progress/completed/cancelled)
  ID: 11,           // L — ІД
  NAME: 12,         // M — ПіБ
  DATE_REG: 13,     // N — Дата оформлення
  TIMING: 14,       // O — Таймінг
  SMS_NOTE: 15,     // P — Примітка смс
  DATE_RECEIVE: 16, // Q — Дата отримання
  PHOTO: 17,        // R — Фото
  STATUS: 18,       // S — Статус (CRM: new/work тощо)
  VEHICLE: 19,      // T — Автомобіль
  COMPANY_ID: 20,   // U — company_id
  DATE_ARCHIVE: 21, // V — Дата архів
  ARCHIVE_ID: 22    // W — ARCHIVE_ID
};
var TOTAL_COLS = 23;

var HEADERS_RECEIVING = [
  'Напрямок', 'Номер ТТН', 'Вага', 'Адреса Отримувача',
  'Телефон Отримувача', 'Сума Є', 'Статус оплати', 'Оплата',
  'Телефон Реєстратора', 'Примітка', 'Статус посилки', 'ІД', 'ПіБ',
  'дата оформлення', 'Таймінг', 'Примітка смс', 'Дата отримання',
  'фото', 'Статус', 'Автомобіль', 'company_id', 'Дата архів', 'ARCHIVE_ID'
];

// ============================================
// КОЛОНКИ — ВІДПРАВЛЕННЯ (Маршрут X (відпр))
// A:ПІБ B:№ посилки C:Місто/НП D:Опис/фото E:Вага
// F:Сума G:Тип оплати H:Валюта I:Конверт
// J:ID/Телефон відправника K:company_id
// ============================================
var COL_SHIP = {
  NAME: 0,        // A — ПІБ
  NUMBER: 1,      // B — № посилки
  CITY: 2,        // C — Місто/Нова Пошта
  DESCRIPTION: 3, // D — Опис/фото
  WEIGHT: 4,      // E — Вага
  AMOUNT: 5,      // F — Сума
  PAY_TYPE: 6,    // G — Тип оплати
  CURRENCY: 7,    // H — Валюта
  ENVELOPE: 8,    // I — Конверт
  PHONE: 9,       // J — ID/Телефон відправника
  COMPANY_ID: 10  // K — company_id
};
var TOTAL_COLS_SHIP = 11;

// Суфікс відправлень
var SHIPPING_SUFFIX = '(відпр)';

// Статуси для архівації
var ARCHIVE_STATUSES = ['archived', 'refused', 'deleted', 'transferred'];

// ============================================
// doGet — GET запити
// ============================================
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'health';
    var sheet = (e && e.parameter) ? (e.parameter.sheet || '') : '';

    switch (action) {
      case 'health':
        return respond({
          success: true,
          version: '1.0',
          service: 'BotiLogistics Drivers CRM',
          timestamp: new Date().toISOString()
        });

      case 'getDeliveries':
        if (!sheet) return respond({ success: false, error: 'Не вказано маршрут (sheet)' });
        return respond(getDeliveries(sheet));

      case 'getShippingItems':
        if (!sheet) return respond({ success: false, error: 'Не вказано маршрут (sheet)' });
        return respond(getShippingItems(sheet));

      case 'getAvailableRoutes':
        return respond(getAvailableRoutes());

      default:
        return respond({ success: false, error: 'Невідома GET дія: ' + action });
    }
  } catch (err) {
    return respond({ success: false, error: err.toString() });
  }
}

// ============================================
// doPost — POST запити
// ============================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var payload = data.payload || data;

    switch (action) {
      case 'getDeliveries':
      case 'getRoutePassengers':
      case 'getRoutePackages':
        return respond(getDeliveries(payload.sheetName || payload.vehicleName || ''));

      case 'getShippingItems':
        return respond(getShippingItems(payload.sheetName || ''));

      case 'getAvailableRoutes':
        return respond(getAvailableRoutes());

      case 'updateDriverStatus':
        return respond(handleDriverStatusUpdate(data));

      case 'addPackageToRoute':
        return respond(addPackageToRoute(payload));

      default:
        return respond({ success: false, error: 'Невідома дія: ' + action });
    }
  } catch (err) {
    return respond({ success: false, error: err.toString() });
  }
}

// ============================================
// getAvailableRoutes — Динамічний список маршрутів
// Розділяє на receiving (отримання) та shipping (відправлення)
// ============================================
function getAvailableRoutes() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheets = ss.getSheets();
    var receiving = [];
    var shipping = [];

    var excludePatterns = ['логи', 'logs', 'водіїв', 'template', 'шаблон'];

    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName();
      var nameLower = name.toLowerCase().trim();

      var isExcluded = false;
      for (var e = 0; e < excludePatterns.length; e++) {
        if (nameLower.indexOf(excludePatterns[e]) !== -1) {
          isExcluded = true;
          break;
        }
      }
      if (isExcluded) continue;

      var count = Math.max(0, sheets[i].getLastRow() - 1);

      if (name.indexOf(SHIPPING_SUFFIX) !== -1) {
        shipping.push({
          name: name,
          label: name.replace(SHIPPING_SUFFIX, '').trim(),
          count: count
        });
      } else {
        receiving.push({
          name: name,
          count: count
        });
      }
    }

    return {
      success: true,
      routes: receiving,
      shipping: shipping,
      totalReceiving: receiving.length,
      totalShipping: shipping.length
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// getDeliveries — Посилки отримання для водія
// ============================================
function getDeliveries(sheetName) {
  try {
    if (!sheetName) return { success: false, error: 'Не вказано маршрут' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, error: 'Аркуш не знайдено: ' + sheetName };
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, deliveries: [], packages: [], passengers: [], count: 0, sheetName: sheetName };
    }

    var readCols = Math.min(sheet.getLastColumn(), TOTAL_COLS);
    var data = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();
    var deliveries = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var id = str(row[COL.ID]);
      var address = str(row[COL.ADDRESS]);
      if (!id && !address && !str(row[COL.NAME])) continue;

      var crmStatus = str(row[COL.STATUS]).toLowerCase();
      if (ARCHIVE_STATUSES.indexOf(crmStatus) !== -1) continue;

      deliveries.push({
        rowNum: i + 2,
        direction: str(row[COL.DIRECTION]),
        ttn: str(row[COL.TTN]),
        weight: str(row[COL.WEIGHT]),
        address: address,
        phone: str(row[COL.PHONE]),
        price: str(row[COL.AMOUNT]),
        paymentStatus: str(row[COL.PAY_STATUS]),
        payment: str(row[COL.PAYMENT]),
        registrarPhone: str(row[COL.PHONE_REG]),
        note: str(row[COL.NOTE]),
        parcelStatus: str(row[COL.PARCEL_STATUS]) || 'pending',
        id: id,
        internalNumber: id,
        name: str(row[COL.NAME]),
        createdAt: str(row[COL.DATE_REG]),
        timing: str(row[COL.TIMING]),
        smsNote: str(row[COL.SMS_NOTE]),
        receiveDate: str(row[COL.DATE_RECEIVE]),
        photo: str(row[COL.PHOTO]),
        status: crmStatus || 'new',
        vehicle: str(row[COL.VEHICLE]),
        sheet: sheetName
      });
    }

    var stats = { total: deliveries.length, pending: 0, inProgress: 0, completed: 0, cancelled: 0 };
    for (var j = 0; j < deliveries.length; j++) {
      var ps = (deliveries[j].parcelStatus || 'pending').toLowerCase();
      if (ps === 'pending') stats.pending++;
      else if (ps === 'in-progress') stats.inProgress++;
      else if (ps === 'completed') stats.completed++;
      else if (ps === 'cancelled') stats.cancelled++;
    }

    return {
      success: true,
      deliveries: deliveries,
      packages: deliveries,
      passengers: deliveries,
      count: deliveries.length,
      sheetName: sheetName,
      stats: stats
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// getShippingItems — Посилки відправлення (read-only)
// ============================================
function getShippingItems(sheetName) {
  try {
    if (!sheetName) return { success: false, error: 'Не вказано маршрут' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, error: 'Аркуш не знайдено: ' + sheetName };
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, items: [], count: 0, sheetName: sheetName };
    }

    var readCols = Math.min(sheet.getLastColumn(), TOTAL_COLS_SHIP);
    var data = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();
    var items = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var name = str(row[COL_SHIP.NAME]);
      var number = str(row[COL_SHIP.NUMBER]);
      if (!name && !number) continue;

      items.push({
        rowNum: i + 2,
        name: name,
        number: number,
        city: str(row[COL_SHIP.CITY]),
        description: str(row[COL_SHIP.DESCRIPTION]),
        weight: str(row[COL_SHIP.WEIGHT]),
        amount: str(row[COL_SHIP.AMOUNT]),
        payType: str(row[COL_SHIP.PAY_TYPE]),
        currency: str(row[COL_SHIP.CURRENCY]),
        envelope: str(row[COL_SHIP.ENVELOPE]),
        phone: str(row[COL_SHIP.PHONE]),
        sheet: sheetName
      });
    }

    return {
      success: true,
      items: items,
      count: items.length,
      sheetName: sheetName
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// handleDriverStatusUpdate — Оновлення статусу від водія
// Шукає за ІД посилки
// ============================================
function handleDriverStatusUpdate(data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var now = new Date();

    // 1. Логуємо
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_LOGS);
      logSheet.getRange(1, 1, 1, 9).setValues([[
        'Дата', 'Час', 'Водій', 'Маршрут', 'ІД посилки',
        'Адреса', 'Статус', 'Причина скасування', 'Телефон'
      ]]);
      logSheet.getRange(1, 1, 1, 9)
        .setBackground('#1a1a2e')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }

    logSheet.appendRow([
      Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd'),
      Utilities.formatDate(now, 'Europe/Kiev', 'HH:mm:ss'),
      data.driverId || '',
      data.routeName || '',
      data.deliveryId || data.deliveryNumber || '',
      data.address || '',
      data.status || '',
      data.cancelReason || '',
      data.phone || ''
    ]);

    // 2. Оновлюємо в маршрутному аркуші
    var routeSheet = ss.getSheetByName(data.routeName);
    if (!routeSheet) {
      return { success: true, message: 'Логовано (маршрут не знайдено)' };
    }

    var allData = routeSheet.getDataRange().getValues();
    var rowsUpdated = 0;
    var deliveryId = str(data.deliveryId || data.deliveryNumber);

    for (var i = 1; i < allData.length; i++) {
      var rowId = str(allData[i][COL.ID]);
      if (rowId === deliveryId) {
        var rowNum = i + 1;

        // Статус посилки (K)
        routeSheet.getRange(rowNum, COL.PARCEL_STATUS + 1).setValue(data.status);

        // Completed → дата отримання
        if (data.status === 'completed') {
          routeSheet.getRange(rowNum, COL.DATE_RECEIVE + 1).setValue(
            Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd HH:mm')
          );
        }

        // Cancelled → причина в примітку
        if (data.status === 'cancelled' && data.cancelReason) {
          var currentNote = str(routeSheet.getRange(rowNum, COL.NOTE + 1).getValue());
          var newNote = 'Скасовано: ' + data.cancelReason + (currentNote ? ' | ' + currentNote : '');
          routeSheet.getRange(rowNum, COL.NOTE + 1).setValue(newNote);
        }

        // Кольори рядка
        var colors = STATUS_COLORS[data.status];
        if (colors) {
          var readCols = Math.min(routeSheet.getLastColumn(), TOTAL_COLS);
          var rangeToColor = routeSheet.getRange(rowNum, 1, 1, readCols);
          rangeToColor.setBackground(colors.bg);
          rangeToColor.setBorder(true, true, true, true, true, true,
            colors.border, SpreadsheetApp.BorderStyle.SOLID);

          var statusCell = routeSheet.getRange(rowNum, COL.PARCEL_STATUS + 1);
          statusCell.setFontColor(colors.font);
          statusCell.setFontWeight('bold');
        }

        rowsUpdated++;
        break;
      }
    }

    if (rowsUpdated === 0) {
      return { success: true, message: 'Логовано (посилку не знайдено в маршруті)' };
    }

    return { success: true, message: 'Статус записано', updatedRows: rowsUpdated };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// addPackageToRoute — Додати посилку від водія
// ============================================
function addPackageToRoute(payload) {
  try {
    var sheetName = payload.sheetName || payload.vehicleName || '';
    if (!sheetName) return { success: false, error: 'Не вказано маршрут' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, HEADERS_RECEIVING.length).setValues([HEADERS_RECEIVING]);
      sheet.getRange(1, 1, 1, HEADERS_RECEIVING.length)
        .setBackground('#1a1a2e')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    var id = 'crm_' + new Date().getTime();
    var newRow = new Array(TOTAL_COLS);
    for (var c = 0; c < TOTAL_COLS; c++) newRow[c] = '';

    newRow[COL.DIRECTION] = sheetName;
    newRow[COL.TTN] = payload.ttn || '';
    newRow[COL.WEIGHT] = payload.weight || '';
    newRow[COL.ADDRESS] = payload.address || '';
    newRow[COL.PHONE] = payload.phone || '';
    newRow[COL.AMOUNT] = payload.amount || payload.price || '';
    newRow[COL.NOTE] = payload.note || '';
    newRow[COL.PARCEL_STATUS] = 'pending';
    newRow[COL.ID] = id;
    newRow[COL.NAME] = payload.name || '';
    newRow[COL.DATE_REG] = Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd');
    newRow[COL.STATUS] = 'new';
    newRow[COL.VEHICLE] = sheetName;

    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, 1, TOTAL_COLS).setValues([newRow]);

    var pendingColors = STATUS_COLORS['pending'];
    if (pendingColors) {
      sheet.getRange(startRow, 1, 1, TOTAL_COLS).setBackground(pendingColors.bg);
    }

    return { success: true, id: id, rowNum: startRow, sheetName: sheetName };
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
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// МЕНЮ В GOOGLE SHEETS
// ============================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('BotiLogistics CRM')
    .addItem('Список маршрутів', 'menuAvailableRoutes')
    .addToUi();
}

function menuAvailableRoutes() {
  var result = getAvailableRoutes();
  var msg = 'Отримання: ' + result.totalReceiving + '\n';
  for (var i = 0; i < result.routes.length; i++) {
    msg += '  ' + result.routes[i].name + ' — ' + result.routes[i].count + ' записів\n';
  }
  msg += '\nВідправлення: ' + result.totalShipping + '\n';
  for (var j = 0; j < result.shipping.length; j++) {
    msg += '  ' + result.shipping[j].name + ' — ' + result.shipping[j].count + ' записів\n';
  }
  SpreadsheetApp.getUi().alert('Маршрути', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
