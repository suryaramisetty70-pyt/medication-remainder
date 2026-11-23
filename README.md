# CareSync — Smart Family Medicine Reminder & Monitoring System

> *"Helping families stay connected, one medicine at a time."*

CareSync is a production-grade, healthcare-adjacent web platform designed to eliminate missed medications in families. It bridges Caregivers (Parents) and Patients (Children) through automated multi-dose scheduling, mobile alarm reminders, server-side missed dose detection with real email escalation, camera photo proof capture, and parent verification workflows.

---

## 🌟 Key Features

1. **Dual Role Architecture**:
   - **Parent Portal**: Multi-column desktop/tablet dashboard for prescriptions, schedule timelines, grace periods, alert centers, and proof verification.
   - **Child Portal**: Mobile-first, streamlined view with large "Take & Upload Proof" and "Snooze" actions.

2. **Full Production Authentication & Security**:
   - Argon2/Bcrypt password hashing with complexity rules.
   - Email verification with expiring tokens.
   - Password reset workflow.
   - Persistent `HttpOnly` cookie-based JWT sessions.
   - IDOR prevention and role-based access control (RBAC).

3. **Family Account Pairing & Invitations**:
   - Email-based connection invitations requiring mutual acceptance before accessing medication schedules.

4. **Automated Server-Side Missed Dose Scheduler**:
   - Background worker checks active occurrences every 10 seconds.
   - If a dose remains unconfirmed past the grace period (e.g., 30 mins), it automatically marks it **MISSED**, sends an in-app emergency alert, and dispatches a critical warning email to the parent.
   - Duplicate email prevention via `EmailLog` idempotency.

5. **Private Photo Proof Storage & Verification**:
   - Camera snap and file upload for taking medicine proof.
   - Stored in private storage (not exposed publicly).
   - Parent can review proof and click **"Verify"** or **"Request Reconfirmation"**.

6. **Emergency Escalation**:
   - One-tap **"Call Child"** action (`tel:` dialer link) on missed dose alerts.

---

## 🚀 Quick Start & Local Run

### 1. Requirements
- Python 3.10+
- Virtual environment with dependencies from `requirements.txt`

### 2. Environment Configuration (`.env`)
```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM_NAME="CareSync Medicine Alert"
DATABASE_URL=sqlite:///./medreminder.db
SECRET_KEY=your-secure-random-secret-key
```

### 3. Create a family

Use **Create Account** for the parent, then **Connect Child**. Enter the child's name and the parent's preferred login email (defaults to the parent's account email). The child does not need an email account or password. The private family code and chosen email remain visible in the parent's **Child Login Details** section. On the child's device, open **Child Login** and enter both values. The parent can separately save one or more alert email addresses in the emergency alert field; missed-dose notifications go to those addresses, not the family login email.

### 4. Start Server
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser!

### 5. Run Automated Tests
```bash
pytest tests/test_caresync.py -v
```

---

## 🏛️ API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Register new Parent or Child |
| `POST` | `/api/auth/login` | Persistent session login |
| `POST` | `/api/auth/verify-email` | Verify account email token |
| `POST` | `/api/auth/forgot-password` | Request password reset email |
| `POST` | `/api/relationships/parent/request` | Invite child by email |
| `POST` | `/api/relationships/child/respond` | Accept/Reject connection |
| `POST` | `/api/parent/medicines` | Prescribe medicine & auto-schedule |
| `GET` | `/api/child/medicines/today` | Child today's due medicines |
| `POST` | `/api/medicine-occurrences/{id}/proof` | Child upload photo proof |
| `POST` | `/api/parent/confirmations/{id}/verify` | Parent verify intake proof |
| `GET` | `/api/proofs/{id}/view` | Secure private proof image view |
| `GET` | `/api/notifications` | In-app notification center |


## Hosting and alert verification

Use Python 3.12, build with `pip install -r requirements.txt`, start with `sh start.sh`, and check `/api/health`. Set a persistent random `SECRET_KEY`. This release assumes one always-running server and India-local schedules (`TZ=Asia/Kolkata`). Services that sleep cannot process a due alert while asleep. Use persistent storage for both the database and proof images. Point `DATABASE_URL` at a persistent database and `UPLOAD_DIR` at a persistent directory. Set `APP_URL` to the public HTTPS address on hosts other than Render.

Set SMTP credentials and confirm the host permits outbound SMTP with STARTTLS. The health endpoint reports credential presence. Use the parent dashboard's test email and confirm receipt in the intended inbox. In-app notifications work independently of SMTP setup.

For a release check, connect two children and schedule an imminent dose for the second child. Keep the child dashboard open and interact with it to enable browser sound. Leave the dose unconfirmed. After the grace period, verify the parent receives one notification, the banner identifies the correct child, and the email arrives. The worker checks approximately every 10 seconds and the open dashboard refreshes approximately every 15 seconds. Phone sound with a closed browser is outside this implementation.

### Email on Render Free

For Gmail without a custom domain, enable Gmail API in Google Cloud, create an OAuth web application client with redirect URI `https://developers.google.com/oauthplayground`, and use OAuth Playground with your own client credentials to authorize only `https://www.googleapis.com/auth/gmail.send` with offline access. Exchange the authorization code for a refresh token. For ongoing operation, configure the OAuth consent project appropriately (external apps in Testing can have refresh tokens expire after seven days). Set `GMAIL_SENDER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` in Render Environment, then redeploy. Gmail takes precedence when all four are configured. Verify `/api/health` reports `email_provider: gmail` and send a test email to a real parent inbox. Never commit credentials or share them in chat.

Set `RESEND_API_KEY` and `EMAIL_FROM` in the service environment to send email over HTTPS. Use a verified sender for real families. For an initial test, `onboarding@resend.dev` can send to the address registered to your Resend account. After deployment, check `email_configured` at `/api/health`, then verify the missed-dose email in the parent inbox.
