# 前端优化记录

日期：2026-09-22。

## 设计依据

按用户指定的 [LobeHub frontend-design 技能](https://lobehub.com/skills/joaquincampo-codex-skills-frontend-design) 优化。该入口返回 403，因此读取作者仓库的 [原始 SKILL.md 历史版本](https://github.com/JoaquinCampo/Skills/blob/00b8bd4edafc81b2db816d0134415f7c8d9be321/frontend-design/SKILL.md)。最新仓库已移除该文件，本次使用上述固定版本，没有安装全局技能。

遵循其“先确定独特且一致的视觉方向，再实现可运行界面”的原则，选择 **精密实验室档案**：暖纸色背景、石墨色侧栏、工程橙强调、宋体中文标题、等宽资产编号与工程网格。

## 实现

- 五个页面统一导航、标题、按钮、表格、弹窗、表单、状态与时间轴。
- 首页加入真实资产组成图，读取 API 的当前安装关系；点击部件进入履历，点击资产进入完整档案。示意图最多展示四个槽位，底部数量统计全部槽位。
- 本地打包 Noto Sans SC、Noto Serif SC、IBM Plex Mono，运行无需外部字体 CDN；中文字体按字符范围请求。
- 样式分为 tokens、shell、components、pages，颜色、排版和尺寸便于统一维护。
- 手机使用顶部导航；桌面使用固定侧栏。提供键盘焦点、跳过导航入口、加载状态播报，以及遵循 reduced-motion 的入场动画。

业务 API 和数据库模型没有改动，部署保留原有业务数据。

## 验证

本次 ESLint、TypeScript 与生产构建通过；Vitest **3 passed**；Chromium Playwright **6 passed**，见 [运行日志](frontend-refresh-tests.log)。回归覆盖完整更换/复用/召回故事、登记及重复错误、弹窗键盘操作、历史模式、不可用部件和组成图导航。六种宽度（320、375、390、768、1024、1440px）遍历五页，无页面横向溢出。

已复核桌面与手机实际截图。测试使用独立 PostgreSQL E2E 库，不修改演示库。此次没有重新执行后端 74 项测试；原验收证据见 [测试报告](test-report.md)。浏览器范围为 Chromium，不代表完整 WCAG 或跨浏览器认证。

## 界面截图

- [资产工作台](screenshots/dashboard.png)
- [资产组成](screenshots/asset.png)
- [维修工作台](screenshots/maintenance.png)
- [部件履历](screenshots/history.png)
- [批次召回](screenshots/recall.png)
- [320px 手机](screenshots/recall-320.png)、[768px 平板](screenshots/recall-768.png)
