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
    for line in lines:
        if ';' not in line:
            continue
        parts = line.split(';')
        if len(parts) >= 4:
            code = parts[0].strip()
            isin = parts[1].strip() or parts[2].strip()
            name = parts[3].strip()
            if code.isdigit() and isin:
                mapping[isin] = {"code": int(code), "name": name}
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
    mapping = fetch_amfi_mapping()

    print("\n📂 Loading Parquet file (150MB, ~24M rows)...")
    df = pd.read_parquet('portfolio_data.parquet')

    # Clean up
    df['NAV_DATE'] = pd.to_datetime(df['NAV_DATE'])
    df = df[df['NAV_VALUE'] > 0]  # Drop zero-NAV rows
    df = df.dropna(subset=['ISIN_NO'])

    print(f"   Rows after cleanup: {len(df):,}")
    print(f"   Unique ISINs: {df['ISIN_NO'].nunique():,}")
    print(f"   Date range: {df['NAV_DATE'].min().date()} → {df['NAV_DATE'].max().date()}")

    # Group by ISIN for efficient per-fund processing
    grouped = df.groupby('ISIN_NO')
    total_isins = len(grouped)

    funds_batch = []
    metrics_batch = []
    skipped = 0
    processed = 0

    print(f"\n⚙️  Processing {total_isins:,} ISINs...\n")

    for idx, (isin, fund_df) in enumerate(grouped):
        # Only process funds that exist in the current AMFI universe
        if isin not in mapping:
            skipped += 1
            continue

        info = mapping[isin]
        scheme_code = info["code"]

        # Sort by date descending for easy latest/historical lookup
        fund_df = fund_df.sort_values('NAV_DATE', ascending=False)

        latest_row = fund_df.iloc[0]
        latest_nav = float(latest_row['NAV_VALUE'])
        latest_date = latest_row['NAV_DATE']

        # Find NAV N years ago (closest available date on or before target)
        def get_nav_ago(years):
            target = latest_date - pd.DateOffset(years=years)
            past = fund_df[fund_df['NAV_DATE'] <= target]
            if past.empty:
                return None
            return float(past.iloc[0]['NAV_VALUE'])

        nav_1y = get_nav_ago(1)
        nav_3y = get_nav_ago(3)
        nav_5y = get_nav_ago(5)

        # 1Y = simple return, 3Y/5Y = CAGR
        ret_1y = round(((latest_nav / nav_1y) - 1) * 100, 2) if nav_1y else None
        ret_3y = calculate_cagr(nav_3y, latest_nav, 3)
        ret_5y = calculate_cagr(nav_5y, latest_nav, 5)

        funds_batch.append({
            "scheme_code": scheme_code,
            "isin": isin,
            "scheme_name": info["name"],
            "category": str(latest_row['SCHEME_TYP']) if pd.notna(latest_row['SCHEME_TYP']) else None
        })

        metrics_batch.append({
            "scheme_code": scheme_code,
            "latest_nav": latest_nav,
            "nav_date": latest_date.strftime('%Y-%m-%d'),
            "return_1y": ret_1y,
            "return_3y": ret_3y,
            "return_5y": ret_5y,
            "updated_at": datetime.now().isoformat()
        })

        processed += 1

        # Upload in batches of 500 to avoid API limits
        if len(metrics_batch) >= 500:
            print(f"   📤 Uploading batch... ({processed:,} / {total_isins:,} processed)")
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
