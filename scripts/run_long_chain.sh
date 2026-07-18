#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <agents_config_yaml> <max_turns> <trigger_message>" >&2
  exit 2
fi

AGENTS_CONFIG_PATH="$1"
MAX_TURNS_ARG="$2"
TRIGGER_MESSAGE="$3"

if [[ ! -f "${AGENTS_CONFIG_PATH}" ]]; then
  echo "AGENTS_CONFIG で指定されたパスが存在しません: ${AGENTS_CONFIG_PATH}" >&2
  exit 2
fi

export AGENTS_CONFIG="${AGENTS_CONFIG_PATH}"
export MAX_TURNS="${MAX_TURNS_ARG}"
export AGENT_ORDER_MODE="${AGENT_ORDER_MODE:-fixed}"
export HISTORY_LENGTH="${HISTORY_LENGTH:-1}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

printf '%s\n' "${TRIGGER_MESSAGE}" | python -m app.main

LATEST_LOG="$(ls -t logs/sim_*.jsonl 2>/dev/null | head -n 1 || true)"
if [[ -n "${LATEST_LOG}" ]]; then
  TS="$(date -u +%Y%m%dT%H%M%SZ)"
  TARGET="logs/long_chain_${TS}.jsonl"
  mv "${LATEST_LOG}" "${TARGET}"
  echo "saved: ${TARGET}" >&2
fi