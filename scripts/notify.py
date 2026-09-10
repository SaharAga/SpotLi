#!/usr/bin/env python3
"""
Deliveree Agent Notification Dispatcher
Sends email notifications via Gmail SMTP using an App Password.
"""

import argparse
import os
import smtplib
import ssl
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path


def load_env_file(filepath: Path) -> dict:
    """Simple parser for .env files without external dependencies."""
    env_vars = {}
    if not filepath.is_file():
        return env_vars
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip("\"'")
                env_vars[key] = val
    return env_vars


def get_config():
    """Load configuration from .env.local, .env, and environment variables."""
    root_dir = Path(__file__).resolve().parent.parent
    env_local = load_env_file(root_dir / ".env.local")
    env_main = load_env_file(root_dir / ".env")

    # Precedence: OS Env > .env.local > .env
    merged = {**env_main, **env_local, **os.environ}

    gmail_user = merged.get("GMAIL_USER") or merged.get("SMTP_USER") or ""
    # Strip spaces from app password if copied with spaces (Google shows 4-char chunks: "abcd efgh ijkl mnop")
    gmail_pass = (merged.get("GMAIL_APP_PASSWORD") or merged.get("SMTP_PASS") or "").replace(" ", "")
    notify_email = merged.get("NOTIFY_EMAIL") or merged.get("TO_EMAIL") or gmail_user
    smtp_host = merged.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(merged.get("SMTP_PORT", "465"))

    return {
        "gmail_user": gmail_user,
        "gmail_pass": gmail_pass,
        "notify_email": notify_email,
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
    }


def create_html_body(subject: str, message: str, status: str) -> str:
    """Generate modern, styled HTML email template."""
    status_colors = {
        "SUCCESS": "#10b981",  # Emerald
        "INFO": "#3b82f6",     # Blue
        "WARNING": "#f59e0b",  # Amber
        "ERROR": "#ef4444",    # Red
        "ACTION_REQUIRED": "#8b5cf6", # Purple
    }
    badge_color = status_colors.get(status.upper(), "#3b82f6")

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background-color: #111827; padding: 24px 32px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">SpotLi Assistant</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 600; color: #ffffff; background-color: {badge_color}; border-radius: 9999px; text-transform: uppercase;">{status}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">{subject}</h2>
              <div style="font-size: 15px; line-height: 1.6; color: #374151; white-space: pre-wrap;">{message}</div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
              Sent automatically by SpotLi Agent System &bull; Workspace: <code>SpotLi</code>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def send_email(subject: str, message: str, to_email: str = None, status: str = "INFO") -> bool:
    """Send email via SMTP."""
    config = get_config()

    sender = config["gmail_user"]
    password = config["gmail_pass"]
    recipient = to_email or config["notify_email"]
    host = config["smtp_host"]
    port = config["smtp_port"]

    if not sender or not password:
        print("❌ Error: Missing credentials.", file=sys.stderr)
        print("Please configure GMAIL_USER and GMAIL_APP_PASSWORD in .env.local or environment variables.", file=sys.stderr)
        return False

    if not recipient:
        recipient = sender

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[{status.upper()}] {subject}"
    msg["From"] = f"SpotLi Assistant <{sender}>"
    msg["To"] = recipient

    # Plain text version
    text_content = f"{subject}\n\nStatus: {status}\n\n{message}\n\n--\nSent automatically by SpotLi Assistant"
    html_content = create_html_body(subject, message, status)

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                server.login(sender, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port) as server:
                server.starttls()
                server.login(sender, password)
                server.send_message(msg)

        print(f"📧 Notification sent successfully to {recipient} [{status}]")
        return True

    except Exception as e:
        print(f"❌ Failed to send email: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description="SpotLi Notification Utility")
    parser.add_argument("-s", "--subject", default="SpotLi Agent Notification", help="Email subject line")
    parser.add_argument("-m", "--message", default="This is a notification from your SpotLi AI assistant.", help="Message body")
    parser.add_argument("-t", "--to", default=None, help="Recipient email address")
    parser.add_argument("--status", default="INFO", choices=["INFO", "SUCCESS", "WARNING", "ERROR", "ACTION_REQUIRED"], help="Notification status level")
    parser.add_argument("--test", action="store_true", help="Send a test verification notification")

    args = parser.parse_args()

    if args.test:
        subject = "SpotLi Agent Notification Test"
        message = "🎉 Congratulations! Your SpotLi agent notification flow is successfully configured and working.\n\nYou will receive automated alerts for task completions, critical build issues, and required actions directly here."
        status = "SUCCESS"
    else:
        subject = args.subject
        message = args.message
        status = args.status

    success = send_email(subject=subject, message=message, to_email=args.to, status=status)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
