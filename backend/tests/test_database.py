import subprocess
import sys
from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from lifetrace.db import engine, one, rows
from lifetrace.schemas import SwapIn
from lifetrace.seed import seed
from lifetrace.service import maintain


def snapshot():
    with engine.connect() as c:
        return (
            rows(c, "SELECT * FROM installations ORDER BY id"),
            rows(c, "SELECT * FROM maintenance_events ORDER BY id"),
        )


def test_failure_after_close_rolls_back_everything():
    before = snapshot()

    def inject(c):
        assert one(c, "SELECT removed_at FROM installations WHERE id=1")["removed_at"] is not None
        # A real DB failure on the NEXT installation INSERT, after old installation was closed.
        c.execute(
            text("""CREATE FUNCTION fail_test_insert() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'injected insertion failure' USING ERRCODE='23514'; END $$""")
        )
        c.execute(
            text(
                "CREATE TRIGGER fail_test BEFORE INSERT ON installations FOR EACH ROW EXECUTE FUNCTION fail_test_insert()"
            )
        )

    with pytest.raises(IntegrityError):
        maintain(
            "SWAP",
            SwapIn(asset_id=1, slot_id=1, technician_id=1, expected_installation_id=1, new_component_id=3),
            after_close=inject,
        )
    assert snapshot() == before


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM assets WHERE id=1",
        "DELETE FROM components WHERE id=1",
        "DELETE FROM component_batches WHERE id=1",
        "DELETE FROM asset_slots WHERE id=1",
        "DELETE FROM installations WHERE id=1",
        "DELETE FROM maintenance_events WHERE id=1",
        "UPDATE installations SET component_id=3 WHERE id=1",
        "UPDATE components SET batch_id=2 WHERE id=1",
        "UPDATE assets SET asset_code='OTHER' WHERE id=1",
        "UPDATE asset_slots SET allowed_type='CAMERA' WHERE id=1",
        "UPDATE component_batches SET component_model_id=2 WHERE id=1",
        "UPDATE component_models SET component_type='SENSOR' WHERE id=1",
        "UPDATE maintenance_events SET note='overwrite' WHERE id=1",
        "INSERT INTO components(serial_no,batch_id) VALUES ('bad',999)",
        "UPDATE component_batches SET recall_status='RECALLED' WHERE id=1",
    ],
)
def test_database_integrity(sql):
    with pytest.raises(IntegrityError), engine.begin() as c:
        c.execute(text(sql))


@pytest.mark.parametrize(
    "slot,component,start,end",
    [
        (5, 1, "2026-04-01", None),  # physical component active elsewhere
        (1, 3, "2026-04-01", None),  # occupied slot
        (5, 3, "2026-04-01", "2026-04-01"),
        (5, 3, "2026-04-02", "2026-04-01"),
    ],
)
def test_database_installation_constraints(slot, component, start, end):
    with pytest.raises(IntegrityError), engine.begin() as c:
        c.execute(
            text("""INSERT INTO installations(asset_slot_id,component_id,installed_at,removed_at,
                 installed_event_id,removed_event_id) VALUES (:s,:c,:t,:e,1,:r)"""),
            {"s": slot, "c": component, "t": start, "e": end, "r": 1 if end else None},
        )


@pytest.mark.parametrize("slot,component", [(5, 1), (1, 4)])
def test_closed_historical_overlap_rejected(slot, component):
    seed("history", reset=True)
    with pytest.raises(IntegrityError), engine.begin() as c:
        c.execute(
            text("""INSERT INTO installations(asset_slot_id,component_id,installed_at,removed_at,
              installed_event_id,removed_event_id) VALUES (:s,:c,'2026-05-01','2026-06-01',1,1)"""),
            {"s": slot, "c": component},
        )


@pytest.mark.parametrize(
    "at,serial",
    [
        ("2026-02-20T00:00:00Z", None),
        ("2026-03-01T00:00:00Z", "B102"),
        ("2026-07-10T03:59:59.999999Z", "B102"),
        ("2026-07-10T04:00:00Z", "B221"),
        ("2026-07-10T12:00:00+08:00", "B221"),
    ],
)
def test_time_boundary(client, at, serial):
    seed("history", reset=True)
    result = client.get("/api/assets/1/components", params={"at": at})
    assert result.status_code == 200
    assert result.json()["items"][0]["serial_no"] == serial


def test_before_slot_creation_and_timezone(client):
    assert client.get("/api/assets/1/components", params={"at": "2025-12-01T00:00:00Z"}).json()["items"] == []
    assert client.get("/api/assets/1/components?at=2026-05-01T00:00:00").status_code == 422


def test_new_process_can_read_committed_history():
    before = snapshot()
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "from lifetrace.db import engine,one; "
                "c=engine.connect(); print(one(c,'SELECT count(*) AS n FROM installations')[\"n\"])"
            ),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    assert int(result.stdout.strip()) == len(before[0])


def test_server_timestamp_after_previous(client):
    r = client.post(
        "/api/maintenance/swap",
        json={
            "asset_id": 1,
            "slot_id": 1,
            "technician_id": 1,
            "expected_installation_id": 1,
            "new_component_id": 3,
        },
    )
    assert r.status_code == 201
    when = datetime.fromisoformat(r.json()["event"]["occurred_at"])
    assert (datetime.now(UTC) - when).total_seconds() < 5
