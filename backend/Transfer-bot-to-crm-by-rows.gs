// ============================================================================
// Transfer-bot-to-crm-by-rows.gs
// ============================================================================
//
// ЩО РОБИТЬ
//   Модифікована версія transferToCommonCrm() — замість фільтра по ДАТАХ
//   (01.04-30.04) використовує фільтр по ДІАПАЗОНУ РЯДКІВ.
//
//   - «Аркуш Бот ТТН» рядки 28023..28218 → «Реєстрація ТТН УК-єв»
//   - «ЗАЇЗДИ»         рядки 10581..10629 → «Виклик Курєра ЄВ-ук»
//
//   Вся інша логіка (мапінг колонок, генерація PKG_ID, захист від дублів
//   по Ід_смарт) — збережена від оригіналу.
//
// ЯК КОРИСТУВАТИСЬ
//   1. Apps Script, прив'язаний до БУДЬ-ЯКОЇ таблиці (зручно — до Posylki_crm
//      або окремий standalone проект — різниці нема, тут ми відкриваємо
//      обидві таблиці за ID).
//   2. Вставити цей код, зберегти.
//   3. Запустити `transferByRows()`.
//   4. Перевірити Execution Log і нові рядки у Posylki_crm.
//
// ДІАПАЗОНИ ЛЕГКО ЗМІНЮВАТИ
//   Константи UKR_FROM/UKR_TO і EU_FROM/EU_TO вгорі файлу.
// ============================================================================

const BOT_SHEET_ID = '16g2pWCiGEcdEBHxMOeDcKxWx96S_hS4nuXdXuAPzL_4';
const CRM_SHEET_ID = '1_vfEhdLEM2SVTBiu_3eDilMs1HlKxvPrJBbiHYjgrJo';

// Діапазони рядків для одноразового імпорту (1-based, включно).
const UKR_FROM = 28023;
const UKR_TO   = 28218;
const EU_FROM  = 10581;
const EU_TO    = 10629;


function transferByRows() {
    const botSs = SpreadsheetApp.openById(BOT_SHEET_ID);
    const crmSs = SpreadsheetApp.openById(CRM_SHEET_ID);

    Logger.log('🚀 ПОЧАТОК ПЕРЕНОСУ ПО ДІАПАЗОНУ РЯДКІВ...');
    Logger.log('   Бот ТТН: рядки ' + UKR_FROM + '..' + UKR_TO);
    Logger.log('   ЗАЇЗДИ:  рядки ' + EU_FROM + '..' + EU_TO);

    let totalLog = '';
    totalLog += transferBotTTNByRows_(botSs, crmSs, UKR_FROM, UKR_TO);
    totalLog += transferZaizdyByRows_(botSs, crmSs, EU_FROM, EU_TO);

    Logger.log('✅ ПЕРЕНОС ЗАВЕРШЕНО!\n' + totalLog);

    try {
        SpreadsheetApp.getUi().alert('Перенос готовий:\n\n' + totalLog);
    } catch (e) {
        // якщо standalone без UI
    }
}


