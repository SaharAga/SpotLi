#!/usr/bin/env python3
"""
SpotLi Continuous Feedback Daemon.
Runs in background, periodically checking for new pending feedback items
and running autonomous triage and notification generation.
"""

import time
import sys
import argparse
from pathlib import Path
from feedback_triage import run_triage

DEFAULT_INTERVAL_SECONDS = 120  # 2 minutes


def start_daemon(interval: int = DEFAULT_INTERVAL_SECONDS):
    print(f"🚀 SpotLi Feedback Daemon started (polling interval: {interval}s)...")
    try:
        while True:
            try:
                run_triage()
            except Exception as e:
                print(f"⚠️ Error during feedback triage cycle: {e}", file=sys.stderr)
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n🛑 SpotLi Feedback Daemon stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SpotLi Feedback Background Daemon")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL_SECONDS, help="Polling interval in seconds")
    args = parser.parse_args()
    start_daemon(interval=args.interval)
