import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileDown, Flame, Search, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  apiClient,
  type DiscoverWorkDetail,
  type SearchWorkSummary,
} from "@/lib/api";

type DiscoverFilters = {
  q: string;
  tag: string;
  circle: string;
  va: string;
  subtitle: boolean;
  count: number;
};

type FacetItem = {
  value: string;
  count: number;
};

export function Discover() {
  const [draft, setDraft] = useState<DiscoverFilters>({
    q: "",
    tag: "",
    circle: "",
    va: "",
    subtitle: false,
    count: 24,
  });
  const [filters, setFilters] = useState<DiscoverFilters>({
    q: "",
    tag: "",
    circle: "",
    va: "",
    subtitle: false,
    count: 24,
  });
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [directIds, setDirectIds] = useState("");
  const [hotCount, setHotCount] = useState("10");
  const [outputDir, setOutputDir] = useState("");
  const queryClient = useQueryClient();

  const legacyQuery = useMemo(() => buildLegacyQuery(filters), [filters]);

  const searchQuery = useQuery({
    queryKey: ["discover", filters, legacyQuery],
    queryFn: async () => {
      if (legacyQuery) {
        const data = await apiClient.searchWorks({
          query: legacyQuery,
          count: filters.count,
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
        page: 1,
        pageSize: 24,
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
      toast.success(`Queued download task #${res.taskId}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const searchDownloadMutation = useMutation({
    mutationFn: () =>
      apiClient.queueSearchDownload({
        query: legacyQuery,
        count: filters.count,
        outputDir: outputDir || undefined,
      }),
    onSuccess: (res) => {
      toast.success(`Queued search download task #${res.taskId}`);
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
      toast.success(`Queued ${mode} task #${res.taskId}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: "csv" | "json") => {
      const result = await apiClient.exportSearch({
        query: legacyQuery,
        count: filters.count,
        format,
      });
      triggerBlobDownload(result.blob, result.filename ?? `search.${format}`);
      return format;
    },
    onSuccess: (format) => {
      toast.success(`Exported search results as ${format.toUpperCase()}`);
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const activeFilters = useMemo(
    () =>
      [
        filters.q && `Query: ${filters.q}`,
        filters.tag && `Tag: ${filters.tag}`,
        filters.circle && `Circle: ${filters.circle}`,
        filters.va && `VA: ${filters.va}`,
        filters.subtitle && "Subtitle only",
        legacyQuery && `Count: ${filters.count}`,
      ].filter(Boolean) as string[],
    [filters, legacyQuery],
  );

  const canQueueSearch = legacyQuery.length > 0;
  const works = searchQuery.data?.items ?? [];
  const facets = searchQuery.data?.facets ?? emptyFacets;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          Discover
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Search, export, and queue downloads
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          The new console now covers old search, search-download, search-export,
          direct RJ batch, hot100, and work detail flows. Leave every field empty
          to browse your local metadata index.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Search Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_120px_auto]">
            <Input
              value={draft.q}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, q: event.target.value }))
              }
              placeholder="Keyword, RJ ID, or advanced query string"
            />
            <Input
              value={draft.tag}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, tag: event.target.value }))
              }
              placeholder="Tag"
            />
            <Input
              value={draft.circle}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, circle: event.target.value }))
              }
              placeholder="Circle"
            />
            <Input
              value={draft.va}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, va: event.target.value }))
              }
              placeholder="VA"
            />
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
              placeholder="Count"
            />
            <Button
              onClick={() => {
                setFilters(draft);
                setSelectedSourceId("");
              }}
            >
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
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
              Subtitle only
            </label>
            <Input
              value={outputDir}
              onChange={(event) => setOutputDir(event.target.value)}
              placeholder="Optional output directory"
              className="max-w-sm"
            />
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                >
                  {item}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => searchDownloadMutation.mutate()}
              disabled={!canQueueSearch || searchDownloadMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              Queue Search Results
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportMutation.mutate("csv")}
              disabled={!canQueueSearch || exportMutation.isPending}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportMutation.mutate("json")}
              disabled={!canQueueSearch || exportMutation.isPending}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Direct Download</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={directIds}
              onChange={(event) => setDirectIds(event.target.value)}
              placeholder="RJ01037721,RJ01037722 or newline separated IDs"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => directDownloadMutation.mutate("batch")}
                disabled={parseIds(directIds).length === 0 || directDownloadMutation.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                Queue RJ Batch
              </Button>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={hotCount}
                  onChange={(event) => setHotCount(event.target.value)}
                  className="w-28"
                />
                <Button
                  variant="secondary"
                  onClick={() => directDownloadMutation.mutate("hot100")}
                  disabled={directDownloadMutation.isPending}
                >
                  <Flame className="mr-2 h-4 w-4" />
                  Queue Hot100
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Search Coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>
              Query input accepts the old CLI style syntax, including plain text
              and advanced filters such as `tag:`, `circle:`, `va:`, and
              `duration:`. Structured fields are appended on top when filled.
            </p>
            <p>
              If all structured fields are empty, this page falls back to your
              local metadata index so the old `listen` browsing flow remains
              covered by the new UI.
            </p>
          </CardContent>
        </Card>
      </div>

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
                />
              ))}
          </div>
        </div>

        <div className="space-y-4">
          <FacetCard
            title="Top tags"
            items={facets.tags}
            onPick={(value) => {
              setDraft((prev) => ({ ...prev, tag: value }));
              setFilters((prev) => ({ ...prev, tag: value }));
            }}
          />
          <FacetCard
            title="Top circles"
            items={facets.circles}
            onPick={(value) => {
              setDraft((prev) => ({ ...prev, circle: value }));
              setFilters((prev) => ({ ...prev, circle: value }));
            }}
          />
          <FacetCard
            title="Top VAs"
            items={facets.vas}
            onPick={(value) => {
              setDraft((prev) => ({ ...prev, va: value }));
              setFilters((prev) => ({ ...prev, va: value }));
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

function WorkCard({
  work,
  onSelect,
  onQueue,
}: {
  work: SearchWorkSummary;
  onSelect: () => void;
  onQueue: () => void;
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
            No cover
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium text-amber-300">
              {work.sourceId}
            </div>
            <div className="text-xs text-slate-400">{work.release}</div>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold text-white">
            {work.title}
          </h3>
          <p className="text-sm text-slate-400">{work.circle}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
          <Stat label="DL" value={String(work.dlCount)} />
          <Stat label="Rate" value={work.rate.toFixed(2)} />
          <Stat label="Subtitle" value={work.hasSubtitle ? "Yes" : "No"} />
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
          Queue download
        </Button>
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
        {items.length === 0 && (
          <div className="text-sm text-slate-500">No facets yet</div>
        )}
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
        <CardTitle>Work detail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!detail && !loading && (
          <p className="text-sm text-slate-500">
            Pick a work to inspect tracks, metadata, and download action.
          </p>
        )}
        {loading && <p className="text-sm text-slate-500">Loading detail...</p>}
        {detail && (
          <>
            <div className="space-y-2">
              <div className="text-sm font-medium text-amber-300">
                {detail.summary.sourceId}
              </div>
              <h3 className="text-xl font-semibold text-white">
                {detail.summary.title}
              </h3>
              <div className="text-sm text-slate-400">{detail.summary.circle}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
              <Stat label="Release" value={detail.summary.release || "-"} />
              <Stat label="Price" value={String(detail.price)} />
              <Stat label="Reviews" value={String(detail.reviewCount)} />
              <Stat label="Tracks" value={String(detail.tracks.length)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-slate-500">Tracks</div>
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
              Queue this work
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function buildLegacyQuery(filters: DiscoverFilters) {
  const plain = filters.q.trim();
  const searchParts = [
    filters.tag.trim() ? `tag:${filters.tag.trim()}` : "",
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

function buildFacetsFromItems(items: SearchWorkSummary[]) {
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

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const emptyFacets = {
  tags: [] as FacetItem[],
  circles: [] as FacetItem[],
  vas: [] as FacetItem[],
};
