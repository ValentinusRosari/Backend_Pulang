from flask import Flask, render_template, request, jsonify
from pymongo import MongoClient
from openai import OpenAI
import json
import math
from bson import ObjectId
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


# Custom JSON encoder to handle NaN, Infinity, and ObjectId
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, float):
            if math.isnan(obj):
                return "NaN"  # Convert to string representation
            elif math.isinf(obj):
                return "Infinity" if obj > 0 else "-Infinity"
        return super(CustomJSONEncoder, self).default(obj)


# Configure Flask to use the custom JSON encoder
app.json_encoder = CustomJSONEncoder

# Initialize OpenAI client
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Connect to MongoDB
mongo_client = MongoClient(MONGO_URI)
db = mongo_client["Pulang2"]
data_collection = db["etl_merged_ih&fr"]
memory_collection = db["knowledge_openai"]

# Ensure text index exists
try:
    memory_collection.create_index([("question", "text")])
except Exception as e:
    print(f"Index error (may already exist): {e}")

# Database schema explanation
dbexplanation = """
The MongoDB collection "etl_merged_ih&fr" is the merged version from ih (related to reservation) and fr (related to guest profiles) collections contains documents with the following fields:
- _id: Ignore this field
- _id_ih: Ignore this field
- Name: The name of the guest
- Arrival: The date of arrival (check-in)
- Depart: The date of departure (check-out)
- Room_Number: The room number assigned to the guest (the first two number are the floor number, 'A' is code for mountain-view or bay-window room, 'B' is code for city-view room or balcony room)
- In_House_Date: Ignore this field
- Room_Type: The room type of the room number (for type starts with 'D' are 'Deluxe',
                                                                    'E' and 'B' are 'Executive Suite' (previously we code it as 'B' and changed it to 'E'),
                                                                    'J' and 'S' are 'Suite' (previously we code it as 'J' and changed it to 'S'),
                                                                    'F' are 'Family Suite'.
                                                                    To ease interpretation (since we did code changes) the most recent one Room Type will be used depends on the Room Number (use the first letter). The user might use the room type name instead of the room type code be careful on it.
                                                the following letter also have meaning 'K' is King bed,
                                                                                       'T' is Twin bed,     
                                                )
- Arrangement: The kind of reservation arranged ('RO' is Room only, 'RB' is Room with breakfast)
- Guest_No_ih: Ignore this field
- Age: the age of the guest when visiting
- Local Region: It contains Region code and City name of the guest 
- Room_Rate: Price paid by the guest include tax and service
- Lodging: Ignore this field
- Breakfast: Ignore this field
- Bill_Number: Ignore this field
- Pay_Article: Ignore this field
- Res_No: Ignore this field
- Adult: Number of adult in the room
- Child: Number of child in the room
- Nat_ih: Ignore this field
- Company_TA: The company or travel agent name of the guest
- SOB: The source of the booking
- Night: Night spend by the guest
- CI_Time: Time the guest check-in
- CO_Time: Time the guest check-out
- Segment_ih: The guest segmentation while reserve ('COMP' is compliment,
                                                    'COR-FIT' is corporate individual,
                                                    'COR-GROUP' is corporate group,
                                                    'FIT' is foreign individual traveller,
                                                    'GOV-FIT' is government individual,
                                                    'GOV-GROUP' is government group,
                                                    'HU' is house use,
                                                    'LGSTAY' is long stay,
                                                    'OTA' is online travel agent,
                                                    'TA' is travel agent,
                                                    'WEB' is website,
                                                    'WIG' is walk-in guest
                                                    )
- Created: The date the guest made the reservation
- By: Ignore this field
- remarks: Contain notes about the reservation
- visitor_number: Ignore this field
- visitor_category: Ignore this field 
- _id_fr: Ignore this field
- Guest_No_fr: Ignore this field
- Segment_fr: Ignore this field
- Type_ID: The ID card type
- ID_No: The ID number
- Address: The guest's address
- City: Ignore this field
- Nat_fr: The guest's nationality
- Country: Ignore this field
- L_Region: Ignore this field
- Sex: The guest gender
- Birth_Date: The guest's birth date
- Email: The guest's email
- Comments: Notes about the guest
- Occupation: The guest's occupation
- Mobile_Phone: The guest's mobile phone number
"""

