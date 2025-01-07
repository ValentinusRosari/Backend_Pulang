import pandas as pd
import numpy as np
import sys

def process_banquet(import_file):
    expected_columns = [
        'Bill Number', 'Pax', 'Food BANQUET', 'Beverage BANQUET',
        'Other BANQUET', 'Disc Food BANQUET', 'Service', 'Tax', 'Total',
        'Deposit', 'Currency', 'Cash', 'Voucher', 'Transfer',
        'Card/ City Ledger', 'Information', 'Guest Name'
    ]

    try:
        banquet_df = pd.read_csv(import_file, delimiter=',', skiprows=6)
    except Exception as e:
        raise ValueError(f"Error reading file: {e}")

    if list(banquet_df.columns) != expected_columns:
        raise ValueError(
            "The file does not match the expected format. "
            f"Expected columns: {expected_columns}, but got: {list(banquet_df.columns)}"
        )

    if len(banquet_df.columns) != len(expected_columns):
        raise ValueError(
            "The file does not have the correct number of columns. "
            f"Expected {len(expected_columns)}, but got {len(banquet_df.columns)}"
        )

    banquet_df = banquet_df[banquet_df['Bill Number'].apply(lambda x: str(x).isnumeric())]

    banquet_df['Total'] = banquet_df['Total'].str.replace(',', '').astype(float)

    banquet_df.reset_index(drop=True, inplace=True)

    json_data = banquet_df.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_banquet(import_file))
