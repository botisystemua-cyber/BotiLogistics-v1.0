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
//   - syncNewPackages() — синк нових рядків (лайв режим).
//   - importUkrEuRange(28194, 28242) — одноразовий імпорт діапазону УК→ЄВ.
//     Рядки 28194-28242 уже готові для імпорту за умовою user.
//   - skipZaizdyHistory() — у всі наявні рядки ЗАЇЗДИ ставить _sync='skipped',
//     щоб історія не імпортувалась (тільки нові від моменту запуску).
//
// ТРИГЕРИ (setupTriggers)
//   - time-driven 5хв → syncNewPackages
//   - installable onChange → onBotSpreadsheetChange_
//
// ІДЕМПОТЕНТНІСТЬ
//   3 шари захисту від дублів:
//    1) GAS: службова колонка _sync у кожному аркуші ('ok PKG_...', 'skipped', 'fail XXX')
//    2) RPC: UNIQUE (tenant_id, pkg_id) + ON CONFLICT DO NOTHING
//    3) RPC: додатковий EXISTS-чек по ttn_number для УК→ЄВ
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
const SYNC_COL_NAME = '_sync';  // службова колонка в кожному джерельному аркуші

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
        .addSeparator()
        .addItem('Імпорт УК→ЄВ рядки 28194..28242',        'menuImportUkrEuRange_')
        .addItem('Ігнорувати історію ЗАЇЗДИ (пропустити все наявне)', 'menuSkipZaizdyHistory_')
        .addSeparator()
        .addItem('Встановити тригери',                    'setupTriggers')
        .addItem('Скинути _sync (УВАГА: все наново)',     'menuResetSync_')
        .addToUi();
}


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


function menuSkipZaizdyHistory_() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); } catch (e) { }
    if (ui) {
        const ans = ui.alert(
            'Ігнорувати історію ЗАЇЗДИ?',
            'У всі існуючі рядки «ЗАЇЗДИ» буде проставлено _sync="skipped".\n' +
            'Історію не заливаємо — тільки нові рядки після цього моменту.\n\nПродовжити?',
            ui.ButtonSet.YES_NO
        );
        if (ans !== ui.Button.YES) return;
    }
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('ЗАЇЗДИ');
    if (!sheet) { safeAlert_('Не знайдено аркуш "ЗАЇЗДИ"'); return; }

    const syncCol = ensureSyncColumn_(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) { safeAlert_('ЗАЇЗДИ порожній — нічого пропускати.'); return; }

    const values = sheet.getRange(2, syncCol, lastRow - 1, 1).getValues();
    let marked = 0;
    for (let i = 0; i < values.length; i++) {
        if (!values[i][0]) {
            values[i][0] = 'skipped-before-sync';
            marked++;
        }
    }
    sheet.getRange(2, syncCol, values.length, 1).setValues(values);
    safeAlert_('Готово: проставлено "skipped-before-sync" у ' + marked + ' рядках.\n' +
               'Тепер тільки нові заявки потраплять у Supabase.');
}


function menuShowLog_() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(LOG_SHEET_NAME) || ensureLogSheet_(ss);
    try { ss.setActiveSheet(sh); } catch (e) { }
}


function menuResetSync_() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); } catch (e) { }
    if (ui) {
        const ans = ui.alert(
            'ПОВНИЙ СКИДАННЯ _sync?',
            'Усі рядки в обох аркушах буде перечитано з нуля.\n' +
            'Дублі в БД все одно відсіче RPC, але це велике навантаження.\n\nПродовжити?',
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
        if (lastRow >= 2) sheet.getRange(2, syncCol, lastRow - 1, 1).clearContent();
    }
    safeAlert_('_sync очищений в обох аркушах.');
}


// ─── ОБРОБКА АРКУША ───────────────────────────────────────────────────────

