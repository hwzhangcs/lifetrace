import createClient from "openapi-fetch";
import type { paths, components } from "./api-schema";

export const typedClient = createClient<paths>();
export type SwapInput = components["schemas"]["SwapIn"];
export type Asset = {
  id: number;
  asset_code: string;
  asset_type: string;
  model_name: string;
  status: string;
};
export type Component = {
  id: number;
  serial_no: string;
  batch_id: number;
  batch_code: string;
  condition_status: string;
  recall_status: string;
  component_type: string;
  model_name: string;
  installation_id: number | null;
  asset_code: string | null;
};
export type Slot = {
  slot_id: number;
  slot_name: string;
  allowed_type: string;
  installation_id: number | null;
  component_id: number | null;
  serial_no: string | null;
  recall_status: string | null;
  installed_at: string | null;
};
export type Batch = {
  id: number;
  batch_code: string;
  model_name: string;
  component_type: string;
  recall_status: string;
  recall_reason: string | null;
  recalled_at: string | null;
};
export type User = { id: number; name: string; role: string };
export type Model = { id: number; model_name: string; component_type: string };
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};
export type HistoryEvent = {
  action: string;
  occurred_at: string;
  asset_code?: string;
  asset_id?: number;
  slot_name?: string;
  technician: string;
  note: string;
};
export type Exposure = {
  serial_no: string;
  slot_name: string;
  installed_at: string;
  removed_at: string | null;
};
export type Impact = {
  items: {
    asset_id: number;
    asset_code: string;
    model_name: string;
    exposures: Exposure[];
  }[];
  total: number;
};

export class ApiError extends Error {
  fields: { field: string; message: string }[];
  constructor(
    public code: string,
    message: string,
    fields: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.fields = fields;
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.error?.code ?? "ERROR",
      result.error?.message ?? "请求失败",
      result.error?.fields,
    );
  return result as T;
}
export async function all<T>(path: string): Promise<T[]> {
  const result: T[] = [];
  for (let page = 1; ; page++) {
    const data = await api<Page<T>>(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}&page_size=100`,
    );
    result.push(...data.items);
    if (result.length >= data.total) return result;
  }
}
export function formatTime(value?: string | null) {
  if (!value) return "至今";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
export function unavailable(c: Component, type: string) {
  if (c.component_type !== type) return "类型不兼容";
  if (c.recall_status === "RECALLED") return "批次已召回";
  if (c.condition_status !== "GOOD") return "部件不可用";
  if (c.installation_id) return `使用中 · ${c.asset_code}`;
  return "";
}
