#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
iterations="${1:-5}"

if ! [[ "$iterations" =~ ^[1-9][0-9]*$ ]]; then
  printf 'Usage: %s [positive-iteration-count] [once.sh options]\n' "$0" >&2
  exit 1
fi

shift || true

for ((iteration = 1; iteration <= iterations; iteration += 1)); do
  printf '\n=== Ralph iteration %s/%s ===\n' "$iteration" "$iterations"

  "$SCRIPT_DIR/once.sh"
  status=$?

  if [[ $status -eq 3 ]]; then
    printf 'Ralph stopped: no ready local issues remain.\n'
    exit 0
  fi

  if [[ $status -ne 0 ]]; then
    printf 'Ralph stopped after iteration %s with status %s.\n' "$iteration" "$status" >&2
    exit "$status"
  fi
done
