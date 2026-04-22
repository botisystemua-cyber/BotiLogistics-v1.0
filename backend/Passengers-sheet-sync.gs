// ================================================================
// Passengers-sheet-sync.gs — автосинк заявок з Google Sheets у Supabase
// ================================================================
//
// ЖИВЕ У: Google таблиці «Пасажири Бронювання новий»
//          (ID 1EHJTrCpre63lg_FZeNhmSyk4ArDXu4YumNUpB9ZCFVk)
//
// ЩО РОБИТЬ:
//   Дивиться на аркуші «Загальний УКР» і «Загальний ШВ», бере нові рядки,
//   які ще не потрапили до Supabase, і вставляє їх у passengers через
//   RPC create_passenger_from_sheet(jsonb). Тенант жорстко 'esco'.
//
// НАПРЯМКИ:
//   «Загальний УКР» → Україна → Європа (direction = 'Україна-ЄВ')
//   «Загальний ШВ»  → Європа → Україна (direction = 'Європа-УК')
//
// ІДЕМПОТЕНТНІСТЬ:
//   Дублі відсікає БД (UNIQUE індекс на (tenant_id, pax_id)).
//   GAS додатково відстежує last-processed createDate у ScriptProperties,
//   щоб не ганяти таблицю кожен раз з початку.
//
// УСТАНОВКА (раз):
//   1. Supabase Dashboard → SQL Editor → запустити
//      sql/2026-04-esco-tenant-and-lead-rpc.sql.
//   2. Відкрити цю таблицю → Extensions → Apps Script → вставити файл.
//   3. Виконати функцію setupTriggers() один раз (дозволити доступ).
//   4. Готово. Меню «🔄 Supabase» зʼявиться зверху таблиці.
//
// БЕЗПЕКА:
//   SUPABASE_KEY поки хардкодом у цьому файлі. TODO: винести у
//   PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY').
// ================================================================


// ───────────────────────────────── КОНФІГ ─────────────────────────────────

const SHEET_ID = '1EHJTrCpre63lg_FZeNhmSyk4ArDXu4YumNUpB9ZCFVk';
const SUPABASE_URL = 'https://pgdhuezxkehpjlxoesoe.supabase.co';
// service_role — з CLAUDE.md.  Якщо колись буде обмеження прав — можна
// створити окремий JWT із політикою лише execute на RPC.
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZGh1ZXp4a2VocGpseG9lc29lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NzI1NiwiZXhwIjoyMDg5OTIzMjU2fQ.CSIz47_OZKNwleOP63N6gX2bIfT4fYEy0HmZf0qA7lE';

const RPC_URL = SUPABASE_URL + '/rest/v1/rpc/create_passenger_from_sheet';
const LOG_SHEET_NAME = '_SYNC_LOG';
const LOG_MAX_ROWS = 5000;

// Конфіг двох джерельних аркушів: напрям і куди лягає поле «місто».
// Для УКР (Україна → Європа) «місто» — адреса куди їдуть = arrival_address.
// Для ШВ (Європа → Україна) «місто» — адреса звідки забирають = departure_address.
const SHEETS = [
    {
        name: 'Загальний УКР',
        direction: 'Україна-ЄВ',
        cityField: 'arrival_address'
    },
    {
        name: 'Загальний ШВ',
        direction: 'Європа-УК',
        cityField: 'departure_address'
    }
];

// Мапа «нормалізований заголовок у Sheets → ключ у payload для RPC».
// Нормалізація: toLowerCase().trim().  Реальні заголовки можуть бути
// у різних регістрах («місце» / «Місце»), тому без нормалізації не зійдеться.
// Колонки, яких тут немає (Дата ШВ, Заброньовано, Вільні УК, Вільні ШВ,
// заброньовано [нижній регістр]) — свідомо ігноруємо.
const HEADER_TO_PAYLOAD = {
    'id':                  'pax_id',
    'піп':                 'full_name',
    'телефон пасажира':    'phone',
    'телефон юзера':       'registrar_phone',
    'кількість місць':     'seats_count',
    'завдаток':            'deposit',
    'клас авто':           'ticket_price',     // ← ціна квитка у CHF, не клас
    'дата створення':      'booking_created_at',
    'дата реєстрації':     'departure_date',
    'статус':              'lead_status',
    'місце':               'seat_number',
    'місто':               '_city',            // спецключ, роутимо за напрямком
    'примітка':            'notes'
};


