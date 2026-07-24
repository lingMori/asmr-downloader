# apps/yoru — ASMRoner「よる」前端包内约定

新前端(React 19 + Vite + TS strict + Tailwind v4 CSS-based + TanStack Router/Query + sonner + framer-motion
+ @paper-design/shaders-react(氛围 WebGL)+ @formkit/auto-animate(列表 FLIP))。
旧包 `apps/web` 只读,禁止改动、禁止互相 import;Go 代码禁止改动。

## 目录结构

```
src/
  styles/      tokens.css(设计令牌 + --glass-* 液态玻璃材质)/ base.css / components.css(y- 前缀组件类)
  lib/         纯逻辑:api.ts(apiClient)、keys.ts(查询键)、settings.tsx(客户端设置)、
               platform.ts(桌面模式检测:?desktop=1 → data-platform="desktop")、
               glow.ts(封面取色/光晕色板)、subtitles.ts / feedback.ts / playback.ts /
               useTaskEvents.ts / utils.ts(cn + copyText)
  components/
    ui/        UI 原语(Sticker/Chip/Toggle/Stepper/ProgressBar/EQ/CoverPlaceholder/
               EmptyState/Skeleton/Pagination/Dialog)
    TaskRealtimeBridge.tsx   SSE → react-query 桥(壳挂载一次)
    PageHeader.tsx            页头(标题+假名+虚线徽章+右侧 aside)
    WorkBadge.tsx             WorkStatusBadge(状态徽章)+ DownloadButton(下载钮三态)
    CollectButton.tsx         收藏(入库)♡ 切换钮(配 hooks/useCollections.ts)
    DownloadReviewDialog.tsx  下载复核对话框(创建 single/batch 任务)
    AmbientGlow.tsx           环境氛围层(封面主色光晕 + 颗粒;AmbientGlowCanvas 为 lazy WebGL 实现)
    workdetail/               FileTree(默认全折叠,phosphor 类型图标)+ tree(纯逻辑)
                              + FilePreviewDialog(非音频应用内预览:图片灯箱/文本/视频)
  player/      全局播放器:GlobalPlayer(Context)/PlayerBar/ExpandedPlayer/
               usePlaybackPersistence / useSubtitles / logic(纯函数)/ types
  shell/       AppShell(header + 移动 tab bar + 主区)
  routes/      router.tsx(code-based 路由)+ screens/
```

## 样式

- 只用 `y-` 组件类 + tokens(`var(--*)`);**禁止新造色值/字号/圆角字面量**
  (照抄原型 dc.html 的 rgba 组合除外,注释标明出处)。
- **图标一律 `@phosphor-icons/react`**(尺寸 11–16 按槽位,激活态 `weight="fill"`);
  禁用文本符号字形(♪ ★ ☾ ▶ ✓ 等),播放中行内指示用 `EQ` 组件而非静态图标。
- **display 字体**:`var(--font-display)`(Zen Old Mincho)只用于页头标题/详情 H1/hero/展开播放器
  标题这类大标题与 display 数字,正文永远 Zen Maru Gothic;圆角大档 `--r-2xl`(24px)只给展开播放器封面。
- 材质纪律(Apple Music 式):底子是近黑/近白平面色,层级只用 `--surface`/`--surface-2`
  灰度微差;**玻璃(backdrop-filter)只给下面真有内容流过的浮层**——播放条、展开播放器、
  对话框、批量栏、移动 tab bar(及封面图上的徽章);卡片/列表/输入一律平面 + 1px 发丝描边,
  无投影。浮层玻璃件才用 `--glass-*` 令牌(blur+saturate、`--glass-line*`、`--glass-highlight`、
  `--glass-shadow`),且 `--glass-bg` alpha ≥ 0.8,文字不直接坐在低透明模糊层上。
- 点缀色纪律:`--lav`/`--pink` 只用于主 CTA、激活态(navOn)、播放中状态、收藏心形;
  其余按钮/控件中性(灰白系)。描边用 `color-mix(in srgb, var(--lav) …)` 取色,4 组 palette 自动协调。
  贴纸是唯一装饰元素;假名注音缩小降透明,附属于贴纸/标题。
- 桌面模式:`:root[data-platform="desktop"]`(Wails 壳 URL 带 `?desktop=1`,见 lib/platform.ts)
  的 `--bg-alpha` 机制保留(当前 100% 不透明;要透出窗口玻璃就把 tokens.css 里两个值调回 <100%)。
- 组件视觉全部在 `components.css` 的 `@layer components`;断点:**<768 移动 / 768–1100 平板 / >1100 桌面**(CSS 写字面量 `@media (max-width: 767px)`)。
- hover 一律包进 `@media (hover:hover)`,移动端不得依赖 hover 才能操作。
- 贴纸受 `[data-stickers="false"]` 全局降级(去旋转去色),新贴纸沿用 `y-sticker`。

## 动效

- 三层分工,**优先用成熟库,不手写**:
  - 氛围层:`@paper-design/shaders-react`(WebGL)——`AmbientGlow`(壳挂载一次)用
    `MeshGradient` 把封面主色(`lib/glow.ts` canvas 取色 + `useCoverGlow`,失败回退散列色)
    渗透进背景,自带颗粒;lazy 分包 + webgl2 预检,失败回退 CSS 径向渐变,不许白屏。
  - 交互层:`framer-motion`(LayoutGroup/layoutId 共享元素转场、drag 手势、variants);
    参数统一从 `lib/motion.ts` 取(EASE_OUT/SPRING_SOFT/DIALOG_IN/ENTER),不要自造数值。
  - 列表层:`@formkit/auto-animate` 的 `useAutoAnimate()` 挂容器 ref(FileTree/队列/chips 行),
    默认尊重 reduced-motion。
- 时长/缓动只用 tokens(`--dur-fast 120ms`/`--dur-med 240ms`/`--dur-slow 400ms`,
  `--ease-out`/`--ease-spring`);按压/hover 位移类 transition 一律 `--ease-spring`。
- 列表进入过渡用 `<FadeIn index={i}>`(ui/):fade + y10 轻 spring、40ms 错相、只在挂载时跑一次,
  无限滚动追加批次自然进入;key 保持稳定的已渲染项不会重播。
- 微交互:按钮 press scale(主钮 0.97/小控件 0.96)、卡片 hover -2px + 描边变亮,
  只动 transform/opacity。
- reduced-motion:base.css 全局降级 + main.tsx `MotionConfig reducedMotion="user"`
  (shader 层经 framer `useReducedMotion` speed=0 定格),新动效不需要也不允许绕过这些兜底。

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
