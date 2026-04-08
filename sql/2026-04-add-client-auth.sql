-- Adds password + modules columns to existing `clients` table.
-- Safe to run multiple times: IF NOT EXISTS guards everything.
-- No drops, no NOT NULL, no type changes — existing rows untouched.

alter table clients add column if not exists password text;
alter table clients add column if not exists modules text[] default '{passenger}';

-- Backfill modules for existing rows that have null
update clients set modules = '{passenger,cargo}' where modules is null;
