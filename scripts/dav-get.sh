#!/usr/bin/env bash
# Print one stored task's raw iCalendar from the TEST container (the spec's
# "read the stored task"). Usage:
#   scripts/dav-get.sh <list-uri> <file.ics> [user]     (user defaults to owner)
#   scripts/dav-get.sh area-a-1 f-mix-old.ics
# Diff two runs to compare stored copies before and after a change.
set -euo pipefail
LIST="$1"; FILE="$2"; USER_="${3:-owner}"
PORT="${NC_TEST_PORT:-8089}"
curl -fsS -u "$USER_:$USER_-test-only" "http://127.0.0.1:$PORT/remote.php/dav/calendars/$USER_/$LIST/$FILE" | tr -d '\r'
