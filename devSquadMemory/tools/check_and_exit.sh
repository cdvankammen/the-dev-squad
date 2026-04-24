#!/usr/bin/env bash
# Run dedupe and exit non-zero if duplicates remain
set -euo pipefail
python3 "$(pwd)/devSquadMemory/tools/dedupe_tools.py"
SUMMARY_FILE="$(pwd)/devSquadMemory/diagnostics/merged_summary.txt"
if [ ! -f "$SUMMARY_FILE" ]; then
  echo "merged summary not found"
  exit 1
fi
NUM=$(grep -E "^Names with multiple sources:" "$SUMMARY_FILE" | awk -F: '{print $2}' | tr -d ' ')
if [ -z "$NUM" ]; then
  echo "Could not parse summary; inspect $SUMMARY_FILE"
  exit 1
fi
if [ "$NUM" -gt 0 ]; then
  echo "Duplicates detected: $NUM"
  exit 2
else
  echo "No duplicates detected"
  exit 0
fi
