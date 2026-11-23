from contextvars import ContextVar
from uuid import uuid4
import smtplib
import sys
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.email_log import EmailLog, EmailStatus, PendingMissedEmail
from app.models.occurrence import MedicineOccurrence, OccurrenceStatus

mail_error = ContextVar("mail_error", default="Email provider is not configured.")
retryable = ContextVar("mail_retryable", default=False)


def send_raw_email(to_email: str, subject: str, body_text: str, body_html: Optional[str] = None, *, delivery_key: Optional[str] = None) -> bool:
    """Return success when the configured mail provider accepts the message."""
    mail_error.set("Email provider is not configured.")
    retryable.set(False)
    if settings.resend_api_key:
        if not settings.email_from:
            return False
        message = {"from": settings.email_from, "to": [to_email], "subject": subject, "text": body_text}
        if body_html:
            message["html"] = body_html
        headers = {"Authorization": f"Bearer {settings.resend_api_key.strip()}"}
        if delivery_key:
            headers["Idempotency-Key"] = delivery_key
        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers=headers,
                json=message,
                timeout=12,
            )
            response.raise_for_status()
            return bool(response.json().get("id"))
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            try:
                info = exc.response.json()
                message = str(info.get("message", "")).lower()
            except (ValueError, AttributeError):
                message = ""
            if "testing emails" in message or "own email address" in message:
                hint = "The test sender can only email the Resend account owner. Verify a sender domain to email other parents."
            elif "domain" in message:
                hint = "Verify the sender domain in Resend and check EMAIL_FROM."
            elif "api key" in message or code == 401:
                hint = "Check that RESEND_API_KEY is active and has permission to send email."
            elif code == 429:
                hint = "Resend rate or quota limit reached."
            else:
                hint = "Check the failed send in Resend Logs."
            mail_error.set(f"Resend HTTP {code}. {hint}")
            retryable.set(code == 429 or code >= 500)
        except (httpx.HTTPError, ValueError, AttributeError) as exc:
            mail_error.set(f"Email provider connection or response error ({type(exc).__name__}).")
            retryable.set(True)
        print(mail_error.get(), file=sys.stderr)
        return False

    if not settings.smtp_username or not settings.smtp_password:
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_username}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body_text, "plain"))

        if body_html:
            msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=12) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_username, to_email, msg.as_string())
        return True
    except Exception as exc:
        mail_error.set(f"SMTP send failed ({type(exc).__name__}).")
        retryable.set(isinstance(exc, OSError) and not isinstance(exc, smtplib.SMTPAuthenticationError))
        return False


def log_and_send_email(
    db: Session,
    to_email: str,
    subject: str,
    body_text: str,
    body_html: str,
    email_type: str,
    reference_id: Optional[str] = None,
) -> bool:
    """Logs the email to DB and sends it via SMTP."""
    success = send_raw_email(to_email, subject, body_text, body_html)

    log_entry = EmailLog(
        recipient=to_email,
        email_type=email_type,
        reference_id=reference_id,
        status=EmailStatus.SENT if success else EmailStatus.FAILED,
        error=None if success else mail_error.get(),
        sent_at=datetime.utcnow(),
    )
    db.add(log_entry)
    db.commit()
    return success


