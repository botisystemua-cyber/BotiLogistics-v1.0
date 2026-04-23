// ============================================================================
// Packages-sheet-sync.gs — автосинк посилок з Posylki_crm у Supabase
// ============================================================================
//
// ЖИВЕ У: Google Sheets «Posylki_crm» (ID нижче).
//
// ЩО РОБИТЬ
//   Дивиться на аркуші «Реєстрація ТТН УК-єв» і «Виклик Курєра ЄВ-ук»,
//   бере рядки з непустим PKG_ID, що ЩЕ не відмічені як synced, і надсилає
//   у Supabase через RPC create_package_from_sheet(jsonb). tenant='esco'.
//
// ТРИГЕРИ (ставить setupTriggers):
//   - time-driven 5хв (backup),
//   - installable onChange (миттєво на вставку рядка),
//   - меню «📦 Supabase» (Синкнути зараз / Показати лог / Скинути).
//
// ІДЕМПОТЕНТНІСТЬ
//   Дублі відсікає БД (UNIQUE (tenant_id, pkg_id) partial). GAS додатково
//   пише у службову колонку _sync у кожен аркуш:
//     - якщо lastCol після PKG_ID-блоку не містить '_sync' — створюємо
//     - значення: 'ok <pkg_id>' | 'skip_dup' | 'invalid <reason>' | 'fail <code>'
//
// УСТАНОВКА
//   1. Google Sheets → Extensions → Apps Script.
//   2. Вставити цей файл, зберегти.
//   3. Run `setupTriggers` — дати авторизацію, побачиш алерт.
//   4. Повернись у таблицю, F5 → з'явиться меню «📦 Supabase».
//   5. Натисни «📦 Supabase → Синкнути все зараз» для первісного заливу
//      уже накопичених ~182 рядків.
// ============================================================================


// ─── КОНФІГ ────────────────────────────────────────────────────────────────

const SHEET_ID = '1_vfEhdLEM2SVTBiu_3eDilMs1HlKxvPrJBbiHYjgrJo';
const SUPABASE_URL = 'https://pgdhuezxkehpjlxoesoe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZGh1ZXp4a2VocGpseG9lc29lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NzI1NiwiZXhwIjoyMDg5OTIzMjU2fQ.CSIz47_OZKNwleOP63N6gX2bIfT4fYEy0HmZf0qA7lE';

const RPC_URL = SUPABASE_URL + '/rest/v1/rpc/create_package_from_sheet';
const LOG_SHEET_NAME = '_SYNC_LOG';
const LOG_MAX_ROWS = 5000;
const SYNC_COL_NAME = '_sync';  // службова колонка в кожному джерельному аркуші

// Конфіг аркушів. cityField — куди покласти «Місто Нова Пошта» (для ЄВ→УК).
// Для УК→ЄВ такої колонки нема, тому cityField = null.
const SHEETS = [
    {
        name: 'Реєстрація ТТН УК-єв',
        direction: 'Україна-ЄВ',
        hasNpCity: false
    },
    {
        name: 'Виклик Курєра ЄВ-ук',
        direction: 'Європа-УК',
        hasNpCity: true
    }
];

// Мапа «нормалізований заголовок → ключ payload для RPC».
// Нормалізація: toLowerCase().trim(). Регістр в xlsx буває різний.
const HEADER_TO_PAYLOAD = {
    'pkg_id':                'pkg_id',
    'ід_смарт':              'smart_id',
    'напрям':                '_direction_raw',      // не відправляємо, беремо з cfg
    'source_sheet':          'source_sheet',
    'дата створення':        '_created_at_raw',      // не шлемо (created_at ставить БД)
    'піб відправника':       'sender_name',
    'телефон реєстратора':   'registrar_phone',
    'адреса відправки':      'sender_address',
    'піб отримувача':        'recipient_name',
    'телефон отримувача':    'recipient_phone',
    'адреса в європі':       'recipient_address',
    'місто нова пошта':      'nova_poshta_city',
    'внутрішній №':          'internal_number',
    'номер ттн':             'ttn_number',
    'опис':                  'description',
    'деталі':                'details',
    'кількість позицій':     'item_count',
    'кг':                    'weight_kg',
    'сума':                  'total_amount',
    'валюта оплати':         'payment_currency',
    'завдаток':              'deposit',
    'валюта завдатку':       'deposit_currency',
    'форма оплати':          'payment_form',
    'статус оплати':         'payment_status',
    'борг':                  'debt',
    'дата відправки':        'dispatch_date',
    'таймінг':               'timing',
    'статус посилки':        'package_status',
    'статус ліда':           'lead_status',
    'статус crm':            'crm_status',
    'фото посилки':          'photo_url',
    'тег':                   'tag',
    'примітка':              'notes'
};


