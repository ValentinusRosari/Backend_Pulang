from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
from pymongo import MongoClient
import pandas as pd
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

DB_URI = os.getenv("DB_URI")
DB_NAME = "Pulang2"
RAW_COLLECTION_FR = "modelfrs"
ETL_COLLECTION_FR = "etl_fr"
RAW_COLLECTION_IH = "modelihs"
ETL_COLLECTION_IH = "etl_ih"
MERGED_COLLECTION = "etl_merged_ih&fr"

default_args = {
    "owner": "airflow",
    "start_date": datetime(2024, 1, 1),
    "retries": 1,
}

def etl_process_fr():
    """
    ETL process for FR data.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]
    raw_collection = db[RAW_COLLECTION_FR]
    etl_collection = db[ETL_COLLECTION_FR]

    etl_collection.delete_many({})

    raw_documents = list(raw_collection.find())
    if not raw_documents:
        print("No data found in the 'frmodels' collection.")
        return

    merged_data = []
    for doc in raw_documents:
        merged_data.extend(doc.get("data", []))

    if not merged_data:
        print("No 'data' found in any documents.")
        return

    merged_df = pd.DataFrame(merged_data)
    cleaned_df = merged_df.drop_duplicates(subset=["Name"], keep="last")

    etl_collection.insert_many(cleaned_df.to_dict(orient="records"))
    print("FR ETL process completed successfully.")


def etl_process_ih():
    """
    ETL process for IH data.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]
    raw_collection = db[RAW_COLLECTION_IH]
    etl_collection = db[ETL_COLLECTION_IH]

    etl_collection.delete_many({})

    raw_documents = list(raw_collection.find())
    if not raw_documents:
        print("No data found in the 'ihmodels' collection.")
        return

    merged_data = []
    for doc in raw_documents:
        merged_data.extend(doc.get("data", []))

    if not merged_data:
        print("No 'data' found in any documents.")
        return

    merged_df = pd.DataFrame(merged_data)
    cleaned_df = merged_df.drop_duplicates(subset=["Name", "Arrival", "Depart", "Room_Number"], keep="last")

    etl_collection.insert_many(cleaned_df.to_dict(orient="records"))
    print("IH ETL process completed successfully.")


def etl_merge():
    """
    Merges the FR and IH data based on 'Name' field and stores the merged data.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]

    fr_etl_collection = db[ETL_COLLECTION_FR]
    ih_etl_collection = db[ETL_COLLECTION_IH]
    merged_collection = db[MERGED_COLLECTION]

    merged_collection.delete_many({})

    fr_data = list(fr_etl_collection.find({}))
    ih_data = list(ih_etl_collection.find({}))

    if fr_data and ih_data:
        fr_df = pd.DataFrame(fr_data)
        ih_df = pd.DataFrame(ih_data)

        merged_df = pd.merge(ih_df, fr_df, on="Name", how="outer", suffixes=("_ih", "_fr"))

        merged_collection.insert_many(merged_df.to_dict(orient="records"))
        print("FR and IH data merged and stored successfully.")
    else:
        print("No data to merge.")


with DAG("etl_file_processing", default_args=default_args, schedule_interval=None) as dag:
    etl_task_fr = PythonOperator(
        task_id="etl_process_fr",
        python_callable=etl_process_fr,
        dag=dag
    )

    etl_task_ih = PythonOperator(
        task_id="etl_process_ih",
        python_callable=etl_process_ih,
        dag=dag
    )

    etl_task_merge = PythonOperator(
        task_id="etl_merge",
        python_callable=etl_merge,
        dag=dag
    )

    etl_task_fr >> etl_task_merge
    etl_task_ih >> etl_task_merge
