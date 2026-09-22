"""Build 100k installation records in lifetrace_test_perf and capture real EXPLAIN ANALYZE."""
import json
import os
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
os.environ["DATABASE_URL"] = os.getenv("PERF_DATABASE_URL", "postgresql+psycopg://lifetrace:lifetrace@localhost:54329/lifetrace_test_perf")
if not os.environ["DATABASE_URL"].rsplit("/", 1)[-1].startswith("lifetrace_test_perf"):
    raise RuntimeError("Benchmark can only reset lifetrace_test_perf* databases")
sys.path.insert(0, str(root / "backend"))
from lifetrace.db import engine, one  # noqa: E402
from sqlalchemy import text  # noqa: E402

with engine.begin() as c:
    c.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    c.connection.driver_connection.execute((root / "schema.sql").read_text())
    c.execute(text("""
      INSERT INTO users(name,role) VALUES ('Benchmark','TECHNICIAN');
      INSERT INTO assets(asset_code,asset_type,model_name,created_at)
        SELECT 'PERF-'||x,'ROBOT','Test Robot','2025-01-01' FROM generate_series(1,1000) x;
      INSERT INTO asset_slots(asset_id,slot_name,allowed_type,created_at)
        SELECT ((x-1)/10)+1,'slot-'||x,'BATTERY','2025-01-01' FROM generate_series(1,10000) x;
      INSERT INTO component_models(component_type,manufacturer,model_name) VALUES ('BATTERY','Test','PX');
      INSERT INTO component_batches(component_model_id,batch_code)
        SELECT 1,'BATCH-'||x FROM generate_series(1,100) x;
      INSERT INTO components(serial_no,batch_id,created_at)
        SELECT 'PART-'||x,((x-1)/100)+1,'2025-01-01' FROM generate_series(1,10000) x;
      INSERT INTO maintenance_events(id,asset_id,technician_id,event_type,occurred_at)
        SELECT x, (((x-1)%10000)/10)+1,1,'INSTALL','2025-01-01'::timestamptz+(((x-1)/10000)*interval '2 days')
        FROM generate_series(1,100000) x;
      INSERT INTO maintenance_events(id,asset_id,technician_id,event_type,occurred_at)
        SELECT x+100000, (((x-1)%10000)/10)+1,1,'REMOVE',
          '2025-01-02'::timestamptz+(((x-1)/10000)*interval '2 days') FROM generate_series(1,90000) x;
      INSERT INTO installations(asset_slot_id,component_id,installed_at,removed_at,installed_event_id,removed_event_id)
        SELECT ((x-1)%10000)+1,((x-1)%10000)+1,
          '2025-01-01'::timestamptz+(((x-1)/10000)*interval '2 days'),
          CASE WHEN x<=90000 THEN '2025-01-02'::timestamptz+(((x-1)/10000)*interval '2 days') END,
          x,CASE WHEN x<=90000 THEN x+100000 END FROM generate_series(1,100000) x;
      ANALYZE;
    """))
queries = {
    "current_composition": "SELECT s.slot_name,c.serial_no FROM asset_slots s LEFT JOIN installations i ON i.asset_slot_id=s.id AND i.removed_at IS NULL LEFT JOIN components c ON c.id=i.component_id WHERE s.asset_id=500",
    "historical_composition": "SELECT s.slot_name,c.serial_no FROM asset_slots s LEFT JOIN installations i ON i.asset_slot_id=s.id AND i.installed_at<='2025-01-09T12:00:00Z' AND (i.removed_at IS NULL OR i.removed_at>'2025-01-09T12:00:00Z') LEFT JOIN components c ON c.id=i.component_id WHERE s.asset_id=500",
    "current_batch_impact": "SELECT DISTINCT s.asset_id FROM components c JOIN installations i ON i.component_id=c.id JOIN asset_slots s ON s.id=i.asset_slot_id WHERE c.batch_id=50 AND i.removed_at IS NULL",
    "historical_batch_impact": "SELECT DISTINCT s.asset_id FROM components c JOIN installations i ON i.component_id=c.id JOIN asset_slots s ON s.id=i.asset_slot_id WHERE c.batch_id=50",
    "asset_pagination": "SELECT * FROM assets ORDER BY id LIMIT 10 OFFSET 500",
}
results = {}
with engine.connect() as c:
    version = one(c, "SELECT version() AS v")["v"]
    for name, query in queries.items():
        plan = c.execute(text("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query)).scalar_one()[0]
        results[name] = {"sql": query, "plan": plan}
output = {"recorded_at": datetime.now(timezone.utc).isoformat(), "host": platform.platform(), "postgres": version,
          "dataset": {"assets": 1000, "components": 10000, "installations": 100000}, "queries": results}
(root / "docs/performance.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
for name, result in results.items():
    print(name, result["plan"]["Execution Time"], "ms")
