#!/bin/bash
cd "$(git rev-parse --show-toplevel)"
npx tsx packages/engine/src/db/skill-sync.ts
