-- 0136_payroll_holiday_hours_rate.sql
-- Client 2026-08-31: holiday pay is entered as HOURS and a RATE, like regular
-- and overtime — the dollar amount is worked out from them, not typed in.
--
-- holiday_pay (added in 0051) stays exactly where it is and keeps its meaning:
-- it is still the dollar figure that feeds insurable earnings, the vacation
-- accrual base, net pay, and get_my_pay(). What changes is that the app now
-- COMPUTES it as holiday_hours × holiday_rate instead of taking a typed number.
--
-- holiday_rate is stored separately from `rate` on purpose: stat holiday pay is
-- often an averaged rate rather than the person's current hourly rate, so the
-- register has to show what was actually used. The app falls back to `rate`
-- when holiday hours are entered with no holiday rate.

alter table public.payroll_entries
  add column if not exists holiday_hours numeric(6,2) not null default 0
    check (holiday_hours >= 0),
  add column if not exists holiday_rate numeric(10,4) not null default 0
    check (holiday_rate >= 0);

comment on column public.payroll_entries.holiday_hours is
  'Stat holiday hours paid this period. holiday_pay = holiday_hours × holiday_rate (computed by the app).';
comment on column public.payroll_entries.holiday_rate is
  'Hourly rate used for holiday hours — kept apart from `rate` because stat pay is often an averaged rate. 0 means the app used `rate`.';

-- Split any holiday amount already recorded back into hours × rate so the new
-- fields reproduce the same dollars. Rows with an amount but no hourly rate
-- can't be split; they keep their holiday_pay until someone re-saves the entry,
-- at which point it recomputes from the (zero) hours — those rows are listed by
-- the check below so they can be re-entered by hand if there are any.
update public.payroll_entries
   set holiday_rate  = rate,
       holiday_hours = round(holiday_pay / rate, 2)
 where holiday_pay > 0
   and rate > 0
   and holiday_hours = 0;

do $$
declare v_orphans int;
begin
  select count(*) into v_orphans
    from public.payroll_entries
   where holiday_pay > 0 and holiday_hours = 0;
  if v_orphans > 0 then
    raise notice '0136: % payroll entr(ies) have holiday pay that could not be split into hours × rate (no hourly rate on the entry). Re-enter their holiday hours before saving those entries again.', v_orphans;
  end if;
end $$;
