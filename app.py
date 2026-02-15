import hashlib
import json
import os
import csv
import io
import re
import secrets
import sqlite3
import uuid
import zipfile
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

from flask import Flask, abort, jsonify, render_template, request, url_for
from markupsafe import escape

ANALYTICS_KEYS = (
    "sessions_total",
    "lists_created_total",
    "lists_with_places_total",
    "places_added_total",
    "share_links_created_total",
    "share_links_opened_total",
)

ANALYTICS_EVENTS = {
    "session_started": "sessions_total",
    "list_created": "lists_created_total",
    "list_became_non_empty": "lists_with_places_total",
    "place_added": "places_added_total",
    "share_link_created": "share_links_created_total",
    "share_link_opened": "share_links_opened_total",
}


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static")
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    db_path = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "data", "geonotion.db"))
    admin_token = os.environ.get("ADMIN_TOKEN")

    def get_db() -> sqlite3.Connection:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def ensure_db() -> None:
        with get_db() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS shares (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    password_hash TEXT,
                    password_salt TEXT
                )
                """
            )
            columns = {row["name"] for row in conn.execute("PRAGMA table_info(shares)")}
            if "password_hash" not in columns:
                conn.execute("ALTER TABLE shares ADD COLUMN password_hash TEXT")
            if "password_salt" not in columns:
                conn.execute("ALTER TABLE shares ADD COLUMN password_salt TEXT")

    def ensure_analytics() -> None:
        # Privacy-safe analytics: single-row counters only, no identifiers, no event logs.
        with get_db() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS analytics (
                    metric TEXT PRIMARY KEY,
                    count INTEGER NOT NULL
                )
                """
            )
            conn.executemany(
                "INSERT OR IGNORE INTO analytics (metric, count) VALUES (?, 0)",
                [(key,) for key in ANALYTICS_KEYS],
            )

    def increment_analytics(metric: str, amount: int = 1) -> None:
        if metric not in ANALYTICS_KEYS:
            return
        with get_db() as conn:
            conn.execute("UPDATE analytics SET count = count + ? WHERE metric = ?", (amount, metric))

    def hash_share_password(password: str, salt: str) -> str:
        return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000).hex()

    def read_share_password() -> str:
        return request.headers.get("X-Share-Password") or request.args.get("password") or ""

    def verify_share_password(row: sqlite3.Row) -> bool:
        stored_hash = row["password_hash"]
        if not stored_hash:
            return True
        supplied = read_share_password()
        if not supplied:
            return False
        salt = row["password_salt"] or ""
        candidate = hash_share_password(supplied, salt)
        return secrets.compare_digest(candidate, stored_hash)

    def read_analytics() -> dict:
        with get_db() as conn:
            rows = conn.execute("SELECT metric, count FROM analytics").fetchall()
        data = {key: 0 for key in ANALYTICS_KEYS}
        data.update({row["metric"]: row["count"] for row in rows})
        return data

    def is_admin_request() -> bool:
        if not admin_token:
            return False
        supplied = request.headers.get("X-Admin-Token") or request.args.get("token") or ""
        return secrets.compare_digest(supplied, admin_token)

    def render_markdown(text: str) -> str:
        if not text:
            return "<p>Changelog is unavailable right now.</p>"

        lines = text.splitlines()
        html_parts = []
        in_list = False
        paragraph = []

        def flush_paragraph():
            nonlocal paragraph
            if paragraph:
                content = " ".join(paragraph).strip()
                if content:
                    html_parts.append(f"<p>{format_inline_markdown(content)}</p>")
                paragraph = []

        def close_list():
            nonlocal in_list
            if in_list:
                html_parts.append("</ul>")
                in_list = False

        def format_inline_markdown(value: str) -> str:
            safe = escape(value)
            safe = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", safe)
            safe = re.sub(r"`(.+?)`", r"<code>\1</code>", safe)
            return safe

        for raw_line in lines:
            line = raw_line.rstrip()
            stripped = line.strip()

            if not stripped:
                flush_paragraph()
                close_list()
                continue

            if stripped.startswith("### "):
                flush_paragraph()
                close_list()
                html_parts.append(f"<h4>{format_inline_markdown(stripped[4:])}</h4>")
                continue
            if stripped.startswith("## "):
                flush_paragraph()
                close_list()
                html_parts.append(f"<h3>{format_inline_markdown(stripped[3:])}</h3>")
                continue
            if stripped.startswith("# "):
                flush_paragraph()
                close_list()
                html_parts.append(f"<h2>{format_inline_markdown(stripped[2:])}</h2>")
                continue

            if stripped.startswith("- ") or stripped.startswith("— "):
                flush_paragraph()
                if not in_list:
                    html_parts.append("<ul>")
                    in_list = True
                html_parts.append(f"<li>{format_inline_markdown(stripped[2:])}</li>")
                continue

            paragraph.append(stripped)

        flush_paragraph()
        close_list()

        return "\n".join(html_parts)

    def parse_float(value):
        try:
            return float(str(value).strip())
        except (TypeError, ValueError):
            return None

    def build_place(lat, lng, title="Untitled", note="", address=""):
        return {
            "id": uuid.uuid4().hex,
            "title": (title or "Untitled").strip() or "Untitled",
            "lat": lat,
            "lng": lng,
            "note": note or "",
            "address": address or "",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }

    def parse_gpx_places(raw_bytes):
        root = ET.fromstring(raw_bytes)
        ns = {"gpx": "http://www.topografix.com/GPX/1/1"}
        points = root.findall(".//gpx:wpt", ns)
        if not points:
            points = root.findall(".//wpt")
        places = []
        for point in points:
            lat = parse_float(point.attrib.get("lat"))
            lng = parse_float(point.attrib.get("lon"))
            if lat is None or lng is None:
                continue
            name = point.findtext("gpx:name", default="", namespaces=ns) or point.findtext("name", default="")
            desc = point.findtext("gpx:desc", default="", namespaces=ns) or point.findtext("desc", default="")
            places.append(build_place(lat, lng, title=name or "GPX point", note=desc))
        return places

    def parse_csv_places(raw_bytes):
        text = raw_bytes.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            return []

        key_map = {name.strip().lower(): name for name in reader.fieldnames if name}
        lat_key = next((key_map.get(k) for k in ("latitude", "lat")), None)
        lng_key = next((key_map.get(k) for k in ("longitude", "lng", "lon")), None)
        title_key = next((key_map.get(k) for k in ("title", "name")), None)
        note_key = next((key_map.get(k) for k in ("note", "description", "desc")), None)
        address_key = next((key_map.get(k) for k in ("address", "location")), None)

        if not lat_key or not lng_key:
            return []

        places = []
        for row in reader:
            lat = parse_float(row.get(lat_key))
            lng = parse_float(row.get(lng_key))
            if lat is None or lng is None:
                continue
            title = row.get(title_key) if title_key else "CSV point"
            note = row.get(note_key) if note_key else ""
            address = row.get(address_key) if address_key else ""
            places.append(build_place(lat, lng, title=title, note=note, address=address))
        return places

    def parse_kml_places(kml_bytes):
        root = ET.fromstring(kml_bytes)
        ns = {"kml": "http://www.opengis.net/kml/2.2"}
        placemarks = root.findall(".//kml:Placemark", ns)
        if not placemarks:
            placemarks = root.findall(".//Placemark")
        places = []
        for placemark in placemarks:
            coords = (
                placemark.findtext(".//kml:Point/kml:coordinates", default="", namespaces=ns)
                or placemark.findtext(".//Point/coordinates", default="")
            )
            if not coords:
                continue
            first = coords.strip().split()[0]
            parts = [part.strip() for part in first.split(",")]
            if len(parts) < 2:
                continue
            lng = parse_float(parts[0])
            lat = parse_float(parts[1])
            if lat is None or lng is None:
                continue
            name = placemark.findtext("kml:name", default="", namespaces=ns) or placemark.findtext("name", default="")
            desc = placemark.findtext("kml:description", default="", namespaces=ns) or placemark.findtext("description", default="")
            places.append(build_place(lat, lng, title=name or "KML point", note=desc))
        return places

    def parse_kmz_places(raw_bytes):
        with zipfile.ZipFile(io.BytesIO(raw_bytes)) as archive:
            kml_name = next((name for name in archive.namelist() if name.lower().endswith(".kml")), None)
            if not kml_name:
                return []
            kml_bytes = archive.read(kml_name)
        return parse_kml_places(kml_bytes)

    ensure_db()
    ensure_analytics()

    @app.route("/api/health")
    def health():
        return {"status": "ok"}

    @app.route("/")
    def index():
        if request.args.get("share_id") or request.args.get("share"):
            increment_analytics("share_links_opened_total")
        return render_template("index.html")

    @app.route("/about")
    def about():
        changelog_path = os.path.join(BASE_DIR, "CHANGELOG.md")
        try:
            with open(changelog_path, "r", encoding="utf-8") as changelog_file:
                changelog_text = changelog_file.read()
        except OSError:
            changelog_text = "Changelog is unavailable right now."
        changelog_html = render_markdown(changelog_text)
        return render_template("about.html", changelog_html=changelog_html)

    @app.route("/admin/analytics")
    def admin_analytics():
        if not is_admin_request():
            abort(404)
        data = read_analytics()
        server_time = datetime.now(timezone.utc).isoformat()
        return render_template("admin_analytics.html", data=data, server_time=server_time)

    @app.route("/admin/analytics/data")
    def admin_analytics_data():
        if not is_admin_request():
            abort(404)
        data = read_analytics()
        return jsonify(data)

    @app.after_request
    def add_share_cache_headers(response):
        if request.path.startswith("/api/share"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        if request.path == "/static/sw.js":
            # Always revalidate service worker script to avoid stale PWA clients after deploy.
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            response.headers["Service-Worker-Allowed"] = "/"
        return response

    @app.post("/api/share")
    def create_share():
        payload = request.get_json(silent=True) or {}
        title = payload.get("title") or "My map"
        places = payload.get("places") or []
        share_id = uuid.uuid4().hex
        now = datetime.now(timezone.utc).isoformat()
        data = json.dumps({"title": title, "places": places})

        with get_db() as conn:
            conn.execute(
                "INSERT INTO shares (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (share_id, data, now, now),
            )

        increment_analytics("share_links_created_total")
        edit_url = url_for("index", _external=True, share_id=share_id, editable="1")
        view_url = url_for("index", _external=True, share_id=share_id)
        return jsonify({"id": share_id, "editUrl": edit_url, "viewUrl": view_url})

    @app.get("/api/share/<share_id>")
    def get_share(share_id: str):
        with get_db() as conn:
            row = conn.execute(
                "SELECT data, updated_at, password_hash, password_salt FROM shares WHERE id = ?",
                (share_id,),
            ).fetchone()
        if not row:
            abort(404)
        if not verify_share_password(row):
            return jsonify({"error": "password_required"}), 401
        data = json.loads(row["data"])
        return jsonify(
            {
                "id": share_id,
                "title": data.get("title") or "My map",
                "places": data.get("places") or [],
                "updatedAt": row["updated_at"],
            }
        )

    @app.get("/api/share/<share_id>/meta")
    def get_share_meta(share_id: str):
        with get_db() as conn:
            row = conn.execute(
                "SELECT data, updated_at, password_hash, password_salt FROM shares WHERE id = ?",
                (share_id,),
            ).fetchone()
        if not row:
            abort(404)
        if not verify_share_password(row):
            return jsonify({"error": "password_required"}), 401
        data = json.loads(row["data"])
        places = data.get("places") or []
        return jsonify(
            {
                "id": share_id,
                "updatedAt": row["updated_at"],
                "placesCount": len(places),
            }
        )

    @app.put("/api/share/<share_id>")
    def update_share(share_id: str):
        payload = request.get_json(silent=True) or {}
        title = payload.get("title") or "My map"
        places = payload.get("places") or []
        now = datetime.now(timezone.utc).isoformat()
        data = json.dumps({"title": title, "places": places})

        with get_db() as conn:
            row = conn.execute(
                "SELECT password_hash, password_salt FROM shares WHERE id = ?", (share_id,)
            ).fetchone()
            if not row:
                abort(404)
            if not verify_share_password(row):
                return jsonify({"error": "password_required"}), 401
            conn.execute("UPDATE shares SET data = ?, updated_at = ? WHERE id = ?", (data, now, share_id))

        return jsonify({"id": share_id, "updatedAt": now})

    @app.get("/api/share/<share_id>/password")
    def get_share_password_state(share_id: str):
        with get_db() as conn:
            row = conn.execute("SELECT password_hash FROM shares WHERE id = ?", (share_id,)).fetchone()
        if not row:
            abort(404)
        return jsonify({"hasPassword": bool(row["password_hash"])})

    @app.put("/api/share/<share_id>/password")
    def set_share_password(share_id: str):
        payload = request.get_json(silent=True) or {}
        password = (payload.get("password") or "").strip()
        if not password:
            abort(400)
        salt = secrets.token_hex(8)
        password_hash = hash_share_password(password, salt)
        with get_db() as conn:
            cursor = conn.execute("SELECT 1 FROM shares WHERE id = ?", (share_id,))
            if not cursor.fetchone():
                abort(404)
            conn.execute(
                "UPDATE shares SET password_hash = ?, password_salt = ? WHERE id = ?",
                (password_hash, salt, share_id),
            )
        return jsonify({"ok": True})

    @app.delete("/api/share/<share_id>/password")
    def delete_share_password(share_id: str):
        with get_db() as conn:
            cursor = conn.execute("SELECT 1 FROM shares WHERE id = ?", (share_id,))
            if not cursor.fetchone():
                abort(404)
            conn.execute(
                "UPDATE shares SET password_hash = NULL, password_salt = NULL WHERE id = ?",
                (share_id,),
            )
        return jsonify({"ok": True})

    @app.post("/api/analytics/event")
    def analytics_event():
        # Accept only whitelisted events and increment aggregated counters.
        payload = request.get_json(silent=True) or {}
        event = payload.get("event")
        metric = ANALYTICS_EVENTS.get(event)
        if not metric:
            abort(400)
        increment_analytics(metric)
        return jsonify({"ok": True})

    @app.post("/api/import")
    def import_file():
        uploaded = request.files.get("file")
        if not uploaded or not uploaded.filename:
            return jsonify({"ok": False, "error": "File is required"}), 400

        extension = os.path.splitext(uploaded.filename)[1].lower()
        if extension not in {".gpx", ".csv", ".kmz"}:
            return jsonify({"ok": False, "error": "Unsupported file format"}), 400

        try:
            raw_bytes = uploaded.read()
            if extension == ".gpx":
                places = parse_gpx_places(raw_bytes)
            elif extension == ".csv":
                places = parse_csv_places(raw_bytes)
            else:
                places = parse_kmz_places(raw_bytes)
        except (ET.ParseError, zipfile.BadZipFile, UnicodeDecodeError, ValueError):
            return jsonify({"ok": False, "error": "We couldn’t process this file. Please try again."}), 400

        if not places:
            return jsonify({"ok": False, "error": "No points found in file"}), 400

        list_title = os.path.splitext(uploaded.filename)[0].strip() or "Imported map"
        return jsonify(
            {
                "ok": True,
                "list_id": uuid.uuid4().hex,
                "list_title": list_title,
                "counts": {"places": len(places), "routes": 0},
                "places": places,
            }
        )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=5600)
