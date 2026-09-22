import pytest


def body(**changes):
    return dict(
        asset_id=1,
        slot_id=1,
        technician_id=1,
        expected_installation_id=1,
        new_component_id=3,
        note="例行更换",
        **changes,
    )


def test_complete_story(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    response = client.post("/api/maintenance/swap", json=body())
    assert response.status_code == 201
    assert response.json()["components"][0]["serial_no"] == "B221"
    result = client.post(
        "/api/maintenance/install",
        json={"asset_id": 2, "slot_id": 5, "technician_id": 1, "new_component_id": 1},
    )
    assert result.status_code == 201
    recall = client.post("/api/batches/1/recall", json={"technician_id": 2, "reason": "热失控风险"})
    assert recall.status_code == 200
    current = client.get("/api/batches/1/impact/current").json()
    history = client.get("/api/batches/1/impact/history").json()
    assert {x["asset_code"] for x in current["items"]} == {"D009", "D014"}
    assert {x["asset_code"] for x in history["items"]} == {"D001", "D009", "D014"}
    events = client.get("/api/components/1/history").json()["items"]
    assert [e["action"] for e in events] == ["INSTALL", "REMOVE", "INSTALL", "RECALL"]
    assert client.get("/api/dashboard").json()["counts"]["affected_assets"] == 2
    again = client.post("/api/batches/1/recall", json={"technician_id": 1, "reason": "不能覆盖"})
    assert again.json() == recall.json()


@pytest.mark.parametrize(
    "path,payload",
    [
        ("assets", {"asset_code": "D001", "asset_type": "DRONE", "model_name": "重复"}),
        ("components", {"serial_no": "B102", "batch_id": 1}),
        ("batches", {"batch_code": "BAT-2026-03", "component_model_id": 1}),
        ("assets/1/slots", {"slot_name": "battery-main", "allowed_type": "BATTERY"}),
    ],
)
def test_duplicate_identity(client, path, payload):
    assert client.post(f"/api/{path}", json=payload).status_code == 409


@pytest.mark.parametrize(
    "path,payload",
    [
        ("assets", {"asset_code": "  ", "asset_type": "DRONE", "model_name": "x"}),
        ("assets", {"asset_code": "new", "asset_type": "DRONE"}),
        ("components", {"serial_no": "X", "batch_id": "invalid"}),
        ("components", {"serial_no": "X", "batch_id": 1, "condition_status": "AVAILABLE"}),
        ("users", {"name": "", "role": "MANAGER"}),
        ("users", {"name": "user", "role": "ADMIN"}),
        ("batches/1/recall", {"technician_id": 2, "reason": "   "}),
        (
            "maintenance/install",
            {
                "asset_id": 2,
                "slot_id": 5,
                "new_component_id": 3,
                "technician_id": 1,
                "occurred_at": "2020-01-01T00:00:00Z",
            },
        ),
    ],
)
def test_invalid_input(client, path, payload):
    r = client.post(f"/api/{path}", json=payload)
    assert r.status_code == 422
    assert r.json()["error"]["fields"]


@pytest.mark.parametrize(
    "path,payload",
    [
        ("components", {"serial_no": "NEW", "batch_id": 999}),
        ("batches", {"batch_code": "NEW", "component_model_id": 999}),
    ],
)
def test_invalid_foreign_key(client, path, payload):
    assert client.post(f"/api/{path}", json=payload).status_code == 409


@pytest.mark.parametrize(
    "path",
    [
        "assets/999",
        "assets/999/components",
        "assets/999/slots",
        "components/999",
        "components/999/history",
        "batches/999/impact/current",
    ],
)
def test_not_found(client, path):
    assert client.get(f"/api/{path}").status_code == 404


@pytest.mark.parametrize(
    "changes,code",
    [
        ({"new_component_id": 2}, "COMPONENT_OCCUPIED"),
        ({"new_component_id": 8}, "COMPONENT_UNUSABLE"),
        ({"new_component_id": 5}, "TYPE_MISMATCH"),
        ({"new_component_id": 1}, "SAME_COMPONENT"),
        ({"expected_installation_id": 999}, "STALE_INSTALLATION"),
        ({"slot_id": 5}, "SLOT_MISMATCH"),
    ],
)
def test_swap_rejections_leave_old_installation(client, changes, code):
    payload = body()
    payload.update(changes)
    response = client.post("/api/maintenance/swap", json=payload)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == code
    assert client.get("/api/assets/1/components").json()["items"][0]["serial_no"] == "B102"
    assert len(client.get("/api/components/1/history").json()["items"]) == 1


def test_recall_rejects_install_keeps_existing(client):
    client.post("/api/batches/2/recall", json={"technician_id": 2, "reason": "召回"})
    r = client.post("/api/maintenance/swap", json=body())
    assert r.status_code == 409 and r.json()["error"]["code"] == "BATCH_RECALLED"
    client.post("/api/batches/1/recall", json={"technician_id": 2, "reason": "召回"})
    assert client.get("/api/assets/1/components").json()["items"][0]["serial_no"] == "B102"


def test_remove_and_retire(client):
    assert client.post("/api/assets/1/retire", json={}).status_code == 409
    for slot in client.get("/api/assets/1/components").json()["items"]:
        r = client.post(
            "/api/maintenance/remove",
            json={
                "asset_id": 1,
                "slot_id": slot["slot_id"],
                "technician_id": 1,
                "expected_installation_id": slot["installation_id"],
            },
        )
        assert r.status_code == 201
    assert client.post("/api/assets/1/retire", json={}).json()["status"] == "RETIRED"
    assert (
        client.post(
            "/api/maintenance/install",
            json={"asset_id": 1, "slot_id": 1, "technician_id": 1, "new_component_id": 3},
        ).status_code
        == 409
    )
    assert len(client.get("/api/components/1/history").json()["items"]) == 2


def test_registration_pagination_and_parameterization(client):
    asset = client.post(
        "/api/assets", json={"asset_code": "D100", "asset_type": "ROBOT", "model_name": "' OR 1=1; --"}
    )
    assert asset.status_code == 201
    aid = asset.json()["id"]
    assert (
        client.post(
            f"/api/assets/{aid}/slots", json={"slot_name": "battery", "allowed_type": "BATTERY"}
        ).status_code
        == 201
    )
    assert client.get("/api/assets", params={"q": "' OR 1=1; --"}).json()["total"] == 1
    assert len(client.get("/api/assets?page_size=2&page=2").json()["items"]) == 2
    assert client.get("/api/assets?page=0").status_code == 422


def test_stale_swap(client):
    assert client.post("/api/maintenance/swap", json=body()).status_code == 201
    assert client.post("/api/maintenance/swap", json=body()).json()["error"]["code"] == "STALE_INSTALLATION"


def test_slot_occupied(client):
    assert (
        client.post(
            "/api/maintenance/install",
            json={"asset_id": 1, "slot_id": 1, "technician_id": 1, "new_component_id": 3},
        ).json()["error"]["code"]
        == "SLOT_OCCUPIED"
    )


def test_retired_component_cannot_install(client):
    component = client.post(
        "/api/components", json={"serial_no": "RETIRED-1", "batch_id": 2, "condition_status": "RETIRED"}
    ).json()
    result = client.post(
        "/api/maintenance/install",
        json={"asset_id": 2, "slot_id": 5, "technician_id": 1, "new_component_id": component["id"]},
    )
    assert result.status_code == 409
    assert result.json()["error"]["code"] == "COMPONENT_UNUSABLE"


@pytest.mark.parametrize("field", ["asset_id", "slot_id", "technician_id", "new_component_id"])
def test_maintenance_missing_reference(client, field):
    payload = body()
    payload[field] = 99999
    assert client.post("/api/maintenance/swap", json=payload).status_code == 404


def test_impact_deduplicates_repeated_exposure(client):
    assert client.post("/api/maintenance/swap", json=body()).status_code == 201
    installed = client.get("/api/assets/1/components").json()["items"][0]["installation_id"]
    result = client.post(
        "/api/maintenance/swap",
        json={
            "asset_id": 1,
            "slot_id": 1,
            "technician_id": 1,
            "new_component_id": 1,
            "expected_installation_id": installed,
        },
    )
    assert result.status_code == 201
    impact = client.get("/api/batches/1/impact/history").json()
    assert impact["total"] == 2
    assert len(next(a for a in impact["items"] if a["asset_code"] == "D001")["exposures"]) == 2
