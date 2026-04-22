#!/usr/bin/env python3
# ============================================================================
# generate-esco-phase3.py — passengers + archive_passengers (tenant='esco')
# ============================================================================
#
# ДЖЕРЕЛО
#   PerenosTablu/Passengers_crm_v4shets 1.xlsx
#     → 'Україна-ЄВ' (34)  ┐
#     → 'Європа-УК'  (50)  ┴─→ public.passengers (84)
#
#   PerenosTablu/Archive_crm_v3.xlsx
#     → 'Пасажири' (84) → public.archive_passengers
#
# ЗМІНА СХЕМИ
#   ALTER TABLE archive_passengers ADD COLUMN IF NOT EXISTS extra_data jsonb
#     (xlsx має 45 колонок, а БД-архів — 34; extra_data зберігає решту:
#      Напрям, CAL_ID, CLI_ID, RTE_ID, Таймінг, AUTO_ID, валюти багажу,
#      коментарі, форма оплати, archived_by_name, action_type_raw тощо).
#
# ЛОГІКА passengers
#   - direction = з xlsx 'Напрям' (вже 'Україна-ЄВ' / 'Європа-УК')
#   - vehicle_id = LOOKUP: (SELECT id FROM vehicles WHERE tenant_id='esco'
#                           AND TRIM(name)=TRIM('<Номер авто>') LIMIT 1)
#     Один пасажир → одне авто через назву ('Цюрих'/'Женева'). Якщо такої
#     назви нема — NULL (пасажир лишається без FK, але з vehicle_name для info).
#   - cal_id = text, як є (CAL-20260403-Y1TE).
#   - cli_id = NULL (усі 84 пасажири у xlsx без CLI_ID).
#   - lead_status = з xlsx 'Статус ліда' ('Новий'/'Підтверджено'/'В роботі').
#   - Рейтинги (driver/manager_rating) — to_rating(): 0→NULL, >5→NULL+raw_у_notes.
#   - Дати '#VALUE!' → NULL з записом в notes.
#
# ЛОГІКА archive_passengers
#   - archive_id, pax_id, full_name, phone, ... — 1:1 на колонки БД.
#   - action_type: з xlsx 'Тип дії', якщо None → 'archive' (NOT NULL).
#   - archived_by: NULL (xlsx 'ARCHIVED_BY' text типу 'Менеджер' → в extra).
#   - Усе що не лягло в схему — у extra_data.
#
# ІДЕМПОТЕНТНІСТЬ
#   passengers:          ON CONFLICT (tenant_id, pax_id) DO NOTHING
#   archive_passengers:  UNIQUE (tenant_id, archive_id) + ON CONFLICT
# ============================================================================

import openpyxl
import os
import json
import re
from datetime import datetime, date

TENANT = 'esco'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'sql', '2026-04-esco-phase3-passengers.sql')
XLSX_ACTIVE = os.path.join(ROOT, 'PerenosTablu', 'Passengers_crm_v4shets 1.xlsx')
XLSX_ARCH = os.path.join(ROOT, 'PerenosTablu', 'Archive_crm_v3.xlsx')


# ── SQL helpers ──────────────────────────────────────────────────────────

def q(v):
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        if isinstance(v, float) and v.is_integer():
            return str(int(v))
        return str(v)
    if isinstance(v, datetime):
        return "'" + v.strftime('%Y-%m-%d %H:%M:%S') + "'::timestamptz"
    if isinstance(v, date):
        return "'" + v.strftime('%Y-%m-%d') + "'::date"
    s = str(v).replace("'", "''")
    return "'" + s + "'"


