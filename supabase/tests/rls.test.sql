-- RLS smoke tests for QTL (Phase 1).
--
-- Run with:  supabase test db
--
-- Covers the must-not-regress invariants of the permission matrix in
-- doc/QTL Plan.md §3 and the policy file supabase/migrations/0007_rls_policies.sql.
-- Not exhaustive — it's a tripwire, not a full audit. Add cases here when you
-- change a policy.

begin;

create extension if not exists pgtap;

select plan(24);

-- ----------------------------------------------------------------------------
-- Fixtures: one auth.user + profile per role. We create the auth rows
-- directly (service_role bypasses RLS here) so we don't hit email delivery.
-- ----------------------------------------------------------------------------

-- Reference rows from seed.sql must already be present.
select is(
  (select count(*) from public.locations),
  3::bigint,
  'locations table seeded with 3 rows'
);

-- Grab the canonical location ids once.
create temp table fx_loc as
  select code, id from public.locations where code in ('AYR','FE','NP');

-- Minimal auth.users inserts. handle_new_auth_user() trigger will create
-- matching profile rows; we then fix up role + location.
insert into auth.users (id, email, aud, role, email_confirmed_at, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111101', 'owner.test@qtl.test',   'authenticated', 'authenticated', now(), '{"full_name":"Owner Test"}'),
  ('11111111-1111-1111-1111-111111111102', 'mgr.ayr@qtl.test',      'authenticated', 'authenticated', now(), '{"full_name":"Ayr Manager"}'),
  ('11111111-1111-1111-1111-111111111103', 'mgr.fe@qtl.test',       'authenticated', 'authenticated', now(), '{"full_name":"FE Manager"}'),
  ('11111111-1111-1111-1111-111111111104', 'staff.ayr@qtl.test',    'authenticated', 'authenticated', now(), '{"full_name":"Ayr Staff"}'),
  ('11111111-1111-1111-1111-111111111105', 'staff.exp.ayr@qtl.test','authenticated', 'authenticated', now(), '{"full_name":"Ayr Staff Exp"}'),
  ('11111111-1111-1111-1111-111111111106', 'acct@qtl.test',         'authenticated', 'authenticated', now(), '{"full_name":"Accountant"}'),
  ('11111111-1111-1111-1111-111111111107', 'emp@qtl.test',          'authenticated', 'authenticated', now(), '{"full_name":"Employee"}')
on conflict (id) do nothing;

-- Bootstrap trigger promotes the very first user to owner; after that every
-- new profile starts as staff. We now explicitly set roles.
update public.profiles set role='owner',    location_id=null where id='11111111-1111-1111-1111-111111111101';
update public.profiles set role='manager',  location_id=(select id from fx_loc where code='AYR') where id='11111111-1111-1111-1111-111111111102';
update public.profiles set role='manager',  location_id=(select id from fx_loc where code='FE')  where id='11111111-1111-1111-1111-111111111103';
update public.profiles set role='staff',    location_id=(select id from fx_loc where code='AYR'), can_enter_expenses=false where id='11111111-1111-1111-1111-111111111104';
update public.profiles set role='staff',    location_id=(select id from fx_loc where code='AYR'), can_enter_expenses=true  where id='11111111-1111-1111-1111-111111111105';
update public.profiles set role='accountant',location_id=null where id='11111111-1111-1111-1111-111111111106';
update public.profiles set role='employee', location_id=(select id from fx_loc where code='AYR') where id='11111111-1111-1111-1111-111111111107';

-- Reference rows for jobs/expenses.
insert into public.sales_jobs (
  id, location_id, job_date, invoice_no, billing_name, service_type_id,
  sub_total, hst, total, created_by
) values
  ('22222222-2222-2222-2222-222222222201',
   (select id from fx_loc where code='AYR'), current_date, 'T-AYR-1', 'Test Cust',
   (select id from public.service_types where code='OC'), 100.00, 13.00, 113.00,
   '11111111-1111-1111-1111-111111111101'),
  ('22222222-2222-2222-2222-222222222202',
   (select id from fx_loc where code='FE'),  current_date, 'T-FE-1',  'Test Cust',
   (select id from public.service_types where code='OC'), 100.00, 13.00, 113.00,
   '11111111-1111-1111-1111-111111111101')
on conflict (id) do nothing;

insert into public.expenses (
  id, location_id, expense_date, category_id,
  sub_total, hst, total, created_by
) values
  ('33333333-3333-3333-3333-333333333301',
   (select id from fx_loc where code='AYR'), current_date,
   (select id from public.expense_categories where name='Utility'),
   100.00, 13.00, 113.00,
   '11111111-1111-1111-1111-111111111101')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Helper: become a given auth user.
-- Works by setting the JWT claim and switching to `authenticated` role, which
-- is what RLS policies check via auth.uid().
-- ----------------------------------------------------------------------------

create or replace function test_become(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true);
end;
$$;

create or replace function test_clear() returns void
language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. sales_jobs SELECT scoping
-- ----------------------------------------------------------------------------

select test_become('11111111-1111-1111-1111-111111111101');
select is(
  (select count(*) from public.sales_jobs where id like '22222222%')::int,
  2,
  'owner sees both Ayr and FE sales_jobs'
);

select test_become('11111111-1111-1111-1111-111111111102');
select is(
  (select count(*) from public.sales_jobs where id like '22222222%')::int,
  1,
  'Ayr manager sees 1 sales_job (own location)'
);
select ok(
  not exists (select 1 from public.sales_jobs where id='22222222-2222-2222-2222-222222222202'),
  'Ayr manager cannot see FE sales_job'
);

select test_become('11111111-1111-1111-1111-111111111104');
select is(
  (select count(*) from public.sales_jobs where id like '22222222%')::int,
  1,
  'Ayr staff sees 1 sales_job (own location)'
);

select test_become('11111111-1111-1111-1111-111111111106');
select is(
  (select count(*) from public.sales_jobs where id like '22222222%')::int,
  2,
  'accountant reads both (cross-location read)'
);

select test_become('11111111-1111-1111-1111-111111111107');
select is(
  (select count(*) from public.sales_jobs where id like '22222222%')::int,
  0,
  'employee cannot read sales_jobs'
);

-- ----------------------------------------------------------------------------
-- 2. sales_jobs INSERT — staff cannot insert for another location
-- ----------------------------------------------------------------------------

select test_become('11111111-1111-1111-1111-111111111104'); -- Ayr staff

select throws_ok($$
  insert into public.sales_jobs (
    location_id, job_date, invoice_no, billing_name, service_type_id,
    sub_total, hst, total
  ) values (
    (select id from public.locations where code='FE'),
    current_date, 'T-FE-X', 'Bad Insert',
    (select id from public.service_types where code='OC'),
    100.00, 13.00, 113.00
  )
$$, '42501', 'Ayr staff cannot insert FE sales_job');

select lives_ok($$
  insert into public.sales_jobs (
    location_id, job_date, invoice_no, billing_name, service_type_id,
    sub_total, hst, total
  ) values (
    (select id from public.locations where code='AYR'),
    current_date, 'T-AYR-STAFF', 'Staff Insert',
    (select id from public.service_types where code='OC'),
    100.00, 13.00, 113.00
  )
$$, 'Ayr staff CAN insert into own location');

-- ----------------------------------------------------------------------------
-- 3. sales_jobs UPDATE — staff cannot edit post-submit
-- ----------------------------------------------------------------------------

select test_become('11111111-1111-1111-1111-111111111104');
select is(
  (with u as (
    update public.sales_jobs set comments='staff edit'
      where id='22222222-2222-2222-2222-222222222201'
      returning 1
  ) select count(*) from u)::int,
  0,
  'staff UPDATE on sales_jobs affects zero rows'
);

select test_become('11111111-1111-1111-1111-111111111102'); -- Ayr manager
select is(
  (with u as (
    update public.sales_jobs set comments='mgr edit ok'
      where id='22222222-2222-2222-2222-222222222201'
      returning 1
  ) select count(*) from u)::int,
  1,
  'Ayr manager CAN update own-location sales_job'
);

select test_become('11111111-1111-1111-1111-111111111102'); -- Ayr manager
select is(
  (with u as (
    update public.sales_jobs set comments='cross-loc edit'
      where id='22222222-2222-2222-2222-222222222202'
      returning 1
  ) select count(*) from u)::int,
  0,
  'Ayr manager CANNOT update FE sales_job'
);

-- ----------------------------------------------------------------------------
-- 4. Deactivation guard — only owner may toggle deactivated_at
-- ----------------------------------------------------------------------------

select test_become('11111111-1111-1111-1111-111111111102'); -- Ayr manager
select throws_ok($$
  update public.sales_jobs
     set deactivated_at = now()
   where id='22222222-2222-2222-2222-222222222201'
$$, '42501', 'manager cannot toggle deactivated_at');

select test_become('11111111-1111-1111-1111-111111111101'); -- owner
select lives_ok($$
  update public.sales_jobs
     set deactivated_at = now()
   where id='22222222-2222-2222-2222-222222222201'
$$, 'owner CAN toggle deactivated_at');

-- Revert so other tests still see the row (sales_invoice_active_uniq etc).
update public.sales_jobs set deactivated_at = null
  where id='22222222-2222-2222-2222-222222222201';

-- ----------------------------------------------------------------------------
-- 5. Expenses — staff without can_enter_expenses is blocked
-- ----------------------------------------------------------------------------

select test_become('11111111-1111-1111-1111-111111111104'); -- Ayr staff, flag=false
select throws_ok($$
  insert into public.expenses (
    location_id, expense_date, category_id,
    sub_total, hst, total
  ) values (
    (select id from public.locations where code='AYR'),
    current_date,
    (select id from public.expense_categories where name='Utility'),
    50.00, 6.50, 56.50
  )
$$, '42501', 'staff without can_enter_expenses cannot insert expense');

select test_become('11111111-1111-1111-1111-111111111105'); -- Ayr staff, flag=true
select lives_ok($$
  insert into public.expenses (
    location_id, expense_date, category_id,
    sub_total, hst, total
  ) values (
    (select id from public.locations where code='AYR'),
    current_date,
    (select id from public.expense_categories where name='Utility'),
    50.00, 6.50, 56.50
  )
$$, 'staff WITH can_enter_expenses CAN insert expense');

-- ----------------------------------------------------------------------------
-- 6. Expenses SELECT scoping
-- ----------------------------------------------------------------------------

select test_become('11111111-1111-1111-1111-111111111103'); -- FE manager
select is(
  (select count(*) from public.expenses where id='33333333-3333-3333-3333-333333333301')::int,
  0,
  'FE manager cannot see Ayr expense'
);

select test_become('11111111-1111-1111-1111-111111111106'); -- accountant
select is(
  (select count(*) from public.expenses where id='33333333-3333-3333-3333-333333333301')::int,
  1,
  'accountant sees all expenses'
);

-- ----------------------------------------------------------------------------
-- 7. Subcategory/category match trigger
-- ----------------------------------------------------------------------------

select test_become('11111111-1111-1111-1111-111111111101'); -- owner
select throws_ok($$
  insert into public.expenses (
    location_id, expense_date, category_id, subcategory_id,
    sub_total, hst, total
  ) values (
    (select id from public.locations where code='AYR'),
    current_date,
    (select id from public.expense_categories where name='Utility'),
    -- Wrong parent: a subcategory under 'Purchase'
    (select id from public.expense_subcategories
       where name='Filter'
         and category_id=(select id from public.expense_categories where name='Purchase')
    ),
    10.00, 1.30, 11.30
  )
$$, null, 'subcategory mismatch across categories is rejected by trigger');

-- ----------------------------------------------------------------------------
-- 8. my_dashboard() aggregator — manager sees own, not all
-- ----------------------------------------------------------------------------

select test_become('11111111-1111-1111-1111-111111111102'); -- Ayr manager
select is(
  (select count(*) from public.my_dashboard(current_date - 30, current_date))::int,
  1,
  'my_dashboard() returns 1 row for manager'
);

select test_become('11111111-1111-1111-1111-111111111101'); -- owner
select is(
  (select count(*) from public.my_dashboard(current_date - 30, current_date))::int,
  3,
  'my_dashboard() returns 3 rows for owner'
);

-- ----------------------------------------------------------------------------
-- 9. profiles — manager cannot change their own role
-- ----------------------------------------------------------------------------

select test_become('11111111-1111-1111-1111-111111111102'); -- Ayr manager
select throws_ok($$
  update public.profiles set role='owner'
    where id='11111111-1111-1111-1111-111111111102'
$$, '42501', 'manager cannot promote self to owner (blocked by profiles_guard trigger)');

-- ----------------------------------------------------------------------------
-- 10. Audit log visibility
-- ----------------------------------------------------------------------------

select test_become('11111111-1111-1111-1111-111111111102'); -- Ayr manager
select ok(
  (select count(*) from public.audit_log where location_id = (select id from fx_loc where code='FE')) = 0,
  'manager cannot read audit_log rows from another location'
);

select test_become('11111111-1111-1111-1111-111111111107'); -- employee
select is(
  (select count(*) from public.audit_log)::int,
  0,
  'employee cannot read any audit_log rows'
);

-- ----------------------------------------------------------------------------
-- Done
-- ----------------------------------------------------------------------------

select test_clear();
select finish();

rollback;
