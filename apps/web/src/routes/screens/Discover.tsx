import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  CheckSquare,
  CaretDown,
  CaretUp,
  DownloadSimple,
  FileArrowDown,
  MagnifyingGlass,
  MusicNotes,
  SlidersHorizontal,
  Sparkle,
  Square,
  Tag,
  Wrench,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useGlobalPlayer } from "@/components/GlobalPlayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionReviewDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  EmptyState,
  PageHeader,
  RouteFeedback,
  fadeUpItem,
  staggerContainer,
} from "@/components/ui/sweet";
import {
  defaultDiscoverRouteSearch,
  type DiscoverRouteSearch,
} from "@/routes/discoverSearch";
import {
  apiClient,
  type DiscoverWorkDetail,
  type DiscoverWorkSummary,
  type SearchWorkSummary,
  type WorkStatus,
} from "@/lib/api";
import {
  flattenPlayableTracks,
  flattenSubtitleTracks,
} from "@/lib/playback";

const routeApi = getRouteApi("/discover");
const PLAYER_LOG_PREFIX = "[ASMRoner Player]";

type DiscoverFilters = {
  q: string;
  tag: string;
  circle: string;
  va: string;
  subtitle: boolean;
  count: number;
  order: string;
  sort: string;
};

type FacetItem = {
  value: string;
  count: number;
};

type BadgeSemantic = "decal" | "live" | "signal" | "warn" | "halt" | "mute";

const defaultDiscoverFilters: DiscoverFilters = {
  q: "",
  tag: "",
  circle: "",
  va: "",
  subtitle: false,
  count: 24,
  order: "dl_count",
  sort: "desc",
};

const emptyFacets = {
  tags: [] as FacetItem[],
  circles: [] as FacetItem[],
  vas: [] as FacetItem[],
};

