import sys
import pyarrow as pa
import pyarrow.parquet as pq
from dbfread import DBF
import pandas as pd
import time

def convert_dbf_to_parquet(dbf_path, parquet_path, chunk_size=100000):
    print(f"Starting conversion of {dbf_path}")
    print(f"Output will be saved to {parquet_path}")
    print(f"Using chunk size: {chunk_size} rows")
    
    start_time = time.time()
    
    try:
        # Open DBF in iterator mode so we don't load it all into memory
        table = DBF(dbf_path, load=False)
        
        records = []
        writer = None
        total_rows = 0
        chunk_count = 0
        
        for record in table:
            records.append(record)
            
            if len(records) >= chunk_size:
                df = pd.DataFrame(records)
                
                if writer is None:
                    table_chunk = pa.Table.from_pandas(df)
                    schema = table_chunk.schema
                    writer = pq.ParquetWriter(parquet_path, schema, compression='snappy')
                else:
                    table_chunk = pa.Table.from_pandas(df, schema=schema)
                
                writer.write_table(table_chunk)
                
                total_rows += len(records)
                chunk_count += 1
                print(f"Processed chunk {chunk_count}: {total_rows} rows so far... ({time.time() - start_time:.1f}s)")
                
                # Clear records
                records = []
        
        # Write any remaining records
        if records:
            df = pd.DataFrame(records)
            
            if writer is None:
                table_chunk = pa.Table.from_pandas(df)
                schema = table_chunk.schema
                writer = pq.ParquetWriter(parquet_path, schema, compression='snappy')
            else:
                table_chunk = pa.Table.from_pandas(df, schema=schema)
                
            writer.write_table(table_chunk)
            total_rows += len(records)
            chunk_count += 1
            print(f"Processed final chunk {chunk_count}: {total_rows} total rows. ({time.time() - start_time:.1f}s)")
            
    except Exception as e:
        print(f"Error during conversion: {e}")
        raise
    finally:
        if writer is not None:
            writer.close()
            
    end_time = time.time()
    print(f"Conversion completed successfully in {end_time - start_time:.2f} seconds!")
    print(f"Total rows processed: {total_rows}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_dbf.py <input.dbf> <output.parquet>")
        sys.exit(1)
        
    dbf_file = sys.argv[1]
    parquet_file = sys.argv[2]
    
    convert_dbf_to_parquet(dbf_file, parquet_file)
