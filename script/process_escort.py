import pandas as pd
import numpy as np
import sys
import re

def process_escort(import_file):
    escort_df = pd.read_csv(import_file)

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

    escort_df_cleaned = escort_df.drop(columns=['WELCOME LETTER'])
    escort_df_cleaned['ARRIVAL'] = escort_df_cleaned['ARRIVAL'].replace('nan', pd.NA)
    escort_df_cleaned['DEPARTURE'] = escort_df_cleaned['DEPARTURE'].replace('nan', pd.NA)
    escort_df_cleaned = escort_df_cleaned.dropna(subset=['RESERVATION NAME', 'ARRIVAL', 'DEPARTURE'])

    escort_df_cleaned['ELDER'] = escort_df_cleaned['ELDER'].fillna(0)
    escort_df_cleaned['CHILD'] = escort_df_cleaned['CHILD'].fillna(0)
    escort_df_cleaned['DISABLED'] = escort_df_cleaned['DISABLED'].fillna(0)
    escort_df_cleaned['PREGNANT'] = escort_df_cleaned['PREGNANT'].fillna(0)

    escort_df_cleaned['ARRIVAL'] = escort_df_cleaned['ARRIVAL'].apply(replace_with_numeric_month)
    escort_df_cleaned['DEPARTURE'] = escort_df_cleaned['DEPARTURE'].apply(replace_with_numeric_month)

    escort_df_cleaned['ARRIVAL'] = pd.to_datetime(escort_df_cleaned['ARRIVAL'], format='%d-%m-%y', errors='coerce')
    escort_df_cleaned['DEPARTURE'] = pd.to_datetime(escort_df_cleaned['DEPARTURE'], format='%d-%m-%y', errors='coerce')

    escort_df_cleaned['ARRIVAL'] = escort_df_cleaned['ARRIVAL'].dt.strftime('%d/%m/%Y')
    escort_df_cleaned['DEPARTURE'] = escort_df_cleaned['DEPARTURE'].dt.strftime('%d/%m/%Y')

    escort_df_cleaned.rename(columns={'ARRIVAL': 'Arrival', 'DEPARTURE': 'Depart', 'ROOM NUMBER': 'Room_Number'}, inplace=True)

    escort_df_cleaned.reset_index(drop=True, inplace=True)

    json_data = escort_df_cleaned.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_escort(import_file))
