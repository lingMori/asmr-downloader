import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
  Flame,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  EmptyState,
  PageHeader,
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
} from "@/lib/api";

const routeApi = getRouteApi("/discover");

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
  const [directIds, setDirectIds] = useState("");
  const [hotCount, setHotCount] = useState("10");
  const [outputDir, setOutputDir] = useState("");
  const [page, setPage] = useState(routeSearch.page);
  const [showFilters, setShowFilters] = useState(false);
  const [showTools, setShowTools] = useState(false);
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
      const ids = (searchQuery.data?.items ?? []).map((item) => item.source_id);
      return apiClient.createDownload({
        mode: "batch",
        ids,
        output_dir: outputDir || undefined,
        name: "结构化筛选批量下载",
      });
    },
    onSuccess: (res) => {
      toast.success(`已加入搜索结果下载任务 #${res.task_id}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const directDownloadMutation = useMutation({
    mutationFn: (mode: "batch" | "hot100") => {
      if (mode === "hot100") {
        return apiClient.createDownload({
          mode,
          count: Number(hotCount) || 10,
          output_dir: outputDir || undefined,
          name: `Hot100 x${Number(hotCount) || 10}`,
        });
      }

      return apiClient.createDownload({
        mode: "batch",
        ids: parseIds(directIds),
        output_dir: outputDir || undefined,
        name: "Direct batch download",
      });
    },
    onSuccess: (res, mode) => {
      toast.success(`已创建${mode === "hot100" ? " Hot100" : "批量"}下载任务 #${res.task_id}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
  const facets = searchQuery.data?.facets ?? emptyFacets;
  const totalPages = Math.max(1, Math.ceil((searchQuery.data?.total ?? 0) / filters.count));
  const canQueueSearch =
    (usingLegacyQuery && legacyQuery.length > 0) ||
    (!usingLegacyQuery && works.length > 0);

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
    void navigate({
      to: "/discover",
      search: toRouteSearch(normalizedDraft, 1),
    });
  }

  function resetSearchPanel() {
    setSelectedSourceId("");
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
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="Discover"
          title="抽卡式封面发现页"
          description="保留原本的普通搜索、高级语法和批量工具，但把入口换成更顺手的卡牌探索体验。你可以边筛边点，像在挑今天想听的收藏。"
          meta={
            <div className="space-y-3 rounded-[1.8rem] border border-white/40 bg-white/45 p-4 shadow-[0_16px_34px_rgba(255,182,193,0.12)]">
              <div className="flex flex-wrap gap-2">
                <Badge variant={draftIsLegacyQuery ? "violet" : "pink"} active={!draftIsLegacyQuery}>
                  条件搜索
                </Badge>
                <Badge variant={draftIsLegacyQuery ? "pink" : "ghost"} active={draftIsLegacyQuery}>
                  高级语法
                </Badge>
              </div>
              <div className="text-sm leading-6 text-[color:var(--text-body)]">
                当前共命中 <span className="font-semibold">{searchQuery.data?.total ?? 0}</span> 个作品
              </div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <Card foil className="overflow-hidden">
          <CardContent className="space-y-5 p-6">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <div className="rounded-[2rem] border border-white/40 bg-[linear-gradient(135deg,rgba(255,138,101,0.14),rgba(255,255,255,0.28),rgba(124,184,255,0.08))] p-4">
                <div className="flex flex-col gap-3 xl:flex-row">
                  <div className="min-w-0 flex-1">
                    <Input
                      value={draft.q}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, q: event.target.value }))
                      }
                      placeholder="输入关键词、RJ 编号，或直接贴高级查询表达式"
                      className="h-14 text-base"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" className="h-14 px-6">
                      <Search className="h-4 w-4" />
                      搜索
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-14 px-5"
                      onClick={() => setShowFilters((value) => !value)}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      筛选
                      {showFilters ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-14 px-5"
                      onClick={() => setShowTools((value) => !value)}
                    >
                      <Wrench className="h-4 w-4" />
                      工具
                      {showTools ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-14 px-5"
                      onClick={resetSearchPanel}
                    >
                      <RotateCcw className="h-4 w-4" />
                      重置
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.7rem] border border-white/40 bg-white/46 px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {activeFilters.length === 0 && (
                    <Badge variant="ghost">还没有激活筛选条件</Badge>
                  )}
                  {activeFilters.map((item) => (
                    <Badge key={item} variant="blue">
                      {item}
                    </Badge>
                  ))}
                </div>
                <Badge variant="gold">
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
                    <div className="rounded-[2rem] border border-white/40 bg-white/44 p-5">
                      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.95fr]">
                        <div className="space-y-4">
                          <PanelLabel
                            title="彩色筛选胶囊"
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
                                    className="rounded-full border border-rose-300/60 bg-rose-100/90 px-3 py-1 text-xs font-medium text-rose-700 transition hover:scale-105"
                                    onClick={() =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        tag: splitFilterValues(prev.tag)
                                          .filter((item) => item !== tagValue)
                                          .join(", "),
                                      }))
                                    }
                                  >
                                    #{tagValue} ×
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
                              <label className="flex h-12 items-center gap-3 rounded-[1.4rem] border border-[color:var(--panel-border)] bg-white/65 px-4 text-sm text-[color:var(--text-strong)]">
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
                            title="排序与密度"
                            description="决定封面墙的刷新节奏和结果密度。"
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
                                max={200}
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
                    <div className="rounded-[2rem] border border-white/40 bg-white/44 p-5">
                      <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
                        <div className="space-y-4">
                          <PanelLabel
                            title="结果工具"
                            description="导出当前结果，或者直接把这一屏结果扔进下载队列。"
                          />
                          <div className="grid gap-3 md:grid-cols-[1.15fr_auto_auto_auto]">
                            <Input
                              value={outputDir}
                              onChange={(event) => setOutputDir(event.target.value)}
                              placeholder="可选输出目录"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => searchDownloadMutation.mutate()}
                              disabled={!canQueueSearch || searchDownloadMutation.isPending}
                            >
                              <Download className="h-4 w-4" />
                              下载结果
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => exportMutation.mutate("csv")}
                              disabled={!canQueueSearch || exportMutation.isPending}
                            >
                              <FileDown className="h-4 w-4" />
                              CSV
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => exportMutation.mutate("json")}
                              disabled={!canQueueSearch || exportMutation.isPending}
                            >
                              <FileDown className="h-4 w-4" />
                              JSON
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <PanelLabel
                            title="快捷下载"
                            description="适合直接贴 RJ 编号，或者按数量拉一批 Hot100。"
                          />
                          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                            <Input
                              value={directIds}
                              onChange={(event) => setDirectIds(event.target.value)}
                              placeholder="输入 RJ 编号，支持逗号或换行分隔"
                            />
                            <Button
                              type="button"
                              onClick={() => directDownloadMutation.mutate("batch")}
                              disabled={
                                parseIds(directIds).length === 0 ||
                                directDownloadMutation.isPending
                              }
                            >
                              <Download className="h-4 w-4" />
                              批量下载
                            </Button>
                          </div>
                          <div className="grid gap-3 md:grid-cols-[120px_auto]">
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={hotCount}
                              onChange={(event) => setHotCount(event.target.value)}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => directDownloadMutation.mutate("hot100")}
                              disabled={directDownloadMutation.isPending}
                            >
                              <Flame className="h-4 w-4" />
                              下载 Hot100
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
                    <div className="h-52 animate-pulse rounded-[1.6rem] bg-white/45" />
                    <div className="h-4 animate-pulse rounded-full bg-white/45" />
                    <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/45" />
                  </CardContent>
                </Card>
              ))}

            {!searchQuery.isLoading &&
              works.map((work, index) => (
                <motion.div
                  key={work.source_id}
                  variants={fadeUpItem}
                  transition={{ delay: index * 0.02 }}
                >
                  <WorkCard
                    work={work}
                    detailSearch={routeSearch}
                    onSelect={() => setSelectedSourceId(work.source_id)}
                    onQueue={() => singleDownloadMutation.mutate(work.source_id)}
                  />
                </motion.div>
              ))}

            {!searchQuery.isLoading && works.length === 0 && (
              <Card className="md:col-span-2 2xl:col-span-3">
                <CardContent>
                  <EmptyState
                    symbol="(˘･_･˘)"
                    title="这里还没有掉落作品"
                    description="当前筛选条件下没有匹配结果。试着减少几个限制，或者切回高级语法看看能不能捞到新的收藏。"
                  />
                </CardContent>
              </Card>
            )}
          </motion.div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.7rem] border border-white/40 bg-white/46 px-4 py-3">
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
            title="热门标签"
            items={facets.tags}
            variant="pink"
            onPick={(value) => {
              const nextFilters = { ...filters, tag: appendFilterValue(filters.tag, value) };
              void navigate({
                to: "/discover",
                search: toRouteSearch(nextFilters, 1),
              });
            }}
          />
          <FacetCard
            title="热门社团"
            items={facets.circles}
            variant="mint"
            onPick={(value) => {
              const nextFilters = { ...filters, circle: value };
              void navigate({
                to: "/discover",
                search: toRouteSearch(nextFilters, 1),
              });
            }}
          />
          <FacetCard
            title="热门声优"
            items={facets.vas}
            variant="violet"
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
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-[color:var(--accent-rose)]">
        <Sparkles className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="text-sm text-[color:var(--text-body)]">{description}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
      {children}
    </div>
  );
}

