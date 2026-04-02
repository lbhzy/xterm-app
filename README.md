# Taurinal

基于 Tauri v2 + React + xterm.js 构建的跨平台终端应用，支持本地 PTY、SSH 远程连接和串口通信。

## 功能特性

- **本地终端** — 通过 `portable-pty` 创建本地伪终端，支持自定义启动命令
- **SSH 连接** — 基于 `ssh2` 的远程 SSH 会话，支持密码和密钥认证
- **串口通信** — 通过 `serialport` 连接串行设备，支持多种波特率
- **多标签页** — 同时管理多个终端会话
- **会话管理** — 侧边栏保存和快速连接常用会话
- **触发器系统** — 基于正则匹配终端输出，支持高亮、悬浮提示、点击发送命令和自动发送命令
- **快捷命令** — 可配置的一键发送命令栏
- **Hex 查看器** — 底部面板实时显示终端数据的十六进制视图（虚拟滚动），支持录制开关
- **数据波形** — 底部面板将终端输出按正则提取为数值并绘制实时波形，支持分组和点数控制
- **终端配置** — 6 种内置配色主题、字体、光标样式等设置
- **应用主题** — 支持深色/浅色应用主题切换
- **配置持久化** — 所有配置通过 Tauri 文件系统存储，设置界面可直接打开配置目录
- **VS Code 风格布局** — 可拖拽调整侧边栏/底部面板大小，自定义窗口标题栏

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Tauri v2 |
| 前端 | React 19 + TypeScript + Vite |
| 终端 | @xterm/xterm 6 + @xterm/addon-fit |
| UI | Tailwind CSS v4 + shadcn/ui + Lucide Icons |
| 后端 | Rust (portable-pty, ssh2, serialport) |

## 项目结构

```
src/
├── App.tsx                    # 主应用（标签页、布局、状态管理）
├── components/
│   ├── Terminal.tsx            # xterm.js 终端组件（PTY/SSH/Serial）
│   ├── Sidebar.tsx             # 侧边栏（会话列表 + 活动栏）
│   ├── BottomPanel.tsx         # 底部面板容器（可拖拽调整高度）
│   ├── HexView.tsx             # 十六进制数据查看器
│   ├── DataWaveform.tsx        # 数据波形可视化（正则提取数值）
│   ├── ConnectDialog.tsx       # 新建连接对话框
│   ├── SessionManager.tsx      # 保存会话管理
│   ├── TriggerManager.tsx      # 触发器管理
│   ├── SettingsDialog.tsx      # 终端设置对话框
│   ├── QuickCommandBar.tsx     # 快捷命令栏
│   ├── QuickCommandManager.tsx # 快捷命令编辑
│   └── ui/                    # shadcn/ui 基础组件
├── lib/
│   ├── quick-commands.ts       # 快捷命令配置读写
│   ├── saved-sessions.ts       # 会话配置读写
│   ├── terminal-settings.ts    # 终端设置 + 内置主题
│   ├── triggers.ts             # 触发器配置读写
│   └── utils.ts
└── styles.css                 # Tailwind + 全局样式

src-tauri/src/
├── lib.rs       # Tauri 应用入口，注册命令
├── pty.rs       # 本地 PTY 创建与管理
├── ssh.rs       # SSH 连接
├── serial.rs    # 串口连接与端口枚举
├── session.rs   # 统一会话管理（读写/调整/关闭）
└── config.rs    # 配置文件读写 + 打开配置目录
```

## 开发

### 前置要求

- [Bun](https://bun.sh) (包管理 & 前端构建)
- [Rust](https://rustup.rs) (Tauri 后端)
- macOS 需安装 OpenSSL: `brew install openssl@3`

### 安装依赖

```bash
bun install
```

### 开发模式

```bash
bun tauri dev
```

### 构建发布

```bash
bun tauri build
```
