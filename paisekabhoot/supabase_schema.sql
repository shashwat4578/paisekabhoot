-- ============================================================
-- paisekabhoot.com — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. PROFILES TABLE ──────────────────────────────────────
-- Mirrors auth.users; one row per registered user.
-- The id column is a foreign key to auth.users(id) so that
-- deleting a user also deletes their profile (cascade).

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  email        text unique,
  avatar_url   text,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

-- Index for fast lookup by email
create index if not exists profiles_email_idx on public.profiles(email);


-- ── 2. ROW LEVEL SECURITY ──────────────────────────────────
-- Enable RLS so users can only access their own row.

alter table public.profiles enable row level security;

-- Allow a user to read their own profile
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Allow a user to insert their own profile (on sign-up)
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Allow a user to update their own profile
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Prevent users from deleting their own profile directly
-- (deletion is handled by cascade from auth.users)


-- ── 3. AUTO-UPDATE updated_at ──────────────────────────────
-- Trigger to keep updated_at current on every row update.

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute procedure public.handle_updated_at();


-- ── 4. AUTO-CREATE PROFILE ON SIGN-UP ──────────────────────
-- Trigger that fires after a new user is inserted into
-- auth.users and automatically creates their profile row.
-- This covers both email/password and OAuth sign-ups.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;  -- safe to call multiple times
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();


-- ── 5. VERIFY SETUP ────────────────────────────────────────
-- Run this to confirm everything was created correctly:
--
--   select * from public.profiles limit 5;
--   select schemaname, tablename, rowsecurity
--     from pg_tables
--    where tablename = 'profiles';
