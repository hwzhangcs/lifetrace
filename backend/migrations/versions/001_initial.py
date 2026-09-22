"""Initial LifeTrace schema; schema.sql is the canonical DDL."""

from pathlib import Path

from alembic import op

revision = "001"
down_revision = None


def upgrade():
    sql = (Path(__file__).resolve().parents[3] / "schema.sql").read_text()
    op.get_bind().connection.driver_connection.execute(sql)


def downgrade():
    raise RuntimeError("Destructive downgrade disabled; restore an explicit backup instead.")
