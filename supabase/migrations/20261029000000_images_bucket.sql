-- Week 7: Storage bucket for images uploaded from the admin panel (Images → + New image).
-- Run once in the Supabase SQL editor of the project the admin panel points at. Safe to re-run.
-- The teaching-data restore brings the storage policies but not the bucket itself.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only superadmins may write to the bucket; anyone may view (it's public)
drop policy if exists "Superadmins can upload images" on storage.objects;
create policy "Superadmins can upload images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and public.is_superadmin((select auth.uid())));

drop policy if exists "Superadmins can update images" on storage.objects;
create policy "Superadmins can update images" on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and public.is_superadmin((select auth.uid())));

drop policy if exists "Superadmins can delete images" on storage.objects;
create policy "Superadmins can delete images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and public.is_superadmin((select auth.uid())));

drop policy if exists "Public images are viewable by everyone" on storage.objects;
create policy "Public images are viewable by everyone" on storage.objects
  for select to public
  using (bucket_id = 'images');
