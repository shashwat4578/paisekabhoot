-- Run this in your Supabase SQL Editor to fix the missing column issue and refresh the cache

ALTER TABLE public.nav_history ADD COLUMN IF NOT EXISTS nav_value NUMERIC NOT NULL DEFAULT 0;

-- Force PostgREST to reload the schema cache so the API recognizes the new column immediately
NOTIFY pgrst, 'reload schema';
