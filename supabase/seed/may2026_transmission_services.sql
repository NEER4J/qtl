-- Seeds the transmission_services table from the May 2026 Excel "Trans & Diff" tab.
-- Apply AFTER migration 0057_transmission_services.sql.
--
-- Values are copied verbatim from columns A (name) and B (selling) of the
-- Trans & Diff tab; litres come from column E. Coolant flushes use columns S–Z
-- (rows 8–10) and have labour split out from the sell price ($125 labour each).

begin;

-- ============================================================================
-- Allison Transmissions  (Regular block; no synthetic variant in the Excel)
-- ============================================================================
insert into public.transmission_services
  (name, service_kind, is_synthetic, litres, sell_price, sort_order)
values
  ('Allison Trans 2500',         'allison_trans', false, 16, 389.99, 10),
  ('Allison Trans 4500',         'allison_trans', false, 26, 549.99, 20),
  ('Allison Trans 4500 (Dump)',  'allison_trans', false, 33, 659.99, 30)
on conflict (service_kind, name, is_synthetic) do update set
  sell_price = excluded.sell_price,
  litres     = excluded.litres,
  sort_order = excluded.sort_order;

-- ============================================================================
-- Differential oil change  (Regular + Synthetic)
-- ============================================================================
insert into public.transmission_services
  (name, service_kind, is_synthetic, litres, sell_price, sort_order)
values
  ('Diff Oil Change (Single)',   'diff', false, 15, 164.99, 100),
  ('Diff Oil Change',            'diff', false, 28, 275.99, 110),
  ('Diff Oil Change (Single)',   'diff', true,  15, 229.99, 200),
  ('Diff Oil Change',            'diff', true,  28, 389.99, 210)
on conflict (service_kind, name, is_synthetic) do update set
  sell_price = excluded.sell_price,
  litres     = excluded.litres,
  sort_order = excluded.sort_order;

-- ============================================================================
-- Trans oil change  (Regular + Synthetic standalone — no Allison / DT12)
-- ============================================================================
insert into public.transmission_services
  (name, service_kind, is_synthetic, litres, sell_price, sort_order)
values
  ('Trans Oil Change',           'trans', false, 14, 165.99, 300),
  ('Trans Oil Change',           'trans', true,  14, 259.99, 310)
on conflict (service_kind, name, is_synthetic) do update set
  sell_price = excluded.sell_price,
  litres     = excluded.litres,
  sort_order = excluded.sort_order;

-- ============================================================================
-- Combined Trans + Diff
-- ============================================================================
insert into public.transmission_services
  (name, service_kind, is_synthetic, litres, sell_price, sort_order)
values
  ('Trans & Diff Oil Change',    'combined', false, 43, 365.99, 400),
  ('Trans & Single Diff',        'combined', false, 29, 279.99, 410),
  ('Trans & Diff Oil Change',    'combined', true,  43, 584.99, 420),
  ('Trans & Single Diff',        'combined', true,  29, 419.99, 430)
on conflict (service_kind, name, is_synthetic) do update set
  sell_price = excluded.sell_price,
  litres     = excluded.litres,
  sort_order = excluded.sort_order;

-- ============================================================================
-- Specialty transmissions (always synthetic in Excel)
-- ============================================================================
insert into public.transmission_services
  (name, service_kind, is_synthetic, oil_type_id, litres, sell_price, sort_order)
select 'Trans DT12',    'specialty_trans', true, o.id, 14, 349.99, 500
  from public.oil_types o where o.code = '18'   -- Delo AMT XDT 75W90 (DT12)
on conflict (service_kind, name, is_synthetic) do update set
  sell_price  = excluded.sell_price,
  oil_type_id = excluded.oil_type_id,
  litres      = excluded.litres,
  sort_order  = excluded.sort_order;

insert into public.transmission_services
  (name, service_kind, is_synthetic, oil_type_id, litres, sell_price, sort_order)
select 'Trans I-Shift', 'specialty_trans', true, o.id, 17, 349.99, 510
  from public.oil_types o where o.code = '17'   -- Delo XV 75W80 (IShift)
on conflict (service_kind, name, is_synthetic) do update set
  sell_price  = excluded.sell_price,
  oil_type_id = excluded.oil_type_id,
  litres      = excluded.litres,
  sort_order  = excluded.sort_order;

-- ============================================================================
-- Coolant flush  (3 coolant types, all 10 L, $125 labour)
-- ============================================================================
insert into public.transmission_services
  (name, service_kind, is_synthetic, litres, sell_price, labour, sort_order, notes)
values
  ('Coolant Flush — Extended Life (Detroit)', 'coolant_flush', false, 10, 246.00, 125.00, 600, '10 L Detroit extended-life coolant + $125 labour'),
  ('Coolant Flush — Extended Life (Red)',     'coolant_flush', false, 10, 227.65, 125.00, 610, '10 L red extended-life coolant + $125 labour'),
  ('Coolant Flush — Green',                   'coolant_flush', false, 10, 200.00, 125.00, 620, '10 L green coolant + $125 labour')
on conflict (service_kind, name, is_synthetic) do update set
  sell_price = excluded.sell_price,
  litres     = excluded.litres,
  labour     = excluded.labour,
  sort_order = excluded.sort_order,
  notes      = excluded.notes;

commit;
