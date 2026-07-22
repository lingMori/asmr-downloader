import "@/styles/pages/online.css";

import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { apiClient } from "@/lib/api";
import { keys } from "@/lib/keys";
import { useWorksStatus } from "@/hooks/useWorksStatus";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useGlobalPlayer } from "@/player";
import { PageHeader } from "@/components/PageHeader";
import {
  DownloadReviewDialog,
  type DownloadReviewItem,
} from "@/components/DownloadReviewDialog";
import { Chip, EmptyState, FadeIn, Skeleton, Toggle } from "@/components/ui";
import { OnlineCard } from "@/components/online/OnlineCard";

/** 每页 24 件(原型 renderVals 按 24 分页,dc.html:694) */
const PAGE_SIZE = 24;

/** 后端仅有 popular/recommend 两个推荐列表端点;原型的「最新/高分」无对应接口,不做 */
type OnlineSort = "popular" | "recommend";

type OnlineSearch = { sort: OnlineSort; subtitle: boolean };

/** URL search → 页面状态(默认值不依赖 URL 存在) */
function parseSearch(search: Record<string, unknown>): OnlineSearch {
  return {
    sort: search.sort === "recommend" ? "recommend" : "popular",
    subtitle:
      search.subtitle === 1 ||
      search.subtitle === "1" ||
      search.subtitle === true ||
      search.subtitle === "true",
  };
}

/**
 * 在线曲库(原型 dc.html:280-321):热门/推荐 + 仅字幕 + 4:3 网格卡。
 * 整卡点击 → /works/$sourceId 详情页(在详情页再决定播放);
 * 分页 = 无限滚动,哨兵入视自动加载下一页。
 */
export function OnlineScreen() {
  const { sort, subtitle } = parseSearch(
    useSearch({ strict: false }) as Record<string, unknown>,
  );
  const navigate = useNavigate();
  const { session } = useGlobalPlayer();

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
          return next;
        },
      });
    },
    [navigate],
  );

  // 无限滚动:queryKey 不含 page,逐页累加;翻页到没有下一页为止
  const listQuery = useInfiniteQuery({
    queryKey: keys.online.list({ sort, subtitle }),
    queryFn: ({ pageParam }) =>
      sort === "recommend"
        ? apiClient.getRecommendWorks({ page: pageParam, pageSize: PAGE_SIZE, subtitle })
        : apiClient.getPopularWorks({ page: pageParam, pageSize: PAGE_SIZE, subtitle }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.items.length >= PAGE_SIZE ? allPages.length + 1 : undefined,
  });

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.pages[0]?.total ?? 0;
  const hasNextPage = listQuery.hasNextPage ?? false;

  const sourceIds = useMemo(() => items.map((w) => w.source_id), [items]);
  const statusQuery = useWorksStatus(sourceIds);

  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    enabled: hasNextPage && !listQuery.isError && items.length > 0,
    onHit: () => {
      if (hasNextPage && !listQuery.isFetchingNextPage) {
        void listQuery.fetchNextPage();
      }
    },
  });

  const [reviewItem, setReviewItem] = useState<DownloadReviewItem | null>(null);

  return (
    <div className="y-page y-onl">
      <PageHeader
        title="在线曲库"
        kana="おんらいん"
        badge="asmr.one 直连 · 免下载即听"
        aside={
          <>
            <span className="y-onl-sorts">
              <Chip active={sort === "popular"} onClick={() => updateSearch({ sort: "popular" })}>
                热门
              </Chip>
              <Chip
                active={sort === "recommend"}
                onClick={() => updateSearch({ sort: "recommend" })}
              >
                为你推荐
              </Chip>
            </span>
            <span className="y-onl-filter">
              <span
                className="y-onl-filter__label"
                onClick={() => updateSearch({ subtitle: !subtitle })}
              >
                仅字幕
              </span>
              <Toggle
                checked={subtitle}
                onChange={(v) => updateSearch({ subtitle: v })}
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
          <div className="y-onl-grid">
            {items.map((work, i) => (
              <FadeIn key={work.source_id} index={i}>
                <OnlineCard
                  work={work}
                  status={statusQuery.map.get(work.source_id)}
                  playingNow={session?.sourceId === work.source_id}
                  stickerRotate={i % 2 ? 3 : -3}
                  onOpen={() =>
                    void navigate({
                      to: "/works/$sourceId",
                      params: { sourceId: work.source_id },
                    })
                  }
                  onDownload={() =>
                    setReviewItem({ sourceId: work.source_id, title: work.title })
                  }
                />
              </FadeIn>
            ))}
          </div>

          {/* 无限滚动:哨兵 + 加载中骨架 + 到底提示 */}
          {hasNextPage && (
            <div ref={sentinelRef} className="y-onl-sentinel" aria-hidden="true">
              {listQuery.isFetchingNextPage && (
                <div className="y-onl-grid">
                  <Skeleton variant="card" count={4} className="y-onl-skeleton" />
                </div>
              )}
            </div>
          )}
          {!hasNextPage && items.length > 0 && (
            <div className="y-onl-end">已经到底啦 · 共 {total.toLocaleString()} 部</div>
          )}
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
