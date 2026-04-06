// ================================================================
// supabase-api.js — Supabase API layer for Cargo CRM
// Replaces all Google Apps Script (GAS) API calls
// ================================================================

// ── COLUMN MAPPING: Supabase (English) ↔ GAS (Ukrainian) ──
const SB_TO_GAS_PKG = {
    pkg_id:             'PKG_ID',
    smart_id:           'Ід_смарт',
    direction:          'Напрям',
    source_sheet:       'SOURCE_SHEET',
    created_at:         'Дата створення',
    sender_name:        'Піб відправника',
    registrar_phone:    'Телефон реєстратора',
    sender_phone:       'Телефон реєстратора',
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
    vehicle_name:       'Номер авто',
    rte_id:             'RTE_ID',
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
    archive_id:         'ARCHIVE_ID',
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
    if (d === 'eu' || d === 'eu-ua' || d.includes('євро')) return 'Європа-УК';
    if (d === 'ue' || d === 'ua-eu' || d.includes('укра')) return 'Україна-ЄВ';
    return dir;
}

// ── NUMERIC COLUMNS ──
const NUMERIC_COLS_PKG = new Set([
    'item_count', 'weight_kg', 'estimated_value', 'np_amount',
    'total_amount', 'deposit', 'debt', 'rating',
]);

// ── TRANSFORM HELPERS ──

function sbToGasObjPkg(sbRow) {
    const obj = {};
    for (const [sbKey, gasKey] of Object.entries(SB_TO_GAS_PKG)) {
        obj[gasKey] = sbRow[sbKey] !== null && sbRow[sbKey] !== undefined ? sbRow[sbKey] : '';
    }
    obj._uuid = sbRow.id;
    obj._sheet = sbRow.source_sheet || (sbRow.direction === 'Європа-УК' ? 'Європа-УК' : 'Україна-ЄВ');
    return obj;
}

