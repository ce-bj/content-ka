# 内容中台原型

React + Tailwind CSS v4 + shadcn/ui（Base UI 版）。只做交互原型，不含技术实现：所有数据是页面顶部的 `mockXxx` 常量，所有接口动作是 `handleXxx` 占位函数（`console.log` / `alert`）。

产品需求见 `../docs/02-产品PRD.md`（背景、范围、架构图、各业务流程图、功能清单），背景与对标见 `../docs/01-调研报告.md`。侧边栏分“生产与发布 · 自建 / 引用源 · 自建 / 对接 · 其他平台 / 配置”四区；每页顶部的位置条显示面包屑和当前页在主流程或事实流程中的步骤（`src/components/layout/flows.ts`）。演示路径见 PRD 附录 B，演示数据口径见附录 C。

早期讨论稿已归档在 `../docs/归档/`。

## 运行

环境要求、安装、启动和常见问题见根目录的 `../README.md`。简要步骤（在本目录下）：

```bash
npm install
```

```bash
npm run dev
```

## 页面

| 路由 | 页面 | 目录 | 看点 |
|---|---|---|---|
| `/` | 工作台 | `src/pages/Workbench` | 整体流程三条线、待办、指标、健康度摘要 |
| `/production/topics` | 选题 | `src/pages/TopicPlanner` | 可配置的入口规则、选题建议、提报、采纳后进入 AI 生成、KDH 补录 |
| `/production/generate` | AI 生成 | `src/pages/GenerateWizard` | 写作要求 + 自选引用 + 可选模板；引用时发现冲突选值继续 |
| `/production/repurpose` | 一稿多用 | `src/pages/Repurpose` | 源内容 → 多个目标格式（来自生产规范），逐篇成草稿 |
| `/production/translations` | 翻译任务 | `src/pages/TranslationTasks` | 机翻 + 人工校对、术语遵守、事实分段锁定 |
| `/production/standards` | 生产规范 | `src/pages/ProductionStandards` | 生成模板 / 一稿多用目标格式（按渠道分组）、Brand Voice、术语库 |
| `/content` | 自产内容 | `src/pages/ContentList` | 来源列与筛选、语种版本状态、复核与检查标记 |
| `/content/edit/C-1002` | 编辑器 | `src/pages/ContentEditor` | 事实标签与插槽、实时发布检查、送审时的发布设置（渠道 + 集合） |
| `/content/edit/new` | 新建内容 | 同上 | 先选内容类型 |
| `/content/tables` | 数据表 | `src/pages/DataTables` | 表格内编辑、绑定事实的列只读、导入预检 |
| `/review` | 审批中心 | `src/pages/ReviewCenter` | 四类事项统一审批、发布设置与冲突取值、复核队列、Agent 建议 |
| `/content/releases` | 发布批次 | `src/pages/ReleaseBatches` | 编排条目、提交批次发布审批、排期与回滚 |
| `/market` | 内容市场 | `src/pages/ContentMarket` | 货架、内容集合、对接方取用范围（渠道 + 集合）、取用记录 |
| `/facts` | 事实库 | `src/pages/FactLibrary` | 生命周期说明、事实更新影响、同步状态 |
| `/facts/conflicts` | 冲突处理 | `src/pages/ConflictCenter` | 同步时 / 使用中发现的冲突、裁定后入库并发起回写审批 |
| `/external` | 外部内容 | `src/pages/ExternalContent` | 外部文字内容：用作引用、纳管为自产、重新同步 |
| `/assets` | 资产 | `src/pages/AssetLibrary` | 自然语言搜索、副本与授权、AI 处理队列、事实候选 |
| `/integrations` | 上游接入 | `src/pages/IntegrationCenter` | 连接器、按对象配置接入方式、外部引用台账、同步 |
| `/insights/usage` | 效果回流 | `src/pages/UsageInsights` | 按对接方 / 内容类型的取用、内容效果 |
| `/settings/models` | 内容模型 | `src/pages/ContentModelDesigner` | 字段类型（含事实插槽 / 变体）、AI 建模、变更影响预览 |
| `/settings/org` | 组织与范围 | `src/pages/OrgScopes` | 品牌与事业部、区域、语种、站点、渠道 |
| `/settings/members` | 成员与角色 | `src/pages/MembersRoles` | 成员 × 角色 × 范围、权限矩阵 |
| `/settings/approvals` | 审批流程 | `src/pages/ApprovalFlows` | 审批引擎（内置 / 外部产品）、按事项类型的审批流程 |
| `/settings/rules` | 规则 | `src/pages/RulesSettings` | 发布检查、冲突推荐、事实同步方向 |
| `/settings/ai` | AI 与模型 | `src/pages/AiSettings` | AI 能力与模型、用量、外部 MCP 工具 |
| `/settings/audit` | 审计日志 | `src/pages/AuditLog` | 操作日志、按事实追溯 |

已移出的页面（下游分发、内容集合、内容健康度、自动化流程）存放在 `_archive/pages/`，不参与构建。

## P2P 规范

每个页面目录包含 `<Page>.tsx` 与 `page.meta.json`，按 P2P Engine 约定编写，均已通过 `validate.py` 门禁校验（mock 常量、`// ACTION:` 注释、meta 映射一一对应）。

公共部分（不属于页面、不进 meta）：

- `src/components/layout/AppShell.tsx`：侧边导航与顶栏（范围切换、全局搜索、角色切换、通知）；窄屏下用抽屉菜单
- `src/components/layout/access.ts`：角色 × 菜单权限矩阵（PRD 6.7）。切换角色后隐藏不可见的菜单；只读和本范围内操作的页面顶部显示提示条
- `src/components/shared/status.tsx`：全站统一的状态标识（内容状态、同步状态、证据等级、AI 标识）
- `src/components/shared/AssetThumb.tsx`：资产缩略图占位（原型不加载真实图片）