// ─── ТОЧКИ ВХОДУ ───────────────────────────────────────────────────────────

function syncNewPackages() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const summary = { total: 0, success: 0, duplicate: 0, invalid: 0, failed: 0, skipped: 0 };

    for (const cfg of SHEETS) {
        const sheet = ss.getSheetByName(cfg.name);
        if (!sheet) {
            logRow_(cfg.name, '-', 'FAILED', 0, 'Аркуш не знайдено');
            continue;
        }
        const r = processSheet_(sheet, cfg);
        summary.total    += r.total;
        summary.success  += r.success;
        summary.duplicate += r.duplicate;
        summary.invalid  += r.invalid;
        summary.failed   += r.failed;
        summary.skipped  += r.skipped;
    }
    return summary;
}


function setupTriggers() {
    ScriptApp.getProjectTriggers().forEach(function (t) {
        const fn = t.getHandlerFunction();
        if (fn === 'syncNewPackages' || fn === 'onPackagesSpreadsheetChange_') {
            ScriptApp.deleteTrigger(t);
        }
    });

    ScriptApp.newTrigger('syncNewPackages').timeBased().everyMinutes(5).create();
    ScriptApp.newTrigger('onPackagesSpreadsheetChange_')
        .forSpreadsheet(SHEET_ID)
        .onChange()
        .create();

    safeAlert_('Тригери встановлено:\n • syncNewPackages — кожні 5 хв\n • onPackagesSpreadsheetChange_ — при зміні таблиці\n\nНатисни меню «📦 Supabase → Синкнути все зараз», щоб залити вже наявні рядки.');
}


function onPackagesSpreadsheetChange_(e) {
    if (!e || e.changeType !== 'INSERT_ROW') return;
    syncNewPackages();
}


function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('📦 Supabase')
        .addItem('Синкнути все зараз',          'menuSyncNow_')
        .addItem('Показати лог',                'menuShowLog_')
        .addSeparator()
        .addItem('Встановити тригери',          'setupTriggers')
        .addItem('Скинути _sync (усе знову)',   'menuResetSync_')
        .addToUi();
}


function menuSyncNow_() {
    const s = syncNewPackages();
    safeAlert_(
        'Синк завершено:\n' +
        '  пройдено: ' + s.total + '\n' +
        '  вставлено: ' + s.success + '\n' +
        '  дублів: ' + s.duplicate + '\n' +
        '  невалідних: ' + s.invalid + '\n' +
        '  помилок: ' + s.failed + '\n' +
        '  вже синкнуто: ' + s.skipped
    );
}


function menuShowLog_() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(LOG_SHEET_NAME) || ensureLogSheet_(ss);
    try { ss.setActiveSheet(sh); } catch (e) { /* standalone */ }
}


function menuResetSync_() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); } catch (e) { }
    if (ui) {
        const ans = ui.alert(
            'Очистити колонку _sync на всіх аркушах?',
            'Після цього ВСІ рядки з обох аркушів будуть зчитані заново.\n' +
            'Дублі в БД все одно відсіче RPC, але це додаткове навантаження.\n\nПродовжити?',
            ui.ButtonSet.YES_NO
        );
        if (ans !== ui.Button.YES) return;
    }
    const ss = SpreadsheetApp.openById(SHEET_ID);
    for (const cfg of SHEETS) {
        const sheet = ss.getSheetByName(cfg.name);
        if (!sheet) continue;
        const syncCol = ensureSyncColumn_(sheet);
        const lastRow = sheet.getLastRow();
        if (lastRow >= 2) {
            sheet.getRange(2, syncCol, lastRow - 1, 1).clearContent();
        }
    }
    safeAlert_('Готово, _sync очищений. Натисни «Синкнути все зараз».');
}


// ─── ОБРОБКА АРКУША ───────────────────────────────────────────────────────

