import pandas as pd
import numpy as np
import sys
import re

def process_request(import_file):
    request_df = pd.read_csv(import_file, skiprows=1)

    month_mapping_numeric = {
        'Jan': '1', 'Feb': '2', 'Mar': '3', 'Apr': '4', 'Mei': '5',
        'Jun': '6', 'Jul': '7', 'Agu': '8', 'Sep': '9', 'Okt': '10',
        'Nov': '11', 'Des': '12', 'Januari': '1', 'Februari': '2',
        'Maret': '3', 'April': '4', 'Juni': '6', 'Juli': '7',
        'Agustus': '8', 'September': '9', 'Oktober': '10',
        'November': '11', 'Desember': '12'
    }

    def replace_with_numeric_month(date_str):
        if isinstance(date_str, str):
            date_str = date_str.strip()
            for indo_month, num_month in month_mapping_numeric.items():
                date_str = re.sub(rf'\b{indo_month}\b', num_month, date_str, flags=re.IGNORECASE)
            return date_str
        return date_str

    request_df_cleaned = request_df.dropna(subset=['RESERVATION NAME'])
    request_df_cleaned['ARRIVAL DATE'] = request_df_cleaned['ARRIVAL DATE'].replace('nan', pd.NA)
    request_df_cleaned['DEPARTURE DATE'] = request_df_cleaned['DEPARTURE DATE'].replace('nan', pd.NA)
    request_df_cleaned['DATE'] = request_df_cleaned['DATE'].replace('nan', pd.NA)
    request_df_cleaned = request_df_cleaned.dropna(subset=['ARRIVAL DATE', 'DEPARTURE DATE', 'DATE'])

    request_df_cleaned['ARRIVAL DATE'] = request_df_cleaned['ARRIVAL DATE'].apply(replace_with_numeric_month)
    request_df_cleaned['DEPARTURE DATE'] = request_df_cleaned['DEPARTURE DATE'].apply(replace_with_numeric_month)
    request_df_cleaned['DATE'] = request_df_cleaned['DATE'].apply(replace_with_numeric_month)

    request_df_cleaned['ARRIVAL DATE'] = pd.to_datetime(request_df_cleaned['ARRIVAL DATE'], format='%d-%m-%y', errors='coerce')
    request_df_cleaned['DEPARTURE DATE'] = pd.to_datetime(request_df_cleaned['DEPARTURE DATE'], format='%d-%m-%y', errors='coerce')
    request_df_cleaned['DATE'] = pd.to_datetime(request_df_cleaned['DATE'], format='%d-%m-%y', errors='coerce')

    request_df_cleaned['ARRIVAL DATE'] = request_df_cleaned['ARRIVAL DATE'].dt.strftime('%d/%m/%Y')
    request_df_cleaned['DEPARTURE DATE'] = request_df_cleaned['DEPARTURE DATE'].dt.strftime('%d/%m/%Y')
    request_df_cleaned['DATE'] = request_df_cleaned['DATE'].dt.strftime('%d/%m/%Y')

    request_df_cleaned.rename(columns={'ARRIVAL DATE': 'Arrival', 'DEPARTURE DATE': 'Depart', 'ROOM NUMBER': 'Room_Number'}, inplace=True)

    request_df_cleaned.reset_index(drop=True, inplace=True)

    json_data = request_df_cleaned.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_request(import_file))
