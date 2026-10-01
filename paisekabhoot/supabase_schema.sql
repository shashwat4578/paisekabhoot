-- ============================================================
-- paisekabhoot.com — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. PROFILES TABLE ──────────────────────────────────────
-- Mirrors auth.users; one row per registered user.
-- Stores Full Name, Email, Mobile, PAN, Tax Status, KYC Status, Verification Flags.

create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  full_name          text,
  email              text unique,
  mobile             text,
  pan                text,
  tax_status         text default 'Individual',
  kyc_status         text default 'VERIFIED',
  is_email_verified  boolean default true,
  is_mobile_verified boolean default true,
  avatar_url         text,
  created_at         timestamptz default now() not null,
  updated_at         timestamptz default now() not null
);

-- Ensure columns exist if table was already created
alter table public.profiles add column if not exists mobile text;
alter table public.profiles add column if not exists pan text;
alter table public.profiles add column if not exists tax_status text default 'Individual';
alter table public.profiles add column if not exists kyc_status text default 'VERIFIED';
alter table public.profiles add column if not exists is_email_verified boolean default true;
alter table public.profiles add column if not exists is_mobile_verified boolean default true;

-- Index for fast lookup by email and mobile
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_mobile_idx on public.profiles(mobile);

-- ── 2. ROW LEVEL SECURITY ──────────────────────────────────
-- Enable RLS so users can access their own row, and service role can access all.

alter table public.profiles enable row level security;

-- Drop existing policies if needed to avoid duplicate conflicts
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

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

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute procedure public.handle_updated_at();


-- ── 4. AUTO-CREATE PROFILE ON SIGN-UP ──────────────────────
-- Trigger that fires after a new user is inserted into
-- auth.users and automatically creates their profile row.
-- Handles all extra metadata: mobile, pan, tax_status, kyc_status.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    mobile,
    pan,
    tax_status,
    kyc_status,
    is_email_verified,
    is_mobile_verified,
    avatar_url
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'mobile',
    new.raw_user_meta_data->>'pan',
    coalesce(new.raw_user_meta_data->>'tax_status', 'Individual'),
    coalesce(new.raw_user_meta_data->>'kyc_status', 'VERIFIED'),
    coalesce((new.raw_user_meta_data->>'is_email_verified')::boolean, true),
    coalesce((new.raw_user_meta_data->>'is_mobile_verified')::boolean, true),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    mobile = coalesce(excluded.mobile, public.profiles.mobile),
    pan = coalesce(excluded.pan, public.profiles.pan),
    tax_status = coalesce(excluded.tax_status, public.profiles.tax_status),
    kyc_status = coalesce(excluded.kyc_status, public.profiles.kyc_status),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
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

