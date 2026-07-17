#!/usr/bin/env bash
# claude-bash-guard.sh — PreToolUse hook for Claude Code
# 標準入力から tool input JSON を読み、危険な bash コマンドをブロックする。
# ブロック時は exit 2（Claude Code の PreToolUse deny 規約）。

set -euo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"

if [[ -z "$cmd" ]]; then
  exit 0
fi

dangerous_patterns=(
  'rm -rf /'
  'rm -rf /*'
  'git push --force.*main'
  'git push --force.*master'
  ':(){.*|.*&};'
)

for pattern in "${dangerous_patterns[@]}"; do
  if [[ "$cmd" =~ $pattern ]]; then
    echo "[claude-bash-guard] BLOCKED dangerous command: $cmd" >&2
    exit 2
  fi
done

exit 0