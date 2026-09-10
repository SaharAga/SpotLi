#!/usr/bin/env python3
"""
SpotLi Admin Feedback Synchronization & Triage CLI Tool.
Fetches feedback items from Cloud Firestore REST API or local storage buffer,
updates .agents/feedback_buffer.json, and executes automated triage via feedback_triage.py.

Usage:
  python3 scripts/feedback_sync.py [--limit N] [--dry-run] [--source {all,buffer,firestore}]
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# Set paths
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
BUFFER_FILE = ROOT_DIR / ".agents" / "feedback_buffer.json"
BACKLOG_FILE = ROOT_DIR / ".agents" / "backlog" / "FEEDBACK_ACTION_ITEMS.md"

sys.path.insert(0, str(SCRIPT_DIR))
from feedback_triage import run_triage, parse_feedback_item


def parse_firestore_field(val_obj: dict):
    """Recursively parses a Firestore REST API typed value object into Python types."""
    if not isinstance(val_obj, dict):
        return val_obj
    
    if "stringValue" in val_obj:
        return val_obj["stringValue"]
    if "integerValue" in val_obj:
        return int(val_obj["integerValue"])
    if "doubleValue" in val_obj:
        return float(val_obj["doubleValue"])
    if "booleanValue" in val_obj:
        return bool(val_obj["booleanValue"])
    if "timestampValue" in val_obj:
        return val_obj["timestampValue"]
    if "nullValue" in val_obj:
        return None
    if "mapValue" in val_obj:
        fields = val_obj.get("mapValue", {}).get("fields", {})
        return {k: parse_firestore_field(v) for k, v in fields.items()}
    if "arrayValue" in val_obj:
        values = val_obj.get("arrayValue", {}).get("values", [])
        return [parse_firestore_field(v) for v in values]
    return val_obj


def fetch_firestore_feedbacks(project_id: str = "deliveree-80c7d", limit: int = 50) -> list:
    """Fetches documents from Firestore /feedback collection via REST API."""
    url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/feedback?pageSize={limit}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "SpotLiFeedbackSync/1.0", "Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            docs = data.get("documents", [])
            results = []
            for doc in docs:
                fields = doc.get("fields", {})
                parsed = {k: parse_firestore_field(v) for k, v in fields.items()}
                doc_name = doc.get("name", "")
                doc_id = doc_name.split("/")[-1] if "/" in doc_name else ""
                if doc_id and not parsed.get("id"):
                    parsed["id"] = doc_id
                results.append(parsed)
            return results
    except Exception as e:
        print(f"ℹ️ Cloud Firestore REST sync notice: {e} (Continuing with local/buffer data)", file=sys.stderr)
        return []


def load_buffer() -> list:
    """Loads existing feedback buffer."""
    if not BUFFER_FILE.exists():
        return []
    try:
        with open(BUFFER_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Error reading feedback buffer: {e}", file=sys.stderr)
        return []


def save_buffer(buffer_items: list):
    """Saves updated feedback buffer."""
    BUFFER_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(BUFFER_FILE, "w", encoding="utf-8") as f:
        json.dump(buffer_items, f, indent=2, ensure_ascii=False)


def sync_feedbacks(limit: int = 50, dry_run: bool = False, source: str = "all") -> list:
    """
    Synchronizes feedback records from Firestore and local buffer,
    updates buffer store, and runs triage.
    """
    print(f"🔄 Starting SpotLi Feedback Sync (source={source}, limit={limit}, dry_run={dry_run})...")

    current_buffer = load_buffer()
    buffer_by_id = {item.get("id"): item for item in current_buffer if item.get("id")}
    
    new_items_count = 0
    synced_items = []

    if source in ("all", "firestore"):
        firestore_items = fetch_firestore_feedbacks(limit=limit)
        print(f"📥 Fetched {len(firestore_items)} records from Cloud Firestore.")
        for item in firestore_items:
            fid = item.get("id")
            if not fid:
                continue
            if fid not in buffer_by_id:
                item.setdefault("status", "pending")
                item.setdefault("syncedToCloud", True)
                buffer_by_id[fid] = item
                new_items_count += 1
                synced_items.append(item)
            else:
                # Merge existing
                buffer_by_id[fid]["syncedToCloud"] = True

    # Get all pending items to triage
    all_merged = list(buffer_by_id.values())
    pending_items = [item for item in all_merged if item.get("status", "pending") == "pending"]

    if not dry_run:
        save_buffer(all_merged)
        print(f"💾 Updated buffer at {BUFFER_FILE} (Total: {len(all_merged)} items, New: {new_items_count}).")
    else:
        print(f"🔍 Dry run: {len(all_merged)} total items ({new_items_count} new, {len(pending_items)} pending).")

    if pending_items:
        print(f"🚀 Running automated triage for {len(pending_items)} pending feedback item(s)...")
        triaged = run_triage(feedbacks=pending_items[:limit], dry_run=dry_run)
        return triaged
    else:
        print("✨ All feedback items are already triaged and up-to-date.")
        return []


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SpotLi Feedback Synchronization & Triage Engine")
    parser.add_argument("--limit", type=int, default=50, help="Maximum number of items to sync/triage")
    parser.add_argument("--dry-run", action="store_true", help="Perform sync and triage without persisting changes")
    parser.add_argument("--source", choices=["all", "buffer", "firestore"], default="all", help="Data source to pull from")
    args = parser.parse_args()

    sync_feedbacks(limit=args.limit, dry_run=args.dry_run, source=args.source)
