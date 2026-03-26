<p align="center">
  <img src="https://cdn.nodeimage.com/i/3oplxDW7w8zkK98Yq1GbFgXSOvjI9tX2.webp" alt="DoList Logo" width="160" />
</p>

<h1 align="center">DoList</h1>

<p align="center">
  本地优先的桌面任务管理应用，支持任务管理、项目组织、日历规划、四象限分析与项目报告。
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/release/sanqixy-sudo/DoList?style=flat-square&color=111827" alt="Version" />
  <img src="https://img.shields.io/github/license/sanqixy-sudo/DoList?style=flat-square&color=059669" alt="License" />
  <img src="https://img.shields.io/badge/platform-Windows-2563eb?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/tech%20stack-Electron%2C%20React%2C%20TypeScript-f59e0b?style=flat-square" alt="Tech Stack" />
</p>

<p align="center">
  <a href="https://github.com/sanqixy-sudo/DoList/releases">下载桌面版 ZIP</a>
  ·
  <a href="https://github.com/sanqixy-sudo/DoList">查看在线仓库</a>
  ·
  <a href="https://linux.do/">社区支持：LinuxDO</a>
</p>

## 项目简介

DoList 是一个基于 Electron、React 和 TypeScript 构建的本地优先桌面任务管理应用，面向需要同时处理日常待办、项目推进和时间规划的个人用户。

它强调快速录入、多视图组织和本地数据存储，支持从收件箱到项目分组、从日历到看板、从四象限到项目报告的一整套任务流。

### 核心亮点

- 本地优先：数据保存在本地，启动快、响应直接，适合长期个人使用。
- 多视图协同：列表、日历、看板、时间线、四象限、项目报告统一联动。
- 项目管理增强：支持项目组、项目列表和项目管理面板。
- 效率能力完整：内置番茄钟、提醒、搜索、快捷键和系统托盘。

## 功能预览

### 软件首页

DoList 首页聚合了常用导航、任务入口与多视图切换，适合作为日常任务管理的主工作台。

<p align="center">
  <img src="https://cdn.nodeimage.com/i/2m5oDCyoJvEUD4NtjgnYQkrWEy93pqVx.webp" alt="DoList 首页预览" />
</p>

### 日历视图

日历视图适合按日期统筹任务安排，快速查看近期计划和时间分布。

<p align="center">
  <img src="https://cdn.nodeimage.com/i/JBDVrCq7SZcWTj0L98L9NzdDyFUiiLLW.webp" alt="DoList 日历视图预览" />
</p>

### 看板视图

看板视图适合按阶段推动任务流转，直观查看各状态下的任务分布。

<p align="center">
  <img src="https://cdn.nodeimage.com/i/fP0ZsStVnHcbp6TAT2UYHZNSNujzZhgZ.webp" alt="DoList 看板视图预览" />
</p>

### 时间线视图

时间线视图适合从时间维度查看任务排布。当前版本中，已完成任务会按完成日期进入时间线，未完成任务则按截止日期或开始日期显示。

<p align="center">
  <img src="https://cdn.nodeimage.com/i/2FVS5kb5pY5PhRjVlw5yZYhJYY8Jdtoq.webp" alt="DoList 时间线视图预览" />
</p>

### 项目报告视图

项目报告视图用于从整体维度查看项目分组、任务组织和阶段性进展，适合做项目梳理与回顾。

<p align="center">
  <img src="https://cdn.nodeimage.com/i/p0RWIRvBNyJMAqtiCBUEICc118oN7aYQ.webp" alt="DoList 项目报告视图预览" />
</p>

### 四象限视图

四象限视图用于按重要程度与紧急程度整理任务，帮助快速判断优先级和执行顺序。

<p align="center">
  <img src="https://cdn.nodeimage.com/i/o4blg8PHXqK4spfMXWbKhEdSHVFf85OX.webp" alt="DoList 四象限视图预览" />
</p>

## 功能概览

### 任务管理

- 收件箱、今天、即将到来等常用任务入口
- 快速新建任务与任务详情面板
- 子任务、标签、优先级、截止日期管理
- 任务搜索与筛选
- 附件添加、预览与打开
- 提醒与本地调度

### 项目与分组

- 项目组管理
- 项目列表管理
- 按项目查看任务
- 项目管理面板
- 项目报告视图，便于从整体维度观察项目进展

### 多视图规划

- 列表视图
- 日历视图
- 多日视图
- 多周视图
- 看板视图
- 时间线视图
- 四象限视图
- 项目报告视图

### 效率能力

- 番茄钟
- 全局快速添加任务
- 键盘快捷键面板
- 系统托盘驻留
- 明暗主题与跟随系统
- 设置页内版本信息与 GitHub 仓库入口

## 适用场景

- 管理个人待办、学习计划和日常事务
- 对多个项目进行分组、拆分和追踪
- 使用多种视图规划近期与中长期任务
- 配合番茄钟和提醒机制提升执行效率

## 技术栈

- Electron
- React 18
- TypeScript
- Vite / electron-vite
- Tailwind CSS
- Zustand
- Radix UI
- `sql.js`

## 快速开始

### 环境要求

- Node.js 18+
- npm

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

### 类型检查

```bash
npm run lint
```

### 构建应用

```bash
npm run build
```

### 打包桌面应用

```bash
npm run package
```

### 生成发行包

```bash
npm run make
```

当前打包配置默认生成 Windows 可解压直接运行的 ZIP 包。

## 项目结构

```text
src/
  main/        Electron 主进程、IPC、数据库、托盘、调度器
  preload/     预加载桥接层
  renderer/    React 界面、视图、状态与组件
resources/     应用图标与静态资源
types/         主进程与渲染进程共享类型
```

## 数据存储

- 应用数据默认保存在 Electron 用户数据目录
- 数据库基于 `sql.js`
- 数据库文件会在应用运行时自动创建
- 本地数据文件不应提交到仓库

## 常用快捷键

### 全局快捷键

- `Ctrl/Cmd + Shift + D`：显示或隐藏主窗口
- `Ctrl/Cmd + Alt + N`：全局快速添加任务

### 应用内快捷键

- `N`：新建任务
- `Ctrl/Cmd + F`：打开搜索
- `P`：打开或关闭番茄钟
- `Shift + /` 或 `?`：打开快捷键帮助
- `Esc`：关闭当前面板

## 版本信息

当前版本：`v1.0.2`

本次版本重点包括：

- 修复 `1.0.0` 中的多项交互问题
- 新增项目管理功能
- 新增项目管理面板
- 优化设置页，增加 GitHub 仓库入口
- 优化时间线展示逻辑，完成任务会按完成日期进入时间线
- 调整发布方式，默认提供 Windows ZIP 解压即用包

## 社区支持

- LinuxDO：https://linux.do/

## 开源协议

本项目基于 MIT License 开源，详见 [LICENSE](./LICENSE)。
