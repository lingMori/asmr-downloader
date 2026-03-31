# React + Vite + TanStack Router/Query 改造规划

## 目标与范围
- 将现有 CLI/WebUI 能力迁移为现代化前端：React 19 + Vite 6 + TanStack Router/Query + shadcn/ui。
- 通过 Go 后端提供统一 REST/任务 API，前端只负责渲染、交互与任务编排。
- 与现有下载/同步能力保持功能一致，同时提升 DX、可观测性与可扩展性。

## 架构概览
- **前端应用**：Vite 驱动的 React SPA，使用 TanStack Router 进行路由切片，TanStack Query 负责数据获取与缓存，shadcn/ui + Tailwind v4 构建设计系统，Zustand 作为局部状态（可选）。
- **后端/BFF**：Go 服务暴露 `/api/*`，提供搜索、下载、同步、任务、媒体浏览等端点。短期直接复用 EngineManager，长期拆分 service 层，支持 SSE/WS 通知。
- **通信模式**：所有写操作（下载、同步、重试）通过任务 API 触发并返回 `taskId`，前端使用 Query 轮询或 SSE 订阅；媒体和静态资源通过签名 URL 或公共静态目录分发。

## 技术栈选型理由
- **Vite 6 + React 19**：最快热更新、自然支持标准 RSC；与 TanStack Router 配合可覆盖 SPA 绝大部分需求。
- **TanStack Router/Query**：提供类型安全的嵌套路由和请求缓存；Query Devtools 辅助调试任务流；Router loaders/actions 让数据流和退避策略统一。
- **shadcn/ui**：基于 Radix 的可访问组件源代码，适合定制；通过 CLI 生成组件并存放在 `src/components/ui` 或 `packages/ui`，在此项目中将扩展为现代化视觉体系（毛玻璃 / 微交互动效 / 高信息密度布局）。
- **构建与质量**：pnpm workspace、Biome/ESLint、Vitest + React Testing Library、Storybook for shadcn 组件。

## 模块拆分
1. **基础设施**
   - Vite + pnpm + TypeScript 配置，设置 `@/` 别名。
   - 引入 Tailwind v4 + PostCSS + shadcn CLI；定义主题 token、深浅色模式。
   - 设置 TanStack Router（文件路由或 config 路由）和 Query Client（持久化缓存、重试策略）。
2. **认证与全局壳**
   - 与 Go 后端协商 token/session 方案；在 Router loader 中校验登录。
   - 实现全局布局（nav/sidebar/toast），并加载用户/系统状态。
3. **业务页面**
   - **Dashboard**：同步整体指标、下载队列、存储占用；使用 shadcn Card + Chart 组件。
   - **Search & Download**：表单（关键字/高级语法），表格展示，直接加入下载或导出。
   - **Tasks**：任务列表（下载/同步/重试），详情面板显示日志、失败原因、操作按钮。
   - **Library**：媒体浏览 + 播放器（可使用 Plyr React 包或自研 Audio 组件），支持字幕文件预览。
   - **Settings**：账号、限流、代理、偏好格式等配置表单。
4. **横切能力**
   - 通知（toast/alert）、错误边界、Loading 骨架、权限守卫、i18n。
   - SSE/WebSocket 客户端包装：任务状态推送、下载进度条。

## UI 设计原则
- **shadcn 组件 + Tailwind token**：所有基础组件来自 shadcn React 库，并在主题层扩展玻璃拟态（Glassmorphism）效果、柔和阴影、渐变边框等风格。
- **现代化视觉**：全局布局采用毛玻璃背景、模糊叠层、卡片式区块与动态光效；交互元素（按钮、列表、图表）辅以微交互（hover 缩放 / opacity 动画 / skeleton shimmer）。
- **高信息密度**：表格/仪表盘使用紧凑排版、多层筛选、内嵌统计；通过分组、色彩层级和 iconography 保持可读性，避免无意义留白。
- **动效与可访问性**：动效遵循 150–250ms 的渐入/渐出曲线，对关键状态切换采用 spring 动画；保持 WCAG 对比度，确保玻璃化背景下文本清晰可读。
- **适配性**：毛玻璃与动效同时兼顾性能，在低性能设备或 prefers-reduced-motion 模式下降级为纯色背景和静态样式。

## 里程碑
1. **M1：脚手架落地**（~1 周）
   - 初始化 Vite + React + TanStack Router/Query + shadcn。
   - 建立 CI（lint/test/build）、Storybook、基础布局与主题。
2. **M2：API 对接**（~2 周）
   - Go 后端提供 `/api/search`、`/api/download`, `/api/tasks`、`/api/media`，前端实现对应模块。
   - 完成任务轮询 + 错误处理模式。
3. **M3：全功能替换**（~3-4 周）
   - 实现同步、重试、统计、设置页面；覆盖 CLI 的主要流程。
   - 增加播放页、字幕预览、批量导入导出。
4. **M4：优化与部署**（~2 周）
   - 性能调优（代码分割、Query 缓存、预取）、E2E 测试、CI/CD、灰度发布。

## 风险与对策
- **后端 API 进度拖延**：前端使用 Mock Service Worker 模拟接口，独立推进 UI；并在接口冻结前保留配置化 URL。
- **任务实时性要求高**：优先实现可控的轮询策略，后续再接入 SSE/WS；Query `refetchInterval` + 退避。
- **shadcn 组件升级**：将生成组件托管在独立目录并加上单元/视觉测试，升级前跑 `pnpm shadcn diff`。
- **跨团队协作**：设立 API 契约（OpenAPI/JSON Schema），通过 GitHub Actions 在 PR 中自动校验。

## Prompt（供 AI/自动化使用）
> 你是负责 asmroner React 客户端的前端工程师。使用 React 19 + Vite 6 + TanStack Router/Query + shadcn/ui。遵循以下约束：
> 1. 所有路由通过 TanStack Router 定义，Loader 中校验用户状态，页面组件使用函数式写法。
> 2. 数据请求统一走 TanStack Query，封装 `apiClient`（基于 fetch）并实现错误 toasts。
> 3. UI 组件优先复用 `src/components/ui/*` 中的 shadcn 原子组件；必要时自定义组合组件，但保持 Tailwind 设计 token。
> 4. 新特性需附带 Vitest + RTL 的单元测试，以及 Storybook 示例（对公共组件）。
> 5. 严格按照本文档的模块拆分、里程碑推进，如需新增依赖或重大架构调整需在 PR 中说明理由与影响。
