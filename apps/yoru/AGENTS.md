# apps/yoru — ASMRoner「よる」前端包内约定

新前端(React 19 + Vite + TS strict + Tailwind v4 CSS-based + TanStack Router/Query + sonner + framer-motion)。
旧包 `apps/web` 只读,禁止改动、禁止互相 import;Go 代码禁止改动。

## 目录结构

```
src/
  styles/      tokens.css(设计令牌)/ base.css / components.css(y- 前缀组件类)
  lib/         纯逻辑:api.ts(apiClient)、keys.ts(查询键)、settings.tsx(客户端设置)、
               subtitles.ts / feedback.ts / playback.ts / useTaskEvents.ts / utils.ts(cn)
  components/
    ui/        UI 原语(Sticker/Chip/Toggle/Stepper/ProgressBar/EQ/CoverPlaceholder/
               EmptyState/Skeleton/Pagination/Dialog)
    TaskRealtimeBridge.tsx   SSE → react-query 桥(壳挂载一次)
    PageHeader.tsx            页头(标题+假名+虚线徽章+右侧 aside)
    WorkBadge.tsx             WorkStatusBadge(状态徽章)+ DownloadButton(下载钮三态)
    CollectButton.tsx         收藏(入库)♡ 切换钮(配 hooks/useCollections.ts)
    DownloadReviewDialog.tsx  下载复核对话框(创建 single/batch 任务)
  player/      全局播放器:GlobalPlayer(Context)/PlayerBar/ExpandedPlayer/
               usePlaybackPersistence / useSubtitles / logic(纯函数)/ types
  shell/       AppShell(header + 移动 tab bar + 主区)
  routes/      router.tsx(code-based 路由)+ screens/
```

## 样式

- 只用 `y-` 组件类 + tokens(`var(--*)`);**禁止新造色值/字号/圆角字面量**
  (照抄原型 dc.html 的 rgba 组合除外,注释标明出处)。
- 组件视觉全部在 `components.css` 的 `@layer components`;断点:**<768 移动 / 768–1100 平板 / >1100 桌面**(CSS 写字面量 `@media (max-width: 767px)`)。
- hover 一律包进 `@media (hover:hover)`,移动端不得依赖 hover 才能操作。
- 贴纸受 `[data-stickers="false"]` 全局降级(去旋转去色),新贴纸沿用 `y-sticker`。

## 数据访问

- API 一律走 `lib/api.ts` 的 `apiClient`(统一包络已拆好);**禁止组件里直接 fetch `/api`**(字幕等静态文件流除外)。
- react-query 的 queryKey 必须用 `lib/keys.ts` 的 factory;失效用前缀(`keys.tasks.all`、`keys.library.all`、`keys.worksStatus()`)。
- SSE 已由 `TaskRealtimeBridge` 处理(task 事件补丁 + 终态失效);页面只需要用对 key。

## 播放器

- 页面开播唯一入口:`useGlobalPlayer().playSession(session, opts?)`(`@/player`):
  - `session = { sourceId?, workTitle, coverUrl?, tracks: PlayerTrack[], startIndex, stream, cv?, rj? }`;
  - `PlayerTrack = { id, title, url, duration?, subtitleUrl? }`,url 直接可播(`/media/...` 或 `.../stream`);
  - `stream: true` = 在线串流(显示徽章 + 「↓ 下载本作」+ feedback 上报);
  - `opts.resumeFrom`(秒)在 startIndex 轨上续播;`opts.resumeWork: true` = 整作续播
    (查 `GET /api/playback/progress/:sourceId`,命中则切到记录曲目续播,404 = 无进度)。
    **显式点选某轨时什么都不要传**——用户选哪轨播哪轨;
  - `sourceId` 缺省时跳过进度持久化。
- 进度持久化(10s 间隔 + 2s 节流 PUT)已内置,页面不用管。

## 客户端设置

- `useSettings()`(`lib/settings.tsx`):`{theme, palette, stickers, notify}`,`update(patch)` 即写
  `document.documentElement.dataset` + localStorage `yoru:settings`(与 index.html 防 FOUC 同 schema)。

## 测试

- vitest + jsdom + testing-library;**mock `apiClient` + 纯函数单测**模式(见 `lib/api.test.ts`、`player/logic.test.ts`)。
- jsdom 不实现 audio 播放行为,播放器只测纯逻辑(索引钳制/字幕选行/门槛判断)。
- 跑法:`npm test -- --run`;提交前必须全绿 + `npm run build` 通过。

## 双端要求

- 每个页面/浮层必须同时有桌面与 <768 移动形态(移动缺失时按 §4 范式补,照抄 tokens)。
- 壳 100dvh 不滚,内容区滚;底部安全区用 `env(safe-area-inset-bottom)`。
- 触达目标 ≥44px。

## 页面开发约定(并行 Phase 必读)

- 每页实现落在 `src/routes/screens/<Page>.tsx`(路由已 lazy 接好,替换占位内容即可);
  页面私有组件放 `src/components/<page>/`;**页面私有样式放 `src/styles/pages/<page>.css`
  并在 screen 模块顶部 `import "@/styles/pages/<page>.css"`**——不要改 components.css,避免并行冲突。
- 共享件直接用,不要重复造:`PageHeader`、`WorkStatusBadge`、`DownloadButton`、
  `CollectButton`(♡ 收藏入库)、`DownloadReviewDialog`、`useWorksStatus(sourceIds)`、
  `useCollections()`/`useToggleCollection()`(src/hooks/)、`toCollectionInput`(api.ts)、
  `lib/format.ts`(formatDuration/formatCount/formatRate/formatDate/formatRelativeTime)。
- 下载作品一律经 `DownloadReviewDialog`(单件也过复核),不要直接调 apiClient.createDownload。
- **收藏即入库**:收藏写服务端 `/api/collections`(快照 upsert),与下载状态独立;
  `WorkStatus.collected` 为统一收藏标记;下载只是离线可选,不再等于入库。
- **作品详情唯一入口:`/works/$sourceId`**(本地/远端统一,展示详细内容+文件层级)。
