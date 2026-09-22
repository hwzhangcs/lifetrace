from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError

from . import responses as r
from . import schemas as s
from .db import engine, one, rows, transaction
from .service import Problem, composition, impact, maintain, recall, require

app = FastAPI(
    title="LifeTrace API",
    version="1.0.0",
    description="物理资产时态组成与部件溯源",
    responses={code: {"model": r.ErrorResponse} for code in [404, 409, 422, 500, 503]},
)


@app.exception_handler(Problem)
async def problem_handler(request: Request, exc: Problem):
    return JSONResponse(status_code=exc.status, content={"error": {"code": exc.code, "message": exc.message}})


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "请检查输入字段",
                "fields": [
                    {"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in exc.errors()
                ],
            }
        },
    )


@app.exception_handler(IntegrityError)
async def integrity_handler(request: Request, exc: IntegrityError):
    code = getattr(exc.orig, "sqlstate", "")
    messages = {
        "23505": "编号重复或资源已被占用",
        "23503": "引用不存在，或记录仍被历史引用",
        "23P01": "安装时间与已有历史重叠",
        "23514": "数据违反约束或历史保护规则",
    }
    return JSONResponse(
        status_code=409,
        content={"error": {"code": "CONSTRAINT_CONFLICT", "message": messages.get(code, "数据约束冲突")}},
    )


@app.exception_handler(DBAPIError)
async def database_handler(request: Request, exc: DBAPIError):
    code = getattr(exc.orig, "sqlstate", "")
    if code in {"55P03", "40P01", "40001", "57014"}:
        return JSONResponse(
            status_code=503,
            headers={"Retry-After": "1"},
            content={"error": {"code": "RETRY_LATER", "message": "资源忙，请稍后重试"}},
        )
    import logging

    logging.getLogger("lifetrace").exception("Database operation failed")
    return JSONResponse(
        status_code=500, content={"error": {"code": "DATABASE_ERROR", "message": "数据库操作失败"}}
    )


@app.get("/api/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}


def insert(table, data):
    # table/column names are exclusively supplied by application schemas.
    values = data.model_dump()
    with transaction() as conn:
        return one(
            conn,
            f"INSERT INTO {table} ({','.join(values)}) VALUES "
            f"({','.join(':' + key for key in values)}) RETURNING *",
            **values,
        )


LISTS = {
    "assets": ("assets a", "a.*", "a.asset_code || ' ' || a.model_name", "a.status"),
    "users": ("users a", "a.*", "a.name", "a.role"),
    "component-models": (
        "component_models a",
        "a.*",
        "a.model_name || ' ' || a.component_type",
        "a.component_type",
    ),
    "batches": (
        "component_batches a JOIN component_models m ON m.id=a.component_model_id",
        "a.*,m.model_name,m.component_type",
        "a.batch_code",
        "a.recall_status",
    ),
    "components": (
        """components a JOIN component_batches b ON b.id=a.batch_id
       JOIN component_models m ON m.id=b.component_model_id
       LEFT JOIN installations i ON i.component_id=a.id AND i.removed_at IS NULL
       LEFT JOIN asset_slots sl ON sl.id=i.asset_slot_id LEFT JOIN assets ast ON ast.id=sl.asset_id""",
        """a.*,b.batch_code,b.recall_status,m.component_type,m.model_name,i.id AS installation_id,
       ast.asset_code,sl.slot_name""",
        "a.serial_no || ' ' || b.batch_code",
        "a.condition_status",
    ),
}


def make_list(resource):
    def endpoint(
        q: str = Query(default="", max_length=100),
        status: str | None = None,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=50, ge=1, le=100),
    ):
        source, columns, search, status_col = LISTS[resource]
        where = f"WHERE ({search}) ILIKE :q" + (f" AND {status_col}=:status" if status else "")
        params = {"q": f"%{q}%", "status": status, "limit": page_size, "offset": (page - 1) * page_size}
        with engine.connect() as conn:
            result = rows(
                conn,
                f"SELECT {columns} FROM {source} {where} ORDER BY a.id LIMIT :limit OFFSET :offset",
                **params,
            )
            total = one(conn, f"SELECT count(*) AS total FROM {source} {where}", **params)["total"]
        return {"items": result, "total": total, "page": page, "page_size": page_size}

    endpoint.__name__ = f"list_{resource.replace('-', '_')}"
    return endpoint


