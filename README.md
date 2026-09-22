# LifeTrace v1.0

**面向物理资产动态组成关系和部件溯源的时态数据库应用。**

资产身份保持不变，组成随时间演化。系统记录每块部件的安装、拆卸、更换与批次来源，重建历史配置，并区分召回批次的当前影响与历史暴露。

![LifeTrace 工作台](docs/screenshots/dashboard.png)

## 快速运行

前提：Docker Desktop / Docker Engine 与 Compose 已运行。首次构建需要网络，构建完成后应用运行不依赖 AI、CDN 或外部服务。

```bash
docker compose up -d --build
```

首次空库可加载交互演示数据（已有数据时会拒绝覆盖）：

```bash
docker compose exec app python -m lifetrace.seed --scenario interactive
```

- 应用：http://127.0.0.1:8010
- 接口文档：http://127.0.0.1:8010/docs
- 健康检查：http://127.0.0.1:8010/api/health
- PostgreSQL：`localhost:54329`，数据库/用户/默认本地密码均为 `lifetrace`。

停止服务使用 `docker compose down`，保留持久卷。再次 `docker compose up -d` 即可继续使用，不会重新填充或清空数据。

默认仅绑定本机。用户表用于记录操作者，没有登录与鉴权；不要直接当作公网多用户系统部署。

## 演示场景

**下面的 reset 命令会清空当前项目的业务数据，只用于重置演示。**

```bash
# 交互起点：B102 在 D001；B118 在 D014；D009 电池槽为空；B221/B300 可用
docker compose exec app python -m lifetrace.seed --reset --scenario interactive

# 完成历史：B102 曾在 D001、现位于 D009，目标批次已召回
docker compose exec app python -m lifetrace.seed --reset --scenario history
```

完整故事：D001 上 B102 换成 B221 → 将 B102 安装到 D009 → 召回 BAT-2026-03 → 当前影响为 D009/D014，历史暴露为 D001/D009/D014。

历史场景可查询 D001 的 `2026-05-01 12:00` 与 `2026-09-01 12:00`，观察 B102/B221 的变化。交互场景的实际操作使用服务器当前时间。

## 技术路线

| 层次 | 实现 |
|---|---|
| Web | React 19、TypeScript、Vite、React Router |
| 数据与界面 | TanStack Query、Tailwind 4、Radix/shadcn 风格可编辑组件、Lucide |
| API | FastAPI、Pydantic 2、OpenAPI、生成的 TypeScript 契约 |
| SQL / 事务 | SQLAlchemy 2 Core 的参数化 SQL、Psycopg 3、显式事务 |
| 数据库 | PostgreSQL 18、btree_gist、行锁、排斥约束、部分唯一索引 |
| 工程 | Alembic、uv、pnpm、Docker Compose、CI |
| 验证 | pytest、HTTPX、Vitest、Playwright、EXPLAIN ANALYZE |

具体补丁版本见 `backend/uv.lock`、`backend/requirements.txt` 和 `frontend/pnpm-lock.yaml`。前端使用浏览器 SPA，无需 SSR。业务、数据库事务集中在一个后端进程边界内，不引入分布式服务。

## 本地开发

安装 Python 3.13（uv 可管理）、Node 22、pnpm 10.34.5。Docker 仅运行 PostgreSQL：

```bash
docker compose stop app
docker compose up -d db
cd backend
uv sync --frozen
uv run alembic upgrade head
# 仅空库首次执行
uv run python -m lifetrace.seed
uv run uvicorn lifetrace.app:app --reload --host 127.0.0.1 --port 8010
```

另开终端：

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

打开 Vite 显示的本地地址。前端 `/api` 由 Vite 转发至 8010。`DATABASE_URL` 通过环境变量覆盖，格式参照 `.env.example`；Compose 自动读取项目根目录 `.env`，本地 Python 进程需显式导出环境变量。

## 测试与复现

测试会清空 `lifetrace_test*` 专用数据库，不修改演示库。不要将测试数据库变量指向演示库或真实数据。

```bash
backend/.venv/bin/python scripts/init_test_db.py
cd frontend
pnpm exec playwright install chromium
cd ..
bash scripts/verify.sh
```

分项运行：

```bash
cd backend
uv run pytest -q
uv run pytest -q -k failure_after_close
uv run pytest -q tests/test_concurrency.py
uv run ruff check .
uv run ruff format --check .
```

```bash
cd frontend
pnpm lint
pnpm test
pnpm build
# 先初始化 E2E 数据库结构
cd ../backend
DATABASE_URL=postgresql+psycopg://lifetrace:lifetrace@localhost:54329/lifetrace_test_e2e uv run alembic upgrade head
cd ../frontend
pnpm test:e2e
```

额外验收：

```bash
# 真实重启本项目 PostgreSQL 容器及独立验收后端
backend/.venv/bin/python scripts/persistence.py

# 独立性能数据库：1000 资产、10000 部件、100000 条安装记录
backend/.venv/bin/python scripts/init_test_db.py lifetrace_test_perf
backend/.venv/bin/python scripts/benchmark.py
```

后端测试端口为数据库 `54329`；E2E 自动启动应用 `8011`；重启测试使用 `8012`。上述端口如已占用应先调整对应配置。

## 接口契约与数据库结构

```bash
backend/.venv/bin/python scripts/export_openapi.py
cd frontend
pnpm generate:api
```

`docs/openapi.json` 是生成契约，`frontend/src/api-schema.d.ts` 是生成类型。更换接口使用 `openapi-fetch` 类型化客户端；其他查询经统一请求函数与业务类型处理。CI 检查契约生成后是否产生未提交差异。

标准初始化路径是 Alembic。`schema.sql` 提供可独立执行的完整建库 SQL；`seed.sql` 提供空库数据样本。若使用纯 SQL 路线，不要再对同一非空 schema 执行初始 Alembic 迁移，需明确采用一种初始化方式。

## 项目结构

```text
backend/lifetrace/    请求/响应契约、API、事务服务、连接与种子工具
backend/migrations/  数据库版本迁移
backend/tests/       约束、API、历史、回滚、并发测试
frontend/src/        五页工作台、组件、样式及生成类型
frontend/e2e/        浏览器验收
scripts/             验证、契约导出、重启与性能测试
docs/                设计、接口、测试证据、实验报告和答辩脚本
schema.sql           完整数据库 DDL
seed.sql             空库交互演示数据
compose.yaml         本地应用和 PostgreSQL
```

## 交付文档

- [需求与技术设计](docs/design.md)：课程对应、ER 图、数据字典、事务设计。
- [前端优化记录](docs/frontend-refresh.md)：设计依据、界面变化与浏览器回归。
- [接口说明](docs/api.md)：请求响应、状态码与业务冲突。
- [测试验收报告](docs/test-report.md)：测试范围、结果、复现方法和限制。
- [实验报告](docs/lab-report.md)：实验目标、实现原理与结果分析。
- [答辩演示脚本](docs/demo.md)：正常流程、回滚、并发与时间查询。
- [原始性能测量](docs/performance.json)、[重启恢复证据](docs/persistence.json)。

## 版本管理

本地仓库名为 `lifetrace`，默认分支为 `main`。七个初始提交按工程规范、数据库、API、Web、测试、部署和文档组织，详见 [提交组织说明](docs/development-history.md)。依赖和构建产物不提交，安装时使用锁文件恢复。
