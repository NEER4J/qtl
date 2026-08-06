-- 0119_rls_initplan_perf.sql
--
-- PERFORMANCE ONLY. This migration does not change who can see or write
-- anything — it changes how often Postgres asks the question.
--
-- Every RLS policy in this schema calls the `private.*` helpers from 0003
-- directly:
--
--     using (private.current_role() in ('owner','accountant') or ...)
--
-- Those helpers are `stable security definer`, which means Postgres re-runs
-- them ONCE PER ROW being checked. A policy that mentions current_role()
-- three times, evaluated against a 5,000-row scan, is 15,000 index lookups
-- into public.profiles — for an answer that cannot change during the
-- statement.
--
-- Wrapping the call in a scalar sub-select:
--
--     using ((select private.current_role()) in ('owner','accountant') or ...)
--
-- turns it into an InitPlan: evaluated once, before the scan, and reused for
-- every row. This is the documented Supabase fix for exactly this pattern.
-- There were 280 unwrapped call sites across ~40 policies when this was
-- written, and hand-editing 117 historical migration files would have been
-- both enormous and impossible to keep correct as policies get replaced.
--
-- So instead of rewriting the source SQL, we rewrite the LIVE policies:
-- read each policy's current expression back out of the catalogue, wrap the
-- helper calls in it, and ALTER POLICY it into place. That means this stays
-- correct no matter which migration last defined a given policy, and any
-- policy added later can be folded in by re-running the same logic.
--
-- Idempotent: a policy whose expression already has the helper inside a
-- SELECT is skipped, so re-running is a no-op rather than a double-wrap.

-- Safety: each ALTER POLICY runs in its own plpgsql exception block, which
-- Postgres implements as a savepoint. The expressions being re-issued are
-- deparsed by the catalogue rather than written by hand, and while that text
-- is expected to re-parse cleanly, a single quirk in one of ~40 policies must
-- not abort the migration and take the deploy with it. A policy that fails to
-- rewrite is left EXACTLY as it was — still correct, just still slow — and is
-- reported at the end so it can be looked at directly.

do $$
declare
  r            record;
  v_qual       text;
  v_check      text;
  v_sql        text;
  v_rewritten  int := 0;
  v_skipped    int := 0;
  v_failed     int := 0;
  -- Matches the zero-argument stable helpers that RLS calls per row. auth.uid()
  -- is included for the same reason: it reads a GUC + parses a JWT claim on
  -- every invocation, and policies compare it against a column per row.
  c_pattern    constant text :=
    '(private\.current_role\(\)|private\.current_location\(\)|private\.can_enter_expenses\(\)|private\.is_owner\(\)|auth\.uid\(\))';
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (qual is not null or with_check is not null)
     order by tablename, policyname
  loop
    v_qual  := r.qual;
    v_check := r.with_check;

    -- Already wrapped? The deparsed form of a wrapped call reads
    -- "( SELECT private.current_role() AS current_role)", so a helper name
    -- appearing directly after SELECT means a previous run got here first.
    -- Note this deliberately does NOT match an ordinary EXISTS sub-query such
    -- as customers_select's "SELECT 1 FROM sales_jobs sj" — that policy still
    -- needs wrapping and must not be skipped.
    if coalesce(v_qual, '') || ' ' || coalesce(v_check, '')
         ~ 'SELECT (private\.|auth\.uid)' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Nothing to do if this policy never calls a helper.
    if coalesce(v_qual, '') || ' ' || coalesce(v_check, '') !~ c_pattern then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_qual  := regexp_replace(v_qual,  c_pattern, '(select \1)', 'g');
    v_check := regexp_replace(v_check, c_pattern, '(select \1)', 'g');

    -- USING and WITH CHECK are not interchangeable: an INSERT policy has only
    -- WITH CHECK, a SELECT/DELETE policy has only USING. Emitting the clause a
    -- policy doesn't have is a syntax error, so build the statement to match
    -- whatever the catalogue actually reported.
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_qual is not null then
      v_sql := v_sql || format(' using (%s)', v_qual);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    begin
      execute v_sql;
      v_rewritten := v_rewritten + 1;
    exception when others then
      -- Savepoint rolls back just this ALTER; the policy keeps its original
      -- (unwrapped, still-correct) expression and we carry on.
      v_failed := v_failed + 1;
      raise warning 'rls initplan: could not rewrite %.% policy % — left unchanged (%)',
        r.schemaname, r.tablename, r.policyname, sqlerrm;
    end;
  end loop;

  raise notice 'rls initplan: % rewritten, % skipped, % failed', v_rewritten, v_skipped, v_failed;
end $$;

-- ----------------------------------------------------------------------------
-- Verification. Counts policies that still call a helper outside a sub-select,
-- i.e. ones this migration did not manage to fix. Expected to be 0; a non-zero
-- count is a warning, not a failure, because an unwrapped policy is a
-- performance regression and never a security one.
--
-- To check by hand later:
--   select tablename, policyname from pg_policies
--    where schemaname = 'public'
--      and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ~ 'private\.current_role\(\)'
--      and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) !~ 'SELECT private\.';
-- ----------------------------------------------------------------------------
do $$
declare
  v_remaining int;
begin
  select count(*) into v_remaining
    from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
           ~ '(private\.current_role\(\)|private\.current_location\(\)|private\.can_enter_expenses\(\)|private\.is_owner\(\))'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) !~ 'SELECT (private\.|auth\.uid)';

  if v_remaining > 0 then
    raise warning 'rls initplan: % policies still evaluate a helper per row', v_remaining;
  else
    raise notice 'rls initplan: all public policies now evaluate helpers once per query';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Supporting index for the one policy that stayed expensive after wrapping.
--
-- customers_select lets a manager/staff see a customer who is not homed at
-- their location but HAS been served there, via a correlated sub-query:
--
--     exists (select 1 from sales_jobs sj
--              where sj.customer_id = customers.id
--                and sj.location_id = private.current_location())
--
-- That runs per customer row and had no index to land on — sales_customer_idx
-- is (customer_id) alone, so every probe still had to read and filter the
-- matching jobs to test the location. The composite lets the EXISTS terminate
-- on an index-only lookup.
-- ----------------------------------------------------------------------------
create index if not exists sales_jobs_customer_location_idx
  on public.sales_jobs (customer_id, location_id);
