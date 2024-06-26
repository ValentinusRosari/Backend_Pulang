import pandas as pd
import sys

def process(file_path):
    dataset = pd.read_csv(file_path, skiprows=5, on_bad_lines='skip')

    dataset.columns = [
        'Number', 'In House Date', 'Room Number', 'Room Type', 'Arrangement', 'Guest No', 'First Name', 'Last Name',
        'Birth Date', 'Age', 'Member No', 'Member Type', 'Email', 'Mobile Phone', 'VIP', 'Room Rate', 'Lodging',
        'Breakfast', 'Lunch', 'Dinner', 'Other', 'Bill Number', 'Pay Article', 'Rate Code', 'Res No', 'Adult',
        'Child', 'Compliment', 'Nat', 'Local Region', 'Company / TA', 'SOB', 'Arrival', 'Depart', 'Night', 'C/I Time',
        'C/O Time', 'Segment', 'Created', 'By', 'K-Card', 'remarks'
    ]

    dataset = dataset[dataset['Number'].apply(lambda x: str(x).isdigit())]

    dataset.reset_index(drop=True, inplace=True)

    dataset['Number'] = range(1, len(dataset) + 1)

    delete_columns = ['VIP', 'Lunch', 'Dinner', 'Other', 'Rate Code', 'K-Card', 'remarks', 'Member No', 'Member Type', 'Guest No']
    dataset.drop(columns=delete_columns, inplace=True)

    dataset['First Name'].replace(['', 'NULL'], pd.NA, inplace=True)
    dataset['Last Name'].replace(['', 'NULL'], pd.NA, inplace=True)
    dataset['First Name'] = dataset['First Name'].astype(str)
    dataset['Last Name'] = dataset['Last Name'].astype(str)

    dataset['Name'] = dataset['First Name'].fillna('') + ' ' + dataset['Last Name'].fillna('')
    dataset['Name'] = dataset['Name'].str.strip()

    dataset.drop(columns=['First Name', 'Last Name'], inplace=True)

    dataset['In House Date'] = pd.to_datetime(dataset['In House Date'], format='%d/%m/%Y').dt.strftime('%d %B %Y')
    dataset['Arrival'] = pd.to_datetime(dataset['Arrival'], format='%d/%m/%Y')
    dataset['Depart'] = pd.to_datetime(dataset['Depart'], format='%d/%m/%Y')

    dataset.rename(columns={
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
        'Company / TA': 'Company_TA'
    }, inplace=True)

    dataset['LocalRegion'] = dataset['LocalRegion'].apply(lambda x: x[:3] if isinstance(x, str) else x)
    dataset['Adult'] = dataset['Adult'].astype(int)
    dataset['Child'] = dataset['Child'].astype(int)
    dataset['visitor_number'] = dataset['Adult'] + dataset['Child']
    dataset['visitor_category'] = dataset['visitor_number'].apply(lambda x: 'family/group' if x > 1 else 'individual')

    dataset = dataset.groupby(['Name', 'Arrival', 'Depart'], as_index=False).agg({
        'In_House_Date': 'first',
        'Room_Number': 'first',
        'Room_Type': 'first',
        'Arrangement': 'first',
        'Birth_Date': 'first',
        'Age': 'first',
        'Email': 'first',
        'Mobile_Phone': 'first',
        'Room Rate': 'first',
        'Lodging': 'first',
        'Breakfast': 'first',
        'Bill_Number': 'first',
        'Pay_Article': 'first',
        'Res_No': 'first',
        'Adult': 'first',
        'Child': 'first',
        'Compliment': 'first',
        'Nat': 'first',
        'LocalRegion': 'first',
        'Company_TA': 'first',
        'SOB': 'first',
        'Night': 'first',
        'CI_Time': 'first',
        'CO_Time': 'first',
        'Segment': 'first',
        'Created': 'first',
        'By': 'first',
        'visitor_number': 'first',
        'visitor_category': 'first'
    })

    json_data = dataset.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process(import_file))
