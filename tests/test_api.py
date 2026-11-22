import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.dose_log import DoseLog, DoseStatus
from app.models.medication import Medication
from app.models.user import User, UserRole

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_docs(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "Smart Medication Reminder API"


def test_login_and_refresh(client):
    # Register parent
    client.post(
        "/api/auth/register/parent",
        json={"name": "Alice", "email": "alice@test.com", "password": "securepassword"},
    )

    # Login with right password
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "alice@test.com", "password": "securepassword"},
    )
    assert login_resp.status_code == 200
    tokens = login_resp.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    # Login with wrong password
    bad_login = client.post(
        "/api/auth/login",
        json={"email": "alice@test.com", "password": "wrongpassword"},
    )
    assert bad_login.status_code == 401

    # Refresh token
    refresh_resp = client.post(f"/api/auth/refresh?refresh_token={tokens['refresh_token']}")
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()
    assert "access_token" in new_tokens

    # Refresh with invalid token
    bad_refresh = client.post("/api/auth/refresh?refresh_token=invalid-token")
    assert bad_refresh.status_code == 401


def test_child_registration_invalid_family(client):
    resp = client.post(
        "/api/auth/register/child",
        json={
            "name": "Ghost",
            "email": "ghost@test.com",
            "password": "pass",
            "family_id": "FAM-NONEXISTENT",
        },
    )
    assert resp.status_code == 404


def test_full_auth_and_family_flow(client):
    # 1. Register Parent
    parent_resp = client.post(
        "/api/auth/register/parent",
        json={
            "name": "Jane Doe",
            "email": "jane@example.com",
            "password": "Password123!",
        },
    )
    assert parent_resp.status_code == 201
    parent_tokens = parent_resp.json()
    assert "access_token" in parent_tokens
    assert "refresh_token" in parent_tokens

    # Get parent details
    parent_headers = {"Authorization": f"Bearer {parent_tokens['access_token']}"}
    me_resp = client.get("/api/auth/me", headers=parent_headers)
    assert me_resp.status_code == 200
    parent_data = me_resp.json()
    family_id = parent_data["family_id"]
    assert family_id.startswith("FAM-")

    # 2. Register Child under same family code
    child_resp = client.post(
        "/api/auth/register/child",
        json={
            "name": "Tommy Doe",
            "email": "tommy@example.com",
            "password": "ChildPassword123!",
            "family_id": family_id,
        },
    )
    assert child_resp.status_code == 201
    child_tokens = child_resp.json()
    child_headers = {"Authorization": f"Bearer {child_tokens['access_token']}"}

    # Verify child profile
    child_me = client.get("/api/auth/me", headers=child_headers).json()
    assert child_me["role"] == "child"
    assert child_me["family_id"] == family_id
    child_id = child_me["id"]

    # 3. Verify Family Members list
    fam_resp = client.get("/api/family/members", headers=parent_headers)
    assert fam_resp.status_code == 200
    members = fam_resp.json()
    assert len(members) == 2

    # 4. Set Alert Email
    alert_resp = client.put(
        "/api/family/alert-email",
        headers=parent_headers,
        json={"alert_email": "alerts@parent.com"},
    )
    assert alert_resp.status_code == 200
    assert alert_resp.json()["alert_email"] == "alerts@parent.com"

    # 5. Parent creates medication for child
    med_resp = client.post(
        "/api/medications",
        headers=parent_headers,
        json={
            "child_id": child_id,
            "name": "Amoxicillin",
            "dosage": "250mg",
            "scheduled_time": "08:00:00",
            "notes": "Take after breakfast",
        },
    )
    assert med_resp.status_code == 201
    med_data = med_resp.json()
    med_id = med_data["id"]
    assert med_data["name"] == "Amoxicillin"

    # Update medication
    patch_med = client.patch(
        f"/api/medications/{med_id}",
        headers=parent_headers,
        json={"dosage": "500mg"},
    )
    assert patch_med.status_code == 200
    assert patch_med.json()["dosage"] == "500mg"

    # 6. Child lists own medications
    child_meds = client.get(f"/api/medications/child/{child_id}", headers=child_headers)
    assert child_meds.status_code == 200
    assert len(child_meds.json()) == 1

    # 7. Child creates a Dose Log for alarm
    now_iso = datetime.now(timezone.utc).isoformat()
    dose_resp = client.post(
        "/api/doses",
        headers=child_headers,
        json={
            "medication_id": med_id,
            "scheduled_for": now_iso,
        },
    )
    assert dose_resp.status_code == 201
    dose_data = dose_resp.json()
    assert dose_data["status"] == "pending"
    dose_id = dose_data["id"]

    # 8. Child marks dose as taken
    resp_dose = client.patch(
        f"/api/doses/{dose_id}",
        headers=child_headers,
        json={"status": "taken"},
    )
    assert resp_dose.status_code == 200
    assert resp_dose.json()["status"] == "taken"

    # 9. Check adherence analytics
    stats_resp = client.get(f"/api/analytics/adherence/{child_id}", headers=parent_headers)
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total_doses"] == 1
    assert stats["taken"] == 1
    assert stats["missed"] == 0
    assert stats["adherence_rate"] == 100.0

    # 10. Check adherence timeline
    timeline_resp = client.get(f"/api/analytics/adherence/{child_id}/timeline", headers=parent_headers)
    assert timeline_resp.status_code == 200
    assert len(timeline_resp.json()) == 1

    # 11. Delete medication
    del_resp = client.delete(f"/api/medications/{med_id}", headers=parent_headers)
    assert del_resp.status_code == 204


