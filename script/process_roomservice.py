import pandas as pd
import numpy as np
import sys

def process_roomservice(import_file):
    expected_columns = [
        'Bill Number', 'Pax', 'Food R.SERV', 'Beverage R.SERV', 'Other R.SERV',
        'Disc Food R.SERV', 'Service', 'Tax', 'Total', 'Deposit', 'Currency',
        'Cash', 'Voucher', 'Transfer', 'Card/ City Ledger', 'Information',
        'Guest Name'
    ]

    try:
            roomservice_df = pd.read_csv(import_file, delimiter=',', skiprows=6)
    except Exception as e:
        raise ValueError(f"Error reading file: {e}")

    if list(roomservice_df.columns) != expected_columns:
        raise ValueError(
            "The file does not match the expected format. "
            f"Expected columns: {expected_columns}, but got: {list(roomservice_df.columns)}"
        )

    if len(roomservice_df.columns) != len(expected_columns):
        raise ValueError(
            "The file does not have the correct number of columns. "
            f"Expected {len(expected_columns)}, but got {len(roomservice_df.columns)}"
        )

    roomservice_df = roomservice_df[roomservice_df['Bill Number'].apply(lambda x: x.isnumeric())]

    roomservice_df['Total'] = roomservice_df['Total'].str.replace(',', '').astype(float)

    roomservice_df.reset_index(drop=True, inplace=True)

    json_data = roomservice_df.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_roomservice(import_file))
