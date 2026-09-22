"""Use table-specific branches before accessing trigger record fields."""

from pathlib import Path

from alembic import op

revision = "002"
down_revision = "001"


def upgrade():
    source = (Path(__file__).resolve().parents[3] / "schema.sql").read_text()
    function = source.split("CREATE OR REPLACE FUNCTION guard_reference_history()", 1)[1]
    function = function.split("CREATE TRIGGER preserve_event", 1)[0]
    op.get_bind().connection.driver_connection.execute(
        "CREATE OR REPLACE FUNCTION guard_reference_history()" + function
    )


def downgrade():
    raise RuntimeError("History protection downgrade is unsupported")
