import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Box,
  Boxes,
  Clock3,
  Search,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { formatTime, type Asset, type Page } from "../api";
import {
  Badge,
  CreateButton,
  Empty,
  ErrorBox,
  Header,
  Loading,
  Pagination,
} from "../ui";
import AssetBlueprint from "../components/AssetBlueprint";
import { useData, assetFields } from "../shared";

export default function Dashboard() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const overview = useData<{
    counts: {
      assets: number;
      components: number;
      recalled_batches: number;
      affected_assets: number;
    };
    recent: {
      id: number;
      asset_id: number;
      asset_code: string;
      event_type: string;
      technician: string;
      occurred_at: string;
    }[];
  }>("dashboard", "/dashboard");
  const assets = useData<Page<Asset>>(
    "assets",
    `/assets?q=${encodeURIComponent(q)}&page=${page}&page_size=10`,
  );
  const metrics = [
    ["在册资产", overview.data?.counts.assets, Box, "持续保留设备身份"],
    ["物理部件", overview.data?.counts.components, Boxes, "独立编号，全程追溯"],
    [
      "召回批次",
      overview.data?.counts.recalled_batches,
      ShieldAlert,
      "关注供应商质量风险",
    ],
    [
      "当前受影响资产",
      overview.data?.counts.affected_assets,
      Activity,
      "来自实时安装关系",
    ],
  ] as const;
  return (
    <>
      <Header
        eyebrow="01 / ASSET OPERATIONS"
        title="资产工作台"
        actions={
          <CreateButton title="登记资产" path="/assets" fields={assetFields} />
        }
      >
        查看实验室资产状态，追踪部件流转与批次影响。
      </Header>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            THE RECORD OF THINGS <span>物的档案</span>
          </span>
          <h2>
            一台设备。
            <br />
            <em>每一段来历。</em>
          </h2>
          <p>
            部件会更换，身份被保留。
            <br />
            沿着时间，找回资产的每一次变化。
          </p>
          <Link to="/maintenance" className="hero-link">
            开始一次维修 <ArrowUpRight size={18} />
          </Link>
          <div className="hero-footnote">
            <span>01 — COMPOSITION</span>
            <span>02 — HISTORY</span>
            <span>03 — PROVENANCE</span>
          </div>
        </div>
        <AssetBlueprint />
      </section>
      <ErrorBox error={overview.error} />
      <div className="metrics">
        {metrics.map(([label, value, Icon, desc], i) => (
          <div className={`metric m${i}`} key={label}>
            <span className="metric-index">0{i + 1}</span>
            <div>
              <span>{label}</span>
              <Icon size={20} />
            </div>
            <strong>{value ?? "—"}</strong>
            <small>{desc}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>
              资产目录 <span>ASSETS</span>
            </h2>
            <span className="subtle">{assets.data?.total ?? 0} 台设备</span>
          </div>
          <div className="search">
            <Search size={17} />
            <input
              aria-label="搜索资产"
              placeholder="搜索资产编号或设备名称…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <ErrorBox error={assets.error} />
          {assets.isLoading ? (
            <Loading />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>资产 / 设备名称</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {assets.data?.items.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link className="asset-cell" to={`/assets/${a.id}`}>
                          <span className="asset-icon">
                            <Box size={21} />
                          </span>
                          <span>
                            <strong>{a.asset_code}</strong>
                            <small>{a.model_name}</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <span className="mono subtle">{a.asset_type}</span>
                      </td>
                      <td>
                        <Badge value={a.status} />
                      </td>
                      <td>
                        <Link
                          className="icon-link"
                          aria-label={`查看 ${a.asset_code}`}
                          to={`/assets/${a.id}`}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {assets.data?.total === 0 && (
                <Empty>还没有资产，先登记一台设备。</Empty>
              )}
            </div>
          )}
          <Pagination
            page={page}
            total={assets.data?.total ?? 0}
            onChange={setPage}
          />
        </section>
        <section className="panel activity-panel">
          <div className="section-heading">
            <h2>最近维修</h2>
            <Clock3 size={18} />
          </div>
          <div className="activity-list">
            {overview.data?.recent.map((e) => (
              <div className="activity-item" key={e.id}>
                <span className="activity-dot">
                  <Wrench size={14} />
                </span>
                <div>
                  <Link to={`/assets/${e.asset_id}`}>{e.asset_code}</Link>{" "}
                  <Badge value={e.event_type} />
                  <p>{e.technician}</p>
                  <time>{formatTime(e.occurred_at)}</time>
                </div>
              </div>
            ))}
            {overview.data?.recent.length === 0 && (
              <Empty>完成首次安装后，履历将在这里出现。</Empty>
            )}
          </div>
          <Link to="/maintenance" className="text-link">
            前往维修工作台 <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </>
  );
}
