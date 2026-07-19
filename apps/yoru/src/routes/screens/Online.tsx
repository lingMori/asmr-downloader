import "@/styles/pages/online.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { apiClient, type DiscoverWorkSummary } from "@/lib/api";
import { keys } from "@/lib/keys";
import {
  findSubtitleForAudio,
  flattenPlayableTracks,
  flattenSubtitleTracks,
} from "@/lib/playback";
import { useWorksStatus } from "@/hooks/useWorksStatus";
import { useGlobalPlayer, type PlayerTrack } from "@/player";
import { PageHeader } from "@/components/PageHeader";
import {
  DownloadReviewDialog,
  type DownloadReviewItem,
} from "@/components/DownloadReviewDialog";
import { Chip, EmptyState, Pagination, Skeleton, Toggle } from "@/components/ui";
import { OnlineCard } from "@/components/online/OnlineCard";

/** 每页 24 件(原型 renderVals 按 24 分页,dc.html:694) */
const PAGE_SIZE = 24;

/** 后端仅有 popular/recommend 两个推荐列表端点;原型的「最新/高分」无对应接口,不做 */
type OnlineSort = "popular" | "recommend";

type OnlineSearch = { sort: OnlineSort; subtitle: boolean; page: number };

/** URL search → 页面状态(默认值不依赖 URL 存在) */
function parseSearch(search: Record<string, unknown>): OnlineSearch {
  const rawPage = Number(search.page);
  return {
    sort: search.sort === "recommend" ? "recommend" : "popular",
    subtitle:
      search.subtitle === 1 ||
      search.subtitle === "1" ||
      search.subtitle === true ||
      search.subtitle === "true",
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
  };
}

/** 在线曲库(原型 dc.html:280-321):热门/推荐 + 仅字幕 + 4:3 网格卡 + 串流即听 */
export function OnlineScreen() {
  const { sort, subtitle, page } = parseSearch(
    useSearch({ strict: false }) as Record<string, unknown>,
  );
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, playing, playSession, toggle } = useGlobalPlayer();

  /** URL 即状态:写回时剔除默认值,保持地址干净 */
  const updateSearch = useCallback(
    (patch: Partial<OnlineSearch>) => {
      void navigate({
        to: "/online",
        search: (prev: Record<string, unknown>) => {
          const merged = parseSearch({ ...prev, ...patch });
          const next: Record<string, unknown> = {};
          if (merged.sort !== "popular") next.sort = merged.sort;
          if (merged.subtitle) next.subtitle = 1;
          if (merged.page > 1) next.page = merged.page;
          return next;
        },
      });
    },
    [navigate],
  );

  const listQuery = useQuery({
    queryKey: keys.online.list({ sort, subtitle, page, pageSize: PAGE_SIZE }),
    queryFn: () =>
      sort === "recommend"
        ? apiClient.getRecommendWorks({ page, pageSize: PAGE_SIZE, subtitle })
        : apiClient.getPopularWorks({ page, pageSize: PAGE_SIZE, subtitle }),
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(
    1,
    Math.ceil(total / (listQuery.data?.page_size || PAGE_SIZE)),
  );

  // URL page 超出实际页数时收敛到末页(原型 renderVals:695 的 opage 钳制)
  useEffect(() => {
    if (listQuery.data && !listQuery.isPlaceholderData && page > totalPages) {
      updateSearch({ page: totalPages });
    }
  }, [listQuery.data, listQuery.isPlaceholderData, page, totalPages, updateSearch]);

  const sourceIds = useMemo(() => items.map((w) => w.source_id), [items]);
  const statusQuery = useWorksStatus(sourceIds);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [reviewItem, setReviewItem] = useState<DownloadReviewItem | null>(null);

  /** 整卡/圆钮点击:该作在播 → toggle;否则拉音轨树建串流会话 */
  const playWork = async (work: DiscoverWorkSummary) => {
    if (session?.sourceId === work.source_id) {
      toggle();
      return;
    }
    if (loadingId) return;
    setLoadingId(work.source_id);
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: keys.discover.work(work.source_id),
        queryFn: () => apiClient.getDiscoverWork(work.source_id),
        staleTime: 60_000,
      });
      const subtitles = flattenSubtitleTracks(detail.tracks);
      const tracks: PlayerTrack[] = flattenPlayableTracks(detail.tracks).map((audio) => ({
        id: audio.path,
        title: audio.name,
        url: audio.url,
        subtitleUrl: findSubtitleForAudio(subtitles, audio)?.url,
      }));
      if (tracks.length === 0) {
        toast.error("该作品暂无可播放的音轨");
        return;
      }
      playSession({
        sourceId: work.source_id,
        workTitle: work.title,
        coverUrl: work.thumbnail_url || work.main_cover_url,
        tracks,
        startIndex: 0,
        stream: true,
        cv: work.vas.join("、"),
        rj: work.source_id,
      });
    } catch (err) {
      toast.error(`加载音轨失败:${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="y-page y-onl">
      <PageHeader
        title="在线曲库"
        kana="おんらいん"
        badge="asmr.one 直连 · 免下载即听"
        aside={
          <>
            <span className="y-onl-sorts">
              <Chip
                active={sort === "popular"}
                onClick={() => updateSearch({ sort: "popular", page: 1 })}
              >
                热门
              </Chip>
              <Chip
                active={sort === "recommend"}
                onClick={() => updateSearch({ sort: "recommend", page: 1 })}
              >
                为你推荐
              </Chip>
            </span>
            <span className="y-onl-filter">
              <span
                className="y-onl-filter__label"
                onClick={() => updateSearch({ subtitle: !subtitle, page: 1 })}
              >
                仅字幕
              </span>
              <Toggle
                checked={subtitle}
                onChange={(v) => updateSearch({ subtitle: v, page: 1 })}
                label="仅字幕"
              />
            </span>
            {listQuery.data && (
              <span className="y-onl-stat">共 {total.toLocaleString()} 部</span>
            )}
          </>
        }
      />

      {listQuery.isPending ? (
        <div className="y-onl-grid">
          <Skeleton variant="card" count={12} className="y-onl-skeleton" />
        </div>
      ) : listQuery.isError ? (
        <div className="y-onl-error">
          <span>
            加载失败:
            {listQuery.error instanceof Error ? listQuery.error.message : "未知错误"}
            。镜像可能不可达,<Link to="/settings">去设置检查 →</Link>
          </span>
          <Chip className="y-onl-error__retry" onClick={() => void listQuery.refetch()}>
            重试
          </Chip>
        </div>
      ) : items.length === 0 ? (
        <EmptyState className="y-onl-empty">暂时没有可展示的作品</EmptyState>
      ) : (
        <>
          <div className={listQuery.isPlaceholderData ? "y-onl-grid is-stale" : "y-onl-grid"}>
            {items.map((work, i) => (
              <OnlineCard
                key={work.source_id}
                work={work}
                status={statusQuery.map.get(work.source_id)}
                playingNow={session?.sourceId === work.source_id}
                playing={playing}
                loading={loadingId === work.source_id}
                stickerRotate={i % 2 ? 3 : -3}
                onPlay={() => void playWork(work)}
                onDownload={() =>
                  setReviewItem({ sourceId: work.source_id, title: work.title })
                }
              />
            ))}
          </div>
          <Pagination
            className="y-onl-pagination"
            page={page}
            totalPages={totalPages}
            onPage={(p) => updateSearch({ page: p })}
          />
        </>
      )}

      <DownloadReviewDialog
        open={reviewItem !== null}
        onClose={() => setReviewItem(null)}
        items={reviewItem ? [reviewItem] : []}
      />
    </div>
  );
}
