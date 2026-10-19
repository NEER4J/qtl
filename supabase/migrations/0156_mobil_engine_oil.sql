-- 0156_mobil_engine_oil.sql
--
-- Mobil 15W40 HDEO and Mobil 10W30 HDEO were added on 2026-06-02, a week
-- before 0081 flagged every oil without engine sell-price rows as a
-- non-engine fluid. They had no rows yet, so they were caught by it — and
-- Oil detail and the oil-change grid list engine oils only, so Mobil went
-- missing there (client 2026-10-19). They are engine oils, in the 15W40 and
-- 10W30 groups with the other brands.

update public.oil_types
   set is_engine_oil = true
 where code in ('50263695', '50263696')
   and is_engine_oil = false;