// ────────────────────────────── ТОЧКИ ВХОДУ ──────────────────────────────

/** Основна функція — викликається тригером і з меню. */
function syncNewRequests() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const summary = { total: 0, success: 0, duplicate: 0, invalid: 0, failed: 0 };

    for (const cfg of SHEETS) {
        const sheet = ss.getSheetByName(cfg.name);
        if (!sheet) {
            logRow_(cfg.name, '-', 'FAILED', 0, 'Аркуш не знайдено');
            continue;
        }
        const r = processSheet_(sheet, cfg);
        summary.total     += r.total;
        summary.success   += r.success;
        summary.duplicate += r.duplicate;
        summary.invalid   += r.invalid;
        summary.failed    += r.failed;
    }
    return summary;
}

/** Встановлює тригери. Запустити руками один раз після вставки файлу. */
function setupTriggers() {
    // Почистити старі тригери цього скрипта (щоб не дублювати).
    ScriptApp.getProjectTriggers().forEach(t => {
        const fn = t.getHandlerFunction();
        if (fn === 'syncNewRequests' || fn === 'onSpreadsheetChange_') {
            ScriptApp.deleteTrigger(t);
        }
    });

    // Time-driven: кожні 5 хвилин.
    ScriptApp.newTrigger('syncNewRequests')
        .timeBased().everyMinutes(5).create();

    // Installable onChange на саму таблицю — ловить і API-вставки бота.
    ScriptApp.newTrigger('onSpreadsheetChange_')
        .forSpreadsheet(SHEET_ID)
        .onChange()
        .create();

    SpreadsheetApp.getUi().alert(
        'Тригери встановлено:\n' +
        ' • syncNewRequests — кожні 5 хв\n' +
        ' • onSpreadsheetChange_ — при зміні таблиці'
    );
}

/** Installable onChange handler — реагує на вставку рядків (у т.ч. через API). */
function onSpreadsheetChange_(e) {
    if (!e || e.changeType !== 'INSERT_ROW') return;
    syncNewRequests();
}

/** Меню «🔄 Supabase» у верхній панелі таблиці. */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('🔄 Supabase')
        .addItem('Синкнути зараз',               'menuSyncNow_')
        .addItem('Показати лог',                 'menuShowLog_')
        .addSeparator()
        .addItem('Встановити тригери',           'setupTriggers')
        .addItem('Скинути прогрес (синкне все наново)', 'menuResetProgress_')
        .addToUi();
}

function menuSyncNow_() {
    const s = syncNewRequests();
    SpreadsheetApp.getUi().alert(
        'Синк завершено:\n' +
        '  усього переглянуто: ' + s.total + '\n' +
        '  вставлено: ' + s.success + '\n' +
        '  дублів (вже в БД): ' + s.duplicate + '\n' +
        '  невалідних: ' + s.invalid + '\n' +
        '  помилок: ' + s.failed
    );
}

function menuShowLog_() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(LOG_SHEET_NAME);
    if (!sh) sh = ensureLogSheet_(ss);
    ss.setActiveSheet(sh);
}

function menuResetProgress_() {
    const ui = SpreadsheetApp.getUi();
    const ans = ui.alert(
        'Скинути last-processed дату для обох аркушів?',
        'Це означає що наступний синк пройдеться по ВСІХ рядках заново.\n' +
        'Дублі все одно відсікне БД, але це навантаження. Впевнений?',
        ui.ButtonSet.YES_NO
    );
    if (ans !== ui.Button.YES) return;

    const props = PropertiesService.getScriptProperties();
    SHEETS.forEach(cfg => props.deleteProperty('LAST_CREATE_' + cfg.name));
    ui.alert('Прогрес скинуто. Натисни «Синкнути зараз» для перезаливу.');
}


