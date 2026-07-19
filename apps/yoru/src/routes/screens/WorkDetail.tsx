import "@/styles/pages/workdetail.css";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { apiClient, type LibraryFile } from "@/lib/api";
import { keys } from "@/lib/keys";
import { findSubtitleForAudio } from "@/lib/playback";
import { formatCount, formatDate, formatDuration, formatRate } from "@/lib/format";
import { useWorksStatus } from "@/hooks/useWorksStatus";
import { useGlobalPlayer, type PlaybackSession } from "@/player";
import { CoverPlaceholder, EmptyState, Skeleton, Sticker } from "@/components/ui";
import { CollectButton } from "@/components/CollectButton";
import { DownloadButton } from "@/components/WorkBadge";
import { DownloadReviewDialog } from "@/components/DownloadReviewDialog";
import { coverColorFor } from "@/components/library/coverColor";
import { FileTree } from "@/components/workdetail/FileTree";
import {
  attachPlayHandlers,
  buildLocalFileTree,
  buildRemoteTrackTree,
  flattenLeaves,
  type FileTreeNode,
} from "@/components/workdetail/tree";

function leafAsLibraryFile(leaf: FileTreeNode): LibraryFile {
  return { path: leaf.id, name: leaf.name, kind: "audio", url: leaf.url ?? "" };
}

/**
 * 统一作品详情 /works/$sourceId:任何作品(本地已下载/仅收藏/纯远端)同一页。
 * 装配顺序:works/status → (in_library 时)library 文件树 + discover 远端元数据
 * (远端失败不致命,仅本地信息 + 虚线提示)→ 远端成功再拉相似作品。
 */
