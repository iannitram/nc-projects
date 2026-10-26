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
occ() { $DC exec -T -u www-data nextcloud php occ "$@"; }

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
for u in owner other agent; do
  occ user:info "$u" >/dev/null 2>&1 || $DC exec -T -u www-data -e OC_PASS="$u-test-only" nextcloud php occ user:add --password-from-env --display-name="Test $u" "$u"
done
DECK=0
if occ app:list --output=json | grep -q '"deck":' || occ app:install deck >/dev/null 2>&1; then
  occ app:enable deck >/dev/null 2>&1 && DECK=1
fi
[ "$DECK" = 1 ] || echo "   Deck not available: the Deck-board fixture will be skipped"

echo "5/5 Loading the fixture lists and tasks"
python3 seed.py --base "http://127.0.0.1:$PORT" --deck "$DECK"
echo
echo "Ready: http://127.0.0.1:$PORT  (log in as owner / owner-test-only)"
