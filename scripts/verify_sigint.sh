#!/usr/bin/env bash
set -euo pipefail

VENV_PATH="${1:-/tmp/lumann-verify-venv}"
PYTHON_BIN="${VENV_PATH}/bin/python"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"

STUB_PORT=8399
STUB_HOST="127.0.0.1"
STUB_URL="http://${STUB_HOST}:${STUB_PORT}"

TMP_DIR="$(mktemp -d)"
TOPIC_FILE="${TMP_DIR}/topic.txt"
SIM_STDOUT="${TMP_DIR}/sim_stdout.log"
SIM_STDERR="${TMP_DIR}/sim_stderr.log"
STUB_LOG="${TMP_DIR}/stub.log"

cleanup() {
    if [[ -n "${STUB_PID:-}" ]] && kill -0 "${STUB_PID}" 2>/dev/null; then
        kill "${STUB_PID}" 2>/dev/null || true
        wait "${STUB_PID}" 2>/dev/null || true
    fi
}
trap cleanup EXIT

cat > "${TMP_DIR}/stub_server.py" <<'PYEOF'
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def _handle(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 0:
            self.rfile.read(length)
        body = json.dumps({"choices": [{"message": {"content": "stub-response"}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_POST(self):
        self._handle()
    def do_GET(self):
        self._handle()
    def log_message(self, *args, **kwargs):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 8399), Handler)
server.serve_forever()
PYEOF

"${PYTHON_BIN}" "${TMP_DIR}/stub_server.py" >"${STUB_LOG}" 2>&1 &
STUB_PID=$!

for _ in $(seq 1 30); do
    if bash -c "exec 3<>/dev/tcp/${STUB_HOST}/${STUB_PORT}" 2>/dev/null; then
        break
    fi
    sleep 0.1
done

if ! kill -0 "${STUB_PID}" 2>/dev/null; then
    echo "ERROR: stub server failed to start" >&2
    echo "--- stub log ---" >&2
    cat "${STUB_LOG}" >&2
    exit 1
fi

echo "stub-response" > "${TOPIC_FILE}"

(
    cd "${BACKEND_DIR}"
    exec env -i \
        PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
        HOME="${HOME:-/tmp}" \
        LLM_PROVIDER=ollama \
        MAX_TURNS=0 \
        OLLAMA_API_KEY=dummy \
        OLLAMA_BASE_URL="${STUB_URL}" \
        OLLAMA_MODEL=dummy \
        "${PYTHON_BIN}" -m app.main < "${TOPIC_FILE}" \
        >"${SIM_STDOUT}" 2>"${SIM_STDERR}"
) &
SIM_PID=$!

sleep 3

if ! kill -0 "${SIM_PID}" 2>/dev/null; then
    echo "ERROR: simulation exited before SIGINT" >&2
    echo "--- stdout ---" >&2
    cat "${SIM_STDOUT}" >&2
    echo "--- stderr ---" >&2
    cat "${SIM_STDERR}" >&2
    exit 1
fi

kill -INT "${SIM_PID}"

EXIT_CODE=0
for _ in $(seq 1 100); do
    if ! kill -0 "${SIM_PID}" 2>/dev/null; then
        wait "${SIM_PID}" 2>/dev/null || EXIT_CODE=$?
        break
    fi
    sleep 0.1
done

if kill -0 "${SIM_PID}" 2>/dev/null; then
    echo "ERROR: process did not exit within 10s after SIGINT" >&2
    kill -KILL "${SIM_PID}" 2>/dev/null || true
    wait "${SIM_PID}" 2>/dev/null || true
    exit 1
fi

echo "=== simulation stdout ==="
cat "${SIM_STDOUT}"
echo "=== simulation stderr ==="
cat "${SIM_STDERR}"

if ! grep -q "シミュレーションを中断します。" "${SIM_STDOUT}"; then
    echo "FAIL: interrupt message not found in stdout" >&2
    exit 1
fi

LATEST_JSONL="$(ls -t "${BACKEND_DIR}/logs"/sim_*.jsonl 2>/dev/null | head -1 || true)"
if [[ -z "${LATEST_JSONL}" ]]; then
    echo "FAIL: no sim_*.jsonl found in backend/logs" >&2
    exit 1
fi

JSONL_LINE_COUNT=$("${PYTHON_BIN}" - "${LATEST_JSONL}" <<'PYEOF'
import json, sys
path = sys.argv[1]
with open(path, "rb") as f:
    count = 0
    for line in f:
        line_s = line.strip()
        if not line_s:
            continue
        json.loads(line_s)
        count += 1
print(count)
PYEOF
)
JSONL_PARSE_OK="yes"

echo "=== verification result ==="
echo "interrupt_message: yes"
echo "exit_code: ${EXIT_CODE}"
echo "jsonl_file: ${LATEST_JSONL}"
echo "jsonl_line_count: ${JSONL_LINE_COUNT}"
echo "jsonl_all_lines_parsed: ${JSONL_PARSE_OK}"

if [[ "${EXIT_CODE}" -ne 0 ]]; then
    echo "NOTE: exit_code is ${EXIT_CODE} (non-zero). See Tech Spec decision #12 for predicted values."
fi

exit 0