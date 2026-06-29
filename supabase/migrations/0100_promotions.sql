-- 0100_promotions.sql
-- Promotions = named discounts (percent or fixed $) that can be added as a
-- discount line on a sales job AND on an expense. (client 2026-06-28)
--   * Managed on a new Settings → Promotions page (owner / co_owner).
--   * Readable by everyone signed in, so the job/expense pickers can list them.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  active boolean not null default true,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

alter table public.promotions enable row level security;

-- owner / co_owner manage everything (is_owner() = owner or co_owner). Table is
-- created after 0067's generic policy, so it needs its own.
drop policy if exists promotions_admin_all on public.promotions;
create policy promotions_admin_all on public.promotions
  for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

-- Everyone signed in can read (the sales-job + expense pickers list them).
drop policy if exists promotions_select on public.promotions;
create policy promotions_select on public.promotions
  for select to authenticated
  using (true);

drop trigger if exists trg_promotions_updated_at on public.promotions;
create trigger trg_promotions_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_promotions_audit on public.promotions;
create trigger trg_promotions_audit
  after insert or update or delete on public.promotions
  for each row execute function public.audit_row();
