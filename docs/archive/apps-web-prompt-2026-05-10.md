# ASMRoner Web — Retro-Futurism Refinement Brief

> 目标读者：未来接手 `apps/web` 视觉打磨的 AI 代理（Claude）或人类开发者。
> 文件类型：**指令型 prompt + 设计规范**。读完后应能直接落代码，不需要额外询问方向。

---

## 0. 这份文件要解决什么

当前 `apps/web` 自称"复古未来主义"（Retro-Futurism），实际渲染出来更像
"shadcn 玻璃拟态后台 + 一层扫描线滤镜"。问题不在于做得不好，而是 **方向没有
咬合**：

- `sweet-*`（甜系吉祥物）样式与 `console-*`（任务控制台）样式并存，互相稀释
- 浅色主题没有复古锚点（沙绿土褐让人想到图书馆，不是未来机舱）
- 紫 / 蓝 / 玫瑰 / 翠绿 / 琥珀 五个同权重强调色，没有主次
- `rounded-lg` + `backdrop-blur-xl` 是 2024 年 SaaS 模板的默认手感
- 项目核心是 ASMR 音频，但播放器是浏览器原生 `<audio controls>`
- 有"MARK 吉祥物"承诺却 `display:none`、有 `beam-border` 但全屏永久播放
- 装了 `@phosphor-icons/react` 却没用、装了 `framer-motion` 只用于 fade-up

**这份 prompt 给出一条单一、明确、不打折的复古未来主义方向，并把现有代币、
组件、屏幕逐一改造成那个方向。**

---

## 1. 单一美学锚点：Sonic Mission Control

> 不再叫 "retro-future" 这种宽口号。用一个具体场景钉死它：
> **"1986 年东京 NHK 卫星广播间隔壁的助眠节目录音控制台"**。

混合三个物理参考：

1. **阿波罗时代任务控制台**：黑磷光屏 + 琥珀指示灯 + 雕刻金属铭牌 + 工程紧固件
2. **80 年代专业录音棚机架**：哑光金属拉丝、推子、VU 表头、磁带卷轴 LED
3. **90 年代 ASMR 周边器物**：胶卷盒、耳机线材、磁带贴标、迷你旋钮

得到的画面：**深石墨机壳上嵌入一块仍在发光的 CRT 显示器，旁边贴着一张 90 年代
日式磁带贴标（粉色油墨打印的型号），按键是工业级琥珀亚克力，运行中的任务在屏幕
里像磁带卷轴一样转动。**

> 凡是与这个画面无关的视觉元素，**全部砍掉**。Glassmorphism、purple gradients、
> generic SaaS card lift——不属于这个画面。

### 1.1 一句话差异化

> "别人做的是后台，ASMRoner 做的是一台**仍在通电的器物**。"
> 当用户离开标签页 5 分钟回来，画面应该像它在没人看的时候也仍在自己运行。

---

## 2. 现状诊断（按严重度分级）

### 🔴 P0 — 立刻处理（破坏方向感的根本问题）

1. **双品牌并存**：`sweet-*` 和 `console-*` 两套 CSS 类、两套按钮、两套 shell
   并存于 `src/styles/index.css:198-345`。**统一到 `console-*`**，删除所有
   `sweet-*` 别名（包括 `sweet-shell`、`sweet-wallpaper`、`sweet-button-*`、
   `sweet-card-interactive`、`sweet-empty-state`、`sweet-empty-bubble`）。
2. **MARK 吉祥物**：`ProgressTrack` 接受 `mascot="MARK"` 但渲染时 `display:none`
   （`index.css:408-410`）。**要么真的画一个磁带卷轴小图标随进度滚动，要么删掉
   这个 prop**。当前是空头支票。
3. **浅色主题没有复古锚点**：`--bg: #d9d2bd` / `--bg-deep: #c7bea6` 是图书馆/
   羊皮纸色。Mission Control 的"白天版"应该是 **米色塑料外壳 + 哑光石墨面板 +
   琥珀印刷标签**（参考 Apple IIc / TEAC 录音机机壳），不是沙漠绿。
4. **`<audio controls>` 暴露浏览器原生组件**（`Library.tsx:281-300`）。
   一个 ASMR 工具的播放器是产品门面，必须自己做。
5. **`backdrop-blur-xl` + `rounded-lg` 出现在每一个 surface 上**。这是当代
   shadcn 的默认手感，与控制台机壳金属感冲突。**所有"机壳"层都改成
   `rounded-sm`（2-4px）+ 实色背景 + 内嵌阴影**，仅"屏幕"层保留半透明效果。

### 🟠 P1 — 视觉骨架问题

6. 五个强调色（mint / pink / violet / blue / gold）地位平等，**没有主色**。
7. **`beam-border` 全屏永久播放**：装饰特效用成了背景噪音。它应该只在"激活/正在
   运行"的面板上出现，作为信号而不是壁纸。
8. **扫描线 alpha 太低**（0.08），实际看不见——索性放大到能看见的强度，并加上
   极轻微的 RGB 通道偏移制造 CRT chromatic aberration。
9. **Lucide 描边图标 + Phosphor 图标库共存**：`@phosphor-icons/react` 装着没用。
   选 Phosphor 的 `duotone` weight，更贴 CRT 美学；同时移除未用的依赖。
10. **数字读数没有 7-segment 显示器质感**：`console-readout` 只是 mono +
    `font-variant-numeric: tabular-nums`，缺少机舱仪表的灵魂。
11. **顶部固定栏和卡片用同一种 surface**：缺少层级。机壳 / 屏幕 / 标签 /
    控制板必须有视觉差。
