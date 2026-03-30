// ============================================
// BOTILOGISTICS DRIVERS CRM — ПАСАЖИРИ v1.0
// Apps Script API для таблиці "Маршрут Пасажири"
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

var SPREADSHEET_ID = '1fYO1ClIP26S4xYgcsT_0LVCWVrqkAL5MkehXvL-Yni0';

var SHEET_LOGS = 'Логи';

var STATUS_COLORS = {
  'pending':     { bg: '#fffbf0', border: '#ffc107', font: '#ffc107' },
  'in-progress': { bg: '#e3f2fd', border: '#2196F3', font: '#2196F3' },
  'completed':   { bg: '#e8f5e9', border: '#4CAF50', font: '#4CAF50' },
  'cancelled':   { bg: '#ffebee', border: '#dc3545', font: '#dc3545' }
};

// ============================================
// КОЛОНКИ — Пасажири
// A:Дата виїзду B:Адреса Відправки C:Адреса прибуття D:Місця
// E:ПіБ F:Телефон G:Відмітка H:Оплата I:Відсоток
// J:Диспечер K:ІД L:Тел.реєстратора M:Вага N:Автомобіль
// O:Таймінг P:дата оформлення Q:Примітка R:Статус
// S:DATE_ARCHIVE T:ARCHIVED_BY U:ARCHIVE_REASON
// V:SOURCE_SHEET W:ARCHIVE_ID X:company_id
// ============================================
var COL = {
  DATE: 0,            // A
  FROM: 1,            // B
  TO: 2,              // C
  SEATS: 3,           // D
  NAME: 4,            // E
  PHONE: 5,           // F
  MARK: 6,            // G — Відмітка (driver mark)
  PAYMENT: 7,         // H
  PERCENT: 8,         // I
  DISPATCHER: 9,      // J
  ID: 10,             // K
  PHONE_REG: 11,      // L
  WEIGHT: 12,         // M
  VEHICLE: 13,        // N
  TIMING: 14,         // O
  DATE_REG: 15,       // P
  NOTE: 16,           // Q
  STATUS: 17,         // R — Статус CRM
  DATE_ARCHIVE: 18,   // S
  ARCHIVED_BY: 19,    // T
  ARCHIVE_REASON: 20, // U
  SOURCE_SHEET: 21,   // V
  ARCHIVE_ID: 22,     // W
  COMPANY_ID: 23      // X
};
var TOTAL_COLS = 24;

var HEADERS = [
  'Дата виїзду', 'Адреса Відправки!', 'Адреса прибуття', 'Кількість місць',
  'ПіБ', 'Телефон Пасажира', 'Відмітка', 'Оплата', 'Відсоток',
  'Диспечер', 'ІД', 'Телефон Реєстратора', 'Вага', 'Автомобіль',
  'Таймінг', 'дата оформлення', 'Примітка',
  'Статус', 'DATE_ARCHIVE', 'ARCHIVED_BY', 'ARCHIVE_REASON',
  'SOURCE_SHEET', 'ARCHIVE_ID', 'company_id'
];

var ARCHIVE_STATUSES = ['archived', 'refused', 'deleted', 'transferred'];
var EXCLUDE_SHEETS = ['логи', 'провірка розсилки', 'logs'];

// ============================================
// doGet
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
          service: 'BotiLogistics Passengers CRM',
          timestamp: new Date().toISOString()
        });

      case 'getPassengers':
        if (!sheet) return respond({ success: false, error: 'Не вказано маршрут (sheet)' });
        return respond(getPassengers(sheet));

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
// doPost
// ============================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var payload = data.payload || data;

    switch (action) {
      case 'getPassengers':
      case 'getRoutePassengers':
        return respond(getPassengers(payload.sheetName || payload.vehicleName || ''));

      case 'getAvailableRoutes':
        return respond(getAvailableRoutes());

      case 'updateDriverStatus':
        return respond(handleDriverStatusUpdate(data));

      case 'addPassengerToRoute':
        return respond(addPassengerToRoute(payload));

      case 'copyToRoute':
        return respond(copyToRoute(payload));

      case 'deleteRoutePassenger':
        return respond(deleteRoutePassenger(payload));

      default:
        return respond({ success: false, error: 'Невідома дія: ' + action });
    }
  } catch (err) {
    return respond({ success: false, error: err.toString() });
  }
}

// ============================================
// getAvailableRoutes
// ============================================
function getAvailableRoutes() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheets = ss.getSheets();
    var routes = [];

    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName();
      var nameLower = name.toLowerCase().trim();

      var isExcluded = false;
      for (var e = 0; e < EXCLUDE_SHEETS.length; e++) {
        if (nameLower.indexOf(EXCLUDE_SHEETS[e]) !== -1) {
          isExcluded = true;
          break;
        }
      }
      if (isExcluded) continue;

      var count = Math.max(0, sheets[i].getLastRow() - 1);
      routes.push({ name: name, count: count });
    }

    return { success: true, routes: routes, count: routes.length };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// getPassengers
