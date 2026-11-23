import io
import os
import pytest
from datetime import datetime, date, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole
from app.models.relationship import ParentChildRelationship, RelationshipStatus
from app.models.medicine import Medicine, MedicineFrequency
from app.models.occurrence import MedicineOccurrence, OccurrenceStatus
from app.models.notification import Notification, NotificationType
from app.models.email_log import EmailLog, EmailStatus
from app.services.occurrence_service import generate_occurrences_for_medicine
from app.services.scheduler import check_and_update_occurrences

# Use separate test database
TEST_DB_URL = "sqlite:///./test_caresync.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()
    try:
        if os.path.exists("test_caresync.db"):
            os.remove("test_caresync.db")
    except Exception:
        pass


def test_01_signup_validation_and_creation():
    # Test weak password rejection
    bad_resp = client.post("/api/auth/signup", json={
        "name": "Test Parent",
        "email": "testparent@example.com",
        "password": "weak",
        "confirm_password": "weak",
        "role": "PARENT",
    })
    assert bad_resp.status_code == 422

    # Test valid signup
    resp = client.post("/api/auth/signup", json={
        "name": "Sarah Connor",
        "email": "sarah@example.com",
        "password": "Password#123",
        "confirm_password": "Password#123",
        "role": "PARENT",
        "phone": "+1 555-0199",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["user"]["email"] == "sarah@example.com"
    assert data["user"]["role"] == "PARENT"
    assert data["user"]["is_verified"] is False
    assert "access_token" in data

    # Test child signup
    resp_child = client.post("/api/auth/signup", json={
        "name": "John Connor",
        "email": "john@example.com",
        "password": "Password#123",
        "confirm_password": "Password#123",
        "role": "CHILD",
        "phone": "+1 555-0188",
    })
    assert resp_child.status_code == 201
    assert resp_child.json()["user"]["role"] == "CHILD"


def test_02_email_verification():
    db = TestingSessionLocal()
    sarah = db.query(User).filter(User.email == "sarah@example.com").first()
    assert sarah is not None

    token_rec = sarah.auth_tokens[0]
    token_str = token_rec.token
    db.close()

    resp = client.post("/api/auth/verify-email", json={"token": token_str})
    assert resp.status_code == 200
    assert "verified successfully" in resp.json()["message"]


def test_03_login_and_session():
    # Test valid login
    resp = client.post("/api/auth/login", json={
        "email": "sarah@example.com",
        "password": "Password#123",
        "remember_me": True,
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    assert "caresync_token" in resp.cookies

    # Test me endpoint
    token = resp.json()["access_token"]
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "sarah@example.com"


def test_04_parent_child_connection_flow():
    # Login as Parent Sarah
    p_login = client.post("/api/auth/login", json={"email": "sarah@example.com", "password": "Password#123"}).json()
    p_token = p_login["access_token"]

    # Send connection request to child John
    req_resp = client.post(
        "/api/relationships/parent/request",
        json={"child_email": "john@example.com"},
        headers={"Authorization": f"Bearer {p_token}"},
    )
    assert req_resp.status_code == 201

    # Login as Child John
    c_login = client.post("/api/auth/login", json={"email": "john@example.com", "password": "Password#123"}).json()
    c_token = c_login["access_token"]

    # Check pending connections for Child
    conn_list = client.get("/api/relationships/child/connections", headers={"Authorization": f"Bearer {c_token}"})
    assert conn_list.status_code == 200
    connections = conn_list.json()
    assert len(connections) >= 1
    rel_id = connections[0]["relationship_id"]
    assert connections[0]["status"] == "PENDING"

    # Child accepts connection
    accept_resp = client.post(
        "/api/relationships/child/respond",
        json={"relationship_id": rel_id, "action": "ACCEPT"},
        headers={"Authorization": f"Bearer {c_token}"},
    )
    assert accept_resp.status_code == 200
    assert "connected with Sarah" in accept_resp.json()["message"]


def test_05_medicine_management_and_occurrences():
    # Login as Parent Sarah
    p_login = client.post("/api/auth/login", json={"email": "sarah@example.com", "password": "Password#123"}).json()
    p_token = p_login["access_token"]

    db = TestingSessionLocal()
    john = db.query(User).filter(User.email == "john@example.com").first()
    child_id = john.id
    db.close()

    # Create Medicine
    med_resp = client.post(
        "/api/parent/medicines",
        json={
            "child_id": child_id,
            "name": "Vitamin D",
            "dosage": "1 Tablet (1000 IU)",
            "instructions": "Take after breakfast with water",
            "frequency": "DAILY",
            "times_of_day": "08:00",
            "start_date": str(date.today()),
            "notes": "Daily morning vitamin",
        },
        headers={"Authorization": f"Bearer {p_token}"},
    )
    assert med_resp.status_code == 201
    med_data = med_resp.json()
    assert med_data["name"] == "Vitamin D"

    # List medicines
    list_resp = client.get("/api/parent/medicines", headers={"Authorization": f"Bearer {p_token}"})
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1


def test_06_child_takes_medicine_and_uploads_proof():
    # Login as Child John
    c_login = client.post("/api/auth/login", json={"email": "john@example.com", "password": "Password#123"}).json()
    c_token = c_login["access_token"]

    # Get today's medicines
    today_resp = client.get("/api/child/medicines/today", headers={"Authorization": f"Bearer {c_token}"})
    assert today_resp.status_code == 200
    doses = today_resp.json()
    assert len(doses) >= 1
    occ_id = doses[0]["id"]

    # Upload Photo Proof
    fake_img = io.BytesIO(b"FakeImageDataPNGContent12345")
    upload_resp = client.post(
        f"/api/medicine-occurrences/{occ_id}/proof",
        files={"file": ("pill_taken.png", fake_img, "image/png")},
        data={"notes": "Took with breakfast"},
        headers={"Authorization": f"Bearer {c_token}"},
    )
    assert upload_resp.status_code == 200
    assert upload_resp.json()["status"] == "PENDING_VERIFICATION"
    assert upload_resp.json()["proof"] is not None


def test_07_parent_verifies_proof():
    # Login as Parent Sarah
    p_login = client.post("/api/auth/login", json={"email": "sarah@example.com", "password": "Password#123"}).json()
    p_token = p_login["access_token"]

    db = TestingSessionLocal()
    occ = db.query(MedicineOccurrence).first()
    occ_id = occ.id
    db.close()

    # Verify Proof
    verify_resp = client.post(
        f"/api/parent/confirmations/{occ_id}/verify",
        json={"notes": "Looks good!"},
        headers={"Authorization": f"Bearer {p_token}"},
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["status"] == "VERIFIED"


def test_08_missed_dose_detection_and_duplicate_prevention():
    db = TestingSessionLocal()
    sarah = db.query(User).filter(User.email == "sarah@example.com").first()
    john = db.query(User).filter(User.email == "john@example.com").first()
    med = db.query(Medicine).filter(Medicine.parent_id == sarah.id).first()

    # Create an artificial overdue occurrence
    past_sched = datetime.utcnow() - timedelta(minutes=60)
    past_grace = past_sched + timedelta(minutes=30)  # expired 30 mins ago

    missed_occ = MedicineOccurrence(
        medicine_id=med.id,
        child_id=john.id,
        parent_id=sarah.id,
        scheduled_time=past_sched,
        grace_until=past_grace,
        status=OccurrenceStatus.DUE,
    )
    db.add(missed_occ)
    db.commit()
    db.refresh(missed_occ)
    occ_id = missed_occ.id

    # Run scheduler check
    res = check_and_update_occurrences(db)
    assert res["missed_count"] >= 1

    # Check that status became MISSED
    db.refresh(missed_occ)
    assert missed_occ.status == OccurrenceStatus.MISSED

    # Verify EmailLog entry was recorded
    email_log = db.query(EmailLog).filter(EmailLog.reference_id == f"missed_occ_{occ_id}").first()
    assert email_log is not None

    # Run scheduler check a SECOND time (Idempotency test: must not duplicate)
    res2 = check_and_update_occurrences(db)
    assert res2["missed_count"] == 0  # Already MISSED, not processed again

    db.close()


def test_other_parent_cannot_manage_or_view_child():
    parent = client.post("/api/auth/signup", json={
        "name": "Other Parent", "email": "other@example.com", "role": "PARENT",
        "password": "Password#123", "confirm_password": "Password#123",
    }).json()
    headers = {"Authorization": "Bearer " + parent["access_token"]}
    with TestingSessionLocal() as db:
        child_id = db.query(User).filter_by(email="john@example.com").one().id
        medicine_id = db.query(Medicine).filter_by(child_id=child_id).first().id
    assert client.get("/api/parent/dashboard/stats", params={"child_id": child_id}, headers=headers).status_code == 404
    assert client.get(f"/api/parent/medicines/{medicine_id}", headers=headers).status_code == 404
    assert client.delete(f"/api/parent/medicines/{medicine_id}", headers=headers).status_code == 404
    response = client.post("/api/parent/medicines", headers=headers, json={
        "child_id": child_id, "name": "Demo", "dosage": "Demo", "times_of_day": "08:00",
    })
    assert response.status_code == 403


def test_email_without_credentials_reports_failure(monkeypatch):
    from app.core.config import settings
    from app.services.email_service import send_raw_email
    monkeypatch.setattr(settings, "smtp_username", "")
    assert send_raw_email("parent@example.com", "Alert", "Test message") is False


def test_missed_email_retries_with_same_key_after_restart(monkeypatch):
    import httpx
    from app.services import email_service as mail
    from app.models.email_log import PendingMissedEmail

    monkeypatch.setattr(mail.settings, "resend_api_key", "test-key")
    monkeypatch.setattr(mail.settings, "email_from", "sender@example.com")
    keys = []

    def send(url, *, headers, json, timeout):
        keys.append(headers["Idempotency-Key"])
        code = 429 if len(keys) == 1 else 200
        return httpx.Response(code, json={"id": "accepted"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(mail.httpx, "post", send)
    with TestingSessionLocal() as db:
        occ = db.query(MedicineOccurrence).filter_by(status=OccurrenceStatus.MISSED).first()
        mail.queue_missed_medicine_alert(db, "retry@example.com", "Parent", "Child", None,
                                        "Demo", "Demo", "08:00", occ.id)
        db.commit()
        mail.deliver_pending_alerts(db)
        job = db.query(PendingMissedEmail).filter_by(recipient="retry@example.com").one()
        assert job.attempts == 1
        job.next_attempt = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
    with TestingSessionLocal() as db:
        mail.deliver_pending_alerts(db)
        mail.deliver_pending_alerts(db)
        assert len(keys) == 2 and keys[0] == keys[1]
        assert db.query(EmailLog).filter_by(recipient="retry@example.com", status=EmailStatus.SENT).count() == 1
