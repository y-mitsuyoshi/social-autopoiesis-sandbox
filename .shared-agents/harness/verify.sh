#!/usr/bin/env bash
# verify.sh — プロジェクト全体のテストとバリデーションを実行するスクリプト
# Python (FastAPI/uvicorn) バックエンド + React/TypeScript フロントエンド + Docker 構成
#
# 使い方:
#   ./.shared-agents/harness/verify.sh              # 自動判定
#   USE_DOCKER=always ./.shared-agents/harness/verify.sh
#   USE_DOCKER=never  ./.shared-agents/harness/verify.sh

set -euo pipefail

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

readonly WORKSPACE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
readonly USE_DOCKER="${USE_DOCKER:-auto}"

can_use_docker() {
  [[ -f "${WORKSPACE_DIR}/docker-compose.yml" || -f "${WORKSPACE_DIR}/compose.yml" ]] \
    && command -v docker &>/dev/null \
    && docker info &>/dev/null 2>&1
}

resolve_use_docker() {
  if [[ "$USE_DOCKER" == "never" ]]; then return 1; fi
  if [[ "$USE_DOCKER" == "always" ]]; then
    can_use_docker || { echo -e "${RED}エラー: USE_DOCKER=always ですが Docker が利用できません${NC}" >&2; exit 1; }
    return 0
  fi
  can_use_docker
}

echo -e "${YELLOW}=== プロジェクトバリデーションを開始します ===${NC}"
echo -e "${YELLOW}ワークスペース: ${WORKSPACE_DIR}${NC}"

# 1. Python バックエンド
echo -e "\n${YELLOW}[1/2] Python バックエンドのチェック中...${NC}"
cd "${WORKSPACE_DIR}"

if resolve_use_docker; then
  COMPOSE_FILE="docker-compose.yml"
  [[ -f "${WORKSPACE_DIR}/compose.yml" ]] && COMPOSE_FILE="compose.yml"
  echo "-> Docker 経由で実行中 (docker compose -f ${COMPOSE_FILE} exec backend)..."
  run_py() { docker compose -f "${WORKSPACE_DIR}/${COMPOSE_FILE}" exec -T backend "$@"; }
else
  echo "-> ローカル環境で実行中..."
  if [[ -d "${WORKSPACE_DIR}/.venv" ]]; then
    echo "   (.venv を使用)"
    if [[ -d "${WORKSPACE_DIR}/backend" ]]; then cd "${WORKSPACE_DIR}/backend"; fi
    run_py() { "${WORKSPACE_DIR}/.venv/bin/$@"; }
  else
    if [[ -d "${WORKSPACE_DIR}/backend" ]]; then cd "${WORKSPACE_DIR}/backend"; fi
    run_py() { "$@"; }
  fi
fi

if command -v ruff &>/dev/null || run_py command -v ruff &>/dev/null 2>&1; then
  echo "-> フォーマットチェック (ruff format --check)..."
  run_py ruff format . --check || { echo -e "${RED}エラー: ruff format に失敗${NC}"; exit 1; }

  echo "-> リント (ruff check)..."
  run_py ruff check . || { echo -e "${RED}エラー: ruff check に失敗${NC}"; exit 1; }
else
  echo -e "${YELLOW}注意: ruff が見つかりません。スキップします。${NC}"
fi

if command -v mypy &>/dev/null || run_py command -v mypy &>/dev/null 2>&1; then
  echo "-> 型チェック (mypy)..."
  if [[ -f "${WORKSPACE_DIR}/.venv/bin/python" ]]; then
    run_py mypy --python-executable="${WORKSPACE_DIR}/.venv/bin/python" . || { echo -e "${RED}エラー: mypy に失敗${NC}"; exit 1; }
  else
    run_py mypy . || { echo -e "${RED}エラー: mypy に失敗${NC}"; exit 1; }
  fi
else
  echo -e "${YELLOW}注意: mypy が見つかりません。スキップします。${NC}"
fi

if command -v pytest &>/dev/null || run_py command -v pytest &>/dev/null 2>&1; then
  echo "-> テスト実行 (pytest)..."
  run_py pytest -q || { echo -e "${RED}エラー: pytest に失敗${NC}"; exit 1; }
else
  echo -e "${YELLOW}注意: pytest が見つかりません。スキップします。${NC}"
fi
echo -e "${GREEN}✓ バックエンドチェック成功!${NC}"

# 2. フロントエンド (React/TypeScript)
echo -e "\n${YELLOW}[2/2] フロントエンドのチェック中...${NC}"
if [[ -d "${WORKSPACE_DIR}/frontend" && -d "${WORKSPACE_DIR}/frontend/node_modules" ]]; then
  cd "${WORKSPACE_DIR}/frontend"

  echo "-> ESLint..."
  npm run lint || { echo -e "${RED}エラー: ESLint に失敗${NC}"; exit 1; }

  echo "-> TypeScript型チェック (tsc)..."
  npx tsc -b || { echo -e "${RED}エラー: tsc に失敗${NC}"; exit 1; }

  echo "-> テスト実行 (Vitest)..."
  npm run test || { echo -e "${RED}エラー: Vitest に失敗${NC}"; exit 1; }
  echo -e "${GREEN}✓ フロントエンドチェック成功!${NC}"
else
  echo -e "${YELLOW}注意: frontend/node_modules が見つかりません。スキップします。${NC}"
fi

echo -e "\n${GREEN}=== すべてのチェックが正常にパスしました！ ===${NC}"
exit 0