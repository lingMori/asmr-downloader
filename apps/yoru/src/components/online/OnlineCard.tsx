import type { DiscoverWorkSummary, WorkStatus } from "@/lib/api";
import { formatCount, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CoverPlaceholder, Sticker, type CoverColor } from "@/components/ui";
import { DownloadButton, WorkStatusBadge } from "@/components/WorkBadge";

/** 无封面时按 source_id 散列取 4 色斜纹占位(原型 this.covers[w.c] 的散列取色思路) */
const COVER_COLORS: CoverColor[] = ["lav", "rose", "blue", "plum"];
function coverColorOf(id: string): CoverColor {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_COLORS[hash % COVER_COLORS.length];
}

export type OnlineCardProps = {
  work: DiscoverWorkSummary;
  /** works/status 查询结果(驱动封面徽章 + 下载钮三态) */
  status?: WorkStatus;
  /** 全局播放器当前会话是否为该作品 */
  playingNow: boolean;
  /** 全局是否在播(与 playingNow 共同决定 ▶ / ❚❚ 渐变) */
  playing: boolean;
  /** 正在拉取音轨详情(封面加载罩) */
  loading: boolean;
  /** 字幕贴纸旋转角(原型 ±3° 交替) */
  stickerRotate: number;
  onPlay: () => void;
  onDownload: () => void;
};

/**
 * 在线曲库作品卡(dc.html:296-311):
 * 4:3 封面 + 右下圆形播放/暂停钮 + 左下毛玻璃评分胶囊 + 字幕贴纸
 * + 标题两行 / CV·社团单行 / DL mono + 下载钮三态。
 * 整卡点击 = 串流播放(onPlay,播放/暂停语义由页面判定)。
 */
export function OnlineCard({
  work,
  status,
  playingNow,
  playing,
  loading,
  stickerRotate,
  onPlay,
  onDownload,
}: OnlineCardProps) {
  const active = playingNow && playing;
  const coverUrl = work.thumbnail_url || work.main_cover_url;
  return (
    <div
      className={cn("y-onl-card", playingNow && "is-now")}
      role="button"
      tabIndex={0}
      aria-label={`播放 ${work.title}`}
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.key === "Enter") onPlay();
      }}
    >
      {work.has_subtitle && (
        <Sticker rotate={stickerRotate} className="y-onl-card__sub">
          字幕あり
        </Sticker>
      )}
      <div className="y-onl-cover">
        {coverUrl ? (
          <img className="y-onl-cover__img" src={coverUrl} alt="" loading="lazy" />
        ) : (
          <CoverPlaceholder color={coverColorOf(work.source_id)} className="y-onl-cover__ph" />
        )}
        <WorkStatusBadge status={status} className="y-onl-cover__status" />
        <span className="y-onl-cover__rate">★ {formatRate(work.rate)}</span>
        <span
          role="button"
          aria-label={active ? "暂停" : "播放"}
          className={cn("y-onl-cover__play", active && "is-on")}
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
        >
          {active ? "❚❚" : "▶"}
        </span>
        {loading && <span className="y-onl-cover__loading" aria-hidden="true" />}
      </div>
      <div className="y-onl-card__title">{work.title}</div>
      <div className="y-onl-card__meta">
        {work.vas.length > 0 ? `CV ${work.vas.join("、")} · ${work.circle}` : work.circle}
      </div>
      <div className="y-onl-card__foot">
        <span className="y-onl-card__dl">DL {formatCount(work.dl_count)}</span>
        <span className="y-onl-card__act" onClick={(e) => e.stopPropagation()}>
          <DownloadButton status={status} size="sm" onDownload={onDownload} />
        </span>
      </div>
    </div>
  );
}
