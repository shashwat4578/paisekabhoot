import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def update_schema():
    print("Updating fund_performance table schema...")
    
    # We can't run raw SQL easily via the standard python client unless we have a specific RPC
    # or the user has enabled the SQL editor.
    # However, I can try to use a simple RPC if available, or just inform the user.
    # Alternatively, I can just try to insert data and see if it works (it won't if columns missing).
    
    # Since I don't have a reliable way to run 'ALTER TABLE' via the client without an RPC,
    # I will assume the user can run this in their Supabase SQL Editor if I provide it.
    # BUT, I can try to use the 'postgres' role if I had the connection string.
    
    # Wait, I'll check if there's a way to run SQL.
    # Most Supabase setups have a 'rest' API.
    
    sql = """
    ALTER TABLE public.fund_performance 
    ADD COLUMN IF NOT EXISTS return_1d NUMERIC,
    ADD COLUMN IF NOT EXISTS return_1w NUMERIC,
    ADD COLUMN IF NOT EXISTS return_1m NUMERIC,
    ADD COLUMN IF NOT EXISTS return_3m NUMERIC,
    ADD COLUMN IF NOT EXISTS return_6m NUMERIC,
    ADD COLUMN IF NOT EXISTS return_10y NUMERIC,
    ADD COLUMN IF NOT EXISTS return_inception NUMERIC;
    """
    print("Please run the following SQL in your Supabase SQL Editor:")
    print(sql)

if __name__ == "__main__":
    update_schema()
