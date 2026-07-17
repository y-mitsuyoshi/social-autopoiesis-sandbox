#!/usr/bin/env bash
# goal.sh — ゴール指向の自動実行ループハーネス
# 使い方: ./.shared-agents/harness/goal.sh "<goal-description>"
#
# このスクリプトは任意の CLI エージェント (opencode / claude / antigravity) を
# 優先順に呼び出し、/goal コマンドを介して PRD→TechSpec→実装→レビュー→QA の
# 自律ループを起動します。エージェントが選択した場合はスクリプト本体は
# プロンプトの発火のみ行い、ループの実態はエージェント内で完結します。

set -euo pipefail

readonly GOAL="${1:?"使い方: goal.sh \"<goal-description>\""}"
readonly SHARED_DIR="$(cd "$(dirname "$0")/.." && pwd)"
readonly WORKSPACE_DIR="$(cd "${SHARED_DIR}/.." && pwd)"
readonly GOAL_CMD="${SHARED_DIR}/commands/goal.md"

if [[ ! -f "$GOAL_CMD" ]]; then
  echo "エラー: /goal コマンド定義が見つかりません: $GOAL_CMD" >&2
  exit 1
fi

# コマンドファイルから frontmatter を取り除き、本文をプロンプト化する
build_prompt() {
  awk 'BEGIN{infm=0} /^---$/{infm++; next} infm>=2{print}' "$GOAL_CMD"
}

readonly PROMPT_TEMPLATE="$(build_prompt)"
readonly PROMPT="${PROMPT_TEMPLATE}\n\n## ユーザーが指定した目標\n${GOAL}"

run_opencode() {
  if command -v opencode &>/dev/null; then
    echo "[harness] opencode で /goal ループを起動中..."
    opencode --prompt "$PROMPT"
    return $?
  fi
  return 1
}

run_claude() {
  if command -v claude &>/dev/null; then
    echo "[harness] claude code で /goal ループを起動中..."
    claude --allowedTools "Bash, Edit, Read, Glob, Grep, Write, WebFetch" \
      --prompt "$PROMPT"
    return $?
  fi
  return 1
}

run_antigravity() {
  if command -v antigravity &>/dev/null; then
    echo "[harness] antigravity で /goal ループを起動中..."
    antigravity run --prompt "$PROMPT"
    return $?
  fi
  return 1
}

echo "=== Goal Execution Harness ==="
echo "目標: ${GOAL}"
echo "ワークスペース: ${WORKSPACE_DIR}"
echo

run_opencode || run_claude || run_antigravity || {
  echo "エラー: サポートされているエージェントツールが見つかりません (opencode, claude, antigravity)。" >&2
  exit 1
}