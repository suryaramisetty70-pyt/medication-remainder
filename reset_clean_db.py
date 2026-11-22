import os
import shutil
from app.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.medicine import Medicine
from app.models.occurrence import MedicineOccurrence
from app.models.proof import MedicineProof
from app.models.relationship import ParentChildRelationship
from app.models.notification import Notification
from app.models.email_log import EmailLog
from app.models.auth_token import AuthToken

def reset_clean():
    # 1. Drop and recreate all tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("[RESET] All database tables dropped and recreated cleanly.")

    # 2. Clean uploads directory
    uploads_dir = "uploads"
    if os.path.exists(uploads_dir):
        shutil.rmtree(uploads_dir)
        os.makedirs(os.path.join(uploads_dir, "proofs"), exist_ok=True)
        print("[RESET] Uploads directory cleaned and reset.")
    else:
        os.makedirs(os.path.join(uploads_dir, "proofs"), exist_ok=True)

    # 3. Verify 0 records
    session = SessionLocal()
    try:
        user_count = session.query(User).count()
        med_count = session.query(Medicine).count()
        occ_count = session.query(MedicineOccurrence).count()
        notif_count = session.query(Notification).count()
        proof_count = session.query(MedicineProof).count()
        print(f"[STATUS] Database State: Users={user_count}, Meds={med_count}, Occurrences={occ_count}, Notifications={notif_count}, Proofs={proof_count}")
        assert user_count == 0 and med_count == 0 and occ_count == 0, "Database is not empty!"
        print("[SUCCESS] Database is 100% clean with 0 records. Ready for real user signup.")
    finally:
        session.close()

if __name__ == "__main__":
    reset_clean()