for resource in LISTS:
    model = {
        "assets": r.Asset,
        "components": r.Component,
        "batches": r.Batch,
        "users": r.User,
        "component-models": r.Model,
    }[resource]
    app.get(f"/api/{resource}", response_model=r.Page[model])(make_list(resource))


@app.post("/api/assets", status_code=201, response_model=r.Asset)
def create_asset(data: s.AssetIn):
    return insert("assets", data)


@app.post("/api/users", status_code=201, response_model=r.User)
def create_user(data: s.UserIn):
    return insert("users", data)


@app.post("/api/component-models", status_code=201, response_model=r.Model)
def create_model(data: s.ModelIn):
    return insert("component_models", data)


@app.post("/api/batches", status_code=201, response_model=r.Batch)
def create_batch(data: s.BatchIn):
    return insert("component_batches", data)


@app.post("/api/components", status_code=201, response_model=r.Component)
def create_component(data: s.ComponentIn):
    return insert("components", data)


@app.get("/api/assets/{asset_id}", response_model=r.Asset)
def asset_detail(asset_id: int):
    with engine.connect() as conn:
        return require(one(conn, "SELECT * FROM assets WHERE id=:id", id=asset_id), "资产")


@app.get("/api/assets/{asset_id}/slots", response_model=r.Items[r.Slot])
def slots(asset_id: int):
    with engine.connect() as conn:
        require(one(conn, "SELECT id FROM assets WHERE id=:id", id=asset_id), "资产")
        return {"items": rows(conn, "SELECT * FROM asset_slots WHERE asset_id=:id ORDER BY id", id=asset_id)}


@app.post("/api/assets/{asset_id}/slots", status_code=201, response_model=r.Slot)
def create_slot(asset_id: int, data: s.SlotIn):
    with transaction() as conn:
        asset = require(one(conn, "SELECT * FROM assets WHERE id=:id FOR UPDATE", id=asset_id), "资产")
        if asset["status"] != "ACTIVE":
            raise Problem("ASSET_RETIRED", "资产已退役")
        return one(
            conn,
            """INSERT INTO asset_slots(asset_id,slot_name,allowed_type) VALUES (:id,:slot_name,:allowed_type)
                   RETURNING *""",
            id=asset_id,
            **data.model_dump(),
        )


@app.post("/api/assets/{asset_id}/retire", response_model=r.Asset)
def retire_asset(asset_id: int):
    with transaction() as conn:
        require(one(conn, "SELECT id FROM assets WHERE id=:id FOR UPDATE", id=asset_id), "资产")
        if one(
            conn,
            """SELECT i.id FROM installations i JOIN asset_slots s ON s.id=i.asset_slot_id
          WHERE s.asset_id=:id AND i.removed_at IS NULL LIMIT 1""",
            id=asset_id,
        ):
            raise Problem("ASSET_OCCUPIED", "请先拆卸所有部件再退役")
        return one(conn, "UPDATE assets SET status='RETIRED' WHERE id=:id RETURNING *", id=asset_id)


@app.get("/api/assets/{asset_id}/components", response_model=r.Composition)
def asset_composition(asset_id: int, at: datetime | None = None):
    if at is not None and at.tzinfo is None:
        raise Problem("TIMEZONE_REQUIRED", "查询时间必须包含时区", 422)
    with engine.connect() as conn:
        return {"items": composition(conn, asset_id, at), "at": at, "mode": "history" if at else "current"}


@app.get("/api/components/{component_id}", response_model=r.Component)
def component_detail(component_id: int):
    with engine.connect() as conn:
        return require(
            one(
                conn,
                """SELECT c.*,b.batch_code,b.recall_status,m.model_name,m.component_type
           FROM components c JOIN component_batches b ON b.id=c.batch_id
           JOIN component_models m ON m.id=b.component_model_id WHERE c.id=:id""",
                id=component_id,
            ),
            "部件",
        )


