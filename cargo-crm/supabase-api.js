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
    'refused': 'Відмова', 'active': 'Активний', 'archived': 'Архів',
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

function gasToSbObjPkg(gasObj) {
    const obj = {};
    for (const [key, val] of Object.entries(gasObj)) {
        if (key.startsWith('_')) continue;
        const sbKey = GAS_TO_SB_PKG[key] || FORM_TO_SB_PKG[key] || key;
        if (sbKey && SB_TO_GAS_PKG[sbKey] !== undefined) {
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
const TENANT_ID = 'gresco';

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

        const results = data.map(row => {
            const obj = sbToGasObjPkg(row);
            obj['Борг'] = calcDebtPkg(obj);
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

async function sbPkgUpdateField(params) {
    try {
        const pkgId = params.pkg_id;
        const gasCol = params.col;
        const value = params.value;

        const sbCol = GAS_TO_SB_PKG[gasCol] || gasCol;
        if (!sbCol) return { ok: false, error: 'Unknown column: ' + gasCol };

        const updateObj = {};
        let v = value === '' ? null : value;
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

        const { data, error } = await sb.from('packages')
            .update({
                is_archived: true,
                archived_at: new Date().toISOString(),
                archived_by: manager,
                archive_reason: reason,
                updated_at: new Date().toISOString()
            })
            .in('pkg_id', pkgIds)
            .select();
        if (error) throw error;

        return { ok: true, count: data.length };
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
    'Піб відправника':    'sender_name',
    'Телефон відправника':'passenger_phone',
    'Адреса відправки':   'departure_address',
    'Піб отримувача':     'recipient_name',
    'Телефон отримувача': 'recipient_phone',
    'Адреса отримувача':  'recipient_address',
    'Адреса в Європі':    'recipient_address',
    'Адреса прибуття':    'arrival_address',
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
        'Піб відправника':    r.sender_name || '',
        'Телефон відправника':r.passenger_phone || '',
        'Адреса відправки':   r.departure_address || '',
        'Піб отримувача':     r.recipient_name || '',
        'Телефон отримувача': r.recipient_phone || '',
        'Адреса отримувача':  r.recipient_address || '',
        'Адреса в Європі':    r.recipient_address || '',
        'Внутрішній №':       r.internal_number || '',
        'Номер ТТН':          r.ttn_number || '',
        'Опис':               r.package_description || '',
        'Опис посилки':       r.package_description || '',
        'Кг':                 r.package_weight || '',
        'Вага посилки':       r.package_weight || '',
        'Сума':               r.amount || '',
        'Валюта оплати':      r.amount_currency || '',
        'Завдаток':           r.deposit || '',
        'Валюта завдатку':    r.deposit_currency || '',
        'Форма оплати':       r.payment_form || '',
        'Статус оплати':      r.payment_status || '',
        'Борг':               r.debt || '',
        'Примітка оплати':    r.payment_notes || '',
        'Статус':             r.status || '',
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

        // Also include dispatches grouped by rte_id (for Cargo.js sidebar).
        const dispRes = await sbPkgGetDispatches();
        const dispatches = dispRes.ok ? (dispRes.data || []) : [];

        const routes = Object.values(routeMap);
        return { ok: true, data: routes, routes, dispatches };
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

        return { ok: true, data: { rows, headers, sheetName }, rows, headers, sheetName };
    } catch (e) {
        console.error('sbPkgGetRouteSheet error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgAddToRoute(params) {
    try {
        const rteId = params.sheetName || params.sheet_name || params.rte_id || params.route_id;
        if (!rteId) return { ok: false, error: 'Не вказано назву маршруту' };

        const leads = params.leads || params.items || [params];
        const insertData = leads.map(item => {
            const row = gasItemToRouteRow(item);
            row.rte_id = rteId;
            if (!row.record_type) row.record_type = 'Посилка';
            if (!row.route_date) row.route_date = new Date().toISOString().split('T')[0];
            return row;
        });

        const { data, error } = await sb.from('routes').insert(insertData).select();
        if (error) throw error;

        return { ok: true, data };
    } catch (e) {
        console.error('sbPkgAddToRoute error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgRemoveFromRoute(params) {
    try {
        // Frontend may pass row uuid (from RTE_ID column)
        const rowId = params.rte_id || params.id || params.pkg_id;
        if (!rowId) return { ok: false, error: 'Не вказано id рядка' };
        const { error } = await sb.from('routes').delete()
            .eq('tenant_id', TENANT_ID)
            .eq('id', rowId)
            .eq('is_placeholder', false);
        if (error) throw error;
        return { ok: true };
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

        if (params.fields) {
            for (const [col, val] of Object.entries(params.fields)) {
                const sbCol = ROUTE_GAS_TO_SB[col] || col;
                updateObj[sbCol] = (val === '' || val === undefined) ? null : String(val);
            }
        } else {
            const sbCol = ROUTE_GAS_TO_SB[params.col] || params.col;
            updateObj[sbCol] = (params.value === '' || params.value === undefined) ? null : String(params.value);
        }
        updateObj.updated_at = new Date().toISOString();

        const { data, error } = await sb.from('routes')
            .update(updateObj).eq('id', rowId).select();
        if (error) throw error;

        return { ok: true, data: data && data[0] };
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
        const { data } = await sb.from('packages')
            .select('pkg_id, sender_name, sender_phone, recipient_name, recipient_phone')
            .or(`sender_phone.eq.${params.phone},sender_name.ilike.%${params.pib}%`)
            .eq('is_archived', false)
            .limit(10);

        const mapped = (data || []).map(r => ({
            'PKG_ID': r.pkg_id,
            'Піб відправника': r.sender_name,
            'Телефон реєстратора': r.sender_phone,
            'Піб отримувача': r.recipient_name,
            'Телефон отримувача': r.recipient_phone,
        }));

        return { ok: true, data: mapped };
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

async function sbPkgGetExpenses(params) {
    try {
        const { data, error } = await sb.from('expenses')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return { ok: true, data: data || [] };
    } catch (e) {
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

        // Archive
        deleteParcel:       sbPkgDelete,
        getArchive:         sbPkgGetArchive,
        restoreFromArchive: sbPkgRestore,
        permanentDelete:    sbPkgPermanentDelete,

        // Routes
        getRoutesList:      sbPkgGetRoutesList,
        getRouteSheet:      sbPkgGetRouteSheet,
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
                status: 'scheduled',
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
        getExpenses:        sbPkgGetExpenses,

        // Verification (update fields)
        scanTTN:            async (p) => {
            const { data } = await sb.from('packages')
                .select('*').eq('ttn_number', p.ttn).eq('is_archived', false).limit(1);
            if (data && data.length > 0) {
                const obj = sbToGasObjPkg(data[0]);
                obj['Борг'] = calcDebtPkg(obj);
                return { ok: true, found: true, data: obj };
            }
            return { ok: true, found: false };
        },

        // Not implemented (stubs)
        trackParcel:        async () => ({ ok: true, data: null }),
        checkNpApiKey:      async () => ({ ok: true, data: { hasKey: false } }),
        getClientMessages:  async () => ({ ok: true, data: [] }),
        sendManagerMessage: async () => ({ ok: true }),
        getUnreadCounts:    async () => ({ ok: true, data: {} }),
        markClientRead:     async () => ({ ok: true }),
        getPhotos:          async () => ({ ok: true, data: [] }),
        addPhoto:           async () => ({ ok: true }),
        getOrderInfo:       async (p) => sbPkgGetOne(p),
        getVerificationStats: async () => {
            const { data } = await sb.from('packages')
                .select('quality_check_required')
                .eq('is_archived', false);
            const stats = {};
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
