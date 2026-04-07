// ================================================================
// sb-api.js — Supabase API layer for Passenger CRM
// Replaces all Google Apps Script (GAS) API calls
// ================================================================

// ── COLUMN MAPPING: Supabase (English) ↔ GAS (Ukrainian) ──
// Frontend uses Ukrainian keys (from GAS). This layer translates.
const SB_TO_GAS = {
    pax_id:            'PAX_ID',
    smart_id:          'Ід_смарт',
    direction:         'Напрям',
    source_sheet:      'SOURCE_SHEET',
    booking_created_at:'Дата створення',
    full_name:         'Піб',
    phone:             'Телефон пасажира',
    registrar_phone:   'Телефон реєстратора',
    seats_count:       'Кількість місць',
    departure_address: 'Адреса відправки',
    arrival_address:   'Адреса прибуття',
    departure_date:    'Дата виїзду',
    departure_time:    'Таймінг',
    vehicle_name:      'Номер авто',
    seat_number:       'Місце в авто',
    rte_id:            'RTE_ID',
    ticket_price:      'Ціна квитка',
    ticket_currency:   'Валюта квитка',
    deposit:           'Завдаток',
    deposit_currency:  'Валюта завдатку',
    baggage_weight:    'Вага багажу',
    baggage_price:     'Ціна багажу',
    baggage_currency:  'Валюта багажу',
    debt:              'Борг',
    payment_status:    'Статус оплати',
    lead_status:       'Статус ліда',
    crm_status:        'Статус CRM',
    tag:               'Тег',
    notes:             'Примітка',
    sms_notes:         'Примітка СМС',
    cli_id:            'CLI_ID',
    booking_id:        'BOOKING_ID',
    archived_at:       'DATE_ARCHIVE',
    archived_by:       'ARCHIVED_BY',
    archive_reason:    'ARCHIVE_REASON',
    archive_id:        'ARCHIVE_ID',
    cal_id:            'CAL_ID',
    // Extra fields from Supabase not in GAS
    id:                '_uuid',
    tenant_id:         '_tenant',
    is_archived:       '_is_archived',
    created_at:        '_created_at',
    updated_at:        '_updated_at',
    vehicle_id:        '_vehicle_id',
    email:             'Email',
    payment_form:      'Форма оплати',
    driver_rating:     'Рейтинг водія',
    driver_comment:    'Коментар водія',
    manager_rating:    'Рейтинг менеджера',
    manager_comment:   'Коментар менеджера',
};

// Reverse mapping: GAS key → Supabase column
const GAS_TO_SB = {};
for (const [sb, gas] of Object.entries(SB_TO_GAS)) {
    GAS_TO_SB[gas] = sb;
}

// Calendar columns mapping
const SB_TO_GAS_CAL = {
    cal_id:             'CAL_ID',
    rte_id:             'RTE_ID',
    auto_id:            'AUTO_ID',
    vehicle_name:       'Назва авто',
    seating_layout:     'Тип розкладки',
    route_date:         'Дата рейсу',
    direction:          'Напрямок',
    city:               'Місто',
    total_seats:        'Макс. місць',
    available_seats:    'Вільні місця',
    occupied_seats:     'Зайняті місця',
    available_seats_list:'Список вільних',
    occupied_seats_list:'Список зайнятих',
    paired_calendar_id: 'PAIRED_CAL_ID',
    status:             'Статус рейсу',
};

const GAS_TO_SB_CAL = {};
for (const [sb, gas] of Object.entries(SB_TO_GAS_CAL)) {
    GAS_TO_SB_CAL[gas] = sb;
}

// Vehicle columns mapping
const SB_TO_GAS_AUTO = {
    auto_id:        'AUTO_ID',
    name:           'Назва авто',
    plate_number:   'Держ. номер',
    seating_layout: 'Тип розкладки',
    total_seats:    'Місткість',
    price_uah:      'Ціна UAH',
    price_chf:      'Ціна CHF',
    price_eur:      'Ціна EUR',
    price_pln:      'Ціна PLN',
    price_czk:      'Ціна CZK',
    price_usd:      'Ціна USD',
    status:         'Статус авто',
    notes:          'Примітка',
};

// ── DIRECTION NORMALIZER ──
// Frontend uses 'eu-ua'/'ua-eu', Supabase stores 'Європа-УК'/'Україна-ЄВ'
function normalizeDirection(dir) {
    if (!dir) return null;
    const d = String(dir).toLowerCase().trim();
    if (d === 'eu-ua' || d.includes('євро') || d.includes('eu')) return 'Європа-УК';
    if (d === 'ua-eu' || d.includes('укра') || d.includes('ua')) return 'Україна-ЄВ';
    return dir; // Return as-is if already correct
}

// ── TRANSFORM HELPERS ──