function processSheet_(sheet, cfg) {
    const summary = { total: 0, success: 0, duplicate: 0, invalid: 0, failed: 0, skipped: 0 };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return summary;

    // Service _sync column
    const syncCol = ensureSyncColumn_(sheet);
    const lastCol = sheet.getLastColumn();

    // Headers
    const headersRaw = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headerIdx = {};  // normalized → 1-based col
    for (let i = 0; i < headersRaw.length; i++) {
        const key = String(headersRaw[i] || '').toLowerCase().trim();
        if (key) headerIdx[key] = i + 1;
    }
    if (!headerIdx['pkg_id']) {
        logRow_(cfg.name, '-', 'FAILED', 0, 'Не знайдена колонка PKG_ID');
        return summary;
    }

    // Read all data rows
    const allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const toUpdate = [];  // { rowNum, syncCol, value }

    for (let i = 0; i < allData.length; i++) {
        const row = allData[i];
        const rowNum = i + 2;  // 1-based sheet row
        const pkg_id = row[headerIdx['pkg_id'] - 1];
        if (!pkg_id) continue;

        const syncVal = row[syncCol - 1];
        if (syncVal && String(syncVal).indexOf('ok ') === 0) {
            summary.skipped++;
            continue;  // вже синкнуто
        }

        summary.total++;
        const payload = buildPayload_(row, headerIdx, cfg);

        if (!payload._valid) {
            summary.invalid++;
            logRow_(cfg.name, String(pkg_id), 'INVALID', 0, payload._invalidReason);
            toUpdate.push({ rowNum: rowNum, col: syncCol, value: 'invalid: ' + payload._invalidReason });
            continue;
        }
        delete payload._valid;
        delete payload._invalidReason;

        const res = callRpc_(payload);

        if (res.ok && res.duplicate) {
            summary.duplicate++;
            logRow_(cfg.name, String(pkg_id), 'SKIPPED_DUPLICATE', res.http, 'already in DB');
            toUpdate.push({ rowNum: rowNum, col: syncCol, value: 'skip_dup ' + pkg_id });
        } else if (res.ok) {
            summary.success++;
            logRow_(cfg.name, String(pkg_id), 'SUCCESS', res.http, res.body);
            toUpdate.push({ rowNum: rowNum, col: syncCol, value: 'ok ' + pkg_id });
        } else {
            summary.failed++;
            logRow_(cfg.name, String(pkg_id), 'FAILED', res.http, res.body);
            toUpdate.push({ rowNum: rowNum, col: syncCol, value: 'fail ' + res.http });
            // При 5xx не пишемо 'ok', дамо шанс наступному run повторити.
            // Для цього позначимо цей рядок 'fail' — а щоб повторив, на наступному запуску
            // перевіримо: якщо не 'ok ...' — пройти знов.
        }

        Utilities.sleep(120);  // rate-limit
    }

    // Bulk-write _sync column
    if (toUpdate.length) {
        for (const u of toUpdate) {
            sheet.getRange(u.rowNum, u.col).setValue(u.value);
        }
    }

    return summary;
}


// ─── POBUДОВА PAYLOAD ─────────────────────────────────────────────────────

function buildPayload_(row, headerIdx, cfg) {
    const payload = {
        direction: cfg.direction
    };

    for (const header in HEADER_TO_PAYLOAD) {
        const col = headerIdx[header];
        if (!col) continue;
        const raw = row[col - 1];
        const key = HEADER_TO_PAYLOAD[header];

        if (raw === '' || raw === null || raw === undefined) continue;

        // Non-payload fields
        if (key === '_direction_raw' || key === '_created_at_raw') continue;

        // nova_poshta_city — тільки для ЄВ→УК; для УК→ЄВ ігноруємо
        if (key === 'nova_poshta_city' && !cfg.hasNpCity) continue;

        // Dates
        if (key === 'dispatch_date') {
            const ms = toDateMs_(raw);
            if (ms !== null) {
                payload[key] = Utilities.formatDate(new Date(ms), 'Europe/Kiev', 'yyyy-MM-dd');
            }
            continue;
        }

        // Numbers
        if (key === 'item_count' || key === 'weight_kg' || key === 'total_amount'
            || key === 'deposit' || key === 'debt' || key === 'np_amount') {
            const n = Number(String(raw).replace(/,/g, '.').replace(/[^\d.\-]/g, ''));
            if (!isNaN(n)) payload[key] = n;
            continue;
        }

        // Phones
        if (key === 'recipient_phone' || key === 'registrar_phone' || key === 'sender_phone') {
            const p = normalizePhone_(raw);
            if (p) payload[key] = p;
            continue;
        }

        // Default: text
        payload[key] = String(raw).trim();
    }

    // source_sheet: вказуємо назву цього аркуша
    payload.source_sheet = cfg.name;

    // Валідація мінімум PKG_ID
    if (!payload.pkg_id) {
        return Object.assign(payload, { _valid: false, _invalidReason: 'немає pkg_id' });
    }

    payload._valid = true;
    return payload;
}


