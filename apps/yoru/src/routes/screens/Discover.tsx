import "@/styles/pages/discover.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { apiClient, type DiscoverWorkSummary } from "@/lib/api";
import { keys } from "@/lib/keys";
import { cn } from "@/lib/utils";
import { findSubtitleForAudio, flattenPlayableTracks, flattenSubtitleTracks } from "@/lib/playback";
import { EmptyState, Skeleton } from "@/components/ui";
import { DownloadReviewDialog, type DownloadReviewItem } from "@/components/DownloadReviewDialog";
import { isWorkUnavailable, useWorksStatus } from "@/hooks/useWorksStatus";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useGlobalPlayer } from "@/player";
import { ActiveChips } from "@/components/discover/ActiveChips";
import { BatchBar } from "@/components/discover/BatchBar";
import { DetailPanel } from "@/components/discover/DetailPanel";
import { FacetCards, type DiscoverFacets } from "@/components/discover/FacetCards";
import { FilterPanel } from "@/components/discover/FilterPanel";
import { ResultRow } from "@/components/discover/ResultRow";
import { SearchBar } from "@/components/discover/SearchBar";
import { ToolsPanel, type DownloadScope } from "@/components/discover/ToolsPanel";
import {
  buildExportQuery,
  buildFacetsFromItems,
  coverColorFor,
  DEFAULT_DISCOVER_URL,
  isAdvancedQuery,
  parseDiscoverSearch,
  toDiscoverSearch,
  triggerBlobDownload,
  type DiscoverUrlState,
} from "@/components/discover/helpers";
import { useIsMobile } from "@/components/discover/hooks";

