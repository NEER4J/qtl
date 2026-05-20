-- Repoint the 2 sales_jobs still pinned to the OLD collapsed engine_types,
-- then deactivate those engines. Run AFTER may2026_engine_types.sql +
-- may2026_engine_sell_prices.sql.
--
-- May 2026 audit:
--   - 1 sales_job (created 2026-04-28) references "Cummins 5.9/6.7 L"
--   - 1 sales_job (created 2026-04-30) references "Volvo D12"
--
-- Cummins has only one new variant ("Cummins 5.9L/6.7L") — no choice.
-- Volvo D12 splits into "...With Volvo Filter" and "...With Fleetguard Filter".
-- DEFAULTING to the Volvo-brand (OEM) variant since that's the higher-priced
-- option in Excel — adjust the COALESCE below if the actual job used Fleetguard.

begin;

-- ---------------------------------------------------------------------------
-- Repoint Cummins 5.9/6.7 L → Cummins 5.9L/6.7L
-- ---------------------------------------------------------------------------
update public.sales_jobs
   set engine_type_id = (select id from public.engine_types where display_name = 'Cummins 5.9L/6.7L')
 where engine_type_id = (select id from public.engine_types where display_name = 'Cummins 5.9/6.7 L');

-- ---------------------------------------------------------------------------
-- Repoint Volvo D12 → Volvo D12 With Volvo Filter (OEM default)
-- ---------------------------------------------------------------------------
update public.sales_jobs
   set engine_type_id = (select id from public.engine_types where display_name = 'Volvo D12 With Volvo Filter')
 where engine_type_id = (select id from public.engine_types where display_name = 'Volvo D12');

-- ---------------------------------------------------------------------------
-- Now safe to deactivate (no sales_jobs reference them anymore)
-- ---------------------------------------------------------------------------
update public.engine_types set active = false
 where display_name in ('Cummins 5.9/6.7 L', 'Volvo D12');

commit;

-- Verification (run separately):
--   select display_name, active from public.engine_types
--    where display_name in ('Cummins 5.9/6.7 L', 'Volvo D12');
--   -- both should be active=false
--
--   select count(*) from public.sales_jobs sj
--     join public.engine_types et on et.id = sj.engine_type_id
--    where et.active = false;
--   -- should be 0
