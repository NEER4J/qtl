-- 0102_promotions_is_taxable.sql
-- A promotion is a NON-taxable discount by default: the discount applies "after
-- everything", so it should NOT reduce the HST base. Add a per-promotion taxable
-- flag (like parts) so the owner can opt a specific promo back into being taxable.
-- (client 2026-06-30)

alter table public.promotions
  add column if not exists is_taxable boolean not null default false;

comment on column public.promotions.is_taxable is
  'When false (default) the promo discount line is HST-exempt — it does not lower the taxable subtotal, so HST is charged before the discount. Set true to apply the discount before tax.';