// ─────────────────────────── ОБРОБКА АРКУША ─────────────────────────────

function processSheet_(sheet, cfg) {
    const summary = { total: 0, success: 0, duplicate: 0, invalid: 0, failed: 0 };

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return summary;

    // Заголовки — з рядка 1, нормалізуємо.
    const headersRaw = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headerIdx = {}; // normalizedHeader → 1-based column index
    headersRaw.forEach((h, i) => {
        const key = String(h || '').toLowerCase().trim();
        if (key) headerIdx[key] = i;
    });

    const idxCreate = headerIdx['дата створення'];
    const idxId     = headerIdx['id'];
    if (idxCreate === undefined || idxId === undefined) {
        logRow_(cfg.name, '-', 'FAILED', 0, 'Немає обовʼязкових колонок "Id" / "дата створення"');
        return summary;
    }

    const props = PropertiesService.getScriptProperties();
    const progressKey = 'LAST_CREATE_' + cfg.name;
    const lastCreateMs = Number(props.getProperty(progressKey) || 0);

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    // Фільтруємо: непорожній Id + createDate > lastCreateMs.
    const rows = [];
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rawId = row[idxId];
        if (rawId === '' || rawId === null || rawId === undefined) continue;

        const createVal = row[idxCreate];
        const createMs = toDateMs_(createVal);
        if (createMs === null) continue;           // битий рядок — пропуск
        if (createMs <= lastCreateMs) continue;    // вже оброблений

        rows.push({ row, createMs, sheetRowNumber: i + 2 });
    }

    // Сортуємо за createDate ASC, щоб прогрес ріс монотонно.
    rows.sort((a, b) => a.createMs - b.createMs);

    let maxProcessedMs = lastCreateMs;

    for (const item of rows) {
        summary.total++;
        const payload = buildPayload_(item.row, headerIdx, cfg);

        if (!payload._valid) {
            summary.invalid++;
            logRow_(cfg.name, payload.pax_id || '-', 'INVALID', 0, payload._invalidReason);
            maxProcessedMs = Math.max(maxProcessedMs, item.createMs);
            continue;
        }
        delete payload._valid;
        delete payload._invalidReason;

        const res = callRpc_(payload);

        if (res.ok && res.duplicate) {
            summary.duplicate++;
            logRow_(cfg.name, payload.pax_id, 'SKIPPED_DUPLICATE', res.http, 'уже в БД');
            maxProcessedMs = Math.max(maxProcessedMs, item.createMs);
        } else if (res.ok) {
            summary.success++;
            logRow_(cfg.name, payload.pax_id, 'SUCCESS', res.http, res.body);
            maxProcessedMs = Math.max(maxProcessedMs, item.createMs);
        } else {
            summary.failed++;
            logRow_(cfg.name, payload.pax_id, 'FAILED', res.http, res.body);
            // НЕ оновлюємо прогрес — цей createDate наступний запуск перепробує.
            break;  // щоб не гнати всю решту в ту саму помилку
        }

        Utilities.sleep(150);  // rate-limit
    }

    if (maxProcessedMs > lastCreateMs) {
        props.setProperty(progressKey, String(maxProcessedMs));
    }
    return summary;
}


// ─────────────────────────── ПОБУДОВА PAYLOAD ──────────────────────────

