#!/usr/bin/env python3
"""
Deliveree Telegram CLI & Agent Helper.
- Autonomous send (via direct API or zero-permission local outbox queue).
- Interactive question & inline buttons (--ask).
- Inbox inspection and health verification.
"""

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from telegram_bridge import TelegramSender, get_config, queue_message


def ask_via_daemon(root_dir: Path, question: str, options: list[str], timeout_s: int) -> str:
    """Write question spec for daemon, wait for daemon to write answer."""
    agents_dir = root_dir / ".agents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    ask_file = agents_dir / "tg_ask.json"
    ans_file = agents_dir / "tg_answer.txt"

    # Remove stale answer
    if ans_file.exists():
        ans_file.unlink()

    # Write spec for daemon to pick up
    ask_file.write_text(
        json.dumps({"question": question, "options": options}),
        encoding="utf-8"
    )
    print(f"📤 Question posted for daemon. Waiting up to {timeout_s}s for response...", flush=True)

    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if ans_file.is_file():
            answer = ans_file.read_text(encoding="utf-8").strip()
            ans_file.unlink()
            return answer
        time.sleep(0.5)

    # Timed out — clean up
    if ask_file.exists():
        ask_file.unlink()
    print("⌛ Timed out waiting for response.", file=sys.stderr, flush=True)
    return ""


def main():
    parser = argparse.ArgumentParser(description="SpotLi Telegram CLI")
    parser.add_argument("--send",    "-s",  help="Send a message directly via Telegram API")
    parser.add_argument("--queue",   "-q",  help="Queue message via .agents/tg_outbox.jsonl (Zero network permissions needed)")
    parser.add_argument("--photo",   "-p",  help="Send a photo directly via Telegram API")
    parser.add_argument("--caption", "-c",  help="Caption for photo")
    parser.add_argument("--ask",     "-a",  help="Ask a question (daemon sends to user and waits for reply/button)")
    parser.add_argument("--options", "-o",  help="Comma-separated button options (e.g. 'Approve,Reject')")
    parser.add_argument("--timeout",        type=int, default=300, help="Timeout seconds for --ask")
    parser.add_argument("--test",           action="store_true", help="Send a test message")
    parser.add_argument("--pair",           action="store_true", help="Pair bot (one-time setup)")
    parser.add_argument("--inbox",          action="store_true", help="Read recent messages from .agents/inbox.jsonl")
    args = parser.parse_args()

    config    = get_config()
    token     = config["bot_token"]
    chat_id   = config["chat_id"]
    root_dir  = config["root_dir"]

    if args.queue:
        ok = queue_message(args.queue, root_dir=root_dir)
        if ok:
            print("✅ Message queued into .agents/tg_outbox.jsonl for autonomous dispatch.")
            sys.exit(0)
        sys.exit(1)

    if args.inbox:
        inbox_file = root_dir / ".agents" / "inbox.jsonl"
        if not inbox_file.is_file():
            print("📭 Inbox is empty.")
            sys.exit(0)
        lines = [json.loads(l) for l in inbox_file.read_text(encoding="utf-8").splitlines() if l.strip()]
        for entry in lines[-10:]:
            print(f"[{entry.get('timestamp')}] {entry.get('sender')}: {entry.get('message')}")
        sys.exit(0)

    if not token:
        print("❌ Missing TELEGRAM_BOT_TOKEN in .env.local", file=sys.stderr)
        sys.exit(1)

    sender = TelegramSender(token=token, chat_id=chat_id)

    if args.pair:
        import urllib.request
        res = json.loads(urllib.request.urlopen(
            f"https://api.telegram.org/bot{token}/getMe"
        ).read())
        if res.get("ok"):
            bot = res["result"]
            print(f"✅ Bot: @{bot['username']} — send /start to it, then set TELEGRAM_CHAT_ID manually.")
        else:
            print("❌ Invalid token")
            sys.exit(1)
        sys.exit(0)

    if not chat_id:
        print("❌ Missing TELEGRAM_CHAT_ID in .env.local. Run --pair first.", file=sys.stderr)
        sys.exit(1)

    if args.test:
        ok = sender.send_message("🎉 <b>SpotLi Telegram Bridge — test OK!</b>")
        if ok:
            print("✅ Test message sent successfully.")
        sys.exit(0 if ok else 1)

    if args.photo:
        ok = sender.send_photo(args.photo, caption=args.caption)
        if ok:
            print("✅ Photo sent successfully.")
        sys.exit(0 if ok else 1)

    if args.send:
        ok = sender.send_message(args.send)
        if ok:
            print("✅ Message sent successfully.")
        sys.exit(0 if ok else 1)

    if args.ask:
        options = [o.strip() for o in args.options.split(",")] if args.options else []
        answer  = ask_via_daemon(root_dir, args.ask, options, args.timeout)
        if answer:
            print(f"USER_RESPONSE:{answer}")
            sys.exit(0)
        sys.exit(1)

    parser.print_help()


if __name__ == "__main__":
    main()
