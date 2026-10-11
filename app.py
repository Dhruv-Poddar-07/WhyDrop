from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from detective import analyze

app = Flask(__name__)
CORS(app)


@app.route("/analyze", methods=["POST"])
def analyze_file():
    file = request.files.get("file")

    if file is None:
        return jsonify({"error": "No file received."}), 400

    if not file.filename.lower().endswith(".xlsx"):
        return jsonify({"error": "Please upload an Excel (.xlsx) file."}), 400

    try:
        df = pd.read_excel(file)
    except Exception:
        return jsonify({"error": "Could not read the Excel file."}), 400

    needed = ["date", "region", "category", "revenue"]
    missing = [c for c in needed if c not in df.columns]
    if missing:
        return jsonify({"error": "Missing columns: " + ", ".join(missing)}), 400

    result = analyze(df)
    return jsonify(result)


if __name__ == "__main__":
    app.run(port=5000, debug=True)