12. **空状态、加载态都过于温和**：是泄漏复古感的两个机会窗口，目前都浪费了。
13. **每个卡片的进入动效都是相同的 fade-up**：mass-produced 感强；
    退化成"现代 react 站点"。

### 🟡 P2 — 细节缺失（决定"差点意思"的根因）

14. 没有底部状态条（uptime / time code / packet count / mode）
15. 没有刻意的"非功能装饰"：型号、版本号、警告条纹、端口符号、串口号
16. 没有 grain / noise（CRT 表面应该有极轻微的胶片颗粒）
17. 没有 vignette（屏幕四角应该轻微变暗）
18. 没有屏幕弯曲（即使是 1px 的 pseudo curve 也大不一样）
19. 输入框只是 rounded-md：缺少机柜推子 / CLI 指针 / 回声指示器
20. Visualizer 永远在跳动：没有跟实际信号（活跃任务数、下载吞吐）挂钩——它在
    撒谎，而美学最忌讳"装样子"
21. 没有持续走动的小元件（tape reel 旋转、奇偶帧计数器、采样率读数）让画面
    "在自己运行"
22. 没有"单元化"地板：所有屏幕都用 max-width 1420px 居中，缺少机舱式不对称布局

---

## 3. 设计代币（Design Tokens）

> 全量替换 `src/styles/index.css` 顶部 `:root` 与 `[data-theme="dark"]` 块。

### 3.1 颜色

#### 暗色（`data-theme="dark"`，主战场，95% 时间在用）

```css
/* === Chassis 机壳层（最外） === */
--chassis-base: #0b0e0c;          /* 哑光石墨黑 */
--chassis-raise: #161a17;          /* 略亮的金属拉丝表层 */
--chassis-edge: #2a3029;           /* 倒角 / bezel 高光 */
--chassis-rivet: #4d5650;          /* 螺丝 / 铆钉 */

/* === Screen 屏幕层（嵌在机壳里） === */
--screen-void: #050807;            /* CRT 关机黑 */
--screen-deep: #07120d;            /* phosphor 残影底色 */
--screen-grid: rgba(120, 220, 160, 0.06);

/* === Phosphor 信号色 === */
--phosphor-primary: #7cffb2;       /* 主磷光绿（CRT 文本） */
--phosphor-mid: #4fcc8a;           /* 暗一档 */
--phosphor-trail: rgba(124, 255, 178, 0.18); /* 残影/拖尾 */

/* === Telltale 信号灯 === */
--telltale-amber: #f2a93b;         /* 琥珀指示灯（warn/标签强调） */
--telltale-amber-dim: #8a5a14;
--telltale-red: #ff5a3c;           /* 红色告警，仅用于 FAILED / STOP */
--telltale-cyan: #5dd3f3;          /* 青色诊断（次要数据） */

/* === Tape Pink（产品独有的"贴标"色） === */
--tape-pink: #ff3d7f;              /* 90s 磁带油墨粉 —— 仅用于：
                                       1) 当前正在播放的音轨
                                       2) "REC/LIVE" 实时状态
                                       3) ASMRoner 自己的品牌符号
                                      其他地方禁止使用 */
--tape-pink-trail: rgba(255, 61, 127, 0.14);

/* === 文字层级 === */
--text-display: #d9ffe4;           /* 超亮屏内文字 */
--text-body: #a9c9b1;              /* 正文 */
--text-mute: #6a7d6e;              /* 静音 */
--text-decal: #f2a93b;             /* 贴标文字（型号、kicker） */
```

#### 浅色（`data-theme="light"` — "白天 / 关灯"模式）

> 关键转译：浅色 ≠ 把暗色调亮，而是 **机器关电后的物理外壳颜色**。

```css
--chassis-base: #d6d2c2;           /* 米色塑料外壳（TEAC/Apple IIc） */
--chassis-raise: #ebe6d2;
--chassis-edge: #b3ad99;
--chassis-rivet: #6c685d;

--screen-void: #1a201b;            /* 关电的屏，深色但偏暖 */
--screen-deep: #21271f;
--screen-grid: rgba(40, 60, 45, 0.10);

--phosphor-primary: #1e5a3c;       /* 关机后印在屏上的"印刷"磷光绿 */
--phosphor-mid: #346d4e;
--phosphor-trail: rgba(30, 90, 60, 0.14);

--telltale-amber: #c77825;
--telltale-amber-dim: #7a4513;
--telltale-red: #b94d3c;
--telltale-cyan: #2f7791;

--tape-pink: #d92a68;              /* 浅色下加深一点保持对比 */
--tape-pink-trail: rgba(217, 42, 104, 0.10);

--text-display: #17221d;
--text-body: #35433c;
--text-mute: #6f7467;
--text-decal: #c77825;
```

#### 弃用（要从代码中删除）

```
--accent-violet, --accent-blue, --accent-mint, --accent-rose, --accent-gold
（这些"五彩 badge"全部改用上面 6 个角色色重新映射）

--bg-panel*, --panel-bg-strong（合并到 chassis-* 与 screen-*）
```

### 3.2 形状（Border Radius）

> **复古机箱 = 直角偏多、倒角点缀**。彻底放弃 `rounded-lg`（8px）作为默认。

```css
--radius-screen: 2px;     /* 屏幕开口（像 CRT 玻璃边） */
--radius-chassis: 4px;    /* 机壳面板 */
--radius-button: 3px;     /* 按键，几乎方 */
--radius-pill: 999px;     /* 仅用于真正的圆形元件（LED 灯、拨钮） */
```

**禁止使用 `rounded-md / rounded-lg / rounded-xl`**。Tailwind class 全替换。

### 3.3 间距与栅格

