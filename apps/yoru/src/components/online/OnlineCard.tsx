import type { DiscoverWorkSummary, WorkStatus } from "@/lib/api";
import { formatCount, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CoverPlaceholder, Sticker, type CoverColor } from "@/components/ui";
import { CollectButton } from "@/components/CollectButton";
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
  /** works/status 查询结果(驱动封面徽章 + 收藏态 + 下载钮三态) */
  status?: WorkStatus;
  /** 全局播放器当前会话是否为该作品(仅作展示指示,不可点击) */
  playingNow: boolean;
  /** 字幕贴纸旋转角(原型 ±3° 交替) */
  stickerRotate: number;
  /** 整卡点击 → 作品详情页(在详情页再决定播放) */
  onOpen: () => void;
  onDownload: () => void;
};

/**
 * 在线曲库作品卡(dc.html:296-311):
 * 4:3 封面 + 右上 ♡ 收藏(收藏即入库,毛玻璃底)+ 左下毛玻璃评分胶囊
 * + 字幕贴纸 + 标题两行 / CV·社团单行 / DL mono + 下载钮三态。
 * 整卡点击 → 详情页;当前正在播放的作品封面右下显示 ♪ 指示(非交互)。
 */
export function OnlineCard({
  work,
  status,
  playingNow,
  stickerRotate,
  onOpen,
  onDownload,
}: OnlineCardProps) {
  const coverUrl = work.thumbnail_url || work.main_cover_url;
  return (
    <div
      className={cn("y-onl-card", playingNow && "is-now")}
      role="button"
      tabIndex={0}
      aria-label={`查看详情 ${work.title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
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
        <CollectButton
          work={work}
          collected={status?.collected ?? false}
          size="sm"
          className="y-onl-cover__collect"
        />
        <WorkStatusBadge status={status} className="y-onl-cover__status" />
        <span className="y-onl-cover__rate">★ {formatRate(work.rate)}</span>
        {playingNow && (
          <span className="y-onl-cover__now" role="img" aria-label="正在播放">
            ♪
          </span>
        )}
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
