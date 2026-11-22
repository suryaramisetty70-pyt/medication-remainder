from fastapi.testclient import TestClient

from app.main import app


def test_health_check():
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_openapi_includes_alert_workflow():
    paths = TestClient(app).get("/openapi.json").json()["paths"]
    assert "/api/notifications" in paths
    assert "/api/parent/dashboard/stats" in paths
    assert "/api/child/medicines/today" in paths
