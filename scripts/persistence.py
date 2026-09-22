"""Explicit restart acceptance; restarts only this Compose project's db service."""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx

root = Path(__file__).resolve().parents[1]
url = os.getenv("PERSIST_DATABASE_URL", "postgresql+psycopg://lifetrace:lifetrace@localhost:54329/lifetrace_test_persistence")
if not url.rsplit("/", 1)[-1].startswith("lifetrace_test_persistence"):
    raise RuntimeError("Persistence test requires its dedicated database")
env = {**os.environ, "DATABASE_URL": url}
python = sys.executable
subprocess.run([python, str(root / "scripts/init_test_db.py"), url.rsplit("/", 1)[-1]], check=True)
subprocess.run([python, "-m", "alembic", "upgrade", "head"], cwd=root / "backend", env=env, check=True)
subprocess.run([python, "-m", "lifetrace.seed", "--reset"], cwd=root / "backend", env=env, check=True)
base = "http://127.0.0.1:8012"


def start(log):
    process = subprocess.Popen([python, "-m", "uvicorn", "lifetrace.app:app", "--host", "127.0.0.1", "--port", "8012"],
                               cwd=root / "backend", env=env, stdout=log, stderr=log)
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError("Acceptance server exited; check persistence-server.log")
            try:
                if httpx.get(base + "/api/health", timeout=1).status_code == 200:
                    return process
            except httpx.HTTPError:
                pass
            time.sleep(.1)
        raise RuntimeError("Acceptance server did not start")
    except Exception:
        process.terminate(); process.wait(timeout=5)
        raise


def snapshot():
    paths = ["/api/assets/1/components", "/api/components/1/history", "/api/dashboard"]
    return {path: httpx.get(base + path).json() for path in paths}


with (root / "docs/persistence-server.log").open("w") as log:
    process = start(log)
    try:
        r = httpx.post(base + "/api/maintenance/swap", json={"asset_id": 1, "slot_id": 1,
                       "technician_id": 1, "expected_installation_id": 1, "new_component_id": 3})
        r.raise_for_status()
        before = snapshot()
    finally:
        process.terminate(); process.wait(timeout=5)
    subprocess.run(["docker", "compose", "restart", "db"], cwd=root, check=True)
    for _ in range(100):
        ready = subprocess.run(["docker", "compose", "exec", "-T", "db", "pg_isready", "-U", "lifetrace"],
                               cwd=root, capture_output=True)
        if ready.returncode == 0:
            break
        time.sleep(.1)
    process = start(log)
    try:
        after = snapshot()
        assert before == after, "Committed history changed after restart"
        (root / "docs/persistence.json").write_text(json.dumps({"passed": True, "backend_restarted": True,
            "postgres_container_restarted": True, "before": before, "after": after}, ensure_ascii=False, indent=2) + "\n")
    finally:
        process.terminate(); process.wait(timeout=5)
print("PASS: committed composition, component history and dashboard survive backend + PostgreSQL restart")
