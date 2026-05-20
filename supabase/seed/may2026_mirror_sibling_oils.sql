-- Mirror engine_sell_prices from the Excel-mapped "canonical" oil to its
-- sibling brands of the same grade. Apply AFTER may2026_engine_sell_prices.sql.
--
-- WHY: The May 2026 Excel has one tab per oil GRADE ("15W40", "10W30", "T6"…)
-- but the platform has multiple BRANDS per grade (Delo, Mobil, Shell T4, Total
-- Rubia, …). Per the May 2026 "Oil Price" tab, all 15W40 brands sell at the
-- same per-litre rate ($4.89/L bulk), and the same holds for 10W30. So the
-- engine-level sell prices mirror across siblings too.
--
-- Idempotent: re-running just rewrites the same numbers via UPSERT.

begin;

-- ---------------------------------------------------------------------------
-- 15W40: Delo 400 XLE SB → Mobil 15W40, Shell T4 15W40
-- ---------------------------------------------------------------------------
insert into public.engine_sell_prices (engine_type_id, oil_type_id, container, sell_price)
select e.engine_type_id,
       (select id from public.oil_types where code = '19'),  -- Mobil 15W40
       e.container,
       e.sell_price
  from public.engine_sell_prices e
 where e.oil_type_id = (select id from public.oil_types where code = '257004')
on conflict (engine_type_id, oil_type_id, container) do update set sell_price = excluded.sell_price;

insert into public.engine_sell_prices (engine_type_id, oil_type_id, container, sell_price)
select e.engine_type_id,
       (select id from public.oil_types where code = '500010048'),  -- Shell T4 15W40
       e.container,
       e.sell_price
  from public.engine_sell_prices e
 where e.oil_type_id = (select id from public.oil_types where code = '257004')
on conflict (engine_type_id, oil_type_id, container) do update set sell_price = excluded.sell_price;

-- ---------------------------------------------------------------------------
-- 10W30: Delo 400LE 10W30 → Mobil 10W30, Total 10W30 Rubia
-- ---------------------------------------------------------------------------
insert into public.engine_sell_prices (engine_type_id, oil_type_id, container, sell_price)
select e.engine_type_id,
       (select id from public.oil_types where code = '20'),  -- Mobil 10W30
       e.container,
       e.sell_price
  from public.engine_sell_prices e
 where e.oil_type_id = (select id from public.oil_types where code = '10')
on conflict (engine_type_id, oil_type_id, container) do update set sell_price = excluded.sell_price;

insert into public.engine_sell_prices (engine_type_id, oil_type_id, container, sell_price)
select e.engine_type_id,
       (select id from public.oil_types where code = '23'),  -- Total 10W30 Rubia
       e.container,
       e.sell_price
  from public.engine_sell_prices e
 where e.oil_type_id = (select id from public.oil_types where code = '10')
on conflict (engine_type_id, oil_type_id, container) do update set sell_price = excluded.sell_price;

-- ---------------------------------------------------------------------------
-- T6 5W30 → Shell T6 5W40
-- ---------------------------------------------------------------------------
insert into public.engine_sell_prices (engine_type_id, oil_type_id, container, sell_price)
select e.engine_type_id,
       (select id from public.oil_types where code = '9'),   -- Shell T6 5W40
       e.container,
       e.sell_price
  from public.engine_sell_prices e
 where e.oil_type_id = (select id from public.oil_types where code = '14')
on conflict (engine_type_id, oil_type_id, container) do update set sell_price = excluded.sell_price;

-- ---------------------------------------------------------------------------
-- Delo 400XSP 5W30 → Delo 400XSP 5W40
-- ---------------------------------------------------------------------------
insert into public.engine_sell_prices (engine_type_id, oil_type_id, container, sell_price)
select e.engine_type_id,
       (select id from public.oil_types where code = '12'),  -- Delo 400XSP 5W40
       e.container,
       e.sell_price
  from public.engine_sell_prices e
 where e.oil_type_id = (select id from public.oil_types where code = '11')
on conflict (engine_type_id, oil_type_id, container) do update set sell_price = excluded.sell_price;

commit;

-- Verification (run separately):
--   select ot.code, ot.name, count(*) as price_rows
--     from public.oil_types ot
--     join public.engine_sell_prices esp on esp.oil_type_id = ot.id
--    where ot.code in ('257004','19','500010048','10','20','23','14','9','11','12')
--    group by ot.code, ot.name
--    order by ot.code;
