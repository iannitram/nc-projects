#!/usr/bin/env bash
# Bring the nc-projects test Nextcloud back after a stop, a Docker restart or an
# interrupted upgrade. Safe to run at any time; it never wipes data.
# Run from the repo root:  bash test-env/recover.sh
set -euo pipefail
cd "$(dirname "$0")"

PORT="${NC_TEST_PORT:-8089}"
URL="http://127.0.0.1:$PORT/status.php"
DC="docker compose -p nc-projects-test -f compose.yaml"
occ() { $DC exec -T -u www-data nextcloud php occ "$@"; }

status_code="000"
status_body=""
probe() {
  local out
  out="$(curl -sS --max-time 5 -w $'\n%{http_code}' "$URL" 2>/dev/null)" || true
  status_code="${out##*$'\n'}"
  status_body="${out%$'\n'*}"
  [ -n "$status_code" ] || status_code="000"
}

echo "1/3 Starting the container if it is not running"
if [ -z "$($DC ps --status running -q nextcloud 2>/dev/null || true)" ]; then
  $DC up -d
else
  echo "   already running"
fi

echo "2/3 Waiting for $URL"
for i in $(seq 1 60); do
  probe
  [ "$status_code" != "000" ] && break
  sleep 2
  [ "$i" = 60 ] && { echo "No answer from $URL after 2 minutes"; exit 1; }
done

# A 503 (or "maintenance":true) means maintenance mode is still on.
if [ "$status_code" = "503" ] || printf '%s' "$status_body" | grep -q '"maintenance":true'; then
  echo "   Maintenance mode is on; turning it off"
  occ maintenance:mode --off
  probe
fi

if printf '%s' "$status_body" | grep -q '"needsDbUpgrade":true'; then
  echo "   Database upgrade needed; running occ upgrade"
  occ upgrade
  probe
fi

echo "3/3 Status"
occ status | grep -E "versionstring|installed"
