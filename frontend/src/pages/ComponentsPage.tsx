import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Box,
  Boxes,
  ChevronRight,
  CircleDot,
  Search,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import {
  all,
  formatTime,
  type Batch,
  type Component,
  type HistoryEvent,
  type Page,
} from "../api";
import {
  Badge,
  CreateButton,
  Empty,
  ErrorBox,
  Header,
  Loading,
  Pagination,
} from "../ui";
import { useData, PartIcon, partTypes } from "../shared";

export default function ComponentsPage() {
  const { id } = useParams();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const list = useData<Page<Component>>(
    "components",
    `/components?q=${encodeURIComponent(q)}&page=${page}&page_size=10`,
  );
  const batches = useQuery({
    queryKey: ["all-batches"],
    queryFn: () => all<Batch>("/batches"),
  });
  const component = useData<Component>("component", `/components/${id}`, !!id);
  const history = useData<{
    component: { manufactured_at: string; created_at: string };
    items: HistoryEvent[];
  }>("history", `/components/${id}/history`, !!id);
  return (
    <>
      <Header
        eyebrow="COMPONENT PROVENANCE"
        title="部件履历"
        actions={
          <>
            <CreateButton
              small
              title="登记型号"
              path="/component-models"
              fields={[
                {
                  name: "component_type",
                  label: "部件类型",
                  options: partTypes,
                },
                { name: "manufacturer", label: "制造商" },
                { name: "model_name", label: "型号" },
                {
                  name: "description",
                  label: "说明",
                  optional: true,
                  type: "textarea",
                },
              ]}
            />
            <CreateButton
              title="登记部件"
              path="/components"
              fields={[
                { name: "serial_no", label: "部件序列号" },
                {
                  name: "batch_id",
                  label: "来源批次",
                  type: "number",
                  options:
                    batches.data?.map((b) => ({
                      value: b.id,
                      label: b.batch_code,
                    })) ?? [],
                },
                {
                  name: "condition_status",
                  label: "部件状态",
                  options: [
                    { value: "GOOD", label: "良好" },
                    { value: "DEFECTIVE", label: "缺陷" },
                    { value: "RETIRED", label: "退役" },
                  ],
                },
              ]}
            />
          </>
        }
      >
        保留物理身份，追踪每次安装、拆卸与批次召回。
      </Header>
      <ErrorBox
        error={list.error || batches.error || component.error || history.error}
      />
      <div className="component-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>部件目录</h2>
            <Boxes size={18} />
          </div>
          <div className="search">
            <Search size={17} />
            <input
              aria-label="搜索部件"
              placeholder="搜索序列号或批次…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {list.isLoading ? (
            <Loading />
          ) : (
            <div className="component-list">
              {list.data?.items.map((c) => (
                <Link
                  className={`component-row ${Number(id) === c.id ? "selected" : ""}`}
                  key={c.id}
                  to={`/components/${c.id}`}
                >
                  <span className="part-icon">
                    <PartIcon type={c.component_type} />
                  </span>
                  <div>
                    <strong>{c.serial_no}</strong>
                    <small>{c.batch_code}</small>
                  </div>
                  <div className="component-status">
                    <Badge
                      value={
                        c.recall_status === "RECALLED"
                          ? "RECALLED"
                          : c.condition_status
                      }
                    />
                    <small>{c.asset_code ?? "未安装"}</small>
                  </div>
                  <ChevronRight size={15} />
                </Link>
              ))}
              {list.data?.total === 0 && <Empty>没有匹配的部件</Empty>}
            </div>
          )}
          <Pagination
            page={page}
            total={list.data?.total ?? 0}
            onChange={setPage}
          />
        </section>
        <section className="panel timeline-panel">
          {!id ? (
            <div className="select-placeholder">
              <div className="large-icon">
                <Activity size={40} />
              </div>
              <h2>选择一块部件，展开它的履历。</h2>
              <p>每一次流转都关联到具体设备和操作人员。</p>
              <span className="mono subtle">
                ORIGIN / INSTALLATION / HISTORY
              </span>
            </div>
          ) : history.isLoading ? (
            <Loading />
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">LIFECYCLE TIMELINE</div>
                  <h2 className="big-id">{component.data?.serial_no}</h2>
                </div>
                <Badge value={component.data?.recall_status} />
              </div>
              <div className="metadata">
                <span>
                  型号<strong>{component.data?.model_name}</strong>
                </span>
                <span>
                  来源批次<strong>{component.data?.batch_code}</strong>
                </span>
              </div>
              <div className="timeline">
                <div className="timeline-event">
                  <span className="timeline-dot">
                    <Box size={15} />
                  </span>
                  <time>
                    {history.data?.component.manufactured_at ?? "未登记日期"}
                  </time>
                  <h3>生产批次来源</h3>
                  <p>{component.data?.batch_code}</p>
                </div>
                <div className="timeline-event">
                  <span className="timeline-dot">
                    <CircleDot size={15} />
                  </span>
                  <time>{formatTime(history.data?.component.created_at)}</time>
                  <h3>部件登记</h3>
                  <p>获得独立物理身份 {component.data?.serial_no}</p>
                </div>
                {history.data?.items.map((e, index) => (
                  <div
                    className={`timeline-event ${e.action === "RECALL" ? "risk" : ""}`}
                    key={index}
                  >
                    <span className="timeline-dot">
                      {e.action === "RECALL" ? (
                        <ShieldAlert size={15} />
                      ) : (
                        <Wrench size={15} />
                      )}
                    </span>
                    <time>{formatTime(e.occurred_at)}</time>
                    <h3>
                      <Badge value={e.action} />{" "}
                      {e.asset_id && (
                        <Link to={`/assets/${e.asset_id}`}>
                          {e.asset_code} <ArrowUpRight size={13} />
                        </Link>
                      )}
                    </h3>
                    <p>
                      {e.slot_name}
                      {e.slot_name ? " · " : ""}
                      {e.technician}
                    </p>
                    {e.note && <div className="timeline-note">{e.note}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
