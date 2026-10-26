#!/usr/bin/env bash
# Wipe the test Nextcloud (only the nc-projects-test project and its volume) and rebuild it.
set -euo pipefail
cd "$(dirname "$0")"
docker compose -p nc-projects-test -f compose.yaml down -v
exec bash setup.sh
