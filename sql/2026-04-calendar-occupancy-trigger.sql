-- Auto-maintain calendar.occupied_seats / available_seats based on
-- active (non-archived) passengers that reference a given cal_id.
--
-- Fires on any INSERT/UPDATE/DELETE that could change a passenger's
-- effective assignment (cal_id or is_archived). Recomputes from scratch
-- for the affected cal_id(s) — correct even under concurrent edits and
-- never drifts, unlike manual +1/-1 bookkeeping in JS.

create or replace function recalc_calendar_occupancy()
returns trigger
language plpgsql
as $$
declare
    affected text[];
begin
    if (tg_op = 'INSERT') then
        if new.cal_id is not null then
            affected := array[new.cal_id];
        end if;
    elsif (tg_op = 'UPDATE') then
        affected := array_remove(array[old.cal_id, new.cal_id], null);
    elsif (tg_op = 'DELETE') then
        if old.cal_id is not null then
            affected := array[old.cal_id];
        end if;
    end if;

    if affected is null or array_length(affected, 1) is null then
        return null;
    end if;

    update calendar c
       set occupied_seats  = sub.cnt,
           available_seats = greatest(0, coalesce(c.total_seats, 0) - sub.cnt),
           updated_at      = now()
      from (
        select cal_id,
               coalesce(sum(greatest(1, coalesce(seats_count, 1))), 0)::int as cnt
          from passengers
         where cal_id = any(affected)
           and is_archived = false
         group by cal_id
      ) sub
     where c.cal_id = sub.cal_id;

    -- Also reset cal_ids that have zero remaining passengers
    update calendar c
       set occupied_seats  = 0,
           available_seats = coalesce(c.total_seats, 0),
           updated_at      = now()
     where c.cal_id = any(affected)
       and not exists (
         select 1 from passengers p
          where p.cal_id = c.cal_id
            and p.is_archived = false
       );

    return null;
end;
$$;

drop trigger if exists trg_recalc_calendar_occupancy_ins on passengers;
drop trigger if exists trg_recalc_calendar_occupancy_upd on passengers;
drop trigger if exists trg_recalc_calendar_occupancy_del on passengers;

create trigger trg_recalc_calendar_occupancy_ins
after insert on passengers
for each row execute function recalc_calendar_occupancy();

create trigger trg_recalc_calendar_occupancy_upd
after update of cal_id, is_archived on passengers
for each row
when (old.cal_id is distinct from new.cal_id
      or old.is_archived is distinct from new.is_archived)
execute function recalc_calendar_occupancy();

create trigger trg_recalc_calendar_occupancy_del
after delete on passengers
for each row execute function recalc_calendar_occupancy();

-- One-time backfill for existing rows so the UI is correct immediately.
update calendar c
   set occupied_seats  = coalesce(sub.cnt, 0),
       available_seats = greatest(0, coalesce(c.total_seats, 0) - coalesce(sub.cnt, 0))
  from (
    select c2.cal_id,
           (select count(*) from passengers p
             where p.tenant_id = c2.tenant_id
               and p.cal_id = c2.cal_id
               and p.is_archived = false)::int as cnt
      from calendar c2
  ) sub
 where c.cal_id = sub.cal_id;