// ─── Бот ТТН → Реєстрація ТТН УК-єв ─────────────────────────────────────
function transferBotTTNByRows_(botSs, crmSs, rowFrom, rowTo) {
    let log = '📋 Бот ТТН (УК→ЄВ)\n';
    log += '─'.repeat(60) + '\n';

    try {
        const botSheet = botSs.getSheetByName('Аркуш Бот ТТН');
        const crmSheet = crmSs.getSheetByName('Реєстрація ТТН УК-єв');
        if (!botSheet) { log += '❌ Не знайдено "Аркуш Бот ТТН"\n'; return log; }
        if (!crmSheet) { log += '❌ Не знайдено "Реєстрація ТТН УК-єв"\n'; return log; }

        const botLastRow = botSheet.getLastRow();
        const effTo = Math.min(rowTo, botLastRow);
        if (rowFrom > effTo) {
            log += '⚠️  Діапазон ' + rowFrom + '..' + rowTo + ' виходить за межі аркуша (lastRow=' + botLastRow + ')\n';
            return log;
        }
        const range = botSheet.getRange(rowFrom, 1, effTo - rowFrom + 1, 19);
        const botData = range.getValues();

        // Індекси колонок Бот ТТН (0-based)
        const bot = {
            sh: 0, suma: 1, num: 2, sht: 3, addr: 4, tel: 5, opis: 6,
            taiming: 7, details: 8, id: 9, imya: 10, tel_vid: 11,
            ttn: 12, opl: 13, data: 14
        };

        // Індекси колонок Реєстрація ТТН УК-єв (0-based)
        const crm = {
            pkg_id: 0, id_smart: 1, napryam: 2, source: 3, data_stv: 4,
            pib_vid: 5, tel_rej: 6, addr_vid: 7, pib_otry: 8, tel_otry: 9,
            addr_eu: 10, vn_num: 11, ttn: 12, opis: 13, details: 14,
            qty: 15, kg: 16, suma: 22,
            status_posylky: 35, status_lida: 36, status_crm: 37
        };

        // Передзагружаємо всі наявні Ід_смарт, щоб один прохід, без O(n*m).
        const existing = preloadExistingIds_(crmSheet, crm.id_smart);

        const toAppend = [];
        let transferred = 0, skipped = 0, noId = 0, dup = 0;

        for (let i = 0; i < botData.length; i++) {
            const row = botData[i];
            const id = row[bot.id];
            if (!id) { noId++; skipped++; continue; }
            if (existing[String(id)]) { dup++; skipped++; continue; }

            const newRow = new Array(52).fill('');
            newRow[crm.pkg_id]   = generatePkgId_();
            newRow[crm.id_smart] = id;
            newRow[crm.napryam]  = 'УК→ЄВ';
            newRow[crm.source]   = 'Аркуш Бот ТТН';
            newRow[crm.data_stv] = new Date();
            newRow[crm.pib_vid]  = row[bot.imya]    || '';
            newRow[crm.tel_rej]  = row[bot.tel_vid] || '';
            newRow[crm.addr_vid] = '';
            newRow[crm.pib_otry] = '';
            newRow[crm.tel_otry] = row[bot.tel]     || '';
            newRow[crm.addr_eu]  = row[bot.addr]    || '';
            newRow[crm.vn_num]   = row[bot.num]     || '';
            newRow[crm.ttn]      = row[bot.ttn]     || '';
            newRow[crm.opis]     = row[bot.opis]    || '';
            newRow[crm.details]  = row[bot.details] || '';
            newRow[crm.qty]      = row[bot.sht]     || '';
            newRow[crm.kg]       = row[bot.sh]      || '';
            newRow[crm.suma]     = row[bot.suma]    || '';
            newRow[crm.status_posylky] = row[bot.ttn] ? 'В дорозі' : 'Нова';
            newRow[crm.status_lida]    = 'Новий';
            newRow[crm.status_crm]     = 'Активний';

            toAppend.push(newRow);
            existing[String(id)] = true;
            transferred++;
        }

        // Bulk append — одна операція замість N appendRow().
        if (toAppend.length) {
            const lastRow = crmSheet.getLastRow();
            crmSheet.getRange(lastRow + 1, 1, toAppend.length, 52).setValues(toAppend);
        }

        log += '✅ Перенесено: ' + transferred + '\n';
        log += '⏭️  Пропущено:  ' + skipped + '  (без ІД: ' + noId + ', дублі: ' + dup + ')\n';
    } catch (e) {
        log += '❌ Помилка: ' + e.toString() + '\n' + (e.stack || '');
    }
    return log + '\n';
}