// ============================================
function getPassengers(sheetName) {
  try {
    if (!sheetName) return { success: false, error: 'Не вказано маршрут' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, error: 'Аркуш не знайдено: ' + sheetName };
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, passengers: [], count: 0, sheetName: sheetName };
    }

    var readCols = Math.min(sheet.getLastColumn(), TOTAL_COLS);
    var data = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();
    var passengers = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var name = str(row[COL.NAME]);
      var phone = str(row[COL.PHONE]);
      var id = str(row[COL.ID]);
      if (!name && !phone && !id) continue;

      var crmStatus = str(row[COL.STATUS]).toLowerCase();
      if (ARCHIVE_STATUSES.indexOf(crmStatus) !== -1) continue;

      var driverStatus = str(row[COL.MARK]).toLowerCase();
      if (!driverStatus || ['pending', 'in-progress', 'completed', 'cancelled'].indexOf(driverStatus) === -1) {
        driverStatus = 'pending';
      }

      passengers.push({
        rowNum: i + 2,
        date: str(row[COL.DATE]),
        from: str(row[COL.FROM]),
        to: str(row[COL.TO]),
        seats: str(row[COL.SEATS]),
        name: name,
        phone: phone,
        mark: str(row[COL.MARK]),
        payment: str(row[COL.PAYMENT]),
        percent: str(row[COL.PERCENT]),
        dispatcher: str(row[COL.DISPATCHER]),
        id: id,
        phoneReg: str(row[COL.PHONE_REG]),
        weight: str(row[COL.WEIGHT]),
        vehicle: str(row[COL.VEHICLE]),
        timing: str(row[COL.TIMING]),
        dateReg: str(row[COL.DATE_REG]),
        note: str(row[COL.NOTE]),
        driverStatus: driverStatus,
        sheet: sheetName
      });
    }

    return {
      success: true,
      passengers: passengers,
      count: passengers.length,
      sheetName: sheetName
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// handleDriverStatusUpdate
// ============================================
function handleDriverStatusUpdate(data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var now = new Date();

    // Логуємо
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_LOGS);
      logSheet.getRange(1, 1, 1, 8).setValues([[
        'Дата', 'Час', 'Водій', 'Маршрут', 'ІД пасажира',
        'Адреса', 'Статус', 'Причина'
      ]]);
      logSheet.getRange(1, 1, 1, 8)
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
      data.passengerId || '',
      data.address || '',
      data.status || '',
      data.cancelReason || ''
    ]);

    // Оновлюємо в маршрутному аркуші
    var routeSheet = ss.getSheetByName(data.routeName);
    if (!routeSheet) {
      return { success: true, message: 'Логовано (маршрут не знайдено)' };
    }

    var allData = routeSheet.getDataRange().getValues();
    var rowsUpdated = 0;
    var passengerId = str(data.passengerId);
    var passengerPhone = str(data.phone);

    for (var i = 1; i < allData.length; i++) {
      var rowId = str(allData[i][COL.ID]);
      var rowPhone = str(allData[i][COL.PHONE]);

      if ((passengerId && rowId === passengerId) || (!passengerId && passengerPhone && rowPhone === passengerPhone)) {
        var rowNum = i + 1;

        // Відмітка водія (G)
        routeSheet.getRange(rowNum, COL.MARK + 1).setValue(data.status);

        // Cancelled → причина в примітку
        if (data.status === 'cancelled' && data.cancelReason) {
          var currentNote = str(routeSheet.getRange(rowNum, COL.NOTE + 1).getValue());
          var newNote = 'Скасовано: ' + data.cancelReason + (currentNote ? ' | ' + currentNote : '');
          routeSheet.getRange(rowNum, COL.NOTE + 1).setValue(newNote);
        }

        // Кольори
        var colors = STATUS_COLORS[data.status];
        if (colors) {
          var readCols = Math.min(routeSheet.getLastColumn(), TOTAL_COLS);
          var rangeToColor = routeSheet.getRange(rowNum, 1, 1, readCols);
          rangeToColor.setBackground(colors.bg);
          rangeToColor.setBorder(true, true, true, true, true, true,
            colors.border, SpreadsheetApp.BorderStyle.SOLID);

          var markCell = routeSheet.getRange(rowNum, COL.MARK + 1);
          markCell.setFontColor(colors.font);
          markCell.setFontWeight('bold');
        }

        rowsUpdated++;
        break;
      }
    }

    if (rowsUpdated === 0) {
      return { success: true, message: 'Логовано (пасажира не знайдено)' };
    }

    return { success: true, message: 'Статус записано', updatedRows: rowsUpdated };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// addPassengerToRoute
