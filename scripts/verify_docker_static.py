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
    test_value = healthcheck.get("test") if isinstance(healthcheck, dict) else None
    ok_healthcheck_test = (
        isinstance(test_value, list)
        and len(test_value) >= 1
        and test_value[0] == "CMD-SHELL"
        and any("urllib.request.urlopen" in str(item) for item in test_value[1:])
    )
    results.append(
        check(
            "compose: healthcheck.test uses urllib.request.urlopen('/docs')",
            ok_healthcheck_test,
        )
    )
    start_period = healthcheck.get("start_period") if isinstance(healthcheck, dict) else None
    results.append(
        check(
            "compose: healthcheck.start_period == '10s'",
            start_period == "10s",
        )
    )
    ports = backend.get("ports", []) if isinstance(backend, dict) else []
    results.append(
        check(
            "compose: ports contains '8000:8000'",
            isinstance(ports, list) and "8000:8000" in ports,
        )
    )
    frontend = services.get("frontend", {}) if isinstance(services, dict) else {}
    results.append(
        check("compose: services.frontend exists", isinstance(frontend, dict) and bool(frontend))
    )
    fe_ports = frontend.get("ports", []) if isinstance(frontend, dict) else []
    results.append(
        check(
            "compose: frontend.ports contains '5173:5173'",
            isinstance(fe_ports, list) and "5173:5173" in fe_ports,
        )
    )
    fe_build = frontend.get("build", {}) if isinstance(frontend, dict) else {}
    fe_dockerfile = fe_build.get("dockerfile") if isinstance(fe_build, dict) else None
    results.append(
        check(
            "compose: frontend.build.dockerfile == 'Dockerfile'",
            fe_dockerfile == "Dockerfile",
        )
    )
    fe_depends = frontend.get("depends_on", []) if isinstance(frontend, dict) else []
    ok_depends = (isinstance(fe_depends, list) and "backend" in fe_depends) or (
        isinstance(fe_depends, dict) and "backend" in fe_depends
    )
    results.append(
        check(
            "compose: frontend.depends_on contains 'backend'",
            ok_depends,
        )
    )
    fe_healthcheck = frontend.get("healthcheck", {}) if isinstance(frontend, dict) else {}
    fe_test = fe_healthcheck.get("test") if isinstance(fe_healthcheck, dict) else None
    ok_fe_healthcheck = (
        isinstance(fe_test, list)
        and len(fe_test) >= 1
        and fe_test[0] == "CMD-SHELL"
        and any("5173" in str(item) for item in fe_test[1:])
    )
    results.append(
        check(
            "compose: frontend.healthcheck.test probes port 5173",
            ok_fe_healthcheck,
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
