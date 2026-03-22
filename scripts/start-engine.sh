#!/bin/bash
# Update these paths for your environment
PRECEPT_DIR="$HOME/PRECEPT"
BUN="$HOME/.bun/bin/bun"

export PATH="$HOME/.bun/bin:/usr/local/bin:$PATH"
cd "$PRECEPT_DIR"
exec "$BUN" run --cwd packages/engine dev
