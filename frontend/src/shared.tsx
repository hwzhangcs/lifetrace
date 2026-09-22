import { useQuery } from "@tanstack/react-query";
import { Battery, Camera, Cpu } from "lucide-react";
import { api } from "./api";
import type { Field } from "./ui";

const typeOptions = ["DRONE", "ROBOT", "CAMERA", "LAPTOP", "PRINTER"].map(
  (x) => ({ value: x, label: x }),
);
export const partTypes = ["BATTERY", "CAMERA", "MOTOR", "SENSOR", "MEMORY"].map(
  (x) => ({ value: x, label: x }),
);
export const assetFields: Field[] = [
  { name: "asset_code", label: "资产编号" },
  { name: "asset_type", label: "资产类型", options: typeOptions },
  { name: "model_name", label: "设备名称 / 型号" },
  { name: "acquired_at", label: "购置日期", type: "date", optional: true },
];
export function useData<T>(key: string, path: string, enabled = true) {
  return useQuery({
    queryKey: [key, path],
    queryFn: () => api<T>(path),
    enabled,
  });
}
export function PartIcon({ type }: { type: string }) {
  return type === "BATTERY" ? (
    <Battery />
  ) : type === "CAMERA" ? (
    <Camera />
  ) : (
    <Cpu />
  );
}
