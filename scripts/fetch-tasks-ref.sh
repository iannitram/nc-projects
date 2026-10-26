#!/usr/bin/env sh
# Shallow-clone the Nextcloud Tasks app at the version the live server runs,
# into reference/tasks (git-ignored), for reading how Tasks handles VTODOs.
# Usage: scripts/fetch-tasks-ref.sh [tag]   (default v0.18.1)
set -eu
TAG="${1:-v0.18.1}"
DEST="$(dirname "$0")/../reference/tasks"
if [ -d "$DEST/.git" ]; then
  echo "reference/tasks already exists ($(git -C "$DEST" describe --tags 2>/dev/null || echo unknown)); delete it to re-fetch."
  exit 0
fi
git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$TAG" https://github.com/nextcloud/tasks "$DEST"
echo "Tasks $TAG in reference/tasks"
