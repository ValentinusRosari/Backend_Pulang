from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
from pymongo import MongoClient
import logging
import pandas as pd

MONGO_URI = "mongodb+srv://ituttara:mongopulang72@cluster0.18jylse.mongodb.net/Pulang2?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "Pulang2"
RAW_COLLECTION_OBT = "obtmodels"
ETL_COLLECTION = "etl_obt_data"
RESTAURANT_BAR_COLLECTION = "restaurant_bar_obt"
ROOM_SERVICE_COLLECTION = "room_service_obt"
BANQUET_COLLECTION = "banquet_obt"

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
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    outlet_collections = [
        RESTAURANT_BAR_COLLECTION,
        ROOM_SERVICE_COLLECTION,
        BANQUET_COLLECTION,
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
    client = MongoClient(MONGO_URI)
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

    # Clean the DataFrame by removing duplicates
    cleaned_df = merged_df.drop_duplicates(subset=["Date", "Table Number", "Bill Number", "Prev Bill Number", "Article Number", "Article", "Subarticle", "Description", "Quantity", "Sales", "Payment", "Outlet", "Posting ID", "Start Time", "Close Time", "Time", "Name"], keep="last")

    if cleaned_df.empty:
        logging.warning("No valid data to insert into ETL collection.")
        return

    # Insert data into ETL collection in batches
    batch_insert_data(etl_collection, cleaned_df.to_dict(orient="records"))

    # Segregate data based on outlet type
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

    # Insert data into outlet-specific collections in batches
    if restaurant_data:
        batch_insert_data(db[RESTAURANT_BAR_COLLECTION], restaurant_data)
    if room_service_data:
        batch_insert_data(db[ROOM_SERVICE_COLLECTION], room_service_data)
    if banquet_data:
        batch_insert_data(db[BANQUET_COLLECTION], banquet_data)

    logging.info("ETL process completed successfully.")

    """
    ETL process for OBT data.
    Retrieves data from the 'obtmodels' collection, processes it, and stores it in relevant collections.
    """
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    raw_collection = db[RAW_COLLECTION_OBT]
    etl_collection = db[ETL_COLLECTION]

    etl_collection.delete_many({})

    raw_documents = list(raw_collection.find())

    if len(raw_documents) == 0:
        logging.warning("No documents found in the raw OBT collection.")
    else:
        logging.info(f"Found {len(raw_documents)} documents in the raw OBT collection.")

    merged_data = []
    for doc in raw_documents:
        merged_data.extend(doc.get("data", []))

    if not merged_data:
        logging.warning("No 'data' found in any documents.")
        return

    merged_df = pd.DataFrame(merged_data)

    if merged_data:
        etl_collection.insert_many(merged_df.to_dict(orient="records"))
        logging.info(f"Inserted {len(merged_data)} processed documents into {ETL_COLLECTION} collection.")

    restaurant_data = []
    room_service_data = []
    banquet_data = []

    for _, document in merged_df.iterrows():
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
        db[RESTAURANT_BAR_COLLECTION].insert_many(restaurant_data)
        logging.info(f"Inserted {len(restaurant_data)} documents into {RESTAURANT_BAR_COLLECTION} collection.")

    if room_service_data:
        db[ROOM_SERVICE_COLLECTION].insert_many(room_service_data)
        logging.info(f"Inserted {len(room_service_data)} documents into {ROOM_SERVICE_COLLECTION} collection.")

    if banquet_data:
        db[BANQUET_COLLECTION].insert_many(banquet_data)
        logging.info(f"Inserted {len(banquet_data)} documents into {BANQUET_COLLECTION} collection.")

    logging.info("ETL process completed successfully.")

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

delete_outlet_data_task >> etl_task
