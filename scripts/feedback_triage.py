#!/usr/bin/env python3
"""
SpotLi Automated Feedback Ingestion, Triage & Action Items Generator.
Scans new feedback entries from Firestore / local storage buffer,
classifies priority, generates structured action items, updates the backlog,
and sends real-time Telegram notification summaries.
"""

import os
import sys
import json
import re
import argparse
from datetime import datetime
from pathlib import Path

# Add script directory for imports
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
BACKLOG_FILE = ROOT_DIR / ".agents" / "backlog" / "FEEDBACK_ACTION_ITEMS.md"
BUFFER_FILE = ROOT_DIR / ".agents" / "feedback_buffer.json"

try:
    from telegram_bridge import TelegramSender, get_config
except ImportError:
    TelegramSender = None
    get_config = lambda: {}


def mask_email(email: str) -> str:
    """Masks email address for privacy (e.g., s***r@domain.com or s***@domain.com)."""
    if not email or not isinstance(email, str) or "@" not in email:
        return ""
    parts = email.strip().split("@")
    if len(parts) != 2:
        return "***"
    local, domain = parts
    if not local or not domain:
        return "***"
    if len(local) <= 1:
        return f"*@{domain}"
    elif len(local) == 2:
        return f"{local[0]}*@{domain}"
    elif len(local) == 3:
        return f"{local[0]}*{local[2]}@{domain}"
    else:
        return f"{local[0]}***{local[-1]}@{domain}"


def parse_feedback_item(item: dict) -> dict:
    """Analyze feedback text, environment and metadata to determine priority and root cause."""
    msg = item.get("message", "").lower()
    fb_type = item.get("type", "bug").lower()
    rating = item.get("rating", 5)
    user_agent = item.get("userAgent", "")
    is_anon = item.get("isAnonymous", False)
    
    # Classification rules
    is_crash = any(w in msg for w in ["crash", "freeze", "blank", "white screen", "error", "exception", "failed", "נתקע", "קורס", "שגיאה", "מסך שחור"])
    is_tracking = any(w in msg for w in ["track", "dhl", "israel post", "fedex", "ups", "hfd", "cheetah", "מעקב", "דואר ישראל", "חבילה"])
    is_ui_rtl = any(w in msg for w in ["rtl", "hebrew", "align", "cut off", "overflow", "button", "mobile", "כפתור", "חתוך", "עברית", "יישור"])
    is_auth = any(w in msg for w in ["login", "google", "auth", "sign in", "התחברות", "גוגל", "חשבון"])
    
    # Priority assignment
    if fb_type == "bug" and (is_crash or rating <= 2):
        priority = "P0-Critical"
        urgency_emoji = "🚨"
    elif fb_type == "bug" or (is_tracking or is_auth or rating <= 3):
        priority = "P1-High"
        urgency_emoji = "⚠️"
    else:
        priority = "P2-Normal"
        urgency_emoji = "💡"

    # Domain category
    if is_tracking and not (fb_type == "feature" and not is_crash):
        domain = "Courier Tracking Engine"
        suggested_files = ["src/services/courierDetector.js", "src/services/trackingService.js"]
    elif fb_type == "feature" or "export" in msg or "csv" in msg:
        domain = "Feature Request / UX Enhancement"
        suggested_files = ["src/components/ExportModal.jsx", "src/App.jsx"]
    elif is_auth:
        domain = "Authentication & Sync"
        suggested_files = ["src/context/AuthContext.jsx", "src/services/firebase.js"]
    elif is_ui_rtl:
        domain = "UI / RTL / Touch Ergonomics"
        suggested_files = ["src/components/PackageCard.jsx", "src/index.css", "src/App.jsx"]
    else:
        domain = "General App Feedback"
        suggested_files = ["src/App.jsx", "src/constants/translations.js"]

    # Action items generation
    action_items = []
    if is_crash or (is_tracking and fb_type == "bug"):
        action_items.append(f"Investigate error logs and parsing patterns in `{suggested_files[0]}`")
        action_items.append(f"Add regression test cases covering reported payload in `src/tests/`")
    elif is_ui_rtl:
        action_items.append(f"Audit mobile touch target / RTL symmetry in `{suggested_files[0]}`")
        action_items.append("Verify WCAG contrast and layout in both Hebrew and English")
    elif fb_type == "feature":
        action_items.append(f"Design schema and component for `{suggested_files[0]}`")
        action_items.append("Update feature backlog and user flow specs")
    else:
        action_items.append(f"Evaluate feedback in `{suggested_files[0]}`")
        action_items.append("Update product roadmap backlog")

    # Format user display strictly as Anonymous Tester for 100% complete anonymity
    user_display = "Anonymous Tester"

    return {
        "id": item.get("id", f"fb-{int(datetime.now().timestamp())}"),
        "raw": item,
        "type": fb_type,
        "priority": priority,
        "urgency_emoji": urgency_emoji,
        "domain": domain,
        "suggested_files": suggested_files,
        "action_items": action_items,
        "timestamp": item.get("timestamp", datetime.now().isoformat()),
        "isAnonymous": is_anon,
        "user": user_display,
        "message": item.get("message", ""),
        "rating": rating,
        "appVersion": item.get("appVersion", "0.2.0-alpha"),
        "userAgent": user_agent
    }