def send_verification_email(db: Session, to_email: str, user_name: str, verify_url: str, token_code: str) -> bool:
    """Sends account email verification link and code."""
    subject = "Verify your CareSync Account"
    body_text = f"Hello {user_name},\n\nPlease verify your CareSync account using this link:\n{verify_url}\nOr use token: {token_code}\n\nCareSync Team"
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid #0284c7;">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                <span style="font-size: 24px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px;">CareSync</span>
            </div>
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Welcome to CareSync, {user_name}!</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                Thank you for joining. Please verify your email address to activate your account and start managing medication reminders.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{verify_url}" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                    Verify Email Address
                </a>
            </div>
            <div style="background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin: 20px 0; text-align: center;">
                <span style="font-size: 13px; color: #64748b;">Verification Token:</span>
                <div style="font-family: monospace; font-size: 16px; font-weight: bold; color: #0369a1; margin-top: 4px;">{token_code}</div>
            </div>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
                If you did not create a CareSync account, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                CareSync — Helping families stay connected, one medicine at a time.
            </p>
        </div>
    </body>
    </html>
    """
    return log_and_send_email(db, to_email, subject, body_text, body_html, "EMAIL_VERIFICATION")


def send_password_reset_email(db: Session, to_email: str, user_name: str, reset_url: str) -> bool:
    """Sends password reset link."""
    subject = "Reset your CareSync Password"
    body_text = f"Hello {user_name},\n\nClick the link below to reset your CareSync password:\n{reset_url}\n\nThis link will expire in 1 hour."
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid #4f46e5;">
            <h2 style="color: #0f172a; margin-top: 0;">Password Reset Request</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                Hello {user_name}, we received a request to reset your password. Click the button below to choose a new password:
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}" style="background: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                    Reset Password
                </a>
            </div>
            <p style="font-size: 13px; color: #94a3b8;">
                This link will expire in 60 minutes. If you did not make this request, your password remains secure.
            </p>
        </div>
    </body>
    </html>
    """
    return log_and_send_email(db, to_email, subject, body_text, body_html, "PASSWORD_RESET")


def send_connection_request_email(db: Session, child_email: str, child_name: str, parent_name: str) -> bool:
    """Sends connection request alert to child."""
    subject = f"CareSync Family Connection Request from {parent_name}"
    body_text = f"Hello {child_name},\n\n{parent_name} has requested to connect with you on CareSync to help manage your medication reminders.\n\nPlease log in to accept the request."
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid #0284c7;">
            <h2 style="color: #0f172a; margin-top: 0;">Family Connection Request</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                <strong>{parent_name}</strong> wants to connect with you on CareSync to coordinate medication schedules and alarms.
            </p>
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #0369a1;">
                    Log in to your <strong>Child Portal</strong> to review and accept this connection request.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return log_and_send_email(db, child_email, subject, body_text, body_html, "CONNECTION_REQUEST")


