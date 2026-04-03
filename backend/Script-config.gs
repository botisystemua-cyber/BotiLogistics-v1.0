/**
 * Script-config.gs — Backend для config-crm (авторизація)
 * Google Apps Script + Google Sheets (Config таблиця)
 *
 * Аркуші:
 *   Власник   — обліковки власників
 *   Персонал  — обліковки водіїв та менеджерів
 *   Лог доступів — журнал входів
 *
 * Хешування: SHA-256 через Utilities.computeDigest
 */

// ── Spreadsheet ID Config таблиці (замінити на реальний) ──
var CONFIG_SS_ID = '1GEVqqWCvOZG_RNmVrIGwlrW9d-yjXlXi-v7hX_z5-kc';

// ── Стовпці аркуша «Власник» ──
var OWN = {
  USER_ID: 0, NAME: 1, PHONE: 2, EMAIL: 3,
  LOGIN: 4, PASSWORD_HASH: 5, TOKEN: 6, ROLE: 7,
  TABLES: 8, TWO_FA: 9, STATUS: 10, DATE_CREATED: 11,
  LAST_ACTIVE: 12, DATE_PWD_CHANGE: 13, NOTE: 14
};

// ── Стовпці аркуша «Персонал» ──
var STF = {
  STAFF_ID: 0, NAME: 1, PHONE: 2, EMAIL: 3,
  ROLE: 4, LOGIN: 5, PASSWORD_HASH: 6, CITY: 7,
  AUTO_ID: 8, AUTO_NUM: 9, RATE: 10, RATE_CUR: 11,
  STATUS: 12, DATE_HIRED: 13, LAST_ACTIVE: 14, NOTE: 15
};

// ── Стовпці аркуша «Лог доступів» ──
var LOG = {
  LOG_ID: 0, USER_ID: 1, NAME: 2, ROLE: 3,
  ACTION: 4, TABLE: 5, SHEET: 6, IP: 7,
  DEVICE: 8, DATETIME: 9, STATUS: 10, NOTE: 11
};

// ========================================
// Хешування паролю (SHA-256 → hex)
// ========================================
function hashPassword(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return digest.map(function(b) {
    var hex = (b < 0 ? b + 256 : b).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// ========================================
// Отримати всі дані аркуша
// ========================================
function getSheetData(sheetName) {
  var ss = SpreadsheetApp.openById(CONFIG_SS_ID);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { headers: [], data: [] };
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { headers: [], data: [] };
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
  var data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return { headers: headers, data: data };
}

// ========================================
// Логування входу
// ========================================
function logAccess(userId, name, role, action, status, note) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG_SS_ID);
    var sh = ss.getSheetByName('Лог доступів');
    if (!sh) return;
    var now = new Date();
    var logId = 'LOG-ACC-' + Utilities.formatDate(now, 'Europe/Kiev', 'yyyyMMddHHmmss');
    sh.appendRow([
      logId, userId, name, role, action,
      '', '', '', '', // table, sheet, IP, device — заповнюються клієнтом або не потрібні
      Utilities.formatDate(now, 'Europe/Kiev', 'dd.MM.yyyy HH:mm:ss'),
      status, note || ''
    ]);
  } catch (e) {
    // Не кидаємо помилку — логування не повинно ламати логін
  }
}

// ========================================
// Оновити «Остання активність»
// ========================================
function updateLastActive(sheetName, colIdx, loginValue, loginCol) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG_SS_ID);
    var sh = ss.getSheetByName(sheetName);
    if (!sh) return;
    var data = sh.getDataRange().getValues();
    var now = Utilities.formatDate(new Date(), 'Europe/Kiev', 'dd.MM.yyyy HH:mm');
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][loginCol]).trim() === loginValue) {
        sh.getRange(i + 1, colIdx + 1).setValue(now);
        break;
      }
    }
  } catch (e) { /* ігноруємо */ }
}