def q_jsonb(obj):
    if not obj:
        return 'NULL'
    def _serialize(v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v
    cleaned = {k: _serialize(v) for k, v in obj.items() if v is not None and v != ''}
    if not cleaned:
        return 'NULL'
    s = json.dumps(cleaned, ensure_ascii=False).replace("'", "''")
    return "'" + s + "'::jsonb"


def nn(v):
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        if not s or s.lower() in ('none', 'null', '#n/a', '#value!'):
            return None
        return s
    return v


def to_num(v):
    v = nn(v)
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    s = re.sub(r'[^\d.\-]', '', str(v).replace(',', '.'))
    if not s or s in ('.', '-'):
        return None
    try:
        return float(s) if '.' in s else int(s)
    except ValueError:
        return None


def to_rating(v, max_val=5.0):
    """0 → NULL, у [1,5] → value, >5 → (None, raw)."""
    n = to_num(v)
    if n is None or n == 0:
        return (None, None)
    if 0 < n <= max_val:
        return (n, None)
    return (None, n)


def to_date_any(v):
    v = nn(v)
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        return v
    s = str(v).strip()
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%S',
                '%d.%m.%Y %H:%M', '%d.%m.%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def to_date_only(v):
    d = to_date_any(v)
    if d is None:
        return None
    return d.date() if isinstance(d, datetime) else d


def norm_phone(v):
    v = nn(v)
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = str(int(v))
    s = re.sub(r'[\s()\-]', '', str(v))
    if re.match(r'^\d+\.0$', s):
        s = s[:-2]
    if s.startswith('+'):
        return s
    if re.match(r'^380\d{9}$', s):
        return '+' + s
    if re.match(r'^0\d{9}$', s):
        return '+38' + s
    if re.match(r'^\d{10,15}$', s):
        # довге число без + — ймовірно номер без +, додамо +
        return '+' + s
    return s


def vehicle_lookup(name):
    """Підзапит, що резолвить vehicle_id по назві з trim + case-insensitive."""
    name = nn(name)
    if not name:
        return 'NULL'
    return (f"(SELECT id FROM public.vehicles WHERE tenant_id={q(TENANT)} "
            f"AND TRIM(LOWER(name)) = TRIM(LOWER({q(name)})) LIMIT 1)")


def read_sheet(path, name):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[name]
    rows = list(ws.iter_rows(values_only=True))
    headers = [str(h).strip() if h is not None else '' for h in rows[0]]
    out = []
    for r in rows[1:]:
        if all(v is None or v == '' for v in r):
            continue
        d = {}
        for i, h in enumerate(headers):
            d[h] = r[i] if i < len(r) else None
        out.append(d)
    wb.close()
    return out


# ── build passengers ────────────────────────────────────────────────────

def build_passengers(rows):
    sql = []
    for r in rows:
        pax_id = nn(r.get('PAX_ID'))
        if not pax_id:
            continue

        # Рейтинги з CHECK (1..5)
        drv, raw_drv = to_rating(r.get('Рейтинг водія'))
        mgr, raw_mgr = to_rating(r.get('Рейтинг менеджера'))

        # Биті дати
        dep_date = to_date_only(r.get('Дата виїзду'))
        dep_raw_bad = (r.get('Дата виїзду') is not None
                       and not isinstance(r.get('Дата виїзду'), (datetime, date))
                       and dep_date is None
                       and str(r.get('Дата виїзду')).strip() not in ('', 'None'))

        # notes — збираємо все аномальне
        notes_parts = []
        if nn(r.get('Примітка')):
            notes_parts.append(str(nn(r.get('Примітка'))))
        if raw_drv is not None:
            notes_parts.append(f"driver_rating(raw)={raw_drv}")
        if raw_mgr is not None:
            notes_parts.append(f"manager_rating(raw)={raw_mgr}")
        if dep_raw_bad:
            notes_parts.append(f"departure_date(raw)={r.get('Дата виїзду')}")
        notes = ' | '.join(notes_parts) if notes_parts else None

        # lead_status: порожнє → 'Новий'
        lead_status = nn(r.get('Статус ліда')) or 'Новий'
        crm_status = nn(r.get('Статус CRM')) or 'Активний'
        # Normalize CRM status to lowercase EN for consistency with Phase 1
        if crm_status.lower() in ('активний', 'активно'):
            crm_status = 'active'

        sql.append(
            f"INSERT INTO public.passengers ("
            f"tenant_id, pax_id, smart_id, direction, source_sheet, "
            f"booking_created_at, full_name, phone, registrar_phone, "
            f"seats_count, departure_address, arrival_address, departure_date, "
            f"departure_time, vehicle_name, vehicle_id, seat_number, rte_id, "
            f"ticket_price, ticket_currency, deposit, deposit_currency, "
            f"baggage_weight, baggage_price, baggage_currency, debt, "
            f"payment_status, lead_status, crm_status, tag, notes, sms_notes, "
            f"cli_id, booking_id, driver_rating, manager_rating, cal_id) VALUES ("
            f"{q(TENANT)}, {q(pax_id)}, {q(nn(r.get('Ід_смарт')))}, "
            f"{q(nn(r.get('Напрям')))}, {q(nn(r.get('SOURCE_SHEET')))}, "
            f"{q(to_date_any(r.get('Дата створення')))}, "
            f"{q(nn(r.get('Піб')))}, {q(norm_phone(r.get('Телефон пасажира')))}, "
            f"{q(norm_phone(r.get('Телефон реєстратора')))}, "
            f"{q(to_num(r.get('Кількість місць')))}, "
            f"{q(nn(r.get('Адреса відправки')))}, {q(nn(r.get('Адреса прибуття')))}, "
            f"{q(dep_date)}, {q(nn(r.get('Таймінг')))}, "
            f"{q(nn(r.get('Номер авто')))}, {vehicle_lookup(r.get('Номер авто'))}, "
            f"{q(nn(r.get('Місце в авто')))}, {q(nn(r.get('RTE_ID')))}, "
            f"{q(to_num(r.get('Ціна квитка')))}, {q(nn(r.get('Валюта квитка')))}, "
            f"{q(to_num(r.get('Завдаток')))}, {q(nn(r.get('Валюта завдатку')))}, "
            f"{q(to_num(r.get('Вага багажу')))}, {q(to_num(r.get('Ціна багажу')))}, "
            f"{q(nn(r.get('Валюта багажу')))}, {q(to_num(r.get('Борг')))}, "
            f"{q(nn(r.get('Статус оплати')))}, {q(lead_status)}, {q(crm_status)}, "
            f"{q(nn(r.get('Тег')))}, {q(notes)}, {q(nn(r.get('Примітка СМС')))}, "
            f"{q(nn(r.get('CLI_ID')))}, {q(nn(r.get('BOOKING_ID')))}, "
            f"{q(drv)}, {q(mgr)}, {q(nn(r.get('CAL_ID')))}"
            f") ON CONFLICT (tenant_id, pax_id) DO NOTHING;"
        )
    return sql


# ── build archive_passengers ────────────────────────────────────────────

def build_archive_passengers(rows):
    sql = []
    for r in rows:
        archive_id = nn(r.get('ARCHIVE_ID'))
        if not archive_id:
            continue

        drv, raw_drv = to_rating(r.get('Рейтинг водія'))
        mgr, raw_mgr = to_rating(r.get('Рейтинг менеджера'))

        # extra_data: усе що не лягає в схему archive_passengers
        extra = {
            'direction': nn(r.get('Напрям')),
            'cal_id': nn(r.get('CAL_ID')),
            'cli_id': nn(r.get('CLI_ID')),
            'rte_id': nn(r.get('RTE_ID')),
            'smart_id': nn(r.get('Ід_смарт')),
            'departure_time': nn(r.get('Таймінг')),
            'auto_id': nn(r.get('AUTO_ID')),
            'deposit_value': to_num(r.get('Завдаток')),
            'deposit_currency': nn(r.get('Валюта завдатку')),
            'baggage_weight': to_num(r.get('Вага багажу')),
            'baggage_price': to_num(r.get('Ціна багажу')),
            'baggage_currency': nn(r.get('Валюта багажу')),
            'payment_form': nn(r.get('Форма оплати')),
            'status_at_archive': nn(r.get('Статус на момент')),
            'driver_comment': nn(r.get('Коментар водія')),
            'manager_comment': nn(r.get('Коментар менеджера')),
            'archived_by_name': nn(r.get('ARCHIVED_BY')),  # текст типу "Менеджер"
            'restored_by_name': nn(r.get('Відновив')),
        }
        if raw_drv is not None:
            extra['driver_rating_raw'] = raw_drv
        if raw_mgr is not None:
            extra['manager_rating_raw'] = raw_mgr

        action_type = nn(r.get('Тип дії')) or 'archive'

        sql.append(
            f"INSERT INTO public.archive_passengers ("
            f"tenant_id, archive_id, action_type, archive_date, archive_reason, "
            f"source_table, source_sheet, pax_id, full_name, phone, registrar_phone, "
            f"seats_count, departure_address, arrival_address, departure_date, "
            f"vehicle_number, seat_number, ticket_price, ticket_currency, "
            f"deposit, debt, payment_status, crm_status, tag, "
            f"driver_rating, manager_rating, "
            f"restored, restored_date, restoration_reason, extra_data) VALUES ("
            f"{q(TENANT)}, {q(archive_id)}, {q(action_type)}, "
            f"{q(to_date_any(r.get('DATE_ARCHIVE')))}, {q(nn(r.get('ARCHIVE_REASON')))}, "
            f"{q(nn(r.get('SOURCE_TABLE')) or 'passengers')}, {q(nn(r.get('SOURCE_SHEET')))}, "
            f"{q(nn(r.get('PAX_ID')))}, {q(nn(r.get('Піб пасажира')))}, "
            f"{q(norm_phone(r.get('Телефон пасажира')))}, "
            f"{q(norm_phone(r.get('Телефон реєстратора')))}, "
            f"{q(to_num(r.get('Кількість місць')))}, "
            f"{q(nn(r.get('Адреса відправки')))}, {q(nn(r.get('Адреса прибуття')))}, "
            f"{q(to_date_only(r.get('Дата виїзду')))}, "
            f"{q(nn(r.get('Номер авто')))}, {q(nn(r.get('Місце в авто')))}, "
            f"{q(to_num(r.get('Ціна квитка')))}, {q(nn(r.get('Валюта квитка')))}, "
            f"{q(to_num(r.get('Завдаток')))}, {q(to_num(r.get('Борг')))}, "
            f"{q(nn(r.get('Статус оплати')))}, {q(nn(r.get('Статус CRM')))}, "
            f"{q(nn(r.get('Тег')))}, "
            f"{q(drv)}, {q(mgr)}, "
            f"{q(bool(to_num(r.get('Відновлено'))))}, "
            f"{q(to_date_any(r.get('Дата відновлення')))}, "
            f"{q(nn(r.get('Причина відновлення')))}, "
            f"{q_jsonb(extra)}"
            f") ON CONFLICT (tenant_id, archive_id) DO NOTHING;"
        )
    return sql


def main():
    # Active
    ua_eu = read_sheet(XLSX_ACTIVE, 'Україна-ЄВ')
    eu_ua = read_sheet(XLSX_ACTIVE, 'Європа-УК')
    active = ua_eu + eu_ua
    active_sql = build_passengers(active)

    # Archive
    arch = read_sheet(XLSX_ARCH, 'Пасажири')
    arch_sql = build_archive_passengers(arch)

    out = []
    out.append("-- =========================================================================")
    out.append("-- ESCO MIGRATION — PHASE 3: PASSENGERS + ARCHIVE_PASSENGERS")
    out.append("-- =========================================================================")
    out.append(f"-- passengers: {len(active_sql)} (UA→EU {len(ua_eu)} + EU→UA {len(eu_ua)})")
    out.append(f"-- archive_passengers: {len(arch_sql)}")
    out.append("--")
    out.append("-- FK: passengers.vehicle_id → vehicles.id (LOOKUP по name з vehicles,")
    out.append("--     trim + case-insensitive; якщо не знайдено — NULL).")
    out.append("-- cal_id — текст, як є (співпадає з calendar.cal_id вставленим у Phase 2).")
    out.append("-- cli_id — NULL (у xlsx порожній у всіх).")
    out.append("-- Рейтинги поза [1,5] → NULL з raw-значенням у notes/extra_data.")
    out.append("-- Ідемпотентно: ON CONFLICT (tenant_id, pax_id|archive_id) DO NOTHING.")
    out.append("-- =========================================================================")
    out.append("")
    out.append("BEGIN;")
    out.append("")
    out.append("-- ── 1. extra_data для нелягаючих xlsx колонок ─────────────────")
    out.append("ALTER TABLE public.archive_passengers ADD COLUMN IF NOT EXISTS extra_data jsonb;")
    out.append("COMMENT ON COLUMN public.archive_passengers.extra_data IS")
    out.append("    'Поля xlsx-архіву без власної колонки: direction, cal_id, cli_id,")
    out.append("     rte_id, smart_id, таймінг, auto_id, валюта завдатку, багаж,")
    out.append("     коментарі, archived_by_name (бо archived_by uuid), тощо.';")
    out.append("")
    out.append("-- ── 2. UNIQUE індекси ───────────────────────────────────────────")
    out.append("CREATE UNIQUE INDEX IF NOT EXISTS passengers_tenant_pax_uidx ON public.passengers (tenant_id, pax_id);")
    out.append("CREATE UNIQUE INDEX IF NOT EXISTS archive_passengers_tenant_arc_uidx ON public.archive_passengers (tenant_id, archive_id);")
    out.append("")
    out.append(f"-- ── passengers ({len(active_sql)} активних) ───────────────────────")
    out.extend(active_sql)
    out.append("")
    out.append(f"-- ── archive_passengers ({len(arch_sql)} архівних) ─────────────")
    out.extend(arch_sql)
    out.append("")
    out.append("COMMIT;")
    out.append("")
    out.append("NOTIFY pgrst, 'reload schema';")

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))

    print(f'✅ {OUT}')
    print(f'   passengers (active):  {len(active_sql)}')
    print(f'   archive_passengers:   {len(arch_sql)}')


if __name__ == '__main__':
    main()
