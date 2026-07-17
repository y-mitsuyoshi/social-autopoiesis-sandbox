import re
import sys
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]


def check(name: str, ok: bool, detail: str = "") -> bool:
    status = "OK" if ok else "NG"
    line = f"[{status}] {name}"
    if detail:
        line += f" : {detail}"
    print(line)
    return ok


def verify_dockerfile(content: str) -> bool:
    results: list[bool] = []
    lines = content.splitlines()
    results.append(
        check(
            "Dockerfile: FROM python:3.12-slim",
            any(re.match(r"^FROM\s+python:3\.12-slim\s*$", line) for line in lines),
        )
    )
    user_idx = next(
        (i for i, line in enumerate(lines) if re.match(r"^USER\s+appuser\s*$", line)),
        None,
    )
    cmd_idx = next((i for i, line in enumerate(lines) if re.match(r"^CMD\s", line)), None)
    ok = user_idx is not None and cmd_idx is not None and user_idx < cmd_idx
    results.append(check("Dockerfile: USER appuser before CMD", ok))
    has_healthcheck = any(re.match(r"^HEALTHCHECK\s", line) for line in lines)
    results.append(check("Dockerfile: no HEALTHCHECK", not has_healthcheck))
    results.append(
        check(
            "Dockerfile: pip install --no-cache-dir -r requirements.txt",
            any(
                re.search(r"pip\s+install\s+--no-cache-dir\s+-r\s+requirements\.txt", line)
                for line in lines
            ),
        )
    )
    return all(results)


def verify_compose(data: Any) -> bool:
    results: list[bool] = []
    services = data.get("services", {}) if isinstance(data, dict) else {}
    backend = services.get("backend", {}) if isinstance(services, dict) else {}
    results.append(
        check(
            "compose: backend.env_file == '.env'",
            backend.get("env_file") == ".env",
        )
    )
    volumes = backend.get("volumes", []) if isinstance(backend, dict) else []
    results.append(
        check(
            "compose: volumes contains './logs:/app/logs'",
            isinstance(volumes, list) and "./logs:/app/logs" in volumes,
        )
    )
    results.append(
        check(
            "compose: stdin_open is True",
            backend.get("stdin_open") is True,
        )
    )
    results.append(check("compose: tty is True", backend.get("tty") is True))
    healthcheck = backend.get("healthcheck", {}) if isinstance(backend, dict) else {}
    expected_test = ["CMD", "python", "-c", "import app; print('ok')"]
    results.append(
        check(
            "compose: healthcheck.test == ['CMD','python','-c',\"import app; print('ok')\"]",
            isinstance(healthcheck, dict) and healthcheck.get("test") == expected_test,
        )
    )
    return all(results)


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    dockerfile_path = repo_root / "backend" / "Dockerfile"
    compose_path = repo_root / "docker-compose.yml"
    dockerfile_ok = True
    compose_ok = True
    if dockerfile_path.is_file():
        dockerfile_ok = verify_dockerfile(dockerfile_path.read_text())
    else:
        check("Dockerfile exists", False, str(dockerfile_path))
        dockerfile_ok = False
    if compose_path.is_file():
        try:
            data = yaml.safe_load(compose_path.read_text())
            compose_ok = verify_compose(data)
        except yaml.YAMLError as exc:
            check("compose: YAML parse", False, str(exc))
            compose_ok = False
    else:
        check("docker-compose.yml exists", False, str(compose_path))
        compose_ok = False
    if dockerfile_ok and compose_ok:
        return 0
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ModuleNotFoundError as exc:
        if exc.name == "yaml":
            print(
                "PyYAML not installed. install with: pip install pyyaml"
                " (or: pip install yamllint, which depends on PyYAML)",
                file=sys.stderr,
            )
            sys.exit(2)
        raise
