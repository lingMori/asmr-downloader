import "@/styles/pages/library.css";

import { useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { apiClient, type LibraryFile } from "@/lib/api";
import { keys } from "@/lib/keys";
import { findSubtitleForAudio } from "@/lib/playback";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useGlobalPlayer, type PlaybackSession } from "@/player";
import { CoverPlaceholder, EmptyState, Skeleton } from "@/components/ui";
import { coverColorFor } from "@/components/library/coverColor";

/** 本地作品详情(原型缺失,按同范式补齐):页头 + 按 kind 分组的文件列表 */
export function LibraryDetailScreen() {
  const params = useParams({ strict: false }) as { id?: string };
  const id = params.id ?? "";
  const { session, currentTrack, playSession } = useGlobalPlayer();

  const detailQuery = useQuery({
    queryKey: keys.library.work(id),
    queryFn: () => apiClient.getLibraryWork(id),
    enabled: id.length > 0,
  });

  const data = detailQuery.data;
  const groups = useMemo(() => {
    const files = data?.files ?? [];
    return {
      audio: files.filter((f) => f.kind === "audio"),
      subtitle: files.filter((f) => f.kind === "subtitle"),
      image: files.filter((f) => f.kind === "image"),
      other: files.filter((f) => f.kind === "other"),
    };
  }, [data]);

  // 整作会话:全部音声按序,每轨用 playback.ts 的匹配逻辑配字幕
  const buildSession = (startIndex: number): PlaybackSession | null => {
    if (!data || groups.audio.length === 0) return null;
    const { summary } = data;
    return {
      sourceId: summary.media_id,
      workTitle: summary.title,
      coverUrl: summary.thumbnail_url || groups.image[0]?.url,
      rj: summary.media_id,
      tracks: groups.audio.map((file) => ({
        id: file.path,
        title: file.name,
        url: file.url,
        subtitleUrl: findSubtitleForAudio(groups.subtitle, file)?.url,
      })),
      startIndex,
      stream: false,
    };
  };

  const play = (startIndex: number) => {
    const next = buildSession(startIndex);
    if (next) playSession(next);
  };

  if (detailQuery.isLoading) {
    return (
      <div className="y-page">
        <Skeleton className="y-lib-hero__skeleton" />
        <div className="y-lib-detail__skeleton-rows">
          <Skeleton variant="row" count={4} />
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !data) {
    const message = detailQuery.error instanceof Error ? detailQuery.error.message : "";
    const notFound = /404|not.?found/i.test(message);
    return (
      <div className="y-page">
        <Link to="/library" className="y-lib-detail__back">
          ‹ 媒体库
        </Link>
        {notFound ? (
          <EmptyState
            icon="404"
            action={
              <Link to="/library" className="y-btn-ghost">
                回媒体库
              </Link>
            }
          >
            作品不存在或已被移除
          </EmptyState>
        ) : (
          <div className="y-hint y-lib-error" role="alert">
            作品详情加载失败:{message || "未知错误"}
            <button
              type="button"
              className="y-btn-ghost"
              onClick={() => void detailQuery.refetch()}
            >
              重试
            </button>
          </div>
        )}
      </div>
    );
  }

  const { summary } = data;
  const coverUrl = summary.thumbnail_url || groups.image[0]?.url;
  const isCurrentWork = session?.sourceId === summary.media_id;

  return (
    <div className="y-page">
      <Link to="/library" className="y-lib-detail__back">
        ‹ 媒体库
      </Link>

      <div className="y-lib-detail__head">
        <div className="y-lib-detail__cover">
          {coverUrl ? (
            <img src={coverUrl} alt={summary.title} />
          ) : (
            <CoverPlaceholder color={coverColorFor(summary.id)} />
          )}
        </div>
        <div className="y-lib-detail__info">
          <h1 className="y-lib-detail__title">{summary.title}</h1>
          <div className="y-lib-detail__id">{summary.media_id}</div>
          <div className="y-lib-detail__chips">
            <span className="y-lib-chip">音声 {groups.audio.length}</span>
            <span className="y-lib-chip">字幕 {groups.subtitle.length}</span>
            {summary.release_date && (
              <span className="y-lib-chip">{formatDate(summary.release_date)}</span>
            )}
            {summary.has_subtitles && <span className="y-lib-chip">字幕あり</span>}
          </div>
          <div className="y-lib-detail__actions">
            <button
              type="button"
              className="y-btn-primary"
              disabled={groups.audio.length === 0}
              onClick={() => play(0)}
            >
              ▶ 播放整作
            </button>
          </div>
        </div>
      </div>

      <FileGroup title="音声" files={groups.audio}>
        {(file, index) => {
          const isCurrent = isCurrentWork && currentTrack?.id === file.path;
          return (
            <button
              type="button"
              className={cn("y-lib-file", isCurrent && "is-on")}
              onClick={() => play(index)}
            >
              <span className="y-lib-file__num">{String(index + 1).padStart(2, "0")}</span>
              <span className="y-lib-file__name">{file.name}</span>
              {isCurrent && (
                <span className="y-lib-file__now" aria-label="播放中">
                  ♪
                </span>
              )}
            </button>
          );
        }}
      </FileGroup>

      <FileGroup title="字幕" files={groups.subtitle}>
        {(file) => (
          <div className="y-lib-file y-lib-file--static">
            <span className="y-lib-file__badge">字幕</span>
            <span className="y-lib-file__name">{file.name}</span>
          </div>
        )}
      </FileGroup>

      <FileGroup title="图片" files={groups.image}>
        {(file) => (
          <a className="y-lib-file" href={file.url} target="_blank" rel="noreferrer">
            <span className="y-lib-file__name">{file.name}</span>
            <span className="y-lib-file__open" aria-hidden="true">
              ↗
            </span>
          </a>
        )}
      </FileGroup>

      <FileGroup title="其他" files={groups.other}>
        {(file) => (
          <div className="y-lib-file y-lib-file--static">
            <span className="y-lib-file__name">{file.name}</span>
          </div>
        )}
      </FileGroup>
    </div>
  );
}

function FileGroup({
  title,
  files,
  children,
}: {
  title: string;
  files: LibraryFile[];
  children: (file: LibraryFile, index: number) => React.ReactNode;
}) {
  if (files.length === 0) return null;
  return (
    <section className="y-lib-group" aria-label={title}>
      <div className="y-lib-group__title">
        {title}
        <span className="y-lib-group__count">{files.length}</span>
      </div>
      <div className="y-lib-group__list">
        {files.map((file, index) => (
          <Fragment key={file.path}>{children(file, index)}</Fragment>
        ))}
      </div>
    </section>
  );
}
