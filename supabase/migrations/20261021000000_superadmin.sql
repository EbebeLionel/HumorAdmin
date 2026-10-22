-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Used by the admin panel (separate repo), which talks to this same database.

-- 1. The flag that unlocks the admin panel
alter table public.profiles add column if not exists is_superadmin boolean not null default false;

-- Users can update their own profiles row (name, avatar), so without this anyone could
-- PATCH is_superadmin = true on themselves through the API. Requests from the app run
-- as the anon/authenticated roles; the SQL editor runs as postgres and is not affected.
create or replace function public.protect_superadmin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_superadmin := false;
    else
      new.is_superadmin := old.is_superadmin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_superadmin on public.profiles;
create trigger profiles_protect_superadmin
  before insert or update on public.profiles
  for each row execute function public.protect_superadmin_flag();

-- 2. Helper for RLS policies. security definer so it can read profiles without
-- re-triggering profiles' own policies (which would recurse).
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

-- 3. Admin access, added alongside the existing per-user policies (policies are OR'ed)

-- READ users/profiles
drop policy if exists "Superadmins can view all profiles" on public.profiles;
create policy "Superadmins can view all profiles" on public.profiles
  for select to authenticated using ((select public.is_superadmin()));

-- CREATE/READ/UPDATE/DELETE AI generated media (images + captions; reading is already public)
drop policy if exists "Superadmins can insert images" on public.images;
create policy "Superadmins can insert images" on public.images
  for insert to authenticated with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can update images" on public.images;
create policy "Superadmins can update images" on public.images
  for update to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can delete images" on public.images;
create policy "Superadmins can delete images" on public.images
  for delete to authenticated using ((select public.is_superadmin()));

drop policy if exists "Superadmins can insert captions" on public.captions;
create policy "Superadmins can insert captions" on public.captions
  for insert to authenticated with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can update captions" on public.captions;
create policy "Superadmins can update captions" on public.captions
  for update to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can delete captions" on public.captions;
create policy "Superadmins can delete captions" on public.captions
  for delete to authenticated using ((select public.is_superadmin()));

-- READ upvotes/downvotes
drop policy if exists "Superadmins can view all votes" on public.caption_votes;
create policy "Superadmins can view all votes" on public.caption_votes
  for select to authenticated using ((select public.is_superadmin()));

-- Storage: admins can upload/read/delete any caption photo (e.g. removing someone else's upload)
drop policy if exists "Superadmins can upload caption images" on storage.objects;
create policy "Superadmins can upload caption images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'caption-images' and (select public.is_superadmin()));

drop policy if exists "Superadmins can read caption images" on storage.objects;
create policy "Superadmins can read caption images" on storage.objects
  for select to authenticated
  using (bucket_id = 'caption-images' and (select public.is_superadmin()));

drop policy if exists "Superadmins can delete caption images" on storage.objects;
create policy "Superadmins can delete caption images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'caption-images' and (select public.is_superadmin()));

-- 4. Avoiding the lockout: nobody is an admin yet, and the API can't grant it (see the
-- trigger above). The SQL editor runs as the database owner, so promote yourself here.
-- Replace the email with the Google account you sign in with, then run:
--
--   update public.profiles set is_superadmin = true where email = 'your-uni@columbia.edu';
--
-- Check it worked:
--
--   select email, is_superadmin from public.profiles where is_superadmin;
