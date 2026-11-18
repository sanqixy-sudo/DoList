# 仓库协作

- Electron 主进程、数据库和 IPC 在 `src/main/`，预加载桥接和渲染界面位于 `src/`，共享模型和 IPC 校验在 `types/`。
- 在 Node.js 24 下执行 `npm ci`、`npm test`、`npm run lint` 和 `npm run build`。Windows 安装、通知和托盘变更使用隔离的 Windows Electron 验证。
- 数据库改动保留迁移和日志回放。附件和备份变更使用临时数据目录验证恢复、失败清理和外部文件保留。
- 记录用户可见变更到 `CHANGELOG.md`。测试数据库、附件、打包产物和现场审计输出由验证环境生成。
