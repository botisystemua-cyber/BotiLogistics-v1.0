// ============================================================================
// Packages-bot-sync-simple.gs — МІНІМАЛЬНИЙ синк бот-таблиці → Supabase.
// ============================================================================
//
// Без меню. Без службових колонок. Без історії.
// Просто: кожні 5 хв або onChange бере ОСТАННІ 30 рядків з кожного аркуша
// і шле у RPC. Дублі відсікає БД (UNIQUE + ON CONFLICT DO NOTHING).
//
// УСТАНОВКА (раз):
//   1. Вставити файл у Apps Script бот-таблиці.
//   2. Save. Run setupTriggers → авторизувати.
//   3. Все. Закрити Apps Script.
// ============================================================================

const SHEET_ID = '16g2pWCiGEcdEBHxMOeDcKxWx96S_hS4nuXdXuAPzL_4';
const SUPABASE_URL = 'https://pgdhuezxkehpjlxoesoe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZGh1ZXp4a2VocGpseG9lc29lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NzI1NiwiZXhwIjoyMDg5OTIzMjU2fQ.CSIz47_OZKNwleOP63N6gX2bIfT4fYEy0HmZf0qA7lE';
const RPC_URL = SUPABASE_URL + '/rest/v1/rpc/create_package_from_sheet';

// Скільки останніх рядків обробляти за виклик. RPC все одно відсіче дублі.
const TAIL_ROWS = 30;


function syncNew() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    processTail_(ss.getSheetByName('Аркуш Бот ТТН'), 'Україна-ЄВ', 'PKG_UK_');
    processTail_(ss.getSheetByName('ЗАЇЗДИ'),        'Європа-УК', 'PKG_EU_');
}


function processTail_(sheet, direction, prefix) {
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const startRow = Math.max(2, lastRow - TAIL_ROWS + 1);
    const rows = sheet.getRange(startRow, 1, lastRow - startRow + 1, 15).getValues();

    for (const row of rows) {
        const smartId = row[9];  // колонка J — Ід (SmartSender)
        if (!smartId) continue;

        const payload = {
            pkg_id:            prefix + String(smartId).trim(),
            smart_id:          String(smartId).trim(),
            direction:         direction,
            source_sheet:      sheet.getName(),
            sender_name:       s_(row[10]),                   // K Імʼя
            sender_phone:      normPhone_(row[11]),           // L Тел відправника
            registrar_phone:   normPhone_(row[11]),
            recipient_address: s_(row[4]),                    // E Адреса отримувача
            recipient_phone:   normPhone_(row[5]),            // F Тел отримувача
            internal_number:   s_(row[2]),                    // C №
            ttn_number:        direction === 'Україна-ЄВ' ? s_(row[12]) : null,  // M ТТН
            description:       s_(row[6]),                    // G Опис
            details:           s_(row[8]),                    // I Деталі
            item_count:        num_(row[3]),                  // D Шт
            weight_kg:         num_(row[0]),                  // A Кг
            total_amount:      num_(row[1])                   // B Сума
        };

        try {
            UrlFetchApp.fetch(RPC_URL, {
                method: 'post',
                contentType: 'application/json',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                },
                payload: JSON.stringify({ payload: payload }),
                muteHttpExceptions: true
            });
        } catch (e) {
            // мовчки пропустити — наступний запуск спробує знов
        }
    }
}


function setupTriggers() {
    ScriptApp.getProjectTriggers().forEach(function (t) {
        if (t.getHandlerFunction() === 'syncNew') ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('syncNew').timeBased().everyMinutes(5).create();
    ScriptApp.newTrigger('syncNew').forSpreadsheet(SHEET_ID).onChange().create();
    try {
        SpreadsheetApp.getUi().alert(
            'Готово. Синк буде:\n' +
            ' • миттєво при новому рядку в таблиці\n' +
            ' • раз на 5 хв як підстраховка\n\n' +
            'Останні ' + TAIL_ROWS + ' рядків кожного аркуша йдуть у Supabase.\n' +
            'Дублі відсіче БД.'
        );
    } catch (e) { }
}


// ── helpers ──────────────────────────────────────────────────────────────
function s_(v) {
    if (v === null || v === undefined) return null;
    const t = String(v).trim();
    return t || null;
}

function num_(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/,/g, '.').replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? null : n;
}

function normPhone_(v) {
    if (v === null || v === undefined) return null;
    let s = String(v).replace(/[\s()\-]/g, '').replace(/\.0$/, '');
    if (!s) return null;
    if (s[0] === '+') return s;
    if (/^380\d{9}$/.test(s)) return '+' + s;
    if (/^0\d{9}$/.test(s))   return '+38' + s;
    if (/^\d{10,15}$/.test(s)) return '+' + s;
    return s;
}
