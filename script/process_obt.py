import numpy as np
import pandas as pd
import re
import sys

def process_obt(import_file):
    df = pd.read_csv(import_file)

    df = df.dropna(subset=['Date'])
    df['Table Number'] = df['Table Number'].fillna(0).astype(int)
    df['Bill Number'] = df['Bill Number'].fillna(0).astype(int)
    df['Article Number'] = df['Article Number'].fillna(0).astype(int)
    df['Posting ID'] = df['Posting ID'].fillna(0).astype(int)

    def update_bill_numbers(df):
        df['Prev Bill Number'] = df['Bill Number']
        def find_largest_bill(row, max_bill, visited):
            current_bill = row['Bill Number']
            if current_bill in visited:
                return max_bill
            visited.add(current_bill)

            description = row['Description']
            match = re.search(r'(To|From) Table \d+ \*(\d+)', description)
            if match:
                new_bill = int(match.group(2))
                if new_bill > current_bill:
                    max_bill = max(max_bill, new_bill)
                    new_rows = df[df['Bill Number'] == new_bill]
                    for _, new_row in new_rows.iterrows():
                        max_bill = find_largest_bill(new_row, max_bill, visited)
            return max_bill

        for index, row in df.iterrows():
            visited = set()
            largest_bill = find_largest_bill(row, row['Bill Number'], visited)
            if largest_bill > row['Bill Number']:
                df.loc[df['Bill Number'].isin(visited), 'Bill Number'] = largest_bill

        return df
    
    df_updated = update_bill_numbers(df)
    cols = df_updated.columns.tolist()
    cols.insert(cols.index('Bill Number') + 1, cols.pop(cols.index('Prev Bill Number')))
    df_updated = df_updated[cols]

    df_updated['Article Number'] = df_updated['Article Number'].astype(int)
    def classify_article(article_number):
        if article_number <= 1000:
            return 'Food'
        elif 1001 <= article_number < 2000:
            return 'Non-Alcohol Beverages'
        elif 2001 <= article_number < 3000:
            return 'Alcohol Beverages'
        else:
            return 'Others'

    df_updated['Article'] = df_updated['Article Number'].apply(classify_article)

    article_description_mapping = {
    1: 'Breakfast', 2: 'Breakfast', 3: 'Breakfast', 41: 'Appetizer', 42: 'Appetizer', 43: 'Appetizer', 44: 'Appetizer',
    81: 'Appetizer', 82: 'Dessert', 83: 'Dessert', 84: 'Dessert', 85: 'Dessert', 86: 'Dessert', 87: 'Dessert',
    88: 'Dessert', 89: 'Dessert', 90: 'Dessert', 121: 'Pasta', 122: 'Pasta', 123: 'Pasta', 161: 'Extra For Pasta',
    162: 'Extra For Pasta', 163: 'Extra For Pasta', 201: 'Pizza', 202: 'Pizza', 203: 'Pizza', 204: 'Pizza',
    205: 'Pizza', 206: 'Pizza', 207: 'Pizza', 208: 'Pizza', 209: 'Pizza', 210: 'Pizza', 241: 'Easy Bite',
    242: 'Easy Bite', 243: 'Easy Bite', 244: 'Easy Bite', 245: 'Easy Bite', 246: 'Easy Bite', 247: 'Easy Bite',
    248: 'Easy Bite', 249: 'Easy Bite', 250: 'Easy Bite', 251: 'Easy Bite', 252: 'Easy Bite', 253: 'Easy Bite',
    254: 'Easy Bite', 255: 'Easy Bite', 256: 'Easy Bite', 257: 'Easy Bite', 258: 'Easy Bite', 259: 'Easy Bite',
    260: 'Easy Bite', 261: 'Easy Bite', 281: 'Main Course', 282: 'Main Course', 283: 'Main Course', 284: 'Main Course',
    285: 'Main Course', 286: 'Main Course', 287: 'Main Course', 288: 'Main Course', 289: 'Main Course',
    290: 'Main Course', 291: 'Main Course', 292: 'Main Course', 293: 'Main Course', 294: 'Main Course',
    295: 'Main Course', 296: 'Main Course', 297: 'Main Course', 298: 'Main Course', 299: 'Main Course',
    300: 'Main Course', 301: 'Main Course', 302: 'Main Course', 303: 'Main Course', 304: 'Main Course',
    305: 'Main Course', 306: 'Main Course', 307: 'Main Course', 1001: 'Coffee', 1002: 'Coffee', 1003: 'Coffee',
    1004: 'Coffee', 1005: 'Coffee', 1006: 'Coffee', 1007: 'Coffee', 1008: 'Coffee', 1009: 'Coffee', 1010: 'Coffee',
    1011: 'Coffee', 1012: 'Coffee', 1041: 'Tea', 1042: 'Tea', 1043: 'Tea', 1044: 'Tea', 1045: 'Tea', 1081: 'Softdrink',
    1082: 'Softdrink', 1083: 'Softdrink', 1084: 'Softdrink', 1085: 'Softdrink', 1086: 'Softdrink', 1087: 'Softdrink',
    1120: 'Mineral Water', 1121: 'Mineral Water', 1141: 'Juice', 1142: 'Juice', 1143: 'Juice', 1144: 'Juice',
    1145: 'Juice', 1181: 'Mocktail', 1182: 'Mocktail', 1183: 'Mocktail', 1184: 'Mocktail', 1185: 'Mocktail',
    1186: 'Mocktail', 1221: 'Mixer', 1222: 'Mixer', 1223: 'Mixer', 1224: 'Mixer', 1225: 'Mixer', 1226: 'Mixer',
    2001: 'Beer', 2002: 'Beer', 2003: 'Beer', 2004: 'Beer', 2005: 'Beer', 2006: 'Beer', 2007: 'Beer', 2008: 'Beer',
    2041: 'Cocktail', 2042: 'Cocktail', 2043: 'Cocktail', 2044: 'Cocktail', 2045: 'Cocktail', 2046: 'Cocktail',
    2047: 'Cocktail', 2048: 'Cocktail', 2049: 'Cocktail', 2050: 'Cocktail', 2051: 'Cocktail', 2052: 'Cocktail',
    2053: 'Cocktail', 2054: 'Cocktail', 2055: 'Cocktail', 2056: 'Cocktail', 2057: 'Cocktail', 2058: 'Cocktail',
    2059: 'Cocktail', 2060: 'Cocktail', 2061: 'Cocktail', 2062: 'Cocktail', 2063: 'Cocktail', 2064: 'Cocktail',
    2065: 'Cocktail', 2066: 'Cocktail', 2067: 'Cocktail', 2068: 'Cocktail', 2069: 'Cocktail', 2070: 'Cocktail',
    2071: 'Cocktail', 2072: 'Cocktail', 2073: 'Cocktail', 2074: 'Cocktail', 2075: 'Cocktail', 2076: 'Cocktail',
    2077: 'Cocktail', 2078: 'Cocktail', 2079: 'Cocktail', 2080: 'Cocktail', 2101: 'Shoot', 2102: 'Shoot', 2103: 'Shoot',
    2104: 'Shoot', 2105: 'Shoot', 2106: 'Shoot', 2107: 'Shoot', 2108: 'Shoot', 2109: 'Shoot', 2110: 'Shoot',
    2111: 'Shoot', 2112: 'Shoot', 2113: 'Shoot', 2114: 'Shoot', 2115: 'Shoot', 2116: 'Shoot', 2117: 'Shoot',
    2118: 'Shoot', 2119: 'Shoot', 2120: 'Shoot', 2121: 'Shoot', 2122: 'Shoot', 2123: 'Shoot', 2124: 'Shoot',
    2125: 'Shoot', 2126: 'Shoot', 2127: 'Shoot', 2128: 'Shoot', 2129: 'Shoot', 2130: 'Shoot', 2131: 'Shoot',
    2132: 'Shoot', 2133: 'Shoot', 2134: 'Shoot', 2135: 'Shoot', 2136: 'Shoot', 2137: 'Shoot', 2138: 'Shoot',
    2139: 'Shoot', 2140: 'Shoot', 2141: 'Shoot', 2142: 'Shoot', 2143: 'Shoot', 2144: 'Shoot', 2145: 'Shoot',
    2146: 'Shoot', 2147: 'Shoot', 2148: 'Shoot', 2149: 'Shoot', 2150: 'Shoot', 2151: 'Shoot', 2152: 'Shoot',
    2153: 'Shoot', 2154: 'Shoot', 2155: 'Shoot', 2156: 'Shoot', 2201: 'Bottle', 2202: 'Bottle', 2203: 'Bottle',
    2204: 'Bottle', 2205: 'Bottle', 2206: 'Bottle', 2207: 'Bottle', 2208: 'Bottle', 2209: 'Bottle', 2210: 'Bottle',
    2211: 'Bottle', 2212: 'Bottle', 2213: 'Bottle', 2214: 'Bottle', 2215: 'Bottle', 2216: 'Bottle', 2217: 'Bottle',
    2218: 'Bottle', 2219: 'Bottle', 2220: 'Bottle', 2221: 'Bottle', 2222: 'Bottle', 2223: 'Bottle', 2224: 'Bottle',
    2225: 'Bottle', 2226: 'Bottle', 2227: 'Bottle', 2228: 'Bottle', 2229: 'Bottle', 2230: 'Bottle', 2231: 'Bottle',
    2232: 'Bottle', 2233: 'Bottle', 2234: 'Bottle', 2235: 'Bottle', 2236: 'Bottle', 2237: 'Bottle', 2238: 'Bottle', 2239: 'Bottle', 2240: 'Bottle', 2241: 'Bottle', 2242: 'Bottle', 2243: 'Bottle',
    2244: 'Bottle', 2245: 'Bottle', 2246: 'Bottle', 2247: 'Bottle', 2248: 'Bottle', 2249: 'Bottle', 2250: 'Bottle',
    2251: 'Bottle', 2252: 'Bottle', 2253: 'Bottle', 2254: 'Bottle', 2255: 'Bottle', 2256: 'Bottle', 2257: 'Bottle',
    2258: 'Bottle', 2259: 'Bottle', 2260: 'Bottle', 2261: 'Bottle', 2262: 'Bottle', 2263: 'Bottle', 2264: 'Bottle',
    2265: 'Bottle', 2266: 'Bottle', 2267: 'Bottle', 2268: 'Bottle', 2269: 'Bottle', 2270: 'Bottle', 2271: 'Bottle',
    2272: 'Bottle', 2273: 'Bottle', 2274: 'Bottle', 2275: 'Bottle', 2276: 'Bottle', 2277: 'Bottle', 2278: 'Bottle',
    2279: 'Bottle', 2307:'Promo', 2312: 'Promo', 2319: 'Promo', 2320: 'Promo', 2321: 'Promo', 2322: 'Promo', 2323: 'Promo', 2324: 'Promo',
    2325: 'Promo', 2326: 'Promo', 2327: 'Promo', 2329: 'Promo', 2330: 'Promo', 2331: 'Promo', 2332: 'Promo',
    2333: 'Promo', 2334: 'Promo', 2335: 'Promo', 2336: 'Promo', 2337: 'Promo', 2338: 'Promo', 2339: 'Promo',
    2340: 'Promo', 2341: 'Promo', 2342: 'Promo', 2343: 'Promo', 2344: 'Promo', 2345: 'Promo', 2346: 'Promo',
    2347: 'Promo', 2348: 'Promo', 2349: 'Promo', 2350: 'Promo', 2351: 'Promo', 2352: 'Promo', 2353: 'Promo',
    3001: 'Cigarette', 3002: 'Cigarette', 3003: 'Cigarette', 3004: 'Cigarette', 3101: 'Miscellaneous', 3102: 'Miscellaneous',
    3103: 'Miscellaneous', 3104: 'Miscellaneous', 3501: 'Merchandise', 3502: 'Merchandise', 3503: 'Merchandise',
    3504: 'Merchandise', 3505: 'Merchandise', 3506: 'Merchandise', 3507: 'Merchandise', 3508: 'Merchandise',
    3509: 'Merchandise', 3510: 'Merchandise', 3511: 'Merchandise', 3512: 'Merchandise', 3513: 'Merchandise',
    3514: 'Miscellaneous', 3515: 'Miscellaneous', 3516: 'Miscellaneous', 3517: 'Merchandise', 3518: 'Merchandise',
    3519: 'Merchandise', 3520: 'Merchandise', 3521: 'Merchandise', 3522: 'Merchandise', 3523: 'Merchandise',
    3524: 'Merchandise', 3525: 'Merchandise', 3526: 'Merchandise', 3527: 'Merchandise', 3528: 'Merchandise',
    3529: 'Merchandise', 3530: 'Merchandise', 3531: 'Merchandise', 3532: 'Merchandise', 3533: 'Merchandise',
    3534: 'Merchandise', 3535: 'Merchandise', 3536: 'Merchandise', 3537: 'Merchandise', 3538: 'Merchandise',
    3539: 'Merchandise', 3540: 'Merchandise', 3541: 'Merchandise', 3542: 'Merchandise', 3543: 'Merchandise',
    3544: 'Merchandise', 3545: 'Merchandise', 3546: 'Merchandise', 4001: 'Soju', 4002: 'Soju', 4004: 'Soju',
    6900: 'Welcome Drink', 6901: 'Fruit Basket', 6902: 'Fruit Basket', 6903: 'Cake Compliment', 6904: 'Cake Compliment',
    7000: 'Miscellaneous', 7001: 'Miscellaneous', 7002: 'Miscellaneous', 8911: 'Discount', 8912: 'Discount',
    8913: 'Discount', 9850: 'Compliment', 9851: 'Compliment', 9852: 'Compliment', 9853: 'Compliment',
    9854: 'Compliment', 9855: 'Compliment', 9856: 'Compliment', 9857: 'Compliment', 9870: 'Compliment',
    9871: 'Compliment', 9872: 'Compliment', 9873: 'Compliment', 9874: 'Compliment', 9875: 'Compliment',
    9876: 'Compliment', 9877: 'Compliment', 9890: 'Compliment', 9891: 'Compliment', 9892: 'Compliment',
    9893: 'Compliment', 9900: 'Cash', 9901: 'Voucher', 9910: 'Voucher', 9911: 'Voucher', 9930: 'Credit Card',
    9931: 'Credit Card', 9932: 'Credit Card', 9933: 'Credit Card', 9934: 'Credit Card', 9935: 'Credit Card',
    9936: 'Credit Card', 9937: 'Credit Card', 9938: 'Credit Card', 9939: 'Credit Card', 9940: 'Credit Card',
    9941: 'Credit Card', 9942: 'Credit Card', 9943: 'Credit Card', 9950: 'City Ledger', 9951: 'City Ledger',
    9952: 'City Ledger', 9953: 'City Ledger', 9954: 'City Ledger'
    }

    df_updated['Subarticle'] = df_updated['Article Number'].map(article_description_mapping).fillna('Unknown')

    cols = df_updated.columns.tolist()
    cols.insert(cols.index('Article Number') + 1, cols.pop(cols.index('Article')))
    cols.insert(cols.index('Article') + 1, cols.pop(cols.index('Subarticle')))
    df_updated = df_updated[cols]

    df_updated['Guest Name'] = df_updated['Guest Name'].replace(['', 'NULL', 'NaN', 'nan', None], pd.NA)

    df_updated['Guest Name'] = df_updated['Guest Name'].fillna('')

    df_updated['Name'] = df_updated['Guest Name']

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

    df_updated['Name'] = df_updated['Name'].apply(reformat_name)

    df_updated.drop(columns=['Guest Name'], inplace=True)

    json_data = df_updated.to_json(orient='records')
    return json_data

if __name__ == "__main__":
    import_file = sys.argv[1]
    print(process_obt(import_file))
