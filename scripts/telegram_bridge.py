#!/usr/bin/env python3
"""
Deliveree Telegram Bridge — Shared utilities (sending, queueing, formatting).
Provides direct send (TelegramSender) and zero-permission file queueing (queue_message).
"""

import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timezone


def load_env_file(filepath: Path) -> dict:
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
                env_vars[key.strip()] = val.strip().strip("\"'")
    return env_vars


def get_config():
    root_dir = Path(__file__).resolve().parent.parent
    env_local = load_env_file(root_dir / ".env.local")
    env_main  = load_env_file(root_dir / ".env")
    merged = {**env_main, **env_local, **os.environ}
    return {
        "bot_token": merged.get("TELEGRAM_BOT_TOKEN", "").strip(),
        "chat_id":   merged.get("TELEGRAM_CHAT_ID", "").strip(),
        "root_dir":  root_dir,
    }


def queue_message(text: str, reply_markup: dict = None, root_dir: Path = None) -> bool:
    """
    Autonomous zero-permission message queueing.
    Writes the outbound message to .agents/tg_outbox.jsonl.
    The persistent background daemon picks it up and sends it to Telegram.
    Requires NO network permissions in the agent sandbox.
    """
    if root_dir is None:
        root_dir = Path(__file__).resolve().parent.parent
    outbox_file = root_dir / ".agents" / "tg_outbox.jsonl"
    outbox_file.parent.mkdir(parents=True, exist_ok=True)

    entry = {
        "id": f"msg_{int(time.time()*1000)}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "text": text,
        "reply_markup": reply_markup,
    }

    with open(outbox_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    return True


class TelegramSender:
    """Stateless sender — only POST requests, never polls getUpdates."""

    def __init__(self, token: str, chat_id: str = ""):
        self.token   = token
        self.chat_id = chat_id
        self.base    = f"https://api.telegram.org/bot{token}"

    def _post(self, endpoint: str, data: dict = None, timeout: int = 30):
        url  = f"{self.base}/{endpoint}"
        body = json.dumps(data or {}).encode("utf-8")
        req  = urllib.request.Request(
            url, data=body,
            headers={"Content-Type": "application/json", "User-Agent": "SpotLiAgent/2.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_msg = ""
            try:
                err_msg = json.loads(e.read().decode("utf-8", errors="ignore")).get("description", str(e))
            except Exception:
                err_msg = str(e)
            print(f"❌ Telegram API Error ({e.code}): {err_msg}")
            return {"ok": False, "error_code": e.code, "description": err_msg}
        except Exception as exc:
            print(f"❌ Request error: {exc}")
            return {"ok": False, "description": str(exc)}

    def send_message(self, text: str, reply_markup: dict = None, chat_id: str = None) -> bool:
        target_chat = chat_id or self.chat_id
        payload = {
            "chat_id":    target_chat,
            "text":       text,
            "parse_mode": "HTML",
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        res = self._post("sendMessage", payload)
        if res and res.get("ok"):
            return True

        # Fallback: If HTML entity parsing fails, retry as plain text
        if res and "can't parse entities" in res.get("description", "").lower():
            plain_payload = {
                "chat_id": target_chat,
                "text":    text,
            }
            if reply_markup:
                plain_payload["reply_markup"] = reply_markup
            res_plain = self._post("sendMessage", plain_payload)
            return bool(res_plain and res_plain.get("ok"))

        return False

    def send_photo(self, photo_path: str, caption: str = None, chat_id: str = None) -> bool:
        path = Path(photo_path)
        if not path.is_file():
            print(f"❌ Photo not found: {photo_path}")
            return False
        target_chat = chat_id or self.chat_id
        boundary = f"----Boundary{int(time.time()*1000)}"
        body = bytearray()

        def field(name, value):
            body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode())

        field("chat_id", target_chat)
        if caption:
            field("caption", caption)
            field("parse_mode", "HTML")
        body.extend(f"--{boundary}\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"{path.name}\"\r\nContent-Type: image/png\r\n\r\n".encode())
        body.extend(path.read_bytes())
        body.extend(f"\r\n--{boundary}--\r\n".encode())
        req = urllib.request.Request(
            f"{self.base}/sendPhoto", data=bytes(body),
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "DelivereeAgent/2.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=40) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                return bool(res and res.get("ok"))
        except Exception as exc:
            print(f"❌ Photo upload error: {exc}")
            return False

    def answer_callback(self, cb_id: str, text: str = ""):
        self._post("answerCallbackQuery", {"callback_query_id": cb_id, "text": text})
