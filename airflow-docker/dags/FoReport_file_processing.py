from urllib import request
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
from pymongo import MongoClient
import pandas as pd
from dotenv import load_dotenv
import os

load_dotenv()

DB_URI = os.getenv("DB_URI")
DB_NAME = "Pulang2"
RAW_COLLECTION_ESCORT = "modelescorts"
RAW_COLLECTION_COMMENT = "modelcomments"
RAW_COLLECTION_REQUEST = "modelrequests"
ETL_COLLECTION_ESCORT = "foReport_escort"
ETL_COLLECTION_COMMENT = "foReport_comment"
ETL_COLLECTION_REQUEST = "foReport_request"
ETL_COLLECTION_IH = "etl_ih"
ETL_COLLECTION_FO = "foReport_merged_ih&fo"

default_args = {
    "owner": "airflow",
    "start_date": datetime(2024, 1, 1),
    "retries": 1,
}

def etl_process_escort():
    """
    ETL process for Escort data.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]
    raw_collection = db[RAW_COLLECTION_ESCORT]
    etl_collection = db[ETL_COLLECTION_ESCORT]

    etl_collection.delete_many({})

    raw_documents = list(raw_collection.find())
    if not raw_documents:
        print("No data found in the 'escortmodels' collection.")
        return

    merged_data = []
    for doc in raw_documents:
        merged_data.extend(doc.get("data", []))

    if not merged_data:
        print("No 'data' found in any documents.")
        return

    merged_df = pd.DataFrame(merged_data)
    cleaned_df = merged_df.drop_duplicates(subset=["RESERVATION NAME", "Room_Number", "Arrival", "Depart", "PHONE NUMBER (62XXX)", 
                                                   "PURPOSE OF STAY", "PLATE NUMBER", "ESCORT", "BY", "SHIFT", "VOUCHER",
                                                   "ELDER", "CHILD", "DISABLED", "PREGNANT", "VOUCHER NUMBER", "PAX", "CHECK"], keep="last")

    etl_collection.insert_many(cleaned_df.to_dict(orient="records"))
    print("Escort ETL process completed successfully.")


def etl_process_comment():
    """
    ETL process for Comment data.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]
    raw_collection = db[RAW_COLLECTION_COMMENT]
    etl_collection = db[ETL_COLLECTION_COMMENT]

    etl_collection.delete_many({})

    raw_documents = list(raw_collection.find())
    if not raw_documents:
        print("No data found in the 'commentmodels' collection.")
        return

    merged_data = []
    for doc in raw_documents:
        merged_data.extend(doc.get("data", []))

    if not merged_data:
        print("No 'data' found in any documents.")
        return

    merged_df = pd.DataFrame(merged_data)
    cleaned_df = merged_df.drop_duplicates(subset=["RESERVATION NAME", "Room_Number", "Arrival", "Depart", 
                                                   "DATE", "FEEDBACK/COMMENT", "CATEGORIZED AS", "INPUTED BY"], keep="last")

    etl_collection.insert_many(cleaned_df.to_dict(orient="records"))
    print("Comment ETL process completed successfully.")


