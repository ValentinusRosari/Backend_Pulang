import pandas as pd
import numpy as np
import sys

def process_fr(import_file):
    data = pd.read_csv(import_file, skiprows=6, on_bad_lines='skip')

    data.columns = ['Name', 'Guest No', 'Segment', 'Type ID', 'ID No.', 'Address', 'Zip',
                    'City', 'Nat', 'Country', 'L-Region', 'Phone', 'Telefax', 'Sex',
                    'Birth Date', 'Email', 'Comments', 'Mobile No.', 'Occupation', 'Credit Lim'
                    ]

    delete_columns = ['Zip', 'Telefax', 'Credit Lim']
    data.drop(columns=delete_columns, inplace=True)

    replacements = {
    'BUMD': [
        'KARYAWAN BUMD', 'karyawan bumd', 'KARYAWAN bumd', 'karyawan BUMD',
        'BUMD', 'bumd',
        'SLEMAN'
    ],
    'BUMN': [
        'KARYAWAN BUMN', 'karyawan bumn', 'KARYAWAN bumn', 'karyawan BUMN',
        'BUMN', 'bumn',
        'KARYWN BUMN', 'karywn bumn', 'KARYWN bumn', 'karywn BUMN','KARY BUMN', 'kary bumn', 'KARY bumn', 'kary BUMN'
    ],
    'HONORER': [
        'HONORER', 'honorer', 'Honorer',
        'KARYAWAN HONORER', 'karyawan honorer', 'KARYAWAN honorer', 'karyawan HONORER'
    ],
    'MRT': [
        'IBU RUMAH TANGGA', 'ibu rumah tangga', 'IBU rumah tangga', 'ibu RUMAH TANGGA',
        'IRT', 'irt',
        'IRT ', 'irt ',
        'MENGURUS RUMAH TANGGA', 'mengurus rumah tangga', 'MENGURUS rumah tangga', 'mengurus RUMAH TANGGA',
        'MRT', 'mrt',
        'RUMAH TANGGA', 'rumah tangga', 'RUMAH tangga', 'rumah TANGGA'
    ],
    'PEDAGANG': [
        'PEDAGANG', 'pedagang', 'Pedagang',
        'PERDAGANGAN', 'perdagangan', 'Perdagangan'
    ],
    'PNS': [
        'PEG NEGERI', 'peg negeri', 'PEG negeri', 'peg NEGERI',
        'PEGAWAI NEGERI', 'pegawai negeri', 'PEGAWAI negeri', 'pegawai NEGERI',
        'PEGAWAI NEGERI SIPIL', 'pegawai negeri sipil', 'PEGAWAI negeri sipil', 'pegawai NEGERI SIPIL',
        'PEGAWAI NEGRI', 'pegawai negri', 'PEGAWAI negri', 'pegawai NEGRI',
        'PEGAWAI NEGRI SIPIL', 'pegawai negri sipil', 'PEGAWAI negri sipil', 'pegawai NEGRI SIPIL',
        'PNS', 'pns'
    ],
    'SWASTA': [
        'KAR SWASTA', 'kar swasta', 'KAR swasta', 'kar SWASTA',
        'KARYAWAN SWASTA', 'karyawan swasta', 'KARYAWAN swasta', 'karyawan SWASTA',
        'KARY SWASTA', 'kary swasta', 'KARY swasta', 'kary SWASTA',
        'KARYAWAB SWASTA', 'karyawab swasta', 'KARYAWAB swasta', 'karyawab SWASTA',
        'KARYAWAN SWATA', 'karyawan swata', 'KARYAWAN swata', 'karyawan SWATA',
        'KARYWAN SWASTA', 'karywan swasta', 'KARYWAN swasta', 'karywan SWASTA',
        'PEG. SWASTA', 'peg. swasta', 'PEG. swasta', 'peg. SWASTA',
        'PEGAWAI SWASTA', 'pegawai swasta', 'PEGAWAI swasta', 'pegawai SWASTA',
        'KARYAWAN', 'karyawan', 'KARYAWAN', 'karyawan',
        'KARYAWATI', 'karyawati', 'KARYAWATI', 'karyawati'
        'SWASTA', 'swasta', "Swasta",
    ],
    'TIDAK BEKERJA': [
        'BELM BEKERJA', 'belm bekerja', 'BELM bekerja', 'belm BEKERJA',
        'BELUM BEKERJA', 'belum bekerja', 'BELUM bekerja', 'belum BEKERJA',
        'BELUM TIDAK BEKERJA', 'belum tidak bekerja', 'BELUM tidak bekerja', 'belum TIDAK BEKERJA',
        'BELUM/TIDAK BEKERJA', 'belum/tidak bekerja', 'BELUM/tidak bekerja', 'belum/TIDAK BEKERJA',
        'TDK BEKERJA', 'tdk bekerja', 'TDK bekerja', 'tdk BEKERJA','Tdk bekerja',
        'TIDAK BEKERJA', 'tidak bekerja', 'TIDAK bekerja', 'tidak BEKERJA'
    ],
    'WIRASWASTA': [
        'WIRASWASTA', 'wiraswasta', 'WIRASWASTA', 'wiraswasta',
        'WIRASWATA', 'wiraswata', 'WIRASWATA', 'wiraswata'
    ],
    'PELAJAR MAHASISWA': [
        'pelajar', 'Pelajar', 'PELAJAR', 'PELAJAR ',
        'mahasiswa', 'Mahasiswa', 'MAHASISWA',
        'siswa', 'Siswa', 'SISWA',
        'pelajar mahasiswa', 'PELAJAR MAHASISWA',
        'MAHASISWI', 'PELAJAR / MAHASISWA',
        'PELAJAR/ MAHASISWA', 'PELAJAR/MAHASISWA',
        'PELAJAR/MAHASIWA', 'PELAJAR/MHS',
        'PELAJAR/NAHASISWA'
    ],
    'DOSEN' : [
        'DOSEN','dosen','Dosen'
    ]
    }

    for replacement, patterns in replacements.items():
        data['Occupation'] = data['Occupation'].replace(patterns, replacement)

    def remove_titles(name):
        titles = ['MR', 'MRS', 'MS', 'MISS', 'DR', 'PROF', 'SIR', 'MADAM', 'BPK']
        name_parts = [part for part in name.split() if part.upper().strip(',') not in titles]
        return ' '.join(name_parts)

    def reformat_name(name):
        name = remove_titles(name)
        if ',' in name:
            parts = [part.strip() for part in name.split(',')]
            if len(parts) == 2:
                name = f"{parts[1]} {parts[0]}"
        return name.strip()

    data['Name'] = data['Name'].apply(reformat_name)

    data['Mobile_Phone'] = data['Mobile No.'].fillna(data['Phone'])
    data.drop(columns=['Mobile No.', 'Phone'], inplace=True)

    data['Birth Date'] = pd.to_datetime(data['Birth Date'], format='%Y-%m-%d').dt.strftime('%d %B %Y')

    data.rename(columns={
    'Guest No': 'Guest_No',
    'Type ID': 'Type_ID',
    'ID No.': 'ID_No',
    'L-Region': 'L_Region',
    'Birth Date': 'Birth_Date',
    }, inplace=True)

    data['Name'] = data['Name'].str.strip()
    data['Name'] = data['Name'].str.upper()
    data['Name'] = data['Name'].str.rstrip(',')

    def merge_rows(group):
        merged = group.iloc[0].copy()
        for col in group.columns:
            if pd.isna(merged[col]) or merged[col] == 'NaN':
                non_na_values = group[col].dropna().unique()
                if len(non_na_values) > 0:
                    merged[col] = non_na_values[0]
        return merged

    data = data.groupby('Name').apply(merge_rows).reset_index(drop=True)

    data.reset_index(drop=True, inplace=True)

    json_data = data.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_fr(import_file))
