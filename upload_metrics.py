"""
upload_metrics.py — One-time historical data migration script.

Reads the 150MB Parquet file (24M rows, 20K+ ISINs), calculates
1Y / 3Y / 5Y performance for each fund, and uploads the summary
to Supabase (mutual_funds + fund_performance tables).

Usage:
    set SUPABASE_KEY=your-anon-key-here
    python upload_metrics.py
"""

import pandas as pd
import numpy as np
from supabase import create_client
import os
import requests
from datetime import datetime

# ─── Config ───────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://bmyxlojdiohawlwobtrk.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_KEY:
    print("❌ Error: SUPABASE_KEY environment variable not set.")
    print("   Run:  set SUPABASE_KEY=your-anon-key-here")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Step 1: Build ISIN → Scheme Code mapping from AMFI ──────────────────────
def fetch_amfi_mapping():
    """Download the live AMFI NAV file and build an ISIN→SchemeCode lookup."""
    print("📡 Fetching ISIN-to-SchemeCode mapping from AMFI...")
    url = "https://www.amfiindia.com/spages/NAVAll.txt"
    response = requests.get(url, timeout=30)
    lines = response.text.split('\n')
    mapping = {}
    
    # We also track the date in the file
    file_date = datetime.now().date()
    
    for line in lines:
        if ';' not in line:
            continue
        parts = line.split(';')
        if len(parts) >= 6:
            code = parts[0].strip()
            isin1 = parts[1].strip()
            isin2 = parts[2].strip()
            name = parts[3].strip()
            nav = parts[4].strip()
            date_str = parts[5].strip()
            
            try:
                nav_float = float(nav)
            except:
                continue

            if code.isdigit():
                entry = {"code": int(code), "name": name, "nav": nav_float, "date": date_str}
                if isin1:
                    mapping[isin1] = entry
                if isin2:
                    mapping[isin2] = entry
    print(f"   ✅ Loaded {len(mapping)} ISIN→SchemeCode mappings from AMFI.")
    return mapping


# ─── Step 2: CAGR Calculator ─────────────────────────────────────────────────
def calculate_cagr(start_nav, end_nav, years):
    """Compound Annual Growth Rate."""
    if start_nav is None or end_nav is None or start_nav <= 0 or end_nav <= 0:
        return None
    return round((pow(end_nav / start_nav, 1 / years) - 1) * 100, 2)