```css
--rhythm: 4px;            /* 所有 spacing 必须是 4 的倍数 */
--gutter-rail: 12px;      /* 控制栏内部 */
--gutter-deck: 20px;      /* 屏幕之间 */
--bezel-pad: 14px;        /* 机壳到屏幕的 bezel 内边距 */
```

### 3.4 阴影 / 内嵌

```css
/* 机壳：略带方向光的工业塑料 */
--shadow-chassis:
  inset 0 1px 0 rgba(255, 255, 255, 0.06),
  inset 0 -1px 0 rgba(0, 0, 0, 0.4),
  0 1px 0 rgba(0, 0, 0, 0.6),
  0 14px 24px rgba(0, 0, 0, 0.5);

/* 屏幕：内陷 + 磷光辉 */
--shadow-screen:
  inset 0 0 0 1px rgba(0, 0, 0, 0.6),
  inset 0 0 24px rgba(0, 0, 0, 0.7),
  inset 0 0 60px var(--phosphor-trail);

/* 琥珀指示灯：实心发光 */
--glow-amber: 0 0 12px rgba(242, 169, 59, 0.55), 0 0 2px rgba(242, 169, 59, 0.9);
--glow-phosphor: 0 0 14px rgba(124, 255, 178, 0.4);
--glow-tape: 0 0 18px rgba(255, 61, 127, 0.35);
```

---

## 4. 字体系统

> **不要用** Inter、Roboto、Arial、System Sans、Space Grotesk、Geist、JetBrains
> Mono——这六个是 2024 年 AI slop 通用字体。

### 4.1 三套字体 + 一套数字

| 角色 | 字体 | 来源 | 用途 |
|------|------|------|------|
| **Display 雕刻铭牌** | `Big Shoulders Stencil Display` | Google Fonts | 顶级标题、kicker、模块名（uppercase） |
| **Body 工程正文** | `IBM Plex Sans Condensed` + `Noto Sans SC` | Google Fonts | 中文与英文正文，500/600/700 三档权重 |
| **Mono 终端读数** | `Departure Mono` | 自托管（Helsinki Type Foundry，OFL） | CLI/日志/时间码/source_id/RJ 编号 |
| **Numeric 七段管** | `DSEG14-Classic` | 自托管（OFL） | StatCard 大数字、ProgressTrack 百分比、时间码 |

### 4.2 实施

```css
@font-face {
  font-family: "Departure Mono";
  src: url("/fonts/DepartureMono-Regular.woff2") format("woff2");
  font-display: swap;
}

@font-face {
  font-family: "DSEG14";
  src: url("/fonts/DSEG14Classic-Regular.woff2") format("woff2");
  font-display: swap;
}

:root {
  --font-display: "Big Shoulders Stencil Display", "Noto Sans SC", system-ui, sans-serif;
  --font-body: "IBM Plex Sans Condensed", "Noto Sans SC", system-ui, sans-serif;
  --font-mono: "Departure Mono", "IBM Plex Mono", ui-monospace, monospace;
  --font-segment: "DSEG14", "Departure Mono", monospace;
}
```

**自托管字体放在** `apps/web/public/fonts/`，并在 `index.html` 用 `<link rel="preload">` 预热。

### 4.3 字体规则

- Display 字体永远 **uppercase + letter-spacing 0.08em-0.16em**
- Body 字体 **不加 letter-spacing**（中文受影响）
- Mono 字体 **letter-spacing 0**，依赖等宽天然节奏；只用 mono 做"机器在说话"的
  地方（日志、source_id、命令、时间码）
- Numeric (DSEG14) **永远在屏幕层（深色背景）上展示**，并用 `--phosphor-primary`
  着色 + `--glow-phosphor` 发光；浅色主题下改用 `--phosphor-primary`（深绿印刷感）

---

## 5. 表面层级（Surface Roles）

> 这是当前代码缺失最严重的一块。每一个 DOM 元素都必须知道自己属于哪一层。

```
┌──────────────────────── chassis-base ──────────────────┐
│  ┌─ rivet  ────[ DECAL ]────────────────────[ rivet ─┐ │
│  │                                                    │ │
│  │   ┌─────────── screen-void ─────────────────┐    │ │
│  │   │                                           │    │ │
│  │   │   "phosphor text on dark"                 │    │ │
│  │   │   ┌─ inset card ──────────────────┐      │    │ │
│  │   │   │  inner readout                 │      │    │ │
│  │   │   └────────────────────────────────┘      │    │ │
│  │   └───────────────────────────────────────────┘    │ │
│  │                                                    │ │
│  │   ┌── control-plate ──┐   [ amber LED ]            │ │
│  │   │  PUSHBUTTON        │                            │ │
│  │   └────────────────────┘                            │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 5.1 五种 surface 角色 + CSS class

| 角色 | class | 视觉特征 |
|------|-------|---------|
| **Chassis** | `.deck-chassis` | 实色 `--chassis-base`，圆角 4px，`--shadow-chassis`，内带极轻 noise |
| **Bezel** | `.deck-bezel` | chassis 内边距 14px，承担"屏幕装入机壳"的边框角色 |
| **Screen** | `.deck-screen` | 实色 `--screen-void`，圆角 2px，`--shadow-screen`，内含扫描线 + 弯曲 + RGB 偏移 |
| **Plate** | `.deck-plate` | 控制按钮承载板，`--chassis-raise`，圆角 3px，inset 阴影 |
| **Decal** | `.deck-decal` | 贴标条：高 22px，单行 mono 大写文字 + 端点小三角，常带磁带粉色油墨 |

**所有现有 `console-panel` 都按以下规则二选一**：
- 是"机箱壳"的（Layout sidebar、PageHeader 容器、StatCard 整体） → `.deck-chassis`
- 是"屏幕内容区"的（CardContent 中的列表、日志、metrics） → `.deck-screen`

不允许 `.deck-screen` 嵌套 `.deck-screen`、不允许 `.deck-chassis` 嵌套
`.deck-chassis`。一定是 chassis → bezel → screen 三层关系。

### 5.2 Chassis 实现

```css
.deck-chassis {
  position: relative;
  background: var(--chassis-base);
  border-radius: var(--radius-chassis);
  box-shadow: var(--shadow-chassis);
  /* 工业塑料拉丝纹理 */
  background-image:
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 2px,
      rgba(255, 255, 255, 0.012) 3px,
      transparent 4px
    ),
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.04), transparent 60%);
}

