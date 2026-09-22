"""Create isolated test databases. Never drops existing databases."""
import os
import sys

import psycopg
from psycopg import sql

url = os.getenv("DATABASE_URL", "postgresql://lifetrace:lifetrace@localhost:54329/lifetrace")
url = url.replace("postgresql+psycopg://", "postgresql://")
names = sys.argv[1:] or ["lifetrace_test", "lifetrace_test_e2e"]
with psycopg.connect(url, autocommit=True) as conn:
    for name in names:
        if not name.startswith("lifetrace_test"):
            raise ValueError("Only lifetrace_test* databases are allowed")
        if not conn.execute("SELECT 1 FROM pg_database WHERE datname=%s", (name,)).fetchone():
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        print(f"Ready: {name}")