// ========================================
// Обробка логіну
// ========================================
function handleLogin(params) {
  var role = String(params.role || '').toLowerCase().trim();
  var loginInput = String(params.login || '').trim();
  var passwordInput = String(params.password || '').trim();

  if (!loginInput || !passwordInput) {
    return { success: false, error: 'Логін та пароль обов\'язкові' };
  }

  var passwordHash = hashPassword(passwordInput);

  // ── Власник ──
  if (role === 'owner') {
    var ownData = getSheetData('Власник');
    for (var i = 0; i < ownData.data.length; i++) {
      var row = ownData.data[i];
      var rowLogin = String(row[OWN.LOGIN]).trim();
      var rowHash = String(row[OWN.PASSWORD_HASH]).trim();
      var rowStatus = String(row[OWN.STATUS]).trim();

      if (rowLogin === loginInput) {
        if (rowStatus !== 'Активний') {
          logAccess(row[OWN.USER_ID], row[OWN.NAME], 'Власник', 'Вхід в систему', 'Заблоковано', 'Акаунт неактивний');
          return { success: false, error: 'Акаунт деактивовано' };
        }
        if (rowHash === passwordHash) {
          logAccess(row[OWN.USER_ID], row[OWN.NAME], 'Власник', 'Вхід в систему', 'Успішно', '');
          updateLastActive('Власник', OWN.LAST_ACTIVE, loginInput, OWN.LOGIN);
          return {
            success: true,
            user: {
              name: String(row[OWN.NAME]).trim(),
              role: 'Власник',
              staffId: String(row[OWN.USER_ID]).trim()
            }
          };
        } else {
          logAccess(row[OWN.USER_ID], row[OWN.NAME], 'Власник', 'Невдала спроба входу', 'Помилка', 'Невірний пароль');
          return { success: false, error: 'Невірний пароль' };
        }
      }
    }
    logAccess('???', loginInput, 'Власник', 'Невдала спроба входу', 'Помилка', 'Логін не знайдено');
    return { success: false, error: 'Користувача не знайдено' };
  }

  // ── Менеджер / Водій ──
  if (role === 'manager' || role === 'driver') {
    var expectedRole = role === 'manager' ? 'Менеджер' : 'Водій';
    var stfData = getSheetData('Персонал');

    for (var j = 0; j < stfData.data.length; j++) {
      var srow = stfData.data[j];
      var sLogin = String(srow[STF.LOGIN]).trim();
      var sHash = String(srow[STF.PASSWORD_HASH]).trim();
      var sRole = String(srow[STF.ROLE]).trim();
      var sStatus = String(srow[STF.STATUS]).trim();

      if (sLogin === loginInput) {
        // Перевірка ролі
        if (sRole !== expectedRole) {
          logAccess(srow[STF.STAFF_ID], srow[STF.NAME], sRole, 'Невдала спроба входу', 'Помилка', 'Невірна роль: обрано ' + expectedRole);
          return { success: false, error: 'Невірна роль. Ви зареєстровані як ' + sRole };
        }

        if (sStatus !== 'Активний') {
          logAccess(srow[STF.STAFF_ID], srow[STF.NAME], sRole, 'Вхід в систему', 'Заблоковано', 'Акаунт неактивний');
          return { success: false, error: 'Акаунт деактивовано' };
        }

        if (sHash === passwordHash) {
          logAccess(srow[STF.STAFF_ID], srow[STF.NAME], sRole, 'Вхід в систему', 'Успішно', '');
          updateLastActive('Персонал', STF.LAST_ACTIVE, loginInput, STF.LOGIN);
          return {
            success: true,
            user: {
              name: String(srow[STF.NAME]).trim(),
              role: sRole,
              staffId: String(srow[STF.STAFF_ID]).trim()
            }
          };
        } else {
          logAccess(srow[STF.STAFF_ID], srow[STF.NAME], sRole, 'Невдала спроба входу', 'Помилка', 'Невірний пароль');
          return { success: false, error: 'Невірний пароль' };
        }
      }
    }

    logAccess('???', loginInput, expectedRole, 'Невдала спроба входу', 'Помилка', 'Логін не знайдено');
    return { success: false, error: 'Користувача не знайдено' };
  }

  return { success: false, error: 'Невідома роль: ' + role };
}

// ========================================
// Утиліта: згенерувати хеш для пароля (для адміна)
// Використання: =hashPassword("mypassword")
// ========================================
function generateHash(password) {
  return hashPassword(password);
}

// ========================================
// CORS + doPost / doGet
// ========================================
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond({ success: false, error: 'Invalid JSON' });
  }

  var action = String(body.action || '');
  var result;

  switch (action) {
    case 'login':
      result = handleLogin(body);
      break;

    case 'hashPassword':
      // Утиліта для генерації хешів (тільки для налаштування)
      result = { success: true, hash: hashPassword(String(body.password || '')) };
      break;

    default:
      result = { success: false, error: 'Unknown action: ' + action };
  }

  return respond(result);
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'ping') {
    return respond({ success: true, message: 'Config API is alive', timestamp: new Date().toISOString() });
  }

  return respond({ success: false, error: 'Use POST for API calls' });
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