.deck-chassis::before {
  /* 四角铆钉装饰：四个 :: 选择器实现的圆点 */
  content: "";
  position: absolute;
  inset: 6px;
  border-radius: inherit;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 0 0, var(--chassis-rivet) 0 2px, transparent 2.5px),
    radial-gradient(circle at 100% 0, var(--chassis-rivet) 0 2px, transparent 2.5px),
    radial-gradient(circle at 0 100%, var(--chassis-rivet) 0 2px, transparent 2.5px),
    radial-gradient(circle at 100% 100%, var(--chassis-rivet) 0 2px, transparent 2.5px);
}
```

### 5.3 Screen 实现（CRT）

```css
.deck-screen {
  position: relative;
  overflow: hidden;
  background: var(--screen-void);
  border-radius: var(--radius-screen);
  box-shadow: var(--shadow-screen);
  color: var(--phosphor-primary);
  font-family: var(--font-mono);
  isolation: isolate;
}

/* 扫描线 + 中央亮带 */
.deck-screen::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background:
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.18) 0,
      rgba(0, 0, 0, 0.18) 1px,
      transparent 2px,
      transparent 3px
    ),
    radial-gradient(
      ellipse at center,
      transparent 50%,
      rgba(0, 0, 0, 0.45) 100%
    );
  mix-blend-mode: multiply;
}

/* 极轻 RGB 偏移（chromatic aberration） */
.deck-screen::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  background:
    linear-gradient(
      90deg,
      rgba(255, 0, 80, 0.04) 0,
      transparent 0.5%,
      transparent 99.5%,
      rgba(0, 200, 255, 0.04) 100%
    );
  mix-blend-mode: screen;
}

/* 屏内"磷光网格"（非常细微，给视觉一个尺度感） */
.deck-screen > * {
  position: relative;
  z-index: 1;
}
```

### 5.4 Decal 贴标

```css
.deck-decal {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 22px;
  padding: 0 10px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--tape-pink);
  background: var(--tape-pink-trail);
  border: 1px dashed rgba(255, 61, 127, 0.4);
  border-radius: 0;            /* 贴标永远是直角 */
  position: relative;
}

/* 两端凿孔，像穿孔贴纸 */
.deck-decal::before,
.deck-decal::after {
  content: "";
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--chassis-base);
  box-shadow: inset 0 0 0 1px rgba(255, 61, 127, 0.4);
}
```

---

## 6. 组件改造清单

### 6.1 `Button`（`src/components/ui/button.tsx`）

**当前问题**：圆角 6px、渐变背景、看起来像 shadcn primary。

**改造方向**：**琥珀亚克力按键**——半透明琥珀色面，下方有 LED 透出。

```tsx
// 三种 variant，但视觉是按"按键尺寸"区分而不是颜色
variants:
  primary  -> 琥珀大键（KEY），用于一切创建/确认/下载动作
  secondary -> 灰塑料小键（TAB），次要动作
  ghost    -> 无壳文字（INLINE），仅在 inline 用
  danger   -> 红色蘑菇按钮（HALT），仅 STOP/取消/失败处理

视觉规范：
- height: 38 / 32 / 28px（不再是 44/36/40）
- radius: 3px
- border: 1px solid var(--chassis-edge)
- background: linear-gradient(180deg, rgba(242,169,59,.92), rgba(199,120,37,.96))
- 内嵌阴影：inset 0 1px 0 rgba(255,255,255,.35), inset 0 -2px 0 rgba(0,0,0,.45)
- 文本：var(--font-display)，uppercase，letter-spacing 0.14em
- :active 时 translateY(1px) + 内嵌阴影变浅（"按下去"）
- 不要 hover scale，要 hover brightness(1.08) + 透出 LED 增强
```

**禁止**：渐变 conic、`rounded-md`、`from-emerald-400 to-amber-400`。

### 6.2 `Card`（`src/components/ui/card.tsx`）

**当前问题**：所有卡片都是 `rounded-lg + backdrop-blur-xl + border` 的玻璃面，
hover 时 `y: -8, scale: 1.01` —— 现代 SaaS 默认手感。

**改造**：拆成 **两类卡片**：

```
ChassisCard  -> 机壳级容器，包裹一组屏幕/控件。无 hover lift。
ScreenCard   -> 屏幕级容器，里面是数据/列表。hover 时屏幕"亮一档"
                （phosphor-trail 增强 + 极轻 flicker），不位移。
