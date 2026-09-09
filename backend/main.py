import os
import sqlite3
import base64
import json
from io import BytesIO
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import google.generativeai as genai
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    print("[AI] Gemini API configured successfully.")
else:
    print("[AI WARNING] GEMINI_API_KEY not found. Running in Mock AI mode.")


import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import threading

def send_alert_email(to_email: str, subject: str, body: str):
    smtp_server = "smtp.gmail.com"
    sender = (os.getenv("SMTP_SENDER") or "suryaramisetty70@gmail.com").strip()
    password = (os.getenv("SMTP_PASSWORD") or "ykqakpvpnlnwswhk").strip().replace(" ", "")
    
    if not sender or not password:
        print("[EMAIL ERROR] SMTP credentials are not configured!")
        return False

    msg = MIMEMultipart()
    msg['From'] = sender
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))
    
    # Try Port 587 (TLS) first with longer cloud timeout
    try:
        print(f"[EMAIL] Attempting TLS (port 587) to {to_email}...")
        server = smtplib.SMTP(smtp_server, 587, timeout=120)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(sender, password)
        server.sendmail(sender, to_email, msg.as_string())
        server.quit()
        print(f"[EMAIL SUCCESS] Email sent to {to_email} via TLS (587)!")
        return True
    except Exception as e587:
        print(f"[EMAIL WARNING] Port 587 failed: {e587}")
        
    # Try Port 465 (SSL) as fallback
    try:
        print(f"[EMAIL] Attempting SSL (port 465) to {to_email}...")
        server = smtplib.SMTP_SSL(smtp_server, 465, timeout=120)
        server.ehlo()
        server.login(sender, password)
        server.sendmail(sender, to_email, msg.as_string())
        server.quit()
        print(f"[EMAIL SUCCESS] Email sent to {to_email} via SSL (465)!")
        return True
    except Exception as e465:
        print(f"[EMAIL ERROR] Both ports failed. SSL error: {e465}")
        return False




# SQLite Database Setup

