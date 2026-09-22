#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
backend/.venv/bin/python scripts/init_test_db.py
(cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest -q)
backend/.venv/bin/python scripts/export_openapi.py
(cd frontend && pnpm generate:api && pnpm lint && pnpm test && pnpm build)
(cd backend && DATABASE_URL="${E2E_DATABASE_URL:-postgresql+psycopg://lifetrace:lifetrace@localhost:54329/lifetrace_test_e2e}" .venv/bin/alembic upgrade head)
(cd frontend && pnpm test:e2e)
