#!/usr/bin/env python3
# ============================================================================
# generate-esco-phase2.py — Phase 2: vehicles + calendar для tenant='esco'
# ============================================================================
#
# ДЖЕРЕЛО
#   PerenosTablu/Passengers_crm_v4shets 1.xlsx
#     → «Автопарк» (71 seat-рядків, 11 унікальних AUTO_ID) → public.vehicles
#     → «Календар» (85 рейсів)                            → public.calendar
#
# ЗМІНИ СХЕМИ
#   ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS seats_config jsonb
#     (у базовій схемі немає місця під деталізацію місць — додаємо).
#
# ЛОГІКА ДЛЯ vehicles
#   Групуємо seat-рядки по AUTO_ID → одне авто = один рядок vehicles.
#   Базові ціни (price_uah/chf/eur/…) беремо з першого «Пасажир»-рядка
#   (звичайне місце — найпоширеніша ціна). Повний список місць з типами
#   і цінами ложимо у seats_config jsonb.
#   Водія (Тип місця='Водій') додаємо у seats_config з is_driver=true.
#
#   vehicle_type:     'Мікроавтобус' (всі авто — 7-місні Sprinter/подібні).
#   seating_layout:   якщо xlsx дав datetime (xlsx-баг) → '1-3-3' дефолт.
#   plate_number:     NOT NULL; якщо у xlsx None → 'не вказано'.
#   name:             trim пробілів ('Цюрих ' → 'Цюрих').
#
# ЛОГІКА ДЛЯ calendar
#   vehicle_id: підзапит (SELECT id FROM vehicles WHERE tenant_id='esco'
#   AND auto_id = '<AUTO_ID з xlsx>'). Всі 85 рейсів мають AUTO_ID, які
#   існують у vehicles (перевірено).
#
#   route_date:       datetime → date
#   status:           'Відкритий' / 'Повний' лишаємо кирилицею
#                     (в БД default 'scheduled', без CHECK — можна будь-що)
#   seating_layout:   datetime → '1-3-3'
#
# ІДЕМПОТЕНТНІСТЬ
#   UNIQUE (tenant_id, auto_id) на vehicles (створюємо у файлі)
#   UNIQUE (tenant_id, cal_id)  на calendar
#   ON CONFLICT DO NOTHING скрізь.
# ============================================================================

import openpyxl
import os
import json
import re
from datetime import datetime, date
from collections import defaultdict

TENANT = 'esco'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, 'sql', '2026-04-esco-phase2-vehicles-calendar.sql')
XLSX = os.path.join(ROOT, 'PerenosTablu', 'Passengers_crm_v4shets 1.xlsx')

DEFAULT_LAYOUT = '1-3-3'
DEFAULT_VEHICLE_TYPE = 'Мікроавтобус'


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
    """JSON → SQL jsonb літерал."""
    if obj is None:
        return 'NULL'
    s = json.dumps(obj, ensure_ascii=False).replace("'", "''")
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


def to_date_only(v):
    v = nn(v)
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v).strip()
    for fmt in ('%Y-%m-%d', '%d.%m.%Y', '%Y-%m-%dT%H:%M:%S.%fZ'):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def norm_layout(v):
    """Тип розкладки: якщо xlsx дав datetime — повертаємо дефолт '1-3-3'."""
    v = nn(v)
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        return DEFAULT_LAYOUT
    return str(v).strip() or DEFAULT_LAYOUT


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


def build_vehicles(autopark_rows):
    """Group by AUTO_ID → один vehicle з seats_config."""
    groups = defaultdict(list)
    for r in autopark_rows:
        aid = nn(r.get('AUTO_ID'))
        if aid:
            groups[aid].append(r)

    sql = []
    for auto_id, seats in groups.items():
        first = seats[0]
        name = nn(first.get('Назва авто')) or '(без назви)'
        plate = nn(first.get('Держ. номер')) or 'не вказано'
        layout = norm_layout(first.get('Тип розкладки'))
        total = to_num(first.get('Місткість')) or len(seats)

        # Базові ціни — з першого «Пасажир»-місця (не VIP, не Водій)
        base_seat = next(
            (s for s in seats if (s.get('Тип місця') or '').strip() == 'Пасажир'),
            seats[0]
        )
        prices = {
            'uah': to_num(base_seat.get('Ціна UAH')),
            'chf': to_num(base_seat.get('Ціна CHF')),
            'eur': to_num(base_seat.get('Ціна EUR')),
            'pln': to_num(base_seat.get('Ціна PLN')),
            'czk': to_num(base_seat.get('Ціна CZK')),
            'usd': to_num(base_seat.get('Ціна USD')),
        }

        # seats_config — повний масив місць
        seats_config = []
        for s in seats:
            seats_config.append({
                'place':       nn(s.get('Місце')),
                'type':        nn(s.get('Тип місця')),
                'price_uah':   to_num(s.get('Ціна UAH')),
                'price_chf':   to_num(s.get('Ціна CHF')),
                'price_eur':   to_num(s.get('Ціна EUR')),
                'price_pln':   to_num(s.get('Ціна PLN')),
                'price_czk':   to_num(s.get('Ціна CZK')),
                'price_usd':   to_num(s.get('Ціна USD')),
                'seat_status': nn(s.get('Статус місця')),
                'is_driver':   (nn(s.get('Тип місця')) or '').strip() == 'Водій',
            })

        status = nn(first.get('Статус авто')) or 'active'
        if status.lower() in ('активний', 'активно'):
            status = 'active'
        notes = nn(first.get('Примітка'))

        sql.append(
            f"INSERT INTO public.vehicles ("
            f"tenant_id, auto_id, name, plate_number, vehicle_type, seating_layout, total_seats, "
            f"price_uah, price_chf, price_eur, price_pln, price_czk, price_usd, "
            f"status, notes, seats_config) VALUES ("
            f"{q(TENANT)}, {q(auto_id)}, {q(name)}, {q(plate)}, "
            f"{q(DEFAULT_VEHICLE_TYPE)}, {q(layout)}, {q(int(total) if total else None)}, "
            f"{q(prices['uah'])}, {q(prices['chf'])}, {q(prices['eur'])}, "
            f"{q(prices['pln'])}, {q(prices['czk'])}, {q(prices['usd'])}, "
            f"{q(status)}, {q(notes)}, {q_jsonb(seats_config)}"
            f") ON CONFLICT (tenant_id, auto_id) DO NOTHING;"
        )
    return sql, len(groups)