```

`foil` 这个 prop 当前实际效果是 beam-border。**保留但改语义**：仅在
"任务运行中 / 焦点 / 实时数据"时启用，并把 beam 的颜色挂到 `--tape-pink`
（运行中）或 `--telltale-amber`（warning），不要默认绿。

### 6.3 `Badge`（`src/components/ui/badge.tsx`）

**当前问题**：7 种 variant 颜色平均分配。

**改造**：缩到 **5 种语义**，颜色对齐 telltale 系统：

| variant | 用途 | 颜色 |
|---------|------|------|
| `decal` | 默认 / 标签贴纸 | tape-pink trail |
| `live` | 正在运行 / 实时 | tape-pink solid + glow + 0.4Hz 闪烁 |
| `signal` | 信号 / 数值就绪 | phosphor-primary + glow |
| `warn` | 待处理 / 排队 | telltale-amber + glow |
| `halt` | 失败 / 取消 / 危险 | telltale-red + glow |

`active` prop 删除。`ghost` prop 改名为 `mute`（弱化了的 decal）。

**视觉**：
- 直角（`border-radius: 0`）
- 高度 18px，内边距 0 8px
- font: var(--font-mono)，10px，letter-spacing 0.18em
- 左侧 4px 实心方块作为"灯位"（就是真的画一个小方块在 padding-left 里），
  让它看起来像机柜面板上的指示标贴

### 6.4 `Input`（`src/components/ui/input.tsx`）

**当前问题**：常规圆角输入框，没有终端感。

**改造**：CLI Bay。

```tsx
// 容器：
- 直角 2px
- 背景 var(--screen-void)
- 内嵌阴影 var(--shadow-screen) 弱化版
- 左侧 16px 内边距画一个 phosphor-primary 的 ">"（::before）
- 右侧 12px 内边距放一个"TX"指示灯（focus 时点亮、blur 时熄灭）
- font-family: var(--font-mono)
- color: var(--phosphor-primary)
- caret-color: var(--phosphor-primary)
- placeholder 用 phosphor-mid 的 0.5 不透明度

// focus 状态：
- 容器外侧加一圈 1px tape-pink 描边（不是青色环）
- 右侧"TX"灯亮起 + glow-tape
- 内部加一个 0.5s 闪烁的方块 caret（即使原生 caret 已存在也额外画一个，
  让它在停止输入时仍然 blink）
```

### 6.5 `ProgressTrack`（`src/components/ui/sweet.tsx`）

**当前问题**：mascot 不显示、进度条像 react-loader 默认款。

**改造**：**磁带卷轴 + 录音条**。

```
[ ◯ A ]━━━━━━━━━━━━━━━━━ 47% ━━━━━━━━━━━━━━━━━[ ◯ B ]
              ───────────────►            │           │
              已转录                       │           │
                                        刻度尺      尾端

- 左侧画一个 SVG 磁带 reel（圆 + 三辐条），随进度顺时针旋转（当 status === RUNNING）
- 右侧另一个 reel，随进度反向旋转
- 中间是磁带（深棕条 + 上下两条细金线），磁带"在走"用 background-position
  的 keyframes 动画（类似 marquee）
- 进度数字用 var(--font-segment) 显示在右上角，绿色磷光发光
- 标签用 var(--font-display) uppercase
```

`mascot` prop 删除（或彻底实现成"磁带磁头位置指示"）。

### 6.6 `EmptyState`（`src/components/ui/sweet.tsx`）

**当前问题**："NO DATA" 浮在大块空白上，浪费机会。

**改造**：**广播测试卡**。

```
当 EmptyState 渲染时，背景画 SMPTE 彩条 / EBU 测试卡，
中央出现一段大 mono 文字：

   ┌─────────────────────────────────────┐
   │    █ █ █ █ █ █ █ █  TEST PATTERN    │
   │                                       │
   │              ████ STAND BY ████        │
   │                                       │
   │       NO SIGNAL ON THIS CHANNEL       │
   │       SIGNAL ID: NO-MATCH-04          │
   │                                       │
   │    [ description goes here in mono ]  │
   └─────────────────────────────────────┘

- 顶部一行 SMPTE 色带（用 linear-gradient stop 实现）
- 中央巨大 "STAND BY" 用 var(--font-display)，phosphor-primary，慢闪
- 下方副标 mono 文字
- 整体在 .deck-screen 上渲染
```

### 6.7 加载骨架

**当前问题**：`animate-pulse` 灰条。

**改造**：**TBC 缓冲条**。

```
显示一行 mono 文字: "BUFFERING . . . [▓▓▓░░░░░░░] 32%"
其中方块是 step-animation（不是平滑），数字是 jitter 的随机数字滚动到目标值。
配色：phosphor-primary on screen-void。
```

### 6.8 主题切换器

**当前问题**：CRT / PANEL / AUTO 三键 toggle 是普通胶囊按钮。

**改造**：**机壳上的硬件三档拨钮**——一个真的物理 toggle switch，
用 SVG 画一个金属拉杆 + 三档刻度，拉杆在三个位置间硬切换（30ms linear），
切换时整屏闪一下（phosphor-trail 反白 1 帧）。

### 6.9 顶部状态条

**当前问题**：sticky 顶部栏只有"STATUS ONLINE / LOCAL API / 主题切换"三件套。

**改造**：变成 **任务控制台主条**。

```
┌──────────────────────────────────────────────────────────────────┐
│ ◯ DECK-A  ▸  DASHBOARD       UTC 14:38:09.412   ▤ BUS:SSE   01010 │
│                                                                    │
│ [● REC]  [⊕ ADD JOB]  [⏵ HOTLIST]  [⏼ HALT]  ......  [ TOGGLE ]   │
└──────────────────────────────────────────────────────────────────┘

