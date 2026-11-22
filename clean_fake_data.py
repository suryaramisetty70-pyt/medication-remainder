from app.database import SessionLocal
from app.models.user import User
from app.models.relationship import ParentChildRelationship
from app.models.medicine import Medicine
from app.models.occurrence import MedicineOccurrence
from app.models.proof import MedicineProof
from app.models.notification import Notification
from app.models.email_log import EmailLog
from app.models.auth_token import AuthToken

def clean_fake_data():
    session = SessionLocal()
    try:
        # Identify fake demo users
        fake_users = session.query(User).filter(User.email.in_(["parent@caresync.com", "child@caresync.com"])).all()
        fake_user_ids = [u.id for u in fake_users]
        print(f"Found fake user IDs to remove: {fake_user_ids}")

        if fake_user_ids:
            # 1. Delete associated proofs
            occurrences = session.query(MedicineOccurrence).filter(
                MedicineOccurrence.child_id.in_(fake_user_ids)
            ).all()
            occ_ids = [o.id for o in occurrences]
            if occ_ids:
                proofs_deleted = session.query(MedicineProof).filter(MedicineProof.occurrence_id.in_(occ_ids)).delete(synchronize_session=False)
                print(f"Deleted {proofs_deleted} proofs")

            # 2. Delete occurrences
            occ_deleted = session.query(MedicineOccurrence).filter(
                (MedicineOccurrence.child_id.in_(fake_user_ids)) | 
                (MedicineOccurrence.parent_id.in_(fake_user_ids))
            ).delete(synchronize_session=False)
            print(f"Deleted {occ_deleted} occurrences")

            # 3. Delete medicines
            meds_deleted = session.query(Medicine).filter(
                (Medicine.parent_id.in_(fake_user_ids)) | 
                (Medicine.child_id.in_(fake_user_ids))
            ).delete(synchronize_session=False)
            print(f"Deleted {meds_deleted} medicines")

            # 4. Delete relationships
            rels_deleted = session.query(ParentChildRelationship).filter(
                (ParentChildRelationship.parent_id.in_(fake_user_ids)) | 
                (ParentChildRelationship.child_id.in_(fake_user_ids))
            ).delete(synchronize_session=False)
            print(f"Deleted {rels_deleted} relationships")

            # 5. Delete notifications
            notifs_deleted = session.query(Notification).filter(Notification.user_id.in_(fake_user_ids)).delete(synchronize_session=False)
            print(f"Deleted {notifs_deleted} notifications")

            # 6. Delete email logs for fake users
            email_logs_deleted = session.query(EmailLog).filter(
                EmailLog.recipient.in_(["parent@caresync.com", "child@caresync.com"])
            ).delete(synchronize_session=False)
            print(f"Deleted {email_logs_deleted} email logs")

            # 7. Delete auth tokens
            tokens_deleted = session.query(AuthToken).filter(AuthToken.user_id.in_(fake_user_ids)).delete(synchronize_session=False)
            print(f"Deleted {tokens_deleted} auth tokens")

            # 8. Delete the fake users
            users_deleted = session.query(User).filter(User.id.in_(fake_user_ids)).delete(synchronize_session=False)
            print(f"Deleted {users_deleted} fake users")

        session.commit()

        # Print remaining state
        print("\n--- Remaining Database State ---")
        remaining_users = session.query(User).all()
        print(f"Remaining Users ({len(remaining_users)}):")
        for u in remaining_users:
            print(f" - ID: {u.id}, Name: {u.name}, Email: {u.email}, Role: {u.role}")
        print(f"Medicines count: {session.query(Medicine).count()}")
        print(f"Occurrences count: {session.query(MedicineOccurrence).count()}")
        print(f"Relationships count: {session.query(ParentChildRelationship).count()}")
        print(f"Notifications count: {session.query(Notification).count()}")

    except Exception as e:
        session.rollback()
        print(f"Error cleaning data: {e}")
        raise e
    finally:
        session.close()

if __name__ == "__main__":
    clean_fake_data()
