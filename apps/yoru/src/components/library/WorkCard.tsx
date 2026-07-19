import { Link } from "@tanstack/react-router";
import type { LibraryWorkSummary } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CoverPlaceholder, Sticker } from "@/components/ui";
import { coverColorFor } from "./coverColor";

export type WorkCardProps = {
  work: LibraryWorkSummary;
  /** 当前全局播放器正在播这部作品(「♪ 再生中」贴纸) */
  nowPlaying: boolean;
  fav: boolean;
  onToggleFav: () => void;
  /** 字幕贴纸旋转角(原型按索引奇偶 ±3°) */
  stickerRotate?: number;
};

/** 媒体库作品卡(dc.html:82-92;♡ 收藏为原型缺失按心形范式补) */
export function WorkCard({ work, nowPlaying, fav, onToggleFav, stickerRotate = 3 }: WorkCardProps) {
  return (
    <div className="y-lib-card">
      {work.has_subtitles && (
        <Sticker rotate={stickerRotate} className="y-lib-card__st-sub">
          字幕あり
        </Sticker>
      )}
      {nowPlaying && (
        <Sticker color="lav" className="y-lib-card__st-now">
          ♪ 再生中
        </Sticker>
      )}
      <Link
        to="/library/$id"
        params={{ id: work.id }}
        className="y-lib-card__link"
        aria-label={work.title}
      >
        <div className="y-lib-card__cover">
          {work.thumbnail_url ? (
            <img src={work.thumbnail_url} alt="" loading="lazy" />
          ) : (
            <CoverPlaceholder color={coverColorFor(work.id)} />
          )}
        </div>
        <div className="y-lib-card__title">{work.title}</div>
      </Link>
      <div className="y-lib-card__meta">
        <span className="y-lib-card__meta-text">
          {work.audio_file_count} 音轨 · {formatDate(work.release_date) || "日期未知"}
        </span>
        <button
          type="button"
          className={cn("y-lib-card__fav", fav && "is-on")}
          aria-pressed={fav}
          aria-label={fav ? `取消收藏 ${work.title}` : `收藏 ${work.title}`}
          onClick={onToggleFav}
        >
          ♡
        </button>
      </div>
    </div>
  );
}