- 左：正在播放/查看的"频道"标识
- 中：UTC 时间码（每帧刷新，DSEG14 字体）
- 右：BUS 协议、二进制 packet stub（随机变化的 5 位 0/1）
- 第二行：当前页面的关键动作按键
```

### 6.10 底部状态条（新增）

**新增组件 `<DeckFooter />`**，全局 fixed bottom：

```
┌──────────────────────────────────────────────────────────────────┐
│ MODEL: ASMR-DECK-Ⅱ   FW: 0.1.0   IO: 12.4kB/s ▲   ░ 37%   uptime: 02:14:08 │
└──────────────────────────────────────────────────────────────────┘

22px 高，mono 9px，phosphor-mid，左对齐型号、中段实时 IO（从 SSE 取）、
右段 uptime。永远在那里，让画面"在自己运行"。
```

### 6.11 自定义音频播放器（替换 `<audio controls>`）

> 这是 P0。一个 ASMR 工具不允许暴露浏览器原生播放器。

新建 `src/components/AudioDeck.tsx`：

```
┌─ chassis ──────────────────────────────────────────────────────┐
│ [● REC LED]  TRACK 03 · 助眠耳道清洁 · 12:45 / 38:20            │
│                                                                  │
│ ┌─ screen ──────────────────────────────────────────────────┐ │
│ │ ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁  实时波形（WebAudio AnalyserNode）           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                                  │
│ [⏮]  [⏵/⏸]  [⏭]    [LOOP]   [SUBS]    │ VOL ▮▮▮▮▮▮▯▯ │ TIME 12:45 │
└────────────────────────────────────────────────────────────────┘

技术要点：
1. 用 WebAudio 的 AnalyserNode 实时采样 → 渲染波形（canvas，60fps）
2. 大按钮：3px 圆角琥珀键，按下时 translateY(1px)
3. 时间码用 DSEG14 字体显示
4. 字幕开关旁边显示 "CC ON/OFF" 贴标
5. 播放时整体面板 .deck-chassis 加一圈极弱 tape-pink 边光（live 状态）
6. 暂停时画面静止但保留磷光残影（最后一帧波形 fade 出 800ms）
```

---

## 7. 屏幕级蓝图

> 每个屏幕都重新规划，不再是"PageHeader + grid of cards"的同构布局。

### 7.1 Dashboard（`/`）—— 主控台总览

```
┌─ 顶部状态条 ───────────────────────────────────────────────────┐
├─────────────────────────────────────────────────────────────────┤
│  ┌─ BIG CRT ────────────────────────┐ ┌─ rail ──┐  ┌─ rail ─┐ │
│  │ TOTAL INDEX             382,491   │ │ SIGNAL  │  │ TASK   │ │
│  │ 七段管巨号 + 慢速 increment        │ │ METER   │  │ FEED   │ │
│  │                                    │ │ (vu)    │  │ (live  │ │
│  │ 日志流（mono 实时滚动）             │ │         │  │  log)  │ │
│  │ > 14:38:09 task #12 RUNNING        │ │         │  │        │ │
│  │ > 14:38:08 task #11 SUCCESS        │ │         │  │        │ │
│  └────────────────────────────────────┘ └─────────┘  └────────┘ │
│                                                                   │
│  ┌─ 三联快捷面板 RADAR / QUEUE / ARCH ───────────────────────┐ │
│  │ 每张是一个 chassis（不是 hover 浮起卡片），鼠标悬停时       │ │
│  │ 屏幕亮一档 + 标题增强发光                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 同步赛道 (磁带录音条样式的进度，2-3 行) ─────────────────┐ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**关键变化**：
- 砍掉"三个 StatCard"等权布局，改为 **一块巨型 CRT + 两条 rail** 的
  非对称构图（黄金比 1.6 : 0.6 : 0.4 不要 1:1:1）
- 数字 382,491 用 DSEG14 渲染，进入页面时从 0 跳跃到目标值（不是平滑）
- 实时日志面板（左侧 CRT 内的下半部分）从 SSE 拉最新 8 条事件，
  每条用 mono 行 `> HH:MM:SS  task#NN  STATUS`，新事件用 tape-pink 高亮 1.5s

### 7.2 Discover（`/discover`）—— 发现雷达

**保留**搜索表单结构，但视觉重构：
- 搜索栏 = **大型频率拨钮 + CLI 输入条**：左侧画一个旋钮（SVG，可拖动改变
  排序方向，作为 fancy 替代 sort asc/desc 下拉），右侧是 CLI Bay 输入框
- "条件搜索 / 高级语法" 切换 = 物理 toggle switch（同主题切换器风格）
- 标签（draftTags）= **磁带粉色贴纸**（`.deck-decal`），点击时撕掉的动画
  （opacity → 0 + skew + 0.2s）
- WorkCard 完全重做：
  ```
  ┌── chassis ───────────────────────────────────────────┐
  │ ┌─ screen 封面（保留 16:9）─────┐  RJ123456    ★ 4.7 │
  │ │  cover image with CRT overlay │  CIRCLE NAME       │
  │ │  (扫描线 + vignette)          │  release: 2024-12  │
  │ └────────────────────────────────┘  ────────────────  │
  │                                     [ 标签贴纸条 ]    │
  │ TRACK COUNT  ░░░░  DL COUNT  ░░░░░  HAS SUB ◯       │
  │                                                        │
  │ [ ⊕ QUEUE ]  [ ▸ INSPECT ]                            │
  └────────────────────────────────────────────────────────┘
  ```
  封面图必须叠加扫描线 + vignette 让它"在屏幕里"而不是平铺在卡上。

- Facet 面板（热门标签/社团/声优）= **三个抽屉式机柜**，并列在右侧 rail，
  每个抽屉顶部有一个铭牌（decal）写 "TAGS / CIRCLES / VOICE"，下方是
  按计数排序的贴标徽章云。

### 7.3 Library（`/library`）—— 媒体档案库