DB_PATH = "database.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,          -- 'parent' or 'child'
        parent_id INTEGER,
        FOREIGN KEY (parent_id) REFERENCES users(id)
    )
    """)
    
    # Create Medications Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        dosage TEXT NOT NULL,
        schedule_time TEXT NOT NULL, -- Format: HH:MM
        instruction TEXT,            -- e.g., "Take with food"
        active INTEGER DEFAULT 1,    -- 1 = active, 0 = inactive
        child_id INTEGER DEFAULT 1,
        FOREIGN KEY (child_id) REFERENCES users(id)
    )
    """)
    
    # Create Adherence Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS adherence_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medication_id INTEGER,
        status TEXT NOT NULL,        -- "taken", "missed", "pending"
        scheduled_time TEXT NOT NULL, -- Date and time format: YYYY-MM-DD HH:MM
        logged_time TEXT,            -- Actual time taken: YYYY-MM-DD HH:MM:SS
        is_verified INTEGER DEFAULT 0, -- 1 = verified by AI, 0 = self-logged
        verification_msg TEXT,
        child_id INTEGER DEFAULT 1,
        image_data TEXT,             -- Base64 encoded string of taken pill photo
        FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
        FOREIGN KEY (child_id) REFERENCES users(id)
    )
    """)
    
    # Migration queries to add columns if database already exists
    try:
        cursor.execute("ALTER TABLE medications ADD COLUMN child_id INTEGER DEFAULT 1")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE adherence_logs ADD COLUMN child_id INTEGER DEFAULT 1")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE adherence_logs ADD COLUMN image_data TEXT")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN age INTEGER")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN phone TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN otp_code TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN otp_expiry TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN family_id TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE medications ADD COLUMN family_id TEXT DEFAULT 'FAM-DEFAULT'")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE adherence_logs ADD COLUMN family_id TEXT DEFAULT 'FAM-DEFAULT'")
    except sqlite3.OperationalError:
        pass
        
    conn.commit()

    # Auto-seed default Parent and Child users if the database is fresh/empty
    try:
        cursor.execute("SELECT COUNT(*) as count FROM users")
        row = cursor.fetchone()
        if row and row[0] == 0:
            cursor.execute("INSERT INTO users (id, username, role, parent_id, family_id) VALUES (1, 'Parent User', 'parent', NULL, 'FAM-DEFAULT')")
            cursor.execute("INSERT INTO users (id, username, role, parent_id, family_id) VALUES (2, 'Child User', 'child', 1, 'FAM-DEFAULT')")
            conn.commit()
            print("[DB] Successfully auto-seeded default users!")
    except Exception as e:
        print(f"Error seeding users: {e}")
        
    conn.close()



init_db()

# FastAPI Initialization
app = FastAPI(title="Smart Medication Reminder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class UserCreate(BaseModel):
    username: str
    role: str                       # 'parent' or 'child'
    parent_id: Optional[int] = None

class UserEmailUpdate(BaseModel):
    email: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    parent_id: Optional[int] = None
    email: Optional[str] = None
    age: Optional[int] = None
    phone: Optional[str] = None
    family_id: Optional[str] = None

class SendOtpRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp_code: str
    username: str
    age: int
    phone: str
    role: str                       # 'parent' or 'child'
    parent_id: Optional[int] = None


class MedicationCreate(BaseModel):
    name: str
    dosage: str
    schedule_time: str
    instruction: Optional[str] = ""
    family_id: Optional[str] = 'FAM-DEFAULT'

class MedicationResponse(BaseModel):
    id: int
    name: str
    dosage: str
    schedule_time: str
    instruction: Optional[str]
    active: int
    family_id: Optional[str]

class LogCreate(BaseModel):
    medication_id: int
    status: str
    scheduled_time: str
    logged_time: Optional[str] = None
    is_verified: Optional[int] = 0
    verification_msg: Optional[str] = ""
    image_data: Optional[str] = None
    family_id: Optional[str] = 'FAM-DEFAULT'


class ChatRequest(BaseModel):
    message: str
    history: List[dict] = [] # list of {"role": "user"|"model", "text": "..."}

# DB Helper Functions
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# API Endpoints
@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.post("/api/auth/send-otp")
def send_otp(req: SendOtpRequest):
    import random
    from datetime import datetime, timedelta
    
    otp = f"{random.randint(100000, 999999)}"
    expiry = (datetime.now() + timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if user already exists
    cursor.execute("SELECT id FROM users WHERE email = ?", (req.email,))
    user = cursor.fetchone()
    
    if user:
        # Update existing user record with OTP
        cursor.execute(
            "UPDATE users SET otp_code = ?, otp_expiry = ? WHERE id = ?",
            (otp, expiry, user["id"])
        )
    else:
        # Insert temporary pending user record with OTP
        cursor.execute(
            "INSERT INTO users (username, role, email, otp_code, otp_expiry) VALUES (?, ?, ?, ?, ?)",
            (f"Pending_{otp}", "child", req.email, otp, expiry)
        )
        
    conn.commit()
    conn.close()
    
    # Send email containing the OTP
    email_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center;">
                <h2 style="color: #0ea5e9; margin-top: 0; font-size: 24px;">🔑 Aegis AI Verification</h2>
                <p style="font-size: 16px; color: #334155; line-height: 1.5;">
                    Your one-time verification code (OTP) for Aegis AI is:
                </p>
                <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0ea5e9;">
                    {otp}
                </div>
                <p style="font-size: 14px; color: #64748b;">
                    This code will expire in 5 minutes. If you did not request this, please ignore this email.
                </p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
                <span style="font-size: 11px; color: #94a3b8;">Aegis AI Smart Medication Adherence</span>
            </div>
        </body>
    </html>
    """
    
    # Print to console logs as fallback so developer can see it in terminal
    print(f"\n[OTP SERVICE] Verification OTP code for {req.email} is: {otp}\n")

    # Send email in background thread (non-blocking, logs errors to Render console)
    def _send_email_safe():
        try:
            send_alert_email(req.email, "[Aegis AI] Your OTP Verification Code", email_body)
        except Exception as e:
            print(f"[EMAIL THREAD ERROR] Failed to send OTP email to {req.email}: {e}")

    threading.Thread(target=_send_email_safe, daemon=False).start()
    
    return {"message": "OTP sent successfully to your email."}




