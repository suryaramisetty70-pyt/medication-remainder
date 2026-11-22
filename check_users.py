from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()
users = db.query(User).all()
print("Users in database:")
for u in users:
    print(f"- ID: {u.id}, Name: {u.name}, Email: {u.email}, Role: {u.role}")
db.close()
