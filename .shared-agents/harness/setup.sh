#!/usr/bin/env bash
# setup.sh — 共有 AIエージェントハーネスの環境初期化スクリプト
#
# このリポジトリ (social-autopoiesis-sandbox) を AI エージェント設定の
# single source of truth とし、各ツール (OpenCode / Claude Code / Antigravity)
# の設定ディレクトリへシンボリックリンクを張ります。
#
# また OpenCode のスラッシュコマンドはグローバル (~/.config/opencode/commands/)
# にもリンクを張り、他のリポジトリからも /goal などを利用可能にします。
#
# 使い方: ./.shared-agents/harness/setup.sh

set -euo pipefail

readonly WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
readonly REPO_ROOT="$(cd "${WORKSPACE_DIR}/.." && pwd)"
readonly PROMPTS_DIR="${WORKSPACE_DIR}/prompts"
readonly COMMANDS_DIR="${WORKSPACE_DIR}/commands"
readonly HARN_DIR="${WORKSPACE_DIR}/harness"
readonly SKILLS_SRC_DIR="${WORKSPACE_DIR}/skills"

readonly OPENCODE_DIR="${REPO_ROOT}/.opencode"
readonly OPENCODE_AGENTS_DIR="${OPENCODE_DIR}/agents"
readonly OPENCODE_SKILLS_DIR="${OPENCODE_DIR}/skills"
readonly OPENCODE_PLUGIN_DIR="${OPENCODE_DIR}/plugin"

readonly CLAUDE_DIR="${REPO_ROOT}/.claude"
readonly CLAUDE_COMMANDS_DIR="${CLAUDE_DIR}/commands"

readonly AGENTS_DIR="${REPO_ROOT}/.agents"
readonly AGENTS_SKILLS_DIR="${AGENTS_DIR}/skills"

readonly ANTIGRAVITY_DIR="${REPO_ROOT}/.antigravitycli"

readonly GLOBAL_OPENCODE_DIR="${HOME}/.config/opencode"
readonly GLOBAL_OPENCODE_COMMANDS_DIR="${GLOBAL_OPENCODE_DIR}/commands"

echo "AIエージェントハーネスの初期化処理を開始します..."
echo "リポジトリルート: ${REPO_ROOT}"
echo

# ============================================================
# 1. ディレクトリ作成
# ============================================================
echo "-> 設定ディレクトリを作成中..."
mkdir -p "${OPENCODE_AGENTS_DIR}" "${OPENCODE_SKILLS_DIR}" "${OPENCODE_PLUGIN_DIR}"
mkdir -p "${CLAUDE_COMMANDS_DIR}"
mkdir -p "${AGENTS_SKILLS_DIR}"
mkdir -p "${ANTIGRAVITY_DIR}"
mkdir -p "${GLOBAL_OPENCODE_COMMANDS_DIR}"

