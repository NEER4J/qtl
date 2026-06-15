-- 0087_allow_negative_service_charge.sql
-- "Counter premium" is relabelled "Service charge" and may now be NEGATIVE
-- (client 2026-06). It feeds the With Service price = Total cost + Service
-- charge, so a negative value discounts the installed price. Drop the
-- >= 0 check constraints on both the per-part column (parts.counter_premium,
-- added in 0079) and the global default (app_settings.counter_premium, 0051).

alter table public.parts
  drop constraint if exists parts_counter_premium_check;

alter table public.app_settings
  drop constraint if exists app_settings_counter_premium_check;
