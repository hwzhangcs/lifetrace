import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

const db =
  process.env.E2E_DATABASE_URL ??
  "postgresql+psycopg://lifetrace:lifetrace@localhost:54329/lifetrace_test_e2e";
if (!db.split("/").pop()?.startsWith("lifetrace_test"))
  throw new Error("E2E requires an isolated test database");
test.beforeEach(() => {
  execFileSync(
    "../backend/.venv/bin/python",
    ["-m", "lifetrace.seed", "--reset"],
    {
      cwd: "../backend",
      env: { ...process.env, DATABASE_URL: db },
    },
  );
});

test("完整演示：更换、复用、召回与溯源", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Research Drone Alpha")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "../docs/screenshots/dashboard.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "查看 D001" }).click();
  await expect(page.getByRole("link", { name: "B102" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "../docs/screenshots/asset.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/maintenance?asset=1&slot=1");
  await page.getByLabel("安装部件", { exact: true }).selectOption("3");
  await page.getByLabel("操作人员", { exact: true }).selectOption("1");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "../docs/screenshots/maintenance.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "核对并提交" }).click();
  await page.getByRole("button", { name: "确认提交", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("操作已提交");
  await page.getByLabel("目标资产").selectOption("2");
  await page.getByLabel("组件槽位").selectOption("5");
  await page.getByLabel("安装部件", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "核对并提交" }).click();
  await page.getByRole("button", { name: "确认提交", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("操作已提交");
  await page.getByRole("link", { name: /召回中心/ }).click();
  await page.getByRole("button", { name: "发起批次召回" }).click();
  await page.getByLabel("召回操作人员").selectOption("2");
  await page
    .getByLabel("召回原因")
    .fill("供应商通知：潜在热失控风险，请安排更换。");
  await page.getByRole("button", { name: "确认召回" }).click();
  await expect(
    page.getByText("此批次已召回，请安排受影响设备的部件更换。"),
  ).toBeVisible();
  await expect(page.locator("summary")).toHaveCount(2);
  await expect(
    page.locator("summary").filter({ hasText: "D009" }),
  ).toBeVisible();
  await expect(
    page.locator("summary").filter({ hasText: "D014" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "../docs/screenshots/recall.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "历史暴露", exact: true }).click();
  await expect(page.locator("summary")).toHaveCount(3);
  await page.goto("/components/1");
  await expect(page.locator(".timeline-event")).toHaveCount(6);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "../docs/screenshots/history.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(page.locator(".big-id")).toHaveText("B102");
  expect(errors).toEqual([]);
});

test("登记、重复错误、对话框键盘交互", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "登记资产" }).click();
  await page.getByLabel("资产编号", { exact: true }).fill("D100");
  await page.getByLabel("资产类型", { exact: true }).selectOption("ROBOT");
  await page.getByLabel("设备名称 / 型号").fill("中文名称实验机器人");
  await page.getByRole("button", { name: "确认登记" }).click();
  await expect(page.getByText("中文名称实验机器人")).toBeVisible();
  await page.getByRole("button", { name: "登记资产" }).click();
  await page.getByLabel("资产编号", { exact: true }).fill("D100");
  await page.getByLabel("资产类型", { exact: true }).selectOption("ROBOT");
  await page.getByLabel("设备名称 / 型号").fill("重复");
  await page.getByRole("button", { name: "确认登记" }).click();
  await expect(page.getByRole("alert")).toContainText("编号重复");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "登记资产" })).toBeFocused();
});

test("历史边界与历史模式维修保护", async ({ page }) => {
  await page.goto("/assets/1");
  await page.getByLabel("历史查询时间（北京时间）").fill("2026-02-20T12:00");
  await page.getByRole("button", { name: "查看快照" }).click();
  await expect(page.getByText("历史快照", { exact: true })).toBeVisible();
  await expect(page.getByText("等待安装")).toHaveCount(4);
  await expect(
    page.getByRole("link", { name: "安装部件", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "返回当前" }).click();
  await expect(page.getByRole("link", { name: "B102" })).toBeVisible();
});

test("移动端和平板布局没有横向溢出", async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/",
      "/assets/1",
      "/maintenance",
      "/components/1",
      "/recalls",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".spin")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `${width}px ${path}`).toBe(false);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `../docs/screenshots/recall-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("已占用与缺陷部件显示禁用原因", async ({ page }) => {
  await page.goto("/maintenance?asset=1&slot=1");
  const parts = page.getByLabel("安装部件", { exact: true });
  await expect(parts.locator('option[value="2"]')).toHaveJSProperty(
    "disabled",
    true,
  );
  await expect(parts.locator('option[value="2"]')).toContainText("使用中");
  await expect(parts.locator('option[value="8"]')).toHaveJSProperty(
    "disabled",
    true,
  );
  await expect(parts.locator('option[value="8"]')).toContainText("不可用");
});

test("首页真实组成图可以打开部件履历", async ({ page }) => {
  await page.goto("/");
  const diagram = page.getByRole("figure", { name: "真实资产当前组成示意" });
  await expect(diagram).toContainText("4 / 4 槽位已安装");
  await diagram.getByRole("link", { name: "追溯 B102" }).click();
  await expect(page.locator(".big-id")).toHaveText("B102");
  await expect(page.locator(".timeline-event")).toHaveCount(3);
});
