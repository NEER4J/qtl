-- Generated alongside scripts/sync-may-2026.py.
-- Deactivates the OLD collapsed engine_types rows that have been superseded by
-- filter-brand-specific variants from the May 2026 Excel. Run AFTER:
--   1) supabase/seed/may2026_engine_types.sql
--   2) supabase/seed/may2026_engine_sell_prices.sql
--
-- SAFETY: each UPDATE includes a `NOT EXISTS (sales_jobs ...)` guard, so any
-- engine that is referenced by a historical sales_jobs row stays active and
-- you'll see a NOTICE for it in the final report.
--
-- At audit time these old engines had a sales_jobs reference and will be
-- skipped (their UPDATE will be a no-op):
--   - Cummins 5.9/6.7 L
--   - Volvo D12
-- If you want to retire them too, repoint the linked sales_jobs.engine_type_id
-- to the new equivalent first, then re-run this file.

begin;

-- ----------------------------------------------------------------------------
-- Per-engine guarded UPDATEs. Each is idempotent: re-running has no effect.
-- ----------------------------------------------------------------------------
do $$
declare
  old_names text[] := array[
    'Cat C12/3406',
    'Cat C13/C15',
    'Cat C7//C10/3126',
    'Cummins 5.9/6.7 L',
    'Cummins ISC/ISL/ISB',
    'Detroit 60 Series',
    'Detroit DD13/DD15/DD16',
    'Detroit DD8',
    'Duramax Duramax/ Vortec 8100',
    'Hino Hino',
    'International International',
    'Mack Mack',
    'Mack Mack - 52L',
    'Mack MP 7/ 8',
    'Mack MP 7/ 8/10 - 52L',
    'MaxForce 13 MaxForce 13',
    'MaxForce MaxForce 7/9/10',
    'Mercedes Benz 4000',
    'Mercedes Benz 900',
    'Mitsubushi Mitsubushi',
    'Paccar Paccar',
    'Paccar Paccar Smal',
    'Volvo D12',
    'Volvo D16 - 42L',
    'Volvo D16- 52L'
  ];
  rec record;
  v_jobs int;
  v_deactivated int := 0;
  v_skipped int := 0;
begin
  for rec in
    select id, display_name, active
      from public.engine_types
     where display_name = any (old_names)
  loop
    select count(*) into v_jobs
      from public.sales_jobs
     where engine_type_id = rec.id;

    if v_jobs > 0 then
      raise notice 'SKIP  "%": % sales_jobs reference it', rec.display_name, v_jobs;
      v_skipped := v_skipped + 1;
    elsif not rec.active then
      raise notice 'NOOP  "%": already inactive', rec.display_name;
    else
      update public.engine_types set active = false where id = rec.id;
      raise notice 'OFF   "%"', rec.display_name;
      v_deactivated := v_deactivated + 1;
    end if;
  end loop;

  raise notice '---';
  raise notice 'Deactivated: %', v_deactivated;
  raise notice 'Skipped (still referenced): %', v_skipped;
end$$;

commit;

-- ----------------------------------------------------------------------------
-- Verification queries (run separately, not inside the begin/commit above).
-- ----------------------------------------------------------------------------
-- Show any still-active engines that look like leftovers:
--   select display_name from public.engine_types
--    where active = true and (display_name like '%//%' or display_name like '% %' || ' ' || '%')
--    order by display_name;
--
-- Show all engines that still have engine_sell_prices but are now inactive
-- (those override rows are now unreachable until you reactivate the engine):
--   select et.display_name, count(*) as price_rows
--     from public.engine_types et
--     join public.engine_sell_prices esp on esp.engine_type_id = et.id
--    where et.active = false
--    group by et.display_name
--    order by et.display_name;
