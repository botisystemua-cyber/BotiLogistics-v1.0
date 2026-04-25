// ============================================================================
// Packages-bot-sync.gs — автосинк бот-таблиці посилок у Supabase (без Posylki_crm)
// ============================================================================
//
// ЖИВЕ У: Google Sheets «Бот накладні ТТН»
//          (ID 16g2pWCiGEcdEBHxMOeDcKxWx96S_hS4nuXdXuAPzL_4)
//
// ЩО РОБИТЬ
//   Пропускає проміжну таблицю Posylki_crm. Читає напряму:
//     «Аркуш Бот ТТН» → Supabase packages direction='Україна-ЄВ'
//     «ЗАЇЗДИ»         → Supabase packages direction='Європа-УК'
//   tenant='esco' ставить RPC create_package_from_sheet.
//
//   У бот-таблиці нема pkg_id — генеруємо як PKG_<SmartSenderId> (колонка J).
//   Це natural key: повторна вставка того самого рядка ловиться UNIQUE(tenant, pkg_id).
//
//   Для «Аркуш Бот ТТН» (УК→ЄВ) RPC додатково перевіряє дубль по
//   ttn_number (колонка M) — див. sql/2026-04-esco-package-rpc-ttn-dedup.sql.
//
// РЕЖИМИ
//   - syncNewPackages() — live-синк: бере рядки після LAST_ROW_<sheet>.
//   - importUkrEuRange(28194, 28242) — одноразовий імпорт діапазону УК→ЄВ.
//     Прогрес НЕ чіпає, дублі відсікає RPC.
//   - menuStartFromNow_ — ставить LAST_ROW = поточний кінець таблиці,
//     щоб історію пропустити і синкати лише нові.
//
// ТРИГЕРИ (setupTriggers)
//   - time-driven 5хв → syncNewPackages
//   - installable onChange → onBotSpreadsheetChange_
//
// ПРОГРЕС
//   Зберігається у PropertiesService як LAST_ROW_<sheetName>.
//   У таблиці НЕМАЄ службової колонки _sync — щоб не заважала
//   менеджерам при копіюванні рядків у свою таблицю.
//
// ІДЕМПОТЕНТНІСТЬ
//   1) GAS: LAST_ROW — не повертаємось до вже оброблених рядків.
//   2) RPC: UNIQUE (tenant_id, pkg_id) + ON CONFLICT DO NOTHING.
//      pkg_id = PKG_UK_<smartId> або PKG_EU_<smartId> — унікальний
//      у межах напрямку.
//
// УСТАНОВКА
//   1. Відкрити «Бот накладні ТТН» → Extensions → Apps Script.
//   2. Вставити цей файл, зберегти.
//   3. Run setupTriggers → авторизувати.
//   4. F5 у таблиці → меню «📦 Supabase».
//   5. Меню → «Ігнорувати історію ЗАЇЗДИ» — щоб не перенести архів ЄВ→УК.
//   6. Меню → «Імпорт УК→ЄВ рядки 28194..28242» — одноразовий bulk для
//      свіжих 49 заявок.
//   7. Далі автоматично: бот пише новий рядок → через 5 хв (або миттєво
//      через onChange) він у Supabase.
// ============================================================================


// ─── КОНФІГ ────────────────────────────────────────────────────────────────

const SHEET_ID = '16g2pWCiGEcdEBHxMOeDcKxWx96S_hS4nuXdXuAPzL_4';
const SUPABASE_URL = 'https://pgdhuezxkehpjlxoesoe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZGh1ZXp4a2VocGpseG9lc29lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NzI1NiwiZXhwIjoyMDg5OTIzMjU2fQ.CSIz47_OZKNwleOP63N6gX2bIfT4fYEy0HmZf0qA7lE';

const RPC_URL = SUPABASE_URL + '/rest/v1/rpc/create_package_from_sheet';
const LOG_SHEET_NAME = '_SYNC_LOG';
const LOG_MAX_ROWS = 5000;
const MAX_ROWS_PER_RUN = 300;   // захист від 6-хв timeout'а Apps Script
// Прогрес зберігаємо у ScriptProperties під ключем LAST_ROW_<sheetName>.
// У таблиці НЕМАЄ службової колонки _sync (щоб не заважати менеджерам
// при копіюванні рядків у свою таблицю).

