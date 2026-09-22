import { useState, useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, Plus, X, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";

export function Badge({ value }: { value: string | null | undefined }) {
  const names: Record<string, string> = {
    ACTIVE: "使用中",
    RETIRED: "已退役",
    GOOD: "状态良好",
    DEFECTIVE: "待检修",
    RECALLED: "已召回",
    NORMAL: "正常批次",
    INSTALL: "安装",
    REMOVE: "拆卸",
    SWAP: "更换",
    RECALL: "召回",
    TECHNICIAN: "维修人员",
    MANAGER: "管理员",
  };
  return (
    <span className={`badge ${value?.toLowerCase()}`}>
      {names[value ?? ""] ?? value ?? "空闲"}
    </span>
  );
}
export function ErrorBox({ error }: { error: Error | null }) {
  return error ? (
    <div className="error" role="alert">
      <AlertCircle size={17} />
      <span>{error.message}</span>
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty" role="status" aria-live="polite">
      <LoaderCircle className="spin" size={22} /> 正在读取数据…
    </div>
  );
}
export function Empty({ children = "暂无记录" }: { children?: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Header({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      <div className="actions">{actions}</div>
    </header>
  );
}
export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
  restoreFocus,
}: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  restoreFocus?: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className="modal"
          onCloseAutoFocus={(e) => {
            if (restoreFocus) {
              e.preventDefault();
              restoreFocus();
            }
          }}
        >
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          <Dialog.Close className="icon-button modal-close" aria-label="关闭">
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "number" | "textarea";
  options?: { value: string | number; label: string }[];
  optional?: boolean;
  default?: string;
};
export function CreateButton({
  title,
  path,
  fields,
  after,
  small,
}: {
  title: string;
  path: string;
  fields: Field[];
  after?: () => void;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: unknown) => api(path, body),
    onSuccess: async () => {
      await qc.invalidateQueries();
      setOpen(false);
      after?.();
    },
  });
  return (
    <>
      <button
        ref={trigger}
        className={small ? "button secondary small" : "button"}
        onClick={() => {
          mutation.reset();
          setOpen(true);
        }}
      >
        <Plus size={16} />
        {title}
      </button>
      <Modal
        title={title}
        description="登记后将保留资产身份与来源信息，请核对编号。"
        open={open}
        onOpenChange={setOpen}
        restoreFocus={() => trigger.current?.focus()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const body: Record<string, unknown> = {};
            fields.forEach((f) => {
              const value = data.get(f.name);
              body[f.name] =
                f.type === "number"
                  ? Number(value)
                  : value === "" && f.type === "date"
                    ? null
                    : value;
            });
            mutation.mutate(body);
          }}
        >
          {fields.map((f) => (
            <label key={f.name}>
              {f.label}
              {f.optional ? "（选填）" : ""}
              {f.options ? (
                <select
                  aria-label={f.label}
                  name={f.name}
                  required={!f.optional}
                  defaultValue={f.default ?? ""}
                >
                  <option value="" disabled>
                    请选择
                  </option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea aria-label={f.label} name={f.name} maxLength={2000} />
              ) : (
                <input
                  aria-label={f.label}
                  name={f.name}
                  type={f.type ?? "text"}
                  required={!f.optional}
                  maxLength={
                    f.name.includes("code") || f.name === "serial_no" ? 80 : 100
                  }
                  defaultValue={f.default}
                />
              )}
              {mutation.error instanceof ApiError &&
                mutation.error.fields
                  .filter((e) => e.field.endsWith(f.name))
                  .map((e) => (
                    <small className="field-error" key={e.field}>
                      {e.message}
                    </small>
                  ))}
            </label>
          ))}
          <ErrorBox error={mutation.error} />
          <button className="button full" disabled={mutation.isPending}>
            {mutation.isPending ? "正在保存…" : "确认登记"}
          </button>
        </form>
      </Modal>
    </>
  );
}
export function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>共 {total} 条记录</span>
      <div>
        <button disabled={page === 1} onClick={() => onChange(page - 1)}>
          上一页
        </button>
        <span>{page}</span>
        <button
          disabled={page * 10 >= total}
          onClick={() => onChange(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
