import { useState } from "react";
import { Heart, Moon, MusicNote, Play, Sun } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Chip,
  CoverPlaceholder,
  Dialog,
  EmptyState,
  EQ,
  Pagination,
  ProgressBar,
  Skeleton,
  Stepper,
  Sticker,
  Toggle,
} from "@/components/ui";

const THEMES: [string, string, typeof Moon][] = [
  ["dark", "夜間", Moon],
  ["light", "デイ", Sun],
];

const PALETTES = [
  ["lavender", "薰衣草"],
  ["blue", "蓝"],
  ["orange", "橙"],
  ["green", "绿"],
] as const;

function setDataset(key: "theme" | "palette" | "stickers", value: string) {
  document.documentElement.dataset[key] = value;
}

/** Phase 0 临时自检页:展示全部设计令牌与 UI 原语(Phase 1 由真实壳替换) */
export default function StyleLab() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme ?? "dark");
  const [palette, setPalette] = useState(document.documentElement.dataset.palette ?? "lavender");
  const [stickers, setStickers] = useState(document.documentElement.dataset.stickers !== "false");
  const [tab, setTab] = useState("all");
  const [concur, setConcur] = useState(3);
  const [page, setPage] = useState(2);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="y-shell" style={{ overflow: "auto" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px 64px", display: "flex", flexDirection: "column", gap: 28 }}>
        <header>
          <div style={{ fontWeight: 900, fontSize: 24 }}>ASMRoner · よる夜间电台</div>
          <div className="y-kana y-kana--lg" style={{ marginTop: 2 }}>すたいるらぼ · Phase 0 设计系统自检</div>
        </header>

        {/* 主题 / palette / 贴纸 */}
        <section className="y-card" style={{ padding: 18, position: "relative" }}>
          <Sticker section color="lav" rotate={2}>外观 · がいかん</Sticker>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 12.5 }}>主题</strong>
              {THEMES.map(([id, label, Icon]) => (
                <Chip key={id} active={theme === id} onClick={() => { setTheme(id); setDataset("theme", id); }}>
                  <Icon size={12} /> {label}
                </Chip>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 12.5 }}>Palette</strong>
              {PALETTES.map(([id, label]) => (
                <Chip key={id} active={palette === id} onClick={() => { setPalette(id); setDataset("palette", id); }}>
                  {label}
                </Chip>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <strong style={{ fontSize: 12.5 }}>贴纸徽章</strong>
              <Toggle
                checked={stickers}
                onChange={(v) => { setStickers(v); setDataset("stickers", String(v)); }}
                label="贴纸徽章"
              />
            </div>
          </div>
        </section>

        {/* 按钮 / chip / 步进器 / 复选框 */}
        <section className="y-card" style={{ padding: 18, position: "relative" }}>
          <Sticker section>控件 · こんとろーる</Sticker>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button type="button" className="y-btn-primary" onClick={() => toast.success("任务已创建", { description: "sonner 暗紫主题将在 Phase 1 接线" })}>
                <Play size={14} weight="fill" /> 继续播放
              </button>
              <button type="button" className="y-btn-ghost">曲目列表</button>
              <button type="button" className="y-btn-ghost" disabled>禁用态</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {[
                ["all", "全部 9"],
                ["sub", "有字幕 4"],
              ].map(([id, label]) => (
                <Chip key={id} active={tab === id} onClick={() => setTab(id)}>{label}</Chip>
              ))}
              <Chip active={tab === "fav"} onClick={() => setTab("fav")}>
                收藏 <Heart size={11} weight="fill" /> 2
              </Chip>
              <span className="y-tag">#耳语</span>
              <button type="button" className="y-tag y-tag--facet">#催眠 <span className="y-tag__count">3</span></button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <Stepper value={concur} min={1} max={8} onChange={setConcur} label="并发任务数" />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input type="checkbox" className="y-checkbox" style={{ appearance: "none" }} readOnly />
                y-checkbox 由 Phase 3 批量选择使用
              </label>
            </div>
          </div>
        </section>

        {/* 进度 / EQ */}
        <section className="y-card" style={{ padding: 18, position: "relative" }}>
          <Sticker section color="lav" rotate={-2}>进度 · しんちょく</Sticker>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 14 }}>
            <ProgressBar value={42} />
            <ProgressBar value={62} variant="task" />
            <ProgressBar value={35} variant="seek" onSeek={(p) => toast(`seek → ${Math.round(p)}%`)} />
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <EQ playing />
              <EQ playing={false} />
              <span style={{ fontSize: 11, color: "var(--mut)" }}>播放中 / 暂停</span>
            </div>
          </div>
        </section>

        {/* 封面占位 / 贴纸变体 / 指标格 */}
        <section className="y-card" style={{ padding: 18, position: "relative" }}>
          <Sticker section rotate={2}>封面 · かばー</Sticker>
          <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 16 }}>
            {(["lav", "rose", "blue", "plum"] as const).map((c, i) => (
              <div key={c} className="y-card y-card--lift" style={{ position: "relative", cursor: "pointer", border: "none", background: "transparent" }}>
                <Sticker rotate={i % 2 ? 3 : -3} style={{ right: 6, top: -7 }}>字幕あり</Sticker>
                <CoverPlaceholder color={c} style={{ aspectRatio: "1", borderRadius: 12, border: "1.5px solid var(--line)" }} />
                <div style={{ marginTop: 7, fontWeight: 700, fontSize: 12 }}>斜纹占位 · {c}</div>
                <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--mut)" }}>CV 名前 · 2:14:06</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxWidth: 320 }}>
            {[["发售日", "2026-06-30"], ["价格", "¥1,320"], ["评论数", "214"], ["音轨数", "5 轨"]].map(([k, v]) => (
              <div key={k} className="y-metric">
                <div className="y-metric__label">{k}</div>
                <div className="y-metric__value">{v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 提示 / 空态 / 骨架 / 分页 / 浮层 */}
        <section className="y-card" style={{ padding: 18, position: "relative" }}>
          <Sticker section color="lav" rotate={-2}>状态 · じょうたい</Sticker>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="y-hint">
              <span className="y-hint__icon">
                <MusicNote size={12} />
              </span>
              去「发现」检索并批量加入队列,完成后会自动匹配字幕。
            </div>
            <EmptyState action={<button type="button" className="y-btn-ghost" style={{ padding: "6px 14px", fontSize: 11.5 }}>去发现 →</button>}>
              媒体库还是空的 — 先去发现页找点深夜陪伴吧。
            </EmptyState>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Skeleton variant="row" />
              <Skeleton variant="row" />
            </div>
            <Pagination page={page} totalPages={5} onPage={setPage} />
            <div className="y-panel" style={{ padding: "11px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <Sticker rotate={-2} style={{ position: "static" }}>已选 3 件</Sticker>
              <span style={{ fontSize: 12, color: "var(--mut)" }}>合计约 3.2 GB · 毛玻璃浮条 .y-panel</span>
              <button type="button" className="y-btn-primary" style={{ marginLeft: "auto", padding: "8px 22px", fontSize: 12.5 }} onClick={() => setDialogOpen(true)}>
                打开 Dialog
              </button>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} label="下载复核">
        <Sticker style={{ position: "static", display: "inline-block" }}>下载复核 · かくにん</Sticker>
        <div style={{ marginTop: 10, fontWeight: 900, fontSize: 16 }}>确认创建下载任务</div>
        <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--mut)", lineHeight: 1.6 }}>
          遮罩 z50 + 居中卡 z51,framer-motion 进出,ESC / 点遮罩关闭。
        </div>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="y-btn-ghost" style={{ padding: "8px 18px", fontSize: 12 }} onClick={() => setDialogOpen(false)}>取消</button>
          <button type="button" className="y-btn-primary" style={{ padding: "8px 20px", fontSize: 12 }} onClick={() => setDialogOpen(false)}>创建下载任务</button>
        </div>
      </Dialog>
    </div>
  );
}
