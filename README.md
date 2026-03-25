# DoList

DoList 是一个基于 Electron、React 和 TypeScript 构建的桌面任务管理应用，强调本地优先、快速录入和多视图规划。

## 功能特性

- 收件箱、今天、即将到来等任务视图
- 项目组与项目列表管理
- 日历、看板、时间线、四象限视图
- 项目报告视图
- 快速添加、搜索、任务详情面板
- 番茄钟
- 本地提醒与后台调度
- 系统托盘与全局快捷键
- 基于 `sql.js` 的本地数据存储

## 技术栈

- Electron
- React 18
- TypeScript
- Vite / electron-vite
- Tailwind CSS
- Zustand
- `sql.js`

## 本地开发

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

### 构建

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

## 项目结构

```text
src/
  main/       Electron 主进程、IPC、数据库、托盘、调度器
  preload/    预加载桥接层
  renderer/   React 界面、视图、状态与组件
resources/    图标与静态资源
types/        共享类型定义
```

## 数据存储

应用数据保存在 Electron 的用户数据目录中。数据库文件会在运行时自动创建，不应该提交到仓库。

## 快捷键

- `Ctrl/Cmd + Shift + D`：显示或隐藏主窗口
- `Ctrl/Cmd + Alt + N`：全局快速添加任务
- `N`：应用内快速添加
- `Ctrl/Cmd + F`：打开搜索
- `P`：切换番茄钟
- `Shift + /`：打开快捷键帮助

## 开源协议

本项目采用 MIT License，详见 [LICENSE](./LICENSE)。