# OpenAI roles
querygeneration = "You are an expert at converting natural language questions into MongoDB queries in JSON format."
querycorrectorrole = "You are an expert at converting user instructions into MongoDB query in JSON format"


# Helper function to sanitize values for JSON
def sanitize_for_json(obj):
    """
    Recursively process a Python object to make it JSON serializable.
    Handles NaN, Infinity, and other special cases.
    """
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(i) for i in obj]
    elif isinstance(obj, float):
        if math.isnan(obj):
            return "NaN"  # Convert to string representation
        elif math.isinf(obj):
            return "Infinity" if obj > 0 else "-Infinity"
        return obj
    elif isinstance(obj, ObjectId):
        return str(obj)
    else:
        return obj


# Memory helper functions
def retrieve_memory_examples(question, limit=3):
    """
    Retrieve the most relevant past Q&A examples for the given question.
    """
    try:
        examples = list(
            memory_collection.find({"$text": {"$search": question}}).limit(limit)
        )
        # Sanitize values for JSON
        return sanitize_for_json(examples)
    except Exception as e:
        print(f"Error retrieving memory: {e}")
        return []


def store_memory_example(question, corrected_query):
    """
    Store the user-corrected query along with the original question into the memory collection.
    """
    try:
        memory_collection.insert_one(
            {"question": question, "corrected_query": corrected_query}
        )
        return True
    except Exception as e:
        print(f"Error saving memory: {e}")
        return False


# Query generation function
def generate_query(question, memory_examples=None):
    """
    Build a prompt that includes previous corrections (if any) and ask OpenAI
    to generate a MongoDB query for the question.
    """
    examples_text = ""
    if memory_examples:
        examples_text += "Below are previous corrections for similar queries:\n"
        for ex in memory_examples:
            examples_text += f"Question: {ex['question']}\nCorrect Query: {json.dumps(ex['corrected_query'], indent=2)}\n\n"

    prompt = f"""
{querygeneration}
{dbexplanation}
{examples_text}

Convert the following question into a valid MongoDB query. The output should be valid JSON that is either:
- a JSON object representing a query for collection.find(), or
- a JSON array representing an aggregation pipeline for collection.aggregate().
Do not include any additional commentary.
Question: "{question}"
    """

    try:
        response = openai_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o-mini",
            temperature=0.2,
        )
        text = response.choices[0].message.content.strip()

        # Remove markdown formatting if present
        if text.startswith("```json"):
            text = text.replace("```json", "").strip()
        if text.endswith("```"):
            text = text[:-3].strip()

        # Parse into Python object
        query_obj = json.loads(text)
        return query_obj
    except Exception as e:
        print(f"Error generating or parsing query: {e}")
        return None


def translate_plain_text_feedback(feedback_text):
    """
    Convert plain text feedback into a valid MongoDB query correction in JSON format.
    """
    translation_prompt = f"""
{querycorrectorrole}
{dbexplanation}

The user provided the following instruction to correct a query:
"{feedback_text}"

Convert the following instruction into a valid MongoDB query. The output should be valid JSON that is either:
- a JSON object representing a query for collection.find(), or
- a JSON array representing an aggregation pipeline for collection.aggregate().
Do not include any additional commentary.
    """

    try:
        response = openai_client.chat.completions.create(
            messages=[{"role": "user", "content": translation_prompt}],
            model="gpt-4o-mini",
            temperature=0.2,
        )
        text = response.choices[0].message.content.strip()

        # Remove any markdown formatting
        if text.startswith("```json"):
            text = text.replace("```json", "").strip()
        if text.endswith("```"):
            text = text[:-3].strip()

        corrected_query = json.loads(text)
        return corrected_query
    except Exception as e:
        print(f"Error translating plain text feedback: {e}")
        return None


