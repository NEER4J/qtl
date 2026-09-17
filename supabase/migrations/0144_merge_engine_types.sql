-- 0144_merge_engine_types.sql
-- Engine type MERGE, modelled on merge_customers (0123): fold a duplicate
-- engine (source) into the engine it duplicates (target), so the duplicate can
-- finally be removed.
--
-- Why (client 2026-09-15): an inactive "Cummins ISC/ISL/ISB" duplicate could
-- not be deleted — "This engine has been used on a sales job". That block is
-- correct: sales_jobs.engine_type_id (0025) is the only reference to
-- engine_types WITHOUT on delete cascade, and nulling it would lose the job's
-- engine in analytics (revenue per engine). Merging moves that history instead.
--
-- What happens to the source's rows:
--   * sales_jobs.engine_type_id — REASSIGNED to the target. This is the history.
--   * engine_filters, engine_sell_prices, oil_price_lock_items — NOT moved; they
--     cascade away with the source. They are pricing config for the source's
--     own capacity and filter set. Copying a manual price or a locked price onto
--     the target would silently change what the target charges (lock → manual
--     price → cost-up), which a merge must never do.
--   * labour_package_id — dropped with the source row.
--
-- Side effects the Engine types page warns about before confirming:
--   * every reassigned job gets updated_at = now() (trg_sales_jobs_updated_at),
--     so it reads "last edited today", and one audit_log row (trg_sales_jobs_audit).
--   * UPDATE re-checks every constraint on those rows. A legacy job that already
--     breaks sales_paid_chk / sales_total_chk would abort the merge with a raw
--     check error, so that case is caught and named.
--
-- SECURITY DEFINER so the reassign can cross location-scoped RLS on
-- sales_jobs, with an owner/co_owner check inside for defence in depth (the
-- action also gates it). Runs as one transaction — never half-merged.

create or replace function public.merge_engine_types(p_target uuid, p_source uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_moved integer;
begin
  if not private.is_owner() then
    raise exception 'Not authorised to merge engine types' using errcode = '42501';
  end if;
  if p_target is null or p_source is null or p_target = p_source then
    raise exception 'Choose two different engine types to merge';
  end if;
  if not exists (select 1 from public.engine_types where id = p_target) then
    raise exception 'The engine to keep was not found';
  end if;
  if not exists (select 1 from public.engine_types where id = p_source) then
    raise exception 'The duplicate engine was not found';
  end if;

  begin
    update public.sales_jobs set engine_type_id = p_target where engine_type_id = p_source;
    get diagnostics v_moved = row_count;
  exception when check_violation then
    raise exception
      'A sales job on the duplicate engine fails a totals check (%), so nothing was merged. Fix that job''s totals or payments first.',
      sqlerrm;
  end;

  delete from public.engine_types where id = p_source;
  return v_moved;
end;
$$;

revoke all on function public.merge_engine_types(uuid, uuid) from public;
revoke all on function public.merge_engine_types(uuid, uuid) from anon;
grant execute on function public.merge_engine_types(uuid, uuid) to authenticated;
