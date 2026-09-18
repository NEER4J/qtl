-- 0146_deck_analytics.sql
-- Upper / Lower deck analytics (client 2026-09-15 — "show all deck types and
-- what is happening with the decks").
--
-- A job records who worked each deck in two free-text columns,
-- sales_jobs.upper_tech / lower_tech (named upper_deck / lower_deck until 0026),
-- picked from the technicians roster (0065) but not FK'd, so legacy typed names
-- still count. Those are the only two decks the platform has.
--
-- Aggregated here rather than in TypeScript because PostgREST caps a response at
-- 1,000 rows: a busy month has more jobs than that, and a client-side tally
-- would silently undercount (the same trap the dashboard RPCs avoid).
--
-- SECURITY INVOKER on purpose: the caller's own RLS on sales_jobs decides which
-- shops' jobs are counted, exactly as the other analytics pages read them. The
-- app passes the location list it already resolved (resolveLocationFilter) on
-- top of that.
--
-- Rules:
--   * deactivated jobs, credit / return jobs (credited_from_job_id, 0118) and
--     negative-total jobs are left out — a credit note re-lists the same techs
--     and would double their job count while cancelling their sales;
--   * names are matched to the roster trimmed and case-insensitively, inactive
--     technicians included, so "  jaspreet" and "Jaspreet" are one person and a
--     tech who has left still shows under their name; anything not on the
--     roster is kept as typed;
--   * revenue is the job total, the same figure Sales analytics uses;
--   * average time only counts jobs with a recorded duration.
--
-- p_technician (optional) keeps jobs where that person worked either deck.

create or replace function public.deck_analytics(
  p_from date,
  p_to date,
  p_location_ids uuid[] default null,
  p_technician text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with roster as (
    -- One display name per spelling; an active row wins over an old one.
    select distinct on (lower(btrim(t.name)))
           lower(btrim(t.name)) as k,
           btrim(t.name)        as name
      from public.technicians t
     order by lower(btrim(t.name)), t.active desc, t.updated_at desc
  ),
  jobs as (
    select sj.job_date,
           sj.total,
           sj.duration_minutes,
           coalesce(st.code::text, '?')    as service_code,
           coalesce(st.name, 'Unknown')    as service_name,
           coalesce(ru.name, nullif(btrim(sj.upper_tech), '')) as upper_tech,
           coalesce(rl.name, nullif(btrim(sj.lower_tech), '')) as lower_tech
      from public.sales_jobs sj
      left join public.service_types st on st.id = sj.service_type_id
      left join roster ru on ru.k = lower(btrim(sj.upper_tech))
      left join roster rl on rl.k = lower(btrim(sj.lower_tech))
     where sj.deactivated_at is null
       and sj.credited_from_job_id is null
       and sj.total >= 0
       and sj.job_date between p_from and p_to
       and (p_location_ids is null or sj.location_id = any (p_location_ids))
  ),
  filtered as (
    select *
      from jobs
     where nullif(btrim(p_technician), '') is null
        or lower(upper_tech) = lower(btrim(p_technician))
        or lower(lower_tech) = lower(btrim(p_technician))
  ),
  by_deck as (
    select 'upper'::text as deck, f.upper_tech as tech, f.job_date, f.total,
           f.duration_minutes, f.service_code, f.service_name
      from filtered f
    union all
    select 'lower'::text, f.lower_tech, f.job_date, f.total,
           f.duration_minutes, f.service_code, f.service_name
      from filtered f
  )
  select jsonb_build_object(
    'total_jobs', (select count(*) from filtered),

    'coverage', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.deck desc), '[]'::jsonb)
        from (
          select deck,
                 count(*) filter (where tech is not null) as assigned,
                 count(*) filter (where tech is null)     as blank
            from by_deck
           group by deck
        ) c
    ),

    'by_tech', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.deck desc, t.jobs desc, t.tech), '[]'::jsonb)
        from (
          select deck,
                 tech,
                 count(*)                                                   as jobs,
                 round(sum(total), 2)                                       as revenue,
                 round(avg(duration_minutes) filter (where duration_minutes > 0), 1) as avg_minutes,
                 count(*) filter (where duration_minutes > 0)               as timed_jobs
            from by_deck
           where tech is not null
           group by deck, tech
        ) t
    ),

    'service_mix', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.deck desc, s.tech, s.jobs desc), '[]'::jsonb)
        from (
          select deck, tech, service_code, service_name, count(*) as jobs
            from by_deck
           where tech is not null
           group by deck, tech, service_code, service_name
        ) s
    ),

    'pairs', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.jobs desc, p.upper_tech, p.lower_tech), '[]'::jsonb)
        from (
          select upper_tech, lower_tech, count(*) as jobs, round(sum(total), 2) as revenue
            from filtered
           where upper_tech is not null and lower_tech is not null
           group by upper_tech, lower_tech
           order by count(*) desc
           limit 20
        ) p
    ),

    'weekly', (
      select coalesce(jsonb_agg(to_jsonb(w) order by w.week), '[]'::jsonb)
        from (
          select date_trunc('week', job_date)::date                    as week,
                 count(*)                                              as jobs,
                 count(*) filter (where upper_tech is not null)        as upper,
                 count(*) filter (where lower_tech is not null)        as lower
            from filtered
           group by 1
        ) w
    )
  );
$$;

revoke all on function public.deck_analytics(date, date, uuid[], text) from public;
revoke all on function public.deck_analytics(date, date, uuid[], text) from anon;
grant execute on function public.deck_analytics(date, date, uuid[], text) to authenticated;
