# Git 提交组织

仓库名称：lifetrace。主分支：main。

本仓库在已有实现和验收完成后建立，按模块依赖整理为下列七个提交。提交使用实际创建时间，表示源码归档顺序，不表示这些功能在不同日期开发，也不保证前几个阶段即可独立运行完整应用。

| 阶段 | 提交主题 | 内容 |
|---|---|---|
| 1 | chore(repo): initialize repository conventions | 忽略规则、文本规范、提交组织说明 |
| 2 | feat(database): model temporal asset composition and provenance | 八表结构、迁移、种子 SQL、查询、连接及 Python 依赖 |
| 3 | feat(api): implement lifecycle transactions and recall tracing | API、业务事务、数据校验、种子工具及 OpenAPI 契约 |
| 4 | feat(web): build laboratory asset tracing workspace | 五页前端、真实组成图、响应式视觉、类型契约及锁文件 |
| 5 | test: cover invariants transactions and browser workflows | 后端测试、前端测试、浏览器回归、重启与性能验证脚本 |
| 6 | ci: package application and automate verification | Docker、Compose、GitHub Actions |
| 7 | docs: publish design demo and acceptance evidence | README、设计、实验报告、测试证据和界面截图 |

依赖目录、虚拟环境、构建产物、运行时数据、实际环境文件和交付压缩包不纳入版本控制。保留依赖锁文件、API 生成契约和用于验收的截图/日志。后续修改应按真实功能变化增量提交，不重新编排已共享的历史。

常用命令：

```bash
git log --oneline --reverse
git status --short
git show --stat HEAD
```