@app.get("/api/components/{component_id}/history", response_model=r.History)
def component_history(component_id: int):
    with engine.connect() as conn:
        component = require(
            one(
                conn,
                """SELECT c.*,b.manufactured_at,b.recalled_at,b.recall_reason,b.recalled_by
             FROM components c JOIN component_batches b ON b.id=c.batch_id WHERE c.id=:id""",
                id=component_id,
            ),
            "部件",
        )
        history = rows(
            conn,
            """SELECT e.id,e.event_type,e.occurred_at,e.note,u.name AS technician,
          a.id AS asset_id,a.asset_code,s.slot_name,
          CASE WHEN e.id=i.installed_event_id THEN 'INSTALL' ELSE 'REMOVE' END AS action
          FROM installations i JOIN asset_slots s ON s.id=i.asset_slot_id JOIN assets a ON a.id=s.asset_id
          JOIN maintenance_events e ON e.id=i.installed_event_id OR e.id=i.removed_event_id
          JOIN users u ON u.id=e.technician_id WHERE i.component_id=:id ORDER BY e.occurred_at,e.id""",
            id=component_id,
        )
        if component["recalled_at"]:
            user = one(conn, "SELECT name FROM users WHERE id=:id", id=component["recalled_by"])
            history.append(
                {
                    "action": "RECALL",
                    "occurred_at": component["recalled_at"],
                    "note": component["recall_reason"],
                    "technician": user["name"],
                }
            )
        history.sort(key=lambda e: e["occurred_at"])
        return {"component": component, "items": history}


@app.post("/api/maintenance/install", status_code=201, response_model=r.Maintenance)
def install(data: s.InstallIn):
    return maintain("INSTALL", data)


@app.post("/api/maintenance/remove", status_code=201, response_model=r.Maintenance)
def remove(data: s.RemoveIn):
    return maintain("REMOVE", data)


@app.post("/api/maintenance/swap", status_code=201, response_model=r.Maintenance)
def swap(data: s.SwapIn):
    return maintain("SWAP", data)


@app.post("/api/batches/{batch_id}/recall", response_model=r.Batch)
def recall_batch(batch_id: int, data: s.RecallIn):
    return recall(batch_id, data)


@app.get("/api/batches/{batch_id}/impact/{mode}", response_model=r.Impact)
def batch_impact(batch_id: int, mode: str):
    if mode not in {"current", "history"}:
        raise Problem("INVALID_MODE", "影响类型必须为 current 或 history", 422)
    with engine.connect() as conn:
        return impact(conn, batch_id, mode == "current")


@app.get("/api/dashboard", response_model=r.Dashboard)
def dashboard():
    with engine.connect() as conn:
        counts = one(
            conn,
            """SELECT (SELECT count(*) FROM assets) AS assets,
          (SELECT count(*) FROM components) AS components,
          (SELECT count(*) FROM component_batches WHERE recall_status='RECALLED') AS recalled_batches,
          (SELECT count(DISTINCT s.asset_id) FROM installations i JOIN asset_slots s ON s.id=i.asset_slot_id
          JOIN components c ON c.id=i.component_id JOIN component_batches b ON b.id=c.batch_id
          WHERE i.removed_at IS NULL AND b.recall_status='RECALLED') AS affected_assets""",
        )
        recent = rows(
            conn,
            """SELECT e.*,a.asset_code,u.name AS technician FROM maintenance_events e
           JOIN assets a ON a.id=e.asset_id JOIN users u ON u.id=e.technician_id
           ORDER BY e.occurred_at DESC,e.id DESC LIMIT 8""",
        )
        return {"counts": counts, "recent": recent}


dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if (dist / "index.html").exists() and (dist / "static").is_dir():
    app.mount("/static", StaticFiles(directory=dist / "static"), name="static")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/"):
            raise Problem("NOT_FOUND", "接口不存在", 404)
        return FileResponse(dist / "index.html")
