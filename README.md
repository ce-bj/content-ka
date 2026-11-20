# 内容 CMS（content-ka）

面向 AI 的企业内容管理（CMS）项目，与 KDH 企业知识库组成 KA 整体方案。仓库里有两部分：

- **产品文档**：背景调研、产品需求（含架构图、业务流程图、功能清单）；
- **交互原型**：React 单页应用，用来演示和评审，不含后端，所有数据都是页面里的演示数据。

## 目录结构

```
content-ka/
├── README.md                 本文件：安装与启动
├── docs/
│   ├── 01-调研报告.md         背景、HubSpot 对标、厂商调研
│   ├── 02-产品PRD.md          产品需求：背景、范围、架构图、流程图、功能清单
│   └── 归档/                  早期讨论稿与上一版 PRD
├── prototype/                交互原型（React + Vite）
│   ├── src/pages/            25 个页面，每页一个目录：<Page>.tsx + page.meta.json
│   ├── src/components/       外壳布局、共用组件
│   ├── src/lib/              演示状态与共用配置
│   ├── _archive/pages/       已移出原型的页面（不参与构建）
│   └── README.md             页面清单与代码约定
└── .claude/launch.json       Claude Code 预览配置
```

## 环境要求

| 工具 | 版本 |
|---|---|
| Node.js | 20.19 及以上，或 22.12 及以上（Vite 8 的要求；本机验证过 24.15） |
| npm | 随 Node 自带即可（本机验证过 11.12） |
| 浏览器 | 最新版 Chrome / Edge / Safari |

查看本机版本：

```bash
node -v
```

## 安装

依赖装在 `prototype/` 目录下：

```bash
cd prototype
```

```bash
npm install
```

装不上或很慢时，可以临时换国内镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

## 启动

在 `prototype/` 目录下启动开发服务器：

```bash
npm run dev
```

服务固定在 **1238** 端口，并监听本机所有网卡（配置在 `prototype/vite.config.ts`）：

| 从哪里访问 | 地址 |
|---|---|
| 本机 | http://localhost:1238 |
| 局域网内其他电脑 / 手机 | `http://<本机局域网 IP>:1238`，终端里 `Network:` 一行就是这个地址 |

查看本机局域网 IP（macOS）：

```bash
ipconfig getifaddr en0
```

局域网访问不了时，检查两点：
- 对方和本机在同一个网络（同一 Wi-Fi / 网段）；
- 本机防火墙放行了 Node：系统设置 → 网络 → 防火墙，允许 node 接收传入连接。

也可以在项目根目录直接启动，不用先进入 `prototype/`：

```bash
npm --prefix prototype run dev
```

## 其他命令

都在 `prototype/` 目录下执行：

| 命令 | 作用 |
|---|---|
| `npm run build` | 类型检查并打包，产物在 `prototype/dist/` |
| `npm run preview` | 预览打包后的产物（先执行 build），同样在 1238 端口、局域网可访问 |
| `npm run lint` | 代码检查（oxlint） |

`dist/` 是纯静态文件，可以放到任意静态服务器上给别人看。原型用的是 hash 路由（地址形如 `/#/content`），不需要服务器做路由配置。

## 使用原型

- **从哪里看起**：打开后是工作台，顶部“整体流程”三条线可以逐步点进各页面。
- **演示路径**：见 `docs/02-产品PRD.md` 附录 B，共 8 条。
- **切换角色**：右上角角色下拉框。默认是平台管理员，能看到全部页面；切到其他角色可以看权限受限的效果。
- **重置演示数据**：跨页面的操作（送审、审批、裁定冲突等）会保存在当前浏览器标签页里；头像菜单里的“重置演示数据”可以恢复初始状态，关掉标签页也会清空。
- **页面清单与代码约定**：见 `prototype/README.md`。

## 常见问题

| 现象 | 处理 |
|---|---|
| `npm install` 报 Node 版本不符 | 升级 Node 到 20.19+ 或 22.12+，可用 nvm：`nvm install 22` |
| 启动后页面空白 | 看浏览器控制台；多数是依赖没装全，删掉 `prototype/node_modules` 后重新 `npm install` |
| 启动时报 `Port 1238 is in use` | 端口被占用（多半是已经开着一个）：关掉占用的进程，或临时换端口 `npm run dev -- --port 1239` |
| 演示数据乱了 | 头像菜单 → 重置演示数据 |
