-- 0057_transmission_services.sql
--
-- Flat-priced service catalogue for the "Trans & Diff" Excel tab.
--
-- WHY: The Excel "Trans & Diff" tab is a hand-priced service list — not an
-- engine × oil grid. It covers Allison transmissions, differential oil
-- changes, combined trans+diff jobs, DT12 / I-Shift trans, and coolant
-- flushes. Each row has a fixed sell price (Reg vs Syn) the owner sets and
-- a litre capacity for cost reporting.

create table if not exists public.transmission_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_kind text not null check (service_kind in (
    'allison_trans',   -- Allison Trans 2500 / 4500 / 4500 Dump
    'diff',            -- Diff Oil Change (Single / Dual)
    'trans',           -- Trans Oil Change (Reg/Syn standalone)
    'combined',        -- Trans & Diff Oil Change / Trans & Single Diff
    'specialty_trans', -- DT12 / I-Shift
    'coolant_flush'    -- Coolant flush by coolant type
  )),
  /** Reg vs Syn block. Coolant flush rows are neither — set to false. */
  is_synthetic boolean not null default false,
  /** Which oil this service uses. Optional — coolant_flush uses a coolant
   *  oil_type (codes 13/15/17/18 in our schema); some services span multiple
   *  oils and leave this null. */
  oil_type_id uuid references public.oil_types(id) on delete set null,
  /** Capacity in litres for cost reporting. Null if not applicable. */
  litres numeric(6,2) check (litres is null or litres > 0),
  /** The hand-tuned sell price from the Excel. Always positive. */
  sell_price numeric(10,2) not null check (sell_price > 0),
  /** Fixed labour component for coolant flush ($125 in Excel). Null = roll into sell_price. */
  labour numeric(10,2) check (labour is null or labour >= 0),
  notes text,
  sort_order smallint not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (service_kind, name, is_synthetic)
);

create index if not exists idx_transmission_services_kind on public.transmission_services(service_kind);
create index if not exists idx_transmission_services_oil  on public.transmission_services(oil_type_id);

drop trigger if exists trg_transmission_services_updated_at on public.transmission_services;
create trigger trg_transmission_services_updated_at
  before update on public.transmission_services
  for each row execute function public.set_updated_at();

drop trigger if exists trg_transmission_services_audit on public.transmission_services;
create trigger trg_transmission_services_audit
  after insert or update or delete on public.transmission_services
  for each row execute function public.audit_row();

alter table public.transmission_services enable row level security;

drop policy if exists transmission_services_select on public.transmission_services;
create policy transmission_services_select on public.transmission_services
  for select to authenticated using (true);

drop policy if exists transmission_services_write on public.transmission_services;
create policy transmission_services_write on public.transmission_services
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');
