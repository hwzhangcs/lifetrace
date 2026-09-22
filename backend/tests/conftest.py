import os
from pathlib import Path

os.environ["DATABASE_URL"] = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://lifetrace:lifetrace@localhost:54329/lifetrace_test"
)
if not os.environ["DATABASE_URL"].rsplit("/", 1)[-1].startswith("lifetrace_test"):
    raise RuntimeError("Tests require an isolated lifetrace_test* database")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from lifetrace.app import app
from lifetrace.db import engine
from lifetrace.seed import seed


@pytest.fixture(scope="session", autouse=True)
def schema():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.connection.driver_connection.execute((Path(__file__).parents[2] / "schema.sql").read_text())
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def demo(schema):
    seed(reset=True)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
