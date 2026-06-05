-- 0076_manager_supervisor_cross_location.sql
--
-- Manager and Supervisor now default to ALL-LOCATION access (cross_location).
-- This flips existing managers/supervisors on; new ones default on in the
-- Add/Edit user dialog. The flag remains per-user toggleable by the Admin.
--
-- How the access actually takes effect (no policy changes needed here):
--   * private.has_cross_location() (0061) already grants `manager` the
--     all-location RLS policies when the flag is true.
--   * supervisor is aliased to manager inside private.current_role() (0074),
--     so those same manager policies cover supervisor once the flag is set.
--
-- Compared on role::text so we never reference the freshly-added enum labels
-- as literals.

update public.profiles
   set cross_location = true
 where role::text in ('manager', 'supervisor')
   and cross_location is distinct from true;