function WorkCard({
  work,
  detailSearch,
  onSelect,
  onQueue,
}: {
  work: SearchWorkSummary;
  detailSearch: DiscoverRouteSearch;
  onSelect: () => void;
  onQueue: () => void;
}) {
  return (
    <Card interactive foil className="h-full overflow-hidden" onClick={onSelect}>
      <CardContent className="flex h-full flex-col gap-5 p-5">
        <div className="relative overflow-hidden rounded-[1.9rem]">
          {work.main_cover_url || work.thumbnail_url ? (
            <img
              src={work.main_cover_url || work.thumbnail_url}
              alt={work.title}
              className="h-60 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-60 items-center justify-center bg-white/45 text-sm text-[color:var(--text-muted)]">
              暂无封面
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(25,10,24,0.42)] via-transparent to-transparent" />
          <div className="absolute bottom-3 right-3">
            <Badge variant="pink">{work.circle || "未知社团"}</Badge>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="gold" className="shrink-0">
              {work.source_id}
            </Badge>
            <span className="text-xs text-[color:var(--text-muted)]">{work.release}</span>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold leading-7 text-[color:var(--text-strong)]">
            {work.title}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniMetric label="下载量" value={String(work.dl_count)} variant="blue" />
          <MiniMetric label="评分" value={work.rate.toFixed(2)} variant="mint" />
          <MiniMetric
            label="字幕"
            value={work.has_subtitle ? "有" : "无"}
            variant={work.has_subtitle ? "violet" : "ghost"}
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          {work.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant={tagVariant(tag)}>
              #{tag}
            </Badge>
          ))}
        </div>

        <div className="mt-auto grid gap-3 pt-1">
          <Button
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              onQueue();
            }}
          >
            <Download className="h-4 w-4" />
            加入下载队列
          </Button>
          <Link
            to="/discover/$sourceId"
            params={{ sourceId: work.source_id }}
            search={detailSearch}
            className="block rounded-full border border-[color:var(--panel-border)] bg-white/58 px-4 py-3 text-center text-sm font-medium text-[color:var(--text-strong)] transition hover:-translate-y-0.5 hover:bg-white/78"
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
  variant: "pink" | "mint" | "violet" | "blue" | "gold" | "ghost";
}) {
  return (
    <div className="rounded-[1.35rem] border border-white/40 bg-white/42 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[color:var(--text-strong)]">{value}</span>
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
  variant: "pink" | "mint" | "violet";
  onPick: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4 text-[color:var(--accent-rose)]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.length === 0 && (
          <div className="text-sm text-[color:var(--text-muted)]">暂无可用聚合</div>
        )}
        {items.map((item) => (
          <button
            key={`${title}-${item.value}`}
            className="transition hover:scale-105"
            onClick={() => onPick(item.value)}
          >
            <Badge variant={variant} active>
              {item.value} ({item.count})
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
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
  return (
    <Card foil className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">快速详情</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!detail && !loading && (
          <EmptyState
            symbol="ฅ^•ﻌ•^ฅ"
            title="点一张卡看看吧"
            description="选择一个作品后，这里会显示快速详情、音轨预览和独立详情页入口。"
            className="min-h-[20rem]"
          />
        )}
        {loading && (
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-[1.7rem] bg-white/45" />
            <div className="h-4 animate-pulse rounded-full bg-white/45" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/45" />
          </div>
        )}
        {detail && (
          <>
            <div className="overflow-hidden rounded-[1.7rem]">
              {detail.summary.main_cover_url || detail.summary.thumbnail_url ? (
                <img
                  src={detail.summary.main_cover_url || detail.summary.thumbnail_url}
                  alt={detail.summary.title}
                  className="h-52 w-full object-cover"
                />
              ) : (
                <div className="flex h-52 items-center justify-center bg-white/45 text-sm text-[color:var(--text-muted)]">
                  暂无封面
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Badge variant="gold">{detail.summary.source_id}</Badge>
              <h3 className="text-xl font-semibold text-[color:var(--text-strong)]">
                {detail.summary.title}
              </h3>
              <p className="text-sm text-[color:var(--text-body)]">{detail.summary.circle}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="发售日" value={detail.summary.release || "-"} variant="pink" />
              <MiniMetric label="价格" value={String(detail.price)} variant="gold" />
              <MiniMetric label="评论数" value={String(detail.review_count)} variant="blue" />
              <MiniMetric label="音轨数" value={String(detail.tracks.length)} variant="mint" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-[color:var(--text-body)]">音轨预览</div>
              <div className="space-y-2">
                {detail.tracks.slice(0, 6).map((track, index) => (
                  <div
                    key={`${track.title}-${index}`}
                    className="rounded-[1.2rem] border border-white/40 bg-white/44 p-3 text-sm text-[color:var(--text-strong)]"
                  >
                    {track.title}
                  </div>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={() => onQueue(detail.summary.source_id)}>
              <Download className="h-4 w-4" />
              下载当前作品
            </Button>
            <Link
              to="/discover/$sourceId"
              params={{ sourceId: detail.summary.source_id }}
              search={detailSearch}
              className="block rounded-full border border-[color:var(--panel-border)] bg-white/58 px-4 py-3 text-center text-sm font-medium text-[color:var(--text-strong)] transition hover:-translate-y-0.5 hover:bg-white/78"
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
    return "mint" as const;
  }
  if (value.includes("耳") || value.includes("催眠") || value.includes("asmr")) {
    return "pink" as const;
  }
  if (value.includes("cv") || value.includes("声优")) {
    return "violet" as const;
  }
  return "blue" as const;
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

function parseIds(raw: string) {
  return raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
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