function sbToGasObj(sbRow, mapping) {
    const obj = {};
    for (const [sbKey, gasKey] of Object.entries(mapping || SB_TO_GAS)) {
        if (gasKey.startsWith('_')) continue; // Skip internal fields
        obj[gasKey] = sbRow[sbKey] !== null && sbRow[sbKey] !== undefined ? sbRow[sbKey] : '';
    }
    // Preserve _rowNum and _sheet for compatibility
    obj._uuid = sbRow.id;
    obj._sheet = sbRow.source_sheet || (sbRow.direction === 'Європа-УК' ? 'Європа-УК' : 'Україна-ЄВ');
    return obj;
}

// Frontend form keys (COL_MAP) → Supabase columns
const FORM_TO_SB = {
    name: 'full_name',
    phone: 'phone',
    phoneReg: 'registrar_phone',
    seats: 'seats_count',
    from: 'departure_address',
    to: 'arrival_address',
    date: 'departure_date',
    timing: 'departure_time',
    vehicle: 'vehicle_name',
    seatInCar: 'seat_number',
    seatNumber: 'seat_number',
    city: 'city',
    payForm: 'payment_form',
    price: 'ticket_price',
    currency: 'ticket_currency',
    deposit: 'deposit',
    currencyDeposit: 'deposit_currency',
    weight: 'baggage_weight',
    weightPrice: 'baggage_price',
    currencyWeight: 'baggage_currency',
    payStatus: 'payment_status',
    leadStatus: 'lead_status',
    crmStatus: 'crm_status',
    tag: 'tag',
    note: 'notes',
    noteSms: 'sms_notes',
    pax_id: 'pax_id',
    smartId: 'smart_id',
    direction: 'direction',
    calId: 'cal_id',
    rteId: 'rte_id',
    cliId: 'cli_id',
    bookingId: 'booking_id',
    sourceSheet: 'source_sheet',
    dateCreated: 'booking_created_at',
};

// Supabase columns that require numeric type
const NUMERIC_COLS = new Set([
    'seats_count', 'baggage_weight', 'ticket_price', 'deposit', 'debt',
    'baggage_price', 'seat_number', 'driver_rating', 'manager_rating',
    'total_seats', 'available_seats', 'occupied_seats',
]);

function gasToSbObj(gasObj, mapping) {
    const m = mapping || GAS_TO_SB;
    const obj = {};
    for (const [key, val] of Object.entries(gasObj)) {
        if (key.startsWith('_')) continue;
        // Try GAS mapping first, then form mapping, then pass through
        const sbKey = m[key] || FORM_TO_SB[key];
        if (sbKey) {
            let v = val === '' ? null : val;
            // Coerce numeric fields
            if (v !== null && NUMERIC_COLS.has(sbKey)) {
                const n = parseFloat(v);
                v = isNaN(n) ? null : n;
            }
            obj[sbKey] = v;
        }
    }
    return obj;
}

// Calculate debt (matches GAS calcDebt)
function calcDebt(obj) {
    const price = parseFloat(obj['Ціна квитка']) || 0;
    const wp = parseFloat(obj['Ціна багажу']) || 0;
    const dep = parseFloat(obj['Завдаток']) || 0;
    return Math.max(0, price + wp - dep);
}

// ── TENANT (from boti_session set by config-crm login) ──
// Falls back to 'gresco' only when no session yet (e.g. local dev). Production
// flow: user logs in via config-crm → boti_session in localStorage → tenant_id read here.
function _readTenantId() {
    try {
        const raw = localStorage.getItem('boti_session');
        if (!raw) return null;
        const s = JSON.parse(raw);
        return s && s.tenant_id ? s.tenant_id : null;
    } catch (_) { return null; }
}
const BOTI_SESSION = (() => { try { return JSON.parse(localStorage.getItem('boti_session') || 'null'); } catch (_) { return null; } })();
const TENANT_ID = _readTenantId() || 'gresco';

// Redirect to config-crm login if no session.
// Disable with ?nologinguard=1 for local dev / debugging.
if (!_readTenantId() && !location.search.includes('nologinguard=1')) {
    console.warn('[boti] no boti_session — redirecting to config-crm login');
    location.href = '../config-crm/';
}

// Logout: clear session and bounce to login
window.botiLogout = function () {
    localStorage.removeItem('boti_session');
    location.href = '../config-crm/';
};

