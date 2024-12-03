from airflow import DAG
from airflow.operators.python import PythonOperator
from pymongo import MongoClient
import pandas as pd
from datetime import datetime, timedelta

# MongoDB Connection
MONGO_URI = "mongodb+srv://valentinuswastu:valent1602@cluster0.18jylse.mongodb.net/"
DB_NAME = "Pulang2"

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

def fetch_and_merge():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    # Fetch all cleaned data
    cleaned_data = list(db.FRModel.find())
    cleaned_df = pd.DataFrame(cleaned_data)

    if cleaned_df.empty:
        print("No data found in FRModel.")
        return

    # Remove duplicates
    merged_df = cleaned_df.drop_duplicates(subset=['Name', 'Guest_No'])

    # Save deduplicated data to 'etl_data'
    db.etl_data.delete_many({})
    db.etl_data.insert_many(merged_df.to_dict('records'))
    print("ETL process completed: Data merged and stored in 'etl_data'.")

with DAG(
    'hotel_etl_dag',
    default_args=default_args,
    description='Merge and deduplicate cleaned CSV data',
    schedule_interval='@daily',
    start_date=datetime(2024, 1, 1),
    catchup=False,
) as dag:

    etl_task = PythonOperator(
        task_id='fetch_and_merge',
        python_callable=fetch_and_merge,
    )

etl_task
