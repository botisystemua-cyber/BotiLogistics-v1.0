// ================================================================
// supabase-api.js — Supabase API layer for Cargo CRM
// Replaces all Google Apps Script (GAS) API calls
// ================================================================

// ── COLUMN MAPPING: Supabase (English) ↔ GAS (Ukrainian) ──
const SB_TO_GAS_PKG = {
    pkg_id:             'PKG_ID',
    smart_id:           'Ід_смарт',
    direction:          'Напрям',
    created_at:         'Дата створення',
    sender_name:        'Піб відправника',
    registrar_phone:    'Телефон реєстратора',
    sender_phone:       'Телефон відправника',
    sender_address:     'Адреса відправки',
    recipient_name:     'Піб отримувача',
    recipient_phone:    'Телефон отримувача',
    recipient_address:  'Адреса в Європі',
    nova_poshta_city:   'Місто Нова Пошта',
    internal_number:    'Внутрішній №',
    ttn_number:         'Номер ТТН',
    ttn_date:           'Дата створення накладної',
    description:        'Опис',
    details:            'Деталі',
    item_count:         'Кількість позицій',
    weight_kg:          'Кг',
    estimated_value:    'Оціночна вартість',
    np_amount:          'Сума НП',
    np_currency:        'Валюта НП',
    np_form:            'Форма НП',
    np_status:          'Статус НП',
    total_amount:       'Сума',
    payment_currency:   'Валюта оплати',
    deposit:            'Завдаток',
    deposit_currency:   'Валюта завдатку',
    payment_form:       'Форма оплати',
    payment_status:     'Статус оплати',
    debt:               'Борг',
    payment_notes:      'Примітка оплати',
    dispatch_date:      'Дата відправки',
    timing:             'Таймінг',
    vehicle_id:         'Номер авто',
    route_id:           'RTE_ID',
    received_date:      'Дата отримання',
    package_status:     'Статус посилки',
    lead_status:        'Статус ліда',
    crm_status:         'Статус CRM',
    quality_check_required: 'Контроль перевірки',
    quality_checked_at: 'Дата перевірки',
    photo_url:          'Фото посилки',
    rating:             'Рейтинг',
    rating_comment:     'Коментар рейтингу',
    tag:                'Тег',
    notes:              'Примітка',
    sms_notes:          'Примітка СМС',
    archived_at:        'DATE_ARCHIVE',
    archived_by:        'ARCHIVED_BY',
    archive_reason:     'ARCHIVE_REASON',
    archived_from_routes: 'Був у маршрутах',
};

// Reverse mapping: GAS Ukrainian → Supabase column
const GAS_TO_SB_PKG = {};
for (const [sbKey, gasKey] of Object.entries(SB_TO_GAS_PKG)) {
    GAS_TO_SB_PKG[gasKey] = sbKey;
}

// ── DIRECTION NORMALIZER ──
function normalizeDirection(dir) {
    if (!dir) return null;
    const d = String(dir).toLowerCase().trim();
    if (d === 'eu' || d === 'eu-ua' || d.includes('євро') || d.includes('єв→ук') || d.includes('єв-ук') || d.includes('реєстрація ттн єв')) return 'Європа-УК';
    if (d === 'ue' || d === 'ua-eu' || d.includes('укра') || d.includes('ук→єв') || d.includes('ук-єв') || d.includes('реєстрація ттн ук')) return 'Україна-ЄВ';
    return dir;
}

// ── FORM FIELD → Supabase column (for any non-GAS keys) ──
const FORM_TO_SB_PKG = {
    direction:          'direction',
    sender_name:        'sender_name',
    sender_phone:       'sender_phone',
    sender_address:     'sender_address',
    recipient_name:     'recipient_name',
    recipient_phone:    'recipient_phone',
    recipient_address:  'recipient_address',
};

// ── NUMERIC COLUMNS ──
const NUMERIC_COLS_PKG = new Set([
    'item_count', 'weight_kg', 'estimated_value', 'np_amount',
    'total_amount', 'deposit', 'debt', 'rating',
]);

// ── STATUS VALUE MAPPING: Supabase English → Frontend Ukrainian ──
const STATUS_SB_TO_UA = {
    'new': 'Новий', 'in_progress': 'В роботі', 'confirmed': 'Підтверджено',
    'refused': 'Відмова', 'rejected': 'Відмова', 'active': 'Активний', 'archived': 'Архів',
    'unknown': 'Невідомий',
    'pending': 'Не оплачено', 'partial': 'Частково', 'paid': 'Оплачено',
    'received': 'Отримано', 'in_transit': 'В дорозі', 'delivered': 'Доставлено',
    'returned': 'Повернуто',
};
const STATUS_UA_TO_SB = {};
for (const [en, ua] of Object.entries(STATUS_SB_TO_UA)) STATUS_UA_TO_SB[ua] = en;

// ── DIRECTION: Supabase → Frontend display format ──
function directionToFrontend(dir) {
    if (dir === 'Україна-ЄВ') return 'УК→ЄВ';
    if (dir === 'Європа-УК') return 'ЄВ→УК';
    return dir || '';
}

// ── TRANSFORM HELPERS ──

function sbToGasObjPkg(sbRow) {
    const obj = {};
    for (const [sbKey, gasKey] of Object.entries(SB_TO_GAS_PKG)) {
        let val = sbRow[sbKey] !== null && sbRow[sbKey] !== undefined ? sbRow[sbKey] : '';
        // Translate English status values to Ukrainian for frontend
        if ((sbKey === 'lead_status' || sbKey === 'crm_status' || sbKey === 'payment_status' || sbKey === 'package_status' || sbKey === 'np_status') && STATUS_SB_TO_UA[val]) {
            val = STATUS_SB_TO_UA[val];
        }
        // Direction: convert Supabase format to frontend format
        if (sbKey === 'direction') {
            val = directionToFrontend(val);
        }
        obj[gasKey] = val;
    }
    obj._uuid = sbRow.id;
    obj._sheet = sbRow.direction === 'Європа-УК' ? 'Європа-УК' : 'Україна-ЄВ';
    return obj;
}

// Columns that are GENERATED ALWAYS — reads only, writes will error.
const GENERATED_COLS_PKG = new Set(['quality_check_required']);

function gasToSbObjPkg(gasObj) {
    const obj = {};
    for (const [key, val] of Object.entries(gasObj)) {
        if (key.startsWith('_')) continue;
        const sbKey = GAS_TO_SB_PKG[key] || FORM_TO_SB_PKG[key] || key;
        if (sbKey && SB_TO_GAS_PKG[sbKey] !== undefined && !GENERATED_COLS_PKG.has(sbKey)) {
            let v = val === '' ? null : val;
            // Translate Ukrainian status values to English for DB
            if (v !== null && (sbKey === 'lead_status' || sbKey === 'crm_status' || sbKey === 'payment_status' || sbKey === 'package_status' || sbKey === 'np_status') && STATUS_UA_TO_SB[v]) {
                v = STATUS_UA_TO_SB[v];
            }
            if (v !== null && NUMERIC_COLS_PKG.has(sbKey)) {
                const n = parseFloat(v);
                v = isNaN(n) ? null : n;
            }
            obj[sbKey] = v;
        }
    }
    return obj;
}

function calcDebtPkg(obj) {
    const total = parseFloat(obj['Сума']) || 0;
    const dep = parseFloat(obj['Завдаток']) || 0;
    return Math.max(0, total - dep);
}

// ── TENANT ──
function _readTenantId() {
    try {
        const raw = localStorage.getItem('boti_session');
        if (!raw) return null;
        const s = JSON.parse(raw);
        return s && s.tenant_id ? s.tenant_id : null;
    } catch (_) { return null; }
}
const BOTI_SESSION = (() => { try { return JSON.parse(localStorage.getItem('boti_session') || 'null'); } catch (_) { return null; } })();
const TENANT_ID = _readTenantId();
if (!TENANT_ID && !location.search.includes('nologinguard=1')) {
    console.warn('[boti] no boti_session — redirecting to config-crm login');
    location.href = '../config-crm/';
}

// ================================================================
// PACKAGES API
// ================================================================