// Колонки бот-таблиці (0-based індекси в масиві, 1-based у Sheets API).
// A=Кг B=Сума C=№ D=Шт E=Адреса отримувача F=Телефон отримувача G=Опис
// H=Таймінг I=Деталі J=Ід K=Імʼя L=Телефон відправника M=ТТН N=Опл. O=Дата оформлення
const BOT = {
    weight:        0,  // A: Кг
    amount:        1,  // B: Сума
    internal_no:   2,  // C: №
    item_count:    3,  // D: Шт
    recip_addr:    4,  // E: Адреса отримувача
    recip_phone:   5,  // F: Телефон отримувача
    description:   6,  // G: Опис
    timing:        7,  // H: Таймінг
    details:       8,  // I: Деталі
    smart_id:      9,  // J: Ід (SmartSender)
    sender_name:  10,  // K: Імʼя
    sender_phone: 11,  // L: Телефон відправника
    ttn:          12,  // M: ТТН (лише УК→ЄВ)
    paid:         13,  // N: Опл.
    reg_date:     14   // O: Дата Оформлення
};

const SHEETS = [
    {
        name: 'Аркуш Бот ТТН',
        direction: 'Україна-ЄВ',
        colsToRead: 19  // читаємо до колонки S (деякі рядки мають _sync тощо)
    },
    {
        name: 'ЗАЇЗДИ',
        direction: 'Європа-УК',
        colsToRead: 15
    }
];


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
        const r = processSheet_(sheet, cfg, null, null);
        summary.total     += r.total;
        summary.success   += r.success;
        summary.duplicate += r.duplicate;
        summary.invalid   += r.invalid;
        summary.failed    += r.failed;
        summary.skipped   += r.skipped;
    }
    return summary;
}


function setupTriggers() {
    ScriptApp.getProjectTriggers().forEach(function (t) {
        const fn = t.getHandlerFunction();
        if (fn === 'syncNewPackages' || fn === 'onBotSpreadsheetChange_') {
            ScriptApp.deleteTrigger(t);
        }
    });

    ScriptApp.newTrigger('syncNewPackages').timeBased().everyMinutes(5).create();
    ScriptApp.newTrigger('onBotSpreadsheetChange_')
        .forSpreadsheet(SHEET_ID)
        .onChange()
        .create();

    safeAlert_(
        'Тригери встановлено:\n' +
        ' • syncNewPackages — кожні 5 хв\n' +
        ' • onBotSpreadsheetChange_ — при зміні таблиці\n\n' +
        'Далі натисни:\n' +
        ' 1) меню «📦 Supabase → Ігнорувати історію ЗАЇЗДИ»\n' +
        ' 2) меню «📦 Supabase → Імпорт УК→ЄВ рядки 28194..28242»'
    );
}


function onBotSpreadsheetChange_(e) {
    if (!e || e.changeType !== 'INSERT_ROW') return;
    syncNewPackages();
}


function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('📦 Supabase')
        .addItem('Синкнути нові зараз',                   'menuSyncNow_')
        .addItem('Показати лог',                          'menuShowLog_')
        .addItem('Показати прогрес (LAST_ROW)',           'menuShowProgress_')
        .addSeparator()
        .addItem('Імпорт УК→ЄВ рядки 28194..28242',        'menuImportUkrEuRange_')
        .addItem('Старт з поточного моменту (ігнорувати історію)', 'menuStartFromNow_')
        .addSeparator()
        .addItem('🗑 Прибрати старі колонки _sync з таблиці', 'menuDropLegacySyncCols_')
        .addSeparator()
        .addItem('Встановити тригери',                    'setupTriggers')
        .addItem('Скинути прогрес (УВАГА: все наново)',    'menuResetProgress_')
        .addToUi();
}


/** Показує у алерті поточний LAST_ROW для обох аркушів. */
function menuShowProgress_() {
    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const lines = [];
    for (const cfg of SHEETS) {
        const sheet = ss.getSheetByName(cfg.name);
        const lastRow = sheet ? sheet.getLastRow() : 0;
        const progress = Number(props.getProperty('LAST_ROW_' + cfg.name) || 1);
        const pending = Math.max(0, lastRow - progress);
        lines.push(cfg.name + ': останній оброблений рядок ' + progress +
                   ' / у таблиці ' + lastRow + ' (чекає: ' + pending + ')');
    }
    safeAlert_(lines.join('\n'));
}