function processSheet_(sheet, cfg, rowFrom, rowTo) {
    const summary = { total: 0, success: 0, duplicate: 0, invalid: 0, failed: 0, skipped: 0 };

    const syncCol = ensureSyncColumn_(sheet);
    const sheetLastRow = sheet.getLastRow();
    if (sheetLastRow < 2) return summary;

    // Діапазон рядків для обробки
    const startRow = rowFrom ? Math.max(2, rowFrom) : 2;
    const endRow   = rowTo   ? Math.min(sheetLastRow, rowTo) : sheetLastRow;
    if (startRow > endRow) return summary;

    // Зчитуємо до колонки _sync (щоб бачити її значення поточне)
    const numColsToRead = Math.max(cfg.colsToRead, syncCol);
    const data = sheet.getRange(startRow, 1, endRow - startRow + 1, numColsToRead).getValues();

    const writes = [];  // { rowNum, col, value }

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = startRow + i;

        const smartId = row[BOT.smart_id];
        if (!smartId) continue;  // нема ID — пропуск (навіть не лог)

        const syncVal = row[syncCol - 1];
        if (syncVal && (String(syncVal).indexOf('ok ') === 0 || String(syncVal).indexOf('skip') === 0 || String(syncVal).indexOf('skipped') === 0)) {
            summary.skipped++;
            continue;
        }

        summary.total++;
        const payload = buildPayload_(row, cfg);

        if (!payload._valid) {
            summary.invalid++;
            logRow_(cfg.name, payload.pkg_id || String(smartId), 'INVALID', 0, payload._invalidReason);
            writes.push({ rowNum: rowNum, col: syncCol, value: 'invalid: ' + payload._invalidReason });
            continue;
        }
        delete payload._valid;
        delete payload._invalidReason;

        const res = callRpc_(payload);

        if (res.ok && res.duplicate) {
            summary.duplicate++;
            logRow_(cfg.name, payload.pkg_id, 'SKIPPED_DUPLICATE', res.http, 'already in DB');
            writes.push({ rowNum: rowNum, col: syncCol, value: 'skip_dup ' + payload.pkg_id });
        } else if (res.ok) {
            summary.success++;
            logRow_(cfg.name, payload.pkg_id, 'SUCCESS', res.http, res.body);
            writes.push({ rowNum: rowNum, col: syncCol, value: 'ok ' + payload.pkg_id });
        } else {
            summary.failed++;
            logRow_(cfg.name, payload.pkg_id, 'FAILED', res.http, res.body);
            writes.push({ rowNum: rowNum, col: syncCol, value: 'fail ' + res.http });
        }

        Utilities.sleep(120);
    }

    // Bulk-write _sync
    for (const w of writes) {
        sheet.getRange(w.rowNum, w.col).setValue(w.value);
    }

    return summary;
}


// ─── POBUДОВА PAYLOAD ─────────────────────────────────────────────────────

function buildPayload_(row, cfg) {
    const smartId = row[BOT.smart_id];
    const pkg_id = 'PKG_' + String(smartId).trim();

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
    if (!payload.pkg_id || payload.pkg_id === 'PKG_' || payload.pkg_id === 'PKG_undefined') {
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


// ─── _sync COLUMN ─────────────────────────────────────────────────────────

function ensureSyncColumn_(sheet) {
    const lastCol = sheet.getLastColumn();
    const headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    for (let i = 0; i < headers.length; i++) {
        if (String(headers[i] || '').trim() === SYNC_COL_NAME) {
            // Ще раз страхуємось: знімаємо валідацію (раптом хтось налаштував)
            sheet.getRange(1, i + 1, sheet.getMaxRows(), 1).clearDataValidations();
            return i + 1;
        }
    }
    // Потрібно НОВУ колонку за межами існуючих даних
    let newCol = lastCol + 1;
    // Якщо такої колонки фізично ще нема — додаємо
    if (newCol > sheet.getMaxColumns()) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), newCol - sheet.getMaxColumns());
    }
    // КРИТИЧНО: знімаємо data validation з усього стовпця, інакше валідація
    // (напр. випадні списки «Сергій/Роман/...») блокує запис 'ok PKG_...'.
    sheet.getRange(1, newCol, sheet.getMaxRows(), 1).clearDataValidations();
    sheet.getRange(1, newCol).setValue(SYNC_COL_NAME).setFontWeight('bold').setBackground('#eeeeee');
    return newCol;
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
