-- Omkar Bhekane portfolio upload dashboard
-- Run this in Supabase SQL Editor AFTER creating your one admin Auth user.
-- Replace the UUID in the INSERT statement with that user's Auth user ID.
-- The only registered admin is explicitly allow-listed in private.portfolio_admins.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.portfolio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on table private.portfolio_admins from public, anon, authenticated;

create or replace function public.is_portfolio_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.portfolio_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_portfolio_admin() from public, anon;
grant execute on function public.is_portfolio_admin() to authenticated;

-- Add the ONE owner account created in Authentication > Users.
insert into private.portfolio_admins (user_id)
values ('REPLACE-WITH-YOUR-AUTH-USER-UUID')
on conflict (user_id) do nothing;

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('project','certificate')),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 700),
  organization text,
  completion_date date,
  technologies text[] not null default '{}',
  github_url text,
  live_url text,
  credential_url text,
  asset_url text,
  asset_path text,
  status text not null default 'published' check (status = 'published'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_items_type_created_idx
  on public.portfolio_items (item_type, created_at desc);
create index if not exists portfolio_items_owner_idx
  on public.portfolio_items (owner_id);

alter table public.portfolio_items enable row level security;
revoke all on table public.portfolio_items from anon, authenticated;
grant select on table public.portfolio_items to anon, authenticated;
grant insert, update, delete on table public.portfolio_items to authenticated;

drop policy if exists "Public can read published portfolio entries" on public.portfolio_items;
create policy "Public can read published portfolio entries"
on public.portfolio_items for select
to anon
using (status = 'published');

drop policy if exists "Only the portfolio owner can read entries" on public.portfolio_items;
create policy "Only the portfolio owner can read entries"
on public.portfolio_items for select
to authenticated
using (public.is_portfolio_admin() and owner_id = (select auth.uid()));

drop policy if exists "Only the portfolio owner can insert entries" on public.portfolio_items;
create policy "Only the portfolio owner can insert entries"
on public.portfolio_items for insert
to authenticated
with check (public.is_portfolio_admin() and owner_id = (select auth.uid()) and status = 'published');

drop policy if exists "Only the portfolio owner can update entries" on public.portfolio_items;
create policy "Only the portfolio owner can update entries"
on public.portfolio_items for update
to authenticated
using (public.is_portfolio_admin() and owner_id = (select auth.uid()))
with check (public.is_portfolio_admin() and owner_id = (select auth.uid()) and status = 'published');

drop policy if exists "Only the portfolio owner can delete entries" on public.portfolio_items;
create policy "Only the portfolio owner can delete entries"
on public.portfolio_items for delete
to authenticated
using (public.is_portfolio_admin() and owner_id = (select auth.uid()));

-- Public bucket: ONLY for assets intentionally published on the public portfolio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-assets',
  'portfolio-assets',
  true,
  20971520,
  array['application/pdf','image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Portfolio owner can upload portfolio assets" on storage.objects;
create policy "Portfolio owner can upload portfolio assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'portfolio-assets'
  and public.is_portfolio_admin()
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Portfolio owner can delete portfolio assets" on storage.objects;
create policy "Portfolio owner can delete portfolio assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'portfolio-assets'
  and public.is_portfolio_admin()
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
