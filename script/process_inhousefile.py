import sys
import csv
import pandas as pd

column_names = [
    'Number', 'In House Date', 'Room Number', 'Room Type',
    'Arrangement', 'Guest No', 'First Name', 'Last Name',
    'Birth Date', 'Age', 'Member No', 'Member Type',
    'Email', 'Mobile Phone', 'VIP', 'Room Rate',
    'Lodging', 'Breakfast', 'Lunch', 'Dinner',
    'Other', 'Bill Number', 'Pay Article', 'Rate Code',
    'Res No', 'Adult', 'Child', 'Compliment',
    'Nat', 'Local Region', 'Company / TA', 'SOB',
    'Arrival', 'Depart', 'Night', 'C/I Time',
    'C/O Time', 'Segment', 'Created', 'By',
    'K-Card', 'remarks'
]

def clean_csv(input_path, expected_columns):
    cleaned_data = []
    with open(input_path, 'r') as infile:
        reader = csv.reader(infile, delimiter=';')
        for row in reader:
            if len(row) == expected_columns:
                cleaned_data.append(row)
            else:
                pass
    return pd.DataFrame(cleaned_data[1:], columns=column_names)

def process_file(sample_file, input_file):
    with open(sample_file, 'r') as sample:
        sample_lines = sample.readlines()

    expected_columns = len(sample_lines[0].split(';'))

    dfs = []
    try:
        df = clean_csv(input_file, expected_columns)
        delete_columns = ['VIP', 'Lunch', 'Dinner', 'Other', 'Rate Code', 'K-Card', 'remarks', 'Member No', 'Member Type', 'Guest No']
        df.drop(columns=delete_columns, inplace=True)
        df['Name'] = df['Last Name']
        df.drop(columns=['First Name', 'Last Name'], inplace=True)
        df['In House Date'] = pd.to_datetime(df['In House Date'], format='%d/%m/%Y').dt.strftime('%d %B %Y')
        df.rename(columns={
            'In House Date': 'In_House_Date',
            'Room Number': 'Room_Number',
            'Room Type': 'Room_Type',
            'Guest No': 'Guest_No',
            'Birth Date': 'Birth_Date',
            'Member No': 'Member_No',
            'Member Type': 'Member_Type',
            'Mobile Phone': 'Mobile_Phone',
            'Bill Number': 'Bill_Number',
            'Pay Article': 'Pay_Article',
            'Rate Code': 'Rate_Code',
            'Res No': 'Res_No',
            'Local Region': 'LocalRegion',
            'C/I Time': 'CI_Time',
            'C/O Time': 'CO_Time',
            'Company / TA':'Company_TA'
        }, inplace=True)

        df['LocalRegion'] = df['LocalRegion'].apply(lambda x: x[:3] if isinstance(x, str) else x)

        df['Age'] = pd.to_numeric(df['Age'], errors='coerce')
        mean_age = df['Age'].mean()
        df['Age'].fillna(mean_age, inplace=True)
        df['Age'] = df['Age'].astype(int)

        df['Adult'] = df['Adult'].astype(int)
        df['Child'] = df['Child'].astype(int)
        df['visitor_number'] = df['Adult'] + df['Child']
        df['visitor_category'] = df['visitor_number'].apply(lambda x: 'family/group' if x > 1 else 'individual')

        dfs.append(df)
    except pd.errors.EmptyDataError:
        print(f"No data in file: {input_file}")
    except pd.errors.ParserError as e:
        print(f"Parsing error in file {input_file}: {e}")

    Dataset = pd.concat(dfs, ignore_index=True)
    return Dataset.to_json(orient='records')

if __name__ == "__main__":
    sample_file_path = sys.argv[1]
    input_file_path = sys.argv[2]
    result = process_file(sample_file_path, input_file_path)
    print(result)
