# API 使用说明

Base URL：`http://127.0.0.1:8010/api`。OpenAPI 原始契约见 `openapi.json`，交互文档在 `/docs`。

## 查询与登记

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | /health | 数据库连通性 |
| GET | /dashboard | 统计与最近维修 |
| GET / POST | /assets | 资产查询/登记 |
| GET | /assets/{id} | 资产详情 |
| GET / POST | /assets/{id}/slots | 槽位查询/创建 |
| POST | /assets/{id}/retire | 拆空后退役 |
| GET | /assets/{id}/components | 当前组成 |
| GET | /assets/{id}/components?at=… | 历史组成，必须带时区 |
| GET / POST | /users | 操作人员查询/登记 |
| GET / POST | /component-models | 型号查询/登记 |
| GET / POST | /components | 物理部件查询/登记 |
| GET | /components/{id} | 部件详情 |
| GET | /components/{id}/history | 生产来源、登记信息、安装/拆卸/召回履历 |
| GET / POST | /batches | 批次查询/登记 |
| POST | /batches/{id}/recall | 标记召回 |
| GET | /batches/{id}/impact/current | 当前使用资产及明细 |
| GET | /batches/{id}/impact/history | 历史暴露资产及明细 |

所有路径中的 id 是数据库整数主键，不是 D001 这样的业务编号。

资产、用户、型号、部件、批次的列表支持 `q`、`status`、`page`、`page_size`。页码从 1 起，默认每页 50，最大 100。`status` 分别匹配资产状态、用户角色、型号类型、部件状况、批次召回状态。

列表响应：

```json
{"items": [], "total": 0, "page": 1, "page_size": 50}
```

登记资产示例：

```bash
curl -X POST http://127.0.0.1:8010/api/assets \
  -H 'Content-Type: application/json' \
  -d '{"asset_code":"D100","asset_type":"DRONE","model_name":"实验无人机","acquired_at":"2026-09-01"}'
```

创建顺序为：型号 → 批次 → 部件；资产 → 槽位。字段必填、长度、枚举和可空性以 OpenAPI 请求模型为准。未知字段拒绝，不能用 `occurred_at` 回填历史。

## 维修请求

```text
POST /maintenance/install
POST /maintenance/remove
POST /maintenance/swap
```

公共字段：`asset_id`、`slot_id`、`technician_id`，以及可选 `note`（最多 2000 字）。

安装增加 `new_component_id`；拆卸增加 `expected_installation_id`；更换同时需要这两个字段。旧安装 id 从当前组成响应读取。

```json
{
  "asset_id": 1,
  "slot_id": 1,
  "new_component_id": 3,
  "expected_installation_id": 1,
  "technician_id": 1,
  "note": "例行电池更换"
}
```

成功返回 `201`：

```json
{
  "event": {
    "id": 6,
    "asset_id": 1,
    "technician_id": 1,
    "event_type": "SWAP",
    "occurred_at": "2026-09-22T10:00:00Z",
    "note": "例行电池更换"
  },
  "components": []
}
```

此处时间和 id 仅为格式示例；真实响应中 `components` 为该资产全部槽位组成。

## 历史查询与召回

```bash
curl --get http://127.0.0.1:8010/api/assets/1/components \
  --data-urlencode 'at=2026-05-01T12:00:00+08:00'
```

历史组成包含 `mode: "history"`、查询 `at` 和 `items`。每个槽位提供 `slot_id`、`slot_name`、`allowed_type`、安装 id、部件 id/编号、批次状态与安装时间；空槽位的部件字段为 null。

```bash
curl -X POST http://127.0.0.1:8010/api/batches/1/recall \
  -H 'Content-Type: application/json' \
  -d '{"technician_id":2,"reason":"供应商报告潜在热失控风险"}'
```

重复召回返回已存在的记录，不改写首次原因或时间。影响接口的 `total` 是去重资产数；每个资产的 `exposures` 保留全部匹配安装区间。未召回批次也允许查询使用范围，便于召回前评估。

## 错误约定

| 状态 | 说明 |
|---|---|
| 200 | 查询、召回、退役成功 |
| 201 | 登记或维修事件创建成功 |
| 404 | 指定业务资源不存在 |
| 409 | 占用、过期状态、禁用状态、类型不匹配或约束冲突 |
| 422 | 输入格式、枚举、必填项、时间缺少时区 |
| 503 | 锁等待/事务暂时冲突，可稍后重试 |
| 500 | 未预期数据库错误，后端记录详情 |

```json
{"error":{"code":"COMPONENT_OCCUPIED","message":"部件正在另一槽位使用"}}
```

校验错误额外提供 `fields: [{"field":"body.serial_no","message":"…"}]`。常见业务码包括 `SLOT_OCCUPIED`、`STALE_INSTALLATION`、`ASSET_RETIRED`、`BATCH_RECALLED`、`COMPONENT_UNUSABLE`、`TYPE_MISMATCH`、`SAME_COMPONENT`、`SLOT_MISMATCH`。

角色字段不构成认证授权，接口不使用 JWT。所有业务输入通过绑定参数进入 SQL，数据库异常详情不返回浏览器。
