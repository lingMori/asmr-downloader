import "@/styles/pages/library.css";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Heart, Moon } from "@phosphor-icons/react";
import { apiClient } from "@/lib/api";
import { keys } from "@/lib/keys";
import { useCollections } from "@/hooks/useCollections";
import { useWorksStatus } from "@/hooks/useWorksStatus";
import { useStreamSession } from "@/hooks/useStreamSession";
import { useGlobalPlayer } from "@/player";
import { Chip, EmptyState, FadeIn, Pagination, Skeleton } from "@/components/ui";
import {
  DownloadReviewDialog,
  type DownloadReviewItem,
} from "@/components/DownloadReviewDialog";
import { ContinueHero } from "@/components/library/ContinueHero";
import { CollectionCard } from "@/components/library/CollectionCard";
import { WorkCard } from "@/components/library/WorkCard";

const PAGE_SIZE = 24;

type LibTab = "all" | "sub";

function parseTab(value: unknown): LibTab {
  return value === "sub" ? "sub" : "all";
}

function parsePage(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/**
 * 媒体库(收藏即入库):hero 继续收听 →「收藏作品 · これから」(服务端
 * collections,可串流/可取消收藏/可下载)→「本地作品 らいぶらり」
 * (已下载文件,URL 状态 tab/q/page)。
 */
export function LibraryScreen() {
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const tab = parseTab(rawSearch.tab);
  const q = typeof rawSearch.q === "string" ? rawSearch.q : "";
  const page = parsePage(rawSearch.page);
  const navigate = useNavigate();
  const { session } = useGlobalPlayer();

  const updateSearch = (patch: { tab?: LibTab; q?: string; page?: number }) => {
    void navigate({
      to: "/library",
      search: (prev: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        // 默认值不留在 URL 上
        if (!next.tab || next.tab === "all") delete next.tab;
        if (!next.q) delete next.q;
        if (!next.page || next.page === 1) delete next.page;
        return next;
      },
    });
  };

  // 搜索框:本地输入 300ms 防抖后写入 URL(?q= 即服务端 search 参数)
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== q) updateSearch({ q: trimmed, page: 1 });
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, q]);

  const heroQuery = useQuery({
    queryKey: keys.playback.latest(1),
    queryFn: () => apiClient.getLatestPlaybackProgress(1),
  });

  // ── 收藏作品(收藏即入库):全量 collections + 批量 works/status ──
  const collectionsQuery = useCollections();
  const collections = collectionsQuery.items;
  const collectionIds = useMemo(() => collections.map((c) => c.source_id), [collections]);
  const collectionStatus = useWorksStatus(collectionIds);
  const { playWorkStream, loadingId } = useStreamSession();
  const [reviewItem, setReviewItem] = useState<DownloadReviewItem | null>(null);

  const worksQuery = useQuery({
    queryKey: keys.library.works({ page, pageSize: PAGE_SIZE, search: q }),
    queryFn: () =>
      apiClient.getLibraryWorks({ page, pageSize: PAGE_SIZE, search: q || undefined }),
  });

  const items = useMemo(() => worksQuery.data?.items ?? [], [worksQuery.data]);
  const total = worksQuery.data?.total ?? 0;
  // 本地卡的 ♡ 收藏标记走服务端 works/status.collected(按 media_id 批量)
  const localStatus = useWorksStatus(useMemo(() => items.map((w) => w.media_id), [items]));
  // 计数口径:全部 = API total;有字幕 = 当前已加载页内计数(后端无对应聚合接口)
  const subCount = items.filter((w) => w.has_subtitles).length;
  const visible = items.filter((w) => {
    if (tab === "sub") return w.has_subtitles;
    return true;
  });

  const latest = heroQuery.data?.items[0];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const libraryEmpty = worksQuery.isSuccess && total === 0 && !q;

  return (
    <div className="y-page">
      {heroQuery.isLoading ? (
        <Skeleton className="y-lib-hero__skeleton" />
      ) : heroQuery.isError ? (
        <div className="y-hint" role="alert">
          收听记录加载失败
          <button type="button" className="y-btn-ghost" onClick={() => void heroQuery.refetch()}>
            重试
          </button>
        </div>
      ) : latest ? (
        <ContinueHero item={latest} />
      ) : (
        <div className="y-lib-hero--empty">
          <span className="y-lib-hero__moon" aria-hidden="true">
            <Moon size={22} />
          </span>
          <p>还没有收听记录 — 去发现或在线挑一部作品吧</p>
          <div className="y-lib-hero__empty-actions">
            <Link to="/discover" className="y-btn-ghost">
              去发现
            </Link>
            <Link to="/online" className="y-btn-ghost">
              去在线
            </Link>
          </div>
        </div>
      )}

      {/* ── 收藏作品 · これから(收藏即入库,下载只是离线可选) ── */}
      <div className="y-lib-section">
        <h2 className="y-lib-section__title">收藏作品</h2>
        <span className="y-kana">これから</span>
        {collections.length > 0 && <span className="y-lib-stat">{collections.length} 部</span>}
      </div>
      {collectionsQuery.isError ? (
        <div className="y-hint" role="alert">
          收藏作品加载失败:
          {collectionsQuery.error instanceof Error ? collectionsQuery.error.message : "未知错误"}
          <button
            type="button"
            className="y-btn-ghost"
            onClick={() => void collectionsQuery.refetch()}
          >
            重试
          </button>
        </div>
      ) : collectionsQuery.isLoading ? (
        <div className="y-lib-grid">
          <Skeleton variant="card" count={4} />
        </div>
      ) : collections.length === 0 ? (
        <div className="y-lib-collect-empty">
          还没有收藏作品 — 在发现或在线点 <Heart size={11} className="y-lib-collect-empty__heart" />
          ,收藏即入库
        </div>
      ) : (
        <div className="y-lib-grid">
          {collections.map((work, i) => (
            <FadeIn key={work.source_id} index={i}>
              <CollectionCard
                work={work}
                status={collectionStatus.map.get(work.source_id)}
                nowPlaying={session?.sourceId === work.source_id}
                loading={loadingId === work.source_id}
                stickerRotate={i % 2 ? -3 : 3}
                onPlay={() =>
                  void playWorkStream(work.source_id, {
                    workTitle: work.title,
                    coverUrl: work.thumbnail_url || work.main_cover_url,
                    cv: work.vas.join("、"),
                    rj: work.source_id,
                  })
                }
                onDownload={() => setReviewItem({ sourceId: work.source_id, title: work.title })}
              />
            </FadeIn>
          ))}
        </div>
      )}

      {/* ── 本地作品 · らいぶらり(已下载文件) ── */}
      <div className="y-lib-section">
        <h2 className="y-lib-section__title">本地作品</h2>
        <span className="y-kana">らいぶらり</span>
        <div className="y-lib-tabs" role="group" aria-label="媒体库筛选">
          <Chip active={tab === "all"} onClick={() => updateSearch({ tab: "all", page: 1 })}>
            全部 {total}
          </Chip>
          <Chip active={tab === "sub"} onClick={() => updateSearch({ tab: "sub", page: 1 })}>
            有字幕 {subCount}
          </Chip>
        </div>
        <input
          type="search"
          className="y-lib-search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索标题 / RJ 号…"
          aria-label="搜索本地作品"
        />
        <span className="y-lib-stat">{total} 部</span>
      </div>

      {worksQuery.isError ? (
        <div className="y-hint y-lib-error" role="alert">
          本地作品加载失败:
          {worksQuery.error instanceof Error ? worksQuery.error.message : "未知错误"}
          <button type="button" className="y-btn-ghost" onClick={() => void worksQuery.refetch()}>
            重试
          </button>
        </div>
      ) : worksQuery.isLoading ? (
        <div className="y-lib-grid">
          <Skeleton variant="card" count={8} />
        </div>
      ) : libraryEmpty ? (
        <EmptyState
          action={
            <div className="y-lib-hero__empty-actions">
              <Link to="/discover" className="y-btn-ghost">
                去发现下载
              </Link>
              <Link to="/settings" className="y-btn-ghost">
                去设置查看存储路径
              </Link>
            </div>
          }
        >
          媒体库是空的
          <br />
          下载完成的作品会出现在这里
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState>没有匹配的作品,换个筛选或关键词试试</EmptyState>
      ) : (
        <>
          <div className="y-lib-grid">
            {visible.map((work, i) => (
              <FadeIn key={work.id} index={i}>
                <WorkCard
                  work={work}
                  stickerRotate={i % 2 ? -3 : 3}
                  nowPlaying={session?.sourceId === work.media_id}
                  collected={localStatus.map.get(work.media_id)?.collected ?? false}
                />
              </FadeIn>
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              className="y-lib-pagination"
              page={page}
              totalPages={totalPages}
              onPage={(p) => updateSearch({ page: p })}
            />
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