function gasToSbObjPkg(gasObj) {
    const obj = {};
    for (const [key, val] of Object.entries(gasObj)) {
        if (key.startsWith('_')) continue;
        const sbKey = GAS_TO_SB_PKG[key] || key;
        if (sbKey && SB_TO_GAS_PKG[sbKey] !== undefined) {
            let v = val === '' ? null : val;
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
        query = query.eq('is_archived', false);

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
            .eq('is_archived', false);
        if (error) throw error;

        const stats = { total: data.length, byLeadStatus: {}, byPayStatus: {}, byPkgStatus: {}, totalDebt: 0 };
        for (const row of data) {
            stats.byLeadStatus[row.lead_status || 'Новий'] = (stats.byLeadStatus[row.lead_status || 'Новий'] || 0) + 1;
            stats.byPayStatus[row.payment_status || 'Не оплачено'] = (stats.byPayStatus[row.payment_status || 'Не оплачено'] || 0) + 1;
            stats.byPkgStatus[row.package_status || '—'] = (stats.byPkgStatus[row.package_status || '—'] || 0) + 1;
            stats.totalDebt += Math.max(0, (parseFloat(row.total_amount) || 0) - (parseFloat(row.deposit) || 0));
        }
        return { ok: true, data: stats };
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
        sbData.created_at = new Date().toISOString();
        sbData.is_archived = false;
        sbData.crm_status = sbData.crm_status || 'Активний';
        sbData.lead_status = sbData.lead_status || 'Новий';

        // Direction from sheet param
        if (!sbData.direction && params.sheet) {
            sbData.direction = normalizeDirection(params.sheet);
        }
        sbData.direction = normalizeDirection(sbData.direction) || 'Україна-ЄВ';
        sbData.source_sheet = sbData.direction;

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
        updateObj[sbCol] = value === '' ? null : value;
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

        return { ok: true, data: results };
    } catch (e) {
        console.error('sbPkgGetArchive error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// ROUTES API (for cargo)
// ================================================================

async function sbPkgGetRoutesList(params) {
    try {
        const { data, error } = await sb.from('routes')
            .select('*')
            .eq('tenant_id', TENANT_ID)
            .order('created_at', { ascending: false });
        if (error) throw error;

        const results = (data || []).map(r => ({
            sheetName: r.rte_id || r.id,
            rowCount: 0,
            paxCount: 0,
            parcelCount: 0,
        }));

        return { ok: true, data: results };
    } catch (e) {
        console.error('sbPkgGetRoutesList error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgGetRouteSheet(params) {
    try {
        const sheetName = params.sheetName || params.sheet;
        const { data, error } = await sb.from('routes')
            .select('*')
            .eq('rte_id', sheetName);
        if (error) throw error;

        return { ok: true, data: data || [], headers: Object.keys(SB_TO_GAS_PKG) };
    } catch (e) {
        console.error('sbPkgGetRouteSheet error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgAddToRoute(params) {
    try {
        const pkgId = params.pkg_id;
        const rteId = params.rte_id || params.sheet_name;

        if (pkgId) {
            const { error } = await sb.from('packages')
                .update({ rte_id: rteId, updated_at: new Date().toISOString() })
                .eq('pkg_id', pkgId);
            if (error) throw error;
        }

        return { ok: true };
    } catch (e) {
        console.error('sbPkgAddToRoute error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgRemoveFromRoute(params) {
    try {
        const pkgId = params.pkg_id;
        const { error } = await sb.from('packages')
            .update({
                rte_id: null,
                vehicle_name: null,
                dispatch_date: null,
                updated_at: new Date().toISOString()
            })
            .eq('pkg_id', pkgId);
        if (error) throw error;

        return { ok: true };
    } catch (e) {
        console.error('sbPkgRemoveFromRoute error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbPkgUpdateRouteField(params) {
    try {
        const rteId = params.rte_id;
        const updateObj = {};

        if (params.fields) {
            for (const [col, val] of Object.entries(params.fields)) {
                const sbCol = GAS_TO_SB_PKG[col] || col;
                updateObj[sbCol] = val === '' ? null : val;
            }
        } else {
            const sbCol = GAS_TO_SB_PKG[params.col] || params.col;
            updateObj[sbCol] = params.value === '' ? null : params.value;
        }
        updateObj.updated_at = new Date().toISOString();

        const { data, error } = await sb.from('routes')
            .update(updateObj).eq('rte_id', rteId).select();
        if (error) throw error;

        return { ok: true, data: data[0] };
    } catch (e) {
        console.error('sbPkgUpdateRouteField error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// DISPATCHES API
// ================================================================

async function sbPkgUpdateDispatch(params) {
    try {
        const dispatchId = params.dispatch_id;
        const sbCol = GAS_TO_SB_PKG[params.col] || params.col;
        const updateObj = {};
        updateObj[sbCol] = params.value === '' ? null : params.value;
        updateObj.updated_at = new Date().toISOString();

        const { data, error } = await sb.from('dispatches')
            .update(updateObj).eq('dispatch_id', dispatchId).select();
        if (error) throw error;

        return { ok: true, data: data[0] };
    } catch (e) {
        console.error('sbPkgUpdateDispatch error:', e);
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
            const { data, error } = await sb.from('routes').insert({
                tenant_id: TENANT_ID,
                rte_id: p.name,
                record_type: 'Посилка',
                direction: '',
                route_date: new Date().toISOString().split('T')[0],
            }).select();
            if (error) return { ok: false, error: error.message };
            return { ok: true, data: data[0] };
        },
        deleteRoute:        async (p) => {
            const { error } = await sb.from('routes').delete().eq('rte_id', p.name);
            if (error) return { ok: false, error: error.message };
            return { ok: true };
        },
        deleteFromSheet:    async (p) => {
            const { error } = await sb.from('routes').delete().eq('rte_id', p.id_val || p.rte_id);
            if (error) return { ok: false, error: error.message };
            return { ok: true };
        },
        deleteLinkedSheets: async (p) => {
            return { ok: true }; // No separate sheets in Supabase
        },

        // Dispatches
        updateDispatch:     sbPkgUpdateDispatch,
        getDispatches:      async (p) => {
            const { data, error } = await sb.from('dispatches').select('*');
            if (error) return { ok: false, error: error.message };
            return { ok: true, data: data || [] };
        },

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
