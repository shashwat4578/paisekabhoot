import os
from supabase import create_client, Client
from dotenv import load_dotenv
import glob

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def upload_parquet_files():
    print("Uploading Parquet files to Supabase Storage...")
    
    # Ensure bucket exists
    try:
        supabase.storage.create_bucket("nav-history", options={"public": True})
        print("Created bucket 'nav-history'")
    except Exception:
        print("Bucket 'nav-history' already exists or could not be created.")

    all_files = glob.glob("nav_history/year=*/data.parquet")
    for f in all_files:
        # Get relative path for storage
        rel_path = f.replace("\\", "/")
        print(f"Uploading {rel_path}...")
        
        with open(f, 'rb') as file_data:
            try:
                supabase.storage.from_("nav-history").upload(
                    path=rel_path,
                    file=file_data,
                    file_options={"cache-control": "3600", "upsert": "true"}
                )
                print(f"Uploaded {rel_path} successfully.")
            except Exception as e:
                print(f"Failed to upload {rel_path}: {e}")

if __name__ == "__main__":
    upload_parquet_files()