function normalizePhone_(raw) {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).replace(/[\s()\-]/g, '');
    if (!s) return null;
    if (s.indexOf('+') === 0) return s;
    if (/^380\d{9}$/.test(s)) return '+' + s;
    if (/^0\d{9}$/.test(s))   return '+38' + s;
    return s;
}


function toDateMs_(val) {
    if (val === '' || val === null || val === undefined) return null;
    if (val instanceof Date) return val.getTime();
    const d = new Date(val);
    const ms = d.getTime();
    return isNaN(ms) ? null : ms;
}


// ─── RPC ──────────────────────────────────────────────────────────────────

function callRpc_(payload) {
    const opts = {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY
        },
        payload: JSON.stringify({ payload: payload }),
        muteHttpExceptions: true
    };

    const delays = [0, 1000, 2000, 4000];
    let lastResp = null;

    for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) Utilities.sleep(delays[attempt]);
        try {
            const resp = UrlFetchApp.fetch(RPC_URL, opts);
            const code = resp.getResponseCode();
            const body = resp.getContentText();
            lastResp = { http: code, body: body };

            if (code >= 200 && code < 300) {
                const parsed = safeParse_(body);
                const duplicate = parsed === null;
                return { ok: true, duplicate: duplicate, http: code, body: duplicate ? 'null' : String(parsed) };
            }
            if (code >= 400 && code < 500 && code !== 408 && code !== 429) {
                return { ok: false, http: code, body: body };
            }
        } catch (e) {
            lastResp = { http: 0, body: String(e) };
        }
    }
    return { ok: false, http: lastResp ? lastResp.http : 0, body: lastResp ? lastResp.body : 'unknown' };
}


function safeParse_(body) {
    try { return JSON.parse(body); } catch (e) { return body; }
}


// ─── _sync COLUMN ─────────────────────────────────────────────────────────

function ensureSyncColumn_(sheet) {
    const lastCol = sheet.getLastColumn();
    const headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    for (let i = 0; i < headers.length; i++) {
        if (String(headers[i] || '').trim() === SYNC_COL_NAME) return i + 1;
    }
    // Додаємо колонку праворуч
    const newCol = lastCol + 1;
    sheet.getRange(1, newCol).setValue(SYNC_COL_NAME).setFontWeight('bold').setBackground('#eeeeee');
    return newCol;
}


// ─── _SYNC_LOG ────────────────────────────────────────────────────────────

function logRow_(source, pkgId, status, http, message) {
    try {
        const ss = SpreadsheetApp.openById(SHEET_ID);
        const sh = ss.getSheetByName(LOG_SHEET_NAME) || ensureLogSheet_(ss);
        sh.appendRow([
            new Date(),
            source,
            String(pkgId || ''),
            status,
            http,
            truncate_(String(message || ''), 500)
        ]);
        const total = sh.getLastRow();
        if (total > LOG_MAX_ROWS + 500) {
            sh.deleteRows(2, total - LOG_MAX_ROWS);
        }
    } catch (e) {
        console.error('logRow_ failed', e);
    }
}


function ensureLogSheet_(ss) {
    let sh = ss.getSheetByName(LOG_SHEET_NAME);
    if (sh) return sh;
    sh = ss.insertSheet(LOG_SHEET_NAME);
    sh.getRange(1, 1, 1, 6).setValues([['Timestamp', 'Sheet', 'pkg_id', 'Status', 'HTTP', 'Message']]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold');
    return sh;
}


function truncate_(s, n) {
    return s.length <= n ? s : s.slice(0, n) + '…';
}


function safeAlert_(msg) {
    try { SpreadsheetApp.getUi().alert(msg); }
    catch (e) { console.log(msg); }
}
