import { describe, it, expect } from "vitest";
import { formatTime, unavailable, type Component } from "./api";

const component: Component = {
  id: 1,
  serial_no: "B1",
  batch_id: 1,
  batch_code: "BAT",
  condition_status: "GOOD",
  recall_status: "NORMAL",
  component_type: "BATTERY",
  model_name: "PX",
  installation_id: null,
  asset_code: null,
};
describe("显示语义", () => {
  it("不依赖操作系统时区显示北京时间", () => {
    expect(formatTime("2026-07-10T04:00:00Z")).toContain("12:00");
  });
  it("尚未拆卸显示至今", () => {
    expect(formatTime(null)).toBe("至今");
  });
  it("风险原因优先于占用，避免误导用户", () => {
    expect(
      unavailable(
        { ...component, installation_id: 2, recall_status: "RECALLED" },
        "BATTERY",
      ),
    ).toBe("批次已召回");
    expect(unavailable(component, "BATTERY")).toBe("");
    expect(unavailable(component, "CAMERA")).toBe("类型不兼容");
  });
});
