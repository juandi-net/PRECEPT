#!/bin/bash
# Create a pull request. Run from the repo directory.
# Usage: github_pr.sh "PR title" "PR body" [base_branch]
set -euo pipefail

TITLE="$1"
BODY="${2:-}"
BASE="${3:-main}"
# Use WORKSPACE_DIR directly if it's already a git repo (worktree), else try /repo subdir
REPO_DIR="${WORKSPACE_DIR:-$(pwd)}"
if [ ! -d "$REPO_DIR/.git" ] && [ -d "$REPO_DIR/repo/.git" ]; then
  REPO_DIR="$REPO_DIR/repo"
fi

cd "$REPO_DIR"

if ! command -v gh &> /dev/null; then
  echo "ERROR: gh CLI not installed"
  exit 1
fi

gh pr create --title "$TITLE" --body "$BODY" --base "$BASE" 2>&1
