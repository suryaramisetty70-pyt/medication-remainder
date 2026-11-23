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


def test_gmail_https_provider(monkeypatch):
    import base64
    from email import message_from_bytes
    import httpx
    from app.services import email_service as mail
    for key, value in {"gmail_sender":"sender@example.com", "gmail_client_id":"test-client", "gmail_client_secret":"test-secret", "gmail_refresh_token":"test-refresh", "resend_api_key":"unused"}.items():
        monkeypatch.setattr(mail.settings, key, value)
    calls = []
    def post(url, **kwargs):
        calls.append(url)
        if url.endswith('/token'):
            assert kwargs['data']['grant_type'] == 'refresh_token'
            return httpx.Response(200, json={'access_token':'test-access'}, request=httpx.Request('POST',url))
        assert url == 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
        assert kwargs['headers']['Authorization'] == 'Bearer test-access'
        msg = message_from_bytes(base64.urlsafe_b64decode(kwargs['json']['raw']))
        assert msg['To'] == 'parent@example.com'
        assert msg['Subject'] == 'Missed dose'
        assert msg.is_multipart()
        return httpx.Response(200, json={'id':'accepted'}, request=httpx.Request('POST',url))
    monkeypatch.setattr(mail.httpx, 'post', post)
    assert mail.send_raw_email('parent@example.com','Missed dose','Test notice')
    assert len(calls) == 2
    assert TestClient(app).get('/api/health').json()['email_provider'] == 'gmail'