def execute_query(query_obj):
    """
    Execute a MongoDB query and return the results.
    """
    try:
        if isinstance(query_obj, list):
            # Assume it's an aggregation pipeline
            result = list(data_collection.aggregate(query_obj))
        elif isinstance(query_obj, dict):
            # Assume it's a simple query for collection.find()
            result = list(data_collection.find(query_obj))
        else:
            return None

        # Sanitize values for JSON
        return sanitize_for_json(result)
    except Exception as e:
        print(f"Error executing query: {e}")
        return None


def generate_explanation(question, query_obj, results):
    """
    Generate a natural language explanation of the query results.
    """
    result_count = len(results) if results else 0
    result_snippet = str(results[:2]) if results else "No results"

    explanation_prompt = f"""
    You are an expert database analyst explaining MongoDB query results in simple language.
    
    Question from user: "{question}"
    
    MongoDB query used: {json.dumps(query_obj, indent=2)}
    
    Results: Found {result_count} documents.
    Sample results: {result_snippet}
    
    Please provide a brief, clear explanation of these results in natural language.
    Explain what the query looked for and summarize what was found in 2-3 sentences.
    Make your explanation helpful and easy to understand for someone who doesn't know MongoDB.
    """

    try:
        response = openai_client.chat.completions.create(
            messages=[{"role": "user", "content": explanation_prompt}],
            model="gpt-4o-mini",
            temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating explanation: {e}")
        return f"Found {result_count} results matching your query."


@app.route("/")
def index():
    """Render the main page"""
    return render_template("index.html")


@app.route("/api/generate_query", methods=["POST"])
def api_generate_query():
    """API endpoint to generate a MongoDB query from a natural language question"""
    data = request.json
    question = data.get("question", "")

    # Retrieve memory examples
    memory_examples = retrieve_memory_examples(question)

    # Generate the query
    query_obj = generate_query(question, memory_examples)

    if query_obj is None:
        return (
            jsonify({"success": False, "error": "Failed to generate a valid query."}),
            400,
        )

    # Execute the query
    result = execute_query(query_obj)

    # Generate natural language explanation
    explanation = generate_explanation(question, query_obj, result)

    # Return the query, result and explanation
    return jsonify(
        {
            "success": True,
            "question": question,
            "query": query_obj,
            "result": result,
            "resultCount": len(result) if result else 0,
            "explanation": explanation,
        }
    )


@app.route("/api/correct_query", methods=["POST"])
def api_correct_query():
    """API endpoint to process a correction from the admin panel"""
    data = request.json
    question = data.get("question", "")
    feedback = data.get("feedback", "")
    is_confirm = data.get("isConfirm", False)

    # If this is just confirming a previous correction
    if is_confirm:
        corrected_query = data.get("correctedQuery")
        if corrected_query:
            success = store_memory_example(question, corrected_query)
            return jsonify(
                {
                    "success": success,
                    "message": (
                        "Correction saved to memory."
                        if success
                        else "Failed to save correction."
                    ),
                }
            )
        else:
            return (
                jsonify({"success": False, "error": "No corrected query provided."}),
                400,
            )

    # Process the feedback text
    try:
        # Try parsing as JSON first
        corrected_query = json.loads(feedback)
    except:
        # If not valid JSON, treat as plain text
        corrected_query = translate_plain_text_feedback(feedback)

    if corrected_query is None:
        return (
            jsonify(
                {"success": False, "error": "Could not parse or translate feedback."}
            ),
            400,
        )

    # Execute the corrected query
    result = execute_query(corrected_query)

    # Generate natural language explanation for the corrected query
    explanation = generate_explanation(question, corrected_query, result)

    # Return the corrected query, result, and explanation
    return jsonify(
        {
            "success": True,
            "question": question,
            "correctedQuery": corrected_query,
            "result": result,
            "resultCount": len(result) if result else 0,
            "explanation": explanation,
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
