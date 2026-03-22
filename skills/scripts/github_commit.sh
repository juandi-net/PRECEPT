#!/bin/bash
# Commit and push changes. Run from the repo directory.
# Usage: github_commit.sh "commit message"
set -euo pipefail

MSG="$1"
# Use WORKSPACE_DIR directly if it's already a git repo (worktree), else try /repo subdir
REPO_DIR="${WORKSPACE_DIR:-$(pwd)}"
if [ ! -d "$REPO_DIR/.git" ] && [ -d "$REPO_DIR/repo/.git" ]; then
  REPO_DIR="$REPO_DIR/repo"
fi

cd "$REPO_DIR"
git add -A
git commit -m "$MSG" 2>&1
git push 2>&1
echo "Committed and pushed: $MSG"
