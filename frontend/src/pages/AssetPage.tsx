import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, ChevronRight, Clock3 } from "lucide-react";
import { api, formatTime, type Asset, type Slot } from "../api";
import {
  Badge,
  CreateButton,
  Empty,
  ErrorBox,
  Header,
  Loading,
  Modal,
} from "../ui";
import { useData, PartIcon, partTypes } from "../shared";

export default function AssetPage() {
  const { id } = useParams();
  const [date, setDate] = useState("");
  const [at, setAt] = useState("");
  const [retireOpen, setRetireOpen] = useState(false);
  const asset = useData<Asset>("asset", `/assets/${id}`);
  const comp = useData<{ items: Slot[] }>(
    "composition",
    `/assets/${id}/components${at ? `?at=${encodeURIComponent(at)}` : ""}`,
  );
  const qc = useQueryClient();
  const retire = useMutation({
    mutationFn: () => api(`/assets/${id}/retire`, {}),
    onSuccess: async () => {
      await qc.invalidateQueries();
      setRetireOpen(false);
    },
  });
  return (
    <>
      <Link className="breadcrumb" to="/">
        资产目录 <ChevronRight size={14} /> 资产详情
      </Link>
      <Header
        eyebrow="ASSET PROFILE"
        title={asset.data?.asset_code ?? "资产详情"}
        actions={
          asset.data?.status === "ACTIVE" ? (
            <>
              <CreateButton
                small
                title="添加槽位"
                path={`/assets/${id}/slots`}
                fields={[
                  { name: "slot_name", label: "槽位名称" },
                  {
                    name: "allowed_type",
                    label: "允许类型",
                    options: partTypes,
                  },
                ]}
              />
              <button
                className="button secondary"
                onClick={() => setRetireOpen(true)}
              >
                退役资产
              </button>
            </>
          ) : null
        }
      >
        {asset.data?.model_name} <Badge value={asset.data?.status} />
      </Header>
      <ErrorBox error={asset.error} />
      <section className="panel">
        <div className="section-heading">
          <h2>
            组成快照 <span>COMPOSITION</span>
          </h2>
          <Badge value={at ? "历史快照" : "当前配置"} />
        </div>
        <div className="time-toolbar">
          <div>
            <Clock3 size={19} />
            <span>回到一个历史时刻</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (date) setAt(`${date}:00+08:00`);
            }}
          >
            <input
              aria-label="历史查询时间（北京时间）"
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button className="button secondary">查看快照</button>
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                setAt("");
                setDate("");
              }}
            >
              返回当前
            </button>
          </form>
        </div>
        {at && (
          <div className="notice">
            正在查看 {formatTime(at)} 的历史组成。进行维修请先返回当前配置。
          </div>
        )}
        <ErrorBox error={comp.error} />
        {comp.isLoading ? (
          <Loading />
        ) : (
          <div className="slots">
            {comp.data?.items.map((s) => (
              <article
                className={`slot-card ${s.recall_status === "RECALLED" ? "recalled-slot" : ""}`}
                key={s.slot_id}
              >
                <div className="slot-top">
                  <span className="part-icon">
                    <PartIcon type={s.allowed_type} />
                  </span>
                  <span className="mono subtle">{s.allowed_type}</span>
                </div>
                <h3>{s.slot_name}</h3>
                {s.component_id ? (
                  <>
                    <Link
                      className="component-number"
                      to={`/components/${s.component_id}`}
                    >
                      {s.serial_no}
                      <ArrowUpRight size={17} />
                    </Link>
                    <p>安装于 {formatTime(s.installed_at)}</p>
                    <Badge
                      value={
                        s.recall_status === "RECALLED" ? "RECALLED" : "GOOD"
                      }
                    />
                  </>
                ) : (
                  <>
                    <div className="vacant">等待安装</div>
                    <p>此时刻没有安装部件</p>
                  </>
                )}
                {!at && asset.data?.status === "ACTIVE" && (
                  <Link
                    className="slot-action"
                    to={`/maintenance?asset=${id}&slot=${s.slot_id}`}
                  >
                    {s.component_id ? "更换 / 拆卸" : "安装部件"}
                    <ArrowRight size={16} />
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
        {comp.data?.items.length === 0 && (
          <Empty>此时刻没有槽位。当前设备可通过“添加槽位”开始配置。</Empty>
        )}
      </section>
      <Modal
        title="退役资产"
        description="请先拆卸所有部件。退役后禁止安装，历史记录仍然保留。"
        open={retireOpen}
        onOpenChange={setRetireOpen}
      >
        <ErrorBox error={retire.error} />
        <button
          className="button danger full"
          disabled={retire.isPending}
          onClick={() => retire.mutate()}
        >
          确认退役 {asset.data?.asset_code}
        </button>
      </Modal>
    </>
  );
}
