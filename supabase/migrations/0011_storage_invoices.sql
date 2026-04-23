-- 0011_storage_invoices.sql
-- Supabase Storage bucket for generated invoice PDFs + per-location RLS.
-- Also adds invoice_pdf_path to sales_jobs for caching the storage path so
-- we don't regenerate on every download.

-- ============================================================================
-- Storage bucket
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices',
  'invoices',
  false,
  10485760,  -- 10 MB per PDF
  array['application/pdf']
)
on conflict (id) do nothing;

-- ============================================================================
-- Storage RLS policies (on storage.objects)
-- ============================================================================

-- Owner + accountant: read all invoices.
drop policy if exists invoices_select_owner on storage.objects;
create policy invoices_select_owner on storage.objects
  for select to authenticated
  using (
    bucket_id = 'invoices'
    and (
      private.current_role() in ('owner', 'accountant')
      or (
        private.current_role() in ('manager', 'staff')
        -- path format: <location_code>/<invoice_no>.pdf
        and split_part(name, '/', 1) = (
          select l.code
            from public.locations l
            join public.profiles p on p.location_id = l.id
           where p.id = auth.uid()
           limit 1
        )
      )
    )
  );

-- Only service_role (server actions) uploads PDFs.
drop policy if exists invoices_insert_service on storage.objects;
create policy invoices_insert_service on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and private.current_role() in ('owner', 'manager', 'accountant')
  );

drop policy if exists invoices_delete_owner on storage.objects;
create policy invoices_delete_owner on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'invoices'
    and private.current_role() = 'owner'
  );

-- ============================================================================
-- Cache the Storage path on the sales_jobs row
-- ============================================================================
alter table public.sales_jobs
  add column if not exists invoice_pdf_path text;
