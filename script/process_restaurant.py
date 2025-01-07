import pandas as pd
import numpy as np
import sys

def process_restaurant(import_file):
    expected_columns = [
        'Bill Number', 'Pax', 'Food RESTAURANT', 'Beverage RESTAURANT',
        'Other RESTAURANT', 'Disc Food RESTAURANT', 'Service', 'Tax', 'Total',
        'Deposit', 'Currency', 'Cash', 'Voucher', 'Transfer',
        'Card/ City Ledger', 'Information', 'Guest Name'
    ]

    try:
        restaurant_df = pd.read_csv(import_file, delimiter=',', skiprows=6)
    except Exception as e:
        raise ValueError(f"Error reading file: {e}")

    if list(restaurant_df.columns) != expected_columns:
        raise ValueError(
            "The file does not match the expected format. "
            f"Expected columns: {expected_columns}, but got: {list(restaurant_df.columns)}"
        )

    if len(restaurant_df.columns) != len(expected_columns):
        raise ValueError(
            "The file does not have the correct number of columns. "
            f"Expected {len(expected_columns)}, but got {len(restaurant_df.columns)}"
        )

    restaurant_df = restaurant_df[restaurant_df['Bill Number'].apply(lambda x: x.isnumeric())]

    restaurant_df['Total'] = restaurant_df['Total'].str.replace(',', '').astype(float)

    restaurant_df.reset_index(drop=True, inplace=True)

    json_data = restaurant_df.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_restaurant(import_file))