def load_pending_feedbacks() -> list:
    """Load feedbacks from buffer file or mock pending dataset."""
    feedbacks = []
    if BUFFER_FILE.exists():
        try:
            with open(BUFFER_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                feedbacks.extend([d for d in data if d.get("status", "pending") == "pending"])
        except Exception as e:
            print(f"Error reading buffer file: {e}", file=sys.stderr)
    return feedbacks


def mark_feedbacks_triaged(triaged_ids: list):
    """Update buffer file records to triaged."""
    if not BUFFER_FILE.exists():
        return
    try:
        with open(BUFFER_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        for item in data:
            if item.get("id") in triaged_ids:
                item["status"] = "triaged"
                item["triagedAt"] = datetime.now().isoformat()
        with open(BUFFER_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error updating buffer: {e}", file=sys.stderr)


def update_backlog(triaged_items: list):
    """Write or append structured action items to FEEDBACK_ACTION_ITEMS.md."""
    BACKLOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    existing_content = ""
    if BACKLOG_FILE.exists():
        existing_content = BACKLOG_FILE.read_text(encoding="utf-8")
    else:
        existing_content = "# 📋 SpotLi User Feedback Action Items & Bug Backlog\n\n> Auto-generated and triaged by SpotLi Feedback Automation.\n\n---\n"

    new_entries = []
    for item in triaged_items:
        files_md = ", ".join([f"`{f}`" for f in item["suggested_files"]])
        checklist_md = "\n".join([f"- [ ] {task}" for task in item["action_items"]])
        user_str = item["user"]

        entry = f"""
### {item['urgency_emoji']} [{item['priority']}] {item['domain']}: {item['message'][:60]}...
* **ID**: `{item['id']}`
* **Category**: `{item['type']}` | **Rating**: ⭐ {item['rating']}/5 | **App Version**: `{item['appVersion']}`
* **Reported by**: {user_str}
* **Date**: {item['timestamp']}
* **User Feedback**:
  > "{item['message']}"
* **Affected Components**: {files_md}
* **Generated Action Items**:
{checklist_md}

---
"""
        new_entries.append(entry)

    updated_content = existing_content + "\n" + "\n".join(new_entries)
    BACKLOG_FILE.write_text(updated_content, encoding="utf-8")
    print(f"✅ Updated backlog at: {BACKLOG_FILE}")


def send_telegram_alert(triaged_items: list):
    """Send formatted alert to Telegram."""
    try:
        cfg = get_config()
        if not cfg.get("bot_token") or not cfg.get("chat_id"):
            print("ℹ️ Telegram credentials not configured, skipping notification.")
            return

        sender = TelegramSender(cfg["bot_token"], cfg["chat_id"])
        
        msg_lines = [
            f"🔔 <b>SpotLi Feedback Triage ({len(triaged_items)} new)</b>\n"
        ]
        for item in triaged_items:
            msg_lines.append(
                f"{item['urgency_emoji']} <b>[{item['priority']}]</b> {item['domain']}\n"
                f"💬 <i>\"{item['message'][:80]}\"</i>\n"
                f"⭐ Rating: {item['rating']}/5 | v{item['appVersion']}\n"
                f"🎯 Action: <code>{item['action_items'][0]}</code>\n"
            )
        msg_lines.append(f"\n📋 Full Backlog: <code>.agents/backlog/FEEDBACK_ACTION_ITEMS.md</code>")
        
        full_msg = "\n".join(msg_lines)
        sender.send_message(full_msg)
        print("🚀 Telegram alert dispatched successfully.")
    except Exception as e:
        print(f"Warning: Failed to send Telegram alert: {e}", file=sys.stderr)


def run_triage(feedbacks: list = None, dry_run: bool = False):
    """Main execution function."""
    items_to_process = feedbacks or load_pending_feedbacks()
    if not items_to_process:
        print("✨ No pending feedback items found to triage.")
        return []

    print(f"🔍 Processing {len(items_to_process)} feedback items...")
    triaged = [parse_feedback_item(item) for item in items_to_process]

    for t in triaged:
        print(f"  - [{t['priority']}] {t['domain']}: {t['message'][:40]}...")

    if not dry_run:
        update_backlog(triaged)
        send_telegram_alert(triaged)
        mark_feedbacks_triaged([t["id"] for t in triaged])
    else:
        print("🔍 Dry run complete. No files or remote notifications modified.")

    return triaged


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SpotLi Feedback Triage Automation")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--dry-run", action="store_true", help="Parse and log without writing")
    parser.add_argument("--mock-sample", action="store_true", help="Seed a sample feedback for testing")
    args = parser.parse_args()

    if args.mock_sample:
        sample_feedback = [
            {
                "id": f"fb-{int(datetime.now().timestamp())}-1",
                "status": "pending",
                "type": "bug",
                "message": "כשמזינים מספר מעקב של דואר ישראל האפליקציה קורסת בנייד",
                "rating": 1,
                "appVersion": "0.2.0-alpha",
                "user": "Anonymous Tester",
                "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
                "timestamp": datetime.now().isoformat()
            },
            {
                "id": f"fb-{int(datetime.now().timestamp())}-2",
                "status": "pending",
                "type": "feature",
                "message": "Would love an option to export package tracking history to CSV or PDF",
                "rating": 5,
                "appVersion": "0.2.0-alpha",
                "user": "Anonymous Tester",
                "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                "timestamp": datetime.now().isoformat()
            }
        ]
        BUFFER_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(BUFFER_FILE, "w", encoding="utf-8") as f:
            json.dump(sample_feedback, f, indent=2, ensure_ascii=False)
        print(f"🌱 Seeded sample feedbacks in {BUFFER_FILE}")

    run_triage(dry_run=args.dry_run)