- 网格保留 3-up（在足够宽时）但卡片改成 **磁带盒**外观：
  ```
  ┌─ tape case ─────────────────┐
  │ ╔═══════════════════════╗   │
  │ ║   COVER SCREEN        ║   │  ← 屏幕（封面 + scanlines）
  │ ╚═══════════════════════╝   │
  │ TITLE TITLE TITLE...         │  ← 大 display 字体
  │ ┌──────────────────────────┐ │
  │ │  ASMRoner  · TYPE-Ⅱ   ░░ │ │  ← 磁带盒贴标（tape-pink）
  │ │  RJ123456  ·  38min      │ │
  │ └──────────────────────────┘ │
  │ [ FILES ] [ AUDIO 6 ] [ SUB] │
  └──────────────────────────────┘
  ```
- 右侧详情面板 = **AudioDeck**（见 6.11）作为主元素，下方折叠"全部文件"
  抽屉

### 7.4 Queue（`/queue`）—— 任务调度台

- 顶部三块 StatCard 改成 **三个仪表头**（VU 表样式 SVG）：
  - 左：RUNNING（指针抖动反映活跃任务数）
  - 中：FAILED（红色区域指针，有任务时进入红区）
  - 右：QUEUED（琥珀，平稳）
- 任务列表保留 table，但表格行改成 **mono 日志行 + decal 状态条**，
  新增"在跑"任务的整行 tape-pink 边光
- 选中任务详情面板 = 一块 .deck-screen，左半实时日志（mono 实时流），
  右半操作板（RETRY / DELETE / CANCEL 三个琥珀大键）

### 7.5 Sync（`/sync`）—— 同步舱

- 把"批量操作"想象成 **磁带复制工作站**
- 上半屏：来源（远端索引）+ 目标（本地）两台机器并排，中间是"磁带传输管道"
  （SVG 画的真磁带在两个 reel 间走，运行时动画激活）
- 下半屏：批次表单（保留功能），按钮风格统一到琥珀大键

### 7.6 Settings（`/settings`）—— 系统参数

- 改成 **DIP 开关墙 + 拨码板**风格：
  - 布尔类参数 = 真的 DIP 开关（SVG 画的 ON/OFF 拉杆）
  - 数字参数 = 旋钮 + 数字读数（DSEG14）
  - 文本参数 = CLI Bay 输入（与 6.4 一致）
- 表单分区不再是 Card，改成机柜面板分区（`.deck-chassis`），每块面板顶部
  贴一个贴标 "SECTION-A · USER" / "SECTION-B · DOWNLOADER"

---

## 8. 动效语汇（Motion Language）

> 当前 framer-motion 只用于 fadeUp。要么删掉这种廉价用法，要么把动效升级到
> "机械/电子"质感。

### 8.1 整体节奏

| 类型 | 当前 | 改成 |
|------|------|------|
| 默认 ease | `[0.22, 1, 0.36, 1]`（很平滑） | `cubic-bezier(0.6, 0, 0.4, 1)`（机械感） |
| 默认时长 | 240-320ms | 160-220ms（更脆） |
| spring | `stiffness: 180, damping: 18` | 仅在"软"运动（VU 指针、磁带卷轴）使用，UI 转场不用 spring |

### 8.2 复古专属动效

- **`flicker`**：3 帧间随机切换 opacity 0.92 / 1.0 / 0.96，仅在屏幕首次点亮、
  数据刷新时触发一次（不要常驻闪烁，那是浮夸）
- **`segment-tick`**：DSEG14 数字变化时不要补间，直接 step 跳跃，前后各 60ms
  显示"8.8.8.8"作为暂态（七段管的真实表现）
- **`tape-roll`**：磁带卷轴 SVG 旋转，速度 = 进度（任务运行时） * 360deg/s
- **`scanline-pulse`**：屏幕从一种状态切到另一种时，有一条亮扫描线从顶到底
  扫一次（200ms linear）
- **`decal-rip`**：撕掉贴标时，180ms 内 transform: skew(-12deg) +
  opacity → 0
- **`crt-power-on`**：路由切换时，新页面以 "扁竖线扩张" 方式登场
  （scaleY 0 → 1 in 200ms，然后 brightness 1.4 → 1.0 in 120ms）—— 真的 CRT
  开机感

### 8.3 删除的动效

- 所有 `whileHover={{ y: -8, scale: 1.01 }}` 删掉。卡片不浮起。
- `staggerContainer` + `fadeUpItem` 不再无脑用在每个屏幕的每个 motion.div。
  只保留**一处**入场 stagger（推荐：列表项按行进入），其他地方一帧到位。

---

## 9. 反模式清单（绝对不做）

1. ❌ `rounded-lg`、`rounded-xl`、`rounded-2xl`
2. ❌ `backdrop-blur-xl`（仅 toast / overlay 等真正悬浮层用）
3. ❌ `bg-gradient-to-br from-emerald-400 to-amber-400` 这类对角渐变填充
4. ❌ 浏览器原生 `<audio controls>` / `<input type="range">` 默认外观
5. ❌ shadcn 默认 hover lift（`y: -8 / scale: 1.01`）
6. ❌ 5 个等权重的 badge 颜色
7. ❌ 同时使用两个图标库（仅保留 Phosphor `duotone` weight）
8. ❌ Inter / Roboto / Space Grotesk / JetBrains Mono / Geist 任何一个
9. ❌ `Sparkles` ✨、`Wand` 🪄 这种 generic AI 后台 icon —— 必须换成
   `WaveSawtooth` / `RadioButton` / `Cassette` / `Knob` / `WaveSine` 等
   声音/广播主题图标（Phosphor 都有）