# ============================================================
# 2. エージェントプロンプトのシンボリックリンク (OpenCode / Claude / Agents)
# ============================================================
echo "-> エージェントプロンプトのシンボリックリンクを作成中..."
for filepath in "${PROMPTS_DIR}"/*.md; do
  filename=$(basename "$filepath")

  # OpenCode (.opencode/agents/<name>.md)
  dest="${OPENCODE_AGENTS_DIR}/${filename}"
  rm -f "$dest"
  ln -sf "../../.shared-agents/prompts/${filename}" "$dest"

  # Claude Code (.claude/rules/<name>.md) — rules ディレクトリも作成
  mkdir -p "${CLAUDE_DIR}/rules"
  dest="${CLAUDE_DIR}/rules/${filename}"
  rm -f "$dest"
  ln -sf "../../.shared-agents/prompts/${filename}" "$dest"

  # 汎用 .agents/prompts/<name>.md
  mkdir -p "${AGENTS_DIR}/prompts"
  dest="${AGENTS_DIR}/prompts/${filename}"
  rm -f "$dest"
  ln -sf "../../.shared-agents/prompts/${filename}" "$dest"
done

# ============================================================
# 3. スラッシュコマンドのシンボリックリンク
#    - OpenCode プロジェクトローカル (.opencode/commands/)
#    - OpenCode グローバル (~/.config/opencode/commands/) → 他リポジトリでも利用可
#    - Claude Code (.claude/commands/)
# ============================================================
echo "-> スラッシュコマンドのシンボリックリンクを作成中..."
mkdir -p "${OPENCODE_DIR}/commands"
for filepath in "${COMMANDS_DIR}"/*.md; do
  filename=$(basename "$filepath")

  # OpenCode プロジェクトローカル
  dest="${OPENCODE_DIR}/commands/${filename}"
  rm -f "$dest"
  ln -sf "../../.shared-agents/commands/${filename}" "$dest"

  # Claude Code
  dest="${CLAUDE_COMMANDS_DIR}/${filename}"
  rm -f "$dest"
  ln -sf "../../.shared-agents/commands/${filename}" "$dest"

  # OpenCode グローバル — 他リポジトリからも /goal 等を利用可能にする
  # シンボリックリンクでソースはこのリポジトリに維持
  dest="${GLOBAL_OPENCODE_COMMANDS_DIR}/${filename}"
  rm -f "$dest"
  ln -sf "${WORKSPACE_DIR}/commands/${filename}" "$dest"
done

# ============================================================
# 4. スキルのシンボリックリンク (OpenCode / .agents)
# ============================================================
echo "-> スキルのシンボリックリンクを作成中..."
if [[ -d "${SKILLS_SRC_DIR}" ]]; then
  for skill_dir in "${SKILLS_SRC_DIR}"/*/; do
    skill_name=$(basename "$skill_dir")
    [[ "$skill_name" == "*" ]] && continue

    # OpenCode: .opencode/skills/<name>/ (フォルダごとリンク)
    dest="${OPENCODE_SKILLS_DIR}/${skill_name}"
    rm -rf "$dest"
    ln -sf "../../.shared-agents/skills/${skill_name}" "$dest"

    # .agents/skills/<name>/
    dest="${AGENTS_SKILLS_DIR}/${skill_name}"
    rm -rf "$dest"
    ln -sf "../../.shared-agents/skills/${skill_name}" "$dest"
  done
fi

# ============================================================
# 5. .antigravitycli/agents.json の生成
# ============================================================
echo "-> .antigravitycli/agents.json を生成中..."
{
  echo '{'
  echo '  "name": "social-autopoiesis-sandbox",'
  echo '  "description": "Social Autopoiesis Sandbox Multi-Agent Workspace",'
  echo '  "agents": {'
  first=1
  for filepath in "${PROMPTS_DIR}"/*.md; do
    filename=$(basename "$filepath" .md)
    [[ $first -eq 0 ]] && echo '    ,'
    first=0
    echo "    \"${filename}\": {"
    echo "      \"role\": \"${filename}\","
    echo "      \"prompt\": \".shared-agents/prompts/${filename}.md\","
    echo "      \"model\": \"auto\""
    echo "    }"
  done
  echo '  },'
  echo '  "hooks": {'
  echo '    "PostInvocation": "./.shared-agents/harness/verify.sh"'
  echo '  }'
  echo '}'
} > "${ANTIGRAVITY_DIR}/agents.json"

# ============================================================
# 6. Git pre-commit フックのインストール (Git管理下の場合)
# ============================================================
if [[ -d "${REPO_ROOT}/.git" ]]; then
  echo "-> Git pre-commit フックをインストール中..."
  readonly PRE_COMMIT="${REPO_ROOT}/.git/hooks/pre-commit"
  cat << 'EOF' > "$PRE_COMMIT"
#!/bin/sh
# Git pre-commit フック — コミット前に自動的に検証を実行します。
export LC_ALL=C.UTF-8
export LANG=C.UTF-8
echo "=== [Git Pre-commit Hook] 検証スクリプトを実行中... ==="
./.shared-agents/harness/verify.sh
EOF
  chmod +x "$PRE_COMMIT"
  echo "✓ pre-commit フックのインストールが完了しました。"
else
  echo "[警告] .git ディレクトリが見つからないため、Git pre-commit フックのインストールをスキップしました。"
fi

# ============================================================
# 7. ハーネススクリプトに実行権限を付与
# ============================================================
chmod +x "${HARN_DIR}"/*.sh 2>/dev/null || true

echo
echo "AIエージェントハーネスの初期化処理が正常に完了しました！"
echo
echo "次の手順:"
echo "  1. OpenCode を再起動してください（設定は起動時にロードされます）。"
echo "  2. スラッシュコマンド (/goal, /review, /prd 等) は任意のリポジトリで利用可能です。"
echo "  3. エージェント (team-reviewer, architect 等) は OpenCode のサブエージェントとして呼び出せます。"
echo "  4. Claude Code では .claude/commands/ 配下のコマンドが利用可能です。"