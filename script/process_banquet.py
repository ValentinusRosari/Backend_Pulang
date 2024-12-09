import pandas as pd
import numpy as np
import sys

def process_banquet(import_file):
    banquet_df = pd.read_csv(import_file, delimiter=',', skiprows=6)

    banquet_df = banquet_df[banquet_df['Bill Number'].apply(lambda x: x.isnumeric())]

    banquet_df['Total'] = banquet_df['Total'].str.replace(',', '').astype(float)

    banquet_df.reset_index(drop=True, inplace=True)

    json_data = banquet_df.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_banquet(import_file))
