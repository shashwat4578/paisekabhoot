import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
import glob

load_dotenv()

# Supabase Setup
url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def calculate_performance_and_rankings(full_df, periods):
    print(f"Processing performance for {full_df['Scheme Code'].nunique()} schemes...")
    latest_date = full_df['Date_dt'].max()
    
    # Pre-sort to ensure iloc[0] and iloc[-1] are predictable
    full_df = full_df.sort_values(['Scheme Code', 'Date_dt'])
    
    results = []
    
    # Use groupby for massive speedup
    for scheme_code, scheme_df in full_df.groupby('Scheme Code'):
        # Get latest row for this scheme
        latest_row = scheme_df.iloc[-1]
        
        # Only process if this scheme has data on the latest global date 
        # (or at least recent data, but usually we want funds active today)
        if latest_row['Date_dt'] < (latest_date - timedelta(days=7)):
            continue
            
        current_nav = float(latest_row['Net Asset Value'])
        nav_date_actual = latest_row['Date_dt']

        metrics = {
            'scheme_code': int(scheme_code),
            'latest_nav': current_nav,
            'nav_date': nav_date_actual.strftime('%Y-%m-%d')
        }
        
        # 1. Standard Periods
        dates = scheme_df['Date_dt'].values
        navs = scheme_df['Net Asset Value'].values
        for label, days in periods.items():
            target_date = nav_date_actual - timedelta(days=days)
            target_date_np = np.datetime64(target_date)
            # Find the index of the last date <= target_date using searchsorted
            idx = np.searchsorted(dates, target_date_np, side='right') - 1
            
            if idx >= 0:
                old_nav = float(navs[idx])
                old_date = pd.Timestamp(dates[idx])
                
                if old_nav > 0:
                    days_elapsed = (nav_date_actual - old_date).days
                    if days_elapsed > 0:
                        total_return = (current_nav / old_nav) - 1
                        metrics[f'return_{label}_abs'] = round(total_return * 100, 2)
                        
                        annualized = (1 + total_return) ** (365.0 / days_elapsed) - 1
                        metrics[f'return_{label}_ann'] = round(annualized * 100, 2)
        
        # 2. Since Inception
        inception_row = scheme_df.iloc[0]
        inc_nav = float(inception_row['Net Asset Value'])
        inc_date = inception_row['Date_dt']
        
        if inc_nav > 0:
            days_elapsed = (nav_date_actual - inc_date).days
            if days_elapsed > 0:
                total_return = (current_nav / inc_nav) - 1
                metrics['return_inception_abs'] = round(total_return * 100, 2)
                
                annualized = (1 + total_return) ** (365.0 / days_elapsed) - 1
                metrics['return_inception_ann'] = round(annualized * 100, 2)
        
        results.append(metrics)
        if len(results) % 1000 == 0:
            print(f"   Calculated {len(results)} schemes...")
    
    perf_df = pd.DataFrame(results)
    return perf_df