def queue_missed_medicine_alert(
    db: Session,
    parent_alert_email: str,
    parent_name: str,
    child_name: str,
    child_phone: Optional[str],
    medicine_name: str,
    dosage: str,
    scheduled_time: str,
    occurrence_id: int,
) -> None:
    """Queue one message per recipient in the same transaction as the parent notification."""
    subject = f"⚠️ CareSync Alert — Medicine Missed by {child_name}"
    call_link = f"tel:{child_phone}" if child_phone else f"{settings.app_url}/parent/dashboard"
    call_label = f"Call {child_name} ({child_phone})" if child_phone else f"View {child_name}'s Status"

    body_text = (
        f"⚠️ URGENT: {child_name} has MISSED their scheduled medication.\n\n"
        f"Medicine: {medicine_name}\n"
        f"Dosage: {dosage}\n"
        f"Scheduled Time: {scheduled_time}\n"
        f"Status: MISSED\n\n"
        f"Recommended Action: Contact {child_name} immediately.\n"
        f"CareSync — Helping families stay connected."
    )

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #fef2f2; padding: 24px; color: #1e293b;">
        <div style="max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 12px 30px rgba(220, 38, 38, 0.15); border-top: 6px solid #dc2626;">
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <span style="background: #fee2e2; color: #b91c1c; font-size: 13px; font-weight: 700; padding: 6px 12px; border-radius: 20px; text-transform: uppercase;">
                    ⚠️ Critical Missed Dose Warning
                </span>
            </div>
            <h2 style="color: #991b1b; margin-top: 8px; font-size: 22px;">Medicine Missed Alert</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #374151;">
                Hello <strong>{parent_name}</strong>,<br>
                Your child <strong>{child_name}</strong> has not confirmed their scheduled medicine within the allowed grace period.
            </p>

            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-left: 5px solid #e11d48; border-radius: 8px; padding: 18px; margin: 24px 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                        <td style="padding: 6px 0; color: #881337; font-weight: 600;">Child:</td>
                        <td style="padding: 6px 0; color: #111827; font-weight: 700;">{child_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #881337; font-weight: 600;">Medicine:</td>
                        <td style="padding: 6px 0; color: #111827; font-weight: 700;">{medicine_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #881337; font-weight: 600;">Dosage:</td>
                        <td style="padding: 6px 0; color: #111827;">{dosage}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #881337; font-weight: 600;">Scheduled Time:</td>
                        <td style="padding: 6px 0; color: #dc2626; font-weight: 700;">{scheduled_time}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #881337; font-weight: 600;">Status:</td>
                        <td style="padding: 6px 0;"><span style="background: #dc2626; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">MISSED</span></td>
                    </tr>
                </table>
            </div>

            <div style="text-align: center; margin: 28px 0;">
                <a href="{call_link}" style="background: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">
                    📞 {call_label}
                </a>
            </div>

            <div style="text-align: center; margin-top: 10px;">
                <a href="{settings.app_url}/parent/dashboard" style="color: #4b5563; font-size: 13px; text-decoration: underline;">
                    Open CareSync Parent Dashboard
                </a>
            </div>

            <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                CareSync — Helping families stay connected, one medicine at a time.
            </p>
        </div>
    </body>
    </html>
    """
    
    for recipient in dict.fromkeys(e.strip().lower() for e in parent_alert_email.split(",") if e.strip()):
        db.add(PendingMissedEmail(key=str(uuid4()), occurrence_id=occurrence_id, recipient=recipient,
                                  subject=subject, body=body_text, html=body_html))


def deliver_pending_alerts(db: Session):
    now = datetime.utcnow()
    pending = db.query(PendingMissedEmail).filter(PendingMissedEmail.next_attempt <= now).order_by(
        PendingMissedEmail.next_attempt).limit(20).all()
    for job in pending:
        occurrence = db.get(MedicineOccurrence, job.occurrence_id)
        if not occurrence or occurrence.status != OccurrenceStatus.MISSED or now - job.created_at > timedelta(hours=1):
            db.delete(job)
            db.commit()
            continue
        ok = send_raw_email(job.recipient, job.subject, job.body, job.html, delivery_key=job.key)
        job.attempts += 1
        db.add(EmailLog(recipient=job.recipient, email_type="MEDICINE_MISSED",
                        reference_id=f"missed_occ_{job.occurrence_id}",
                        status=EmailStatus.SENT if ok else EmailStatus.FAILED,
                        error=None if ok else mail_error.get()))
        if not ok and retryable.get() and job.attempts < 5:
            job.next_attempt = datetime.utcnow() + timedelta(seconds=30 * 2 ** (job.attempts - 1))
        else:
            db.delete(job)
        db.commit()


def send_proof_uploaded_email(
    db: Session,
    parent_email: str,
    parent_name: str,
    child_name: str,
    medicine_name: str,
    occurrence_id: int,
) -> bool:
    """Notifies parent when child submits photo proof. Supports multiple comma-separated emails."""
    subject = f"📸 Proof Uploaded by {child_name} for {medicine_name}"
    body_text = f"Hello {parent_name},\n\n{child_name} has taken their dose of {medicine_name} and uploaded a photo proof.\n\nPlease log in to review and verify."
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid #10b981;">
            <h2 style="color: #065f46; margin-top: 0;">Medication Proof Submitted</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #374151;">
                <strong>{child_name}</strong> just marked <strong>{medicine_name}</strong> as taken and attached photo confirmation.
            </p>
            <div style="text-align: center; margin: 26px 0;">
                <a href="{settings.app_url}/parent/dashboard" style="background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                    Review & Verify Proof
                </a>
            </div>
        </div>
    </body>
    </html>
    """
    recipients = [e.strip() for e in parent_email.split(",") if e.strip()]
    sent_any = False
    for r_email in recipients:
        success = log_and_send_email(db, r_email, subject, body_text, body_html, "PROOF_UPLOADED", f"proof_{occurrence_id}")
        if success:
            sent_any = True
    return sent_any


def send_test_alert_email(db: Session, to_email: str, parent_name: str) -> bool:
    """Sends a test verification email to confirm the parent's alert email channel is working."""
    subject = "🧪 CareSync Alert Verification — Channel Active"
    body_text = (
        f"Hello {parent_name},\n\n"
        f"This is a test verification confirming that your CareSync emergency alert email channel ({to_email}) is verified and actively receiving notifications.\n\n"
        f"You will receive immediate warnings here if your child misses their scheduled medication.\n\n"
        f"CareSync Team"
    )
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f0fdf4; padding: 24px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid #16a34a;">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <span style="background: #dcfce7; color: #15803d; font-size: 13px; font-weight: 700; padding: 6px 12px; border-radius: 20px;">
                    ✅ Alert Channel Verified
                </span>
            </div>
            <h2 style="color: #14532d; margin-top: 0; font-size: 20px;">Emergency Alert Email Verified!</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #374151;">
                Hello <strong>{parent_name}</strong>,<br>
                This confirms that <strong>{to_email}</strong> is successfully connected to your CareSync Parent account.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #166534;">
                <strong>What you will receive at this email:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; line-height: 1.6;">
                    <li>⚠️ Instant Critical Missed Dose Warnings</li>
                    <li>📸 Photo Proof Intake Confirmations</li>
                    <li>👨‍👩‍👧 Family Connection Updates</li>
                </ul>
            </div>
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 24px 0 0 0;">
                CareSync — Helping families stay connected, one medicine at a time.
            </p>
        </div>
    </body>
    </html>
    """
    recipients = [e.strip() for e in to_email.split(",") if e.strip()]
    sent_any = False
    for r_email in recipients:
        success = log_and_send_email(db, r_email, subject, body_text, body_html, "TEST_ALERT_EMAIL")
        if success:
            sent_any = True
    return sent_any


def send_snooze_alert_email(
    db: Session,
    parent_alert_email: str,
    parent_name: str,
    child_name: str,
    medicine_name: str,
    dosage: str,
    snooze_minutes: int,
    new_time: str,
    occurrence_id: int,
) -> bool:
    """Notifies parent immediately when child snoozes a medicine dose."""
    subject = f"⏰ CareSync Notification — {child_name} Snoozed {medicine_name}"
    body_text = (
        f"Hello {parent_name},\n\n"
        f"{child_name} has snoozed their scheduled dose of {medicine_name} ({dosage}) by {snooze_minutes} minutes.\n\n"
        f"New Reminder Time: {new_time}\n\n"
        f"CareSync — Helping families stay connected."
    )
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #fffbeb; padding: 24px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid #f59e0b;">
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <span style="background: #fef3c7; color: #b45309; font-size: 13px; font-weight: 700; padding: 6px 12px; border-radius: 20px;">
                    ⏰ Medicine Snoozed
                </span>
            </div>
            <h2 style="color: #92400e; margin-top: 8px; font-size: 20px;">Reminder Snoozed by {child_name}</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #374151;">
                Hello <strong>{parent_name}</strong>,<br>
                <strong>{child_name}</strong> just postponed their scheduled dose of <strong>{medicine_name}</strong> ({dosage}) by <strong>{snooze_minutes} minutes</strong>.
            </p>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #78350f;">
                <div><strong>Medicine:</strong> {medicine_name} ({dosage})</div>
                <div style="margin-top: 6px;"><strong>Rescheduled Time:</strong> <span style="color: #b45309; font-weight: bold;">{new_time}</span></div>
            </div>
            <div style="text-align: center; margin-top: 24px;">
                <a href="{settings.app_url}/parent/dashboard" style="background: #f59e0b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                    Open Parent Dashboard
                </a>
            </div>
        </div>
    </body>
    </html>
    """
    recipients = [e.strip() for e in parent_alert_email.split(",") if e.strip()]
    sent_any = False
    for r_email in recipients:
        success = log_and_send_email(db, r_email, subject, body_text, body_html, "MEDICINE_SNOOZED", f"snooze_{occurrence_id}_{datetime.now().timestamp()}")
        if success:
            sent_any = True
    return sent_any


