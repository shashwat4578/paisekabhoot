from dbfread import DBF
import pandas as pd

table = DBF(r'0380333662024054B_4BHN8QPR7QFIGCDD03R631551014646BMB210155136R1\25042026151308_210155136R1.dbf', load=False)
records = []
for idx, r in enumerate(table):
    records.append(r)
    if idx >= 4:
        break

df = pd.DataFrame(records)
print('--- DATA TYPES ---')
print(df.dtypes)
print('\n--- DATA SAMPLE ---')
print(df.to_string())
