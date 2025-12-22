GeoNotion
========

Minimal Flask + HTML/CSS/JS app to collect map spots in the browser cache. Click the map, save places, and manage them locally (no backend storage).

Quickstart
----------

1) Create a virtualenv (optional) and install deps:
```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2) Run the server:
```
python app.py
```
Open http://127.0.0.1:5000/ in the browser.

Notes
-----
- Data is stored in `localStorage`, so it stays in the browser.
- Map uses MapLibre + OpenStreetMap tiles (no token needed); needs network when you run it.
- Health check is available at `/api/health`.
# Signa-Maps
