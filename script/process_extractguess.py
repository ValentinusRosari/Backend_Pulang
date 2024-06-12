import pandas as pd
import json
import sys

def process_extractguess(import_file):
    data = pd.read_csv(import_file)

    data.columns = ['Number', 'GuestName', 'Type ID', 'ID Number', 'Membership ID', 'Member Type', 'Address', 'Zip',
                  'City', 'Nationality', 'Country', 'LocalRegion',
                  'Phone', 'MobilePhone', 'Sex', 'Birthdate', 'Email', 'Occupation', 'Credit Limit']

    data = data.drop(0, axis=0)

    delete_columns = ['Member Type', 'Membership ID', 'Zip', 'Email', 'Credit Limit']
    data.drop(columns=delete_columns, inplace=True)

    data['Sex'] = data['Sex'].replace('M', 'Unknown')

    replacements = {
        'PELAJAR MAHASISWA' : ['pelajar', 'Pelajar', 'PELAJAR','PELAJAR ', 'mahasiswa', 'Mahasiswa', 'MAHASISWA', 'siswa', 'Siswa', 'SISWA', 'pelajar mahasiswa', 'PELAJAR MAHASISWA','MAHASISWI','PELAJAR / MAHASISWA','PELAJAR/ MAHASISWA','PELAJAR/MAHASISWA','PELAJAR/MAHASIWA','PELAJAR/MHS','PELAJAR/NAHASISWA'],
        'BUMD' : ['KARYAWAN BUMD', 'BUMD','KARY BUMN'],
        'BUMN' : ['KARYAWAN BUMN', 'Bumn','KARYWN BUMN'],
        'HONORER' : ['HONORER','KARYAWAN HONORER'],
        'MRT' : ['IBU RUMAH TANGGA', 'IRT','IRT ','MENGURUS RUMAH TANGGA','MRT','RUMAH TANGGA'],
        'PEDAGANG' : ['PEDAGANG', 'PERDAGANGAN'],
        'PNS':['PEG NEGERI','PEGAWAI NEGERI','PEGAWAI NEGERI SIPIL','PEGAWAI NEGRI','PEGAWAI NEGRI SIPIL','PNS'],
        'SWASTA':['KAR SWASTA','KARYAWAN SWASTA','KARY SWASTA','KARYAWAB SWASTA','KARYAWAN SWASTA','KARYAWAN SWATA','KARYWAN SWASTA','PEG. SWASTA','PEGAWAI SWASTA','KARYAWAN','KARYAWATI'],
        'TIDAK BEKERJA':['BELM BEKERJA','BELUM BEKERJA','BELUM TIDAK BEKERJA','BELUM/TIDAK BEKERJA','TDK BEKERJA','TIDAK BEKERJA'],
        'WIRASWASTA':['WIRASWASTA','WIRASWATA']
    }

    for replacement, patterns in replacements.items():
        data['Occupation'] = data['Occupation'].replace(patterns, replacement)

    data['Address'] = data['Address'].replace('N A','NaN')
    data.rename(columns={'GuestName': 'Name'}, inplace=True)

    json_data = data.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_extractguess(import_file))
