-- ==============================================================================
-- Supabase Schema for PaisekaBhoot Portfolio Management
-- ==============================================================================

-- 1. Create Mutual Funds Table (Static details)
CREATE TABLE IF NOT EXISTS public.mutual_funds (
    scheme_code BIGINT PRIMARY KEY,
    isin TEXT,
    scheme_name TEXT NOT NULL,
    category TEXT
);

-- 2. Create NAV History Table (Stores daily NAVs)
CREATE TABLE IF NOT EXISTS public.nav_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scheme_code BIGINT REFERENCES public.mutual_funds(scheme_code),
    nav_date DATE NOT NULL,
    nav_value NUMERIC NOT NULL,
    UNIQUE(scheme_code, nav_date) -- Prevents duplicate NAV entries for the same day
);

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_nav_history_scheme_date ON public.nav_history(scheme_code, nav_date);

-- 3. Create Fund Performance Table (Pre-calculated metrics for fast dashboard loading)
CREATE TABLE IF NOT EXISTS public.fund_performance (
    scheme_code BIGINT PRIMARY KEY REFERENCES public.mutual_funds(scheme_code),
    latest_nav NUMERIC,
    nav_date DATE,
    return_1y NUMERIC,
    return_3y NUMERIC,
    return_5y NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- RLS (Row Level Security) Policies
-- ==============================================================================
-- Since you provided the ANON key, we need to allow anonymous inserts for your script to work.
-- In a strict production environment, you would use a SERVICE ROLE KEY and disable these.

ALTER TABLE public.mutual_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_performance ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access to mutual_funds') THEN
        CREATE POLICY "Allow public read access to mutual_funds" ON public.mutual_funds FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access to nav_history') THEN
        CREATE POLICY "Allow public read access to nav_history" ON public.nav_history FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access to fund_performance') THEN
        CREATE POLICY "Allow public read access to fund_performance" ON public.fund_performance FOR SELECT USING (true);
    END IF;
END $$;

-- Allow anonymous script to insert/update (using your anon key)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon insert mutual_funds') THEN
        CREATE POLICY "Allow anon insert mutual_funds" ON public.mutual_funds FOR INSERT WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon update mutual_funds') THEN
        CREATE POLICY "Allow anon update mutual_funds" ON public.mutual_funds FOR UPDATE USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon insert nav_history') THEN
        CREATE POLICY "Allow anon insert nav_history" ON public.nav_history FOR INSERT WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon update nav_history') THEN
        CREATE POLICY "Allow anon update nav_history" ON public.nav_history FOR UPDATE USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon insert fund_performance') THEN
        CREATE POLICY "Allow anon insert fund_performance" ON public.fund_performance FOR INSERT WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon update fund_performance') THEN
        CREATE POLICY "Allow anon update fund_performance" ON public.fund_performance FOR UPDATE USING (true);
    END IF;
END $$;
