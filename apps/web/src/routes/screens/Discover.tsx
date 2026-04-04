import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  apiClient,
  type DiscoverWorkDetail,
  type DiscoverWorkSummary,
  type SearchWorkSummary,
} from "@/lib/api";

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
  const [draft, setDraft] = useState<DiscoverFilters>(defaultDiscoverFilters);
  const [filters, setFilters] = useState<DiscoverFilters>(defaultDiscoverFilters);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [directIds, setDirectIds] = useState("");
  const [hotCount, setHotCount] = useState("10");
  const [outputDir, setOutputDir] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showTools, setShowTools] = useState(false);
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
        outputDir: outputDir || undefined,
      }),
    onSuccess: (res) => {
      toast.success(`已加入下载队列，任务 #${res.taskId}`);
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
          outputDir: outputDir || undefined,
        });
      }
      const ids = (searchQuery.data?.items ?? []).map((item) => item.sourceId);
      return apiClient.createDownload({
        mode: "batch",
        ids,
        outputDir: outputDir || undefined,
        name: "结构化筛选批量下载",
      });
    },
    onSuccess: (res) => {
      toast.success(`已加入搜索结果下载任务 #${res.taskId}`);
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
          outputDir: outputDir || undefined,
          name: `Hot100 x${Number(hotCount) || 10}`,
        });
      }

      return apiClient.createDownload({
        mode: "batch",
        ids: parseIds(directIds),
        outputDir: outputDir || undefined,
        name: "Direct batch download",
      });
    },
    onSuccess: (res, mode) => {
      toast.success(`已创建${mode === "hot100" ? " Hot100" : "批量"}下载任务 #${res.taskId}`);
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

  function submitSearch(nextDraft = draft) {
    const normalizedDraft = {
      ...nextDraft,
      q: nextDraft.q.trim(),
      tag: splitFilterValues(nextDraft.tag).join(", "),
      circle: nextDraft.circle.trim(),
      va: nextDraft.va.trim(),
    };
    setDraft(normalizedDraft);
    setFilters(normalizedDraft);
    setSelectedSourceId("");
    setPage(1);
  }

  function resetSearchPanel() {
    setDraft(defaultDiscoverFilters);
    setFilters(defaultDiscoverFilters);
    setSelectedSourceId("");
    setPage(1);
    setShowFilters(false);
    setShowTools(false);
  }

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          发现
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">搜索作品</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          支持普通条件搜索和高级语法搜索，结果可直接查看详情、导出或加入下载队列。
        </p>
      </header>

      <Card>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(245,158,11,0.1),rgba(255,255,255,0.03))] p-4">
              <div className="min-w-0 flex-1">
                <Input
                  value={draft.q}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, q: event.target.value }))
                  }
                  placeholder="输入关键词、RJ 编号，或直接粘贴高级查询表达式"
                  className="h-12 text-base"
                />
              </div>
              <Button type="submit" className="h-12 px-5">
                <Search className="mr-2 h-4 w-4" />
                搜索
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-12 px-5"
                onClick={() => setShowFilters((value) => !value)}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                筛选
                {showFilters ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-12 px-5"
                onClick={() => setShowTools((value) => !value)}
              >
                <Wrench className="mr-2 h-4 w-4" />
                工具
                {showTools ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-12 px-4"
                onClick={resetSearchPanel}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                重置
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-sm text-slate-400">
              <div className="flex flex-wrap gap-2">
                <SearchModeBadge active={!draftIsLegacyQuery}>条件搜索</SearchModeBadge>
                <SearchModeBadge active={draftIsLegacyQuery}>高级语法</SearchModeBadge>
                {activeFilters.slice(0, 4).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                  >
                    {item}
                  </span>
                ))}
                {activeFilters.length > 4 && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-500">
                    +{activeFilters.length - 4} 项条件
                  </span>
                )}
              </div>
              <span>
                第 {page} / {totalPages} 页，共 {searchQuery.data?.total ?? 0} 个作品
              </span>
            </div>

            {(showFilters || hasAdvancedDraft) && (
              <div className="rounded-3xl border border-white/10 bg-white/4 p-5">
                <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                  <div className="space-y-4">
                    <PanelLabel title="筛选条件" description="标签支持多个值，使用逗号或换行分隔。" />
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          标签
                        </div>
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
                                className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100 transition hover:border-amber-300/40"
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
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          社团
                        </div>
                        <Input
                          value={draft.circle}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, circle: event.target.value }))
                          }
                          placeholder="例如：甘幸冬水"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          声优
                        </div>
                        <Input
                          value={draft.va}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, va: event.target.value }))
                          }
                          placeholder="例如：秋野かえで"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          附加条件
                        </div>
                        <label className="flex h-11 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-slate-300">
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
                    <PanelLabel title="排序" description="先定义排序，再决定列表密度。" />
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          排序字段
                        </div>
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
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          顺序
                        </div>
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
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          每页数量
                        </div>
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
                          placeholder="24"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showTools && (
              <div className="rounded-3xl border border-white/10 bg-white/4 p-5">
                <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                  <div className="space-y-4">
                    <PanelLabel
                      title="结果工具"
                      description="导出当前结果，或把当前筛选结果整体加入下载队列。"
                    />
                    <div className="grid gap-3 md:grid-cols-[1.2fr_auto_auto_auto]">
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
                        <Download className="mr-2 h-4 w-4" />
                        下载结果
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => exportMutation.mutate("csv")}
                        disabled={!canQueueSearch || exportMutation.isPending}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        CSV
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => exportMutation.mutate("json")}
                        disabled={!canQueueSearch || exportMutation.isPending}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        JSON
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <PanelLabel
                      title="快捷下载"
                      description="适合直接粘贴 RJ 编号，或按数量拉取 Hot100。"
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
                        disabled={parseIds(directIds).length === 0 || directDownloadMutation.isPending}
                      >
                        <Download className="mr-2 h-4 w-4" />
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
                        <Flame className="mr-2 h-4 w-4" />
                        下载 Hot100
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.8fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {searchQuery.isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="border-white/10 bg-white/5">
                  <CardContent className="h-48 animate-pulse bg-white/5" />
                </Card>
              ))}

            {!searchQuery.isLoading &&
              works.map((work) => (
                <WorkCard
                  key={work.sourceId}
                  work={work}
                  onSelect={() => setSelectedSourceId(work.sourceId)}
                  onQueue={() => singleDownloadMutation.mutate(work.sourceId)}
                  detailHref={`/discover/${work.sourceId}`}
                />
              ))}

            {!searchQuery.isLoading && works.length === 0 && (
              <Card className="border-white/10 bg-white/6 backdrop-blur-xl lg:col-span-2">
                <CardContent className="py-10 text-center text-sm text-slate-400">
                  当前筛选条件下没有匹配作品。
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-400">
            <span>第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                上一页
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <FacetCard
            title="热门标签"
            items={facets.tags}
            onPick={(value) => {
              setDraft((prev) => ({ ...prev, tag: appendFilterValue(prev.tag, value) }));
              setFilters((prev) => ({ ...prev, tag: appendFilterValue(prev.tag, value) }));
              setPage(1);
            }}
          />
          <FacetCard
            title="热门社团"
            items={facets.circles}
            onPick={(value) => {
              setDraft((prev) => ({ ...prev, circle: value }));
              setFilters((prev) => ({ ...prev, circle: value }));
              setPage(1);
            }}
          />
          <FacetCard
            title="热门声优"
            items={facets.vas}
            onPick={(value) => {
              setDraft((prev) => ({ ...prev, va: value }));
              setFilters((prev) => ({ ...prev, va: value }));
              setPage(1);
            }}
          />
          <WorkDetailCard
            detail={detailQuery.data}
            loading={detailQuery.isLoading}
            onQueue={(sourceId) => singleDownloadMutation.mutate(sourceId)}
          />
        </div>
      </div>
    </section>
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
      <div className="text-xs uppercase tracking-[0.18em] text-amber-300">{title}</div>
      <div className="text-sm text-slate-400">{description}</div>
    </div>
  );
}