@app.post("/api/auth/verify-otp", response_model=UserResponse)
def verify_otp(req: VerifyOtpRequest):
    from datetime import datetime
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch user matching email and OTP (or fallback test OTP 123456)
    if req.otp_code == '123456':
        cursor.execute("SELECT * FROM users WHERE email = ?", (req.email,))
    else:
        cursor.execute(
            "SELECT * FROM users WHERE email = ? AND otp_code = ?",
            (req.email, req.otp_code)
        )
    user = cursor.fetchone()

    
    if not user:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid OTP code.")
        
    # Check OTP expiry
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if user["otp_expiry"] < now_str:
        conn.close()
        raise HTTPException(status_code=400, detail="OTP code has expired.")
        
    # Resolve or generate family_id
    family_id = user["family_id"]
    if not family_id or family_id == 'FAM-DEFAULT':
        if req.role == 'parent':
            # Generate a new family code
            import secrets
            family_id = f"FAM-{secrets.token_hex(4).upper()}"
        else:
            # Find an existing parent family in the DB to link to
            cursor.execute("SELECT family_id FROM users WHERE role = 'parent' AND family_id IS NOT NULL AND family_id != 'FAM-DEFAULT' LIMIT 1")
            row = cursor.fetchone()
            if row:
                family_id = row["family_id"]
            else:
                import secrets
                family_id = f"FAM-{secrets.token_hex(4).upper()}"

    try:
        # Valid OTP! Update user details (complete sign-up/login)
        cursor.execute(
            "UPDATE users SET username = ?, age = ?, phone = ?, role = ?, parent_id = ?, family_id = ?, otp_code = NULL, otp_expiry = NULL WHERE id = ?",
            (req.username, req.age, req.phone, req.role, req.parent_id, family_id, user["id"])
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="This name is already taken. Please enter a different name.")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

    
    cursor.execute("SELECT * FROM users WHERE id = ?", (user["id"],))
    logged_user = dict(cursor.fetchone())
    conn.close()
    
    return logged_user



# --- User Endpoints ---
@app.post("/api/users", response_model=UserResponse)
def create_user(user: UserCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, role, parent_id) VALUES (?, ?, ?)",
            (user.username, user.role, user.parent_id)
        )
        user_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        new_user = dict(cursor.fetchone())
        conn.close()
        return new_user
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists.")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users", response_model=List[UserResponse])
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

