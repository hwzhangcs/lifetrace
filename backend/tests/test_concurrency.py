from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from fastapi.testclient import TestClient
from sqlalchemy import text

from lifetrace.app import app
from lifetrace.db import engine, one


def race(requests):
    barrier = Barrier(len(requests))

    def run(request):
        with TestClient(app) as client:
            barrier.wait(timeout=5)
            return client.post(*request[:1], json=request[1])

    with ThreadPoolExecutor(max_workers=len(requests)) as pool:
        return list(pool.map(run, requests))


def test_two_assets_compete_for_one_component():
    results = race(
        [
            (
                "/api/maintenance/swap",
                {
                    "asset_id": 1,
                    "slot_id": 1,
                    "technician_id": 1,
                    "new_component_id": 4,
                    "expected_installation_id": 1,
                },
            ),
            (
                "/api/maintenance/install",
                {"asset_id": 2, "slot_id": 5, "technician_id": 2, "new_component_id": 4},
            ),
        ]
    )
    assert sorted(r.status_code for r in results) == [201, 409]
    with engine.connect() as c:
        assert (
            one(c, "SELECT count(*) AS n FROM installations WHERE component_id=4 AND removed_at IS NULL")["n"]
            == 1
        )


def test_two_components_compete_for_one_slot():
    requests = [
        (
            "/api/maintenance/install",
            {"asset_id": 2, "slot_id": 5, "technician_id": 1, "new_component_id": cid},
        )
        for cid in [3, 4]
    ]
    assert sorted(r.status_code for r in race(requests)) == [201, 409]


def test_two_swaps_share_stale_installation():
    requests = [
        (
            "/api/maintenance/swap",
            {
                "asset_id": 1,
                "slot_id": 1,
                "technician_id": 1,
                "new_component_id": cid,
                "expected_installation_id": 1,
            },
        )
        for cid in [3, 4]
    ]
    assert sorted(r.status_code for r in race(requests)) == [201, 409]


def test_recall_and_install_are_serializable():
    results = race(
        [
            ("/api/batches/2/recall", {"technician_id": 2, "reason": "并发召回"}),
            (
                "/api/maintenance/install",
                {"asset_id": 2, "slot_id": 5, "technician_id": 1, "new_component_id": 4},
            ),
        ]
    )
    assert results[0].status_code == 200
    assert results[1].status_code in [201, 409]
    with engine.connect() as c:
        assert one(c, "SELECT recall_status FROM component_batches WHERE id=2")["recall_status"] == "RECALLED"
        count = one(c, "SELECT count(*) AS n FROM installations WHERE component_id=4 AND removed_at IS NULL")[
            "n"
        ]
        assert count == (1 if results[1].status_code == 201 else 0)


def test_recall_wins_with_explicit_batch_lock():
    import time

    with engine.connect() as c, ThreadPoolExecutor(max_workers=1) as pool:
        tx = c.begin()
        c.execute(
            text("""UPDATE component_batches SET recall_status='RECALLED',recalled_at=clock_timestamp(),
                           recalled_by=2,recall_reason='first' WHERE id=2""")
        )

        def install():
            with TestClient(app) as client:
                return client.post(
                    "/api/maintenance/install",
                    json={"asset_id": 2, "slot_id": 5, "technician_id": 1, "new_component_id": 4},
                )

        future = pool.submit(install)
        deadline = time.monotonic() + 4
        blocked = False
        while time.monotonic() < deadline:
            with engine.connect() as observer:
                blocked = (
                    one(
                        observer,
                        """SELECT count(*) AS n FROM pg_stat_activity
                    WHERE datname=current_database() AND wait_event_type='Lock'""",
                    )["n"]
                    > 0
                )
            if blocked:
                break
            time.sleep(0.02)
        tx.commit()
        assert blocked, "installation must actually wait on recall transaction"
        assert future.result(timeout=5).status_code == 409


def test_install_wins_before_recall():
    import time
    from threading import Event

    from lifetrace.schemas import SwapIn
    from lifetrace.service import maintain

    closed, release = Event(), Event()

    def pause_after_close(conn):
        closed.set()
        assert release.wait(timeout=5)

    def swap():
        return maintain(
            "SWAP",
            SwapIn(asset_id=1, slot_id=1, technician_id=1, expected_installation_id=1, new_component_id=3),
            after_close=pause_after_close,
        )

    def recall():
        with TestClient(app) as client:
            return client.post("/api/batches/2/recall", json={"technician_id": 2, "reason": "second"})

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(swap)
        assert closed.wait(timeout=5)
        second = pool.submit(recall)
        blocked = False
        try:
            deadline = time.monotonic() + 4
            while time.monotonic() < deadline:
                with engine.connect() as c:
                    blocked = (
                        one(
                            c,
                            "SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
                        )["n"]
                        > 0
                    )
                if blocked:
                    break
                time.sleep(0.02)
        finally:
            release.set()
        assert blocked, "recall must wait for installation transaction"
        assert first.result(timeout=5)["components"][0]["serial_no"] == "B221"
        assert second.result(timeout=5).status_code == 200
    with TestClient(app) as client:
        impact = client.get("/api/batches/2/impact/current").json()
        assert [a["asset_code"] for a in impact["items"]] == ["D001"]
