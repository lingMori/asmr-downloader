- # ASMRoner 前端重构文档

  ## 「YORU_FM · 深夜电台」视觉系统迁移方案

  | 项目       | 内容                                                         |
  | ---------- | ------------------------------------------------------------ |
  | 文档版本   | v1.0                                                         |
  | 日期       | 2026-07-12                                                   |
  | 适用代码库 | `apps/web`（React + TypeScript + Vite）                      |
  | 现行体系   | Sonic Mission Control（`deck-*` CRT 控制台风格，见 `apps/web/docs/style-system.md`） |
  | 目标体系   | YORU_FM 深夜电台风（方向 B，已由可交互原型确认）             |
  | 设计基线   | 原型文件 `yoru_fm_prototype.html`（本文档以其为唯一视觉基准，冲突时以本文档规范化后的 token 为准） |

  ------

  ## 1. 背景、目标与范围

  ### 1.1 背景

  当前前端使用「Sonic Mission Control」复古 CRT 控制台风格：机箱铆钉、扫描线、磷光绿读数、琥珀色亚克力按钮。经过讨论，产品定位调整为「深夜电台」——深靛紫夜空底色、霓虹樱粉/荧光青点缀、毛玻璃卡片、底部电台调谐器播放器。ASMR 用户以夜间使用为主，深色氛围更贴合真实使用场景。

  ### 1.2 目标

  1. 将全站视觉从 `deck-*` CRT 体系整体迁移到 `yoru-*` 深夜电台体系，视觉效果与已确认原型一致。
  2. 保持组件 API（props、variant 名）尽量不变，把改动收敛在 CSS token、表面类和少量组件内部实现上，最小化对四个业务页面（Discover / Library / Queue / Settings）的逻辑侵入。
  3. 建立可维护的双层 token 体系（原始色板层 + 语义角色层），为深/浅双主题留好接口。
  4. 全程保持可访问性与性能底线不回退（对比度、键盘焦点、`prefers-reduced-motion`、移动端可用）。

  ### 1.3 非目标（明确不做）

  - 不改动路由结构、数据层（TanStack Query hooks）、API 契约、任务/下载业务逻辑。
  - 不更换技术栈（保留 Tailwind + shadcn/ui + framer-motion + Phosphor 图标）。
  - 不在本次重构中新增业务功能（如真实频率调谐、歌词滚动等，可列入后续迭代）。
  - 原型中的「星尘背景 70 个 DOM 节点」「随机进度条演示」等演示性实现不直接照搬，按第 9 节性能规范重新实现。

  ### 1.4 术语

  - **原型**：YORU_FM 可交互 HTML 原型。
  - **旧体系 / deck 体系**：现行 `deck-*` 类与 `--chassis-* / --screen-* / --phosphor-* / --telltale-* / --tape-pink` token。
  - **新体系 / yoru 体系**：本文档定义的 `yoru-*` 类与 `--night / --glass / --sakura / --aqua / --amber` 等 token。

  ------

  ## 2. 设计规范（Design Spec）

  原型中的取值在此做规范化：补齐状态色、派生色、浅色主题映射，并把所有硬编码色收敛为变量。**重构后代码中禁止出现裸 hex/rgba 颜色字面量**（含 TSX 行内样式与 canvas 绘制），一律引用 CSS 变量。

  ### 2.1 色彩 Token（双层结构）

  #### 2.1.1 原始色板层（palette，不随主题变化的命名色）

  写入 `src/styles/tokens.css` 的 `:root`：

  | 变量               | 值        | 说明                                                     |
  | ------------------ | --------- | -------------------------------------------------------- |
  | `--p-night-900`    | `#0d0a1c` | 夜空最深底                                               |
  | `--p-night-800`    | `#131028` | 页面渐变过渡色                                           |
  | `--p-nebula-700`   | `#171232` | 面板/星云层                                              |
  | `--p-nebula-600`   | `#261e4a` | 玻璃基色（配合透明度使用）                               |
  | `--p-lavender-400` | `#9e8cff` | 描边/星尘薰衣草                                          |
  | `--p-ink-100`      | `#f4f1ff` | 最亮文字（限标题）                                       |
  | `--p-ink-200`      | `#cfc8ef` | 正文                                                     |
  | `--p-ink-400`      | `#7d75a8` | 次级文字                                                 |
  | `--p-sakura-500`   | `#ff7ec8` | 霓虹樱粉（主强调）                                       |
  | `--p-sakura-300`   | `#ff9ed6` | 樱粉高光（渐变终点）                                     |
  | `--p-aqua-500`     | `#6ee7f2` | 荧光青（次强调）                                         |
  | `--p-aqua-300`     | `#9df3fa` | 荧光青高光                                               |
  | `--p-amber-500`    | `#ffc86b` | ON AIR 琥珀                                              |
  | `--p-red-500`      | `#ff6b8a` | 危险/失败（新定义，原型未含；取粉调红以融入夜色）        |
  | `--p-green-500`    | `#7ce8b5` | 成功（新定义，低饱和薄荷，避免与 aqua 混淆时用图标区分） |
  | `--p-contrast-ink` | `#1a0a14` | 粉/青实心按钮上的深色文字                                |

  #### 2.1.2 语义角色层（随主题重映射）

  写在 `:root`（暗色默认）与 `[data-theme="dawn"]`（浅色）下。组件**只允许**引用本层：

  | 语义变量          | 暗色（NIGHT，默认）              | 浅色（DAWN）                       | 用途                         |
  | ----------------- | -------------------------------- | ---------------------------------- | ---------------------------- |
  | `--bg-base`       | `var(--p-night-900)`             | `#f6f3fb`                          | body 底色                    |
  | `--bg-gradient-a` | `rgba(122,74,226,.22)`           | `rgba(158,140,255,.14)`            | 页面径向渐变 1（右上）       |
  | `--bg-gradient-b` | `rgba(255,126,200,.10)`          | `rgba(255,126,200,.10)`            | 页面径向渐变 2（左侧）       |
  | `--surface-glass` | `rgba(38,30,74,.42)`             | `rgba(255,255,255,.62)`            | 毛玻璃卡片底                 |
  | `--surface-solid` | `var(--p-nebula-700)`            | `#ffffff`                          | 不透明面板（抽屉、弹窗）     |
  | `--surface-raise` | `rgba(38,30,74,.30)`             | `rgba(158,140,255,.08)`            | 卡片内嵌块（队列项等）       |
  | `--line`          | `rgba(158,140,255,.16)`          | `rgba(93,79,158,.22)`              | 通用描边                     |
  | `--line-strong`   | `rgba(158,140,255,.32)`          | `rgba(93,79,158,.38)`              | hover 描边                   |
  | `--text-display`  | `#ffffff`                        | `#241b45`                          | 标题/强文字                  |
  | `--text-body`     | `var(--p-ink-200)`               | `#3d3564`                          | 正文                         |
  | `--text-mute`     | `var(--p-ink-400)`               | `#6f6795`                          | 次级/说明                    |
  | `--accent`        | `var(--p-sakura-500)`            | `#e75fae`                          | 主强调（浅色下压暗保证对比） |
  | `--accent-soft`   | `rgba(255,126,200,.12)`          | `rgba(231,95,174,.12)`             | 主强调弱底                   |
  | `--accent-2`      | `var(--p-aqua-500)`              | `#0e9aa9`                          | 次强调（浅色下深化）         |
  | `--accent-2-soft` | `rgba(110,231,242,.08)`          | `rgba(14,154,169,.10)`             | 次强调弱底                   |
  | `--onair`         | `var(--p-amber-500)`             | `#b97b12`                          | ON AIR/警示                  |
  | `--danger`        | `var(--p-red-500)`               | `#d23b5e`                          | 失败/删除                    |
  | `--success`       | `var(--p-green-500)`             | `#1f9d6b`                          | 成功                         |
  | `--btn-ink`       | `var(--p-contrast-ink)`          | `#ffffff`                          | 实心按钮文字                 |
  | `--glow-sakura`   | `0 0 22px rgba(255,126,200,.45)` | `0 0 14px rgba(231,95,174,.30)`    | 粉色辉光                     |
  | `--glow-aqua`     | `0 0 14px rgba(110,231,242,.40)` | `none`                             | 青色辉光                     |
  | `--glow-onair`    | `0 0 10px var(--onair)`          | `none`                             | ON AIR 呼吸灯                |
  | `--shadow-card`   | `0 16px 40px rgba(0,0,0,.5)`     | `0 10px 30px rgba(93,79,158,.16)`  | 卡片投影                     |
  | `--shadow-dock`   | `0 -14px 50px rgba(0,0,0,.55)`   | `0 -10px 30px rgba(93,79,158,.18)` | 底部播放器投影               |

  旧 token 映射关系（用于迁移检索，Phase 2 结束后旧变量全部删除）：

  | 旧变量                                                   | 新语义变量                                   |
  | -------------------------------------------------------- | -------------------------------------------- |
  | `--chassis-base / --chassis-raise`                       | `--surface-solid / --surface-raise`          |
  | `--chassis-edge`                                         | `--line`                                     |
  | `--screen-void`                                          | 删除（无 CRT 屏概念）                        |
  | `--phosphor-primary / --phosphor-mid / --phosphor-trail` | `--accent-2 / --accent-2 / --accent-2-soft`  |
  | `--telltale-amber`                                       | `--onair`                                    |
  | `--telltale-red`                                         | `--danger`                                   |
  | `--telltale-cyan`                                        | `--accent-2`                                 |
  | `--tape-pink / --tape-pink-trail`                        | `--accent / --accent-soft`                   |
  | `--glow-phosphor / --glow-amber / --glow-tape`           | `--glow-aqua / --glow-onair / --glow-sakura` |

  ### 2.2 字体

  三层字体各司其职（与原型一致），**全部自托管**，禁止引用 Google Fonts CDN（自部署环境/国内网络不可依赖外链）：

  | 角色    | 字体                | 变量             | 使用范围（白名单）                               | 引入方式                                                     |
  | ------- | ------------------- | ---------------- | ------------------------------------------------ | ------------------------------------------------------------ |
  | Display | DotGothic16         | `--font-display` | Logo、页面/分区标题（`.yoru-title`）、空状态大字 | `@fontsource/dotgothic16`（latin + japanese 子集，按 unicode-range 分包，仅 400） |
  | Body    | Zen Kaku Gothic New | `--font-body`    | 全站正文默认                                     | `@fontsource/zen-kaku-gothic-new`（400/500/700；中文字符回退见下） |
  | Mono    | IBM Plex Mono       | `--font-mono`    | RJ 号、速率、时间码、频率刻度、日志/JSON         | `@fontsource/ibm-plex-mono`（400/500）                       |

  字体栈：

  ```css
  --font-display: "DotGothic16", "IBM Plex Mono", monospace;
  --font-body: "Zen Kaku Gothic New", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", "Sarasa Mono SC", ui-monospace, monospace;
  ```

  细则：

  - Zen Kaku 与 DotGothic16 的简体中文覆盖不全，简体字形由 PingFang/雅黑回退，属预期行为；标题类文案（英文/假名为主）尽量使用拉丁字符 + 少量汉字，避免中西字形混排突兀。
  - 数字读数（速率、进度、时间）统一 `font-variant-numeric: tabular-nums`。
  - 字号阶梯：12 / 13 / 14（正文默认）/ 16 / 20 / `clamp(24px, 3.4vw, 38px)`（页面主标题）。行高正文 1.6，标题 1.3。
  - Display 字体 `letter-spacing`：Logo 2px、分区标题 3px、kicker 6px。

  ### 2.3 形状、玻璃与辉光

  | Token           | 值      | 用途                            |
  | --------------- | ------- | ------------------------------- |
  | `--radius-card` | `18px`  | 卡片、面板                      |
  | `--radius-ctl`  | `12px`  | 按钮、输入框、导航项            |
  | `--radius-pill` | `999px` | 搜索框、chips、徽章、进度条     |
  | `--blur-glass`  | `14px`  | 卡片 backdrop-filter            |
  | `--blur-dock`   | `22px`  | 底部播放器/抽屉 backdrop-filter |

  玻璃规则：`background: var(--surface-glass); backdrop-filter: blur(var(--blur-glass)); border: 1px solid var(--line);`。**页面同屏 `backdrop-filter` 元素数量上限见 9.1。**

  ### 2.4 动效规范

  | 名称                                   | 参数                                                         | 用途                                                         |
  | -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
  | `--dur-fast / --dur-base / --dur-slow` | `120ms / 200ms / 350ms`                                      | 微交互 / hover / 抽屉与弹窗                                  |
  | `--ease-out`                           | `cubic-bezier(.2,.8,.2,1)`                                   | 抽屉、弹出层                                                 |
  | 卡片 hover                             | `translateY(-4px)` + `--line-strong` 描边 + `--shadow-card` + 微粉辉光，`--dur-base` | 作品卡片                                                     |
  | ON AIR 呼吸灯                          | opacity 1→.25 循环，1.6s ease-in-out                         | 顶栏 ON AIR、播放中标记                                      |
  | 均衡器波形                             | 每根条 `scaleY(.3→1)` 循环 0.8–1.6s 随机相位；暂停时冻结为 `scaleY(.25)` | 播放器（CSS 动画方案）或 canvas（保留现有 AnalyserNode 方案，见 5.10） |
  | 进度条流光                             | `background-position` 200% 平移，2s linear infinite          | 进行中任务                                                   |
  | 页面入场                               | 沿用现有 framer-motion `fadeUpItem` variants，只调 duration 至 `--dur-base` | 各 screen                                                    |
  | 星尘闪烁                               | 见 9.2，`prefers-reduced-motion` 下静止                      | 背景                                                         |

  `prefers-reduced-motion: reduce` 下：所有循环动画（呼吸灯、波形、流光、星尘）停止；transition 保留但压至 1ms。此规则写为全局 `@media` 块，不允许组件私自绕过。

  ### 2.5 图标与图形语汇

  - 图标继续使用 **Phosphor（`weight="duotone"`）**，不引入 Lucide/emoji（原型里的 `⏮ ▶ ♡ ✕` 等 emoji 字符全部替换为 Phosphor 对应图标：`SkipBack / Play / Pause / SkipForward / Heart / X / DownloadSimple / Broadcast / MoonStars` 等）。
  - 签名图形语汇（只允许出现在指定位置）：星尘背景（全局唯一）、ON AIR 徽章（顶栏 + 播放中卡片）、调谐器频率刻度（仅播放器）、`88.8MHz` 台标（Logo 区与 footer）。
  - 明令淘汰：扫描线（`body::after`）、CRT 暗角、铆钉（`deck-chassis::before`）、RGB 边缘偏移、磁带卷轴进度、广播测试图空状态。

  ------

  ## 3. CSS 架构与命名

  ### 3.1 文件结构（重构后）

  ```
  apps/web/src/styles/
  ├── index.css        # 只做 @import 汇总 + Tailwind 指令
  ├── fonts.css        # @fontsource 导入集中处
  ├── tokens.css       # 2.1–2.4 全部变量（:root / [data-theme="dawn"]）
  ├── base.css         # reset、body 背景渐变、::selection、滚动条、focus-visible、reduced-motion
  ├── surfaces.css     # .yoru-panel / .yoru-glass / .yoru-plate / .yoru-tag / .yoru-title 等
  └── widgets.css      # 星尘、ON AIR、波形、调谐器、进度流光、seek 滑块
  ```

  ### 3.2 表面类命名（deck → yoru 映射总表）

  | 旧类                                  | 新类                        | 视觉定义                                                     | 备注                                                         |
  | ------------------------------------- | --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
  | `.deck-chassis`                       | `.yoru-panel`               | 毛玻璃大面板：`--surface-glass` + blur + `--radius-card` + `--line` 描边 | 铆钉伪元素删除；`data-live="true"/"soft"` 属性保留，效果改为粉色描边 + `--glow-sakura` 弱辉光 |
  | `.deck-screen`                        | `.yoru-glass`（内嵌信息块） | 更深一层的半透明块 `--surface-raise` + `--radius-ctl`，无扫描线 | 扫描线/暗角伪元素删除；内部 z-index 结构（`-fill/-content`）保留以兼容封面图用法 |
  | `.deck-plate`                         | `.yoru-plate`               | 控件托底：`--surface-raise` + `--line` + `--radius-ctl`      | 去掉内凹双阴影，改单层极浅 inset                             |
  | `.deck-decal`                         | `.yoru-tag`                 | 小标签：`--accent-2-soft` 底 + `--accent-2` 文字 + 6px 圆角  | 对应原型 `.tag`                                              |
  | `.deck-bezel`                         | **删除**                    | —                                                            | 使用处直接换 `.yoru-panel`                                   |
  | `.console-title / .deck-title`        | `.yoru-title`               | `--font-display`，letter-spacing 3px，不再强制 uppercase（日文假名场景） |                                                              |
  | `.console-mono / .deck-mono`          | `.yoru-mono`                | `--font-mono`                                                |                                                              |
  | `.console-readout / .deck-readout`    | `.yoru-readout`             | `--font-mono` + tabular-nums + `--accent-2` 文字，去 text-shadow |                                                              |
  | `.console-shell / .console-wallpaper` | `.yoru-shell / .yoru-stars` | 壳层 + 星尘背景（见 9.2）                                    | 竖条纹壁纸删除                                               |
  | `body::after` 扫描线                  | **删除**                    | —                                                            |                                                              |

  ### 3.3 迁移兼容策略（三步走）

  1. **Phase 1（别名期）**：`surfaces.css` 中新类落地的同时，保留旧类名作为别名（`.deck-chassis { /* 同 .yoru-panel */ }` 通过共享 `@apply`/选择器组实现），保证 TSX 未改完前页面不裂。
  2. **Phase 2（替换期）**：全仓 codemod 替换类名（`rg -l 'deck-|console-' src | xargs sed`，逐文件 review），同步替换 `text-[color:var(--phosphor-primary)]` 这类内联 token 引用为新语义变量。
  3. **Phase 3（清理期）**：删除别名与全部旧变量，CI 加 lint 规则：`stylelint` + 自定义正则检查，命中 `deck-|chassis|phosphor|telltale|tape-pink` 即失败；同时禁裸色值（`color-no-hex` 白名单仅 `tokens.css`）。

  ### 3.4 Tailwind 对接

  - `components.json` 保持 shadcn new-york + cssVariables 不变；`tailwind.config` 中把 `borderRadius`、`fontFamily` 指到新变量。
  - TSX 中颜色一律 `text-[color:var(--text-mute)]` 形式或封装后的语义 class，不新增 Tailwind palette 色。

  ------

  ## 4. 布局骨架改造

  ### 4.1 全局壳层（`Layout.tsx`）

  ```
  ┌──────────────────────────────────────────────────────────┐
  │ TopBar：Logo YORU_FM ｜ ON AIR ｜ (spacer) ｜ 时钟 ｜ 任务 ｜ 主题 │
  ├───────────┬──────────────────────────────────────────────┤
  │ Sidebar   │  <Outlet/>  各 screen                         │
  │ 频道式导航 │                                              │
  ├───────────┴──────────────────────────────────────────────┤
  │ RadioDock：正在播放 ｜ 调谐器(波形+频率刻度) ｜ 控制键        │
  └──────────────────────────────────────────────────────────┘
  ```

  改动点：

  1. `body` 增加原型的双径向渐变背景（用 `--bg-gradient-a/b`），`padding-bottom` 由 RadioDock 高度接管（`padding-bottom: calc(88px + env(safe-area-inset-bottom))`，仅在有播放会话时生效，见 5.10）。

  2. `.yoru-stars` 星尘层挂在壳层最底（实现见 9.2）。

  3. **Sidebar 重述为「频道列表」**：保留现有折叠逻辑（`4.75rem / 16.25rem`）与三列移动端网格；导航项由 `deck-plate` 换 `.yoru-plate`，active 态改为左侧 3px 粉色竖条 + `--accent` 文字 + 弱粉辉光（替代现有粉描边整框）；图标托底的 `deck-screen` 小方块改为 `--accent-2-soft` 圆角块。顶部 「ASMRoner / Command Deck」文案改为 「YORU_FM / 深夜下载电台」，折叠态字母徽标 `A` 改 `♪`（用 Phosphor `MusicNote`）。

  4. DeckStatusBar → TopBar（文件重命名 `TopBar.tsx`，导出名同步）

     ：

     - 左侧 Logo：`YORU` 白 + `_FM` 粉（`--accent`，带弱辉光），`--font-display`。
     - 新增 **ON AIR 徽章**（琥珀描边胶囊 + 呼吸灯圆点）：状态与服务健康联动——`online → 深夜放送中 ON AIR`（琥珀）、`checking → 调谐中 TUNING`（青，灯常亮）、`offline → 停播 OFF AIR`（灰，灯灭）。替代现有 `API OK/CHECK/OFF` Badge，`serviceBadgeVariant/Label` 两个函数改写。
     - 新增时钟（`--font-mono`，秒级，`<768px` 隐藏；实现放 `useClock` hook，`setInterval` 1s，卸载清理）。
     - 「进行中 N」按钮保留，样式换 `.yoru-plate`，徽标数字用粉色 pill（对应原型 `.badge`）。
     - ThemeSwitch：滑块改为粉色圆点 + `--glow-sakura`，选项文案 `CRT/PANEL/AUTO → NIGHT/DAWN/AUTO`（value 仍为 `dark/light/system`，不动持久化逻辑）。

  ### 4.2 响应式断点约定

  沿用 Tailwind 默认断点。关键行为：

  | 断点       | 行为                                                         |
  | ---------- | ------------------------------------------------------------ |
  | `<640px`   | TopBar 时钟隐藏；RadioDock 折叠为单行迷你条（见 5.10）；卡片网格 1 列 |
  | `640–1024` | 卡片网格 2 列；Sidebar 保持现有移动端三列 tab 形态           |
  | `≥1024`    | Sidebar 侧栏形态；Discover 右侧栏 sticky                     |
  | `≥1280`    | 卡片网格 3–4 列（`auto-fill, minmax(250px, 1fr)`）           |

  ------

  ## 5. 组件级改造清单

  每项含：现状 → 目标 → 改动点 → 验收标准。组件 variant 名**全部保留**，仅重定义视觉，避免业务页面改 props。

  ### 5.1 Button（`components/ui/button.tsx` + surfaces 样式）

  - 现状：琥珀亚克力 primary / 灰板 secondary / ghost / 红 danger，方角、内凹阴影、busy 态扫描线。
  - 目标：
    - `primary`：粉渐变胶囊 `linear-gradient(135deg, var(--accent), var(--p-sakura-300))`，文字 `--btn-ink`，`--radius-ctl`（成对出现在搜索/主 CTA 时可用 pill），hover `translateY(-1px)` + 辉光增强。
    - `secondary`：透明底 + `--line` 描边，hover 粉描边粉字（原型 `.nav-btn`）。
    - `ghost`：无边框，hover `--accent-2-soft` 底 + `--accent-2` 字。
    - `danger`：`--danger` 描边 + 文字，实心仅用于确认弹窗主按钮。
    - `busy` 态：去掉扫描线伪元素，改为按钮内左侧 Phosphor `CircleNotch` 旋转 + 文案不变，禁用点击。
  - 改动点：重写 `.deck-button-*` 为 `.yoru-button-*`；删除 `data-busy` 的两个伪元素块；`size` 尺寸表不变（触控目标见 8.3）。
  - 验收：四个 variant 在 Settings 保存条、Queue 操作区、Discover 分页处逐一目检；busy 态在慢网下不跳动。

  ### 5.2 Badge（`components/ui/badge.tsx`）

  variant 语义重映射（名称不变）：

  | variant  | 旧视觉     | 新视觉                                                       |
  | -------- | ---------- | ------------------------------------------------------------ |
  | `decal`  | 磁带标签   | `.yoru-tag` 青字弱底（RJ 号等元数据）                        |
  | `live`   | 粉描边 REC | 琥珀 ON AIR 样式：琥珀描边胶囊 + 呼吸灯点（播放中/直播语义） |
  | `signal` | 磷光绿     | `--success` 字 + 弱底（成功/正常）                           |
  | `warn`   | 琥珀       | `--onair` 字 + 弱底（等待/未保存）                           |
  | `halt`   | 红         | `--danger` 字 + 弱底（失败/离线）                            |
  | `mute`   | 灰         | `--text-mute` 字 + `--line` 描边                             |

  验收：Queue 任务状态、Library `CC READY/NO CC`、Settings 保存状态、TopBar 服务状态四处颜色语义正确且互相可区分。

  ### 5.3 Input / Select / Textarea

  - 现状：CLI 输入舱 + TX 焦点指示。
  - 目标：`.yoru-plate` 底 + `--radius-ctl`；focus 态 `border-color: rgba(255,126,200,.55)` + `box-shadow: 0 0 0 3px var(--accent-soft)`（原型搜索框 focus 效果泛化为全站输入规范）；placeholder `--text-mute`。
  - 特例——**Discover 主搜索框**：升级为原型同款 pill 搜索条：左侧 `RJ>` 前缀（`--font-mono`、`--accent-2`）、右侧粉渐变「检索」按钮内嵌。前缀为纯装饰 `aria-hidden`，input 的 `aria-label="搜索作品"` 保留。
  - 验收：键盘 Tab 走查全部表单，focus 环可见；IME 输入中文不被样式截断。

  ### 5.4 Chips（筛选标签，Discover 新增样式类 `.yoru-chip`）

  - 原型 `.chip`：pill、`--line` 描边、`--text-mute` 字；active/hover 青字青描边青弱底。
  - 落点：Discover 的标签快捷筛选（对接现有 `FacetCard` 的 tag 点击逻辑，或在搜索框下新增一行常用标签，数据源用现有 facets 接口的高频 tag，取前 8 个）。
  - 验收：active 态与 hover 态可区分（active 额外加青底）；键盘可聚焦、Enter 触发。

  ### 5.5 Card / 作品卡片（`components/ui/card.tsx` + Discover/Library 卡片）

  - 目标结构对齐原型

    ```
    .card
    ```

    ：

    - 容器：`.yoru-panel`，hover `translateY(-4px)` + 粉描边 + `--shadow-card`。
    - 封面区 `aspect-ratio: 4/3`：有封面图用 `<img loading="lazy">`；无封面时用 6 组预设渐变（原型 `c1–c6`，按 RJ 号尾数取模分配，保证同一作品颜色稳定）+ 单个假名/首字大字（`--font-display`）。
    - 角标：左上 RJ 号（`.yoru-mono` + 青描边小胶囊 + 磨砂底）、右下时长。
    - 卡体：两行截断标题（`min-height` 锁 2 行防抖动）、CV 行（粉色）、tag 行（`.yoru-tag`）、操作行（下载主按钮 + 试听/收藏 icon 按钮）。
    - **下载按钮进度态**：复用原型交互——点击后按钮内部青色进度层推进，完成态变 `✓ 已下载`（青字弱底）。进度数据接真实任务进度（Queue 的任务轮询已有），不用原型的假随机数；无进度事件时显示不确定态流光。
    - `foil` prop（Library 详情卡当前使用）：保留 prop，效果改为静态粉→青细渐变描边（`border-image` 或双层背景实现），无动画。

  - 验收：3 列网格下标题两行对齐；封面图加载失败回落到渐变底；下载按钮三态（默认/进行/完成）可复现。

  ### 5.6 下载队列抽屉（Queue 快捷入口，新组件 `QueueDrawer.tsx`）

  - 现状：仅有 Queue 页面 + TopBar「进行中 N」跳转。
  - 目标：TopBar「下载队列」按钮改为唤起右侧抽屉（原型 `.drawer`）：`min(380px, 92vw)`，`--surface-solid` 92% 不透明 + `--blur-dock`，`--ease-out` 350ms 滑入；遮罩点击/`Esc` 关闭；内部渲染进行中任务列表（复用 Queue 的任务查询 hook，item = 标题 + 流光进度条 + `.yoru-mono` 元信息行「RJ 号 · 格式 | 百分比 · 速率」）；底部「前往任务中心」链接到 `/queue`。
  - 无进行中任务时显示空状态（见 5.9）。
  - 可访问性：`role="dialog"` + `aria-label="下载队列"`，焦点圈闭（focus trap，开启时焦点入抽屉、关闭时还给触发按钮）。
  - 验收：抽屉开启时页面滚动锁定；任务进度实时刷新；键盘全流程可操作。

  ### 5.7 Progress（进度条）

  - 现状：磁带卷轴 + 磁带轨。
  - 目标：pill 轨道 `rgba(255,255,255,.08)` + 填充 `linear-gradient(90deg, var(--accent), var(--accent-2))`；运行中叠加流光动画（2.4 规范）；完成态纯青、失败态 `--danger`。卷轴 SVG/DOM 全部删除。
  - 落点：Queue 任务行、任务详情面板、QueueDrawer、卡片下载按钮内部进度层（同一 CSS 实现，两种容器）。
  - 验收：0%/进行中/100%/失败四态截图对比；`reduced-motion` 下流光静止但进度仍可读。

  ### 5.8 Dialog（`ActionReviewDialog` / `ConnectionEditorDialog`）

  - 容器换 `.yoru-panel`（弹窗允许一处 backdrop-filter），标题用 `.yoru-title`；确认行按钮遵循 5.1；警示文案行用 `--onair`。逻辑零改动。
  - 验收：Discover「确认创建搜索结果下载」与 Settings「确认保存连接信息」两处走查。

  ### 5.9 EmptyState

  - 现状：广播测试图。
  - 目标：「深夜静波」空状态——居中月亮/音符 Phosphor 图标（`MoonStars`，青色弱辉光）+ `.yoru-title` 短标题 + `--text-mute` 说明；文案按 frontend 文案规范改为「指路型」，如 Library 空：「频道里还没有节目 / 去搜索作品页把喜欢的作品收进来，这里就会亮起来。」保留 `symbol/title/description` props。
  - 验收：Library 空、Queue 空、Drawer 空三处。

  ### 5.10 播放器：AudioDeck → RadioDock（本次重构的签名件，工作量最大项）

  - 现状：`AudioDeck.tsx`（chassis 卡片内嵌 canvas 波形 + seek + 控制键 + 字幕面板）、`GlobalPlayer` provider、右下角 `audio-dock-shell` 迷你 dock。canvas 颜色硬编码 `#ff3d7f / #7cffb2 / rgba(5,8,7,.24)`。

  - 目标：拆成两个形态，共用同一

    ```
    GlobalPlayer
    ```

     会话（provider 逻辑与

    ```
    GlobalPlayer.test.tsx
    ```

     的会话保持行为

    不变

    ）：

    1. RadioDock（全局底栏，替代右下角 dock）

       ：固定底部通栏，三栏网格

       ```
       auto 1fr auto
       ```

       （原型

       ```
       .radio-inner
       ```

       ）：

       - 左：迷你封面（48px，渐变兜底）+ 标题单行滚动截断 + 台标行 `88.8MHz · YORU_FM`（`--font-mono`、琥珀）。
       - 中：**调谐器** = canvas 波形（保留 AnalyserNode 频谱方案，绘制颜色改为运行时 `getComputedStyle(document.documentElement).getPropertyValue('--accent'/'--accent-2')` 读取，主题切换时重取；每 3 根一根青色，其余粉色；暂停时条高压至 25% 静止）+ 波形下方频率刻度行（起点 `00:00`、终点总时长、当前位置 `▲ mm:ss` 青色高亮，虚线上边框）。**波形区即 seek 区**：保留现有 `<input type="range">` 语义（视觉透明叠加在波形上，thumb 隐藏、focus 时显示细粉游标线），拖拽/键盘左右键 seek 行为与现有 `beginSeek/previewSeek/finishSeek` 一致。
       - 右：上一首 / 播放暂停（48px 粉渐变圆钮 + 辉光）/ 下一首；`≥1024px` 额外露出循环与音量。
       - `<640px`：折叠为两行（原型 `@media 760px` 方案）：第一行封面+标题+播放键，第二行调谐器通栏。
       - 无播放会话时 RadioDock 不渲染（页面 `padding-bottom` 同步移除），避免常驻空栏。

    2. **详情播放卡（Library 右栏内嵌形态）**：保留 AudioDeck 卡片形态，外壳换 `.yoru-panel`，`REC/PAUSE` Badge 改 `live` 新样式（`ON AIR / 待机`），字幕面板容器换 `.yoru-glass`，播放列表行换 `.yoru-plate`（active 行粉左条）。

  - `audio-seek` 滑块样式：轨道换 pill + 粉青渐变已播放段，thumb 圆点粉描边。

  - 验收：播放/暂停联动波形；主题切换后 canvas 颜色随之变化；路由切换会话不断（现有测试通过）；移动端两行布局不遮挡内容；`reduced-motion` 下波形以静态条形图呈现当前音量快照。

  ### 5.11 其余小组件

  | 组件                           | 改动                                                         |
  | ------------------------------ | ------------------------------------------------------------ |
  | `FacetCard`（Discover 右栏）   | 容器 `.yoru-panel`；`variant="decal/signal/live"` 分别映射青/绿/粉标签色；项 hover 粉字 |
  | `MiniStat`（Library 详情）     | `.yoru-glass` 小块，数值 `.yoru-readout`，label `.yoru-mono` 小字 |
  | `CodeBlock`（Queue 原始 JSON） | `--p-night-900` 实底 + `.yoru-mono`，不做玻璃（可读性优先）  |
  | `TaskSummaryPanel` / `Summary` | `.yoru-glass` + 键 `--text-mute` 值 `--text-body`            |
  | `FormSection`（Settings）      | 标题 `.yoru-title` 小号 + 底部 `--line` 分隔渐变线（原型 `.section-head::after`） |
  | 滚动条                         | thumb 改 `linear-gradient(180deg, var(--accent), var(--accent-2))`，track 透明 |
  | `::selection`                  | `--accent` 底 + `--btn-ink` 字                               |

  ------

  ## 6. 页面级改造

  通用：每页顶部加「分区标题」组件 `SectionHead`（原型 `.section-head`：display 字体英文标题 + `--text-mute` 中文小字 + 渐变分隔线），四页统一使用。

  ### 6.1 Discover（搜索作品）

  1. 顶部 Hero 化：kicker「MIDNIGHT ASMR ARCHIVE」（青色 display 小字）+ 主标题（"今晚，想让谁的声音陪你入睡？"式文案，"谁的声音"粉色）+ pill 搜索框（5.3 特例）+ chips 行（5.4）。高级语法/工具面板（`showTools`、count 设置等）折叠入搜索框右侧「调谐」图标按钮展开的 `.yoru-panel`，现有表单逻辑不动。
  2. 结果区标题 `NEW ARRIVAL / 检索结果`；卡片按 5.5；分页条 `.yoru-plate`。
  3. 右栏三个 FacetCard + WorkDetailCard 按 5.11/5.5；sticky 行为保留。
  4. 批量下载确认弹窗按 5.8。

  ### 6.2 Library（本地媒体库）

  1. 列表卡片对齐 5.5（含 `CC READY/NO CC` 徽章新色）。
  2. 右栏「播放器与作品详情」按 5.10-2 详情播放卡；PLAYLIST 标签改 `.yoru-tag`。
  3. 空状态按 5.9。

  ### 6.3 Queue（任务中心）

  1. 任务列表行 `.yoru-plate`，状态 Badge 按 5.2，进度按 5.7。
  2. 任务详情面板：Summary 网格、参数/结果摘要、失败原因块（`--danger` 弱底 + 描边）、CodeBlock、日志区按 5.11。
  3. `taskGuidance` 引导文案全部保留，仅容器换肤。

  ### 6.4 Settings（设置）

  1. 分节导航（activeSection 切换）改 chips 形态（5.4）。
  2. 表单区 FormSection 按 5.11；底部 sticky 保存条换 `.yoru-panel`（不透明度提到 .88 保证浮层可读），Badge/按钮语义不变。
  3. 连接信息编辑与确认弹窗按 5.8。

  ------

  ## 7. 主题与模式

  - `data-theme` 挂 `<html>`：缺省（暗）= NIGHT；`data-theme="dawn"` = DAWN（浅色「晨间档」）；AUTO 跟 `prefers-color-scheme`。持久化沿用现有 ThemeMode 存储逻辑，仅改映射与文案。
  - DAWN 主题只在语义层重映射（2.1.2 表），星尘层在 DAWN 下隐藏，页面渐变改为薰衣草极浅色。**Phase 4 才做 DAWN 视觉细调；Phase 1–3 期间 DAWN 先以表中初值上线并标注 beta。**
  - 验收：两主题 × 四页面 × RadioDock 共 10 组截图，检查 8.1 对比度表全部达标。

  ------

  ## 8. 可访问性硬性要求

  ### 8.1 对比度检查表（WCAG AA）

  上线前用 axe/Polypane 逐项实测，未达标者调整语义层取值（调整只许发生在 `tokens.css`）：

  | 前景 → 背景                                                  | 要求                                                       |
  | ------------------------------------------------------------ | ---------------------------------------------------------- |
  | `--text-body` → `--bg-base` / `--surface-glass` 叠加后实效底色 | ≥ 4.5:1                                                    |
  | `--text-mute` → 同上                                         | ≥ 4.5:1（正文尺寸使用时）；仅 18px+ 或粗体场景可放宽至 3:1 |
  | `--accent` / `--accent-2` / `--onair` 作为文字 → 各表面      | ≥ 4.5:1                                                    |
  | `--btn-ink` → 粉渐变按钮                                     | ≥ 4.5:1                                                    |
  | DAWN 主题全部同项                                            | 同上（特别注意 aqua/amber 在浅底上必须使用表中加深值）     |
  | 焦点环 → 相邻色                                              | ≥ 3:1                                                      |

  已知风险点：`--text-mute #7d75a8` 在玻璃面板上偏弱，若实测不达标，暗色下提亮至 `#8b83b8` 并回写本表。

  ### 8.2 键盘与语义

  - 全局 `:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }`，禁止任何组件 `outline: none` 不给替代。
  - 抽屉/弹窗焦点圈闭 + `Esc` 关闭 + 焦点归还触发器。
  - ON AIR、呼吸灯、波形均为装饰，`aria-hidden="true"`；播放状态用现有按钮 `aria-label` 表达。
  - 卡片操作按钮（试听/收藏/下载）都有 `aria-label`；下载进度用 `aria-live="polite"` 播报完成。

  ### 8.3 触控与移动端

  - 交互目标 ≥ 44×44px（chips 视觉可小，命中区用 padding 补足）。
  - RadioDock 与系统手势条之间留 `env(safe-area-inset-bottom)`。

  ------

  ## 9. 性能预算与实现细则

  ### 9.1 backdrop-filter 配额

  `backdrop-filter` 逐层合成开销大，规定同屏上限：**常驻 ≤ 3 处**（TopBar 1 + RadioDock 1 + 至多 1 个 sticky 面板）；卡片网格**不使用** backdrop-filter，卡片玻璃感用「半透明底色 + 页面渐变透出」模拟（视觉差异极小，滚动性能差异巨大）；抽屉/弹窗打开时临时 +1。

  ### 9.2 星尘背景

  不采用原型的 70 个 DOM 节点方案。实现为**单个全屏 `<canvas>`**（`.yoru-stars`，`position: fixed; z-index:-1; pointer-events:none`）：一次绘制约 70 个静态点 + 每帧仅更新其中 12 个「闪烁点」的 alpha（`requestAnimationFrame` 节流至 15fps）；页面不可见（`visibilitychange`）与 `reduced-motion` 时停帧；DAWN 主题不渲染。封装为 `StarField.tsx`，挂 Layout。

  ### 9.3 其他

  - 字体：@fontsource 按 unicode-range 分包，首屏仅加载 latin 子集；`font-display: swap`；对 Zen Kaku 设置 `size-adjust` 匹配回退字体，控制 CLS。
  - 波形 canvas：沿用现有 `fftSize=128`；标签页隐藏时 `cancelAnimationFrame`（现有实现如未处理需补上）。
  - 卡片 hover 只动 `transform/box-shadow/border-color`（合成器友好），不触发 layout。
  - 渐变封面为纯 CSS，不生成图片资源。

  ------

  ## 10. 实施计划（分阶段）

  > 估算按 1 名前端全职计，含自测；期间主干可随时发布（别名策略保证中间态不裂）。

  | 阶段                | 内容                                                         | 涉及文件                                                     | 产出/验收                                                    | 估时 |
  | ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ | ---- |
  | **P0 准备**         | 建立 `tokens.css/fonts.css` 拆分骨架；引入 @fontsource 三字体；stylelint 规则（先 warn） | `styles/*`、`package.json`、lint 配置                        | 构建通过；字体在四页正确渲染                                 | 1 天 |
  | **P1 Token 与表面** | 2.1–2.4 全量 token 落地；`surfaces.css/widgets.css` 新类 + 旧类别名；删除扫描线/壁纸/铆钉伪元素；背景渐变 + StarField | `styles/*`、`Layout.tsx`、新 `StarField.tsx`                 | 全站底色/字体/面板换肤完成（旧类名仍在 TSX 中）；截图对比    | 2 天 |
  | **P2 基础组件**     | Button/Badge/Input/Progress/EmptyState/Dialog/滚动条/selection 按第 5 节重做；canvas 颜色改读变量 | `components/ui/*`、`AudioDeck.tsx`（仅取色）、`styles/widgets.css` | 组件 Storybook/页面走查四态齐全；vitest 全绿                 | 3 天 |
  | **P3 壳层与签名件** | TopBar（Logo/ON AIR/时钟/主题开关）、Sidebar 频道化、RadioDock 全量（含移动端折叠、调谐器 seek）、QueueDrawer | `TopBar.tsx`（原 DeckStatusBar）、`Layout.tsx`、`AudioDeck.tsx` 拆分、新 `RadioDock.tsx`、`QueueDrawer.tsx`、新 `useClock.ts` | 5.10/5.6 验收项全过；`GlobalPlayer.test.tsx` 不改断言直接通过 | 4 天 |
  | **P4 页面精修**     | 四页面按第 6 节逐页调整（Hero、chips、卡片、SectionHead、详情卡） | `routes/screens/*`、新 `SectionHead.tsx`、`WorkCard` 抽取    | 每页对照原型截图评审；类名 codemod 完成                      | 4 天 |
  | **P5 清理与双主题** | 删除旧类别名与旧变量；stylelint 转 error；DAWN 主题细调（7 节）；对比度实测（8.1 表）并回写 token | `styles/*`、`docs/style-system.md` 重写                      | lint 零违例；10 组主题截图归档；8.1 全达标                   | 2 天 |
  | **P6 验收与回归**   | 第 11 节 checklist 全量执行；性能采样（滚动帧率、LCP/CLS）；修尾巴 | —                                                            | 验收单签署                                                   | 2 天 |

  合计约 **18 人日**。P3 是关键路径（签名件），可与 P4 部分并行（两人时压缩至 ~12 天）。

  ### 10.1 文件改动总清单

  | 类型      | 文件                                                         |
  | --------- | ------------------------------------------------------------ |
  | 重写      | `src/styles/index.css`（拆为 6 个文件）、`docs/style-system.md` |
  | 重命名+改 | `components/DeckStatusBar.tsx → TopBar.tsx`                  |
  | 新增      | `components/StarField.tsx`、`components/RadioDock.tsx`、`components/QueueDrawer.tsx`、`components/SectionHead.tsx`、`hooks/useClock.ts` |
  | 修改      | `components/Layout.tsx`、`components/AudioDeck.tsx`、`components/ui/{button,badge,input,card,progress,dialog,...}.tsx`、`components/{EmptyState,FacetCard,MiniStat,CodeBlock,TaskSummaryPanel,FormSection}.tsx`、`routes/screens/{Discover,Library,Queue,Settings}.tsx`、`tailwind.config`、`package.json` |
  | 不动      | 数据层 hooks、路由定义、`GlobalPlayer` provider 逻辑、后端契约 |

  ------

  ## 11. 测试与验收

  1. **单测**：现有 vitest 全量通过；`GlobalPlayer.test.tsx` 断言不修改（会话保持是硬约束）；为 QueueDrawer 新增开合/焦点圈闭测试；为 Badge variant 映射新增快照。

  2. **视觉回归**：P1 起每阶段对四页 + RadioDock 截图（1440/768/375 三宽度 × 双主题）入库对比。

  3. 手测清单

     （P6 执行）：

     - 键盘全站走查（Tab 顺序、焦点可见、Esc 关抽屉/弹窗）。
     - `prefers-reduced-motion` 开启：无任何循环动画。
     - 慢网：字体 swap 无明显 CLS；封面懒加载；下载进度态正确。
     - iOS Safari / Android Chrome：safe-area、RadioDock 折叠、backdrop 兼容（`-webkit-backdrop-filter` 前缀）。
     - 主题三档切换即时生效，canvas 波形颜色跟随。

  4. **性能门槛**：卡片网格滚动 ≥ 55fps（中端机）；LCP 不劣于现版本；CLS < 0.1。

  ------

  ## 12. 风险与回滚

  | 风险                                              | 缓解                                                         |
  | ------------------------------------------------- | ------------------------------------------------------------ |
  | DotGothic16/Zen Kaku 中文覆盖不全导致标题混排难看 | 标题文案以拉丁/假名为主；必要时 display 层仅用于英文，中文小字走 body 字体（SectionHead 已按此设计） |
  | backdrop-filter 在低端设备掉帧                    | 9.1 配额 + 卡片不用真模糊；提供 `data-perf="low"` 降级开关（关闭全部 blur 与星尘） |
  | `--text-mute` 玻璃底对比度不足                    | 8.1 已预置提亮方案，只改 token 单点                          |
  | 类名全量替换引入回归                              | 别名期 + 分文件 codemod review + 视觉回归截图                |
  | RadioDock 与旧右下角 dock 并存期冲突              | P3 内一次性切换，feature flag `yoru_radio_dock` 控制，异常可秒切回旧 dock |
  | 回滚                                              | 每阶段独立 PR + tag；P2 前回滚 = revert 样式包；P3 后回滚靠 feature flag + 保留旧 dock 代码至 P6 验收后删除 |

  ------

  ## 附录 A：新体系速查（重构后 style-system.md 的骨架）

  - Tokens：`--p-*` 色板层只在 tokens.css 内部引用；组件只用语义层（`--bg-* / --surface-* / --line* / --text-* / --accent* / --onair / --danger / --success / --glow-* / --shadow-*`）。
  - Surfaces：`.yoru-panel`（玻璃面板）/ `.yoru-glass`（内嵌块）/ `.yoru-plate`（控件托底）/ `.yoru-tag`（元数据标签）/ `.yoru-title` / `.yoru-mono` / `.yoru-readout`。
  - 签名件：RadioDock（调谐器 + 频率刻度 + ON AIR），全站唯一允许"表演性动画"聚集处。
  - Anti-patterns：不得重新引入扫描线/CRT/铆钉/磁带卷轴；不得裸写色值；卡片不得使用 backdrop-filter；循环动画必须响应 reduced-motion；emoji 不得作为图标。