def etl_process_request():
    """
    ETL process for Request data.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]
    raw_collection = db[RAW_COLLECTION_REQUEST]
    etl_collection = db[ETL_COLLECTION_REQUEST]

    etl_collection.delete_many({})

    raw_documents = list(raw_collection.find())
    if not raw_documents:
        print("No data found in the 'requestmodels' collection.")
        return

    merged_data = []
    for doc in raw_documents:
        merged_data.extend(doc.get("data", []))

    if not merged_data:
        print("No 'data' found in any documents.")
        return

    merged_df = pd.DataFrame(merged_data)
    cleaned_df = merged_df.drop_duplicates(subset=["DATE", "RESERVATION NAME", "Room_Number", "Arrival", "Depart",
                                                    "REQUEST", "QTY", "REQ TIME", "RECEIVED BY", "SENT REQ TIME", "SENT BY",
                                                    "HANDLED TIME", "HANDLED BY", "RETURNED DATE", "RETURNED TIME",
                                                    "RETURNED TO", "DURATION", "REMAKS"], keep="last")

    etl_collection.insert_many(cleaned_df.to_dict(orient="records"))
    print("Request ETL process completed successfully.")


def etl_merge_FO():
    """
    Merges the IH with Escort, Comment, and Request data based on "Room_Number", "Arrival", and "Depart" field and stores the etl_FO data.
    """
    client = MongoClient(DB_URI)
    db = client[DB_NAME]

    escort_etl_collection = db[ETL_COLLECTION_ESCORT]
    comment_etl_collection = db[ETL_COLLECTION_COMMENT]
    request_etl_collection = db[ETL_COLLECTION_REQUEST]
    ih_etl_collection = db[ETL_COLLECTION_IH]
    merged_collection = db[ETL_COLLECTION_FO]

    merged_collection.delete_many({})

    escort_data = list(escort_etl_collection.find({}))
    comment_data = list(comment_etl_collection.find({}))
    request_data = list(request_etl_collection.find({}))
    ih_data = list(ih_etl_collection.find({}))

    if ih_data and escort_data and comment_data and request_data:
        escort_df = pd.DataFrame(escort_data)
        comment_df = pd.DataFrame(comment_data)
        request_df = pd.DataFrame(request_data)
        ih_df = pd.DataFrame(ih_data)

        merged_df = pd.merge(ih_df, escort_df[["Room_Number", "Arrival", "Depart", "PURPOSE OF STAY","ESCORT"]],
                                        on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_df = pd.merge(merged_df, comment_df[["Room_Number", "Arrival", "Depart", "FEEDBACK/COMMENT"]],
                                        on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_df = pd.merge(merged_df, request_df[["Room_Number", "Arrival", "Depart", "REQUEST"]],
                                    on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_collection.insert_many(merged_df.to_dict(orient="records"))
        print("IH with Escort, Comment, and Request data merged and stored successfully.")

    elif ih_data and escort_data and comment_data:
        escort_df = pd.DataFrame(escort_data)
        comment_df = pd.DataFrame(comment_data)
        ih_df = pd.DataFrame(ih_data)

        merged_df = pd.merge(ih_df, escort_df[["Room_Number", "Arrival", "Depart", "PURPOSE OF STAY", "ESCORT"]],
                                        on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_df = pd.merge(merged_df, comment_df[["Room_Number", "Arrival", "Depart", "FEEDBACK/COMMENT"]],
                                        on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_collection.insert_many(merged_df.to_dict(orient="records"))
        print("IH with Escort and Comment data merged and stored successfully.")

    elif ih_data and escort_data and request_data:
        escort_df = pd.DataFrame(escort_data)
        request_df = pd.DataFrame(request_data)
        ih_df = pd.DataFrame(ih_data)

        merged_df = pd.merge(ih_df, escort_df[["Room_Number", "Arrival", "Depart", "PURPOSE OF STAY", "ESCORT"]],
                                        on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_df = pd.merge(merged_df, request_df[["Room_Number", "Arrival", "Depart", "REQUEST"]],
                                    on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_collection.insert_many(merged_df.to_dict(orient="records"))
        print("IH with Escort and Request data merged and stored successfully.")
    
    elif ih_data and comment_data and request_data:
        comment_df = pd.DataFrame(comment_data)
        request_df = pd.DataFrame(request_data)
        ih_df = pd.DataFrame(ih_data)

        merged_df = pd.merge(ih_df, comment_df[["Room_Number", "Arrival", "Depart", "FEEDBACK/COMMENT"]],
                                        on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_df = pd.merge(merged_df, request_df[["Room_Number", "Arrival", "Depart", "REQUEST"]],
                                    on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_collection.insert_many(merged_df.to_dict(orient="records"))
        print("IH with Comment and Request data merged and stored successfully.")
    
    elif ih_data and escort_data:
        escort_df = pd.DataFrame(escort_data)
        ih_df = pd.DataFrame(ih_data)

        merged_df = pd.merge(ih_df, escort_df[["Room_Number", "Arrival", "Depart", "PURPOSE OF STAY", "ESCORT"]],
                                        on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_collection.insert_many(merged_df.to_dict(orient="records"))
        print("IH with Escort data merged and stored successfully.")
    
    elif ih_data and comment_data:
        comment_df = pd.DataFrame(comment_data)
        ih_df = pd.DataFrame(ih_data)

        merged_df = pd.merge(ih_df, comment_df[["Room_Number", "Arrival", "Depart", "FEEDBACK/COMMENT"]],
                                        on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_collection.insert_many(merged_df.to_dict(orient="records"))
        print("IH with Comment data merged and stored successfully.")
    
    elif ih_data and request_data:
        request_df = pd.DataFrame(request_data)
        ih_df = pd.DataFrame(ih_data)

        merged_df = pd.merge(ih_df, request_df[["Room_Number", "Arrival", "Depart", "REQUEST"]],
                                    on=["Room_Number", "Arrival", "Depart"], how="left")

        merged_collection.insert_many(merged_df.to_dict(orient="records"))
        print("IH with Request data merged and stored successfully.")
    else:
        print("No data to merge.")


with DAG("FoReport_file_processing", default_args=default_args, schedule_interval=None) as dag:
    etl_task_escort = PythonOperator(
        task_id="etl_process_escort",
        python_callable=etl_process_escort,
        dag=dag
    )

    etl_task_comment = PythonOperator(
        task_id="etl_process_comment",
        python_callable=etl_process_comment,
        dag=dag
    )

    etl_task_request = PythonOperator(
        task_id="etl_process_request",
        python_callable=etl_process_request,
        dag=dag
    )

    etl_task_FO = PythonOperator(
        task_id="etl_merge_FO",
        python_callable=etl_merge_FO,
        dag=dag
    )

    etl_task_escort >> etl_task_comment >> etl_task_request >> etl_task_FO
