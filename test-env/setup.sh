#!/usr/bin/env bash
# Build the nc-projects test Nextcloud and load the fixture lists.
# Run from the repo root:  bash test-env/setup.sh
# Re-running is safe; to start clean:  bash test-env/reset.sh
set -euo pipefail
cd "$(dirname "$0")"

PORT="${NC_TEST_PORT:-8089}"
TASKS_VERSION="0.18.1"
TASKS_URL="https://github.com/nextcloud/tasks/releases/download/v${TASKS_VERSION}/tasks.tar.gz"
DC="docker compose -p nc-projects-test -f compose.yaml"
# Run a command; retry when SQLite reports "database is locked" (5 tries, 3 s apart).
retry_locked() {
  local out rc n=1
  while :; do
    rc=0
    out="$("$@" 2>&1)" || rc=$?
    if [ "$rc" -eq 0 ] || ! printf '%s' "$out" | grep -q "database is locked" || [ "$n" -ge 5 ]; then
      [ -n "$out" ] && printf '%s\n' "$out"
      return "$rc"
    fi
    n=$((n + 1)); sleep 3
  done
}
occ() { retry_locked $DC exec -T -u www-data nextcloud php occ "$@"; }

echo "1/5 Starting the container (port $PORT)"
$DC up -d

echo "2/5 Waiting for Nextcloud to finish installing"
for i in $(seq 1 120); do
  if occ status --output=json 2>/dev/null | grep -q '"installed":true'; then break; fi
  sleep 5
  [ "$i" = 120 ] && { echo "Nextcloud did not finish installing in 10 minutes"; exit 1; }
done
occ status | grep -E "versionstring|installed"

echo "3/5 Installing Tasks $TASKS_VERSION"
if [ -n "${TASKS_APP_DIR:-}" ]; then
  # A local copy of the app (folder holding appinfo/), e.g. built from source.
  $DC cp "$TASKS_APP_DIR" nextcloud:/var/www/html/custom_apps/tasks
  $DC exec -T nextcloud chown -R www-data:www-data /var/www/html/custom_apps/tasks
elif ! occ app:list --output=json | grep -q '"tasks":'; then
  $DC exec -T nextcloud sh -c "curl -fsSL '$TASKS_URL' | tar -xz -C /var/www/html/custom_apps && chown -R www-data:www-data /var/www/html/custom_apps/tasks" \
    || echo "   Could not download the pinned release; falling back to the app store (version checked below)"
fi
occ app:list --output=json | grep -q '"tasks":' || occ app:install tasks || true
occ app:enable tasks || true
GOT="$(occ app:list --output=json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("enabled",{}).get("tasks") or d.get("disabled",{}).get("tasks") or "missing")')"
if [ "$GOT" = "$TASKS_VERSION" ]; then echo "   Tasks $GOT enabled"; else echo "   WARNING: Tasks is '$GOT', not $TASKS_VERSION. Checks that compare with Tasks are not valid until this is fixed."; fi

echo "4/5 Creating test users (owner, other, agent) and the Deck board"
# user:add with the lock retry. A "database is locked" error can come after the user was
# written, so a retry that then reports "already exists" counts as success, but only when
# this same user's add hit the lock first.
add_user() {
  local u="$1" out rc locked=0 n=1
  while :; do
    rc=0
    out="$($DC exec -T -u www-data -e OC_PASS="$u-test-only" nextcloud php occ user:add --password-from-env --display-name="Test $u" "$u" 2>&1)" || rc=$?
    [ "$rc" -eq 0 ] && return 0
    if printf '%s' "$out" | grep -q "database is locked" && [ "$n" -lt 5 ]; then
      locked=1; n=$((n + 1)); sleep 3; continue
    fi
    if [ "$locked" = 1 ] && printf '%s' "$out" | grep -q "already exists"; then return 0; fi
    printf '%s\n' "$out"
    return 1
  done
}
for u in owner other agent; do
  occ user:info "$u" >/dev/null 2>&1 || add_user "$u"
done
DECK=0
if occ app:list --output=json | grep -q '"deck":' || occ app:install deck >/dev/null 2>&1; then
  occ app:enable deck >/dev/null 2>&1 && DECK=1
fi
if [ "$DECK" != 1 ]; then
  echo "   ERROR: Deck could not be installed or enabled; the Deck-board fixture needs it." >&2
  exit 1
fi

echo "5/5 Loading the fixture lists and tasks"
python3 seed.py --base "http://127.0.0.1:$PORT" --deck "$DECK"
echo
echo "Ready: http://127.0.0.1:$PORT  (log in as owner / owner-test-only)"