def build_calendar(calendar_rows):
    sql = []
    for r in calendar_rows:
        cal_id = nn(r.get('CAL_ID'))
        if not cal_id:
            continue
        auto_id = nn(r.get('AUTO_ID'))
        # vehicle_id через підзапит — резолвиться при INSERT
        vehicle_id_expr = (
            f"(SELECT id FROM public.vehicles WHERE tenant_id='{TENANT}' "
            f"AND auto_id={q(auto_id)})" if auto_id else 'NULL'
        )

        sql.append(
            f"INSERT INTO public.calendar ("
            f"tenant_id, cal_id, auto_id, vehicle_id, vehicle_name, seating_layout, "
            f"route_date, direction, city, "
            f"total_seats, available_seats, occupied_seats, "
            f"available_seats_list, occupied_seats_list, status) VALUES ("
            f"{q(TENANT)}, {q(cal_id)}, {q(auto_id)}, {vehicle_id_expr}, "
            f"{q(nn(r.get('Назва авто')))}, {q(norm_layout(r.get('Тип розкладки')))}, "
            f"{q(to_date_only(r.get('Дата рейсу')))}, {q(nn(r.get('Напрямок')))}, "
            f"{q(nn(r.get('Місто')))}, "
            f"{q(int(to_num(r.get('Макс. місць')) or 0))}, "
            f"{q(int(to_num(r.get('Вільні місця')) or 0))}, "
            f"{q(int(to_num(r.get('Зайняті місця')) or 0))}, "
            f"{q(nn(r.get('Список вільних')))}, {q(nn(r.get('Список зайнятих')))}, "
            f"{q(nn(r.get('Статус рейсу')) or 'scheduled')}"
            f") ON CONFLICT (tenant_id, cal_id) DO NOTHING;"
        )
    return sql


def main():
    autopark = read_sheet(XLSX, 'Автопарк')
    calendar = read_sheet(XLSX, 'Календар')

    vehicle_sql, n_vehicles = build_vehicles(autopark)
    calendar_sql = build_calendar(calendar)

    out = []
    out.append("-- =========================================================================")
    out.append("-- ESCO MIGRATION — PHASE 2: VEHICLES + CALENDAR")
    out.append("-- =========================================================================")
    out.append("--")
    out.append(f"-- Згенеровано tools/generate-esco-phase2.py")
    out.append(f"-- {n_vehicles} авто з {len(autopark)} seat-рядків Автопарку")
    out.append(f"-- {len(calendar_sql)} рейсів з Календаря")
    out.append("--")
    out.append("-- FK ланцюг: vehicles.id → calendar.vehicle_id (підзапит по auto_id).")
    out.append("-- Ідемпотентно: ON CONFLICT DO NOTHING по (tenant_id, auto_id|cal_id).")
    out.append("-- =========================================================================")
    out.append("")
    out.append("BEGIN;")
    out.append("")
    out.append("-- ── 1. Додаткова колонка на vehicles для розкладки місць ───────")
    out.append("ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS seats_config jsonb;")
    out.append("COMMENT ON COLUMN public.vehicles.seats_config IS")
    out.append("    'Детальна розкладка місць: [{place, type, price_uah/chf/..., is_driver}, …]';")
    out.append("")
    out.append("-- ── 2. UNIQUE індекси для ON CONFLICT ────────────────────────────")
    out.append("CREATE UNIQUE INDEX IF NOT EXISTS vehicles_tenant_auto_uidx ON public.vehicles (tenant_id, auto_id);")
    out.append("CREATE UNIQUE INDEX IF NOT EXISTS calendar_tenant_cal_uidx ON public.calendar (tenant_id, cal_id);")
    out.append("")
    out.append(f"-- ── vehicles ({len(vehicle_sql)} авто) ───────────────────────────────")
    out.extend(vehicle_sql)
    out.append("")
    out.append(f"-- ── calendar ({len(calendar_sql)} рейсів) ────────────────────────────")
    out.extend(calendar_sql)
    out.append("")
    out.append("COMMIT;")
    out.append("")
    out.append("NOTIFY pgrst, 'reload schema';")

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))

    print(f'✅ {OUT}')
    print(f'   vehicles: {len(vehicle_sql)} (з {len(autopark)} seat-рядків)')
    print(f'   calendar: {len(calendar_sql)}')


if __name__ == '__main__':
    main()
