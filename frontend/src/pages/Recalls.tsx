import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Battery,
  Box,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import {
  api,
  all,
  formatTime,
  type Batch,
  type Impact,
  type Model,
  type User,
} from "../api";
import {
  Badge,
  CreateButton,
  Empty,
  ErrorBox,
  Header,
  Loading,
  Modal,
} from "../ui";
import { useData } from "../shared";

export default function Recalls() {
  const [batchId, setBatchId] = useState("");
  const [mode, setMode] = useState<"current" | "history">("current");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [userId, setUserId] = useState("");
  const batches = useQuery({
    queryKey: ["all-batches"],
    queryFn: () => all<Batch>("/batches"),
  });
  const models = useQuery({
    queryKey: ["models"],
    queryFn: () => all<Model>("/component-models"),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => all<User>("/users"),
  });
  const selectedId = batchId || String(batches.data?.[0]?.id ?? "");
  const selected = batches.data?.find((b) => b.id === Number(selectedId));
  const current = useData<Impact>(
    "impact",
    `/batches/${selectedId}/impact/current`,
    !!selectedId,
  );
  const history = useData<Impact>(
    "impact",
    `/batches/${selectedId}/impact/history`,
    !!selectedId,
  );
  const shown = mode === "current" ? current : history;
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api(`/batches/${selectedId}/recall`, {
        technician_id: Number(userId),
        reason,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      setOpen(false);
    },
  });
  return (
    <>
      <Header
        eyebrow="RECALL & IMPACT ANALYSIS"
        title="批次召回"
        actions={
          <CreateButton
            title="登记批次"
            path="/batches"
            fields={[
              { name: "batch_code", label: "批次编号" },
              {
                name: "component_model_id",
                label: "部件型号",
                type: "number",
                options:
                  models.data?.map((m) => ({
                    value: m.id,
                    label: `${m.model_name} · ${m.component_type}`,
                  })) ?? [],
              },
              {
                name: "manufactured_at",
                label: "生产日期",
                type: "date",
                optional: true,
              },
            ]}
          />
        }
      >
        区分当前受影响设备与历史暴露设备，让召回处置有据可依。
      </Header>
      <ErrorBox
        error={batches.error || models.error || users.error || shown.error}
      />
      <section className="panel recall-banner">
        <div>
          <div className="eyebrow">BATCH SELECTION</div>
          <label className="sr-only" htmlFor="batch">
            选择批次
          </label>
          <select
            id="batch"
            value={selectedId}
            onChange={(e) => setBatchId(e.target.value)}
          >
            <option value="" disabled>
              选择批次
            </option>
            {batches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batch_code}
              </option>
            ))}
          </select>
          <p>
            {selected?.model_name} <span className="divider">/</span>{" "}
            {selected?.component_type}
          </p>
        </div>
        <div className="recall-status">
          <Badge value={selected?.recall_status} />
          {selected?.recall_status === "NORMAL" && (
            <button
              className="button danger"
              onClick={() => {
                mutation.reset();
                setOpen(true);
              }}
            >
              <ShieldAlert size={17} />
              发起批次召回
            </button>
          )}
        </div>
      </section>
      {selected?.recall_status === "RECALLED" && (
        <div className="recall-alert">
          <ShieldAlert size={23} />
          <div>
            <strong>此批次已召回，请安排受影响设备的部件更换。</strong>
            <p>{selected.recall_reason}</p>
            <small>
              {formatTime(selected.recalled_at)} · 召回不会自动拆卸已安装部件
            </small>
          </div>
        </div>
      )}
      <div className="impact-summary">
        <div>
          <span>
            当前{selected?.recall_status === "RECALLED" ? "受影响" : "使用"}资产
          </span>
          <strong>
            {current.data?.total ?? "—"}
            <small>台</small>
          </strong>
          <p>仍安装着此批次部件</p>
        </div>
        <div>
          <span>历史暴露资产</span>
          <strong>
            {history.data?.total ?? "—"}
            <small>台</small>
          </strong>
          <p>曾经使用过此批次，包含当前</p>
        </div>
        <div className="impact-explanation">
          <div className="eyebrow">TRACEABILITY PATH</div>
          <span>
            生产批次 <ArrowRight size={15} /> 物理部件
          </span>
          <span>
            安装关系 <ArrowRight size={15} /> 设备资产
          </span>
          <p>影响范围根据真实安装记录即时查询。</p>
        </div>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>影响明细</h2>
          <div className="segmented">
            <button
              className={mode === "current" ? "active" : ""}
              onClick={() => setMode("current")}
            >
              当前使用
            </button>
            <button
              className={mode === "history" ? "active" : ""}
              onClick={() => setMode("history")}
            >
              历史暴露
            </button>
          </div>
        </div>
        {shown.isLoading ? (
          <Loading />
        ) : (
          <div className="impact-list">
            {shown.data?.items.map((a) => (
              <details key={a.asset_id} open>
                <summary>
                  <span className="asset-icon">
                    <Box size={22} />
                  </span>
                  <span>
                    <strong>{a.asset_code}</strong>
                    <small>{a.model_name}</small>
                  </span>
                  <span className="exposure-count">
                    {a.exposures.length} 条安装记录
                  </span>
                  <ChevronRight size={18} />
                </summary>
                <div className="exposure-table">
                  {a.exposures.map((e, index) => (
                    <div key={index}>
                      <span className="mono">
                        <Battery size={15} />
                        {e.serial_no}
                      </span>
                      <span>{e.slot_name}</span>
                      <span>
                        {formatTime(e.installed_at)} —{" "}
                        {formatTime(e.removed_at)}
                      </span>
                      <Badge value={e.removed_at ? "历史安装" : "当前安装"} />
                    </div>
                  ))}
                  <Link to={`/assets/${a.asset_id}`} className="text-link">
                    查看资产组成 <ArrowUpRight size={14} />
                  </Link>
                </div>
              </details>
            ))}
            {shown.data?.total === 0 && (
              <Empty>
                此批次暂无{mode === "current" ? "当前安装" : "历史安装"}记录。
              </Empty>
            )}
          </div>
        )}
      </section>
      <Modal
        title="发起批次召回"
        description={`将 ${selected?.batch_code} 标记为召回，禁止该批次部件的新安装。首次召回原因和时间将永久保留。`}
        open={open}
        onOpenChange={setOpen}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label>
            操作人员
            <select
              aria-label="召回操作人员"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">选择操作人员</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            召回原因
            <textarea
              aria-label="召回原因"
              required
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="填写供应商通知或缺陷说明…"
            />
          </label>
          <ErrorBox error={mutation.error} />
          <button className="button danger full" disabled={mutation.isPending}>
            确认召回
          </button>
        </form>
      </Modal>
    </>
  );
}
