import { Link } from "@tanstack/react-router";
import { MusicNote } from "@phosphor-icons/react";
import type { LibraryWorkSummary } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { CoverPlaceholder, Sticker } from "@/components/ui";
import { CollectButton } from "@/components/CollectButton";
import { coverColorFor } from "./coverColor";

export type WorkCardProps = {
  work: LibraryWorkSummary;
  /** 当前全局播放器正在播这部作品(「♪ 再生中」贴纸) */
  nowPlaying: boolean;
  /** 服务端收藏标记(works/status.collected;收藏即入库,与下载状态独立) */
  collected: boolean;
  /** 字幕贴纸旋转角(原型按索引奇偶 ±3°) */
  stickerRotate?: number;
};

/**
 * 媒体库本地作品卡(dc.html:82-92)。整卡点击 → /works/$sourceId
 * (作品详情唯一入口);♡ 为 CollectButton(快照只拿得到本地摘要字段,
 * 其余由 toCollectionInput 兜底)。
 */
export function WorkCard({ work, nowPlaying, collected, stickerRotate = -2 }: WorkCardProps) {
  return (
    <div className="y-lib-card">
      {work.has_subtitles && (
        <Sticker rotate={stickerRotate} className="y-lib-card__st-sub">
          字幕あり
        </Sticker>
      )}
      {nowPlaying && (
        <Sticker color="lav" className="y-lib-card__st-now">
          <MusicNote size={11} weight="fill" /> 再生中
        </Sticker>
      )}
      <Link
        to="/works/$sourceId"
        params={{ sourceId: work.media_id }}
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
        <CollectButton
          className="y-lib-card__collect"
          work={{
            source_id: work.media_id,
            title: work.title,
            circle: "",
            release: work.release_date,
            has_subtitle: work.has_subtitles,
            thumbnail_url: work.thumbnail_url,
          }}
          collected={collected}
          size="sm"
        />
      </div>
    </div>
  );
}
