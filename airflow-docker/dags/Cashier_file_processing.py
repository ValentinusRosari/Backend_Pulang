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
RAW_COLLECTION_BANQUET = "modelbanquets"
ETL_COLLECTION_BANQUET = "cashier_banquet"
RAW_COLLECTION_RESTAURANT = "modelrestaurants"
ETL_COLLECTION_RESTAURANT = "cashier_restaurant"
RAW_COLLECTION_ROOMSERVICE = "modelroomservices"
ETL_COLLECTION_ROOMSERVICE = "cashier_roomservice"

default_args = {
    "owner": "airflow",
    "start_date": datetime(2024, 1, 1),
    "retries": 1,
}

def etl_process_banquet():
    """
    ETL process for Banquet data.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]
    raw_collection = db[RAW_COLLECTION_BANQUET]
    etl_collection = db[ETL_COLLECTION_BANQUET]

    etl_collection.delete_many({})

    raw_documents = list(raw_collection.find())
    if not raw_documents:
        print("No data found in the 'banquetmodels' collection.")
        return

    merged_data = []
    for doc in raw_documents:
        merged_data.extend(doc.get("data", []))

    if not merged_data:
        print("No 'data' found in any documents.")
        return

    merged_df = pd.DataFrame(merged_data)
    cleaned_df = merged_df.drop_duplicates(subset=["Bill Number", "Pax", "Food BANQUET", "Beverage BANQUET",
                                                    "Other BANQUET", "Disc Food BANQUET", "Service", "Tax", "Total",
                                                    "Deposit", "Currency", "Cash", "Voucher", "Transfer",
                                                    "Card/ City Ledger", "Information", "Guest Name"], keep="last")

    etl_collection.insert_many(cleaned_df.to_dict(orient="records"))
    print("Banquet ETL process completed successfully.")


def etl_process_restaurant():
    """
    ETL process for Restaurant data.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]
    raw_collection = db[RAW_COLLECTION_RESTAURANT]
    etl_collection = db[ETL_COLLECTION_RESTAURANT]

    etl_collection.delete_many({})

    raw_documents = list(raw_collection.find())
    if not raw_documents:
        print("No data found in the 'restaurantmodels' collection.")
        return

    merged_data = []
    for doc in raw_documents:
        merged_data.extend(doc.get("data", []))

    if not merged_data:
        print("No 'data' found in any documents.")
        return

    merged_df = pd.DataFrame(merged_data)
    cleaned_df = merged_df.drop_duplicates(subset=["Bill Number", "Pax", "Food RESTAURANT", "Beverage RESTAURANT",
                                                    "Other RESTAURANT", "Disc Food RESTAURANT", "Service", "Tax", "Total",
                                                    "Deposit", "Currency", "Cash", "Voucher", "Transfer",
                                                    "Card/ City Ledger", "Information", "Guest Name"], keep="last")

    etl_collection.insert_many(cleaned_df.to_dict(orient="records"))
    print("Restaurant ETL process completed successfully.")


def etl_process_roomservice():
    """
    ETL process for Room Service data.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]
    raw_collection = db[RAW_COLLECTION_ROOMSERVICE]
    etl_collection = db[ETL_COLLECTION_ROOMSERVICE]

    etl_collection.delete_many({})

    raw_documents = list(raw_collection.find())
    if not raw_documents:
        print("No data found in the 'roomservicemodels' collection.")
        return

    merged_data = []
    for doc in raw_documents:
        merged_data.extend(doc.get("data", []))

    if not merged_data:
        print("No 'data' found in any documents.")
        return

    merged_df = pd.DataFrame(merged_data)
    cleaned_df = merged_df.drop_duplicates(subset=["Bill Number", "Pax", "Food R.SERV", "Beverage R.SERV", "Other R.SERV",
                                                    "Disc Food R.SERV", "Service", "Tax", "Total", "Deposit", "Currency",
                                                    "Cash", "Voucher", "Transfer", "Card/ City Ledger", "Information",
                                                    "Guest Name"], keep="last")

    etl_collection.insert_many(cleaned_df.to_dict(orient="records"))
    print("Room Service ETL process completed successfully.")


with DAG("cashier_file_processing", default_args=default_args, schedule_interval=None, catchup=False,) as dag:
    etl_task_banquet = PythonOperator(
        task_id="etl_process_banquet",
        python_callable=etl_process_banquet,
    )

    etl_task_restaurant = PythonOperator(
        task_id="etl_process_restaurant",
        python_callable=etl_process_restaurant,
    )

    etl_task_roomservice = PythonOperator(
        task_id="etl_process_roomservice",
        python_callable=etl_process_roomservice,
    )
