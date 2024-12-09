import pandas as pd
import numpy as np
import sys

def process_restaurant(import_file):
    restaurant_df = pd.read_csv(import_file, delimiter=',', skiprows=6)

    restaurant_df = restaurant_df[restaurant_df['Bill Number'].apply(lambda x: x.isnumeric())]

    restaurant_df['Total'] = restaurant_df['Total'].str.replace(',', '').astype(float)

    restaurant_df.reset_index(drop=True, inplace=True)

    json_data = restaurant_df.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_restaurant(import_file))