@app.put("/api/users/{user_id}/email", response_model=UserResponse)
def update_user_email(user_id: int, req: UserEmailUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET email = ? WHERE id = ?", (req.email, user_id))
    conn.commit()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    updated_user = cursor.fetchone()
    conn.close()
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(updated_user)


# --- Scoped Medications ---
@app.get("/api/medications", response_model=List[MedicationResponse])
def get_medications(family_id: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if family_id:
        cursor.execute("SELECT * FROM medications WHERE active = 1 AND family_id = ?", (family_id,))
    else:
        cursor.execute("SELECT * FROM medications WHERE active = 1")
    meds = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return meds


@app.post("/api/medications", response_model=MedicationResponse)
def add_medication(med: MedicationCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO medications (name, dosage, schedule_time, instruction, family_id) VALUES (?, ?, ?, ?, ?)",
            (med.name, med.dosage, med.schedule_time, med.instruction, med.family_id)
        )
        med_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute("SELECT * FROM medications WHERE id = ?", (med_id,))
        new_med = dict(cursor.fetchone())
        conn.close()
        return new_med
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/medications/{med_id}")
def delete_medication(med_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM medications WHERE id = ?", (med_id,))
    conn.commit()
    conn.close()
    return {"message": "Medication deleted successfully"}


# --- Scoped Adherence Logs ---
@app.get("/api/logs")
def get_logs(start_date: Optional[str] = None, end_date: Optional[str] = None, family_id: Optional[str] = None):
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT l.*, m.name as medication_name, m.dosage, m.schedule_time as med_time
        FROM adherence_logs l
        JOIN medications m ON l.medication_id = m.id
        WHERE l.scheduled_time >= ? AND l.scheduled_time <= ?
    """
    params = [f"{start_date} 00:00", f"{end_date} 23:59"]
    
    if family_id:
        query += " AND l.family_id = ?"
        params.append(family_id)
        
    query += " ORDER BY l.scheduled_time ASC"
    
    cursor.execute(query, tuple(params))
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs


@app.post("/api/logs")
def log_adherence(log: LogCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if a log already exists for this medication at this scheduled_time
    cursor.execute(
        "SELECT id FROM adherence_logs WHERE medication_id = ? AND scheduled_time = ?",
        (log.medication_id, log.scheduled_time)
    )
    existing = cursor.fetchone()
    
    now_str = log.logged_time or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if existing:
        cursor.execute(
            "UPDATE adherence_logs SET status = ?, logged_time = ?, is_verified = ?, verification_msg = ?, family_id = ?, image_data = ? WHERE id = ?",
            (log.status, now_str, log.is_verified, log.verification_msg, log.family_id, log.image_data, existing["id"])
        )
    else:
        cursor.execute(
            "INSERT INTO adherence_logs (medication_id, status, scheduled_time, logged_time, is_verified, verification_msg, family_id, image_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (log.medication_id, log.status, log.scheduled_time, now_str, log.is_verified, log.verification_msg, log.family_id, log.image_data)
        )
    
    conn.commit()

    # Trigger email notification to parent if medication status is 'missed'
    if log.status == "missed":
        try:
            # Query parent user details dynamically using the family_id scope
            cursor.execute("SELECT email FROM users WHERE family_id = ? AND role = 'parent' AND email IS NOT NULL AND email != '' LIMIT 1", (log.family_id,))
            parent_row = cursor.fetchone()
            
            # Query child's name in this family
            cursor.execute("SELECT username FROM users WHERE family_id = ? AND role = 'child' LIMIT 1", (log.family_id,))
            child_row = cursor.fetchone()
            child_name = child_row["username"] if child_row else "Child"
            
            cursor.execute("SELECT name, dosage FROM medications WHERE id = ?", (log.medication_id,))
            med_row = cursor.fetchone()
            
            if parent_row and parent_row["email"] and med_row:
                parent_email = parent_row["email"]
                med_name = med_row["name"]
                med_dosage = med_row["dosage"]
                
                email_body = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                            <h2 style="color: #ef4444; margin-top: 0; font-size: 24px;">🚨 Aegis AI Adherence Alert</h2>
                            <p style="font-size: 16px; color: #334155; line-height: 1.5;">
                                Hello,
                            </p>
                            <p style="font-size: 16px; color: #334155; line-height: 1.5;">
                                Your child, <strong>{child_name}</strong>, has <strong>MISSED</strong> their medication dose:
                            </p>
                            <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                                <strong style="color: #0f172a; font-size: 18px;">{med_name}</strong><br>
                                <span style="color: #64748b; font-size: 14px;">Dosage: {med_dosage}</span>
                            </div>
                            <p style="font-size: 16px; color: #334155; line-height: 1.5;">
                                Please check on them as soon as possible.
                            </p>
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                            <span style="font-size: 12px; color: #94a3b8;">Aegis AI Smart Medication Adherence Platform</span>
                        </div>
                    </body>
                </html>
                """
                
                # Send email asynchronously in thread since the handler is verified synchronous
                threading.Thread(
                    target=send_alert_email,
                    args=(parent_email, f"🚨 ALERT: {child_name} missed {med_name}", email_body)
                ).start()
        except Exception as err:
            print(f"Error preparing email alert: {err}")

    conn.close()
    return {"message": "Adherence logged successfully"}


# --- Parent Alerts Endpoint ---
@app.get("/api/parent/alerts/{family_id}")
def get_parent_alerts(family_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch child's active medications in this family
    cursor.execute("SELECT * FROM medications WHERE active = 1 AND family_id = ?", (family_id,))
    meds = [dict(row) for row in cursor.fetchall()]
    
    # 2. Fetch logs for today in this family
    today_str = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("""
        SELECT medication_id, status, scheduled_time 
        FROM adherence_logs 
        WHERE family_id = ? AND scheduled_time LIKE ?
    """, (family_id, f"{today_str}%"))
    logs = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    now = datetime.now()
    alerts = []

    
    for med in meds:
        # Parse schedule time for today
        sched_time_str = f"{today_str} {med['schedule_time']}"
        try:
            sched_dt = datetime.strptime(sched_time_str, "%Y-%m-%d %H:%M")
        except ValueError:
            continue
        
        # Skip future medications
        if now < sched_dt:
            continue
            
        # Check if there is any log stating 'taken'
        is_taken = any(
            l["medication_id"] == med["id"] and 
            l["status"] == "taken" and 
            l["scheduled_time"] == sched_time_str
            for l in logs
        )
        
        if is_taken:
            continue  # Dose was taken, no alert needed
            
        # Check if child explicitly marked as missed
        is_missed = any(
            l["medication_id"] == med["id"] and 
            l["status"] == "missed" and 
            l["scheduled_time"] == sched_time_str
            for l in logs
        )
        
        # IMMEDIATE alert if child clicked "Miss"
        if is_missed:
            alerts.append({
                "medication_id": med["id"],
                "name": med["name"],
                "dosage": med["dosage"],
                "schedule_time": med["schedule_time"],
                "status": "missed",
                "message": f"⚠️ Child SKIPPED {med['name']} dose at {med['schedule_time']}!"
            })
        # IMMEDIATE alert if dose time has passed with no response
        else:
            alerts.append({
                "medication_id": med["id"],
                "name": med["name"],
                "dosage": med["dosage"],
                "schedule_time": med["schedule_time"],
                "status": "pending",
                "message": f"🕐 No response for {med['name']} due at {med['schedule_time']} — WAITING!"
            })
                
    return alerts


# AI Chatbot endpoint using Gemini
@app.post("/api/chat")
def chat_with_coach(req: ChatRequest):
    if not GEMINI_API_KEY:
        # Mock Response if no API key is provided
        msg_lower = req.message.lower()
        if "side effect" in msg_lower or "headache" in msg_lower or "dizzy" in msg_lower:
            reply = "Some medications can cause side effects like headaches or dizziness. Please sit down, drink plenty of water, and rest. If this condition worsens or persists, please contact your healthcare provider. Note: This is simulated AI advice."
        elif "milk" in msg_lower or "food" in msg_lower or "coffee" in msg_lower:
            reply = "It depends on the specific drug. Some medications absorb better with food, while dairy/milk can block the absorption of certain antibiotics. Please check the specific label or ask your doctor. Note: This is simulated AI advice."
        else:
            reply = f"Hello! I am your AI Medication Assistant. I received your message: '{req.message}'. Please remember to take your scheduled medications on time! Note: This is simulated AI advice."
        return {"reply": reply}
    
    try:
        # Initialize Gemini model
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Structure system prompt and conversation history
        chat_prompt = (
            "You are a friendly, compassionate, and knowledgeable AI Health Coach. "
            "Your main role is to help the patient manage their medication schedule, "
            "log adherence, and provide basic, accurate info regarding drug instructions and side effects. "
            "Always be encouraging. ALWAYS include this exact warning at the end of medical info: "
            "'(Disclaimer: I am an AI, not a doctor. Please consult a medical professional for official decisions.)'\n\n"
        )
        
        # Build prompt from chat history
        prompt_content = chat_prompt
        for h in req.history:
            role_name = "User" if h["role"] == "user" else "Assistant"
            prompt_content += f"{role_name}: {h['text']}\n"
        prompt_content += f"User: {req.message}\nAssistant:"
        
        response = model.generate_content(prompt_content)
        return {"reply": response.text.strip()}
    except Exception as e:
        print(f"Gemini API chat error: {str(e)}. Falling back to mock assistant.")
        msg_lower = req.message.lower()
        if "side effect" in msg_lower or "headache" in msg_lower or "dizzy" in msg_lower:
            reply = f"Some medications can cause side effects like headaches or dizziness. Please rest, drink water, and consult a doctor if it persists. (Note: Simulated AI response due to API connection error: {str(e)})"
        elif "milk" in msg_lower or "food" in msg_lower or "coffee" in msg_lower:
            reply = f"Some medications require food, while others conflict with milk or coffee. Please check your specific medication info sheet or consult a doctor. (Note: Simulated AI response due to API connection error: {str(e)})"
        else:
            reply = f"Hello! I am your local AI Medication Assistant. I received: '{req.message}'. (Note: Simulated AI response due to API connection error: {str(e)})"
        return {"reply": reply}

# AI Pill Image Verification endpoint
@app.post("/api/verify-pill")
async def verify_pill(
    medication_name: str = Form(...),
    image: UploadFile = File(...)
):
    try:
        image_bytes = await image.read()
        pil_img = Image.open(BytesIO(image_bytes))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file uploaded.")
    
    if not GEMINI_API_KEY:
        # Mock verification if no API key
        # Simulate simple check: if we have an image, say it's verified with 90% confidence
        return {
            "verified": True,
            "pill_detected": True,
            "description": "Round white tablet resembling standard over-the-counter medicine.",
            "confidence": 0.92,
            "message": f"Successfully verified! That looks like the correct dosage of {medication_name}. You can take it now."
        }
        
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        prompt = (
            f"You are a medical computer vision system. The user is supposed to take the medication: '{medication_name}'.\n"
            "Analyze the uploaded image of a pill/medication. Perform the following checks:\n"
            "1. Is there a pill, tablet, capsule, or medicine visible in the image?\n"
            "2. Does it resemble a medication? (Be reasonable, if it's in their hand or a cup, count it as a pill if it's round, oval, capsule-shaped, etc.)\n"
            "Generate a JSON response. The response must contain exactly these JSON keys: \n"
            "{\n"
            "  \"verified\": true/false (true if a pill is present and reasonably matches),\n"
            "  \"pill_detected\": true/false (true if a pill is detected in the image),\n"
            "  \"description\": \"brief description of the pill shape, color, quantity, and setting seen in the image\",\n"
            "  \"confidence\": 0.0 to 1.0 (estimation of how sure you are),\n"
            "  \"message\": \"a short friendly confirmation or warning message to the user\"\n"
            "}\n"
            "Return ONLY the raw JSON string, without any Markdown formatting or code block wrapper."
        )
        
        response = model.generate_content([prompt, pil_img])
        
        # Clean response text in case it wrapped it in ```json ... ```
        resp_text = response.text.strip()
        if resp_text.startswith("```"):
            resp_text = resp_text.split("```")[1]
            if resp_text.startswith("json"):
                resp_text = resp_text[4:]
            resp_text = resp_text.strip()
            
        result = json.loads(resp_text)
        return result
    except Exception as e:
        # Fallback in case of parsing/API errors
        return {
            "verified": True,
            "pill_detected": True,
            "description": f"Image processed. (Error calling API: {str(e)})",
            "confidence": 0.50,
            "message": f"Logged pill ingestion for {medication_name} (Self-reported verification)."
        }

# Mount the frontend/dist folder for unified deployment on Render
dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
    print(f"[SUCCESS] Served frontend static assets from: {dist_path}")
else:
    print(f"[WARNING] frontend/dist directory NOT found at: {dist_path}")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

