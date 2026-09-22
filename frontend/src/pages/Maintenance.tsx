import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ShieldAlert } from "lucide-react";
import {
  api,
  all,
  unavailable,
  typedClient,
  ApiError,
  type Asset,
  type Component,
  type Slot,
  type SwapInput,
  type User,
} from "../api";
import { Badge, CreateButton, ErrorBox, Header, Modal } from "../ui";
import { useData, PartIcon } from "../shared";

export default function Maintenance() {
  const [params] = useSearchParams();
  const [assetId, setAssetId] = useState(params.get("asset") ?? "");
  const [slotId, setSlotId] = useState(params.get("slot") ?? "");
  const [newId, setNewId] = useState("");
  const [userId, setUserId] = useState("");
  const [note, setNote] = useState("");
  const [remove, setRemove] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [success, setSuccess] = useState("");
  const assets = useQuery({
    queryKey: ["all-assets"],
    queryFn: () => all<Asset>("/assets?status=ACTIVE"),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => all<User>("/users"),
  });
  const components = useQuery({
    queryKey: ["all-components"],
    queryFn: () => all<Component>("/components"),
  });
  const comp = useData<{ items: Slot[] }>(
    "composition",
    `/assets/${assetId}/components`,
    !!assetId,
  );
  const selected = comp.data?.items.find((s) => s.slot_id === Number(slotId));
  const candidate = components.data?.find((c) => c.id === Number(newId));
  const qc = useQueryClient();
  const action = selected?.installation_id
    ? remove
      ? "remove"
      : "swap"
    : "install";
  const mutation = useMutation({
    mutationFn: async () => {
      const common = {
        asset_id: Number(assetId),
        slot_id: Number(slotId),
        technician_id: Number(userId),
        note,
      };
      if (action === "swap") {
        const body: SwapInput = {
          ...common,
          expected_installation_id: selected!.installation_id!,
          new_component_id: Number(newId),
        };
        const result = await typedClient.POST("/api/maintenance/swap", {
          body,
        });
        if (result.error) {
          const err = result.error as unknown as {
            error: { code: string; message: string };
          };
          throw new ApiError(err.error.code, err.error.message);
        }
        return result.data;
      }
      return api(`/maintenance/${action}`, {
        ...common,
        ...(action === "remove"
          ? { expected_installation_id: selected?.installation_id }
          : { new_component_id: Number(newId) }),
      });
    },
    onSuccess: async () => {
      setSuccess("操作已提交，资产组成和部件履历已同步更新。");
      setConfirm(false);
      setNewId("");
      setRemove(false);
      setNote("");
      await qc.invalidateQueries();
    },
  });
  const reset = () => {
    setSuccess("");
    mutation.reset();
    setNewId("");
    setRemove(false);
  };
  return (
    <>
      <Header
        eyebrow="MAINTENANCE WORKBENCH"
        title="维修工作台"
        actions={
          <CreateButton
            small
            title="登记操作人员"
            path="/users"
            fields={[
              { name: "name", label: "姓名" },
              {
                name: "role",
                label: "逻辑角色",
                options: [
                  { value: "TECHNICIAN", label: "维修人员" },
                  { value: "MANAGER", label: "管理员" },
                ],
              },
            ]}
          />
        }
      >
        选择设备与槽位，安全完成部件安装、拆卸或更换。
      </Header>
      <ErrorBox
        error={assets.error || users.error || components.error || comp.error}
      />
      {success && (
        <div className="success" role="status">
          {success}
          <Link to={`/assets/${assetId}`}>
            查看资产 <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className="maintenance-grid">
        <section className="panel maintenance-form">
          <div className="section-heading">
            <h2>维修任务</h2>
            <span className="subtle">01 / 选择与核对</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.reset();
              setConfirm(true);
            }}
          >
            <div className="form-grid">
              <label>
                目标资产
                <select
                  aria-label="目标资产"
                  required
                  value={assetId}
                  onChange={(e) => {
                    setAssetId(e.target.value);
                    setSlotId("");
                    reset();
                  }}
                >
                  <option value="">选择设备</option>
                  {assets.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_code} · {a.model_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                组件槽位
                <select
                  aria-label="组件槽位"
                  required
                  value={slotId}
                  onChange={(e) => {
                    setSlotId(e.target.value);
                    reset();
                  }}
                >
                  <option value="">选择槽位</option>
                  {comp.data?.items.map((s) => (
                    <option key={s.slot_id} value={s.slot_id}>
                      {s.slot_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {selected && (
              <>
                <div className="current-part">
                  <span className="part-icon">
                    <PartIcon type={selected.allowed_type} />
                  </span>
                  <div>
                    <small>当前安装</small>
                    <strong>{selected.serial_no ?? "空槽位"}</strong>
                  </div>
                  <Badge
                    value={
                      selected.recall_status === "RECALLED"
                        ? "RECALLED"
                        : selected.serial_no
                          ? "使用中"
                          : "可安装"
                    }
                  />
                </div>
                {selected.installation_id && (
                  <div className="segmented">
                    <button
                      type="button"
                      className={!remove ? "active" : ""}
                      onClick={() => setRemove(false)}
                    >
                      更换部件
                    </button>
                    <button
                      type="button"
                      className={remove ? "active" : ""}
                      onClick={() => setRemove(true)}
                    >
                      仅拆卸
                    </button>
                  </div>
                )}
                {!remove && (
                  <label>
                    安装部件
                    <select
                      aria-label="安装部件"
                      required
                      value={newId}
                      onChange={(e) => setNewId(e.target.value)}
                    >
                      <option value="">选择可安装部件</option>
                      {components.data?.map((c) => (
                        <option
                          disabled={!!unavailable(c, selected.allowed_type)}
                          key={c.id}
                          value={c.id}
                        >
                          {c.serial_no} · {c.model_name}
                          {unavailable(c, selected.allowed_type)
                            ? `（${unavailable(c, selected.allowed_type)}）`
                            : " · 可用"}
                        </option>
                      ))}
                    </select>
                    <small>候选项由类型、占用状态与批次状态共同决定。</small>
                  </label>
                )}
              </>
            )}
            <label>
              操作人员
              <select
                aria-label="操作人员"
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
              <small>用于维修审计记录，无需登录。</small>
            </label>
            <label>
              维修备注
              <textarea
                placeholder="记录更换原因、检查情况等…"
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              className="button full"
              disabled={!selected || comp.isFetching || mutation.isPending}
            >
              核对并提交 <ArrowRight size={17} />
            </button>
          </form>
        </section>
        <aside>
          <section className="panel operation-preview">
            <div className="eyebrow">CHANGE PREVIEW</div>
            <h2>本次组成变化</h2>
            <div className="preview-part">
              <span>操作前</span>
              <strong>{selected?.serial_no ?? "空槽位"}</strong>
            </div>
            <ArrowDown className="preview-arrow" />
            <div className="preview-part new">
              <span>操作后</span>
              <strong>
                {remove ? "空槽位" : (candidate?.serial_no ?? "待选择")}
              </strong>
            </div>
            <p>提交后，旧安装记录将保留，新的组成关系会立即生效。</p>
          </section>
          <div className="help-note">
            <ShieldAlert size={20} />
            <div>
              <strong>召回部件仍会出现在当前组成中</strong>
              <p>
                召回表示风险，并不意味着部件已被实际拆卸。请完成拆卸或更换后再核查影响范围。
              </p>
            </div>
          </div>
        </aside>
      </div>
      <Modal
        title={`确认${action === "swap" ? "更换" : action === "remove" ? "拆卸" : "安装"}`}
        description={`${selected?.slot_name}：${selected?.serial_no ?? "空槽位"} → ${remove ? "空槽位" : (candidate?.serial_no ?? "")}。操作会写入永久维修履历。`}
        open={confirm}
        onOpenChange={setConfirm}
      >
        <ErrorBox error={mutation.error} />
        <button
          className="button full"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "正在提交…" : "确认提交"}
        </button>
      </Modal>
    </>
  );
}