# ─── Step 3: Process the Parquet and upload ───────────────────────────────────
def process_and_upload():
    amfi_mapping = fetch_amfi_mapping()
    today = datetime.now()

    print("\n📂 Loading Parquet file (150MB, ~24M rows)...")
    df = pd.read_parquet('portfolio_data.parquet')

    # Clean up
    df['NAV_DATE'] = pd.to_datetime(df['NAV_DATE'])
    df = df[df['NAV_VALUE'] > 0]  # Drop zero-NAV rows
    df = df.dropna(subset=['ISIN_NO'])

    print(f"   Rows after cleanup: {len(df):,}")
    print(f"   Unique ISINs: {df['ISIN_NO'].nunique():,}")
    print(f"   Historical range: {df['NAV_DATE'].min().date()} → {df['NAV_DATE'].max().date()}")

    # Step 3.1: Ensure ALL funds from AMFI are in the mutual_funds table first
    print(f"\n📑 Synchronizing {len(amfi_mapping):,} funds to 'mutual_funds' table...")
    all_funds = []
    seen_codes = set()
    for isin, info in amfi_mapping.items():
        if info["code"] not in seen_codes:
            all_funds.append({
                "scheme_code": info["code"],
                "isin": isin,
                "scheme_name": info["name"],
                "category": None # We'll update this if parquet data exists
            })
            seen_codes.add(info["code"])
    
    # Upload in batches
    for i in range(0, len(all_funds), 1000):
        batch = all_funds[i:i+1000]
        supabase.table("mutual_funds").upsert(batch).execute()
    
    print("   ✅ mutual_funds table updated with all current AMFI funds.")

    # Group by ISIN for efficient per-fund processing
    grouped = df.groupby('ISIN_NO')
    total_isins = len(grouped)

    funds_batch = []
    metrics_batch = []
    skipped = 0
    processed = 0
    seen_scheme_codes = set()

    print(f"\n⚙️  Processing {total_isins:,} ISINs with historical data to calculate metrics...\n")

    for isin, fund_df in grouped:
        if isin not in amfi_mapping:
            skipped += 1
            continue

        info = amfi_mapping[isin]
        scheme_code = info["code"]

        if scheme_code in seen_scheme_codes:
            continue
        seen_scheme_codes.add(scheme_code)

        # Start with Live NAV from AMFI
        latest_nav = info["nav"]
        latest_date_str = info["date"]
        
        try:
            # AMFI date format is 'DD-MMM-YYYY' e.g. '05-May-2026'
            base_date = pd.to_datetime(latest_date_str, format='%d-%b-%Y')
        except:
            base_date = today

        # Sort history for lookup
        fund_df = fund_df.sort_values('NAV_DATE', ascending=False)

        # Find NAV N years ago relative to the BASE DATE
        def get_nav_ago(years):
            target = base_date - pd.DateOffset(years=years)
            past = fund_df[fund_df['NAV_DATE'] <= target]
            if past.empty:
                return None, None
            row = past.iloc[0]
            return float(row['NAV_VALUE']), row['NAV_DATE']

        nav_1y, date_1y = get_nav_ago(1)
        nav_3y, date_3y = get_nav_ago(3)
        nav_5y, date_5y = get_nav_ago(5)

        # Precise Calculations
        def calc_perf(start_nav, end_nav, start_date, is_annualized=True):
            if not start_nav or not end_nav or start_nav <= 0:
                return None
            days = (today - start_date).days
            if days <= 0:
                return None
            if is_annualized:
                # CAGR = (End/Start)^(365/Days) - 1
                return round((pow(end_nav / start_nav, 365.0 / days) - 1) * 100, 2)
            else:
                # Absolute Return = (End/Start) - 1
                return round(((end_nav / start_nav) - 1) * 100, 2)

        ret_1y = calc_perf(nav_1y, latest_nav, date_1y, is_annualized=False)
        ret_3y = calc_perf(nav_3y, latest_nav, date_3y, is_annualized=True)
        ret_5y = calc_perf(nav_5y, latest_nav, date_5y, is_annualized=True)

        # Use Parquet for meta details
        parquet_latest = fund_df.iloc[0]
        
        funds_batch.append({
            "scheme_code": scheme_code,
            "isin": isin,
            "scheme_name": info["name"],
            "category": str(parquet_latest['SCHEME_TYP']) if pd.notna(parquet_latest['SCHEME_TYP']) else None
        })

        metrics_batch.append({
            "scheme_code": scheme_code,
            "latest_nav": latest_nav,
            "nav_date": datetime.strptime(latest_date_str, '%d-%b-%Y').strftime('%Y-%m-%d') if '-' in latest_date_str else today.strftime('%Y-%m-%d'),
            "return_1y": ret_1y,
            "return_3y": ret_3y,
            "return_5y": ret_5y,
            "updated_at": datetime.now().isoformat()
        })

        processed += 1

        # Upload in batches of 500
        if len(metrics_batch) >= 500:
            print(f"   📤 Uploading batch... ({processed:,} processed)")
            try:
                supabase.table("mutual_funds").upsert(funds_batch).execute()
                supabase.table("fund_performance").upsert(metrics_batch).execute()
            except Exception as e:
                print(f"   ⚠️  Batch upload error: {e}")
            funds_batch = []
            metrics_batch = []

    # Final batch
    if metrics_batch:
        print(f"   📤 Uploading final batch... ({processed:,} total)")
        try:
            supabase.table("mutual_funds").upsert(funds_batch).execute()
            supabase.table("fund_performance").upsert(metrics_batch).execute()
        except Exception as e:
            print(f"   ⚠️  Final batch error: {e}")

    print(f"\n{'='*60}")
    print(f"✅ DONE!")
    print(f"   Funds uploaded:  {processed:,}")
    print(f"   ISINs skipped (not in AMFI): {skipped:,}")
    print(f"   Tables populated: mutual_funds, fund_performance")
    print(f"{'='*60}")


if __name__ == "__main__":
    process_and_upload()
