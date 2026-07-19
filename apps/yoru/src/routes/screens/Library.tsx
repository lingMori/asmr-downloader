import "@/styles/pages/library.css";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { apiClient } from "@/lib/api";
import { keys } from "@/lib/keys";
import { useFavorites } from "@/lib/favorites";
import { useGlobalPlayer } from "@/player";
import { Chip, EmptyState, Pagination, Skeleton } from "@/components/ui";
import { ContinueHero } from "@/components/library/ContinueHero";
import { WorkCard } from "@/components/library/WorkCard";

const PAGE_SIZE = 24;

type LibTab = "all" | "sub" | "fav";

function parseTab(value: unknown): LibTab {
  return value === "sub" || value === "fav" ? value : "all";
}

function parsePage(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/** 媒体库(继续收听 hero + 本地作品网格;URL 状态 tab/q/page) */
export function LibraryScreen() {
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const tab = parseTab(rawSearch.tab);
  const q = typeof rawSearch.q === "string" ? rawSearch.q : "";
  const page = parsePage(rawSearch.page);
  const navigate = useNavigate();
  const { session } = useGlobalPlayer();
  const favorites = useFavorites();

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

  const worksQuery = useQuery({
    queryKey: keys.library.works({ page, pageSize: PAGE_SIZE, search: q }),
    queryFn: () =>
      apiClient.getLibraryWorks({ page, pageSize: PAGE_SIZE, search: q || undefined }),
  });

  const items = useMemo(() => worksQuery.data?.items ?? [], [worksQuery.data]);
  const total = worksQuery.data?.total ?? 0;
  // 计数口径:全部 = API total;有字幕/收藏 = 当前已加载页内计数(后端无对应聚合接口)
  const subCount = items.filter((w) => w.has_subtitles).length;
  const favCount = items.filter((w) => favorites.has(w.id)).length;
  const visible = items.filter((w) => {
    if (tab === "sub") return w.has_subtitles;
    if (tab === "fav") return favorites.has(w.id);
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
            ☾
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
          <Chip active={tab === "fav"} onClick={() => updateSearch({ tab: "fav", page: 1 })}>
            收藏 ♡ {favCount}
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
              <WorkCard
                key={work.id}
                work={work}
                stickerRotate={i % 2 ? -3 : 3}
                nowPlaying={session?.sourceId === work.media_id}
                fav={favorites.has(work.id)}
                onToggleFav={() => favorites.toggle(work.id)}
              />
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
    </div>
  );
}
