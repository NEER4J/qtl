-- 0080_technicians_location.sql
--
-- Sales advisor by location (client 2026-06): each technician can have a single
-- "home" location. On a sales job, the Advisor picker shows only technicians
-- whose location matches the job's location — plus any left unassigned
-- (location_id IS NULL) so existing techs keep showing everywhere until tagged.
-- The Upper/Lower tech pickers are intentionally NOT filtered.
--
-- ON DELETE SET NULL: removing a location should not delete techs, just untag
-- them (they fall back to "show everywhere").

alter table public.technicians
  add column if not exists location_id uuid
    references public.locations(id) on delete set null;

create index if not exists technicians_location_idx
  on public.technicians (location_id);

comment on column public.technicians.location_id is
  'Home location. NULL = show in every location''s advisor picker (client 2026-06).';
