#!/bin/bash
# Clone a GitHub repo to workspace. Requires GITHUB_TOKEN env var.
# Usage: github_clone.sh <org/repo>
set -euo pipefail

REPO="$1"
DEST="${WORKSPACE_DIR:-$(pwd)}/repo"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_TOKEN not set"
  exit 1
fi

git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$DEST" 2>&1
echo "Cloned ${REPO} to ${DEST}"
