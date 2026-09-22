from datetime import timedelta

from sqlalchemy import text

from .db import one, rows, transaction


class Problem(Exception):
    def __init__(self, code, message, status=409):
        self.code, self.message, self.status = code, message, status


def require(row, label="记录"):
    if row is None:
        raise Problem("NOT_FOUND", f"{label}不存在", 404)
    return row


def composition(conn, asset_id, at=None):
    require(one(conn, "SELECT id FROM assets WHERE id=:id", id=asset_id), "资产")
    predicate = (
        "i.removed_at IS NULL"
        if at is None
        else ("i.installed_at<=:at AND (i.removed_at IS NULL OR i.removed_at>:at)")
    )
    return rows(
        conn,
        f"""
      SELECT s.id AS slot_id,s.slot_name,s.allowed_type,i.id AS installation_id,
      c.id AS component_id,c.serial_no,c.condition_status,b.batch_code,b.recall_status,
      i.installed_at,i.removed_at
      FROM asset_slots s LEFT JOIN installations i ON i.asset_slot_id=s.id AND {predicate}
      LEFT JOIN components c ON c.id=i.component_id
      LEFT JOIN component_batches b ON b.id=c.batch_id
      WHERE s.asset_id=:id {"" if at is None else "AND s.created_at<=:at"} ORDER BY s.id
    """,
        id=asset_id,
        at=at,
    )


def maintain(action, data, after_close=None):
    """after_close is an internal test seam, never accepted by HTTP."""
    with transaction() as conn:
        asset = require(one(conn, "SELECT * FROM assets WHERE id=:id FOR UPDATE", id=data.asset_id), "资产")
        slot = require(
            one(conn, "SELECT * FROM asset_slots WHERE id=:id FOR UPDATE", id=data.slot_id), "槽位"
        )
        if slot["asset_id"] != data.asset_id:
            raise Problem("SLOT_MISMATCH", "槽位不属于此资产")
        if asset["status"] != "ACTIVE":
            raise Problem("ASSET_RETIRED", "资产已退役")
        require(one(conn, "SELECT id FROM users WHERE id=:id", id=data.technician_id), "操作人员")
        old = one(
            conn,
            "SELECT * FROM installations WHERE asset_slot_id=:id AND removed_at IS NULL",
            id=data.slot_id,
        )
        if action == "INSTALL" and old:
            raise Problem("SLOT_OCCUPIED", "槽位已有部件，请使用更换操作")
        if action != "INSTALL" and (not old or old["id"] != data.expected_installation_id):
            raise Problem("STALE_INSTALLATION", "当前安装已变化，请刷新后重试")
        new_id = getattr(data, "new_component_id", None)
        if old and new_id == old["component_id"]:
            raise Problem("SAME_COMPONENT", "新旧部件不能相同")
        ids = sorted({i for i in [new_id, old["component_id"] if old else None] if i is not None})
        # All writers follow asset -> slot -> sorted batches -> sorted components.
        batches = rows(
            conn, "SELECT DISTINCT batch_id FROM components WHERE id=ANY(:ids) ORDER BY batch_id", ids=ids
        )
        for batch in batches:
            conn.execute(
                text("SELECT id FROM component_batches WHERE id=:id FOR UPDATE"), {"id": batch["batch_id"]}
            )
        conn.execute(
            text("SELECT id FROM components WHERE id=ANY(:ids) ORDER BY id FOR UPDATE"), {"ids": ids}
        )
        if new_id:
            new = require(
                one(
                    conn,
                    """SELECT c.*,b.recall_status,m.component_type FROM components c
              JOIN component_batches b ON b.id=c.batch_id JOIN component_models m ON m.id=b.component_model_id
              WHERE c.id=:id""",
                    id=new_id,
                ),
                "部件",
            )
            if new["condition_status"] != "GOOD":
                raise Problem("COMPONENT_UNUSABLE", "部件状态不允许安装")
            if new["recall_status"] == "RECALLED":
                raise Problem("BATCH_RECALLED", "部件所属批次已召回")
            if new["component_type"] != slot["allowed_type"]:
                raise Problem("TYPE_MISMATCH", "部件类型与槽位不兼容")
            if one(
                conn, "SELECT id FROM installations WHERE component_id=:id AND removed_at IS NULL", id=new_id
            ):
                raise Problem("COMPONENT_OCCUPIED", "部件正在另一槽位使用")
        clock = one(conn, "SELECT clock_timestamp() AS t")["t"]
        latest = one(
            conn,
            """SELECT max(greatest(installed_at,removed_at)) AS t FROM installations
            WHERE asset_slot_id=:slot OR component_id=ANY(:ids)""",
            slot=data.slot_id,
            ids=ids,
        )["t"]
        when = max(clock, latest + timedelta(microseconds=1)) if latest else clock
        event = one(
            conn,
            """INSERT INTO maintenance_events(asset_id,technician_id,event_type,occurred_at,note)
           VALUES (:asset,:user,:action,:time,:note) RETURNING *""",
            asset=data.asset_id,
            user=data.technician_id,
            action=action,
            time=when,
            note=data.note,
        )
        if old:
            conn.execute(
                text("UPDATE installations SET removed_at=:time,removed_event_id=:event WHERE id=:id"),
                {"time": when, "event": event["id"], "id": old["id"]},
            )
            if after_close:
                after_close(conn)
        if new_id:
            conn.execute(
                text("""INSERT INTO installations(asset_slot_id,component_id,installed_at,installed_event_id)
                VALUES (:slot,:component,:time,:event)"""),
                {"slot": data.slot_id, "component": new_id, "time": when, "event": event["id"]},
            )
        return {"event": event, "components": composition(conn, data.asset_id)}


def recall(batch_id, data):
    with transaction() as conn:
        batch = require(
            one(conn, "SELECT * FROM component_batches WHERE id=:id FOR UPDATE", id=batch_id), "批次"
        )
        require(one(conn, "SELECT id FROM users WHERE id=:id", id=data.technician_id), "操作人员")
        if batch["recall_status"] == "RECALLED":
            return batch
        return one(
            conn,
            """UPDATE component_batches SET recall_status='RECALLED',recalled_at=clock_timestamp(),
            recalled_by=:user,recall_reason=:reason WHERE id=:id RETURNING *""",
            user=data.technician_id,
            reason=data.reason,
            id=batch_id,
        )


def impact(conn, batch_id, current):
    require(one(conn, "SELECT id FROM component_batches WHERE id=:id", id=batch_id), "批次")
    exposures = rows(
        conn,
        """SELECT a.id AS asset_id,a.asset_code,a.model_name,s.slot_name,
       c.id AS component_id,c.serial_no,i.installed_at,i.removed_at FROM components c
       JOIN installations i ON i.component_id=c.id JOIN asset_slots s ON s.id=i.asset_slot_id
       JOIN assets a ON a.id=s.asset_id WHERE c.batch_id=:id """
        + ("AND i.removed_at IS NULL " if current else "")
        + "ORDER BY a.asset_code,i.installed_at",
        id=batch_id,
    )
    grouped = {}
    for row in exposures:
        group = grouped.setdefault(
            row["asset_id"],
            {
                "asset_id": row["asset_id"],
                "asset_code": row["asset_code"],
                "model_name": row["model_name"],
                "exposures": [],
            },
        )
        group["exposures"].append(row)
    return {"items": list(grouped.values()), "total": len(grouped)}
