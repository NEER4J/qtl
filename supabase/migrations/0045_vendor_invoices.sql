-- 0045_vendor_invoices.sql
-- Item #24c — vendor-side purchase invoice (we owe vendor). Distinct from
-- customer-facing sales invoices and orthogonal to the existing `expenses`
-- table. An expense remains the journal entry; a vendor_invoice is a
-- detailed bill we received from the vendor (line items linked to
-- vendor_parts when known).

create table if not exists public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  location_id uuid not null references public.locations(id),
  invoice_no text,
  invoice_date date not null,
  sub_total numeric(12,2) not null default 0,
  hst numeric(12,2) not null default 0,
  total numeric(12,2) generated always as (sub_total + hst) stored,
  paid_amount numeric(12,2) not null default 0,
  balance numeric(12,2) generated always as (sub_total + hst - paid_amount) stored,
  payment_status payment_status not null default 'outstanding',
  notes text,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create index if not exists vendor_invoices_vendor_idx
  on public.vendor_invoices(vendor_id) where deactivated_at is null;
create index if not exists vendor_invoices_location_idx
  on public.vendor_invoices(location_id) where deactivated_at is null;
create index if not exists vendor_invoices_status_idx
  on public.vendor_invoices(payment_status) where deactivated_at is null;

create table if not exists public.vendor_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.vendor_invoices(id) on delete cascade,
  vendor_part_id uuid references public.vendor_parts(id),
  description text,
  quantity numeric(10,2) not null,
  unit_cost numeric(12,2) not null,
  line_total numeric(12,2) generated always as (quantity * unit_cost) stored,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists vendor_invoice_items_invoice_idx
  on public.vendor_invoice_items(invoice_id);

drop trigger if exists trg_vendor_invoices_updated_at on public.vendor_invoices;
create trigger trg_vendor_invoices_updated_at
  before update on public.vendor_invoices
  for each row execute function public.set_updated_at();

drop trigger if exists trg_vendor_invoices_audit on public.vendor_invoices;
create trigger trg_vendor_invoices_audit
  after insert or update or delete on public.vendor_invoices
  for each row execute function public.audit_row();

drop trigger if exists trg_vendor_invoice_items_audit on public.vendor_invoice_items;
create trigger trg_vendor_invoice_items_audit
  after insert or update or delete on public.vendor_invoice_items
  for each row execute function public.audit_row();

alter table public.vendor_invoices enable row level security;
alter table public.vendor_invoice_items enable row level security;

drop policy if exists vendor_invoices_select on public.vendor_invoices;
create policy vendor_invoices_select on public.vendor_invoices
  for select using (true);

drop policy if exists vendor_invoices_insert on public.vendor_invoices;
create policy vendor_invoices_insert on public.vendor_invoices
  for insert with check (private.current_role() in ('owner','manager','accountant'));

drop policy if exists vendor_invoices_update on public.vendor_invoices;
create policy vendor_invoices_update on public.vendor_invoices
  for update using (private.current_role() in ('owner','manager','accountant'))
  with check (private.current_role() in ('owner','manager','accountant'));

drop policy if exists vendor_invoice_items_select on public.vendor_invoice_items;
create policy vendor_invoice_items_select on public.vendor_invoice_items
  for select using (true);

drop policy if exists vendor_invoice_items_insert on public.vendor_invoice_items;
create policy vendor_invoice_items_insert on public.vendor_invoice_items
  for insert with check (private.current_role() in ('owner','manager','accountant'));

drop policy if exists vendor_invoice_items_update on public.vendor_invoice_items;
create policy vendor_invoice_items_update on public.vendor_invoice_items
  for update using (private.current_role() in ('owner','manager','accountant'))
  with check (private.current_role() in ('owner','manager','accountant'));

drop policy if exists vendor_invoice_items_delete on public.vendor_invoice_items;
create policy vendor_invoice_items_delete on public.vendor_invoice_items
  for delete using (private.current_role() in ('owner','manager','accountant'));
