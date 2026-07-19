import { Link } from "@tanstack/react-router";
import type { Collection, WorkStatus } from "@/lib/api";
import { CoverPlaceholder, Sticker } from "@/components/ui";
import { CollectButton } from "@/components/CollectButton";
import { DownloadButton, WorkStatusBadge } from "@/components/WorkBadge";
import { coverColorFor } from "./coverColor";

export type CollectionCardProps = {
  work: Collection;
  /** works/status 结果:判 in_library(已下载 ✓ 徽章)+ 驱动下载钮三态 */
  status?: WorkStatus;
  /** 全局播放器当前会话是否为该作品(「♪ 再生中」贴纸) */
  nowPlaying: boolean;
  /** 正在拉取音轨详情(▶ 显示 …) */
  loading?: boolean;
  /** 字幕贴纸旋转角(原型按索引奇偶 ±3°) */
  stickerRotate?: number;
  onPlay: () => void;
  onDownload: () => void;
};

/**
 * 收藏作品卡(收藏即入库;卡范式同本地 WorkCard,dc.html:82-92):
 * 封面快照 + 字幕あり/♪ 再生中贴纸 + 已在库 ✓ 徽章 + 标题两行
 * + CV · 社团 + 行内操作(▶ 串流 / ♥ 取消收藏 / 下载三态)。
 * 整卡点击 → /works/$sourceId(作品详情唯一入口)。
 */
export function CollectionCard({
  work,
  status,
  nowPlaying,
  loading,
  stickerRotate = 3,
  onPlay,
  onDownload,
}: CollectionCardProps) {
  const inLibrary = status?.state === "in_library";
  const coverUrl = work.thumbnail_url || work.main_cover_url;
  return (
    <div className="y-lib-card">
      {work.has_subtitle && (
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
        to="/works/$sourceId"
        params={{ sourceId: work.source_id }}
        className="y-lib-card__link"
        aria-label={work.title}
      >
        <div className="y-lib-card__cover">
          {coverUrl ? (
            <img src={coverUrl} alt="" loading="lazy" />
          ) : (
            <CoverPlaceholder color={coverColorFor(work.source_id)} />
          )}
          {inLibrary && <WorkStatusBadge status={status} className="y-lib-card__status" />}
        </div>
        <div className="y-lib-card__title">{work.title}</div>
      </Link>
      <div className="y-lib-card__meta">
        <span className="y-lib-card__meta-text">
          {work.vas.length > 0
            ? `CV ${work.vas.join("、")} · ${work.circle || "-"}`
            : work.circle || "-"}
        </span>
      </div>
      <div className="y-lib-card__actions">
        <button
          type="button"
          className="y-lib-card__play"
          aria-label={`串流播放 ${work.title}`}
          disabled={loading}
          onClick={onPlay}
        >
          {loading ? "…" : "▶"}
        </button>
        <CollectButton work={work} collected size="sm" />
        {!inLibrary && <DownloadButton status={status} size="sm" onDownload={onDownload} />}
      </div>
    </div>
  );
}