def test_cross_family_security_isolation(client):
    # Register Family 1 (Parent A + Child A)
    p1 = client.post(
        "/api/auth/register/parent",
        json={"name": "Parent A", "email": "pa@example.com", "password": "pass"},
    ).json()
    p1_headers = {"Authorization": f"Bearer {p1['access_token']}"}
    p1_me = client.get("/api/auth/me", headers=p1_headers).json()

    c1 = client.post(
        "/api/auth/register/child",
        json={"name": "Child A", "email": "ca@example.com", "password": "pass", "family_id": p1_me["family_id"]},
    ).json()
    c1_headers = {"Authorization": f"Bearer {c1['access_token']}"}
    c1_me = client.get("/api/auth/me", headers=c1_headers).json()

    # Register Family 2 (Parent B)
    p2 = client.post(
        "/api/auth/register/parent",
        json={"name": "Parent B", "email": "pb@example.com", "password": "pass"},
    ).json()
    p2_headers = {"Authorization": f"Bearer {p2['access_token']}"}

    # Family 1 creates medication
    med = client.post(
        "/api/medications",
        headers=p1_headers,
        json={
            "child_id": c1_me["id"],
            "name": "Vitamin D",
            "dosage": "1 drop",
            "scheduled_time": "09:00:00",
        },
    ).json()

    # SECURITY CHECK 1: Parent B cannot create medication for Child A
    unauth_med = client.post(
        "/api/medications",
        headers=p2_headers,
        json={
            "child_id": c1_me["id"],
            "name": "Unauthorized Med",
            "dosage": "100mg",
            "scheduled_time": "10:00:00",
        },
    )
    assert unauth_med.status_code == 404

    # SECURITY CHECK 2: Parent B cannot view Child A's medications
    unauth_view = client.get(f"/api/medications/child/{c1_me['id']}", headers=p2_headers)
    assert unauth_view.status_code == 404

    # SECURITY CHECK 3: Parent B cannot view Child A's dose logs
    unauth_logs = client.get(f"/api/doses/child/{c1_me['id']}", headers=p2_headers)
    assert unauth_logs.status_code == 404

    # SECURITY CHECK 4: Parent B cannot view Child A's analytics
    unauth_stats = client.get(f"/api/analytics/adherence/{c1_me['id']}", headers=p2_headers)
    assert unauth_stats.status_code == 404

    # SECURITY CHECK 5: Parent B cannot delete Child A's medication
    unauth_del = client.delete(f"/api/medications/{med['id']}", headers=p2_headers)
    assert unauth_del.status_code == 404


def test_overdue_dose_auto_escalation(client):
    # Setup parent + child
    p = client.post(
        "/api/auth/register/parent",
        json={"name": "Mom", "email": "mom@example.com", "password": "pass"},
    ).json()
    p_headers = {"Authorization": f"Bearer {p['access_token']}"}
    p_me = client.get("/api/auth/me", headers=p_headers).json()

    c = client.post(
        "/api/auth/register/child",
        json={"name": "Kid", "email": "kid@example.com", "password": "pass", "family_id": p_me["family_id"]},
    ).json()
    c_headers = {"Authorization": f"Bearer {c['access_token']}"}
    c_me = client.get("/api/auth/me", headers=c_headers).json()

    med = client.post(
        "/api/medications",
        headers=p_headers,
        json={
            "child_id": c_me["id"],
            "name": "Antibiotic",
            "dosage": "500mg",
            "scheduled_time": "12:00:00",
        },
    ).json()

    # Create a dose scheduled 45 minutes ago
    past_time = datetime.now(timezone.utc) - timedelta(minutes=45)
    dose = client.post(
        "/api/doses",
        headers=c_headers,
        json={
            "medication_id": med["id"],
            "scheduled_for": past_time.isoformat(),
        },
    ).json()

    # Process overdue doses with 30 min grace period
    overdue_resp = client.post("/api/doses/process-overdue?grace_period_minutes=30")
    assert overdue_resp.status_code == 200
    result = overdue_resp.json()
    assert result["processed_count"] == 1
    assert result["escalated_alerts"] == 1

    # Verify the dose status was marked missed
    logs = client.get(f"/api/doses/child/{c_me['id']}", headers=p_headers).json()
    assert logs[0]["status"] == "missed"
