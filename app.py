from flask import Flask, render_template, jsonify, request
import pandas as pd
import os

app = Flask(__name__)

# --- CORRECCIÓN AQUÍ ---
# Obtiene la carpeta donde vive app.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Construye la ruta de forma segura sin importar el sistema operativo
CSV_PATH = os.path.join(BASE_DIR, 'data', 'tarifas_limpias.csv')

# Cargar CSV
try:
    df = pd.read_csv(CSV_PATH)
    df.columns = df.columns.str.strip().str.lower()
    print(f"✅ Base de datos cargada correctamente desde: {CSV_PATH}")
except FileNotFoundError:
    print(f"❌ ERROR: No se encontró el archivo en: {CSV_PATH}")
    df = pd.DataFrame() # Evita que el servidor se caiga si no encuentra el archivo
# -----------------------

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/precio", methods=["GET"])
def get_precio():
    caseta = request.args.get("caseta", "").strip().lower()
    tipo = request.args.get("tipo", "").strip().lower()

    if df.empty:
        return jsonify({"error": "Base de datos no disponible"}), 500

    resultado = df[
        (df["casetas"].astype(str).str.lower() == caseta) &
        (df["tipo_vehiculo"].astype(str).str.lower() == tipo)
    ]

    if not resultado.empty:
        return jsonify({"costo": float(resultado.iloc[0]["costo"])})

    return jsonify({"error": "No encontrado"}), 404

if __name__ == "__main__":
    app.run(debug=True)