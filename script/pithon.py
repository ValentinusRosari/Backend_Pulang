import json
import pandas as pd
import sys

def process(file_path):
    try:
        dataset1 = pd.read_csv(file_path, skiprows=5, on_bad_lines='skip')

        summary_indices = dataset1[dataset1.apply(lambda row: row.astype(str).str.contains('Summary;', case=False, na=False).any(), axis=1)].index
        rows_to_remove = set()

        for i in range(len(summary_indices)):
            start_idx = summary_indices[i]
            end_idx = summary_indices[i+1] if i+1 < len(summary_indices) else len(dataset1)
            rows_to_remove.update(range(start_idx, end_idx))

        dataset = dataset1.drop(rows_to_remove)

        dataset.columns = [
        'Number', 'In House Date', 'Room Number', 'Room Type', 'Arrangement', 'Guest No', 'First Name', 'Last Name',
        'Birth Date', 'Age', 'Member No', 'Member Type', 'Email', 'Mobile  Phone', 'VIP', 'Room Rate', 'Lodging',
        'Breakfast', 'Lunch', 'Dinner', 'Other', 'Bill Number', 'Pay Article', 'Rate Code', 'Res No', 'Adult',
        'Child', 'Compliment', 'Nat', 'Local Region', 'Company / TA', 'SOB', 'Arrival', 'Depart', 'Night', 'C/I Time',
        'C/O Time', 'Segment', 'Created', 'By', 'K-Card', 'remarks'
        ]

        delete_columns = ['Number', 'Birth Date', 'Member No', 'Member Type', 'Email', 'Mobile  Phone', 'VIP', 'Lunch', 
                          'Dinner', 'Other', 'K-Card', 'Rate Code', 'Compliment']
        dataset.drop(columns=delete_columns, inplace=True)

        dataset['First Name'] = dataset['First Name'].replace(['', 'NULL', 'NaN', 'nan', None], pd.NA)
        dataset['Last Name'] = dataset['Last Name'].replace(['', 'NULL', 'NaN', 'nan', None], pd.NA)

        dataset['First Name'] = dataset['First Name'].fillna('')
        dataset['Last Name'] = dataset['Last Name'].fillna('')

        dataset['Name'] = (dataset['First Name'] + ' ' + dataset['Last Name']).str.strip().str.upper()

        def remove_titles(name):
            titles = ['MR', 'MRS', 'MS', 'MISS', 'DR', 'PROF', 'SIR', 'MADAM', 'BPK']
            name_parts = [part for part in name.split() if part.upper().strip(',') not in titles]
            return ' '.join(name_parts)

        def reformat_name(name):
            name = remove_titles(name)
            if ',' in name:
                parts = [part.strip() for part in name.split(',')]
            return name.strip()

        dataset['Name'] = dataset['Name'].apply(reformat_name)

        dataset.drop(columns=['First Name', 'Last Name'], inplace=True)

        dataset['In House Date'] = pd.to_datetime(dataset['In House Date'], format='%d/%m/%Y').dt.strftime('%d %B %Y')
        dataset['Arrival'] = pd.to_datetime(dataset['Arrival'], format='%d/%m/%Y').dt.strftime('%d %B %Y')
        dataset['Depart'] = pd.to_datetime(dataset['Depart'], format='%d/%m/%Y').dt.strftime('%d %B %Y')
        dataset['Created'] = pd.to_datetime(dataset['Created'], format='%d/%m/%Y').dt.strftime('%d %B %Y')

        dataset.rename(columns={
            'In House Date': 'In_House_Date',
            'Room Number': 'Room_Number',
            'Room Type': 'Room_Type',
            'Guest No': 'Guest_No',
            'Room Rate': 'Room_Rate',
            'Bill Number': 'Bill_Number',
            'Pay Article': 'Pay_Article',
            'Res No': 'Res_No',
            'C/I Time': 'CI_Time',
            'C/O Time': 'CO_Time',
            'Company / TA': 'Company_TA'
        }, inplace=True)

        dataset['Adult'] = dataset['Adult'].astype(int)
        dataset['Child'] = dataset['Child'].astype(int)
        dataset['visitor_number'] = dataset['Adult'] + dataset['Child']
        dataset['visitor_category'] = dataset['visitor_number'].apply(lambda x: 'family/group' if x > 1 else 'individual')

        dataset['Room_Rate'] = dataset['Room_Rate'].str.replace(',', '').astype(float)

        dataset = dataset.groupby(['Name', 'Arrival', 'Depart', 'Room_Number'], as_index=False).agg({
            'In_House_Date': 'first',
            'Room_Type': 'first',
            'Arrangement': 'first',
            'Guest_No': 'first',
            'Age': 'first',
            'Local Region': 'first',
            'Room_Rate': 'mean',
            'Lodging': 'first',
            'Breakfast': 'first',
            'Bill_Number': 'first',
            'Pay_Article': 'first',
            'Res_No': 'first',
            'Adult': 'first',
            'Child': 'first',
            'Nat': 'first',
            'Company_TA': 'first',
            'SOB': 'first',
            'Night': 'first',
            'CI_Time': 'first',
            'CO_Time': 'first',
            'Segment': 'first',
            'Created': 'first',
            'By': 'first',
            'remarks': 'first',
            'visitor_number': 'first',
            'visitor_category': 'first'
        })

        # Overlap detection function
        def find_overlaps(dataset):
            check = dataset.copy()
            check['Arrival'] = pd.to_datetime(check['Arrival'])
            check['Depart'] = pd.to_datetime(check['Depart'])
            check = check.sort_values(by=['Room_Number', 'Arrival'])

            overlap_indices = []
            for room in check['Room_Number'].unique():
                room_data = check[check['Room_Number'] == room]
                for i in range(len(room_data) - 1):
                    current_guest = room_data.iloc[i]
                    next_guest = room_data.iloc[i + 1]
                    if current_guest['Depart'] > next_guest['Arrival']:
                        overlap_indices.append(current_guest.to_dict())
                        overlap_indices.append(next_guest.to_dict())

            overlap_rows = pd.DataFrame(overlap_indices).drop_duplicates()
            return overlap_rows

        # Overlap removal function
        def remove_overlaps(dataset, overlap_rows):
            dataset['Arrival'] = pd.to_datetime(dataset['Arrival'])
            dataset['Depart'] = pd.to_datetime(dataset['Depart'])
            overlap_rows['Arrival'] = pd.to_datetime(overlap_rows['Arrival'])
            overlap_rows['Depart'] = pd.to_datetime(overlap_rows['Depart'])

            merged_df = pd.merge(dataset, overlap_rows, on=['Name', 'Room_Number', 'Arrival', 'Depart'], how='inner')
            overlap_indices = merged_df.index
            dataset = dataset.drop(overlap_indices)
            return dataset

        # Detect and remove overlaps
        overlap_rows = find_overlaps(dataset)
        dataset = remove_overlaps(dataset, overlap_rows)

        # Return the processed dataset as JSON
        return dataset.to_json(orient='records', date_format='iso')

    except Exception as e:
        return json.dumps({"error": str(e)})

if __name__ == "__main__":
    file_path = sys.argv[1]
    result = process(file_path)
    print(result)