10. ❌ "CRT" 装饰只在外壳壁纸出现，里面所有面板用现代 surface ——
    必须把 CRT 质感**渗透到屏幕级 surface 内部**
11. ❌ 在浅色主题里直接降低暗色主题的对比度而不切到塑料外壳那套色板
12. ❌ 同时启用 beam-border 和扫描线在所有面板上（噪音化）
13. ❌ 用 emoji 作 UI 图标（除非是 telltale 灯，并且只在评论里说"emoji"）

---

## 10. 实施路线图（建议拆 PR 顺序）

### Phase 0 — Tokens & Chassis（1 PR，最大改动量但最稳）

- 替换 `src/styles/index.css` 的 `:root` / `[data-theme="dark"]`
  为本文档第 3 节的 token 集
- 自托管 Departure Mono、DSEG14、Big Shoulders Stencil Display
- 引入 `.deck-chassis` / `.deck-bezel` / `.deck-screen` / `.deck-plate`
  / `.deck-decal` 五个新 class
- 删除 `sweet-*` 全部别名
- 把 Layout sidebar、PageHeader 容器迁到 `.deck-chassis`，sidebar 内嵌的
  内容区迁到 `.deck-screen`
- **暂时保留** Card / Button / Badge 旧样式以避免编译爆炸（等 Phase 1）

**验收**：截图与现状对比，至少应有"机箱+CRT"的物理质感差异。

### Phase 1 — Components Refit（1-2 PR）

- 重做 Card（拆成 ChassisCard / ScreenCard）
- 重做 Button（4 variant，琥珀亚克力）
- 重做 Badge（5 语义）
- 重做 Input（CLI Bay）
- 重做 ProgressTrack（磁带卷轴）
- 重做 EmptyState（测试卡）
- 重做加载骨架（TBC 缓冲条）
- 主题切换器改硬件拨钮
- 替换图标库到 Phosphor duotone（删除 lucide）

### Phase 2 — Decks（按屏幕做集合，每屏一个 PR）

- Dashboard：非对称 CRT + 双 rail 构图，加日志流
- Library：磁带盒卡片 + AudioDeck 自定义播放器（**重头戏**）
- Discover：CLI 频率拨钮搜索栏 + 重做 WorkCard
- Queue：VU 表头 + 实时日志详情
- Sync：磁带复制工作站
- Settings：DIP 开关 + 旋钮表单

### Phase 3 — 装饰与"在自己运行"层（1 PR）

- 顶部状态条改任务控制台主条（UTC 时间码 + 二进制 stub）
- 新增 `<DeckFooter />` 全局底部状态条
- 给 Visualizer 接上真实数据源（活跃任务数 → 信号强度）
- 给 beam-border 加运行状态条件（仅 RUNNING 任务和 focused panel）
- 加屏幕弯曲（SVG filter feDisplacementMap，强度 1-2px，可在设置里关闭）
- 加 grain 层（SVG turbulence noise，opacity 0.04，全局 fixed）

---

## 11. 验收标准（Done = 这些都打钩）

视觉：
- [ ] 关掉所有数据，截图能让人联想到"录音控制台 / 任务控制中心"，不联想到
      "shadcn / vercel / linear"
- [ ] 任意一张截图里，至少能找到 3 个不同 surface 角色
      （chassis / screen / plate / decal / bezel）
- [ ] 无任何 `rounded-lg` 类名出现在生产代码中（用 grep 验证）
- [ ] 无 `backdrop-blur-xl` 出现在 deck-* 之外
- [ ] 五个语义 badge，颜色总和不超过本文档色板
- [ ] 自定义音频播放器替代了 `<audio controls>`

行为：
- [ ] 顶部时间码每帧刷新（`requestAnimationFrame`），UTC 精度到 ms
- [ ] DeckFooter 上的 IO 速率从 SSE 实时取
- [ ] Visualizer 的强度反映活跃任务数，不是装饰
- [ ] EmptyState 是测试卡而不是文字加图标
- [ ] 路由切换有 CRT 开机扫描动画

体验：
- [ ] 放在那 5 分钟，画面有可见的活动（卷轴在转、时间在走、IO 抖动），
      不是死的
- [ ] 主题切换是硬件拨钮的"咔嗒"切换，整屏 flicker 1 帧
- [ ] 任何按钮按下都有 1px translateY 与内嵌阴影变化

文档：
- [ ] `apps/web/docs/style-system.md` 总结最终设计代币与 surface 角色
      （写给后续维护者）

---

## 12. 给 AI 代理的执行守则

如果你（未来的 Claude 或类似代理）正在按照这份 prompt 改造 `apps/web`：

1. **不要试图融合"sweet"和"console"两套**——选 Mission Control，删掉甜系。
2. **不要扩张色板**——5 个角色色已足够。看到想加紫色的冲动就停下。
3. **不要每个组件都加 framer-motion**——一个屏幕只允许一处 stagger 入场。
4. **不要写"comprehensive style guide" 文档**——那是 AI slop。落代码、改
   token、改 component，验证视觉效果，截图。
5. **每个 PR 配截图对比**——文字描述不算数。
6. **碰到拿不准的视觉决策**：回到 §1 那句话——"1986 年东京 NHK 卫星广播间隔壁
   的助眠节目录音控制台"——你要做的元素属于那个房间吗？属于则做，不属于则砍。

---

*This brief is opinionated by design. If a future contributor disagrees with a
specific choice, they should propose the next named aesthetic anchor (e.g.,
"Brutalist Cassette" / "Neo-Showa Pastel") with the same level of specificity
and replace this document wholesale — not erode it section by section.*