/** Встановлює LAST_ROW на поточний кінець таблиці — скрипт ігноруватиме
 *  всю історію, синкатиме тільки нові рядки, які з'являться далі. */
function menuStartFromNow_() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); } catch (e) { }
    if (ui) {
        const ans = ui.alert(
            'Старт з поточного моменту?',
            'Усі рядки, що ЗАРАЗ є в аркушах, будуть проігноровані.\n' +
            'У Supabase потраплять тільки нові заявки, додані після цього.\n\nПродовжити?',
            ui.ButtonSet.YES_NO
        );
        if (ans !== ui.Button.YES) return;
    }
    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const lines = [];
    for (const cfg of SHEETS) {
        const sheet = ss.getSheetByName(cfg.name);
        if (!sheet) continue;
        const lastRow = sheet.getLastRow();
        props.setProperty('LAST_ROW_' + cfg.name, String(lastRow));
        lines.push(cfg.name + ': LAST_ROW=' + lastRow);
    }
    safeAlert_('Готово:\n • ' + lines.join('\n • ') +
               '\n\nТільки нові рядки після цього моменту підуть у Supabase.');
}


/** Скидає прогрес → скрипт піде по всій таблиці заново (обережно). */
function menuResetProgress_() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); } catch (e) { }
    if (ui) {
        const ans = ui.alert(
            'Скинути прогрес для обох аркушів?',
            'Скрипт пройде по ВСІХ рядках заново (по MAX_ROWS_PER_RUN=300 за виклик).\n' +
            'Дублі все одно відсікне RPC, але це велике навантаження.\n\nПродовжити?',
            ui.ButtonSet.YES_NO
        );
        if (ans !== ui.Button.YES) return;
    }
    const props = PropertiesService.getScriptProperties();
    for (const cfg of SHEETS) {
        props.deleteProperty('LAST_ROW_' + cfg.name);
    }
    safeAlert_('Прогрес скинуто. Натисни «Синкнути нові зараз» для перезаливу.');
}


/** Видаляє фізично стару колонку _sync з обох аркушів (якщо вона була
 *  створена попередньою версією скрипта). */
function menuDropLegacySyncCols_() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); } catch (e) { }
    if (ui) {
        const ans = ui.alert(
            'Видалити колонку _sync з обох аркушів?',
            'Колонка _sync більше не потрібна (прогрес тепер у пам\'яті скрипта).\n' +
            'Видалити її щоб не заважала менеджерам при копіюванні рядків?\n\nПродовжити?',
            ui.ButtonSet.YES_NO
        );
        if (ans !== ui.Button.YES) return;
    }
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const removed = [];
    for (const cfg of SHEETS) {
        const sheet = ss.getSheetByName(cfg.name);
        if (!sheet) continue;
        const lastCol = sheet.getLastColumn();
        const headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
        for (let i = 0; i < headers.length; i++) {
            if (String(headers[i] || '').trim() === '_sync') {
                sheet.deleteColumn(i + 1);
                removed.push(cfg.name + ' — кол. ' + (i + 1));
                break;
            }
        }
    }
    safeAlert_(removed.length
        ? 'Видалено:\n • ' + removed.join('\n • ')
        : 'Колонки _sync не знайдено — вже чисто.');
}


// (застарілі функції з колонкою _sync прибрані.
//  Тепер прогрес зберігається у PropertiesService. Див. menuStartFromNow_
//  та menuShowProgress_. Колонка _sync більше не створюється. Якщо стара
//  є — її можна видалити через меню «🗑 Прибрати старі колонки _sync».)


function menuSyncNow_() {
    const s = syncNewPackages();
    safeAlert_(
        'Синк:\n' +
        '  пройдено: ' + s.total + '\n' +
        '  вставлено: ' + s.success + '\n' +
        '  дублів: ' + s.duplicate + '\n' +
        '  невалідних: ' + s.invalid + '\n' +
        '  помилок: ' + s.failed + '\n' +
        '  вже синкнуто раніше: ' + s.skipped
    );
}


function menuImportUkrEuRange_() {
    importUkrEuRange(28194, 28242);
}