/** Phase 3:发现 /discover —— 搜索/筛选/facets/详情侧栏/批量下载(原型 dc.html:99-277) */
export function DiscoverScreen() {
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const url = useMemo(() => parseDiscoverSearch(rawSearch), [rawSearch]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const player = useGlobalPlayer();
  const isMobile = useIsMobile();

  // URL 即状态:全部条件改动经 setUrl 写回 search(刷新/分享保持)
  const setUrl = useCallback(
    (patch: Partial<DiscoverUrlState>) => {
      void navigate({
        to: "/discover",
        search: ((prev: Record<string, unknown>) =>
          toDiscoverSearch({ ...parseDiscoverSearch(prev), ...patch })) as never,
      });
    },
    [navigate],
  );

  const [showFilters, setShowFilters] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [outputDir, setOutputDir] = useState("");
  const [scope, setScope] = useState<DownloadScope>("page");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [reviewItems, setReviewItems] = useState<DownloadReviewItem[] | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const advanced = isAdvancedQuery(url.q);

  // 筛选变化时清空勾选(勾选只对当前结果集有意义;翻页为无限滚动,不影响勾选)
  const filterKey = JSON.stringify([
    url.q,
    url.tags,
    url.circle,
    url.va,
    url.subtitle,
    url.order,
    url.sort,
    url.pageSize,
  ]);
  useEffect(() => {
    setSelected(new Set());
  }, [filterKey]);

  // ── 数据源:q 含 $ → 高级语法走 /search;否则结构化 /discover/search。
  //    无限滚动:queryKey 不含 page,逐页累加;返回每批 items/total。
  const searchQuery = useInfiniteQuery({
    queryKey: keys.discover.search({
      q: url.q,
      tag: url.tags.join(","),
      circle: url.circle,
      va: url.va,
      subtitle: url.subtitle,
      order: url.order,
      sort: url.sort,
      pageSize: url.pageSize,
    }),
    queryFn: async ({ pageParam }): Promise<{ items: DiscoverWorkSummary[]; total: number }> => {
      if (advanced) {
        const data = await apiClient.searchWorks({
          query: url.q,
          count: url.pageSize,
          page: pageParam,
          pageSize: url.pageSize,
          order: url.order,
          sort: url.sort,
          subtitle: url.subtitle ? 1 : 0,
        });
        return { items: data.items as DiscoverWorkSummary[], total: data.total };
      }
      const data = await apiClient.searchDiscover({
        q: url.q,
        tag: url.tags.join(","),
        circle: url.circle,
        va: url.va,
        subtitle: url.subtitle,
        page: pageParam,
        pageSize: url.pageSize,
        order: url.order,
        sort: url.sort,
      });
      return { items: data.items, total: data.total };
    },
    initialPageParam: 1,
    getNextPageParam: (lastBatch, allBatches) =>
      lastBatch.items.length >= url.pageSize ? allBatches.length + 1 : undefined,
  });

  const items = useMemo(
    () => searchQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [searchQuery.data],
  );
  const total = searchQuery.data?.pages[0]?.total ?? 0;
  const hasNextPage = searchQuery.hasNextPage ?? false;
  // facets:对已加载结果集客户端精确聚合(原服务端 facets 本就只反映单页)
  const facets = useMemo(() => buildFacetsFromItems(items), [items]);

  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    enabled: hasNextPage && !searchQuery.isError && items.length > 0,
    onHit: () => {
      if (hasNextPage && !searchQuery.isFetchingNextPage) {
        void searchQuery.fetchNextPage();
      }
    },
  });

  // ── works/status:驱动徽章/禁选/置灰/下载钮三态 ──
  const pageIds = useMemo(() => items.map((w) => w.source_id), [items]);
  const { map: statusMap } = useWorksStatus(pageIds);
  const titleById = useMemo(() => new Map(items.map((w) => [w.source_id, w.title])), [items]);
  const loadedDownloadable = useMemo(
    () => items.filter((w) => !isWorkUnavailable(statusMap.get(w.source_id))),
    [items, statusMap],
  );
  const effectiveScope: DownloadScope = selected.size === 0 ? "page" : scope;

  const openReview = useCallback(
    (scopeKind: DownloadScope) => {
      const list =
        scopeKind === "selected"
          ? Array.from(selected).map((id) => ({ sourceId: id, title: titleById.get(id) ?? id }))
          : loadedDownloadable.map((w) => ({ sourceId: w.source_id, title: w.title }));
      if (list.length === 0) {
        toast.info("没有可下载的作品");
        return;
      }
      setReviewItems(list);
    },
    [selected, titleById, loadedDownloadable],
  );

  // ── 试听:取详情首个 playable track 建单轨 stream 会话 ──
  const previewWork = useCallback(
    async (work: DiscoverWorkSummary) => {
      setPreviewingId(work.source_id);
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: keys.discover.work(work.source_id),
          queryFn: () => apiClient.getDiscoverWork(work.source_id),
          staleTime: 60_000,
        });
        const audio = flattenPlayableTracks(detail.tracks);
        const subs = flattenSubtitleTracks(detail.tracks);
        const first = audio[0];
        if (!first) {
          toast.info("该作品没有可试听的音轨");
          return;
        }
        player.playSession({
          sourceId: work.source_id,
          workTitle: work.title,
          coverUrl: work.main_cover_url || work.thumbnail_url,
          tracks: [
            {
              id: first.path,
              title: first.name,
              url: first.url,
              subtitleUrl: findSubtitleForAudio(subs, first)?.url,
            },
          ],
          startIndex: 0,
          stream: true,
          cv: work.vas.join("、"),
          rj: work.source_id,
        });
      } catch (err) {
        toast.error(`试听失败:${err instanceof Error ? err.message : "未知错误"}`);
      } finally {
        setPreviewingId(null);
      }
    },
    [queryClient, player],
  );

  // ── 导出:组合查询(q 原样 + $tag:x$ $circle:y$ $va:z$),上限 200 条 ──
  const exportMutation = useMutation({
    mutationFn: async (format: "csv" | "json") => {
      const result = await apiClient.exportSearch({
        query: buildExportQuery(url),
        count: Math.min(total, 200),
        format,
      });
      triggerBlobDownload(result.blob, result.filename ?? `discover_export.${format}`);
      return format;
    },
    onSuccess: (format) => toast.success(`已导出搜索结果 ${format.toUpperCase()}`),
    onError: (err) => toast.error(`导出失败:${err instanceof Error ? err.message : "未知错误"}`),
  });

  const resetAll = useCallback(() => {
    setShowFilters(false);
    setShowTools(false);
    setSelected(new Set());
    setScope("page");
    void navigate({ to: "/discover", search: toDiscoverSearch(DEFAULT_DISCOVER_URL) as never });
  }, [navigate]);

  const addTag = useCallback(
    (tag: string) => {
      if (!url.tags.includes(tag)) setUrl({ tags: [...url.tags, tag] });
    },
    [url.tags, setUrl],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="y-disc">
      <div className="y-disc__inner">
        <SearchBar
          q={url.q}
          onCommitQ={(q) => setUrl({ q })}
          showFilters={showFilters}
          showTools={showTools}
          onToggleFilters={() => setShowFilters((v) => !v)}
          onToggleTools={() => setShowTools((v) => !v)}
          onReset={resetAll}
        />

        <ActiveChips
          state={url}
          advanced={advanced}
          total={total}
          selectedCount={selected.size}
          onChange={setUrl}
        />

        {showFilters && <FilterPanel state={url} onChange={setUrl} />}

        {showTools && (
          <ToolsPanel
            outputDir={outputDir}
            onOutputDir={setOutputDir}
            pageCount={loadedDownloadable.length}
            selectedCount={selected.size}
            scope={effectiveScope}
            onScope={setScope}
            onReview={() => openReview(effectiveScope)}
            onExport={(format) => exportMutation.mutate(format)}
            exporting={exportMutation.isPending}
            exportDisabled={total === 0}
          />
        )}

        <div className="y-disc-main">
          <div className={cn("y-disc-list", selected.size > 0 && "y-disc-list--batch")}>
            {searchQuery.isLoading && <Skeleton variant="row" count={6} />}

            {searchQuery.isError && (
              <div className="y-disc-error" role="alert">
                <span>
                  搜索失败:
                  {searchQuery.error instanceof Error ? searchQuery.error.message : "未知错误"}
                  。镜像可能不可达,
                  <Link to="/settings" className="y-disc-error__link">
                    去设置检查 →
                  </Link>
                </span>
                <span className="y-disc-error__actions">
                  <button
                    type="button"
                    className="y-btn-ghost y-disc-btn-sm"
                    onClick={() => void searchQuery.refetch()}
                  >
                    重试
                  </button>
                </span>
              </div>
            )}

            {!searchQuery.isLoading && !searchQuery.isError && items.length === 0 && (
              <EmptyState
                action={
                  <button type="button" className="y-btn-ghost" onClick={resetAll}>
                    重置条件
                  </button>
                }
              >
                没有找到匹配的作品 — 试试放宽条件
              </EmptyState>
            )}

            {!searchQuery.isError &&
              items.map((work) => (
                <ResultRow
                  key={work.source_id}
                  work={work}
                  status={statusMap.get(work.source_id)}
                  coverColor={coverColorFor(work.source_id)}
                  selected={selected.has(work.source_id)}
                  isDetail={url.work === work.source_id}
                  isPlaying={player.session?.sourceId === work.source_id}
                  previewing={previewingId === work.source_id}
                  onToggleSelect={() => toggleSelect(work.source_id)}
                  onOpen={() => setUrl({ work: work.source_id })}
                  onPreview={() => void previewWork(work)}
                  onDownload={() => setReviewItems([{ sourceId: work.source_id, title: work.title }])}
                  onAddTag={addTag}
                />
              ))}

            {/* 无限滚动:哨兵 + 加载中骨架行 + 到底提示 */}
            {!searchQuery.isError && items.length > 0 && hasNextPage && (
              <div ref={sentinelRef} className="y-disc-sentinel" aria-hidden="true">
                {searchQuery.isFetchingNextPage && <Skeleton variant="row" count={2} />}
              </div>
            )}
            {!searchQuery.isError && items.length > 0 && !hasNextPage && (
              <div className="y-disc-end">已经到底啦 · 共 {total.toLocaleString()} 条</div>
            )}

            {isMobile && (
              <div className="y-disc-facets-mobile">
                <FacetCards
                  facets={facets}
                  onAddTag={addTag}
                  onSetCircle={(circle) => setUrl({ circle })}
                  onSetVa={(va) => setUrl({ va })}
                />
              </div>
            )}
          </div>

          {!isMobile && (
            <div className="y-disc-side">
              <DetailPanel
                workId={url.work}
                onDownload={(item) => setReviewItems([item])}
                onPickNeighbor={(id) => setUrl({ work: id })}
              />
              <FacetCards
                facets={facets}
                onAddTag={addTag}
                onSetCircle={(circle) => setUrl({ circle })}
                onSetVa={(va) => setUrl({ va })}
              />
            </div>
          )}
        </div>
      </div>

      <BatchBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onEnqueue={() => openReview("selected")}
      />

      <AnimatePresence>
        {isMobile && url.work && (
          <motion.div
            key="disc-detail-overlay"
            className="y-disc-overlay"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="y-disc-overlay__bar">
              <button
                type="button"
                className="y-disc-overlay__close"
                aria-label="返回结果列表"
                onClick={() => setUrl({ work: undefined })}
              >
                ✕
              </button>
              <span className="y-disc-overlay__title">作品详情 · しょうさい</span>
            </div>
            <div className="y-disc-overlay__body">
              <DetailPanel
                workId={url.work}
                onDownload={(item) => setReviewItems([item])}
                onPickNeighbor={(id) => setUrl({ work: id })}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DownloadReviewDialog
        open={reviewItems !== null}
        onClose={() => setReviewItems(null)}
        items={reviewItems ?? []}
        outputDir={outputDir}
      />
    </div>
  );
}
