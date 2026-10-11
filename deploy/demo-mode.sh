#!/usr/bin/env bash
# Switch the playable DEMO movement between 20x (default, cheap) and 50x (owner says "demo now").
# Run from the operator machine: deploy/demo-mode.sh 50   |   deploy/demo-mode.sh 20
# Sets DEMO_MULTIPLIER in the worker env, restarts the worker and waits for green health.
# The DEMO anchor carries the current target forward on a change, so open ranges never jump.
set -euo pipefail
mode="${1:-}"
if [[ "$mode" != "20" && "$mode" != "50" ]]; then
  echo "usage: $0 20|50" >&2
  exit 2
fi
host="${MONADBOY_SSH:-perago-vps}"
# SSH overrides the client binary (Windows Git Bash: SSH=/c/Windows/System32/OpenSSH/ssh.exe).
health="${MONADBOY_HEALTH:-https://monadboy-api.43.129.38.115.sslip.io/v1/health}"
env_file=/opt/monadboy/apps/worker/.env

# /opt/monadboy is not listable by the login user; run from /tmp and edit through sudo.
"${SSH:-ssh}" "$host" "cd /tmp && sudo sed -i '/^DEMO_MULTIPLIER=/d' $env_file \
  && echo 'DEMO_MULTIPLIER=$mode' | sudo tee -a $env_file >/dev/null \
  && sudo systemctl restart monadboy-worker"

for _ in $(seq 1 30); do
  sleep 3
  body="$(curl -fsS "$health" 2>/dev/null || true)"
  [[ -z "$body" ]] && continue
  status="$(printf '%s' "$body" | sed -n 's/^{"status":"\([a-z]*\)".*/\1/p')"
  multiplier="$(printf '%s' "$body" | sed -n 's/.*"multiplier":\([0-9]*\).*/\1/p')"
  if [[ "$status" == "green" && "$multiplier" == "$mode" ]]; then
    echo "DEMO x$multiplier live; health green"
    exit 0
  fi
done
echo "health did not report green with multiplier $mode within 90 s; last: ${status:-unreachable} x${multiplier:-?}" >&2
exit 1
