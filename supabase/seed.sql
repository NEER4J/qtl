-- Seed data applied by `supabase db reset`.
-- All inserts are idempotent: rerunning is safe.

-- ============================================================================
-- Locations
-- ============================================================================
insert into public.locations (code, name, active) values
  ('AYR', 'Ayr',        true),
  ('FE',  'Fort Erie',  true),
  ('NP',  'Napanee',    true)
on conflict (code) do nothing;

-- ============================================================================
-- Service types
-- ============================================================================
insert into public.service_types (code, name, sort_order, active) values
  ('OC',   'Oil Change',  1, true),
  ('PG',   'Pit Grease',  2, true),
  ('FG',   'Full Grease', 3, true),
  ('MISC', 'Misc',        4, true)
on conflict (code) do nothing;

-- ============================================================================
-- Expense categories + subcategories (per doc/QTL Plan.md §5.5)
-- ============================================================================
insert into public.expense_categories (name, sort_order, active) values
  ('Advertisement', 1, true),
  ('Cleaning',      2, true),
  ('Repair',        3, true),
  ('Utility',       4, true),
  ('Misc',          5, true),
  ('Bank',          6, true),
  ('Purchase',      7, true),
  ('Others',        8, true)
on conflict (name) do nothing;

-- Subcategories. Loop through the expected set and upsert.
do $$
declare
  r record;
  v_cat_id uuid;
begin
  for r in
    select * from (values
      ('Advertisement', 'Radio',               1),
      ('Advertisement', 'Truck Show',          2),
      ('Advertisement', 'IT/Digital',          3),
      ('Advertisement', 'Graphic Design',      4),

      ('Cleaning',      'Grass Cutting/Snow Removal', 1),
      ('Cleaning',      'Uniform',             2),

      ('Repair',        'Door',                1),
      ('Repair',        'Equipment',           2),
      ('Repair',        'Plugs',               3),

      ('Utility',       'Electricity',         1),
      ('Utility',       'Heating',             2),
      ('Utility',       'Alarm',               3),

      ('Misc',          'Insurance',           1),
      ('Misc',          'Land Lease',          2),
      ('Misc',          'Pro Tax',             3),
      ('Misc',          'Phone',               4),
      ('Misc',          'Internet',            5),
      ('Misc',          'Fuel',                6),
      ('Misc',          'Legal Fee',           7),
      ('Misc',          'Accountant Fee',      8),
      ('Misc',          'Official Exp',        9),

      ('Bank',          'Loan Interest',       1),
      ('Bank',          'Credit Card Cost',    2),

      ('Purchase',      'Filter',              1),
      ('Purchase',      'Oil',                 2),
      ('Purchase',      'Supply',              3)
    ) as t(cat_name, sub_name, sort)
  loop
    select id into v_cat_id from public.expense_categories where name = r.cat_name;
    if v_cat_id is not null then
      insert into public.expense_subcategories (category_id, name, sort_order, active)
        values (v_cat_id, r.sub_name, r.sort, true)
      on conflict (category_id, name) do nothing;
    end if;
  end loop;
end $$;

-- ============================================================================
-- app_settings is already seeded in 0001 with a single row (id = 1)
-- ============================================================================