function importUkrEuRange(rowFrom, rowTo) {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('Аркуш Бот ТТН');
    if (!sheet) { safeAlert_('Не знайдено аркуш "Аркуш Бот ТТН"'); return; }

    const cfg = SHEETS[0];  // Аркуш Бот ТТН
    const r = processSheet_(sheet, cfg, rowFrom, rowTo);
    safeAlert_(
        'Імпорт УК→ЄВ рядки ' + rowFrom + '..' + rowTo + ':\n' +
        '  пройдено: ' + r.total + '\n' +
        '  вставлено: ' + r.success + '\n' +
        '  дублів (по pkg_id або ttn): ' + r.duplicate + '\n' +
        '  невалідних: ' + r.invalid + '\n' +
        '  помилок: ' + r.failed + '\n' +
        '  вже синкнуто раніше: ' + r.skipped
    );
}


function menuShowLog_() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(LOG_SHEET_NAME) || ensureLogSheet_(ss);
    try { ss.setActiveSheet(sh); } catch (e) { }
}


// ─── ОБРОБКА АРКУША ───────────────────────────────────────────────────────

function processSheet_(sheet, cfg, rowFrom, rowTo) {
    const summary = { total: 0, success: 0, duplicate: 0, invalid: 0, failed: 0, skipped: 0 };

    const sheetLastRow = sheet.getLastRow();
    if (sheetLastRow < 2) return summary;

    const props = PropertiesService.getScriptProperties();
    const progressKey = 'LAST_ROW_' + cfg.name;

    // Режим BULK (явний діапазон rowFrom..rowTo): обробляємо тільки цей діапазон,
    // прогрес НЕ чіпаємо. Корисно для «Імпорт УК→ЄВ 28194..28242».
    // Режим LIVE (rowFrom/rowTo=null): беремо все що після LAST_ROW.
    let startRow, endRow, updateProgress;
    if (rowFrom || rowTo) {
        startRow = rowFrom ? Math.max(2, rowFrom) : 2;
        endRow   = rowTo   ? Math.min(sheetLastRow, rowTo) : sheetLastRow;
        updateProgress = false;
    } else {
        const lastProcessedRow = Number(props.getProperty(progressKey) || 1);
        startRow = lastProcessedRow + 1;
        endRow   = sheetLastRow;
        updateProgress = true;
    }
    if (startRow > endRow) {
        summary.skipped = sheetLastRow - 1;  // все вже синкнуто
        return summary;
    }

    // Live-режим: обмежуємо за виклик (захист від 6-хв timeout).
    const maxToProcess = (rowFrom || rowTo) ? Infinity : MAX_ROWS_PER_RUN;
    if (updateProgress && (endRow - startRow + 1) > maxToProcess) {
        endRow = startRow + maxToProcess - 1;
    }

    const data = sheet.getRange(startRow, 1, endRow - startRow + 1, cfg.colsToRead).getValues();

    let maxProcessedRow = startRow - 1;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = startRow + i;

        const smartId = row[BOT.smart_id];
        if (!smartId) {
            // Порожній рядок — просто рухаємось далі, але зарахуємо в прогрес.
            maxProcessedRow = Math.max(maxProcessedRow, rowNum);
            continue;
        }

        summary.total++;
        const payload = buildPayload_(row, cfg);

        if (!payload._valid) {
            summary.invalid++;
            logRow_(cfg.name, payload.pkg_id || String(smartId), 'INVALID', 0, payload._invalidReason);
            maxProcessedRow = Math.max(maxProcessedRow, rowNum);
            continue;
        }
        delete payload._valid;
        delete payload._invalidReason;

        const res = callRpc_(payload);

        if (res.ok && res.duplicate) {
            summary.duplicate++;
            logRow_(cfg.name, payload.pkg_id, 'SKIPPED_DUPLICATE', res.http, 'already in DB');
            maxProcessedRow = Math.max(maxProcessedRow, rowNum);
        } else if (res.ok) {
            summary.success++;
            logRow_(cfg.name, payload.pkg_id, 'SUCCESS', res.http, res.body);
            maxProcessedRow = Math.max(maxProcessedRow, rowNum);
        } else {
            summary.failed++;
            logRow_(cfg.name, payload.pkg_id, 'FAILED', res.http, res.body);
            // НЕ оновлюємо maxProcessedRow — цей рядок наступний запуск перепробує.
            break;
        }

        Utilities.sleep(120);
    }

    // Оновити прогрес (тільки у LIVE-режимі)
    if (updateProgress && maxProcessedRow > (Number(props.getProperty(progressKey) || 1))) {
        props.setProperty(progressKey, String(maxProcessedRow));
    }

    return summary;
}