async function sbPkgGetAll(params) {
    try {
        let query = sb.from('packages').select('*');
        query = query.eq('tenant_id', TENANT_ID).eq('is_archived', false);

        if (params && params.filter) {
            if (params.filter.dir && params.filter.dir !== 'all') {
                const dir = normalizeDirection(params.filter.dir);
                if (dir) query = query.eq('direction', dir);
            }
        }

        // Filter by sheet (direction alias)
        if (params && params.sheet && params.sheet !== 'all') {
            const dir = normalizeDirection(params.sheet);
            if (dir) query = query.eq('direction', dir);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        // packages.route_id (uuid) is not populated by our addToRoute flow —
        // the authoritative linkage is routes.pax_id_or_pkg_id. One batched
        // lookup so the lead card can render «✅ В маршруті» after reload.
        const pkgIds = (data || []).map(r => r.pkg_id).filter(Boolean);
        const rteByPkg = {};
        if (pkgIds.length) {
            const { data: rteRows } = await sb.from('routes')
                .select('pax_id_or_pkg_id, rte_id, vehicle_name')
                .eq('tenant_id', TENANT_ID)
                .in('pax_id_or_pkg_id', pkgIds);
            (rteRows || []).forEach(r => {
                if (r.pax_id_or_pkg_id && r.rte_id && !rteByPkg[r.pax_id_or_pkg_id]) {
                    rteByPkg[r.pax_id_or_pkg_id] = r;
                }
            });
        }

        const results = data.map(row => {
            const obj = sbToGasObjPkg(row);
            obj['Борг'] = calcDebtPkg(obj);
            const rte = rteByPkg[row.pkg_id];
            if (rte) {
                obj['RTE_ID'] = rte.rte_id || '';
                if (rte.vehicle_name && !obj['Номер авто']) {
                    obj['Номер авто'] = rte.vehicle_name;
                }
            }
            return obj;
        });

        return { ok: true, data: results };
    } catch (e) {
        console.error('sbPkgGetAll error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgGetStats(params) {
    try {
        const { data, error } = await sb.from('packages')
            .select('lead_status, payment_status, package_status, total_amount, deposit')
            .eq('tenant_id', TENANT_ID).eq('is_archived', false);
        if (error) throw error;

        const stats = { total: data.length, byLeadStatus: {}, byPayStatus: {}, byPkgStatus: {}, totalDebt: 0 };
        for (const row of data) {
            stats.byLeadStatus[row.lead_status || 'Новий'] = (stats.byLeadStatus[row.lead_status || 'Новий'] || 0) + 1;
            stats.byPayStatus[row.payment_status || 'Не оплачено'] = (stats.byPayStatus[row.payment_status || 'Не оплачено'] || 0) + 1;
            stats.byPkgStatus[row.package_status || '—'] = (stats.byPkgStatus[row.package_status || '—'] || 0) + 1;
            stats.totalDebt += Math.max(0, (parseFloat(row.total_amount) || 0) - (parseFloat(row.deposit) || 0));
        }
        return { ok: true, stats: stats };
    } catch (e) {
        console.error('sbPkgGetStats error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgAdd(params) {
    try {
        const gasData = params.data || params;
        const sbData = gasToSbObjPkg(gasData);

        sbData.tenant_id = TENANT_ID;
        if (!sbData.pkg_id) {
            sbData.pkg_id = 'PKG' + Date.now();
        }
        sbData.is_archived = false;
        sbData.crm_status = sbData.crm_status || 'active';
        sbData.lead_status = sbData.lead_status || 'new';
        sbData.package_status = sbData.package_status || 'pending';

        // Direction from sheet param
        if (!sbData.direction && params.sheet) {
            sbData.direction = normalizeDirection(params.sheet);
        }
        sbData.direction = normalizeDirection(sbData.direction) || 'Україна-ЄВ';

        // Ensure required NOT NULL fields have defaults
        sbData.sender_name = sbData.sender_name || '';
        sbData.sender_phone = sbData.sender_phone || '';
        sbData.sender_address = sbData.sender_address || '';
        sbData.recipient_name = sbData.recipient_name || '';
        sbData.recipient_phone = sbData.recipient_phone || '';
        sbData.recipient_address = sbData.recipient_address || '';

        // Calculate debt
        sbData.debt = Math.max(0, (parseFloat(sbData.total_amount) || 0) - (parseFloat(sbData.deposit) || 0));

        const { data, error } = await sb.from('packages').insert(sbData).select();
        if (error) throw error;

        const obj = sbToGasObjPkg(data[0]);
        obj['Борг'] = calcDebtPkg(obj);

        return { ok: true, data: obj, pkg_id: data[0].pkg_id };
    } catch (e) {
        console.error('sbPkgAdd error:', e);
        return { ok: false, error: e.message };
    }
}

// Legacy UI writes "Контроль перевірки" values directly; since that column
// is now GENERATED from scan_status, translate the write.
const VERIFY_UA_TO_SCAN_STATUS = {
    'В перевірці':       'checked',
    'Готова до маршруту':'awaiting_route',
    'Відхилено':         'rejected',
};

async function sbPkgUpdateField(params) {
    try {
        const pkgId = params.pkg_id;
        const gasCol = params.col;
        const value = params.value;

        let sbCol = GAS_TO_SB_PKG[gasCol] || gasCol;
        if (!sbCol) return { ok: false, error: 'Unknown column: ' + gasCol };

        const updateObj = {};
        let v = value === '' ? null : value;

        // "Контроль перевірки" is a legacy alias — translate target column
        // and value to the new scan_status pipeline.
        if (sbCol === 'quality_check_required') {
            sbCol = 'scan_status';
            v = v == null ? 'received' : (VERIFY_UA_TO_SCAN_STATUS[v] || v);
        }

        // Convert Ukrainian status values to English for DB
        if (v !== null && (sbCol === 'lead_status' || sbCol === 'crm_status' || sbCol === 'payment_status' || sbCol === 'package_status' || sbCol === 'np_status') && STATUS_UA_TO_SB[v]) {
            v = STATUS_UA_TO_SB[v];
        }
        // Convert numeric values
        if (v !== null && NUMERIC_COLS_PKG.has(sbCol)) {
            const n = parseFloat(v);
            v = isNaN(n) ? null : n;
        }
        updateObj[sbCol] = v;
        updateObj.updated_at = new Date().toISOString();

        // Recalculate debt if total/deposit changed
        if (['total_amount', 'deposit'].includes(sbCol)) {
            const { data: current } = await sb.from('packages')
                .select('total_amount, deposit')
                .eq('pkg_id', pkgId).single();
            if (current) {
                const merged = { ...current, ...updateObj };
                updateObj.debt = Math.max(0,
                    (parseFloat(merged.total_amount) || 0) - (parseFloat(merged.deposit) || 0));
            }
        }

        const { data, error } = await sb.from('packages')
            .update(updateObj).eq('pkg_id', pkgId).select();
        if (error) throw error;

        if (data && data[0]) {
            const obj = sbToGasObjPkg(data[0]);
            obj['Борг'] = calcDebtPkg(obj);
            return { ok: true, data: obj };
        }
        return { ok: true };
    } catch (e) {
        console.error('sbPkgUpdateField error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgDelete(params) {
    try {
        const pkgIds = params.pkg_ids || (params.pkg_id ? [params.pkg_id] : []);
        const reason = params.reason || 'Видалено';
        const manager = params.archived_by || params.manager || 'CRM';

        // Для кожної посилки збираємо імена маршрутів, у яких вона зараз
        // стоїть — потім кладемо у `archived_from_routes` щоб у картці архіву
        // було видно "Був у маршрутах: X, Y". Після цього видаляємо route-рядки
        // (архівована посилка не має лишатися у рейсі).
        const routesByPkg = {};
        if (pkgIds.length) {
            const { data: routeRows } = await sb.from('routes')
                .select('rte_id, pax_id_or_pkg_id')
                .eq('tenant_id', TENANT_ID)
                .eq('record_type', 'Посилка')
                .in('pax_id_or_pkg_id', pkgIds);
            (routeRows || []).forEach(r => {
                if (!r.pax_id_or_pkg_id) return;
                (routesByPkg[r.pax_id_or_pkg_id] = routesByPkg[r.pax_id_or_pkg_id] || new Set()).add(r.rte_id);
            });

            await sb.from('routes').delete()
                .eq('tenant_id', TENANT_ID)
                .eq('record_type', 'Посилка')
                .in('pax_id_or_pkg_id', pkgIds);
        }

        // Update без масового archived_from_routes — оскільки у кожної
        // посилки може бути свій список маршрутів, ідемо по одному .update().
        let updated = 0;
        const nowIso = new Date().toISOString();
        for (const pkgId of pkgIds) {
            const routesCsv = routesByPkg[pkgId] ? Array.from(routesByPkg[pkgId]).join(', ') : null;
            const { data, error } = await sb.from('packages')
                .update({
                    is_archived: true,
                    archived_at: nowIso,
                    archived_by: manager,
                    archive_reason: reason,
                    archived_from_routes: routesCsv,
                    updated_at: nowIso
                })
                .eq('pkg_id', pkgId)
                .select();
            if (error) throw error;
            updated += (data || []).length;
        }

        return { ok: true, count: updated };
    } catch (e) {
        console.error('sbPkgDelete error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgRestore(params) {
    try {
        const pkgId = params.pkg_id;
        const { data, error } = await sb.from('packages')
            .update({
                is_archived: false,
                archived_at: null,
                archived_by: null,
                archive_reason: null,
                archived_from_routes: null,
                updated_at: new Date().toISOString()
            })
            .eq('pkg_id', pkgId)
            .select();
        if (error) throw error;

        return { ok: true, data: data[0] ? sbToGasObjPkg(data[0]) : null };
    } catch (e) {
        console.error('sbPkgRestore error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgPermanentDelete(params) {
    try {
        const pkgIds = params.pkg_ids || (params.pkg_id ? [params.pkg_id] : []);
        const { error } = await sb.from('packages')
            .delete()
            .in('pkg_id', pkgIds)
            .eq('is_archived', true);
        if (error) throw error;

        return { ok: true };
    } catch (e) {
        console.error('sbPkgPermanentDelete error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgGetArchive(params) {
    try {
        let query = sb.from('packages').select('*').eq('is_archived', true);

        if (params && params.direction && params.direction !== 'all') {
            const dir = normalizeDirection(params.direction);
            if (dir) query = query.eq('direction', dir);
        }

        const { data, error } = await query.order('archived_at', { ascending: false });
        if (error) throw error;

        const results = data.map(row => {
            const obj = sbToGasObjPkg(row);
            obj['Борг'] = calcDebtPkg(obj);
            return obj;
        });

        return { ok: true, data: results, rows: results, total: results.length, hasMore: false };
    } catch (e) {
        console.error('sbPkgGetArchive error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// ROUTES API (for cargo) — uses shared `routes` table with record_type='Посилка'
// ================================================================

// Centralized GAS ↔ SB mapping for routes table (all-text columns, shared with passenger-crm)
const ROUTE_GAS_TO_SB = {
    'RTE_ID':             'rte_id', // overridden — actual row uuid stored in id
    'Тип запису':         'record_type',
    'Напрям':             'direction',
    'PKG_ID':             'pax_id_or_pkg_id',
    'PAX_ID':             'pax_id_or_pkg_id',
    'Дата рейсу':         'route_date',
    'Таймінг':            'timing',
    'Номер авто':         'vehicle_name',
    'AUTO_ID':            'vehicle_id',
    'Водій':              'driver_name',
    'Телефон водія':      'driver_phone',
    'Місто':              'city',
    'Піб пасажира':       'passenger_name',
    'Телефон пасажира':   'passenger_phone',
    'Піб відправника':    'sender_name',
    'Телефон відправника':'passenger_phone',
    'Адреса відправки':   'departure_address',
    'Піб отримувача':     'recipient_name',
    'Телефон отримувача': 'recipient_phone',
    'Адреса отримувача':  'recipient_address',
    'Адреса в Європі':    'recipient_address',
    'Адреса прибуття':    'arrival_address',
    'Вага багажу':        'baggage_weight',
    'Кількість місць':    'seats_count',
    'Місце в авто':       'seat_number',
    'Внутрішній №':       'internal_number',
    'Номер ТТН':          'ttn_number',
    'Опис':               'package_description',
    'Опис посилки':       'package_description',
    'Кг':                 'package_weight',
    'Вага посилки':       'package_weight',
    'Сума':               'amount',
    'Валюта оплати':      'amount_currency',
    'Валюта':             'amount_currency',
    'Завдаток':           'deposit',
    'Валюта завдатку':    'deposit_currency',
    'Форма оплати':       'payment_form',
    'Статус оплати':      'payment_status',
    'Борг':               'debt',
    'Примітка оплати':    'payment_notes',
    'Статус':             'status',
    'Статус CRM':         'crm_status',
    'Тег':                'tag',
    'Примітка':           'notes',
    'Примітка СМС':       'sms_notes',
};

function gasItemToRouteRow(item) {
    const row = { tenant_id: TENANT_ID, is_placeholder: false };
    for (const [gasKey, sbCol] of Object.entries(ROUTE_GAS_TO_SB)) {
        if (sbCol === 'rte_id') continue; // set by caller
        if (item[gasKey] !== undefined && item[gasKey] !== null && item[gasKey] !== '') {
            row[sbCol] = String(item[gasKey]);
        }
    }
    return row;
}

function routeRowToGasPkg(r) {
    return {
        '_uuid':              r.id,
        'RTE_ID':             r.id || '',
        'SHEET_NAME':         r.rte_id || '',
        'Тип запису':         (r.record_type === 'Посилка' || r.record_type === 'Package') ? 'Посилка' : 'Пасажир',
        'Напрям':             r.direction || '',
        'PKG_ID':             r.pax_id_or_pkg_id || '',
        'PAX_ID':             r.pax_id_or_pkg_id || '',
        'Дата рейсу':         r.route_date || '',
        'Таймінг':            r.timing || '',
        'Номер авто':         r.vehicle_name || '',
        'AUTO_ID':            r.vehicle_id || '',
        'Водій':              r.driver_name || '',
        'Телефон водія':      r.driver_phone || '',
        'Місто':              r.city || '',
        // Імена / телефони — таблиця routes ділить дві колонки між пасажирами
        // та посилками. Для посилки 'Піб пасажира' = sender_name (відправник),
        // а отримувач читається окремо через 'Піб отримувача' / 'Телефон отримувача'.
        // Рендер картки маршруту виводить пару "відправник → отримувач".
        'Піб пасажира':       r.passenger_name || r.sender_name || '',
        'Телефон пасажира':   r.passenger_phone || '',
        'Піб відправника':    r.sender_name || '',
        'Телефон відправника':r.passenger_phone || '',
        'Адреса відправки':   r.departure_address || '',
        'Піб отримувача':     r.recipient_name || '',
        'Телефон отримувача': r.recipient_phone || '',
        'Адреса отримувача':  r.recipient_address || '',
        'Адреса в Європі':    r.recipient_address || '',
        'Адреса прибуття':    r.arrival_address || r.recipient_address || '',
        'Внутрішній №':       r.internal_number || '',
        'Номер ТТН':          r.ttn_number || '',
        'Опис':               r.package_description || '',
        'Опис посилки':       r.package_description || '',
        'Кг':                 r.package_weight || '',
        'Вага посилки':       r.package_weight || '',
        'Вага багажу':        r.baggage_weight || r.package_weight || '',
        'Кількість місць':    r.seats_count || '',
        'Місце в авто':       r.seat_number || '',
        'Сума':               r.amount || '',
        'Валюта':             r.amount_currency || '',
        'Валюта оплати':      r.amount_currency || '',
        'Завдаток':           r.deposit || '',
        'Валюта завдатку':    r.deposit_currency || '',
        'Форма оплати':       r.payment_form || '',
        'Статус оплати':      r.payment_status || '',
        'Борг':               r.debt || '',
        'Примітка оплати':    r.payment_notes || '',
        'Статус':             (r.status === 'scheduled' ? 'Новий' : (r.status || '')),
        'Статус CRM':         r.crm_status || '',
        'Тег':                r.tag || '',
        'Примітка':           r.notes || '',
        'Примітка СМС':       r.sms_notes || '',
    };
}

async function sbPkgGetRoutesList(params) {
    try {
        const { data, error } = await sb.from('routes')
            .select('rte_id, record_type, direction, is_placeholder')
            .eq('tenant_id', TENANT_ID);
        if (error) throw error;

        const routeMap = {};
        (data || []).forEach(row => {
            const name = row.rte_id || 'Маршрут';
            if (!routeMap[name]) {
                routeMap[name] = { sheetName: name, rowCount: 0, paxCount: 0, parcelCount: 0 };
            }
            if (row.is_placeholder) return;
            routeMap[name].rowCount++;
            if (row.record_type === 'Посилка' || row.record_type === 'Package') {
                routeMap[name].parcelCount++;
            } else {
                routeMap[name].paxCount++;
            }
        });

        // Also include dispatches + expenses grouped by rte_id (for Cargo.js sidebar).
        const [dispRes, expRes] = await Promise.all([
            sbPkgGetDispatches(),
            sbPkgGetExpensesList(),
        ]);
        const dispatches = dispRes.ok ? (dispRes.data || []) : [];
        const expenses   = expRes.ok  ? (expRes.data  || []) : [];

        const routes = Object.values(routeMap);
        return { ok: true, data: routes, routes, dispatches, expenses };
    } catch (e) {
        console.error('sbPkgGetRoutesList error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgGetRouteSheet(params) {
    try {
        const sheetName = params.sheetName || params.sheet;

        // Summary view: aggregate all routes by rte_id
        if (sheetName === 'Зведення рейсів') {
            const { data: all, error: e1 } = await sb.from('routes')
                .select('*')
                .eq('tenant_id', TENANT_ID)
                .order('created_at', { ascending: false });
            if (e1) throw e1;
            const groups = {};
            (all || []).forEach(r => {
                const k = r.rte_id || '';
                if (!k) return;
                if (!groups[k]) groups[k] = { rte_id: k, route_date: r.route_date, city: r.city, driver: r.driver, vehicle_number: r.vehicle_number, status: r.status, note: r.note };
                const g = groups[k];
                if (!g.route_date && r.route_date) g.route_date = r.route_date;
                if (!g.city && r.city) g.city = r.city;
                if (!g.driver && r.driver) g.driver = r.driver;
                if (!g.vehicle_number && r.vehicle_number) g.vehicle_number = r.vehicle_number;
                if (!g.status && r.status) g.status = r.status;
                if (!g.note && r.note) g.note = r.note;
            });
            const rows = Object.values(groups).map(g => ({
                'RTE_ID': g.rte_id,
                'Дата рейсу': g.route_date || '',
                'Місто': g.city || '',
                'Водій': g.driver || '',
                'Номер авто': g.vehicle_number || '',
                'Статус': g.status || '',
                'Примітка': g.note || ''
            }));
            return { ok: true, data: { rows, headers: ['RTE_ID','Дата рейсу','Місто','Водій','Номер авто','Статус','Примітка'], sheetName }, rows, sheetName };
        }

        const { data, error } = await sb.from('routes')
            .select('*')
            .eq('tenant_id', TENANT_ID)
            .eq('rte_id', sheetName)
            .eq('is_placeholder', false)
            .order('created_at', { ascending: true });
        if (error) throw error;

        const rows = (data || []).map(routeRowToGasPkg);
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

        // Pull pickup_order from placeholder row (consistency with passenger-crm).
        // Cargo має лише один порядок (немає окремих pickup/dropoff), тому
        // використовуємо тільки pickup_order — простіше для UI.
        let pickupOrder = [];
        try {
            const { data: phData } = await sb.from('routes')
                .select('pickup_order')
                .eq('tenant_id', TENANT_ID)
                .eq('rte_id', sheetName)
                .eq('is_placeholder', true)
                .maybeSingle();
            if (phData && Array.isArray(phData.pickup_order)) pickupOrder = phData.pickup_order;
        } catch (_) { /* placeholder may be missing — нестрашно */ }

        return {
            ok: true,
            data: { rows, headers, sheetName, pickup_order: pickupOrder },
            rows, headers, sheetName,
            pickup_order: pickupOrder
        };
    } catch (e) {
        console.error('sbPkgGetRouteSheet error:', e);
        return { ok: false, error: e.message };
    }
}

// Write pickup_order array for a route to its placeholder row.
// Якщо placeholder-рядка ще нема — створюємо.
async function sbPkgSetRouteOrder(params) {
    try {
        const sheetName = params.sheetName || params.sheet;
        if (!sheetName) return { ok: false, error: 'sheetName required' };

        const updateObj = { updated_at: new Date().toISOString() };
        if (params.pickup_order !== undefined) updateObj.pickup_order = params.pickup_order || [];

        const { data: existing, error: selErr } = await sb
            .from('routes')
            .select('id')
            .eq('tenant_id', TENANT_ID)
            .eq('rte_id', sheetName)
            .eq('is_placeholder', true)
            .maybeSingle();
        if (selErr) throw selErr;

        if (existing && existing.id) {
            const { error: upErr } = await sb
                .from('routes')
                .update(updateObj)
                .eq('id', existing.id);
            if (upErr) throw upErr;
        } else {
            const insertObj = {
                tenant_id: TENANT_ID,
                rte_id: sheetName,
                is_placeholder: true,
                record_type: 'Посилка',
                status: 'Новий',
                crm_status: 'active',
                route_date: new Date().toISOString().split('T')[0],
                ...updateObj
            };
            const { error: insErr } = await sb.from('routes').insert(insertObj);
            if (insErr) throw insErr;
        }

        return { ok: true };
    } catch (e) {
        console.error('sbPkgSetRouteOrder error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgAddToRoute(params) {
    try {
        const rteId = params.sheetName || params.sheet_name || params.rte_id || params.route_id;
        if (!rteId) return { ok: false, error: 'Не вказано назву маршруту' };

        const leads = params.leads || params.items || [params];

        // ── Збираємо PKG_ID з усіх лідів та підтягуємо повні дані з packages.
        // Раніше при single-add фронт надсилав лише { pkg_id }, тому
        // gasItemToRouteRow не знаходив жодного GAS-ключа і у routes падав
        // майже порожній рядок. Тепер завжди беремо authoritative-дані з БД.
        const pkgIds = leads
            .map(it => it && (it['PKG_ID'] || it.pkg_id || it.PKG_ID))
            .filter(Boolean);

        let pkgById = {};
        if (pkgIds.length) {
            const { data: pkgs, error: pkgErr } = await sb.from('packages')
                .select('*')
                .eq('tenant_id', TENANT_ID)
                .in('pkg_id', pkgIds);
            if (pkgErr) throw pkgErr;
            (pkgs || []).forEach(r => { pkgById[r.pkg_id] = r; });
        }

        const today = new Date().toISOString().split('T')[0];
        const insertData = leads.map(item => {
            const pkgKey = item && (item['PKG_ID'] || item.pkg_id || item.PKG_ID);
            const dbRow = pkgKey ? pkgById[pkgKey] : null;

            // Якщо знайшли в БД — спочатку конвертимо повний пакет у GAS-форму,
            // потім зливаємо з тим, що прислав фронт (на випадок, якщо bulk
            // передав свіжі правки до синку).
            const merged = dbRow
                ? Object.assign({}, sbToGasObjPkg(dbRow), item)
                : item;

            const row = gasItemToRouteRow(merged);
            row.rte_id = rteId;
            if (!row.record_type) row.record_type = 'Посилка';
            if (!row.pax_id_or_pkg_id && pkgKey) row.pax_id_or_pkg_id = pkgKey;
            if (!row.route_date) row.route_date = today;
            if (!row.status || row.status === 'scheduled') row.status = 'Новий';

            // ── Coalesce phone ──
            // Форма "нова посилка" зберігає номер у packages.registrar_phone,
            // а sender_phone лишається порожнім. У таблиці routes колонки
            // registrar_phone взагалі нема — є тільки passenger_phone (спільна).
            // Тому якщо passenger_phone з gasItemToRouteRow порожній — підтягуємо
            // з registrar_phone напряму з БД. Інакше у маршруті телефон зникає.
            // Recipient окремо у row.recipient_phone — для нього fallback не потрібен.
            if ((!row.passenger_phone || row.passenger_phone === '') && dbRow) {
                var phoneFb = dbRow.sender_phone || dbRow.registrar_phone || '';
                if (phoneFb) row.passenger_phone = String(phoneFb);
            }
            return row;
        });

        const { data, error } = await sb.from('routes').insert(insertData).select();
        if (error) throw error;

        // NB: не апдейтимо тут packages.route_id — там uuid-колонка, а rteId
        // це назва аркуша (text). Фронт після успіху сам ставить item['RTE_ID']
        // у пам'ять (Cargo.js doAssignToRoute → item['RTE_ID']=route.sheetName).

        return { ok: true, data };
    } catch (e) {
        console.error('sbPkgAddToRoute error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgRemoveFromRoute(params) {
    try {
        const pkgId = params.pkg_id || params.PKG_ID;
        const rteIdOrRowId = params.rte_id || params.id;

        let q = sb.from('routes').delete()
            .eq('tenant_id', TENANT_ID)
            .eq('is_placeholder', false);

        // Cargo.js bulkRemoveFromRoute надсилає pkg_id + rte_id (назва аркуша).
        // Видаляємо саме рядок для цього пакунка у цьому маршруті.
        if (pkgId) {
            q = q.eq('pax_id_or_pkg_id', pkgId);
            if (rteIdOrRowId) q = q.eq('rte_id', rteIdOrRowId);
        } else if (rteIdOrRowId) {
            // Легасі-шлях: передали uuid рядка як rte_id/id.
            q = q.eq('id', rteIdOrRowId);
        } else {
            return { ok: false, error: 'Не вказано ні pkg_id, ні id рядка' };
        }

        const { error, count } = await q.select('id', { count: 'exact' });
        if (error) throw error;
        return { ok: true, removed: count || 0 };
    } catch (e) {
        console.error('sbPkgRemoveFromRoute error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgUpdateRouteField(params) {
    try {
        // rte_id from frontend = row UUID (since routeRowToGasPkg sets RTE_ID = r.id)
        const rowId = params.rte_id || params.id;
        const updateObj = {};

        // Захист: якщо GAS-ключ не має DB-колонки (напр. 'Тел. реєстратора',
        // 'Валюта багажу', 'Ціна багажу' — їх просто нема в routes), не шлемо
        // запит з кириличним іменем колонки — PostgREST поверне schema cache
        // помилку, користувач побачить червоний тост.
        const isValidSbCol = (c) => /^[a-z_][a-z0-9_]*$/.test(c);

        if (params.fields) {
            for (const [col, val] of Object.entries(params.fields)) {
                const sbCol = ROUTE_GAS_TO_SB[col] || col;
                if (!isValidSbCol(sbCol)) continue; // мовчки пропускаємо
                updateObj[sbCol] = (val === '' || val === undefined) ? null : String(val);
            }
        } else {
            const sbCol = ROUTE_GAS_TO_SB[params.col] || params.col;
            if (!isValidSbCol(sbCol)) {
                return { ok: false, error: 'Поле «' + params.col + '» не редагується тут' };
            }
            updateObj[sbCol] = (params.value === '' || params.value === undefined) ? null : String(params.value);
        }
        updateObj.updated_at = new Date().toISOString();

        const { data, error } = await sb.from('routes')
            .update(updateObj).eq('id', rowId).select();
        if (error) throw error;

        // Повертаємо GAS-keyed рядок, щоб фронт зміг змерджити його в
        // локальний sheet.rows і картка одразу оновилась без reload.
        const fresh = data && data[0] ? routeRowToGasPkg(data[0]) : null;
        return { ok: true, data: fresh };
    } catch (e) {
        console.error('sbPkgUpdateRouteField error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// DISPATCHES API (READ-ONLY for cargo-crm / manager)
// ================================================================
// Відправки створюють і редагують ВОДІЇ через driver-crm.
// Менеджер (cargo-crm) тільки ЧИТАЄ — ніяких create/update/delete.

// Mapping: dispatches SB column → GAS Ukrainian header (used by Cargo.js UI)
function dispatchRowToGas(r, routeInfo) {
    return {
        'DISPATCH_ID':        r.dispatch_id || '',
        'Дата створення':     r.created_at ? String(r.created_at).slice(0, 10) : '',
        'Дата рейсу':         r.route_date || '',
        'RTE_ID':             routeInfo && routeInfo.rte_id ? routeInfo.rte_id : '',
        'Водій':              routeInfo && routeInfo.driver_name ? routeInfo.driver_name : '',
        'Номер авто':         routeInfo && routeInfo.vehicle_name ? routeInfo.vehicle_name : '',
        'AUTO_ID':            r.vehicle_id || '',
        'Піб відправника':    r.sender_name || '',
        'Телефон відправника':r.sender_phone || '',
        'Телефон реєстратора':r.registrar_phone || '',
        'Піб отримувача':     r.recipient_name || '',
        'Телефон отримувача': r.recipient_phone || '',
        'Адреса отримувача':  r.recipient_address || '',
        'Внутрішній №':       r.internal_number || '',
        'Вага':               r.weight_kg || '',
        'Опис посилки':       r.package_description || '',
        'Фото посилки':       r.photo_url || '',
        'Сума':               r.amount || '',
        'Валюта':             r.amount_currency || '',
        'Завдаток':           r.deposit || '',
        'Валюта завдатку':    r.deposit_currency || '',
        'Форма оплати':       r.payment_form || '',
        'Статус оплати':      r.payment_status || '',
        'Борг':               r.debt || '',
        'Статус':             r.status || '',
        'Примітка':           r.notes || '',
        'PKG_ID':             '', // dispatches has no pkg_id FK yet
        'CLI_ID':             '',
    };
}

// Helper: build uuid → {rte_id, driver_name, vehicle_name, city, route_date, status} map
async function _fetchRoutesIndex(routeUuids) {
    if (!routeUuids || routeUuids.length === 0) return {};
    const { data, error } = await sb.from('routes')
        .select('id, rte_id, route_date, city, driver_name, vehicle_name, status')
        .eq('tenant_id', TENANT_ID)
        .in('id', routeUuids);
    if (error) throw error;
    const idx = {};
    (data || []).forEach(r => { idx[r.id] = r; });
    return idx;
}

// Returns grouped list for sidebar: [{sheetName, city, rowCount, rte_id}, ...]
async function sbPkgGetDispatches(_params) {
    try {
        const { data, error } = await sb.from('dispatches')
            .select('id, route_id, route_date')
            .eq('tenant_id', TENANT_ID);
        if (error) throw error;

        const rows = data || [];
        const uuids = [...new Set(rows.map(r => r.route_id).filter(Boolean))];
        const routesById = await _fetchRoutesIndex(uuids);

        const groups = {};
        rows.forEach(r => {
            const route = routesById[r.route_id];
            const key = (route && route.rte_id) || r.route_id || '—';
            if (!groups[key]) {
                groups[key] = {
                    sheetName: key,
                    rte_id:    key,
                    city:      (route && route.city) || '',
                    route_date:(route && route.route_date) || r.route_date || '',
                    rowCount:  0,
                };
            }
            groups[key].rowCount++;
        });

        return { ok: true, data: Object.values(groups) };
    } catch (e) {
        console.error('sbPkgGetDispatches error:', e);
        return { ok: false, error: e.message };
    }
}

// Returns detail rows for ONE dispatch (all dispatches under given rte_id)
async function sbPkgGetDispatchSheet(params) {
    try {
        const sheetName = params.sheetName || params.sheet || params.rte_id;
        if (!sheetName) return { ok: false, error: 'Не вказано rte_id/sheetName' };

        // 1) Resolve rte_id → routes.id (uuid)
        const { data: routeRows, error: rErr } = await sb.from('routes')
            .select('id, rte_id, route_date, city, driver_name, vehicle_name, status')
            .eq('tenant_id', TENANT_ID)
            .eq('rte_id', sheetName)
            .limit(1);
        if (rErr) throw rErr;

        const routeInfo = (routeRows && routeRows[0]) || null;
        if (!routeInfo) {
            return { ok: true, data: { rows: [], headers: [], sheetName }, rows: [], headers: [], sheetName };
        }

        // 2) Fetch dispatches for this route uuid
        const { data: dispRows, error: dErr } = await sb.from('dispatches')
            .select('*')
            .eq('tenant_id', TENANT_ID)
            .eq('route_id', routeInfo.id)
            .order('created_at', { ascending: true });
        if (dErr) throw dErr;

        const rows = (dispRows || []).map(r => dispatchRowToGas(r, routeInfo));
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { ok: true, data: { rows, headers, sheetName }, rows, headers, sheetName };
    } catch (e) {
        console.error('sbPkgGetDispatchSheet error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// MISC API
// ================================================================

async function sbPkgCheckDuplicates(params) {
    try {
        const phone = (params.phone || '').replace(/[\s\-()]/g, '').trim();
        const pib = (params.pib || '').trim();
        if (!phone && !pib) return { ok: true, data: [] };

        // Build OR filter for all phone fields + name
        const filters = [];
        if (phone && phone.length >= 6) {
            filters.push(`registrar_phone.ilike.%${phone}%`);
            filters.push(`sender_phone.ilike.%${phone}%`);
            filters.push(`recipient_phone.ilike.%${phone}%`);
        }
        if (pib && pib.length >= 2) {
            filters.push(`sender_name.ilike.%${pib}%`);
            filters.push(`recipient_name.ilike.%${pib}%`);
        }

        const { data, error } = await sb.from('packages')
            .select('pkg_id, sender_name, registrar_phone, sender_phone, recipient_name, recipient_phone, direction, lead_status, total_amount, payment_currency')
            .eq('tenant_id', TENANT_ID)
            .eq('is_archived', false)
            .or(filters.join(','))
            .limit(15);
        if (error) throw error;

        const mapped = (data || []).map(r => ({
            'PKG_ID': r.pkg_id,
            'Піб відправника': r.sender_name || '',
            'Телефон реєстратора': r.registrar_phone || '',
            'Телефон відправника': r.sender_phone || '',
            'Піб отримувача': r.recipient_name || '',
            'Телефон отримувача': r.recipient_phone || '',
            'Напрям': directionToFrontend(r.direction),
            'Статус ліда': STATUS_SB_TO_UA[r.lead_status] || r.lead_status || '',
            'Сума': r.total_amount || '',
            'Валюта оплати': r.payment_currency || '',
        }));

        return { ok: true, data: mapped, count: mapped.length };
    } catch (e) {
        console.error('sbPkgCheckDuplicates error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgGetOne(params) {
    try {
        const { data, error } = await sb.from('packages')
            .select('*').eq('pkg_id', params.pkg_id).single();
        if (error) throw error;

        const obj = sbToGasObjPkg(data);
        obj['Борг'] = calcDebtPkg(obj);
        return { ok: true, data: obj };
    } catch (e) {
        console.error('sbPkgGetOne error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgGetPayments(params) {
    try {
        const { data, error } = await sb.from('payments')
            .select('*').eq('package_id', params.pkg_id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return { ok: true, data: data || [] };
    } catch (e) {
        return { ok: true, data: [] };
    }
}

// ================================================================
// CLIENT CHAT / MESSENGER (table: messages)
// ================================================================

async function sbGetClientMessages(params) {
    try {
        const cliId = params.cli_id;
        if (!cliId) return { ok: false, error: 'cli_id required' };

        const { data, error } = await sb.from('messages')
            .select('*')
            .eq('tenant_id', TENANT_ID)
            .eq('client_id', cliId)
            .order('created_at', { ascending: true });
        if (error) throw error;

        const messages = (data || []).map(m => ({
            message_id: m.id || m.message_id,
            cli_id: m.client_id,
            date: m.created_at,
            role: m.sender_role || 'client',
            sender_name: m.sender_name || (m.sender_role === 'manager' ? 'Менеджер' : 'Клієнт'),
            text: m.content || m.text || '',
            read: m.is_read ? 'Так' : '',
        }));

        return { ok: true, data: messages };
    } catch (e) {
        console.error('sbGetClientMessages error:', e);
        return { ok: true, data: [] };
    }
}

async function sbSendManagerMessage(params) {
    try {
        const cliId = params.cli_id;
        const text = (params.text || '').trim();
        const senderName = params.sender_name || 'Менеджер';
        if (!cliId || !text) return { ok: false, error: 'cli_id and text required' };

        const msg = {
            tenant_id: TENANT_ID,
            client_id: cliId,
            sender_role: 'manager',
            sender_name: senderName,
            content: text,
            is_read: true,
            created_at: new Date().toISOString(),
        };

        const { data, error } = await sb.from('messages').insert(msg).select();
        if (error) throw error;

        return { ok: true, data: { message_id: data[0]?.id || data[0]?.message_id } };
    } catch (e) {
        console.error('sbSendManagerMessage error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbGetUnreadCounts(_params) {
    try {
        const { data, error } = await sb.from('messages')
            .select('client_id')
            .eq('tenant_id', TENANT_ID)
            .eq('sender_role', 'client')
            .eq('is_read', false);
        if (error) throw error;

        const counts = {};
        for (const row of (data || [])) {
            const cid = row.client_id;
            if (cid) counts[cid] = (counts[cid] || 0) + 1;
        }
        return { ok: true, data: counts };
    } catch (e) {
        console.error('sbGetUnreadCounts error:', e);
        return { ok: true, data: {} };
    }
}

async function sbMarkClientRead(params) {
    try {
        const cliId = params.cli_id;
        if (!cliId) return { ok: false, error: 'cli_id required' };

        const { error } = await sb.from('messages')
            .update({ is_read: true })
            .eq('tenant_id', TENANT_ID)
            .eq('client_id', cliId)
            .eq('sender_role', 'client')
            .eq('is_read', false);
        if (error) throw error;

        return { ok: true };
    } catch (e) {
        console.error('sbMarkClientRead error:', e);
        return { ok: true };
    }
}

// ================================================================
// VERIFICATION WORKFLOW (scanTTN, duplicates, route number, complete/reject)
// ================================================================

/**
 * scanTTN — thin wrapper over public.scan_ttn RPC.
 * The RPC owns the auto state-machine, audit log, and uniqueness guard
 * (see sql/2026-04-scanner-auto-mode.sql). Signature is now 4-arg — the
 * operator no longer picks intake/handout; DB decides from current scan_status.
 *
 * For back-compat with the legacy cargo-crm scan UI (which expects a full
 * package row + duplicates list), we re-fetch the row after the RPC and
 * do the duplicate search client-side.
 */
async function sbScanTTN(params) {
    try {
        const ttn = String(params.ttn || '').trim();
        if (!ttn) return { ok: false, error: 'ТТН не вказано' };

        const { data: rpcRes, error: rpcErr } = await sb.rpc('scan_ttn', {
            p_tenant_id: TENANT_ID,
            p_ttn: ttn,
            p_direction: params.direction || null,
            p_user: params.user_login || 'cargo-crm'
        });
        if (rpcErr) throw rpcErr;
        if (!rpcRes || !rpcRes.ok) {
            return { ok: false, error: (rpcRes && rpcRes.error) || 'scan_ttn failed' };
        }

        // Fetch the full row so the UI has all columns it needs.
        const { data: rows, error: selErr } = await sb.from('packages')
            .select('*')
            .eq('pkg_id', rpcRes.pkg_id)
            .eq('tenant_id', TENANT_ID)
            .limit(1);
        if (selErr) throw selErr;
        if (!rows || rows.length === 0) {
            return { ok: false, error: 'Рядок не знайдено після scan_ttn' };
        }

        const obj = sbToGasObjPkg(rows[0]);
        obj['Борг'] = calcDebtPkg(obj);

        const duplicates = await _findDuplicatesInternal(
            rows[0].pkg_id, rows[0].recipient_name, rows[0].recipient_phone
        );

        return {
            ok: true,
            type: rpcRes.type,        // 'found' | 'already' | 'new' | 'rejected'
            data: obj,
            duplicates,
            pkg_id: rpcRes.pkg_id
        };
    } catch (e) {
        console.error('sbScanTTN error:', e);
        return { ok: false, error: e.message };
    }
}

/**
 * peekTTN — read-only twin of scanTTN for the Check-mode lookup.
 * Returns payment fields only (total, deposit, debt, status). Does NOT mutate
 * scan_status and does NOT write to package_scan_log — by design.
 */
async function sbPeekTTN(ttn) {
    try {
        const t = String(ttn || '').trim();
        if (!t) return { ok: false, error: 'ТТН не вказано' };
        const { data, error } = await sb.rpc('peek_ttn', {
            p_tenant_id: TENANT_ID,
            p_ttn: t
        });
        if (error) throw error;
        return data || { ok: false, error: 'peek_ttn returned empty' };
    } catch (e) {
        console.error('sbPeekTTN error:', e);
        return { ok: false, error: e.message };
    }
}

/**
 * Внутрішня функція пошуку дублікатів по отримувачу
 */
async function _findDuplicatesInternal(excludePkgId, recipientName, recipientPhone) {
    try {
        const name = (recipientName || '').toLowerCase().trim();
        const phone = (recipientPhone || '').replace(/\s+/g, '').trim();
        if (!name && !phone) return [];

        // Збираємо всі активні посилки цього тенанта
        const { data, error } = await sb.from('packages')
            .select('*')
            .eq('tenant_id', TENANT_ID)
            .eq('is_archived', false);
        if (error) return [];

        const duplicates = [];
        for (const row of (data || [])) {
            if (row.pkg_id === excludePkgId) continue;
            if (row.crm_status === 'archived') continue;

            const pName = (row.recipient_name || '').toLowerCase();
            const pPhone = (row.recipient_phone || '').replace(/\s+/g, '');

            if ((name && pName.includes(name)) || (phone && phone.length >= 6 && pPhone.includes(phone))) {
                const obj = sbToGasObjPkg(row);
                obj['Борг'] = calcDebtPkg(obj);
                duplicates.push(obj);
            }
        }
        return duplicates;
    } catch (e) {
        console.error('_findDuplicatesInternal error:', e);
        return [];
    }
}

/**
 * findDuplicatesByRecipient — зовнішній endpoint
 * params: { pkg_id }
 */
async function sbFindDuplicatesByRecipient(params) {
    try {
        const pkgId = params.pkg_id;
        if (!pkgId) return { ok: false, error: 'pkg_id обов\'язковий' };

        const { data, error } = await sb.from('packages')
            .select('recipient_name, recipient_phone')
            .eq('pkg_id', pkgId)
            .eq('tenant_id', TENANT_ID)
            .limit(1);
        if (error) throw error;
        if (!data || data.length === 0) return { ok: false, error: 'Посилку не знайдено' };

        const row = data[0];
        const duplicates = await _findDuplicatesInternal(
            pkgId, row.recipient_name, row.recipient_phone
        );

        return { ok: true, duplicates, count: duplicates.length };
    } catch (e) {
        console.error('sbFindDuplicatesByRecipient error:', e);
        return { ok: false, error: e.message };
    }
}

/**
 * assignRouteNumber — автогенерація внутрішнього номера
 * params: { pkg_id, route_base }
 * route_base: 200 → діапазон 200-299, overflow 900+
 */
async function sbAssignRouteNumber(params) {
    try {
        const base = parseInt(params.route_base) || 200;
        const rangeStart = base;
        const rangeEnd = base + 99;
        const overflowStart = (base === 200) ? 900 : 800;

        // Зібрати всі існуючі внутрішні номери
        const { data, error } = await sb.from('packages')
            .select('internal_number')
            .eq('tenant_id', TENANT_ID)
            .eq('is_archived', false)
            .not('internal_number', 'is', null);
        if (error) throw error;

        const existingNums = {};
        for (const row of (data || [])) {
            const num = parseInt(row.internal_number);
            if (!isNaN(num)) existingNums[num] = true;
        }

        // Знайти наступний вільний номер
        let nextNum = rangeStart;
        while (existingNums[nextNum] && nextNum <= rangeEnd) {
            nextNum++;
        }
        // Якщо діапазон повний → overflow
        if (nextNum > rangeEnd) {
            nextNum = overflowStart;
            while (existingNums[nextNum]) {
                nextNum++;
            }
        }

        // Оновити посилку
        const { error: updErr } = await sb.from('packages')
            .update({ internal_number: String(nextNum) })
            .eq('pkg_id', params.pkg_id)
            .eq('tenant_id', TENANT_ID);
        if (updErr) throw updErr;

        return { ok: true, number: nextNum, pkg_id: params.pkg_id };
    } catch (e) {
        console.error('sbAssignRouteNumber error:', e);
        return { ok: false, error: e.message };
    }
}

/**
 * completeVerification — завершити перевірку
 * params: { pkg_id, skip_validation }
 */
async function sbCompleteVerification(params) {
    try {
        const pkgId = params.pkg_id;
        if (!pkgId) return { ok: false, error: 'pkg_id обов\'язковий' };

        // Валідація (якщо не skip)
        if (!params.skip_validation) {
            const { data } = await sb.from('packages')
                .select('internal_number')
                .eq('pkg_id', pkgId)
                .eq('tenant_id', TENANT_ID)
                .limit(1);
            if (data && data[0] && !data[0].internal_number) {
                return { ok: false, error: 'Внутрішній № обов\'язковий для завершення перевірки' };
            }
        }

        const { error } = await sb.from('packages')
            .update({
                scan_status: 'awaiting_route',
                quality_checked_at: new Date().toISOString()
            })
            .eq('pkg_id', pkgId)
            .eq('tenant_id', TENANT_ID);
        if (error) throw error;

        return { ok: true, pkg_id: pkgId };
    } catch (e) {
        console.error('sbCompleteVerification error:', e);
        return { ok: false, error: e.message };
    }
}

/**
 * rejectVerification — відхилити посилку
 * params: { pkg_id, reason }
 */
async function sbRejectVerification(params) {
    try {
        const pkgId = params.pkg_id;
        if (!pkgId) return { ok: false, error: 'pkg_id обов\'язковий' };

        const { error } = await sb.from('packages')
            .update({
                lead_status: 'rejected',
                scan_status: 'rejected',
                notes: params.reason || ''
            })
            .eq('pkg_id', pkgId)
            .eq('tenant_id', TENANT_ID);
        if (error) throw error;

        return { ok: true, pkg_id: pkgId };
    } catch (e) {
        console.error('sbRejectVerification error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// NOVA POSHTA API (ключ у system_settings, виклик API з браузера)
// ================================================================

async function sbPkgGetNpApiKey() {
    const { data, error } = await sb.from('system_settings')
        .select('setting_value')
        .eq('tenant_id', TENANT_ID)
        .eq('setting_name', 'NP_API_KEY')
        .limit(1);
    if (error) return null;
    return (data && data[0] && data[0].setting_value) || null;
}

async function sbPkgCheckNpApiKey(_params) {
    try {
        const key = await sbPkgGetNpApiKey();
        return { ok: true, hasKey: !!key, data: { hasKey: !!key } };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// NP StatusCode → Ukrainian package_status (як у GAS Script-cargo.gs)
const NP_STATUS_MAP = {
    '3':'В дорозі','4':'В дорозі','5':'В дорозі','6':'В дорозі','7':'В дорозі','8':'В дорозі',
    '9':'Доставлено','10':'Доставлено','11':'Доставлено',
    '12':'Затримано','14':'Затримано','103':'Затримано','104':'Затримано','106':'Затримано',
    '111':'Затримано','112':'Затримано',
    '101':'Втрачено','102':'Втрачено',
};

async function sbPkgTrackParcel(params) {
    try {
        let ttn = (params && params.ttn) || '';
        const pkgId = params && params.pkg_id;

        // Якщо TTN не вказано — взяти з БД по pkg_id
        if (!ttn && pkgId) {
            const { data } = await sb.from('packages')
                .select('ttn_number').eq('tenant_id', TENANT_ID).eq('pkg_id', pkgId).limit(1);
            if (data && data[0]) ttn = data[0].ttn_number || '';
        }
        if (!ttn) return { ok: false, error: 'ТТН не вказано' };

        const npKey = await sbPkgGetNpApiKey();
        if (!npKey) return { ok: false, error: 'API ключ Нової Пошти не налаштований (system_settings.NP_API_KEY)' };

        const resp = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: npKey,
                modelName: 'TrackingDocument',
                calledMethod: 'getStatusDocuments',
                methodProperties: { Documents: [{ DocumentNumber: ttn, Phone: '' }] },
            }),
        });
        const result = await resp.json();

        if (!result.success || !result.data || result.data.length === 0) {
            const errs = (result.errors || []).join(', ') || 'Не знайдено';
            return { ok: false, error: 'НП: ' + errs };
        }

        const t = result.data[0];
        const tracking = {
            ttn,
            status:        t.Status || '',
            statusCode:    t.StatusCode || '',
            cityFrom:      t.CitySender || '',
            cityTo:        t.CityRecipient || '',
            weight:        t.DocumentWeight || '',
            cost:          t.DocumentCost || '',
            deliveryDate:  t.ActualDeliveryDate || t.ScheduledDeliveryDate || '',
            payerType:     t.PayerType || '',
            paymentMethod: t.PaymentMethod || '',
        };

        // Якщо є pkg_id — синхронізувати статус у БД
        if (pkgId) {
            const newStatus = NP_STATUS_MAP[String(t.StatusCode)] || '';
            if (newStatus) {
                const sbStatus = STATUS_UA_TO_SB[newStatus] || newStatus;
                await sb.from('packages')
                    .update({ package_status: sbStatus, updated_at: new Date().toISOString() })
                    .eq('tenant_id', TENANT_ID).eq('pkg_id', pkgId);
            }
        }

        return { ok: true, tracking, data: tracking };
    } catch (e) {
        console.error('sbPkgTrackParcel error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// PACKAGE PHOTOS API
// ================================================================
// Фото зберігаємо як URL (Google Drive / S3 / інше). Файловий upload
// у Supabase Storage — окремий крок, якщо знадобиться.

// Resolve text pkg_id → uuid packages.id (повертає {id, ttn_number} або null)
async function _resolvePkg(pkgId) {
    if (!pkgId) return null;
    const { data, error } = await sb.from('packages')
        .select('id, ttn_number')
        .eq('tenant_id', TENANT_ID).eq('pkg_id', pkgId).limit(1);
    if (error || !data || !data[0]) return null;
    return data[0];
}

async function sbPkgGetPhotos(params) {
    try {
        const pkgId = params && params.pkg_id;
        if (!pkgId) return { ok: true, data: [], count: 0 };

        const pkg = await _resolvePkg(pkgId);
        if (!pkg) return { ok: true, data: [], count: 0 };

        const { data, error } = await sb.from('package_photos')
            .select('*')
            .eq('tenant_id', TENANT_ID)
            .eq('package_id', pkg.id)
            .order('created_at', { ascending: false });
        if (error) throw error;

        const photos = (data || []).map(r => ({
            PHOTO_ID:            r.photo_id || '',
            PKG_ID:              pkgId,
            'Номер ТТН':         r.ttn_number || '',
            'Штрих-код ТТН':     r.ttn_barcode || '',
            'Тип фото':          r.photo_type || '',
            'Фото посилки':      r.photo_url || '',
            'Хто завантажив':    r.uploaded_by || '',
            'Роль':              r.uploaded_by_role || '',
            'Коментар':          r.comment || '',
            'Статус перевірки':  r.verification_status || '',
            'Час':               r.created_at ? String(r.created_at).slice(0, 19).replace('T', ' ') : '',
        }));
        return { ok: true, data: photos, count: photos.length };
    } catch (e) {
        console.error('sbPkgGetPhotos error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgAddPhoto(params) {
    try {
        const pkgId = params && params.pkg_id;
        const url   = (params && params.url) || '';
        if (!pkgId) return { ok: false, error: 'pkg_id не вказано' };
        if (!url)   return { ok: false, error: 'URL фото не вказано' };

        const pkg = await _resolvePkg(pkgId);
        if (!pkg) return { ok: false, error: 'Посилку не знайдено: ' + pkgId };

        const photoId = 'PHOTO_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const insertRow = {
            tenant_id:           TENANT_ID,
            photo_id:            photoId,
            package_id:          pkg.id,
            ttn_number:          pkg.ttn_number || '',
            photo_type:          params.type || 'Посилка',
            photo_url:           url,
            uploaded_by_role:    params.role || 'Перевіряючий',
            comment:             params.comment || '',
            verification_status: 'Новий',
        };

        const { data, error } = await sb.from('package_photos').insert(insertRow).select();
        if (error) throw error;

        // Денормалізація: останнє фото лишаємо на packages.photo_url (як у GAS)
        await sb.from('packages')
            .update({ photo_url: url, updated_at: new Date().toISOString() })
            .eq('tenant_id', TENANT_ID).eq('id', pkg.id);

        return { ok: true, photo_id: photoId, data: data && data[0] };
    } catch (e) {
        console.error('sbPkgAddPhoto error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgGetExpenses(params) {
    try {
        const { data, error } = await sb.from('expenses')
            .select('*')
            .eq('tenant_id', TENANT_ID)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return { ok: true, data: data || [] };
    } catch (e) {
        return { ok: true, data: [] };
    }
}

// ================================================================
// EXPENSES (DRIVER) API — READ-ONLY for cargo-crm / manager
// ================================================================
// Витрати вводять ВОДІЇ через driver-crm. Менеджер тільки ЧИТАЄ.

function expenseRowToGas(r, routeInfo) {
    return {
        'EXP_ID':             r.exp_id || '',
        'Дата рейсу':         r.route_date || '',
        'RTE_ID':             routeInfo && routeInfo.rte_id ? routeInfo.rte_id : '',
        'Водій':              routeInfo && routeInfo.driver_name ? routeInfo.driver_name : '',
        'Номер авто':         routeInfo && routeInfo.vehicle_name ? routeInfo.vehicle_name : '',
        'AUTO_ID':            r.vehicle_id || '',
        'Аванс готівка':      r.advance_cash || '',
        'Валюта авансу готівка': r.advance_cash_currency || '',
        'Аванс картка':       r.advance_card || '',
        'Валюта авансу картка':  r.advance_card_currency || '',
        'Залишок авансу':     r.advance_remaining || '',
        'Бензин':             r.fuel || '',
        'Їжа':                r.meals || '',
        'Паркування':         r.parking || '',
        'Толл на дорозі':     r.toll || '',
        'Штраф':              r.fine || '',
        'Митниця':            r.customs || '',
        'Топап рахунку':      r.account_topup || '',
        'Інше':               r.other || '',
        'Опис іншого':        r.other_description || '',
        'Чеки':               r.receipt_photos || '',
        'Валюта витрат':      r.expense_currency || '',
        'Всього витрат':      r.total_expenses || '',
        'Чайові':             r.tips || '',
        'Валюта чайових':     r.tips_currency || '',
        'Примітка':           r.notes || '',
        'Дата створення':     r.created_at ? String(r.created_at).slice(0, 10) : '',
    };
}

// Sidebar list: grouped by rte_id → [{sheetName, city, route_date, rowCount}, ...]
async function sbPkgGetExpensesList(_params) {
    try {
        const { data, error } = await sb.from('expenses')
            .select('id, route_id, route_date')
            .eq('tenant_id', TENANT_ID);
        if (error) throw error;

        const rows = data || [];
        const uuids = [...new Set(rows.map(r => r.route_id).filter(Boolean))];
        const routesById = await _fetchRoutesIndex(uuids);

        const groups = {};
        rows.forEach(r => {
            const route = routesById[r.route_id];
            const key = (route && route.rte_id) || r.route_id || '—';
            if (!groups[key]) {
                groups[key] = {
                    sheetName: key,
                    rte_id:    key,
                    city:      (route && route.city) || '',
                    route_date:(route && route.route_date) || r.route_date || '',
                    rowCount:  0,
                };
            }
            groups[key].rowCount++;
        });

        return { ok: true, data: Object.values(groups) };
    } catch (e) {
        console.error('sbPkgGetExpensesList error:', e);
        return { ok: false, error: e.message };
    }
}

// Detail rows for ONE route (all expense records under given rte_id)
async function sbPkgGetExpensesSheet(params) {
    try {
        const sheetName = params.sheetName || params.sheet || params.rte_id;
        if (!sheetName) return { ok: false, error: 'Не вказано rte_id/sheetName' };

        const { data: routeRows, error: rErr } = await sb.from('routes')
            .select('id, rte_id, route_date, city, driver_name, vehicle_name, status')
            .eq('tenant_id', TENANT_ID)
            .eq('rte_id', sheetName)
            .limit(1);
        if (rErr) throw rErr;

        const routeInfo = (routeRows && routeRows[0]) || null;
        if (!routeInfo) {
            return { ok: true, data: { rows: [], headers: [], sheetName }, rows: [], headers: [], sheetName };
        }

        const { data: expRows, error: eErr } = await sb.from('expenses')
            .select('*')
            .eq('tenant_id', TENANT_ID)
            .eq('route_id', routeInfo.id)
            .order('created_at', { ascending: true });
        if (eErr) throw eErr;

        const rows = (expRows || []).map(r => expenseRowToGas(r, routeInfo));
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { ok: true, data: { rows, headers, sheetName }, rows, headers, sheetName };
    } catch (e) {
        console.error('sbPkgGetExpensesSheet error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// ROUTE POINTS (owner-configurable EU/UA addresses)
// ================================================================

// Returns active tenant-owned route points from passenger_route_points
// (same table owner-crm writes to via RoutePointsPanel). Used for the
// address-autocomplete dropdowns in the add-package form.
async function sbGetRoutePoints(params) {
    try {
        const routeGroup = (params && params.route_group) || 'ua-es-wed';
        const { data, error } = await sb
            .from('passenger_route_points')
            .select('id, route_group, name_ua, country_code, sort_order, location_name, lat, lon, maps_url, delivery_mode, active')
            .eq('tenant_id', TENANT_ID)
            .eq('route_group', routeGroup)
            .eq('active', true)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return { ok: true, data: data || [] };
    } catch (e) {
        console.error('sbGetRoutePoints error:', e);
        // Не фатально: CRM має працювати й без каталога (fallback — вільний текст)
        return { ok: true, data: [] };
    }
}

// ================================================================
// MAIN ROUTER — replaces apiPost()
// ================================================================

async function apiPostSupabase(action, params) {
    console.log('[Supabase Cargo API]', action);

    const handlers = {
        // Packages CRUD
        getAll:             sbPkgGetAll,
        getStats:           sbPkgGetStats,
        addParcel:          sbPkgAdd,
        updateField:        sbPkgUpdateField,
        getOne:             sbPkgGetOne,

        // Owner-configurable route points (address autocomplete)
        getRoutePoints:     sbGetRoutePoints,

        // Archive
        deleteParcel:       sbPkgDelete,
        getArchive:         sbPkgGetArchive,
        restoreFromArchive: sbPkgRestore,
        permanentDelete:    sbPkgPermanentDelete,

        // Routes
        getRoutesList:      sbPkgGetRoutesList,
        getRouteSheet:      sbPkgGetRouteSheet,
        setRouteOrder:      sbPkgSetRouteOrder,
        addToRoute:         sbPkgAddToRoute,
        removeFromRoute:    sbPkgRemoveFromRoute,
        updateRouteField:   sbPkgUpdateRouteField,
        updateRouteFields:  sbPkgUpdateRouteField,
        createRoute:        async (p) => {
            const name = (p.name || ('Маршрут_' + Date.now())).trim();
            const { data, error } = await sb.from('routes').insert({
                tenant_id: TENANT_ID,
                rte_id: name,
                is_placeholder: true,
                record_type: 'Посилка',
                direction: p.direction || '',
                route_date: new Date().toISOString().split('T')[0],
                status: 'Новий',
                crm_status: 'active',
            }).select();
            if (error) return { ok: false, error: error.message };
            return { ok: true, data: data && data[0], sheetName: name };
        },
        deleteRoute:        async (p) => {
            const name = (p.name || p.sheetName || '').trim();
            const { error } = await sb.from('routes').delete()
                .eq('tenant_id', TENANT_ID).eq('rte_id', name);
            if (error) return { ok: false, error: error.message };
            return { ok: true };
        },
        deleteFromSheet:    async (p) => {
            // p.id_col='RTE_ID' → id_val is row uuid
            const sheet = p.sheet || p.sheetName;
            const idCol = p.id_col;
            const idVal = p.id_val;
            let q = sb.from('routes').delete().eq('tenant_id', TENANT_ID);
            if (idCol === 'RTE_ID' && idVal) {
                q = q.eq('id', idVal);
            } else if ((idCol === 'PKG_ID' || idCol === 'PAX_ID') && idVal) {
                if (sheet) q = q.eq('rte_id', sheet);
                q = q.eq('pax_id_or_pkg_id', idVal);
            } else if (idCol && idVal) {
                if (sheet) q = q.eq('rte_id', sheet);
                const sbCol = ROUTE_GAS_TO_SB[idCol] || idCol;
                q = q.eq(sbCol, idVal);
            } else if (sheet) {
                q = q.eq('rte_id', sheet).eq('is_placeholder', false);
            }
            const { error } = await q;
            if (error) return { ok: false, error: error.message };
            return { ok: true };
        },
        deleteLinkedSheets: async (p) => {
            return { ok: true }; // No separate sheets in Supabase
        },

        // Dispatches (READ-ONLY — drivers create via driver-crm, manager only views)
        getDispatches:      sbPkgGetDispatches,
        getDispatchSheet:   sbPkgGetDispatchSheet,

        // Misc
        checkDuplicates:    sbPkgCheckDuplicates,
        getPayments:        sbPkgGetPayments,

        // Expenses (READ-ONLY — drivers enter via driver-crm)
        getExpenses:        sbPkgGetExpenses,        // legacy stub (flat list by pkg_id)
        getExpensesList:    sbPkgGetExpensesList,    // sidebar grouped by rte_id
        getExpensesSheet:   sbPkgGetExpensesSheet,   // detail rows for one rte_id

        // Verification workflow
        scanTTN:                    sbScanTTN,
        peekTTN:                    sbPeekTTN,
        findDuplicatesByRecipient:  sbFindDuplicatesByRecipient,
        assignRouteNumber:          sbAssignRouteNumber,
        completeVerification:       sbCompleteVerification,
        rejectVerification:         sbRejectVerification,

        // Nova Poshta tracking
        trackParcel:        sbPkgTrackParcel,
        checkNpApiKey:      sbPkgCheckNpApiKey,

        // Photos
        getPhotos:          sbPkgGetPhotos,
        addPhoto:           sbPkgAddPhoto,

        // Client chat / messenger
        getClientMessages:  sbGetClientMessages,
        sendManagerMessage: sbSendManagerMessage,
        getUnreadCounts:    sbGetUnreadCounts,
        markClientRead:     sbMarkClientRead,
        getOrderInfo:       async (p) => sbPkgGetOne(p),
        getVerificationStats: async () => {
            const { data } = await sb.from('packages')
                .select('quality_check_required')
                .eq('tenant_id', TENANT_ID)
                .eq('is_archived', false);
            const stats = { none: 0, 'В перевірці': 0, 'Готова до маршруту': 0, 'Відхилено': 0 };
            for (const r of (data || [])) {
                const s = r.quality_check_required || 'none';
                stats[s] = (stats[s] || 0) + 1;
            }
            return { ok: true, data: stats };
        },
    };

    const handler = handlers[action];
    if (!handler) {
        console.warn('[Supabase Cargo] Unknown action:', action);
        return { ok: false, error: 'Unknown action: ' + action };
    }

    try {
        return await handler(params);
    } catch (e) {
        console.error('[Supabase Cargo] Error in', action, ':', e);
        return { ok: false, error: e.message };
    }
}
