import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase = create_client(url, key)

def populate_exit_loads():
    print("Populating default exit loads based on categories...")
    
    # 1. Fetch all funds with categories (Paginating to bypass Supabase 1k limit)
    all_funds = []
    offset = 0
    while True:
        response = supabase.table("mutual_funds").select("scheme_code, scheme_name, isin, category").range(offset, offset + 1000).execute()
        batch_funds = response.data
        if not batch_funds:
            break
        all_funds.extend(batch_funds)
        offset += 1000
    
    funds = all_funds
    
    if not funds:
        print("No funds found in database.")
        return

    updates = []
    for fund in funds:
        cat = (fund.get("category") or "").lower()
        name = fund.get("scheme_name") or ""
        code = fund["scheme_code"]
        isin = fund["isin"]
        
        load = None
        if "liquid" in cat or "overnight" in cat:
            load = "0%"
        elif "elss" in cat:
            load = "0% (3Y Lock-in)"
        elif "banking" in cat and "psu" in cat:
            load = "0.25% - 1% (Varies)"
        elif "equity" in cat or "growth" in cat or "cap" in cat or "index" in cat:
            load = "1% if < 1 Year"
        elif "debt" in cat:
            load = "0.25% - 1% (Varies)"
        else:
            # Fallback for anything that looks like a normal equity fund
            if "fund" in cat.lower() or "fund" in name.lower():
                load = "1% if < 365 Days"
        
        if load:
            updates.append({
                "scheme_code": code, 
                "scheme_name": name,
                "isin": isin,
                "category": fund["category"],
                "exit_load": load
            })

    print(f"Found {len(updates)} funds to update.")

    # 2. Update in batches
    batch_size = 1000
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i+batch_size]
        try:
            supabase.table("mutual_funds").upsert(batch).execute()
            print(f"   Updated batch {i//batch_size + 1}")
        except Exception as e:
            print(f"   Error updating batch: {e}")

    print("Exit load population complete!")

if __name__ == "__main__":
    populate_exit_loads()
