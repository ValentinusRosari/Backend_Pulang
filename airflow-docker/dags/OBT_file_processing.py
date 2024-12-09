from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
from pymongo import MongoClient
import logging
import pandas as pd
from dotenv import load_dotenv
import os

load_dotenv()

DB_URI = os.getenv("DB_URI")
DB_NAME = "Pulang2"
RAW_COLLECTION_OBT = "modelobts"
ETL_COLLECTION = "obt_data"
RESTAURANT_COLLECTION = "obt_restaurant"
ROOM_SERVICE_COLLECTION = "obt_roomservice"
BANQUET_COLLECTION = "obt_banquet"
RESTAURANT_COLLECTION_SALES = "obt_restaurant_sales"
ROOM_SERVICE_NEW_COLLECTION = "obt_roomservice_sales"
BANQUET_NEW_COLLECTION = "obt_banquet_sales"

default_args = {
    "owner": "airflow",
    "start_date": datetime(2024, 1, 1),
    "retries": 1,
}

def delete_outlet_data():
    """
    Deletes data from the outlet-specific collections (Restaurant, Room Service, Banquet)
    when the corresponding raw and ETL collections are deleted.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]

    outlet_collections = [
        RESTAURANT_COLLECTION,
        ROOM_SERVICE_COLLECTION,
        BANQUET_COLLECTION,
        RESTAURANT_COLLECTION_SALES,
        ROOM_SERVICE_NEW_COLLECTION,
        BANQUET_NEW_COLLECTION,
    ]

    for collection_name in outlet_collections:
        collection = db[collection_name]
        result = collection.delete_many({})
        logging.info(f"Deleted {result.deleted_count} documents from {collection_name} collection.")
    
    logging.info("Deleted documents from outlet collections.")

def batch_insert_data(collection, data, batch_size=1000):
    """
    Insert data into MongoDB in smaller batches to avoid memory overload.
    """
    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        collection.insert_many(batch)
        logging.info(f"Inserted batch of {len(batch)} documents.")

def etl_process_obt():
    client = MongoClient(DB_URI)
    db = client[DB_NAME]
    raw_collection = db[RAW_COLLECTION_OBT]
    etl_collection = db[ETL_COLLECTION]

    etl_collection.delete_many({})

    raw_documents = list(raw_collection.find())

    if len(raw_documents) == 0:
        logging.warning("No documents found in the raw OBT collection.")
        return

    merged_data = []
    for doc in raw_documents:
        merged_data.extend(doc.get("data", []))

    if not merged_data:
        logging.warning("No 'data' found in any documents.")
        return

    merged_df = pd.DataFrame(merged_data)

    cleaned_df = merged_df.drop_duplicates(subset=["Date", "Table Number", "Bill Number", "Prev Bill Number", "Article Number", 
                                                   "Article", "Subarticle", "Description", "Quantity", "Sales", "Payment", "Outlet", 
                                                   "Posting ID", "Start Time", "Close Time", "Time", "Name"], keep="last")

    if cleaned_df.empty:
        logging.warning("No valid data to insert into ETL collection.")
        return

    batch_insert_data(etl_collection, cleaned_df.to_dict(orient="records"))

    restaurant_data = []
    room_service_data = []
    banquet_data = []

    for _, document in cleaned_df.iterrows():
        outlet = document.get('Outlet', '').strip()

        if outlet == 'Restaurant & Bar':
            restaurant_data.append(document.to_dict())
        elif outlet == 'Room Service':
            room_service_data.append(document.to_dict())
        elif outlet == 'Banquet':
            banquet_data.append(document.to_dict())
        else:
            logging.warning(f"Unknown outlet: {outlet}. Document skipped.")

    if restaurant_data:
        batch_insert_data(db[RESTAURANT_COLLECTION], restaurant_data)
    if room_service_data:
        batch_insert_data(db[ROOM_SERVICE_COLLECTION], room_service_data)
    if banquet_data:
        batch_insert_data(db[BANQUET_COLLECTION], banquet_data)

    logging.info("ETL process completed successfully.")

def etl_billNumber():
    client = MongoClient(DB_URI)
    db = client[DB_NAME]

    collections = {
        'restaurant': RESTAURANT_COLLECTION,
        'room_service': ROOM_SERVICE_COLLECTION,
        'banquet': BANQUET_COLLECTION,
    }

    new_collections = {
        'restaurant': RESTAURANT_COLLECTION_SALES,
        'room_service': ROOM_SERVICE_NEW_COLLECTION,
        'banquet': BANQUET_NEW_COLLECTION,
    }

    for outlet, collection_name in collections.items():
        collection = db[collection_name]
        outlet_data = list(collection.find())

        if outlet_data:
            df = pd.DataFrame(outlet_data)

            total_sales_per_bill = df.groupby('Prev Bill Number')['Sales'].sum().reset_index()
            total_sales_per_bill.columns = ['Bill Number', 'Total Sales']

            new_collection = db[new_collections[outlet]]
            new_collection.delete_many({})
            batch_insert_data(new_collection, total_sales_per_bill.to_dict(orient="records"))
        else:
            logging.warning(f"No data found for {outlet} in {collection_name}.")

dag = DAG(
    'obt_file_processing',
    default_args=default_args,
    description='A DAG for processing OBT data',
    schedule_interval=None,
    catchup=False,
)

delete_outlet_data_task = PythonOperator(
    task_id='delete_outlet_data',
    python_callable=delete_outlet_data,
    dag=dag,
)

etl_task = PythonOperator(
    task_id='etl_process_obt',
    python_callable=etl_process_obt,
    dag=dag,
)

etl_billNumber_task = PythonOperator(
    task_id="etl_billNumber",
    python_callable=etl_billNumber,
    dag=dag,
)

delete_outlet_data_task >> etl_task >>  etl_billNumber_task
