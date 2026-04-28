-- 0034_sales_jobs_invoice_fields.sql
-- Adds the customer/vehicle fields shown on the printed invoice (Quick Truck
-- Lube reference): full bill-to address, additional phone numbers, customer
-- order number, vehicle make/model/year/VIN/engine size and unit number.
-- All optional — staff can fill them as needed when creating a job.

alter table public.sales_jobs
  add column if not exists billing_address text,
  add column if not exists business_phone text,
  add column if not exists alt_phone text,
  add column if not exists customer_order_no text,
  add column if not exists unit_no text,
  add column if not exists vehicle_year smallint
    check (vehicle_year is null or (vehicle_year between 1900 and 2100)),
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vin text,
  add column if not exists engine_size text;
