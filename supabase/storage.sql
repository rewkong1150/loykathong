-- =====================================================================
-- Photo storage. Run AFTER schema.sql (it uses public.is_company_user()).
-- Public-read bucket; each signed-in company user may only write inside
-- their own folder: entries/<user id>/...
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entries', 'entries', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "entries: upload own folder" on storage.objects;
create policy "entries: upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entries'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_company_user()
  );

drop policy if exists "entries: update own files" on storage.objects;
create policy "entries: update own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text and public.is_company_user());

drop policy if exists "entries: delete own files" on storage.objects;
create policy "entries: delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text and public.is_company_user());