export function WorkDetailScreen() {
  const params = useParams({ strict: false }) as { sourceId?: string };
  const sourceId = params.sourceId ?? "";
  const navigate = useNavigate();
  const player = useGlobalPlayer();
  const [reviewOpen, setReviewOpen] = useState(false);

  // 1) 本地状态:in_library?library_id?collected?
  const statusQuery = useWorksStatus(sourceId ? [sourceId] : []);
  const status = statusQuery.map.get(sourceId);
  const inLibrary = status?.state === "in_library";
  const libraryId = inLibrary ? status?.library_id : undefined;

  // 2) 本地文件树(已入库时)
  const libraryQuery = useQuery({
    queryKey: keys.library.work(libraryId ?? ""),
    queryFn: () => apiClient.getLibraryWork(libraryId!),
    enabled: Boolean(libraryId),
  });

  // 3) 远端元数据 + 在线音轨树(失败不致命:镜像不可达时仅展示本地信息)
  const discoverQuery = useQuery({
    queryKey: keys.discover.work(sourceId),
    queryFn: () => apiClient.getDiscoverWork(sourceId),
    enabled: sourceId.length > 0,
  });

  // 4) 相似作品(远端成功才拉)
  const neighborsQuery = useQuery({
    queryKey: keys.discover.neighbors(sourceId),
    queryFn: () => apiClient.getWorkNeighbors(sourceId),
    enabled: discoverQuery.isSuccess,
  });

  const local = libraryQuery.data;
  const remote = discoverQuery.data;

  // 双数据源各自建树;audio 叶 DFS 序 = 会话 tracks 序
  const localTree = useMemo(() => buildLocalFileTree(local?.files ?? []), [local]);
  const remoteTree = useMemo(() => buildRemoteTrackTree(remote?.tracks ?? []), [remote]);
  const localAudio = useMemo(() => flattenLeaves(localTree, "audio"), [localTree]);
  const remoteAudio = useMemo(() => flattenLeaves(remoteTree, "audio"), [remoteTree]);
  const localSubtitleFiles = useMemo(
    () => (local?.files ?? []).filter((f) => f.kind === "subtitle"),
    [local],
  );
  const remoteSubtitleLeaves = useMemo(
    () => flattenLeaves(remoteTree, "subtitle"),
    [remoteTree],
  );

  const summary = remote?.summary;
  const localSummary = local?.summary;
  const workKey = summary?.source_id || localSummary?.media_id || sourceId;
  const title = summary?.title || localSummary?.title || sourceId;
  const coverUrl =
    summary?.main_cover_url ||
    summary?.thumbnail_url ||
    localSummary?.thumbnail_url ||
    local?.files.find((f) => f.kind === "image")?.url ||
    undefined;
  const cv = (summary?.vas ?? []).join("、");
  const circle = summary?.circle ?? "";
  const release = formatDate(summary?.release || localSummary?.release_date);
  const hasSubtitle = Boolean(summary?.has_subtitle || localSummary?.has_subtitles);

  const buildSession = (startIndex: number, fromLocal: boolean): PlaybackSession => {
    const leaves = fromLocal ? localAudio : remoteAudio;
    const subtitles: LibraryFile[] = fromLocal
      ? localSubtitleFiles
      : remoteSubtitleLeaves.map((leaf) => ({
          path: leaf.id,
          name: leaf.name,
          kind: "subtitle",
          url: leaf.url ?? "",
        }));
    return {
      sourceId: workKey,
      workTitle: title,
      coverUrl,
      tracks: leaves.map((leaf) => ({
        id: leaf.id,
        title: leaf.name,
        url: leaf.url ?? "",
        duration: leaf.duration,
        subtitleUrl: findSubtitleForAudio(subtitles, leafAsLibraryFile(leaf))?.url,
      })),
      startIndex,
      stream: !fromLocal,
      cv: cv || undefined,
      rj: workKey,
    };
  };

  // 叶点击 = 显式选轨:直接播,不走整作续播
  const play = (startIndex: number, fromLocal: boolean) => {
    player.playSession(buildSession(startIndex, fromLocal));
  };
  // 本地优先:有本地音频轨播本地,否则远端串流;整作入口按历史进度续播
  const canPlay = localAudio.length > 0 || remoteAudio.length > 0;
  const playMain = () => {
    if (localAudio.length > 0) player.playSession(buildSession(0, true), { resumeWork: true });
    else if (remoteAudio.length > 0) player.playSession(buildSession(0, false), { resumeWork: true });
  };

  const localTreeWithPlay = attachPlayHandlers(localTree, (i) => play(i, true));
  const remoteTreeWithPlay = attachPlayHandlers(remoteTree, (i) => play(i, false));

  const sessionForWork = player.session?.sourceId === workKey ? player.session : null;
  const localActiveId = sessionForWork && !sessionForWork.stream ? player.currentTrack?.id : undefined;
  const remoteActiveId = sessionForWork?.stream ? player.currentTrack?.id : undefined;

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: "/library" });
  };
  const backLink = (
    <button type="button" className="y-wd__back" onClick={goBack}>
      ‹ 返回
    </button>
  );

  const pending =
    statusQuery.isLoading || discoverQuery.isLoading || libraryQuery.isLoading;
  if (pending) {
    return (
      <div className="y-page">
        <Skeleton className="y-wd-skel-head" />
        <div className="y-wd-skel-rows">
          <Skeleton variant="row" count={5} />
        </div>
      </div>
    );
  }

  // 两者都失败:作品不存在或暂时不可用
  if (!remote && !local) {
    return (
      <div className="y-page">
        {backLink}
        <EmptyState
          action={
            <Link to="/library" className="y-btn-ghost">
              回媒体库
            </Link>
          }
        >
          作品不存在或暂时不可用
        </EmptyState>
      </div>
    );
  }

  // 指标格:远端 = asmr.one 作品页同构的 8 项(4×2);仅本地 = 文件统计
  const metrics = summary
    ? [
        { k: "发售日", v: release || "-" },
        { k: "价格", v: `¥${formatCount(remote!.price)}` },
        { k: "评分", v: formatRate(summary.rate) },
        { k: "评价", v: `${formatCount(remote!.rate_count)} 人` },
        { k: "评论", v: formatCount(remote!.review_count) },
        { k: "销量", v: formatCount(summary.dl_count) },
        { k: "时长", v: formatDuration(summary.duration) },
        { k: "音轨", v: `${remoteAudio.length} 轨` },
      ]
    : [
        { k: "文件数", v: formatCount(localSummary?.file_count) },
        { k: "音轨数", v: formatCount(localSummary?.audio_file_count) },
        { k: "字幕数", v: formatCount(localSummary?.subtitle_count) },
        { k: "发售日", v: release || "-" },
      ];

  const tags = summary?.tags ?? [];
  const vas = summary?.vas ?? [];
  const ageLabel = (() => {
    const raw = remote?.age_category?.toLowerCase();
    if (!raw) return undefined;
    if (raw === "adult") return "18禁";
    if (raw === "r15") return "R-15";
    if (raw === "general" || raw === "all" || raw === "all ages") return "全年龄";
    return undefined;
  })();

  const collectWork = summary ?? {
    source_id: workKey,
    title,
    circle: "",
    vas: [] as string[],
    tags: [] as string[],
    release: localSummary?.release_date ?? "",
    has_subtitle: hasSubtitle,
    thumbnail_url: localSummary?.thumbnail_url,
  };
  const neighbors = (neighborsQuery.data?.items ?? [])
    .filter((w) => w.source_id !== workKey)
    .slice(0, 6);

  return (
    <div className="y-page">
      {backLink}

      {/* 头卡(信息架构参考 asmr.one 作品页):
          长方形封面(自然比例)+ RJ/分级/状态行 + 标题 + 社团/发售
          + 声优/标签 chips(点击去发现筛选)+ 4×2 指标格 + 操作行 */}
      <div className="y-wd-head">
        <div className="y-wd-cover">
          {coverUrl ? (
            <img src={coverUrl} alt={title} />
          ) : (
            <CoverPlaceholder color={coverColorFor(workKey)} label="封面 · COVER" />
          )}
        </div>
        <div className="y-wd-info">
          <div className="y-wd-idrow">
            <span className="y-wd-rj">{workKey}</span>
            {ageLabel && <span className="y-wd-age">{ageLabel}</span>}
            {hasSubtitle && (
              <Sticker className="y-sticker--inline" rotate={-2}>
                字幕あり
              </Sticker>
            )}
            {inLibrary && <span className="y-status-badge">已下载 ✓</span>}
            {status?.collected && <span className="y-status-badge">已收藏 ♡</span>}
          </div>
          <h1 className="y-wd-title">{title}</h1>
          {(circle || release) && (
            <div className="y-wd-meta">
              {circle && (
                <>
                  社团{" "}
                  <Link to="/discover" search={{ circle }} className="y-wd-link">
                    {circle}
                  </Link>
                </>
              )}
              {circle && release && " · "}
              {release && `发售 ${release}`}
            </div>
          )}
          {vas.length > 0 && (
            <div className="y-wd-chiprow" aria-label="声优">
              <span className="y-wd-chiprow__label">声优</span>
              {vas.map((v) => (
                <Link
                  key={v}
                  to="/discover"
                  search={{ va: v }}
                  className="y-wd-chip y-wd-chip--cv"
                >
                  {v}
                </Link>
              ))}
            </div>
          )}
          {tags.length > 0 && (
            <div className="y-wd-chiprow" aria-label="标签">
              <span className="y-wd-chiprow__label">标签</span>
              {tags.map((t) => (
                <Link key={t} to="/discover" search={{ tags: t }} className="y-wd-chip">
                  #{t}
                </Link>
              ))}
            </div>
          )}
          <div className="y-wd-metrics">
            {metrics.map((m) => (
              <div key={m.k} className="y-metric">
                <div className="y-metric__label">{m.k}</div>
                <div className="y-metric__value">{m.v}</div>
              </div>
            ))}
          </div>
          {/* 操作行:播放(本地优先)+ 收藏(入库)+ 下载(三态)+ 源站外链 */}
          <div className="y-wd-actions">
            <button
              type="button"
              className="y-btn-primary"
              disabled={!canPlay}
              onClick={playMain}
            >
              ▶ 播放
            </button>
            <CollectButton work={collectWork} collected={Boolean(status?.collected)} />
            <DownloadButton status={status} onDownload={() => setReviewOpen(true)} />
            {remote?.source_url && (
              <a
                className="y-wd-source"
                href={remote.source_url}
                target="_blank"
                rel="noreferrer"
              >
                源站链接 ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 远端不可达但已有本地内容:虚线提示,不阻塞 */}
      {discoverQuery.isError && (
        <div className="y-hint y-wd-hint">在线信息暂时不可用 — 检查镜像或网络</div>
      )}

      {/* 文件层级:本地文件(入库时) */}
      {local && localTreeWithPlay.length > 0 && (
        <section className="y-wd-section" aria-label="本地文件">
          <h2 className="y-wd-section__title">
            本地文件 · <span className="y-wd-section__kana">ろーかる</span>
            <span className="y-wd-section__count">{local.files.length} 项</span>
          </h2>
          <FileTree nodes={localTreeWithPlay} activeId={localActiveId} />
        </section>
      )}

      {/* 文件层级:在线音轨(远端成功时) */}
      {remote && remoteTreeWithPlay.length > 0 && (
        <section className="y-wd-section" aria-label="在线音轨">
          <h2 className="y-wd-section__title">
            在线音轨 · <span className="y-wd-section__kana">おんらいん</span>
            <span className="y-wd-section__count">{flattenLeaves(remoteTree).length} 项</span>
          </h2>
          <FileTree nodes={remoteTreeWithPlay} activeId={remoteActiveId} />
        </section>
      )}

      {/* 相似作品(远端成功时) */}
      {neighbors.length > 0 && (
        <section className="y-wd-section" aria-label="相似作品">
          <h2 className="y-wd-section__title">
            相似作品 · <span className="y-wd-section__kana">にてる</span>
          </h2>
          <div className="y-wd-neighbors">
            {neighbors.map((w) => (
              <Link
                key={w.source_id}
                to="/works/$sourceId"
                params={{ sourceId: w.source_id }}
                className="y-wd-neighbor"
                title={w.title}
              >
                <span className="y-wd-neighbor__cover">
                  {w.thumbnail_url || w.main_cover_url ? (
                    <img src={w.thumbnail_url || w.main_cover_url} alt="" loading="lazy" />
                  ) : (
                    <CoverPlaceholder color={coverColorFor(w.source_id)} label="COVER" />
                  )}
                </span>
                <span className="y-wd-neighbor__title">{w.title}</span>
                <span className="y-wd-neighbor__rate">★ {formatRate(w.rate)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <DownloadReviewDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        items={[{ sourceId: workKey, title }]}
      />
    </div>
  );
}
