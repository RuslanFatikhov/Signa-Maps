import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone

from flask import Flask, abort, jsonify, render_template, request, url_for


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static")
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    db_path = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "data", "geonotion.db"))

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

    ensure_db()

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/about")
    def about():
        return render_template("about.html")

    @app.route("/api/health")
    def health():
        return {"status": "ok"}

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

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=5600)
