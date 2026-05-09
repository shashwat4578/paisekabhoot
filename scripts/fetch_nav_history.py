import requests
import pandas as pd
import io
import os
import time

def fetch_safe_monthly_amfi(year):
    # 1. Monthly blocks are much safer than Quarterly (prevents Timeouts)
    months = [
        ('01-Jan', '31-Jan'), ('01-Feb', '28-Feb'), ('01-Mar', '31-Mar'),
        ('01-Apr', '30-Apr'), ('01-May', '31-May'), ('01-Jun', '30-Jun'),
        ('01-Jul', '31-Jul'), ('01-Aug', '31-Aug'), ('01-Sep', '30-Sep'),
        ('01-Oct', '31-Oct'), ('01-Nov', '30-Nov'), ('01-Dec', '31-Dec')
    ]
    
    all_chunks = []
    
    # Standard headers to look like a real browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    for start, end in months:
        print(f"Fetching {start} to {end} for {year}...")
        url = f"http://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?tp=1&frmdt={start}-{year}&todt={end}-{year}"
        
        try:
            # Added a 60-second timeout and headers
            response = requests.get(url, headers=headers, timeout=60)
            
            # AMFI portal uses ';' as separator
            df = pd.read_csv(io.StringIO(response.text), sep=';', on_bad_lines='skip', low_memory=False)
            all_chunks.append(df)
            
            # CRITICAL: Wait 3 seconds so AMFI doesn't block your IP
            time.sleep(3)
            
        except Exception as e:
            print(f"Failed to fetch {start}-{end}: {e}")
            continue
    
    if all_chunks:
        full_year_df = pd.concat(all_chunks, ignore_index=True)
        output_dir = f"nav_history/year={year}"
        os.makedirs(output_dir, exist_ok=True)
        
        # Save to Parquet using the engine you just installed
        full_year_df.to_parquet(f"{output_dir}/data.parquet", engine='pyarrow', compression='snappy')
        print(f"DONE: Successfully archived {year} to {output_dir}/data.parquet")
    else:
        print("ERROR: No data was retrieved. Check your internet or AMFI portal status.")

# Run for years 2021 to 2025
if __name__ == "__main__":
    for year in [2021, 2022, 2023, 2024, 2025]:
        fetch_safe_monthly_amfi(year)
