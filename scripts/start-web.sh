#!/bin/bash
# Update these paths for your environment
PRECEPT_DIR="$HOME/PRECEPT"
BUN="$HOME/.bun/bin/bun"

cd "$PRECEPT_DIR/packages/web"
"$BUN" run build && exec "$BUN" run start