def main():
    print("Loading Parquet files...")
    all_files = glob.glob("nav_history/year=*/data.parquet")
    if not all_files:
        print("No Parquet files found.")
        return

    dfs = []
    for f in all_files:
        print(f"Reading {f}...")
        dfs.append(pd.read_parquet(f))
    
    full_df = pd.concat(dfs, ignore_index=True)
    full_df['Date_dt'] = pd.to_datetime(full_df['Date'], format='%d-%b-%Y', errors='coerce')
    full_df = full_df.dropna(subset=['Date_dt', 'Net Asset Value', 'Scheme Code'])
    
    # 1. Upsert Mutual Funds static data
    print("Upserting Mutual Funds static data...")
    funds_df = full_df[['Scheme Code', 'Scheme Name', 'ISIN Div Payout/ISIN Growth', 'Category', 'Date_dt']].sort_values('Date_dt', ascending=False)
    funds_df = funds_df.drop_duplicates(subset=['Scheme Code'])
    fund_records = []
    for _, row in funds_df.iterrows():
        fund_records.append({
            'scheme_code': int(row['Scheme Code']),
            'scheme_name': str(row['Scheme Name']),
            'isin': str(row['ISIN Div Payout/ISIN Growth']),
            'category': str(row['Category'])
        })
    
    for i in range(0, len(fund_records), 1000):
        supabase.table("mutual_funds").upsert(fund_records[i : i + 1000]).execute()

    # 2. Calculate and Upsert Performance
    print("Calculating performance metrics...")
    periods = {
        '1d': 1, '1w': 7, '1m': 30, '3m': 90, '6m': 180, 
        '1y': 365, '2y': 730, '3y': 1095, '5y': 1825, '10y': 3650
    }
    perf_df = calculate_performance_and_rankings(full_df, periods)
    
    # Join category for ranking
    perf_df = perf_df.merge(funds_df[['Scheme Code', 'Category']], left_on='scheme_code', right_on='Scheme Code', how='left')
    
    # Calculate Ranks and Averages for standard timed periods
    ranking_periods = list(periods.keys())
    for label in ranking_periods:
        for suffix in ['_abs', '_ann']:
            col = f'return_{label}{suffix}'
            if col in perf_df.columns:
                # Drop NaN for rank/avg calculation to avoid issues
                mask = perf_df[col].notnull()
                if mask.any():
                    cat_avg = perf_df[mask].groupby('Category')[col].transform('mean')
                    perf_df.loc[mask, f'cat_avg_{label}{suffix}'] = round(cat_avg, 2)
                    
                    ranks = perf_df[mask].groupby('Category')[col].rank(ascending=False, method='min')
                    counts = perf_df[mask].groupby('Category')[col].transform('count')
                    perf_df.loc[mask, f'rank_{label}{suffix}'] = ranks.fillna(0).astype(int).astype(str) + "/" + counts.fillna(0).astype(int).astype(str)

    print("Uploading performance to Supabase...")
    # Map columns to DB schema
    perf_records = perf_df.to_dict('records')
    
    # Dynamically build DB columns based on what we calculated
    db_cols = ['scheme_code', 'latest_nav', 'nav_date', 'return_inception_abs', 'return_inception_ann']
    for label in ranking_periods:
        for suffix in ['_abs', '_ann']:
            db_cols.append(f'return_{label}{suffix}')
            db_cols.append(f'cat_avg_{label}{suffix}')
            db_cols.append(f'rank_{label}{suffix}')
    
    final_records = []
    for r in perf_records:
        clean_r = {k: r[k] for k in db_cols if k in r and pd.notnull(r[k])}
        if clean_r:
            final_records.append(clean_r)

    for i in range(0, len(final_records), 500):
        supabase.table("fund_performance").upsert(final_records[i:i+500]).execute()

    # 3. Upload historical NAVs (Batch)
    import sys
    backfill = "--backfill" in sys.argv
    
    print("Preparing historical NAVs for upload...")
    nav_data = full_df[['Scheme Code', 'Date_dt', 'Net Asset Value']].copy()
    nav_data.columns = ['scheme_code', 'nav_date', 'nav_value']
    
    # Filter historical NAVs based on mode
    start_arg = None
    end_arg = None
    for idx, arg in enumerate(sys.argv):
        if arg == "--start" and idx + 1 < len(sys.argv):
            start_arg = sys.argv[idx + 1]
        if arg == "--end" and idx + 1 < len(sys.argv):
            end_arg = sys.argv[idx + 1]

    if not backfill:
        latest_date = full_df['Date_dt'].max()
        cutoff_date = latest_date - timedelta(days=7)
        print(f"Daily mode: Only uploading NAVs after {cutoff_date.strftime('%Y-%m-%d')} (last 7 days)")
        nav_data = nav_data[nav_data['nav_date'] > cutoff_date]
    else:
        if start_arg or end_arg:
            print(f"Backfill mode with explicit filters: start={start_arg}, end={end_arg}")
            if start_arg:
                nav_data = nav_data[nav_data['nav_date'] >= pd.to_datetime(start_arg)]
            if end_arg:
                nav_data = nav_data[nav_data['nav_date'] <= pd.to_datetime(end_arg)]
        else:
            print("Backfill mode: Querying max date in database...")
            res = supabase.table("nav_history").select("nav_date").order("nav_date", desc=True).limit(1).execute()
            if res.data:
                max_db_date = pd.to_datetime(res.data[0]['nav_date'])
                print(f"Max date in database: {max_db_date.strftime('%Y-%m-%d')}")
                nav_data = nav_data[nav_data['nav_date'] > max_db_date]
            else:
                print("No data in database. Uploading all history.")
            
    if not nav_data.empty:
        nav_data['nav_date'] = nav_data['nav_date'].dt.strftime('%Y-%m-%d')
        nav_data['scheme_code'] = nav_data['scheme_code'].astype(int)
        nav_data['nav_value'] = nav_data['nav_value'].astype(float)
        
        nav_list = nav_data.to_dict('records')
        print(f"Uploading {len(nav_list)} historical NAV rows to Supabase...")
        for i in range(0, len(nav_list), 1000):
            try:
                supabase.table("nav_history").upsert(nav_list[i : i + 1000]).execute()
                if i % 10000 == 0 or i == len(nav_list) - 1 or (i > 0 and len(nav_list) - i < 1000):
                    print(f"Uploaded {min(i + 1000, len(nav_list))} / {len(nav_list)} rows...")
            except Exception as e:
                print(f"Batch at {i} failed: {e}. Retrying with smaller batch...")
                # Fallback to even smaller batch if needed
                for j in range(i, min(i + 1000, len(nav_list)), 200):
                    supabase.table("nav_history").upsert(nav_list[j : j + 200]).execute()
    else:
        print("No new historical NAV rows to upload.")

if __name__ == "__main__":
    main()
