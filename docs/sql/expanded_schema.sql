-- ==============================================================================
-- Expanded Supabase Schema for Performance Metrics
-- ==============================================================================

-- 1. Mutual Funds table (Static Details)
CREATE TABLE IF NOT EXISTS public.mutual_funds (
    scheme_code BIGINT PRIMARY KEY,
    isin TEXT,
    scheme_name TEXT NOT NULL,
    category TEXT
);

-- 2. Fund Performance table (Calculated Metrics)
CREATE TABLE IF NOT EXISTS public.fund_performance (
    scheme_code BIGINT PRIMARY KEY REFERENCES public.mutual_funds(scheme_code),
    latest_nav NUMERIC,
    nav_date DATE,
    
    -- 1 Day
    return_1d NUMERIC,
    
    -- 1 Week
    return_1w NUMERIC,
    cat_avg_1w NUMERIC,
    rank_1w TEXT,
    
    -- 1 Month
    return_1m NUMERIC,
    cat_avg_1m NUMERIC,
    rank_1m TEXT,
    
    -- 3 Month
    return_3m NUMERIC,
    cat_avg_3m NUMERIC,
    rank_3m TEXT,
    
    -- 6 Month
    return_6m NUMERIC,
    cat_avg_6m NUMERIC,
    rank_6m TEXT,
    
    -- 1 Year
    return_1y NUMERIC,
    cat_avg_1y NUMERIC,
    rank_1y TEXT,
    
    -- 3 Year (Annualized)
    return_3y NUMERIC,
    cat_avg_3y NUMERIC,
    rank_3y TEXT,
    
    -- 5 Year (Annualized)
    return_5y NUMERIC,
    cat_avg_5y NUMERIC,
    rank_5y TEXT,
    
    -- Since Inception (of tracked data)
    return_inception NUMERIC,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance queries
CREATE INDEX IF NOT EXISTS idx_fund_perf_updated ON public.fund_performance(updated_at);
