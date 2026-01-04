import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone

from flask import Flask, abort, jsonify, render_template, request, url_for

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
                    updated_at TEXT NOT NULL
                )
                """
            )

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
        return render_template("about.html", changelog_text=changelog_text)

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
            row = conn.execute("SELECT data, updated_at FROM shares WHERE id = ?", (share_id,)).fetchone()
        if not row:
            abort(404)
        data = json.loads(row["data"])
        return jsonify(
            {
                "id": share_id,
                "title": data.get("title") or "My map",
                "places": data.get("places") or [],
                "updatedAt": row["updated_at"],
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
            cursor = conn.execute("SELECT 1 FROM shares WHERE id = ?", (share_id,))
            if not cursor.fetchone():
                abort(404)
            conn.execute("UPDATE shares SET data = ?, updated_at = ? WHERE id = ?", (data, now, share_id))

        return jsonify({"id": share_id, "updatedAt": now})

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

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=5600)
