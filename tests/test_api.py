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


def test_https_email_provider(monkeypatch):
    import httpx
    from app.services import email_service

    monkeypatch.setattr(email_service.settings, "resend_api_key", "test-only")
    monkeypatch.setattr(email_service.settings, "email_from", "sender@example.com")

    def accept(url, *, headers, json, timeout):
        assert url == "https://api.resend.com/emails"
        assert headers["Authorization"] == "Bearer test-only"
        assert json["to"] == ["parent@example.com"]
        assert json["from"] == "sender@example.com"
        assert json["subject"] == "Missed dose"
        return httpx.Response(200, json={"id": "test-id"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(email_service.httpx, "post", accept)
    assert email_service.send_raw_email("parent@example.com", "Missed dose", "Demo")
    monkeypatch.setattr(email_service.settings, "email_from", "")
    assert not email_service.send_raw_email("parent@example.com", "Missed dose", "Demo")