// ─── POBUДОВА PAYLOAD ─────────────────────────────────────────────────────

function buildPayload_(row, cfg) {
    const smartId = row[BOT.smart_id];
    // pkg_id містить префікс напрямку, щоб той самий SmartSender-ID
    // міг бути і в УК→ЄВ, і в ЄВ→УК без конфлікту UNIQUE(tenant, pkg_id).
    const prefix = cfg.direction === 'Україна-ЄВ' ? 'PKG_UK_' : 'PKG_EU_';
    const pkg_id = prefix + String(smartId).trim();

    const payload = {
        pkg_id:            pkg_id,
        smart_id:          String(smartId).trim(),
        direction:         cfg.direction,
        source_sheet:      cfg.name,
        sender_name:       textOrNull_(row[BOT.sender_name]),
        sender_phone:      normalizePhone_(row[BOT.sender_phone]),
        registrar_phone:   normalizePhone_(row[BOT.sender_phone]),
        recipient_address: textOrNull_(row[BOT.recip_addr]),
        recipient_phone:   normalizePhone_(row[BOT.recip_phone]),
        internal_number:   textOrNull_(row[BOT.internal_no]),
        description:       textOrNull_(row[BOT.description]),
        details:           textOrNull_(row[BOT.details]),
        timing:            textOrNull_(row[BOT.timing])
    };

    // ТТН тільки для УК→ЄВ
    if (cfg.direction === 'Україна-ЄВ') {
        const ttn = textOrNull_(row[BOT.ttn]);
        if (ttn) payload.ttn_number = ttn;
    }

    // Числа
    const itemCount = numOrNull_(row[BOT.item_count]);
    if (itemCount !== null) payload.item_count = itemCount;
    const weight = numOrNull_(row[BOT.weight]);
    if (weight !== null) payload.weight_kg = weight;
    const amount = numOrNull_(row[BOT.amount]);
    if (amount !== null) payload.total_amount = amount;

    // Дата оформлення
    const regDate = row[BOT.reg_date];
    if (regDate) {
        const ms = toDateMs_(regDate);
        if (ms !== null) {
            payload.dispatch_date = Utilities.formatDate(new Date(ms), 'Europe/Kiev', 'yyyy-MM-dd');
        }
    }

    // Валідація
    if (!payload.pkg_id || /^PKG_(UK|EU)_$/.test(payload.pkg_id) || /PKG_(UK|EU)_undefined$/.test(payload.pkg_id)) {
        return Object.assign(payload, { _valid: false, _invalidReason: 'немає Ід (SmartSender)' });
    }

    payload._valid = true;
    return payload;
}


function textOrNull_(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s || null;
}


function numOrNull_(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/,/g, '.').replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? null : n;
}


function normalizePhone_(v) {
    if (v === null || v === undefined) return null;
    let s = String(v).replace(/[\s()\-]/g, '');
    if (!s) return null;
    // float хвіст .0
    if (/^\d+\.0$/.test(s)) s = s.replace(/\.0$/, '');
    if (s.indexOf('+') === 0) return s;
    if (/^380\d{9}$/.test(s)) return '+' + s;
    if (/^0\d{9}$/.test(s))   return '+38' + s;
    if (/^\d{10,15}$/.test(s)) return '+' + s;
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


// ─── _SYNC_LOG ────────────────────────────────────────────────────────────

function logRow_(source, pkgId, status, http, message) {
    try {
        const ss = SpreadsheetApp.openById(SHEET_ID);
        const sh = ss.getSheetByName(LOG_SHEET_NAME) || ensureLogSheet_(ss);
        sh.appendRow([new Date(), source, String(pkgId || ''), status, http, truncate_(String(message || ''), 500)]);
        const total = sh.getLastRow();
        if (total > LOG_MAX_ROWS + 500) sh.deleteRows(2, total - LOG_MAX_ROWS);
    } catch (e) { console.error('logRow_ failed', e); }
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