// ============================================
function addPassengerToRoute(payload) {
  try {
    var sheetName = payload.sheetName || '';
    if (!sheetName) return { success: false, error: 'Не вказано маршрут' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setBackground('#1a1a2e')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    var id = 'CRM-' + Math.floor(Math.random() * 100000);
    var newRow = new Array(TOTAL_COLS);
    for (var c = 0; c < TOTAL_COLS; c++) newRow[c] = '';

    newRow[COL.DATE] = payload.date || '';
    newRow[COL.FROM] = payload.from || '';
    newRow[COL.TO] = payload.to || '';
    newRow[COL.SEATS] = payload.seats || 1;
    newRow[COL.NAME] = payload.name || '';
    newRow[COL.PHONE] = payload.phone || '';
    newRow[COL.PAYMENT] = payload.payment || '';
    newRow[COL.NOTE] = payload.note || '';
    newRow[COL.ID] = id;
    newRow[COL.VEHICLE] = sheetName;
    newRow[COL.DATE_REG] = Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd');
    newRow[COL.STATUS] = 'new';

    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, 1, TOTAL_COLS).setValues([newRow]);

    return { success: true, id: id, rowNum: startRow, sheetName: sheetName };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// copyToRoute — перенесення пасажира
// ============================================
function copyToRoute(payload) {
  try {
    var passengersByVehicle = payload.passengersByVehicle;
    if (!passengersByVehicle) return { success: false, error: 'Немає даних' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var totalCopied = 0;

    for (var vehicleName in passengersByVehicle) {
      if (!passengersByVehicle.hasOwnProperty(vehicleName)) continue;
      var passengers = passengersByVehicle[vehicleName];
      if (!passengers || !passengers.length) continue;

      var sheet = ss.getSheetByName(vehicleName);
      if (!sheet) {
        sheet = ss.insertSheet(vehicleName);
        sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
        sheet.getRange(1, 1, 1, HEADERS.length)
          .setBackground('#1a1a2e')
          .setFontColor('#ffffff')
          .setFontWeight('bold');
        sheet.setFrozenRows(1);
      }

      var rows = [];
      for (var p = 0; p < passengers.length; p++) {
        var pax = passengers[p];
        var newRow = new Array(TOTAL_COLS);
        for (var c = 0; c < TOTAL_COLS; c++) newRow[c] = '';

        newRow[COL.DATE] = pax.date || '';
        newRow[COL.FROM] = pax.from || '';
        newRow[COL.TO] = pax.to || '';
        newRow[COL.SEATS] = pax.seats || 1;
        newRow[COL.NAME] = pax.name || '';
        newRow[COL.PHONE] = pax.phone || '';
        newRow[COL.MARK] = pax.mark || '';
        newRow[COL.PAYMENT] = pax.payment || '';
        newRow[COL.PERCENT] = pax.percent || '';
        newRow[COL.DISPATCHER] = pax.dispatcher || '';
        newRow[COL.ID] = pax.id || '';
        newRow[COL.PHONE_REG] = pax.phoneReg || '';
        newRow[COL.WEIGHT] = pax.weight || '';
        newRow[COL.TIMING] = pax.timing || '';
        newRow[COL.DATE_REG] = pax.dateReg || '';
        newRow[COL.NOTE] = pax.note || '';
        newRow[COL.STATUS] = 'new';
        newRow[COL.SOURCE_SHEET] = pax.sourceSheet || '';

        rows.push(newRow);
      }

      if (rows.length > 0) {
        var startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rows.length, TOTAL_COLS).setValues(rows);
        totalCopied += rows.length;
      }
    }

    return { success: true, copied: totalCopied };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// deleteRoutePassenger
// ============================================
function deleteRoutePassenger(payload) {
  try {
    var sheetName = payload.sheetName || '';
    var rowNum = parseInt(payload.rowNum);
    var expectedId = str(payload.expectedId);

    if (!sheetName || !rowNum) return { success: false, error: 'Не вказано sheet/rowNum' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'Аркуш не знайдено' };

    if (expectedId) {
      var currentId = str(sheet.getRange(rowNum, COL.ID + 1).getValue());
      if (currentId !== expectedId) {
        return { success: false, error: 'conflict', message: 'Рядок змінився' };
      }
    }

    sheet.deleteRow(rowNum);
    return { success: true, deleted: true };
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
// МЕНЮ
// ============================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('BotiLogistics Пасажири')
    .addItem('Список маршрутів', 'menuRoutes')
    .addToUi();
}

function menuRoutes() {
  var result = getAvailableRoutes();
  var msg = 'Маршрутів: ' + result.count + '\n\n';
  for (var i = 0; i < result.routes.length; i++) {
    msg += result.routes[i].name + ' — ' + result.routes[i].count + ' записів\n';
  }
  SpreadsheetApp.getUi().alert('Маршрути', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
