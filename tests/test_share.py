import pytest

from app import create_app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    app = create_app()
    app.config.update(TESTING=True)
    return app.test_client()


def test_share_updates_and_meta(client):
    create_resp = client.post(
        "/api/share",
        json={
            "title": "My map",
            "places": [{"id": "p1", "title": "A", "lat": 1.0, "lng": 2.0}],
        },
    )
    assert create_resp.status_code == 200
    share_id = create_resp.get_json()["id"]

    first_resp = client.get(f"/api/share/{share_id}")
    assert first_resp.status_code == 200
    first_data = first_resp.get_json()
    assert len(first_data["places"]) == 1

    update_resp = client.put(
        f"/api/share/{share_id}",
        json={
            "title": "My map",
            "places": [
                {"id": "p1", "title": "A", "lat": 1.0, "lng": 2.0},
                {"id": "p2", "title": "B", "lat": 3.0, "lng": 4.0},
            ],
        },
    )
    assert update_resp.status_code == 200

    second_resp = client.get(f"/api/share/{share_id}")
    assert second_resp.status_code == 200
    second_data = second_resp.get_json()
    assert len(second_data["places"]) == 2
    assert any(place.get("title") == "B" for place in second_data["places"])
    assert second_data["updatedAt"] != first_data["updatedAt"]

    meta_resp = client.get(f"/api/share/{share_id}/meta")
    assert meta_resp.status_code == 200
    meta = meta_resp.get_json()
    assert meta["placesCount"] == 2
    assert meta["updatedAt"] == second_data["updatedAt"]


def test_share_cache_headers(client):
    create_resp = client.post(
        "/api/share",
        json={"title": "My map", "places": [{"id": "p1", "title": "A", "lat": 1, "lng": 2}]},
    )
    share_id = create_resp.get_json()["id"]
    response = client.get(f"/api/share/{share_id}")
    cache_control = response.headers.get("Cache-Control", "")
    assert "no-store" in cache_control
