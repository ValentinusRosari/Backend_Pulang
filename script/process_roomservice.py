import pandas as pd
import numpy as np
import sys

def process_roomservice(import_file):
    roomservice_df = pd.read_csv(import_file, delimiter=',', skiprows=6)

    roomservice_df = roomservice_df[roomservice_df['Bill Number'].apply(lambda x: x.isnumeric())]

    roomservice_df['Total'] = roomservice_df['Total'].str.replace(',', '').astype(float)

    roomservice_df.reset_index(drop=True, inplace=True)

    json_data = roomservice_df.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_roomservice(import_file))
