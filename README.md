# GPS MX — Proyecto Flask

## Instalación

```bash
pip install -r requirements.txt
```

## Ejecutar

```bash
python app.py
```

Luego abre tu navegador en: http://127.0.0.1:5000

## Estructura

```
GPS_P/
├── app.py                  # Servidor Flask
├── requirements.txt        # Dependencias
├── README.md
├── templates/
│   └── index.html          # Interfaz principal (Jinja2)
└── static/
    ├── css/
    │   └── style.css       # Estilos
    └── js/
        ├── data.js         # Casetas CAPUFE 2024 + Zonas riesgo SESNSP
        ├── algorithms.js   # A*, Manhattan, Costo Uniforme, Genético
        └── app.js          # Lógica del mapa e interacciones
```

## Características

- Autocompletado de 80+ ciudades mexicanas
- Geolocalización (usa tu ubicación actual)
- 4 algoritmos de búsqueda de ruta
- Casetas con tarifas reales CAPUFE 2024
- Zonas de riesgo basadas en SESNSP 2023-2024
- Embotellamientos simulados
- Cálculo de combustible y costo
- Rutas alternativas
- Zonas horarias de México
- Aviso de gasolina baja
