#!/usr/bin/env bash
set -euo pipefail

# Copy a small set of skills from the user's local skills-unified repo into
# the devSquadMemory `skills_local` folder for safe inspection and optional
# installation into OpenClaw. This script performs only file copies — it does
# not run any remote installers or execute code.

SKILLS_ROOT="/Users/stillbulldog35/Documents/workgithub/skills-unified"
DEST_ROOT="$(pwd)/devSquadMemory/skills_local"

SKILLS=(
  rag-implementer
  langchain-dependencies
  claude-peers-mcp
  openclaw-control-center
)

mkdir -p "$DEST_ROOT"

for s in "${SKILLS[@]}"; do
  src="$SKILLS_ROOT/$s"
  dest="$DEST_ROOT/$s"
  if [ -d "$src" ]; then
    echo "Copying $s from $src -> $dest"
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -R "$src"/* "$dest" || true
  else
    echo "[warn] Skill $s not found at $src — skipping"
  fi
done

echo "Done. Review $DEST_ROOT before installing into Claude/OpenClaw."