// ─── ЗАЇЗДИ → Виклик Курєра ЄВ-ук ───────────────────────────────────────
function transferZaizdyByRows_(botSs, crmSs, rowFrom, rowTo) {
    let log = '📋 ЗАЇЗДИ (ЄВ→УК)\n';
    log += '─'.repeat(60) + '\n';

    try {
        const zaSheet = botSs.getSheetByName('ЗАЇЗДИ');
        const crmSheet = crmSs.getSheetByName('Виклик Курєра ЄВ-ук');
        if (!zaSheet) { log += '❌ Не знайдено "ЗАЇЗДИ"\n'; return log; }
        if (!crmSheet) { log += '❌ Не знайдено "Виклик Курєра ЄВ-ук"\n'; return log; }

        const zaLastRow = zaSheet.getLastRow();
        const effTo = Math.min(rowTo, zaLastRow);
        if (rowFrom > effTo) {
            log += '⚠️  Діапазон ' + rowFrom + '..' + rowTo + ' виходить за межі (lastRow=' + zaLastRow + ')\n';
            return log;
        }
        const range = zaSheet.getRange(rowFrom, 1, effTo - rowFrom + 1, 15);
        const zaData = range.getValues();

        const za = {
            sh: 0, suma: 1, num: 2, sht: 3, addr: 4, tel: 5, opis: 6,
            taiming: 7, details: 8, id: 9, imya: 10, tel_vid: 11,
            ttn: 12, opl: 13, data: 14
        };

        const crm = {
            pkg_id: 0, id_smart: 1, napryam: 2, source: 3, data_stv: 4,
            pib_vid: 5, tel_rej: 6, addr_vid: 7, pib_otry: 8, tel_otry: 9,
            mesto_np: 10, vn_num: 11, opis: 12, details: 13, qty: 14,
            kg: 15, suma: 19,
            status_posylky: 34, status_lida: 35, status_crm: 36
        };

        const existing = preloadExistingIds_(crmSheet, crm.id_smart);

        const toAppend = [];
        let transferred = 0, skipped = 0, noId = 0, dup = 0;

        for (let i = 0; i < zaData.length; i++) {
            const row = zaData[i];
            const id = row[za.id];
            if (!id) { noId++; skipped++; continue; }
            if (existing[String(id)]) { dup++; skipped++; continue; }

            const newRow = new Array(51).fill('');
            newRow[crm.pkg_id]   = generatePkgId_();
            newRow[crm.id_smart] = id;
            newRow[crm.napryam]  = 'ЄВ→УК';
            newRow[crm.source]   = 'ЗАЇЗДИ';
            newRow[crm.data_stv] = new Date();
            newRow[crm.pib_vid]  = row[za.imya]    || '';
            newRow[crm.tel_rej]  = row[za.tel_vid] || '';
            newRow[crm.addr_vid] = row[za.addr]    || '';
            newRow[crm.pib_otry] = '';
            newRow[crm.tel_otry] = row[za.tel]     || '';
            newRow[crm.mesto_np] = '';
            newRow[crm.vn_num]   = row[za.num]     || '';
            newRow[crm.opis]     = row[za.opis]    || '';
            newRow[crm.details]  = row[za.details] || '';
            newRow[crm.qty]      = row[za.sht]     || '';
            newRow[crm.kg]       = row[za.sh]      || '';
            newRow[crm.suma]     = row[za.suma]    || '';
            newRow[crm.status_posylky] = 'Новий заїзд';
            newRow[crm.status_lida]    = 'Новий';
            newRow[crm.status_crm]     = 'Активний';

            toAppend.push(newRow);
            existing[String(id)] = true;
            transferred++;
        }

        if (toAppend.length) {
            const lastRow = crmSheet.getLastRow();
            crmSheet.getRange(lastRow + 1, 1, toAppend.length, 51).setValues(toAppend);
        }

        log += '✅ Перенесено: ' + transferred + '\n';
        log += '⏭️  Пропущено:  ' + skipped + '  (без ІД: ' + noId + ', дублі: ' + dup + ')\n';
    } catch (e) {
        log += '❌ Помилка: ' + e.toString() + '\n' + (e.stack || '');
    }
    return log + '\n';
}


// ─── helpers ────────────────────────────────────────────────────────────
function preloadExistingIds_(sheet, idColIdx) {
    const lastRow = sheet.getLastRow();
    const map = {};
    if (lastRow < 2) return map;
    const vals = sheet.getRange(2, idColIdx + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) {
        const v = vals[i][0];
        if (v !== null && v !== undefined && v !== '') map[String(v)] = true;
    }
    return map;
}

function generatePkgId_() {
    return 'PKG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
