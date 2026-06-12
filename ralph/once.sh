#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
GIT_COMMON_DIR="$(git -C "$REPO_ROOT" rev-parse --git-common-dir)"
RALPH_STATE_DIR="$(git -C "$REPO_ROOT" rev-parse --git-path ralph)"
RESULT_FILE="$RALPH_STATE_DIR/result.txt"
dry_run="false"
issue_files=()
remaining_issue_files=()

if [[ "$RALPH_STATE_DIR" != /* ]]; then
  RALPH_STATE_DIR="$REPO_ROOT/$RALPH_STATE_DIR"
  RESULT_FILE="$RALPH_STATE_DIR/result.txt"
fi

if [[ "$GIT_COMMON_DIR" != /* ]]; then
  GIT_COMMON_DIR="$REPO_ROOT/$GIT_COMMON_DIR"
fi

if [[ "${1:-}" == "--dry-run" ]]; then
  dry_run="true"
elif [[ $# -gt 0 ]]; then
  printf 'Usage: %s [--dry-run]\n' "$0" >&2
  exit 1
fi

for command_name in codex git vp vpr; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command_name" >&2
    exit 1
  fi
done

while IFS= read -r issue_file; do
  issue_files[${#issue_files[@]}]="$issue_file"
done < <(find "$REPO_ROOT/issues" -maxdepth 1 -type f -name '*.md' | sort)

if [[ ${#issue_files[@]} -eq 0 ]]; then
  printf 'No open local issues remain.\n'
  exit 3
fi

if [[ "$dry_run" == "true" ]]; then
  printf 'Open local issues:\n'
  printf '  %s\n' "${issue_files[@]#"$REPO_ROOT/"}"
  exit 0
fi

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  printf 'Refusing to run in a dirty worktree: %s\n' "$REPO_ROOT" >&2
  exit 1
fi

mkdir -p "$RALPH_STATE_DIR"

starting_head="$(git -C "$REPO_ROOT" rev-parse HEAD)"
starting_issue_count="${#issue_files[@]}"

{
  cat "$SCRIPT_DIR/prompt.md"
  printf '\n# Task context\n\n'
  printf 'Repository: %s\n\n' "$REPO_ROOT"
  printf '## Recent commits\n\n```txt\n'
  git -C "$REPO_ROOT" log -n 8 --format='%H%n%ad%n%B---' --date=short
  printf '\n```\n\n'
  printf '## Open issues\n\n'

  for issue_file in "${issue_files[@]}"; do
    printf '\n### %s\n\n' "${issue_file#"$REPO_ROOT/"}"
    cat "$issue_file"
    printf '\n'
  done

  printf '\n## Completed issue files\n\n```txt\n'
  find "$REPO_ROOT/issues/done" -maxdepth 1 -type f -name '*.md' -print \
    | sed "s|$REPO_ROOT/||" \
    | sort
  printf '```\n'
} | codex exec \
  --cd "$REPO_ROOT" \
  --add-dir "$GIT_COMMON_DIR" \
  --sandbox workspace-write \
  --ask-for-approval never \
  --color always \
  --output-last-message "$RESULT_FILE" \
  -

if grep -q '<promise>NO MORE TASKS</promise>' "$RESULT_FILE"; then
  printf 'Ralph found no ready AFK task.\n'
  exit 3
fi

if ! grep -q '<promise>ISSUE COMPLETE</promise>' "$RESULT_FILE"; then
  printf 'Ralph did not complete an issue. See %s\n' "$RESULT_FILE" >&2
  exit 1
fi

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  printf 'Ralph left uncommitted changes in %s\n' "$REPO_ROOT" >&2
  exit 1
fi

commit_count="$(git -C "$REPO_ROOT" rev-list --count "$starting_head..HEAD")"

if [[ "$commit_count" -ne 1 ]]; then
  printf 'Ralph created %s commits; exactly one is required.\n' "$commit_count" >&2
  exit 1
fi

while IFS= read -r issue_file; do
  remaining_issue_files[${#remaining_issue_files[@]}]="$issue_file"
done < <(find "$REPO_ROOT/issues" -maxdepth 1 -type f -name '*.md' | sort)

if [[ ${#remaining_issue_files[@]} -ne $((starting_issue_count - 1)) ]]; then
  printf 'Ralph must move exactly one issue into issues/done/.\n' >&2
  exit 1
fi

(
  cd "$REPO_ROOT"
  vpr ready
)

printf '\nCompleted one local issue.\n'
printf 'Commit: %s\n' "$(git -C "$REPO_ROOT" log -1 --oneline)"