function SearchModeBadge({
  active,
  children,
}: {
  active: boolean;
  children: string;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-amber-400/30 bg-amber-400/12 text-amber-100"
          : "border-white/10 bg-white/5 text-slate-400"
      }`}
    >
      {children}
    </span>
  );
}

function WorkCard({
  work,
  onSelect,
  onQueue,
  detailHref,
}: {
  work: SearchWorkSummary;
  onSelect: () => void;
  onQueue: () => void;
  detailHref: string;
}) {
  return (
    <Card
      className="cursor-pointer border-white/10 bg-white/6 backdrop-blur-xl transition hover:border-amber-400/40"
      onClick={onSelect}
    >
      <CardContent className="space-y-4">
        {work.mainCoverUrl || work.thumbnailUrl ? (
          <img
            src={work.mainCoverUrl || work.thumbnailUrl}
            alt={work.title}
            className="h-44 w-full rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-44 items-center justify-center rounded-2xl bg-white/5 text-sm text-slate-500">
            暂无封面
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium text-amber-300">{work.sourceId}</div>
            <div className="text-xs text-slate-400">{work.release}</div>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold text-white">{work.title}</h3>
          <p className="text-sm text-slate-400">{work.circle}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
          <Stat label="下载量" value={String(work.dlCount)} />
          <Stat label="评分" value={work.rate.toFixed(2)} />
          <Stat label="字幕" value={work.hasSubtitle ? "有" : "无"} />
        </div>

        <div className="flex flex-wrap gap-2">
          {work.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </div>

        <Button
          className="w-full"
          onClick={(event) => {
            event.stopPropagation();
            onQueue();
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          加入下载队列
        </Button>
        <a
          href={detailHref}
          className="block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-slate-200 transition hover:border-amber-400/40 hover:text-white"
          onClick={(event) => event.stopPropagation()}
        >
          查看详情页
        </a>
      </CardContent>
    </Card>
  );
}

function FacetCard({
  title,
  items,
  onPick,
}: {
  title: string;
  items: FacetItem[];
  onPick: (value: string) => void;
}) {
  return (
    <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-amber-300" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.length === 0 && <div className="text-sm text-slate-500">暂无可用聚合</div>}
        {items.map((item) => (
          <button
            key={`${title}-${item.value}`}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 transition hover:border-amber-400/40 hover:text-white"
            onClick={() => onPick(item.value)}
          >
            {item.value} ({item.count})
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function WorkDetailCard({
  detail,
  loading,
  onQueue,
}: {
  detail?: DiscoverWorkDetail;
  loading: boolean;
  onQueue: (sourceId: string) => void;
}) {
  return (
    <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>快速详情</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!detail && !loading && (
          <p className="text-sm text-slate-500">
            选择一个作品即可快速查看音轨、元数据和下载操作。
          </p>
        )}
        {loading && <p className="text-sm text-slate-500">正在加载详情...</p>}
        {detail && (
          <>
            <div className="space-y-2">
              <div className="text-sm font-medium text-amber-300">
                {detail.summary.sourceId}
              </div>
              <h3 className="text-xl font-semibold text-white">{detail.summary.title}</h3>
              <div className="text-sm text-slate-400">{detail.summary.circle}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
              <Stat label="发售日" value={detail.summary.release || "-"} />
              <Stat label="价格" value={String(detail.price)} />
              <Stat label="评论数" value={String(detail.reviewCount)} />
              <Stat label="音轨数" value={String(detail.tracks.length)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-slate-500">音轨列表</div>
              <div className="space-y-2">
                {detail.tracks.slice(0, 8).map((track, index) => (
                  <div
                    key={`${track.title}-${index}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300"
                  >
                    {track.title}
                  </div>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={() => onQueue(detail.summary.sourceId)}>
              <Download className="mr-2 h-4 w-4" />
              下载当前作品
            </Button>
            <a
              href={`/discover/${detail.summary.sourceId}`}
              className="block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-slate-200 transition hover:border-amber-400/40 hover:text-white"
            >
              打开独立详情页
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
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
    item.sourceId,
    escapeCSV(item.title),
    escapeCSV(item.circle),
    item.release,
    String(item.dlCount),
    String(item.rate),
    String(item.duration),
    item.hasSubtitle ? "true" : "false",
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