// Inject a small floating session badge with logout button
(function injectSessionBadge() {
    const s = BOTI_SESSION;
    if (!s) return;
    function mount() {
        if (document.getElementById('boti-session-badge')) return;
        const el = document.createElement('div');
        el.id = 'boti-session-badge';
        el.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999;background:rgba(15,23,42,0.92);color:#fff;padding:8px 12px;border-radius:10px;font:12px/1.2 system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;backdrop-filter:blur(6px);';
        el.innerHTML = `
          <div style="line-height:1.3">
            <div style="font-weight:700;font-size:11px">${s.tenant_name || s.tenant_id}</div>
            <div style="opacity:0.7;font-size:10px">${s.user_name || s.user_login} · ${s.role}</div>
          </div>
          <button onclick="botiLogout()" style="background:#ef4444;color:#fff;border:none;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Вийти</button>
        `;
        document.body.appendChild(el);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();

// ================================================================
// PASSENGERS API
// ================================================================

async function sbGetAll(params) {
    try {
        let query = sb.from('passengers').select('*').eq('tenant_id', TENANT_ID);

        // Filter by archived status
        query = query.eq('is_archived', false);

        // Filter by direction
        if (params && params.filter && params.filter.dir && params.filter.dir !== 'all') {
            if (params.filter.dir === 'ua-eu') {
                query = query.ilike('direction', '%Укра%');
            } else if (params.filter.dir === 'eu-ua') {
                query = query.ilike('direction', '%Євро%');
            }
        }

        // Filter by status
        if (params && params.filter && params.filter.status) {
            query = query.eq('lead_status', params.filter.status);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        const results = data.map(row => {
            const obj = sbToGasObj(row);
            obj['Борг'] = calcDebt(obj);
            return obj;
        });

        return { ok: true, data: results };
    } catch (e) {
        console.error('sbGetAll error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbAddPassenger(params) {
    try {
        const gasData = params.data || params;
        const sbData = gasToSbObj(gasData);

        // Set defaults
        sbData.tenant_id = TENANT_ID;
        if (!sbData.pax_id) {
            sbData.pax_id = 'PAX' + Date.now();
        }
        sbData.booking_created_at = new Date().toISOString();
        sbData.is_archived = false;
        sbData.crm_status = sbData.crm_status || 'active';
        sbData.lead_status = sbData.lead_status || 'Новий';

        // Direction: derive from sheet param if not in data
        if (!sbData.direction && params.sheet) {
            sbData.direction = (params.sheet === 'eu' || params.sheet === 'Європа-УК')
                ? 'Європа-УК' : 'Україна-ЄВ';
        }
        // Normalize direction (eu-ua → Європа-УК, ua-eu → Україна-ЄВ)
        sbData.direction = normalizeDirection(sbData.direction);
        sbData.source_sheet = sbData.direction || 'Україна-ЄВ';

        const { data, error } = await sb.from('passengers').insert(sbData).select();
        if (error) throw error;

        const obj = sbToGasObj(data[0]);
        obj['Борг'] = calcDebt(obj);

        return { ok: true, data: obj, pax_id: data[0].pax_id };
    } catch (e) {
        console.error('sbAddPassenger error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbUpdatePassenger(params) {
    try {
        const paxId = params.pax_id || params.id;
        const gasData = params.data || params;
        const sbData = gasToSbObj(gasData);
        sbData.updated_at = new Date().toISOString();

        // Remove fields that shouldn't be updated
        delete sbData.id;
        delete sbData.tenant_id;
        delete sbData.pax_id;
        delete sbData.created_at;

        const { data, error } = await sb
            .from('passengers')
            .update(sbData)
            .eq('tenant_id', TENANT_ID)
            .eq('pax_id', paxId)
            .select();
        if (error) throw error;

        if (data && data[0]) {
            const obj = sbToGasObj(data[0]);
            obj['Борг'] = calcDebt(obj);
            return { ok: true, data: obj };
        }
        return { ok: true };
    } catch (e) {
        console.error('sbUpdatePassenger error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbUpdateField(params) {
    try {
        const paxId = params.pax_id;
        const gasCol = params.col;
        const value = params.value;

        // Convert GAS column name to Supabase column
        const sbCol = GAS_TO_SB[gasCol] || gasCol;
        if (!sbCol || sbCol.startsWith('_')) {
            return { ok: false, error: 'Unknown column: ' + gasCol };
        }

        const updateObj = {};
        updateObj[sbCol] = value === '' ? null : value;
        updateObj.updated_at = new Date().toISOString();

        // Recalculate debt if price/deposit changed
        if (['ticket_price', 'baggage_price', 'deposit'].includes(sbCol)) {
            const { data: current } = await sb
                .from('passengers')
                .select('ticket_price, baggage_price, deposit')
                .eq('tenant_id', TENANT_ID)
                .eq('pax_id', paxId)
                .single();
            if (current) {
                const merged = { ...current, ...updateObj };
                updateObj.debt = Math.max(0,
                    (parseFloat(merged.ticket_price) || 0) +
                    (parseFloat(merged.baggage_price) || 0) -
                    (parseFloat(merged.deposit) || 0)
                );
            }
        }

        const { data, error } = await sb
            .from('passengers')
            .update(updateObj)
            .eq('tenant_id', TENANT_ID)
            .eq('pax_id', paxId)
            .select();
        if (error) throw error;

        if (data && data[0]) {
            const obj = sbToGasObj(data[0]);
            obj['Борг'] = calcDebt(obj);
            return { ok: true, data: obj };
        }
        return { ok: true };
    } catch (e) {
        console.error('sbUpdateField error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbMoveDirection(params) {
    try {
        const paxId = params.pax_id;
        const rawDir = params.direction || params.newDirection || params.target_dir;

        const sbDir = normalizeDirection(rawDir);
        const sourceSheet = sbDir || 'Україна-ЄВ';

        const { data, error } = await sb
            .from('passengers')
            .update({ direction: sbDir, source_sheet: sourceSheet, updated_at: new Date().toISOString() })
            .eq('tenant_id', TENANT_ID)
            .eq('pax_id', paxId)
            .select();
        if (error) throw error;

        return { ok: true, data: data[0] ? sbToGasObj(data[0]) : null };
    } catch (e) {
        console.error('sbMoveDirection error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// ARCHIVE
// ================================================================

async function sbArchivePassenger(params) {
    try {
        const paxIds = params.pax_ids || (params.pax_id ? [params.pax_id] : []);
        const reason = params.reason || 'Архівовано';
        const manager = params.manager || '';

        const { data, error } = await sb
            .from('passengers')
            .update({
                is_archived: true,
                archived_at: new Date().toISOString(),
                archived_by: manager || null,
                archive_reason: reason,
                updated_at: new Date().toISOString()
            })
            .eq('tenant_id', TENANT_ID)
            .in('pax_id', paxIds)
            .select();
        if (error) throw error;

        return { ok: true, count: data.length };
    } catch (e) {
        console.error('sbArchivePassenger error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbDeletePassenger(params) {
    // Soft delete = archive with reason "Видалено"
    return sbArchivePassenger({
        ...params,
        reason: params.reason || 'Видалено'
    });
}

async function sbRestorePassenger(params) {
    try {
        const paxIds = params.pax_ids || (params.pax_id ? [params.pax_id] : []);

        const { data, error } = await sb
            .from('passengers')
            .update({
                is_archived: false,
                archived_at: null,
                archive_reason: null,
                updated_at: new Date().toISOString()
            })
            .eq('tenant_id', TENANT_ID)
            .in('pax_id', paxIds)
            .select();
        if (error) throw error;

        return { ok: true, count: data.length };
    } catch (e) {
        console.error('sbRestorePassenger error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbGetArchive(params) {
    try {
        const offset = params.offset || 0;
        const limit = params.limit || 50;

        const { data, error, count } = await sb
            .from('passengers')
            .select('*', { count: 'exact' })
            .eq('tenant_id', TENANT_ID)
            .eq('is_archived', true)
            .order('archived_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) throw error;

        const results = data.map(row => {
            const obj = sbToGasObj(row);
            obj['Борг'] = calcDebt(obj);
            return obj;
        });

        return { ok: true, rows: results, data: results, total: count, hasMore: (offset + limit) < count };
    } catch (e) {
        console.error('sbGetArchive error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// TRIPS (Calendar)
// ================================================================

async function sbGetTrips(params) {
    try {
        let query = sb.from('calendar').select('*').eq('tenant_id', TENANT_ID);

        if (params && params.filter) {
            if (params.filter.direction) query = query.eq('direction', params.filter.direction);
            if (params.filter.date) query = query.eq('route_date', params.filter.date);
        }

        const { data, error } = await query.order('route_date', { ascending: true });
        if (error) throw error;

        const results = data.map(row => ({ ...sbToGasObj(row, SB_TO_GAS_CAL), ...row }));
        return { ok: true, data: results };
    } catch (e) {
        console.error('sbGetTrips error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbCreateTrip(params) {
    try {
        const p = params.data || params;
        const city = p.city || p['Місто'] || '';
        const direction = p.dir || p.direction || p['Напрямок'] || '';
        const dates = Array.isArray(p.dates) && p.dates.length ? p.dates : [p.date || p['Дата рейсу']];
        const vehicles = Array.isArray(p.vehicles) && p.vehicles.length ? p.vehicles : [{ name: p.autoName || '', layout: p.layout || '', seats: parseInt(p.maxSeats) || 0 }];

        const toIso = (d) => {
            if (!d) return null;
            const s = String(d).trim();
            const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
            if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
            return s;
        };
        const rows = [];
        for (const d of dates) {
            for (const v of vehicles) {
                const totalSeats = parseInt(v.seats) || 0;
                rows.push({
                    tenant_id: TENANT_ID,
                    cal_id: 'CAL' + Date.now() + Math.floor(Math.random()*1000),
                    route_date: toIso(d),
                    direction: direction,
                    city: city,
                    status: 'Активний',
                    total_seats: totalSeats,
                    available_seats: totalSeats,
                    occupied_seats: 0,
                    available_seats_list: '',
                    occupied_seats_list: '',
                    vehicle_name: v.name || '',
                    seating_layout: v.layout || '',
                });
            }
        }

        const { data, error } = await sb.from('calendar').insert(rows).select();
        if (error) throw error;

        return { ok: true, data: data, cal_id: data[0]?.cal_id };
    } catch (e) {
        console.error('sbCreateTrip error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbUpdateTrip(params) {
    try {
        const calId = params.cal_id;
        const p = params.data || params;
        const sbData = {};
        const toIso = (d) => {
            if (!d) return null;
            const s = String(d).trim();
            const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
            return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : s;
        };

        if (p.city !== undefined || p['Місто'] !== undefined) sbData.city = p.city ?? p['Місто'];
        if (p.dir !== undefined || p.direction !== undefined || p['Напрямок'] !== undefined) sbData.direction = p.dir ?? p.direction ?? p['Напрямок'];
        if (Array.isArray(p.dates) && p.dates.length) sbData.route_date = toIso(p.dates[0]);
        else if (p['Дата рейсу'] !== undefined) sbData.route_date = toIso(p['Дата рейсу']);
        if (Array.isArray(p.vehicles) && p.vehicles.length) {
            const v = p.vehicles[0];
            sbData.vehicle_name = v.name || '';
            sbData.seating_layout = v.layout || '';
            const ts = parseInt(v.seats) || 0;
            sbData.total_seats = ts;
            sbData.available_seats = ts;
        }
        if (p['Статус рейсу'] !== undefined) sbData.status = p['Статус рейсу'];

        sbData.updated_at = new Date().toISOString();

        const { data, error } = await sb
            .from('calendar')
            .update(sbData)
            .eq('tenant_id', TENANT_ID)
            .eq('cal_id', calId)
            .select();
        if (error) throw error;

        return { ok: true, data: data[0] ? sbToGasObj(data[0], SB_TO_GAS_CAL) : null };
    } catch (e) {
        console.error('sbUpdateTrip error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbArchiveTrip(params) {
    try {
        const calId = params.cal_id;

        // Clear CAL_ID from passengers assigned to this trip
        await sb
            .from('passengers')
            .update({ cal_id: null, updated_at: new Date().toISOString() })
            .eq('tenant_id', TENANT_ID)
            .eq('cal_id', calId);

        // Delete the trip (or archive)
        const { error } = await sb
            .from('calendar')
            .delete()
            .eq('tenant_id', TENANT_ID)
            .eq('cal_id', calId);
        if (error) throw error;

        return { ok: true };
    } catch (e) {
        console.error('sbArchiveTrip error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbDeleteTrip(params) {
    try {
        const calId = params.cal_id;
        if (!calId) return { ok: false, error: 'CAL_ID порожній' };
        const { error } = await sb.from('calendar').delete().eq('tenant_id', TENANT_ID).eq('cal_id', calId);
        if (error) throw error;
        return { ok: true };
    } catch (e) {
        console.error('sbDeleteTrip error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbAssignTrip(params) {
    try {
        const calId = params.cal_id;
        const paxIds = params.pax_ids || [];

        // Update passengers with CAL_ID
        const { error } = await sb
            .from('passengers')
            .update({ cal_id: calId, updated_at: new Date().toISOString() })
            .eq('tenant_id', TENANT_ID)
            .in('pax_id', paxIds);
        if (error) throw error;

        // Update trip seat counts
        const { data: paxCount } = await sb
            .from('passengers')
            .select('pax_id', { count: 'exact' })
            .eq('tenant_id', TENANT_ID)
            .eq('cal_id', calId)
            .eq('is_archived', false);

        if (paxCount) {
            await sb
                .from('calendar')
                .update({
                    occupied_seats: paxCount.length,
                    updated_at: new Date().toISOString()
                })
                .eq('tenant_id', TENANT_ID)
                .eq('cal_id', calId);
        }

        return { ok: true };
    } catch (e) {
        console.error('sbAssignTrip error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbUnassignTrip(params) {
    try {
        const calId = params.cal_id;
        const paxIds = params.pax_ids || [];

        const { error } = await sb
            .from('passengers')
            .update({ cal_id: null, updated_at: new Date().toISOString() })
            .eq('tenant_id', TENANT_ID)
            .in('pax_id', paxIds);
        if (error) throw error;

        // Update trip seat counts
        const { data: remaining } = await sb
            .from('passengers')
            .select('pax_id')
            .eq('tenant_id', TENANT_ID)
            .eq('cal_id', calId)
            .eq('is_archived', false);

        await sb
            .from('calendar')
            .update({
                occupied_seats: remaining ? remaining.length : 0,
                updated_at: new Date().toISOString()
            })
            .eq('tenant_id', TENANT_ID)
            .eq('cal_id', calId);

        return { ok: true };
    } catch (e) {
        console.error('sbUnassignTrip error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// ROUTES
// ================================================================

// Centralized GAS ↔ SB mapping for routes table (all text columns)
const ROUTE_GAS_TO_SB = {
    'RTE_ID':             'rte_id',
    'Тип запису':         'record_type',
    'Напрям':             'direction',
    'PAX_ID':             'pax_id_or_pkg_id',
    'PKG_ID':             'pax_id_or_pkg_id',
    'Дата рейсу':         'route_date',
    'Таймінг':            'timing',
    'Номер авто':         'vehicle_name',
    'AUTO_ID':            'vehicle_id',
    'Водій':              'driver_name',
    'Телефон водія':      'driver_phone',
    'Місто':              'city',
    'Місце в авто':       'seat_number',
    'Піб пасажира':       'passenger_name',
    'Піб':                'passenger_name',
    'Телефон пасажира':   'passenger_phone',
    'Піб відправника':    'sender_name',
    'Піб отримувача':     'recipient_name',
    'Телефон отримувача': 'recipient_phone',
    'Адреса отримувача':  'recipient_address',
    'Адреса відправки':   'departure_address',
    'Адреса прибуття':    'arrival_address',
    'Кількість місць':    'seats_count',
    'Вага багажу':        'baggage_weight',
    'Внутрішній №':       'internal_number',
    'Номер ТТН':          'ttn_number',
    'Опис посилки':       'package_description',
    'Вага посилки':       'package_weight',
    'Сума':               'amount',
    'Ціна квитка':        'amount',
    'Валюта':             'amount_currency',
    'Валюта квитка':      'amount_currency',
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
        if (item[gasKey] !== undefined && item[gasKey] !== null && item[gasKey] !== '') {
            row[sbCol] = String(item[gasKey]);
        }
    }
    return row;
}

async function sbGetRoutesList(params) {
    try {
        const { data, error } = await sb
            .from('routes')
            .select('rte_id, record_type, direction, is_placeholder')
            .eq('tenant_id', TENANT_ID);
        if (error) throw error;

        const routeMap = {};
        data.forEach(row => {
            const name = row.rte_id || 'Маршрут';
            if (!routeMap[name]) {
                routeMap[name] = { sheetName: name, rowCount: 0, paxCount: 0, parcelCount: 0 };
            }
            if (row.is_placeholder) return; // don't count placeholder
            routeMap[name].rowCount++;
            if (row.record_type === 'Пасажир' || row.record_type === 'Passenger') {
                routeMap[name].paxCount++;
            } else {
                routeMap[name].parcelCount++;
            }
        });

        return { ok: true, data: Object.values(routeMap) };
    } catch (e) {
        console.error('sbGetRoutesList error:', e);
        return { ok: false, error: e.message };
    }
}

// Transform Supabase route row → GAS frontend format
function routeRowToGas(r) {
    return {
        '_uuid':              r.id,
        'RTE_ID':             r.id || '',
        'SHEET_NAME':         r.rte_id || '',
        'Тип запису':         (r.record_type === 'Passenger' || r.record_type === 'Пасажир') ? 'Пасажир' : 'Посилка',
        'Напрям':             r.direction || '',
        'PAX_ID':             r.pax_id_or_pkg_id || '',
        'PKG_ID':             r.pax_id_or_pkg_id || '',
        'Дата рейсу':         r.route_date || '',
        'Таймінг':            r.timing || '',
        'Номер авто':         r.vehicle_name || '',
        'AUTO_ID':            r.vehicle_id || '',
        'Водій':              r.driver_name || '',
        'Телефон водія':      r.driver_phone || '',
        'Місто':              r.city || '',
        'Місце в авто':       r.seat_number || '',
        'Піб пасажира':       r.passenger_name || '',
        'Телефон пасажира':   r.passenger_phone || '',
        'Піб відправника':    r.sender_name || '',
        'Піб отримувача':     r.recipient_name || '',
        'Телефон отримувача': r.recipient_phone || '',
        'Адреса отримувача':  r.recipient_address || '',
        'Адреса відправки':   r.departure_address || '',
        'Адреса прибуття':    r.arrival_address || '',
        'Кількість місць':    r.seats_count || '',
        'Вага багажу':        r.baggage_weight || '',
        'Внутрішній №':       r.internal_number || '',
        'Номер ТТН':          r.ttn_number || '',
        'Опис посилки':       r.package_description || '',
        'Вага посилки':       r.package_weight || '',
        'Сума':               r.amount || '',
        'Валюта':             r.amount_currency || '',
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

async function sbGetRouteSheet(params) {
    try {
        const sheetName = params.sheetName || params.sheet;

        const { data, error } = await sb
            .from('routes')
            .select('*')
            .eq('tenant_id', TENANT_ID)
            .eq('rte_id', sheetName)
            .eq('is_placeholder', false)
            .order('created_at', { ascending: true });
        if (error) throw error;

        const rows = (data || []).map(routeRowToGas);
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

        return { ok: true, data: { rows: rows, headers: headers, sheetName: sheetName }, rows: rows, headers: headers, sheetName: sheetName };
    } catch (e) {
        console.error('sbGetRouteSheet error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbUpdateRouteField(params) {
    try {
        const rteId = params.rte_id;
        const updateObj = {};

        if (params.fields) {
            for (const [col, val] of Object.entries(params.fields)) {
                const sbCol = ROUTE_GAS_TO_SB[col] || col;
                updateObj[sbCol] = (val === '' || val === undefined) ? null : String(val);
            }
        } else {
            const col = params.col;
            const sbCol = ROUTE_GAS_TO_SB[col] || col;
            updateObj[sbCol] = (params.value === '' || params.value === undefined) ? null : String(params.value);
        }

        updateObj.updated_at = new Date().toISOString();

        const { data, error } = await sb
            .from('routes')
            .update(updateObj)
            .eq('tenant_id', TENANT_ID)
            .eq('id', rteId)
            .select();
        if (error) throw error;

        return { ok: true, data: data[0] };
    } catch (e) {
        console.error('sbUpdateRouteField error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbAddToRoute(params) {
    try {
        const rteId = params.sheetName || params.sheet_name || params.rte_id || ('Маршрут_' + Date.now());
        const leads = params.leads || params.items || [params];

        const insertData = leads.map(item => {
            const row = gasItemToRouteRow(item);
            row.rte_id = rteId;
            if (!row.record_type) row.record_type = 'Пасажир';
            return row;
        });

        const { data, error } = await sb.from('routes').insert(insertData).select();
        if (error) throw error;

        return { ok: true, data: data };
    } catch (e) {
        console.error('sbAddToRoute error:', e);
        return { ok: false, error: e.message };
    }
}

async function sbDeleteFromSheet(params) {
    try {
        // Frontend: { sheet: 'Маршрут 1', id_col: 'PAX_ID'|'RTE_ID', id_val: '...' }
        const sheet = params.sheet || params.sheetName;
        const idCol = params.id_col;
        const idVal = params.id_val;

        let query = sb.from('routes').delete().eq('tenant_id', TENANT_ID);

        if (idCol === 'RTE_ID' && idVal) {
            // RTE_ID is now per-row uuid
            query = query.eq('id', idVal);
        } else if (idCol === 'PAX_ID' || idCol === 'PKG_ID') {
            if (sheet) query = query.eq('rte_id', sheet);
            query = query.eq('pax_id_or_pkg_id', idVal);
        } else if (idCol && idVal) {
            if (sheet) query = query.eq('rte_id', sheet);
            const sbCol = ROUTE_GAS_TO_SB[idCol] || idCol;
            query = query.eq(sbCol, idVal);
        } else if (sheet) {
            // No id specified — delete all non-placeholder rows of this sheet
            query = query.eq('rte_id', sheet).eq('is_placeholder', false);
        }

        const { error } = await query;
        if (error) throw error;

        return { ok: true };
    } catch (e) {
        console.error('sbDeleteFromSheet error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// AUTOPARK
// ================================================================

async function sbGetAutopark(params) {
    try {
        const { data, error } = await sb
            .from('vehicles')
            .select('*')
            .eq('tenant_id', TENANT_ID)
            .order('name');
        if (error) throw error;

        const results = data.map(row => sbToGasObj(row, SB_TO_GAS_AUTO));
        return { ok: true, data: results };
    } catch (e) {
        console.error('sbGetAutopark error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// PRESENCE (Online managers)
// ================================================================

// Use Supabase Realtime Presence instead of polling
let presenceChannel = null;

async function sbHeartbeat(params) {
    try {
        if (!presenceChannel) {
            presenceChannel = sb.channel('online-managers');
            presenceChannel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({
                        name: params.manager || '',
                        device: params.device || navigator.userAgent,
                        ts: new Date().toISOString()
                    });
                }
            });
        } else {
            await presenceChannel.track({
                name: params.manager || '',
                device: params.device || navigator.userAgent,
                ts: new Date().toISOString()
            });
        }
        return { ok: true };
    } catch (e) {
        console.error('sbHeartbeat error:', e);
        return { ok: true }; // Don't fail on presence errors
    }
}

async function sbGetOnlineManagers(params) {
    try {
        if (!presenceChannel) {
            return { ok: true, data: [] };
        }
        const state = presenceChannel.presenceState();
        const managers = [];
        for (const [key, presences] of Object.entries(state)) {
            for (const p of presences) {
                managers.push({
                    name: p.name,
                    device: p.device,
                    ts: p.ts
                });
            }
        }
        return { ok: true, data: managers };
    } catch (e) {
        console.error('sbGetOnlineManagers error:', e);
        return { ok: true, data: [] };
    }
}

// ================================================================
// PAYMENTS
// ================================================================

async function sbGetPayments(params) {
    try {
        const paxId = params.pax_id;
        const { data, error } = await sb
            .from('payments')
            .select('*')
            .eq('passenger_id', paxId)
            .order('created_at', { ascending: false });
        if (error) throw error;

        return { ok: true, data: data || [] };
    } catch (e) {
        console.error('sbGetPayments error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// EXPENSES
// ================================================================

async function sbGetExpenses(params) {
    try {
        const sheetName = params.sheetName;
        const { data, error } = await sb
            .from('expenses')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;

        return { ok: true, data: data || [] };
    } catch (e) {
        console.error('sbGetExpenses error:', e);
        return { ok: false, error: e.message };
    }
}

// ================================================================
// MAIN ROUTER — replaces apiPost()
// ================================================================

async function apiPostSupabase(action, data) {
    console.log('[Supabase API]', action);

    const handlers = {
        // Passengers
        getAll:             sbGetAll,
        addPassenger:       sbAddPassenger,
        updatePassenger:    sbUpdatePassenger,
        updateField:        sbUpdateField,
        moveDirection:      sbMoveDirection,
        clonePassenger:     sbAddPassenger, // clone = add with existing data
        checkDuplicates:    async (p) => {
            const { data } = await sb.from('passengers')
                .select('pax_id, full_name, phone')
                .eq('tenant_id', TENANT_ID)
                .or(`phone.eq.${p.phone},full_name.ilike.%${p.name}%`)
                .eq('is_archived', false)
                .limit(10);
            // Map to GAS keys for frontend compatibility
            const mapped = (data || []).map(r => ({
                'PAX_ID': r.pax_id,
                'Піб': r.full_name,
                'Телефон пасажира': r.phone
            }));
            return { ok: true, data: mapped };
        },

        // Archive
        archivePassenger:   sbArchivePassenger,
        deletePassenger:    sbDeletePassenger,
        restorePassenger:   sbRestorePassenger,
        getArchive:         sbGetArchive,
        deleteFromArchive:  async () => ({ ok: false, error: 'Видалення з архіву заблоковано' }),

        // Trips
        getTrips:           sbGetTrips,
        createTrip:         sbCreateTrip,
        updateTrip:         sbUpdateTrip,
        archiveTrip:        sbArchiveTrip,
        deleteTrip:         sbDeleteTrip,
        deleteTripPermanent: sbDeleteTrip,
        assignTrip:         sbAssignTrip,
        unassignTrip:       sbUnassignTrip,
        duplicateTrip:      async (p) => {
            const { data } = await sb.from('calendar').select('*').eq('tenant_id', TENANT_ID).eq('cal_id', p.cal_id).single();
            if (!data) return { ok: false, error: 'Trip not found' };
            const newTrip = { ...data, cal_id: 'CAL' + Date.now(), id: undefined, created_at: undefined };
            if (p.date) newTrip.route_date = p.date;
            return sbCreateTrip({ data: newTrip });
        },

        // Routes
        getRoutesList:      sbGetRoutesList,
        getRouteSheet:      sbGetRouteSheet,
        updateRouteField:   sbUpdateRouteField,
        updateRouteFields:  sbUpdateRouteField,
        addToRoute:         sbAddToRoute,
        deleteFromSheet:    sbDeleteFromSheet,
        createRoute:        async (p) => {
            // Create a placeholder route row so getRoutesList returns it
            const name = (p.name || ('Маршрут_' + Date.now())).trim();
            const { error } = await sb.from('routes').insert({
                tenant_id: TENANT_ID,
                rte_id: name,
                is_placeholder: true,
                record_type: 'Пасажир',
                direction: p.direction || '',
                route_date: new Date().toISOString().split('T')[0],
                status: 'scheduled',
                crm_status: 'active',
            });
            if (error) return { ok: false, error: error.message };
            return { ok: true, sheetName: name };
        },
        deleteRoute:        async (p) => {
            const name = (p.name || p.sheetName || '').trim();
            const { error } = await sb.from('routes').delete()
                .eq('tenant_id', TENANT_ID).eq('rte_id', name);
            if (error) return { ok: false, error: error.message };
            return { ok: true };
        },
        deleteLinkedSheets: async (p) => ({ ok: true }),

        // Autopark
        getAutopark:        sbGetAutopark,

        // Presence
        heartbeat:          sbHeartbeat,
        getOnlineManagers:  sbGetOnlineManagers,

        // Payments
        getPayments:        sbGetPayments,

        // Expenses
        getExpenses:        sbGetExpenses,

        // Misc
        logOnboarding:      async (p) => ({ ok: true }), // TODO: implement logging
        getStats:           async () => {
            const { data } = await sb.from('passengers')
                .select('lead_status, direction, debt')
                .eq('tenant_id', TENANT_ID)
                .eq('is_archived', false);
            return { ok: true, data: data || [] };
        },
    };

    const handler = handlers[action];
    if (!handler) {
        console.warn('Unknown Supabase action:', action);
        return { ok: false, error: 'Unknown action: ' + action };
    }

    return handler(data || {});
}
