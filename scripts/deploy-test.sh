#!/usr/bin/env bash
# Build nc-projects and deploy it into the test Nextcloud.
# Run from the repo root:  bash scripts/deploy-test.sh
# Never touches the live server: it refuses any container that is not compose
# project nc-projects-test. There is no live-install script on purpose.
set -euo pipefail
cd "$(dirname "$0")/.."

SERVICE="nextcloud"
DC="docker compose -p nc-projects-test -f test-env/compose.yaml"
occ() { $DC exec -T -u www-data "$SERVICE" php occ "$@"; }

echo "1/5 Building the app (npm ci && npm run build)"
npm ci
npm run build

echo "2/5 Finding the running test container"
CID="$($DC ps --status running -q "$SERVICE" 2>/dev/null || true)"
if [ -z "$CID" ]; then
  echo "test container is not running: run bash test-env/setup.sh" >&2
  exit 1
fi
PROJECT="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$CID")"
if [ "$PROJECT" != "nc-projects-test" ]; then
  echo "refusing to deploy: container $CID is compose project '$PROJECT', not nc-projects-test" >&2
  exit 1
fi

RECOVER_MSG="run 'bash test-env/recover.sh', or reset the test container with 'bash test-env/reset.sh' then 'bash test-env/setup.sh'"

NEW_VERSION="$(sed -n 's:.*<version>\(.*\)</version>.*:\1:p' appinfo/info.xml | head -n1 | tr -d '[:space:]')"
if [ -z "$NEW_VERSION" ]; then
  echo "could not read <version> from appinfo/info.xml" >&2
  exit 1
fi

INSTALLED_VERSION="$(occ config:app:get cc_projects installed_version 2>/dev/null || true)"
INSTALLED_VERSION="$(printf '%s' "$INSTALLED_VERSION" | tr -d '[:space:]')"
if [ -n "$INSTALLED_VERSION" ] && [ "$INSTALLED_VERSION" != "$NEW_VERSION" ] && [ "$(printf '%s\n%s\n' "$INSTALLED_VERSION" "$NEW_VERSION" | sort -V | head -n1)" = "$NEW_VERSION" ]; then
  echo "installed version $INSTALLED_VERSION is newer than $NEW_VERSION: $RECOVER_MSG" >&2
  exit 1
fi

echo "3/5 Copying the app into the test container"
for d in appinfo lib templates img js css; do
  if [ ! -e "$d" ]; then
    echo "missing $d; did the build fail?" >&2
    exit 1
  fi
  docker exec "$CID" mkdir -p "/var/www/html/custom_apps/cc_projects/$d"
  docker cp "$d/." "$CID:/var/www/html/custom_apps/cc_projects/$d/"
done
docker exec "$CID" chown -R www-data:www-data /var/www/html/custom_apps/cc_projects

echo "4/5 Enabling cc_projects"
occ app:enable cc_projects
echo "cc_projects deployed to the test container"

echo "5/5 Bumping the theming cachebuster (not the app version)"
CURRENT="$(occ config:app:get theming cachebuster 2>/dev/null || true)"
CURRENT="$(printf '%s' "$CURRENT" | tr -d '[:space:]')"
case "$CURRENT" in
  ''|*[!0-9]*) CURRENT=0 ;;
esac
NEXT=$((10#$CURRENT + 1))
occ config:app:set theming cachebuster --value="$NEXT"
echo "theming cachebuster: $NEXT"

STATUS_URL="http://127.0.0.1:${NC_TEST_PORT:-8089}/status.php"
status_clean() {
  printf '%s' "$1" | grep -Eq '"maintenance": ?false' &&
    printf '%s' "$1" | grep -Eq '"needsDbUpgrade": ?false'
}
STATUS="$(curl -sS --max-time 5 "$STATUS_URL" 2>/dev/null || true)"
if ! status_clean "$STATUS"; then
  echo "status.php is not clean (or unreachable): running test-env/recover.sh" >&2
  bash test-env/recover.sh || true
  STATUS="$(curl -sS --max-time 5 "$STATUS_URL" 2>/dev/null || true)"
  if ! status_clean "$STATUS"; then
    echo "test container is still not clean after recover.sh (status.php empty or not maintenance:false and needsDbUpgrade:false): $RECOVER_MSG" >&2
    exit 1
  fi
fi
