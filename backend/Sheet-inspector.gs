// ============================================================================
// Sheet-inspector.gs — універсальний інспектор структури Google Sheets
// ============================================================================
//
// ЩО РОБИТЬ
//   Для кожного аркуша поточної Google Sheets вивaдить:
//    - назву
//    - кількість рядків з даними / кількість колонок
//    - заголовки 1-го рядка з адресами (A, B, ... або A1..AZ1)
//    - 3 семпл-рядки (перший з даними, середній, останній)
//   Результат:
//    - пишеться в Logger (видно в «Виконання → Журнал»),
//    - і в аркуш «_INSPECTOR_OUT» цієї ж таблиці (щоб копіпастнути сюди).
//
// ЯК ВИКОРИСТАТИ
//   1. Open Google Sheets яку інспектуємо.
//   2. Extensions → Apps Script (Розширення → Скрипт додатків).
//   3. У файлі Code.gs вставити цей код (або створити новий файл).
//   4. Save, обрати функцію `inspectSheets` вгорі, натиснути Run,
//      погодитись з авторизацією.
//   5. Відкрити аркуш «_INSPECTOR_OUT» у цій же таблиці → скопіювати весь
//      вміст → скинути Claude.
//
// БЕЗПЕКА
//   Скрипт нічого не змінює в робочих даних, лише читає + створює один
//   додатковий аркуш «_INSPECTOR_OUT» (якщо існує — перезаписує).
// ============================================================================

/** Максимум семпл-рядків на аркуш (перший, середній, останній). */
const INSPECTOR_SAMPLE_ROWS = 3;

/** Пропускати аркуші з цими іменами (власні службові). */
const INSPECTOR_SKIP_SHEETS = ['_INSPECTOR_OUT', '_SYNC_LOG', '_СТРУКТУРА'];

function inspectSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const out = [];

    out.push('========================================');
    out.push('Назва таблиці: ' + ss.getName());
    out.push('Spreadsheet ID: ' + ss.getId());
    out.push('URL: ' + ss.getUrl());
    out.push('Загалом аркушів: ' + ss.getSheets().length);
    out.push('Згенеровано: ' + new Date().toISOString());
    out.push('========================================');
    out.push('');

    for (const sh of ss.getSheets()) {
        const name = sh.getName();
        if (INSPECTOR_SKIP_SHEETS.indexOf(name) >= 0) continue;

        const lastRow = sh.getLastRow();
        const lastCol = sh.getLastColumn();
        out.push('');
        out.push('─────────────────────────────────────────');
        out.push('АРКУШ: ' + name);
        out.push('─────────────────────────────────────────');
        out.push('  Рядків: ' + lastRow + ' | Колонок: ' + lastCol);

        if (lastRow < 1 || lastCol < 1) {
            out.push('  (порожній)');
            continue;
        }

        // Headers
        const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
        out.push('  ЗАГОЛОВКИ (рядок 1):');
        for (let i = 0; i < headers.length; i++) {
            const addr = columnToLetter_(i + 1);
            const val = headers[i];
            if (val === null || val === undefined || val === '') {
                out.push('    ' + addr + ': (порожньо)');
            } else {
                out.push('    ' + addr + ': ' + stringify_(val));
            }
        }

        // Samples
        if (lastRow >= 2) {
            const sampleRows = pickSampleRows_(lastRow);
            out.push('  СЕМПЛИ (row# → значення):');
            for (const rowNum of sampleRows) {
                const rowVals = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
                out.push('    ─ row ' + rowNum + ':');
                for (let i = 0; i < rowVals.length; i++) {
                    if (rowVals[i] === null || rowVals[i] === undefined || rowVals[i] === '') continue;
                    const header = headers[i] ? String(headers[i]) : columnToLetter_(i + 1);
                    out.push('      ' + header + ' = ' + stringify_(rowVals[i]));
                }
            }
        }
    }

    const result = out.join('\n');

    // 1) В Logger
    Logger.log(result);

    // 2) В аркуш _INSPECTOR_OUT
    let outSheet = ss.getSheetByName('_INSPECTOR_OUT');
    if (outSheet) {
        outSheet.clear();
    } else {
        outSheet = ss.insertSheet('_INSPECTOR_OUT');
    }
    // Розбиваємо на рядки і пишемо в першу колонку
    const lines = result.split('\n').map(function (line) { return [line]; });
    outSheet.getRange(1, 1, lines.length, 1).setValues(lines);
    outSheet.setColumnWidth(1, 900);

    try {
        SpreadsheetApp.getUi().alert(
            'Готово!\n\n' +
            'Результат у аркуші «_INSPECTOR_OUT» (внизу вкладки).\n' +
            'Відкрий його, натисни Ctrl+A → Ctrl+C → вставити у чат Claude.'
        );
    } catch (e) {
        // якщо standalone без UI
    }
}


/** Повертає масив номерів рядків для семплу: [2, mid, last]. */
function pickSampleRows_(lastRow) {
    if (lastRow <= 1) return [];
    if (lastRow === 2) return [2];
    if (lastRow <= INSPECTOR_SAMPLE_ROWS + 1) {
        const arr = [];
        for (let i = 2; i <= lastRow; i++) arr.push(i);
        return arr;
    }
    const first = 2;
    const last = lastRow;
    const mid = Math.floor((first + last) / 2);
    return [first, mid, last];
}


/** 1→A, 27→AA, і так далі. */
function columnToLetter_(col) {
    let letter = '';
    while (col > 0) {
        const mod = (col - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        col = Math.floor((col - mod - 1) / 26);
    }
    return letter;
}


/** Стиснуте представлення значення для logу: Date → ISO, труфунути довгі. */
function stringify_(v) {
    if (v instanceof Date) return v.toISOString();
    const s = String(v);
    return s.length > 200 ? s.slice(0, 200) + '…' : s;
}