function buildPayload_(row, headerIdx, cfg) {
    const payload = {
        direction: cfg.direction,
        source_sheet: cfg.name
    };

    // Прогін за мапою заголовків.
    for (const header in HEADER_TO_PAYLOAD) {
        const col = headerIdx[header];
        if (col === undefined) continue;

        const raw = row[col];
        const key = HEADER_TO_PAYLOAD[header];

        if (raw === '' || raw === null || raw === undefined) continue;

        // Спецобробка «місто» — роутимо в arrival_address або departure_address.
        if (key === '_city') {
            payload[cfg.cityField] = String(raw).trim();
            continue;
        }

        // Дати
        if (key === 'booking_created_at') {
            const ms = toDateMs_(raw);
            if (ms !== null) payload[key] = new Date(ms).toISOString();
            continue;
        }
        if (key === 'departure_date') {
            const ms = toDateMs_(raw);
            if (ms !== null) {
                // departure_date — тип date у БД, без часу
                payload[key] = Utilities.formatDate(
                    new Date(ms), 'Europe/Kiev', 'yyyy-MM-dd'
                );
            }
            continue;
        }

        // Числові поля
        if (key === 'seats_count' || key === 'deposit' || key === 'ticket_price') {
            const num = Number(String(raw).replace(/,/g, '.').replace(/[^\d.\-]/g, ''));
            if (!isNaN(num)) payload[key] = num;
            continue;
        }

        // Телефони
        if (key === 'phone' || key === 'registrar_phone') {
            const p = normalizePhone_(raw);
            if (p) payload[key] = p;
            continue;
        }

        // Текстові — як є, з trim.
        payload[key] = String(raw).trim();
    }

    // Валідація.
    if (!payload.pax_id) {
        return Object.assign(payload, { _valid: false, _invalidReason: 'немає pax_id' });
    }
    if (!payload.full_name && !payload.phone) {
        return Object.assign(payload, {
            _valid: false,
            _invalidReason: 'немає ні ПІП, ні телефон пасажира'
        });
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
    return s;  // іноземні / нестандартні — лишаємо як є
}

function toDateMs_(val) {
    if (val === '' || val === null || val === undefined) return null;
    if (val instanceof Date) return val.getTime();
    const d = new Date(val);
    const ms = d.getTime();
    return isNaN(ms) ? null : ms;
}


// ──────────────────────────── RPC VIA HTTP ─────────────────────────────

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

    const delays = [0, 1000, 2000, 4000];  // ×4 спроби
    let lastResp = null;

    for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) Utilities.sleep(delays[attempt]);
        try {
            const resp = UrlFetchApp.fetch(RPC_URL, opts);
            const code = resp.getResponseCode();
            const body = resp.getContentText();
            lastResp = { http: code, body: body };

            if (code >= 200 && code < 300) {
                // Тіло — або "PAX12345" (з лапками), або null.
                const parsed = safeParse_(body);
                const duplicate = parsed === null;
                return { ok: true, duplicate: duplicate, http: code, body: duplicate ? 'null' : String(parsed) };
            }

            // 4xx — детерміновано, не ретраїмо (крім 408/429).
            if (code >= 400 && code < 500 && code !== 408 && code !== 429) {
                return { ok: false, http: code, body: body };
            }
            // 5xx / 408 / 429 — ретрай.
        } catch (e) {
            lastResp = { http: 0, body: String(e) };
            // мережевий збій — ретрай
        }
    }

    return { ok: false, http: lastResp ? lastResp.http : 0, body: lastResp ? lastResp.body : 'unknown' };
}

function safeParse_(body) {
    try { return JSON.parse(body); } catch (e) { return body; }
}


// ──────────────────────────── ЛОГУВАННЯ ─────────────────────────────────

function logRow_(source, paxId, status, http, message) {
    try {
        const ss = SpreadsheetApp.openById(SHEET_ID);
        const sh = ensureLogSheet_(ss);
        sh.appendRow([
            new Date(),
            source,
            String(paxId || ''),
            status,
            http,
            truncate_(String(message || ''), 500)
        ]);
        // Обрізати старі рядки.
        const total = sh.getLastRow();
        if (total > LOG_MAX_ROWS + 500) {
            sh.deleteRows(2, total - LOG_MAX_ROWS);
        }
    } catch (e) {
        // Лог не критичний — мовчки проковтуємо.
        console.error('logRow_ failed', e);
    }
}

function ensureLogSheet_(ss) {
    let sh = ss.getSheetByName(LOG_SHEET_NAME);
    if (sh) return sh;
    sh = ss.insertSheet(LOG_SHEET_NAME);
    sh.getRange(1, 1, 1, 6).setValues([
        ['Timestamp', 'Sheet', 'pax_id', 'Status', 'HTTP', 'Message']
    ]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold');
    return sh;
}

function truncate_(s, n) {
    return s.length <= n ? s : s.slice(0, n) + '…';
}
