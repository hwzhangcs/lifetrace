import os
from contextlib import contextmanager

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://lifetrace:lifetrace@localhost:54329/lifetrace")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=10)


@contextmanager
def transaction():
    with engine.begin() as conn:
        conn.execute(text("SET LOCAL lock_timeout = '5s'"))
        conn.execute(text("SET LOCAL statement_timeout = '15s'"))
        yield conn


def rows(conn, sql, **params):
    return [dict(r) for r in conn.execute(text(sql), params).mappings()]


def one(conn, sql, **params):
    row = conn.execute(text(sql), params).mappings().first()
    return dict(row) if row else None
