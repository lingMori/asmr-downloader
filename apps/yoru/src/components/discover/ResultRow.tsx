import { Check, MusicNote, Play, Star } from "@phosphor-icons/react";
import type { DiscoverWorkSummary, WorkStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCount, formatDate, formatRate } from "@/lib/format";
import { CoverPlaceholder, Sticker } from "@/components/ui";
import { CollectButton } from "@/components/CollectButton";
import { DownloadButton, WorkStatusBadge } from "@/components/WorkBadge";
import { isWorkUnavailable } from "@/hooks/useWorksStatus";
import type { CoverColor } from "@/components/ui";

export type ResultRowProps = {
  work: DiscoverWorkSummary;
  status?: WorkStatus;
  coverColor: CoverColor;
  selected: boolean;
  isDetail: boolean;
  /** 当前播放器会话正播该作品 */
  isPlaying: boolean;
  /** 试听拉详情中 */
  previewing: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onAddTag: (tag: string) => void;
};

/** 结果行(dc.html:199-218):勾选/封面/徽章/标题/meta/★DL/试听/下载 */
export function ResultRow({
  work,
  status,
  coverColor,
  selected,
  isDetail,
  isPlaying,
  previewing,
  onToggleSelect,
  onOpen,
  onPreview,
  onDownload,
  onAddTag,
}: ResultRowProps) {
  const owned = status?.state === "in_library";
  const unavailable = isWorkUnavailable(status);

  return (
    <div
      className={cn("y-disc-row", selected && "is-sel", isDetail && "is-detail")}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <button
        type="button"
        className={cn("y-checkbox", "y-disc-row__check", selected && "is-on")}
        disabled={unavailable}
        aria-label={selected ? `取消选择 ${work.source_id}` : `选择 ${work.source_id}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!unavailable) onToggleSelect();
        }}
      >
        {selected ? <Check size={11} weight="bold" /> : ""}
      </button>

      <div className="y-disc-row__cover">
        {work.thumbnail_url ? (
          <img src={work.thumbnail_url} alt="" loading="lazy" />
        ) : (
          <CoverPlaceholder color={coverColor} label="封面" />
        )}
      </div>

      <div className="y-disc-row__main">
        <div className="y-disc-row__badges">
          <span className="y-disc-row__rj">{work.source_id}</span>
          {work.has_subtitle && (
            <Sticker className="y-sticker--inline" rotate={-2}>
              字幕あり
            </Sticker>
          )}
          <WorkStatusBadge status={status} />
        </div>
        <div className={cn("y-disc-row__title", owned && "is-owned")}>{work.title}</div>
        <div className="y-disc-row__meta">
          <span>
            CV {work.vas.join("、") || "-"} · {work.circle || "-"} · {formatDate(work.release) || "-"}
          </span>
          {work.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="y-tag"
              title={`加入标签筛选: ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                onAddTag(tag);
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("y-disc-row__side", owned && "is-owned")}>
        <span className="y-disc-row__rate">
          <Star size={11} weight="fill" /> {formatRate(work.rate)}
        </span>
        <span>DL {formatCount(work.dl_count)}</span>
      </div>

      <button
        type="button"
        className={cn("y-disc-playbtn", isPlaying && "is-on")}
        disabled={previewing}
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
      >
        {previewing ? (
          "… 加载中"
        ) : isPlaying ? (
          <>
            <MusicNote size={12} weight="fill" /> 播放中
          </>
        ) : (
          <>
            <Play size={12} weight="fill" /> 试听
          </>
        )}
      </button>

      <span onClick={(e) => e.stopPropagation()}>
        <CollectButton work={work} collected={status?.collected ?? false} size="sm" />
      </span>

      <span onClick={(e) => e.stopPropagation()}>
        <DownloadButton status={status} onDownload={onDownload} />
      </span>
    </div>
  );
}
