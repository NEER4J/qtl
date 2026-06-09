-- 0084_locations_invoice_details.sql
-- Invoice header (shop name, address, phone, fax, HST/GST number) was hardcoded
-- in components/pdf/InvoicePdf.tsx. Move it onto each location so the invoice
-- auto-pulls the correct header from the job's location. address / phone /
-- email already exist on locations; add the invoice display name, fax, and the
-- HST/GST registration number.

alter table public.locations
  add column if not exists invoice_name text,
  add column if not exists fax text,
  add column if not exists hst_number text;

comment on column public.locations.invoice_name is
  'Business name shown on invoices for this location. Falls back to name.';
comment on column public.locations.hst_number is
  'HST/GST registration number printed on this location''s invoices.';

-- Pre-fill existing locations with the values that were previously hardcoded so
-- already-issued invoices keep the same header. Admin can edit per location.
update public.locations set
  invoice_name = coalesce(invoice_name, 'Quick Truck Lube'),
  address      = coalesce(address, '1010 Industrial Road, Ayr, Ontario, N0B 1E0'),
  phone        = coalesce(phone, '(519) 622-0660'),
  fax          = coalesce(fax, '519-622-2493'),
  hst_number   = coalesce(hst_number, '84754-0960 RT 001');