export function Discover() {
  const routeSearch = routeApi.useSearch();
  const navigate = useNavigate({ from: "/discover" });
  const initialFilters = useMemo(
    () => filtersFromRouteSearch(routeSearch),
    [routeSearch],
  );
  const [draft, setDraft] = useState<DiscoverFilters>(initialFilters);
  const [filters, setFilters] = useState<DiscoverFilters>(initialFilters);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [outputDir, setOutputDir] = useState("");
  const [page, setPage] = useState(routeSearch.page);
  const [showFilters, setShowFilters] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [selectedIDs, setSelectedIDs] = useState<Set<string>>(() => new Set());
  const [downloadScope, setDownloadScope] = useState<"page" | "selected">("page");
  const [downloadReviewOpen, setDownloadReviewOpen] = useState(false);
  const resultsTopRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const legacyQuery = useMemo(() => buildLegacyQuery(filters), [filters]);
  const usingLegacyQuery = useMemo(() => isLegacySearchInput(filters.q), [filters.q]);
  const draftIsLegacyQuery = useMemo(() => isLegacySearchInput(draft.q), [draft.q]);
  const draftTags = useMemo(() => splitFilterValues(draft.tag), [draft.tag]);
  const hasAdvancedDraft = Boolean(
    draft.tag.trim() ||
      draft.circle.trim() ||
      draft.va.trim() ||
      draft.subtitle ||
      draft.count !== defaultDiscoverFilters.count ||
      draft.order !== defaultDiscoverFilters.order ||
      draft.sort !== defaultDiscoverFilters.sort,
  );

  const searchQuery = useQuery({
    queryKey: ["discover", filters, legacyQuery, page, usingLegacyQuery],
    queryFn: async () => {
      if (usingLegacyQuery) {
        const data = await apiClient.searchWorks({
          query: legacyQuery,
          count: filters.count,
          page,
          pageSize: filters.count,
          order: filters.order,
          sort: filters.sort,
          subtitle: filters.subtitle ? 1 : 0,
        });
        return {
          items: data.items,
          total: data.total,
          facets: buildFacetsFromItems(data.items),
        };
      }

      const data = await apiClient.searchDiscover({
        q: filters.q,
        tag: filters.tag,
        circle: filters.circle,
        va: filters.va,
        subtitle: filters.subtitle,
        page,
        pageSize: filters.count,
        order: filters.order,
        sort: filters.sort,
      });

      return {
        items: data.items,
        total: data.total,
        facets:
          data.facets.tags.length > 0 ||
          data.facets.circles.length > 0 ||
          data.facets.vas.length > 0
            ? data.facets
            : buildFacetsFromItems(data.items),
      };
    },
  });

  const detailQuery = useQuery({
    queryKey: ["discover", "work", selectedSourceId],
    queryFn: () => apiClient.getDiscoverWork(selectedSourceId),
    enabled: selectedSourceId.length > 0,
  });

  const singleDownloadMutation = useMutation({
    mutationFn: (sourceId: string) =>
      apiClient.createDownload({
        mode: "single",
        ids: [sourceId],
        output_dir: outputDir || undefined,
      }),
    onSuccess: (res) => {
      toast.success(`已加入下载队列，任务 #${res.task_id}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["work-status"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const searchDownloadMutation = useMutation({
    mutationFn: () => {
      if (usingLegacyQuery) {
        return apiClient.queueSearchDownload({
          query: legacyQuery,
          count: filters.count,
          output_dir: outputDir || undefined,
        });
      }
      const ids = downloadScope === "selected"
        ? Array.from(selectedIDs)
        : (searchQuery.data?.items ?? []).map((item) => item.source_id);
      return apiClient.createDownload({
        mode: "batch",
        ids,
        output_dir: outputDir || undefined,
        name: "结构化筛选批量下载",
      });
    },
    onSuccess: (res) => {
      toast.success(`已加入搜索结果下载任务 #${res.task_id}`);
      setDownloadReviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["work-status"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: "csv" | "json") => {
      if (usingLegacyQuery) {
        const result = await apiClient.exportSearch({
          query: legacyQuery,
          count: filters.count,
          format,
        });
        triggerBlobDownload(result.blob, result.filename ?? `search.${format}`);
        return format;
      }
      const items = searchQuery.data?.items ?? [];
      const blob = buildDiscoverExportBlob(items, format);
      triggerBlobDownload(blob, `discover_export.${format}`);
      return format;
    },
    onSuccess: (format) => {
      toast.success(`已导出搜索结果 ${format.toUpperCase()}`);
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const works = searchQuery.data?.items ?? [];
  const scopedDownloadCount = usingLegacyQuery
    ? filters.count
    : downloadScope === "selected" ? selectedIDs.size : works.length;
  const statusSourceIds = useMemo(
    () => works.map((work) => work.source_id).filter(Boolean),
    [works],
  );
  const workStatusQuery = useQuery({
    queryKey: ["work-status", statusSourceIds.join(",")],
    queryFn: () => apiClient.getWorkStatuses(statusSourceIds),
    enabled: statusSourceIds.length > 0,
    staleTime: 5000,
  });
  const statusBySourceId = useMemo(() => {
    const map = new Map<string, WorkStatus>();
    for (const item of workStatusQuery.data?.items ?? []) {
      map.set(item.source_id, item);
    }
    return map;
  }, [workStatusQuery.data]);
  const facets = searchQuery.data?.facets ?? emptyFacets;
  const totalPages = Math.max(1, Math.ceil((searchQuery.data?.total ?? 0) / filters.count));
  const canQueueSearch =
    (usingLegacyQuery && legacyQuery.length > 0) ||
    (!usingLegacyQuery && scopedDownloadCount > 0);

  const activeFilters = useMemo(
    () =>
      [
        filters.q && `关键词：${filters.q}`,
        filters.tag && `标签：${filters.tag}`,
        filters.circle && `社团：${filters.circle}`,
        filters.va && `声优：${filters.va}`,
        filters.subtitle && "仅字幕作品",
        filters.count !== defaultDiscoverFilters.count && `每页：${filters.count}`,
        filters.order !== defaultDiscoverFilters.order && `排序：${filters.order}`,
      ].filter(Boolean) as string[],
    [filters],
  );

  useEffect(() => {
    const nextFilters = filtersFromRouteSearch(routeSearch);
    setDraft(nextFilters);
    setFilters(nextFilters);
    setPage(routeSearch.page);
  }, [routeSearch]);

  function submitSearch(nextDraft = draft) {
    const normalizedDraft = {
      ...nextDraft,
      q: nextDraft.q.trim(),
      tag: splitFilterValues(nextDraft.tag).join(", "),
      circle: nextDraft.circle.trim(),
      va: nextDraft.va.trim(),
    };
    setSelectedSourceId("");
    setSelectedIDs(new Set());
    void navigate({
      to: "/discover",
      search: toRouteSearch(normalizedDraft, 1),
    });
  }

  function resetSearchPanel() {
    setSelectedSourceId("");
    setSelectedIDs(new Set());
    setShowFilters(false);
    setShowTools(false);
    void navigate({
      to: "/discover",
      search: defaultDiscoverRouteSearch,
    });
  }

  function scrollToResultsTop() {
    window.requestAnimationFrame(() => {
      resultsTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function changePage(nextPage: number) {
    setSelectedIDs(new Set());
    void navigate({
      to: "/discover",
      search: {
        ...toRouteSearch(filters, nextPage),
      },
    });
    scrollToResultsTop();
  }

  return (
    <motion.section
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="搜索"
          title="搜索远端作品"
          description="按关键词、标签、声优或社团筛选作品，确认后加入下载。"
          meta={
            <div className="deck-screen space-y-2 p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={draftIsLegacyQuery ? "warn" : "live"} active={!draftIsLegacyQuery}>
                  条件搜索
                </Badge>
                <Badge variant={draftIsLegacyQuery ? "live" : "mute"} active={draftIsLegacyQuery}>
                  高级语法
                </Badge>
              </div>
              <div className="text-sm leading-5 text-[color:var(--text-body)]">
                当前共命中 <span className="font-semibold">{searchQuery.data?.total ?? 0}</span> 个作品
              </div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <Card foil className="overflow-hidden">
          <CardContent className="space-y-4 p-4">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <div className="deck-plate p-3">
                <div className="flex flex-col gap-3 xl:flex-row">
                  <div className="min-w-0 flex-1">
                    <Input
                      value={draft.q}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, q: event.target.value }))
                      }
                      placeholder="输入关键词、RJ 编号，或直接贴高级查询表达式"
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" className="h-12 px-5">
                      <MagnifyingGlass className="h-4 w-4" />
                      搜索
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-12 px-4"
                      onClick={() => setShowFilters((value) => !value)}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      筛选
                      {showFilters ? (
                        <CaretUp className="h-4 w-4" />
                      ) : (
                        <CaretDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-12 px-4"
                      onClick={() => setShowTools((value) => !value)}
                    >
                      <Wrench className="h-4 w-4" />
                      工具
                      {showTools ? (
                        <CaretUp className="h-4 w-4" />
                      ) : (
                        <CaretDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-12 px-4"
                      onClick={resetSearchPanel}
                    >
                      <ArrowClockwise className="h-4 w-4" />
                      重置
                    </Button>
                  </div>
                </div>
              </div>

              <div className="deck-plate flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex flex-wrap gap-2">
                  {activeFilters.length === 0 && (
                    <Badge variant="mute">还没有激活筛选条件</Badge>
                  )}
                  {activeFilters.map((item) => (
                    <Badge key={item} variant="signal">
                      {item}
                    </Badge>
                  ))}
                </div>
                <Badge variant="warn">
                  第 {page} / {totalPages} 页
                </Badge>
              </div>

              <AnimatePresence initial={false}>
                {(showFilters || hasAdvancedDraft) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    transition={{ duration: 0.24 }}
                    className="overflow-hidden"
                  >
                    <div className="deck-plate p-4">
                      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.95fr]">
                        <div className="space-y-4">
                          <PanelLabel
                            title="筛选条件"
                            description="标签支持多个值，使用逗号或换行分隔。"
                          />
                          <div className="space-y-2">
                            <FieldLabel>标签</FieldLabel>
                            <Input
                              value={draft.tag}
                              onChange={(event) =>
                                setDraft((prev) => ({ ...prev, tag: event.target.value }))
                              }
                              placeholder="例如：护士, 助眠, 掏耳"
                            />
                            {draftTags.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {draftTags.map((tagValue) => (
                                  <button
                                    key={tagValue}
                                    type="button"
                                    title={`移除标签: ${tagValue}`}
                                    className="deck-decal max-w-full min-w-0 transition hover:border-[color:var(--telltale-amber)]"
                                    onClick={() =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        tag: splitFilterValues(prev.tag)
                                          .filter((item) => item !== tagValue)
                                          .join(", "),
                                      }))
                                    }
                                  >
                                    <span className="min-w-0 max-w-[min(14rem,72vw)] truncate">
                                      #{tagValue}
                                    </span>
                                    <span className="shrink-0">×</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <FieldLabel>社团</FieldLabel>
                              <Input
                                value={draft.circle}
                                onChange={(event) =>
                                  setDraft((prev) => ({ ...prev, circle: event.target.value }))
                                }
                                placeholder="例如：甘幸冬水"
                              />
                            </div>
                            <div className="space-y-2">
                              <FieldLabel>声优</FieldLabel>
                              <Input
                                value={draft.va}
                                onChange={(event) =>
                                  setDraft((prev) => ({ ...prev, va: event.target.value }))
                                }
                                placeholder="例如：秋野かえで"
                              />
                            </div>
                            <div className="space-y-2">
                              <FieldLabel>附加条件</FieldLabel>
                              <label className="deck-plate flex h-12 items-center gap-3 px-4 text-sm text-[color:var(--text-display)]">
                                <input
                                  type="checkbox"
                                  checked={draft.subtitle}
                                  onChange={(event) =>
                                    setDraft((prev) => ({
                                      ...prev,
                                      subtitle: event.target.checked,
                                    }))
                                  }
                                />
                                仅字幕作品
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <PanelLabel
                            title="排序与数量"
                            description="设置排序方式和每页展示数量。"
                          />
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2 md:col-span-2">
                              <FieldLabel>排序字段</FieldLabel>
                              <Select
                                value={draft.order}
                                onChange={(event) =>
                                  setDraft((prev) => ({ ...prev, order: event.target.value }))
                                }
                              >
                                <option value="dl_count">按下载量</option>
                                <option value="release">按发售时间</option>
                                <option value="rate_average_2dp">按评分</option>
                                <option value="review_count">按评论数</option>
                                <option value="price">按价格</option>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <FieldLabel>顺序</FieldLabel>
                              <Select
                                value={draft.sort}
                                onChange={(event) =>
                                  setDraft((prev) => ({ ...prev, sort: event.target.value }))
                                }
                              >
                                <option value="desc">降序</option>
                                <option value="asc">升序</option>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <FieldLabel>每页数量</FieldLabel>
                              <Input
                                type="number"
                                min={1}
                                max={48}
                                value={String(draft.count)}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    count: Number(event.target.value) || 24,
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {showTools && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    transition={{ duration: 0.24 }}
                    className="overflow-hidden"
                  >
                    <div className="deck-plate p-4">
                      <div className="grid gap-5">
                        <div className="space-y-4">
                          <PanelLabel
                            title="结果操作"
                            description="导出当前结果，或将本页命中项投递到下载队列。"
                          />
                          <div className="grid gap-3 md:grid-cols-[1.15fr_12rem_auto_auto_auto]">
                            <Input
                              value={outputDir}
                              onChange={(event) => setOutputDir(event.target.value)}
                              placeholder="可选输出目录"
                            />
                            {!usingLegacyQuery ? (
                              <Select value={downloadScope} onChange={(event) => setDownloadScope(event.target.value as "page" | "selected")}>
                                <option value="page">本页 {works.length} 项</option>
                                <option value="selected">已选 {selectedIDs.size} 项</option>
                              </Select>
                            ) : (
                              <div className="deck-screen flex items-center px-3 text-sm text-[color:var(--text-body)]">前 {filters.count} 条结果</div>
                            )}
                            <Button
                              type="button"
                              variant="secondary"
                              busy={searchDownloadMutation.isPending}
                              onClick={() => setDownloadReviewOpen(true)}
                              disabled={!canQueueSearch || searchDownloadMutation.isPending}
                            >
                              <DownloadSimple className="h-4 w-4" />
                              复核下载范围
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              busy={exportMutation.isPending}
                              onClick={() => exportMutation.mutate("csv")}
                              disabled={!canQueueSearch || exportMutation.isPending}
                            >
                              <FileArrowDown className="h-4 w-4" />
                              CSV
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              busy={exportMutation.isPending}
                              onClick={() => exportMutation.mutate("json")}
                              disabled={!canQueueSearch || exportMutation.isPending}
                            >
                              <FileArrowDown className="h-4 w-4" />
                              JSON
                            </Button>
                          </div>
                        </div>

                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        variants={fadeUpItem}
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <div className="space-y-5">
          <div ref={resultsTopRef} />
          <motion.div
            className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {searchQuery.isLoading &&
              Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="space-y-4 p-5">
                    <div className="deck-screen h-52 animate-pulse" />
                    <div className="h-4 animate-pulse rounded-md bg-[color:var(--interactive-bg)]" />
                    <div className="h-4 w-2/3 animate-pulse rounded-md bg-[color:var(--interactive-bg)]" />
                  </CardContent>
                </Card>
              ))}

            {searchQuery.isError && (
              <Card className="md:col-span-2 2xl:col-span-3">
                <CardContent>
                  <RouteFeedback
                    tone="halt"
                    title="搜索结果加载失败"
                    description={`没有拿到远端作品结果。请确认本地后端可用，或调整关键词后重试。${searchQuery.error ? `错误信息：${formatErrorMessage(searchQuery.error)}` : ""}`}
                    action={
                      <Button variant="secondary" onClick={() => void searchQuery.refetch()}>
                        <ArrowClockwise className="h-4 w-4" />
                        重新搜索
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            )}

            {!searchQuery.isLoading &&
              !searchQuery.isError &&
              works.map((work, index) => (
                <motion.div
                  key={work.source_id}
                  variants={fadeUpItem}
                  transition={{ delay: index * 0.02 }}
                >
                  <WorkCard
                    work={work}
                    status={statusBySourceId.get(work.source_id)}
                    detailSearch={routeSearch}
                    onSelect={() => setSelectedSourceId(work.source_id)}
                    onQueue={() => singleDownloadMutation.mutate(work.source_id)}
                    selected={selectedIDs.has(work.source_id)}
                    onToggleSelected={() => setSelectedIDs((current) => {
                      const next = new Set(current);
                      if (next.has(work.source_id)) next.delete(work.source_id);
                      else next.add(work.source_id);
                      return next;
                    })}
                  />
                </motion.div>
              ))}

            {!searchQuery.isLoading && !searchQuery.isError && works.length === 0 && (
              <Card className="md:col-span-2 2xl:col-span-3">
                <CardContent>
                  <EmptyState
                    symbol="无结果"
                    title="没有匹配作品"
                    description="当前筛选条件下没有匹配结果。可以减少限制，或改用高级语法搜索。"
                  />
                </CardContent>
              </Card>
            )}
          </motion.div>

          <div className="deck-plate flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="text-sm text-[color:var(--text-body)]">
              第 {page} / {totalPages} 页，共 {searchQuery.data?.total ?? 0} 个作品
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                上一页
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => changePage(page + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <FacetCard
            title="本页标签"
            items={facets.tags}
            variant="decal"
            onPick={(value) => {
              const nextFilters = { ...filters, tag: appendFilterValue(filters.tag, value) };
              void navigate({
                to: "/discover",
                search: toRouteSearch(nextFilters, 1),
              });
            }}
          />
          <FacetCard
            title="本页社团"
            items={facets.circles}
            variant="signal"
            onPick={(value) => {
              const nextFilters = { ...filters, circle: value };
              void navigate({
                to: "/discover",
                search: toRouteSearch(nextFilters, 1),
              });
            }}
          />
          <FacetCard
            title="本页声优"
            items={facets.vas}
            variant="live"
            onPick={(value) => {
              const nextFilters = { ...filters, va: value };
              void navigate({
                to: "/discover",
                search: toRouteSearch(nextFilters, 1),
              });
            }}
          />
          <WorkDetailCard
            detail={detailQuery.data}
            detailSearch={routeSearch}
            loading={detailQuery.isLoading}
            onQueue={(sourceId) => singleDownloadMutation.mutate(sourceId)}
          />
        </div>
      </motion.div>

      <ActionReviewDialog
        open={downloadReviewOpen}
        onOpenChange={(open) => !open && !searchDownloadMutation.isPending && setDownloadReviewOpen(false)}
        title="确认创建搜索结果下载"
        description="只会下载下方明确列出的范围，任务创建后可在任务中心取消。"
        rows={[
          { label: "下载范围", value: usingLegacyQuery ? `高级语法前 ${filters.count} 条` : downloadScope === "selected" ? `已选 ${selectedIDs.size} 项` : `当前第 ${page} 页，共 ${works.length} 项` },
          { label: "输出目录", value: outputDir.trim() || "设置中的同步目录" },
        ]}
        warning={scopedDownloadCount >= 24 ? "该操作可能产生较大的网络流量与磁盘占用。" : undefined}
        confirmLabel="创建下载任务"
        busy={searchDownloadMutation.isPending}
        onConfirm={() => searchDownloadMutation.mutate()}
      />
    </motion.section>
  );
}

function PanelLabel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--telltale-amber)]">
        <Sparkle className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="text-sm text-[color:var(--text-body)]">{description}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <div className="deck-decal">
      {children}
    </div>
  );
}

function WorkCard({
  work,
  status,
  detailSearch,
  onSelect,
  onQueue,
  selected,
  onToggleSelected,
}: {
  work: SearchWorkSummary;
  status?: WorkStatus;
  detailSearch: DiscoverRouteSearch;
  onSelect: () => void;
  onQueue: () => void;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const visibleTags = work.tags.slice(0, 3);
  const hiddenTagCount = Math.max(0, work.tags.length - visibleTags.length);

  return (
    <Card interactive foil className="h-full overflow-hidden" onClick={onSelect}>
      <CardContent className="flex h-full flex-col gap-5 p-5">
        <div className="deck-screen aspect-[16/10]">
          <button
            type="button"
            aria-label={selected ? `取消选择 ${work.source_id}` : `选择 ${work.source_id}`}
            title={selected ? "取消选择" : "加入批量选择"}
            className="deck-plate absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center text-[color:var(--text-display)]"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelected();
            }}
          >
            {selected ? <CheckSquare className="h-5 w-5" weight="fill" /> : <Square className="h-5 w-5" />}
          </button>
          {work.main_cover_url || work.thumbnail_url ? (
            <img
              src={work.main_cover_url || work.thumbnail_url}
              alt={work.title}
              className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:brightness-110"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[color:var(--text-mute)]">
              暂无封面
            </div>
          )}
          <div className="absolute bottom-3 right-3">
            {work.circle ? (
              <Link
                to="/discover"
                search={buildFacetRouteSearch(detailSearch, { circle: work.circle })}
                title={`搜索社团: ${work.circle}`}
                className="block max-w-[min(14rem,70vw)] transition hover:brightness-110"
                onClick={(event) => event.stopPropagation()}
              >
                <Badge variant="decal" active className="max-w-full min-w-0">
                  <span className="min-w-0 truncate">{work.circle}</span>
                </Badge>
              </Link>
            ) : (
              <Badge variant="decal">未知社团</Badge>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="warn" className="shrink-0">
                {work.source_id}
              </Badge>
              {status && status.state !== "none" ? (
                <Badge
                  variant={workStatusBadgeVariant(status.state)}
                  title={status.message || status.label}
                  className="shrink-0"
                >
                  {status.label}
                </Badge>
              ) : null}
            </div>
            <span className="console-mono text-xs text-[color:var(--text-mute)]">{work.release}</span>
          </div>
          <h3 className="console-title line-clamp-2 text-xl font-black leading-7 text-[color:var(--text-display)]">
            {work.title}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniMetric label="下载量" value={String(work.dl_count)} variant="signal" />
          <MiniMetric label="评分" value={work.rate.toFixed(2)} variant="warn" />
          <MiniMetric
            label="字幕"
            value={work.has_subtitle ? "有" : "无"}
            variant={work.has_subtitle ? "live" : "mute"}
          />
        </div>

        <div className="flex min-h-[1.75rem] flex-wrap gap-2.5 overflow-hidden">
          {visibleTags.map((tag) => (
            <Link
              key={tag}
              to="/discover"
              search={buildFacetRouteSearch(detailSearch, { tag })}
              title={`搜索标签: ${tag}`}
              className="max-w-full min-w-0 transition hover:brightness-110"
              onClick={(event) => event.stopPropagation()}
            >
              <Badge variant={tagVariant(tag)} active className="max-w-full min-w-0">
                <span className="min-w-0 max-w-[min(11rem,68vw)] truncate">
                  #{tag}
                </span>
              </Badge>
            </Link>
          ))}
          {hiddenTagCount > 0 ? (
            <Badge
              variant="mute"
              title={work.tags.slice(visibleTags.length).join(", ")}
              className="shrink-0"
            >
              +{hiddenTagCount}
            </Badge>
          ) : null}
        </div>

        <div className="mt-auto grid gap-3 pt-1">
          <Button
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              onQueue();
            }}
          >
            <DownloadSimple className="h-4 w-4" />
            加入下载队列
          </Button>
          <Link
            to="/discover/$sourceId"
            params={{ sourceId: work.source_id }}
            search={detailSearch}
            className="deck-button-secondary inline-flex h-[38px] items-center justify-center border px-4 py-2 text-center text-xs font-bold transition hover:brightness-110"
            onClick={(event) => event.stopPropagation()}
          >
            查看详情页
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: BadgeSemantic;
}) {
  return (
    <div className="deck-screen px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-mute)]">
        {label}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="console-readout text-sm">{value}</span>
        <Badge variant={variant}>•</Badge>
      </div>
    </div>
  );
}

function FacetCard({
  title,
  items,
  variant,
  onPick,
}: {
  title: string;
  items: FacetItem[];
  variant: BadgeSemantic;
  onPick: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4 text-[color:var(--tape-pink)]" weight="duotone" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.length === 0 && (
          <div className="text-sm text-[color:var(--text-mute)]">暂无可用聚合</div>
        )}
        {items.map((item) => (
          <button
            key={`${title}-${item.value}`}
            title={`${item.value} (${item.count})`}
            className="max-w-full min-w-0 transition hover:brightness-110"
            onClick={() => onPick(item.value)}
          >
            <Badge variant={variant} active className="max-w-full min-w-0 gap-1">
              <span className="min-w-0 max-w-[min(15rem,72vw)] truncate">
                {item.value}
              </span>
              <span className="shrink-0">({item.count})</span>
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function buildFacetRouteSearch(
  base: DiscoverRouteSearch,
  patch: Partial<Pick<DiscoverRouteSearch, "tag" | "circle" | "va">>,
): DiscoverRouteSearch {
  return {
    ...base,
    q: "",
    tag: "",
    circle: "",
    va: "",
    ...patch,
    page: 1,
  };
}

function WorkDetailCard({
  detail,
  detailSearch,
  loading,
  onQueue,
}: {
  detail?: DiscoverWorkDetail;
  detailSearch: DiscoverRouteSearch;
  loading: boolean;
  onQueue: (sourceId: string) => void;
}) {
  const player = useGlobalPlayer();
  const audioFiles = useMemo(
    () => flattenPlayableTracks(detail?.tracks ?? []),
    [detail?.tracks],
  );
  const subtitleFiles = useMemo(
    () => flattenSubtitleTracks(detail?.tracks ?? []),
    [detail?.tracks],
  );
  const [selectedTrackPath, setSelectedTrackPath] = useState("");

  useEffect(() => {
    setSelectedTrackPath((current) => {
      if (audioFiles.some((file) => file.path === current)) {
        return current;
      }
      return audioFiles[0]?.path ?? "";
    });
  }, [audioFiles]);

  useEffect(() => {
    if (!detail) {
      return;
    }
    console.info(PLAYER_LOG_PREFIX, "quick detail tracks loaded", {
      sourceId: detail.summary.source_id,
      topLevelTrackCount: detail.tracks.length,
      playableTrackCount: audioFiles.length,
      playableTracks: audioFiles,
      rawTracks: detail.tracks,
    });
  }, [detail, audioFiles]);

  function selectAndPlayTrack(path: string) {
    console.info(PLAYER_LOG_PREFIX, "quick detail track clicked", {
      path,
      audioFilesCount: audioFiles.length,
      track: audioFiles.find((file) => file.path === path),
      sourceId: detail?.summary.source_id,
    });
    setSelectedTrackPath(path);
    if (detail) {
      player.play({
        tracks: audioFiles,
        subtitles: subtitleFiles,
        title: detail.summary.title,
        mediaId: detail.summary.source_id,
        coverUrl: detail.summary.main_cover_url || detail.summary.thumbnail_url,
      }, path);
    }
  }

  const coverUrl = detail?.summary.main_cover_url || detail?.summary.thumbnail_url;

  return (
    <Card foil className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">作品详情</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!detail && !loading && (
          <EmptyState
            symbol="请选择"
            title="选择一个作品"
            description="选择左侧作品后，这里会显示详情、音轨预览和详情页入口。"
            className="min-h-[14rem]"
          />
        )}
        {loading && (
          <div className="space-y-4">
            <div className="deck-screen h-44 animate-pulse" />
            <div className="h-4 animate-pulse rounded-md bg-[color:var(--interactive-bg)]" />
            <div className="h-4 w-2/3 animate-pulse rounded-md bg-[color:var(--interactive-bg)]" />
          </div>
        )}
        {detail && (
          <>
            <div className="deck-screen flex h-52 items-center justify-center p-2">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={detail.summary.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[color:var(--text-mute)]">
                  暂无封面
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Badge variant="warn">{detail.summary.source_id}</Badge>
              <h3 className="console-title text-xl font-black text-[color:var(--text-display)]">
                {detail.summary.title}
              </h3>
              <p className="text-sm text-[color:var(--text-body)]">{detail.summary.circle}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="发售日" value={detail.summary.release || "-"} variant="decal" />
              <MiniMetric label="价格" value={String(detail.price)} variant="warn" />
              <MiniMetric label="评论数" value={String(detail.review_count)} variant="signal" />
              <MiniMetric label="音轨数" value={String(detail.tracks.length)} variant="live" />
            </div>

            {audioFiles.length === 0 ? (
              <div className="deck-screen p-4 text-sm text-[color:var(--text-mute)]">
                当前作品暂无可在线播放音轨。
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-semibold text-[color:var(--text-body)]">音轨预览</div>
              <div className="space-y-2">
                {audioFiles.slice(0, 6).map((track, index) => (
                  <button
                    type="button"
                    key={track.path}
                    className={`deck-screen flex w-full items-center gap-3 p-3 text-left text-sm transition hover:border-[color:var(--telltale-amber)] ${
                      player.activeMediaId === detail.summary.source_id && player.selectedPath === track.path
                        ? "border-[color:var(--tape-pink)] shadow-[var(--glow-tape)]"
                        : ""
                    }`}
                    onClick={() => selectAndPlayTrack(track.path)}
                  >
                    <Badge variant={player.activeMediaId === detail.summary.source_id && player.selectedPath === track.path ? "live" : "mute"}>
                      {String(index + 1).padStart(2, "0")}
                    </Badge>
                    <MusicNotes className="h-4 w-4 shrink-0 text-[color:var(--telltale-amber)]" weight="duotone" />
                    <span className="min-w-0 truncate text-[color:var(--text-display)]">
                      {track.name}
                    </span>
                  </button>
                ))}
                {audioFiles.length === 0 ? (
                  <div className="deck-screen p-3 text-sm text-[color:var(--text-mute)]">
                    没有可在线播放的音频文件。
                  </div>
                ) : null}
              </div>
            </div>
            <Button className="w-full" onClick={() => onQueue(detail.summary.source_id)}>
              <DownloadSimple className="h-4 w-4" />
              下载当前作品
            </Button>
            <Link
              to="/discover/$sourceId"
              params={{ sourceId: detail.summary.source_id }}
              search={detailSearch}
              className="deck-button-secondary inline-flex h-[38px] items-center justify-center border px-4 py-2 text-center text-xs font-bold transition hover:brightness-110"
            >
              打开独立详情页
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function tagVariant(tag: string) {
  const value = tag.toLowerCase();
  if (value.includes("全年龄") || value.includes("heal")) {
    return "signal" as const;
  }
  if (value.includes("耳") || value.includes("催眠") || value.includes("asmr")) {
    return "decal" as const;
  }
  if (value.includes("cv") || value.includes("声优")) {
    return "live" as const;
  }
  return "signal" as const;
}

function workStatusBadgeVariant(state: WorkStatus["state"]) {
  switch (state) {
    case "in_library":
    case "downloaded":
      return "signal" as const;
    case "downloading":
      return "live" as const;
    case "queued":
      return "warn" as const;
    case "failed":
    case "terminated":
      return "halt" as const;
    case "canceled":
      return "mute" as const;
    default:
      return "mute" as const;
  }
}

function buildLegacyQuery(filters: DiscoverFilters) {
  const plain = filters.q.trim();
  const searchParts = [
    ...splitFilterValues(filters.tag).map((value) => `tag:${value}`),
    filters.circle.trim() ? `circle:${filters.circle.trim()}` : "",
    filters.va.trim() ? `va:${filters.va.trim()}` : "",
  ].filter(Boolean);

  if (!plain && searchParts.length === 0) {
    return "";
  }

  let query = plain;
  if (searchParts.length > 0) {
    query = query ? `${query}@${searchParts.join(",")}` : searchParts.join(",");
  }

  if (filters.subtitle) {
    query = `${query}?subtitle=1`;
  }

  return query;
}

function buildFacetsFromItems(items: Array<SearchWorkSummary | DiscoverWorkSummary>) {
  return {
    tags: buildFacetList(items.flatMap((item) => item.tags), 12),
    circles: buildFacetList(items.map((item) => item.circle), 8),
    vas: buildFacetList(items.flatMap((item) => item.vas), 8),
  };
}

function buildFacetList(values: string[], limit: number): FacetItem[] {
  const counts = new Map<string, number>();
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) =>
      left.count === right.count
        ? left.value.localeCompare(right.value)
        : right.count - left.count,
    )
    .slice(0, limit);
}

function splitFilterValues(raw: string) {
  return raw
    .split(/[,\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function appendFilterValue(raw: string, value: string) {
  const values = splitFilterValues(raw);
  if (values.includes(value)) {
    return values.join(", ");
  }
  return [...values, value].join(", ");
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildDiscoverExportBlob(
  items: Array<SearchWorkSummary | DiscoverWorkSummary>,
  format: "csv" | "json",
) {
  if (format === "json") {
    return new Blob([JSON.stringify(items, null, 2)], {
      type: "application/json;charset=utf-8",
    });
  }

  const header = [
    "source_id",
    "title",
    "circle",
    "release",
    "dl_count",
    "rate",
    "duration",
    "has_subtitle",
    "tags",
    "vas",
  ];
  const rows = items.map((item) => [
    item.source_id,
    escapeCSV(item.title),
    escapeCSV(item.circle),
    item.release,
    String(item.dl_count),
    String(item.rate),
    String(item.duration),
    item.has_subtitle ? "true" : "false",
    escapeCSV(item.tags.join(",")),
    escapeCSV(item.vas.join(",")),
  ]);
  const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

function escapeCSV(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function isLegacySearchInput(raw: string) {
  const value = raw.trim();
  if (!value) {
    return false;
  }
  return /@|\?order=|(^|[\s,])\-?(tag|circle|va|duration|rate|price|sell|age|lang):/i.test(
    value,
  );
}

function filtersFromRouteSearch(search: DiscoverRouteSearch): DiscoverFilters {
  return {
    q: search.q,
    tag: search.tag,
    circle: search.circle,
    va: search.va,
    subtitle: search.subtitle,
    count: search.count,
    order: search.order,
    sort: search.sort,
  };
}

function toRouteSearch(
  filters: DiscoverFilters,
  page: number,
): DiscoverRouteSearch {
  return {
    q: filters.q,
    tag: filters.tag,
    circle: filters.circle,
    va: filters.va,
    subtitle: filters.subtitle,
    count: filters.count,
    order: filters.order,
    sort: filters.sort,
    page,
  };
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
