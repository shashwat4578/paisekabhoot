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
    print("Extracting current NAVs and basic returns...")
    latest_date = full_df['Date_dt'].max()
    latest_navs = full_df[full_df['Date_dt'] == latest_date].copy()
    
    results = []
    full_df = full_df.sort_values(['Scheme Code', 'Date_dt'])
    
    for _, row in latest_navs.iterrows():
        scheme_code = int(row['Scheme Code'])
        current_nav = float(row['Net Asset Value'])
        scheme_name = row['Scheme Name']
        category = row['Category'] if 'Category' in row else "Unknown"
        
        scheme_df = full_df[full_df['Scheme Code'] == scheme_code]
        
        metrics = {
            'scheme_code': scheme_code,
            'latest_nav': current_nav,
            'nav_date': latest_date.strftime('%Y-%m-%d')
        }
        
        for label, days in periods.items():
            target_date = latest_date - timedelta(days=days)
            historical_data = scheme_df[scheme_df['Date_dt'] <= target_date]
            
            if not historical_data.empty:
                old_row = historical_data.iloc[-1]
                old_nav = float(old_row['Net Asset Value'])
                old_date = old_row['Date_dt']
                
                if old_nav > 0:
                    years = (latest_date - old_date).days / 365.25
                    total_return = (current_nav / old_nav) - 1
                    
                    if years >= 1.0:
                        annualized = (1 + total_return) ** (1 / years) - 1
                        metrics[f'return_{label}'] = round(annualized * 100, 2)
                    else:
                        metrics[f'return_{label}'] = round(total_return * 100, 2)
        
        results.append(metrics)
    
    perf_df = pd.DataFrame(results)
    
    # Category mappings (for averages and ranks)
    # We need to join category back to perf_df if we didn't include it in metrics
    # Let's add it to metrics above for simplicity
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
    periods = {'1d': 1, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, '3y': 1095, '5y': 1825}
    perf_df = calculate_performance_and_rankings(full_df, periods)
    
    # Join category for ranking
    perf_df = perf_df.merge(funds_df[['Scheme Code', 'Category']], left_on='scheme_code', right_on='Scheme Code', how='left')
    
    # Calculate Ranks and Averages for 1W and longer (to match schema)
    ranking_periods = ['1w', '1m', '3m', '6m', '1y', '3y', '5y']
    for label in ranking_periods:
        col = f'return_{label}'
        if col in perf_df.columns:
            cat_avg = perf_df.groupby('Category')[col].transform('mean')
            perf_df[f'cat_avg_{label}'] = round(cat_avg, 2)
            
            ranks = perf_df.groupby('Category')[col].rank(ascending=False, method='min')
            counts = perf_df.groupby('Category')[col].transform('count')
            perf_df[f'rank_{label}'] = ranks.fillna(0).astype(int).astype(str) + "/" + counts.fillna(0).astype(int).astype(str)

    print("Uploading performance to Supabase...")
    # Map columns to DB schema
    perf_records = perf_df.to_dict('records')
    # Filter for DB columns (remove Category, Scheme Code with capital S, etc.)
    db_cols = ['scheme_code', 'latest_nav', 'nav_date'] + [f'return_{l}' for l in periods.keys()] + [f'cat_avg_{l}' for l in periods.keys() if f'cat_avg_{l}' in perf_df.columns] + [f'rank_{l}' for l in periods.keys() if f'rank_{l}' in perf_df.columns]
    
    final_records = []
    for r in perf_records:
        clean_r = {k: r[k] for k in db_cols if k in r and pd.notnull(r[k])}
        final_records.append(clean_r)

    for i in range(0, len(final_records), 500):
        supabase.table("fund_performance").upsert(final_records[i:i+500]).execute()

    # 3. Upload historical NAVs (Batch)
    print("Uploading historical NAVs to Supabase (this may take time)...")
    nav_data = full_df[['Scheme Code', 'Date_dt', 'Net Asset Value']].copy()
    nav_data.columns = ['scheme_code', 'nav_date', 'nav_value']
    nav_data['nav_date'] = nav_data['nav_date'].dt.strftime('%Y-%m-%d')
    nav_data['scheme_code'] = nav_data['scheme_code'].astype(int)
    nav_data['nav_value'] = nav_data['nav_value'].astype(float)
    
    nav_list = nav_data.to_dict('records')
    for i in range(0, len(nav_list), 1000):
        try:
            supabase.table("nav_history").upsert(nav_list[i : i + 1000]).execute()
            if i % 10000 == 0:
                print(f"Uploaded {i} historical NAV rows...")
        except Exception as e:
            print(f"Batch at {i} failed: {e}. Retrying with smaller batch...")
            # Fallback to even smaller batch if needed
            for j in range(i, min(i + 1000, len(nav_list)), 200):
                supabase.table("nav_history").upsert(nav_list[j : j + 200]).execute()

if __name__ == "__main__":
    main()
