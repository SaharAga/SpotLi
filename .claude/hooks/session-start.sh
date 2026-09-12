#!/bin/bash
#
# Installs everything a session needs to run the full verification set.
#
# The root `npm ci` does not reach functions/, which carries its own
# package.json and vitest config — so a fresh checkout fails 9 Cloud Functions
# suites with "Cannot find package 'firebase-functions/v2/https'" until someone
# notices and installs it separately. CI does not catch this (its Cloud
# Functions job installs its own deps); it only bites whoever runs the whole
# suite locally.
#
# `npm install`, not `npm ci`: the container image is cached after this hook
# completes, and install reuses an existing node_modules instead of deleting
# and refetching it.
set -euo pipefail

# Remote (web) sessions only — a local checkout manages its own environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

echo "[session-start] installing root dependencies…"
npm install --no-audit --no-fund

echo "[session-start] installing functions/ dependencies…"
npm install --prefix functions --no-audit --no-fund

echo "[session-start] done."
