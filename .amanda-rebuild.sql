-- Set Amanda Profit's existing login password to amandap@qtl.
-- Paste into the Supabase SQL editor and run once.
-- Does not delete or recreate the user.

update auth.users
set
  encrypted_password = extensions.crypt('amandap@qtl', extensions.gen_salt('bf')),
  updated_at = now()
where lower(email) = 'amandap@team.qtl.app';

insert into public.profile_credentials (profile_id, password_plain)
select id, 'amandap@qtl'
from auth.users
where lower(email) = 'amandap@team.qtl.app'
on conflict (profile_id) do update
  set password_plain = excluded.password_plain;

select
  p.full_name,
  p.username,
  p.email,
  c.password_plain as password
from public.profiles p
join public.profile_credentials c on c.profile_id = p.id
where lower(p.email) = 'amandap@team.qtl.app';
rhc;vh