import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { keys } from "@/lib/keys";
import { cn } from "@/lib/utils";
import { formatCount, formatDate, formatRate } from "@/lib/format";
import { findSubtitleForAudio, flattenPlayableTracks, flattenSubtitleTracks } from "@/lib/playback";
import { CoverPlaceholder, EmptyState, Skeleton, Sticker } from "@/components/ui";
import { useWorksStatus, isWorkUnavailable } from "@/hooks/useWorksStatus";
import { useGlobalPlayer } from "@/player";
import type { DownloadReviewItem } from "@/components/DownloadReviewDialog";
import { coverColorFor, formatSize, trackSizeMap } from "./helpers";

export type DetailPanelProps = {
  workId?: string;
  onDownload: (item: DownloadReviewItem) => void;
  onPickNeighbor: (sourceId: string) => void;
};

/**
 * 详情侧栏(dc.html:227-262)+ 相似作品区块(原型没有,按 facet 卡同范式补)。
 * 桌面在右栏、移动在全屏浮层复用同一组件。
 */
export function DetailPanel({ workId, onDownload, onPickNeighbor }: DetailPanelProps) {
  const player = useGlobalPlayer();

  const detailQuery = useQuery({
    queryKey: keys.discover.work(workId ?? ""),
    queryFn: () => apiClient.getDiscoverWork(workId!),
    enabled: Boolean(workId),
  });
  const neighborsQuery = useQuery({
    queryKey: keys.discover.neighbors(workId ?? ""),
    queryFn: () => apiClient.getWorkNeighbors(workId!),
    enabled: Boolean(workId),
  });
  const { map: statusMap } = useWorksStatus(workId ? [workId] : []);

  const detail = detailQuery.data;
  const audioFiles = useMemo(
    () => flattenPlayableTracks(detail?.tracks ?? []),
    [detail?.tracks],
  );
  const subtitleFiles = useMemo(
    () => flattenSubtitleTracks(detail?.tracks ?? []),
    [detail?.tracks],
  );
  const sizeByTrackId = useMemo(() => trackSizeMap(detail?.tracks ?? []), [detail?.tracks]);

  if (!workId) {
    return (
      <div className="y-disc-card">
        <Sticker color="lav" section>
          作品详情 · しょうさい
        </Sticker>
        <EmptyState>点击左侧结果行,这里会显示详情、音轨试听与下载入口。</EmptyState>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="y-disc-card">
        <Sticker color="lav" section>
          作品详情 · しょうさい
        </Sticker>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton variant="card" />
          <Skeleton variant="row" count={3} />
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="y-disc-card">
        <Sticker color="lav" section>
          作品详情 · しょうさい
        </Sticker>
        <div className="y-disc-error" style={{ marginTop: 8 }}>
          详情加载失败:{detailQuery.error instanceof Error ? detailQuery.error.message : "未知错误"}
          <span className="y-disc-error__actions">
            <button type="button" className="y-btn-ghost" onClick={() => void detailQuery.refetch()}>
              重试
            </button>
          </span>
        </div>
      </div>
    );
  }

  const summary = detail.summary;
  const coverUrl = summary.main_cover_url || summary.thumbnail_url;
  const status = statusMap.get(summary.source_id);
  const owned = status?.state === "in_library";
  const unavailable = isWorkUnavailable(status);
  const dlLabel = owned ? "已拥有" : unavailable ? "已入队 ✓" : "↓ 下载当前作品";
  const isCurWork = player.session?.sourceId === summary.source_id;

  const playFrom = (index: number) => {
    player.playSession({
      sourceId: summary.source_id,
      workTitle: summary.title,
      coverUrl,
      tracks: audioFiles.map((f) => ({
        id: f.path,
        title: f.name,
        url: f.url,
        subtitleUrl: findSubtitleForAudio(subtitleFiles, f)?.url,
      })),
      startIndex: index,
      stream: true,
      cv: summary.vas.join("、"),
      rj: summary.source_id,
    });
  };

  const neighbors = (neighborsQuery.data?.items ?? []).slice(0, 6);

  return (
    <>
      <div className="y-disc-card">
        <Sticker color="lav" section>
          作品详情 · しょうさい
        </Sticker>
        <div className="y-disc-detail">
          <div className="y-disc-detail__cover">
            {coverUrl ? (
              <img src={coverUrl} alt={summary.title} />
            ) : (
              <CoverPlaceholder color={coverColorFor(summary.source_id)} label="封面 · COVER" />
            )}
          </div>
          <div>
            <div className="y-disc-row__badges">
              <span className="y-disc-row__rj">{summary.source_id}</span>
              {summary.has_subtitle && (
                <Sticker className="y-sticker--inline" rotate={-2}>
                  字幕あり
                </Sticker>
              )}
            </div>
            <div className="y-disc-detail__title">{summary.title}</div>
            <div className="y-disc-detail__meta">
              {summary.circle || "-"} · CV {summary.vas.join("、") || "-"}
            </div>
          </div>

          <div className="y-disc-metrics">
            <div className="y-metric">
              <div className="y-metric__label">发售日</div>
              <div className="y-metric__value">{formatDate(summary.release) || "-"}</div>
            </div>
            <div className="y-metric">
              <div className="y-metric__label">价格</div>
              <div className="y-metric__value">¥{formatCount(detail.price)}</div>
            </div>
            <div className="y-metric">
              <div className="y-metric__label">评论数</div>
              <div className="y-metric__value">{formatCount(detail.review_count)}</div>
            </div>
            <div className="y-metric">
              <div className="y-metric__label">音轨数</div>
              <div className="y-metric__value">{audioFiles.length} 轨</div>
            </div>
          </div>

          <div>
            <div className="y-disc-tracks__label">音轨试听 · ためしぎき</div>
            <div className="y-disc-tracks">
              {audioFiles.length === 0 && (
                <div className="y-disc-field__hint">没有可在线播放的音轨。</div>
              )}
              {audioFiles.map((file, i) => {
                const on = isCurWork && player.currentTrack?.id === file.path;
                return (
                  <button
                    key={file.path}
                    type="button"
                    className={cn("y-disc-track", on && "is-on")}
                    onClick={() => playFrom(i)}
                  >
                    <span className="y-disc-track__num">{on ? "♪" : String(i + 1).padStart(2, "0")}</span>
                    <span className="y-disc-track__name">{file.name}</span>
                    <span className="y-disc-track__size">{formatSize(sizeByTrackId.get(file.path))}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className={cn("y-disc-dl", unavailable && "is-disabled")}
            aria-disabled={unavailable}
            onClick={unavailable ? undefined : () => onDownload({ sourceId: summary.source_id, title: summary.title })}
          >
            {dlLabel}
          </button>
        </div>
      </div>

      {neighbors.length > 0 && (
        <div className="y-disc-card">
          <Sticker color="pink" section rotate={2}>
            相似作品 · にている
          </Sticker>
          <div className="y-disc-neighbors" style={{ marginTop: 4 }}>
            {neighbors.map((w) => (
              <button
                key={w.source_id}
                type="button"
                className="y-disc-neighbor"
                title={w.title}
                onClick={() => onPickNeighbor(w.source_id)}
              >
                <span className="y-disc-neighbor__cover">
                  {w.thumbnail_url || w.main_cover_url ? (
                    <img src={w.thumbnail_url || w.main_cover_url} alt="" loading="lazy" />
                  ) : (
                    <CoverPlaceholder color={coverColorFor(w.source_id)} label="COVER" />
                  )}
                </span>
                <span className="y-disc-neighbor__title">{w.title}</span>
                <span className="y-disc-neighbor__rate">★ {formatRate(w.rate)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
