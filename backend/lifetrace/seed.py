"""Explicit demo reset: python -m lifetrace.seed --reset --scenario interactive|history."""

import argparse
from datetime import UTC, datetime

from sqlalchemy import text

from .db import one, transaction


def seed(scenario="interactive", reset=False):
    with transaction() as conn:
        if one(conn, "SELECT count(*) AS n FROM assets")["n"] and not reset:
            raise RuntimeError("Database is not empty. Use --reset explicitly for disposable demo data.")
        if reset:
            conn.execute(
                text(
                    "TRUNCATE installations,maintenance_events,components,component_batches,"
                    "component_models,asset_slots,assets,users RESTART IDENTITY CASCADE"
                )
            )
        conn.execute(
            text("""INSERT INTO users(name,role) VALUES ('张晓 · Alice','TECHNICIAN'),('李明 · Manager','MANAGER');
          INSERT INTO assets(asset_code,asset_type,model_name,acquired_at,created_at) VALUES
          ('D001','DRONE','Research Drone Alpha','2026-01-01','2026-01-01T00:00:00Z'),
          ('D009','DRONE','Research Drone Beta','2026-01-01','2026-01-01T00:00:00Z'),
          ('D014','ROBOT','Mobile Robot Gamma','2026-01-01','2026-01-01T00:00:00Z');
          INSERT INTO asset_slots(asset_id,slot_name,allowed_type,created_at) VALUES
          (1,'battery-main','BATTERY','2026-01-01T00:00:00Z'),(1,'camera-front','CAMERA','2026-01-01T00:00:00Z'),
          (1,'motor-left','MOTOR','2026-01-01T00:00:00Z'),(1,'motor-right','MOTOR','2026-01-01T00:00:00Z'),
          (2,'battery-main','BATTERY','2026-01-01T00:00:00Z'),(3,'battery-main','BATTERY','2026-01-01T00:00:00Z');
          INSERT INTO component_models(component_type,manufacturer,model_name,description) VALUES
          ('BATTERY','PowerCell','PX-80','80 Wh 实验平台电池'),('CAMERA','OpticLab','Vision C4','前置视觉模组'),
          ('MOTOR','MotionWorks','M-30','无刷电机');
          INSERT INTO component_batches(component_model_id,batch_code,manufactured_at) VALUES
          (1,'BAT-2026-03','2026-02-01'),(1,'BAT-2026-06','2026-02-01'),
          (2,'CAM-2026-01','2026-01-01'),(3,'MOT-2026-01','2026-01-01');
          INSERT INTO components(serial_no,batch_id,condition_status,created_at) VALUES
          ('B102',1,'GOOD','2026-02-15T00:00:00Z'),('B118',1,'GOOD','2026-02-15T00:00:00Z'),
          ('B221',2,'GOOD','2026-02-15T00:00:00Z'),('B300',2,'GOOD','2026-02-15T00:00:00Z'),
          ('C004',3,'GOOD','2026-02-15T00:00:00Z'),('M031',4,'GOOD','2026-02-15T00:00:00Z'),
          ('M033',4,'GOOD','2026-02-15T00:00:00Z'),('B500',2,'DEFECTIVE','2026-02-15T00:00:00Z');
        """)
        )

        def install(asset, slot, component, when):
            event = one(
                conn,
                """INSERT INTO maintenance_events(asset_id,technician_id,event_type,occurred_at,note)
               VALUES (:a,1,'INSTALL',:t,'初始装配') RETURNING id""",
                a=asset,
                t=when,
            )
            return one(
                conn,
                """INSERT INTO installations(asset_slot_id,component_id,installed_at,installed_event_id)
              VALUES (:s,:c,:t,:e) RETURNING id""",
                s=slot,
                c=component,
                t=when,
                e=event["id"],
            )["id"]

        t = datetime(2026, 3, 1, tzinfo=UTC)
        old = install(1, 1, 1, t)
        install(3, 6, 2, t)
        for slot, component in [(2, 5), (3, 6), (4, 7)]:
            install(1, slot, component, t)
        if scenario == "history":
            swapped = datetime(2026, 7, 10, 4, tzinfo=UTC)
            event = one(
                conn,
                """INSERT INTO maintenance_events(asset_id,technician_id,event_type,occurred_at,note)
              VALUES (1,1,'SWAP',:t,'例行电池更换') RETURNING id""",
                t=swapped,
            )
            conn.execute(
                text("UPDATE installations SET removed_at=:t,removed_event_id=:e WHERE id=:id"),
                {"t": swapped, "e": event["id"], "id": old},
            )
            conn.execute(
                text("""INSERT INTO installations(asset_slot_id,component_id,installed_at,installed_event_id)
              VALUES (1,3,:t,:e)"""),
                {"t": swapped, "e": event["id"]},
            )
            install(2, 5, 1, datetime(2026, 8, 1, tzinfo=UTC))
            conn.execute(
                text("""UPDATE component_batches SET recall_status='RECALLED',recalled_at='2026-09-01T00:00:00Z',
                recalled_by=2,recall_reason='供应商通知：潜在热失控风险，请停止使用并安排更换。' WHERE id=1""")
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--scenario", choices=["interactive", "history"], default="interactive")
    args = parser.parse_args()
    seed(args.scenario, args.reset)
    print(f"Seeded {args.scenario} scenario")
