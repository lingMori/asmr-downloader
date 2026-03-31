import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Search, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  apiClient,
  type DiscoverFacet,
  type DiscoverWorkDetail,
} from "@/lib/api";

type DiscoverFilters = {
  q: string;
  tag: string;
  circle: string;
  va: string;
  subtitle: boolean;
};

export function Discover() {
  const [draft, setDraft] = useState<DiscoverFilters>({
    q: "",
    tag: "",
    circle: "",
    va: "",
    subtitle: false,
  });
  const [filters, setFilters] = useState<DiscoverFilters>({
    q: "",
    tag: "",
    circle: "",
    va: "",
    subtitle: false,
  });
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const queryClient = useQueryClient();

  const searchQuery = useQuery({
    queryKey: ["discover", filters],
    queryFn: () =>
      apiClient.searchDiscover({
        ...filters,
        page: 1,
        pageSize: 24,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["discover", "work", selectedSourceId],
    queryFn: () => apiClient.getDiscoverWork(selectedSourceId),
    enabled: selectedSourceId.length > 0,
  });

  const downloadMutation = useMutation({
    mutationFn: (sourceId: string) =>
      apiClient.createDownload({
        mode: "single",
        ids: [sourceId],
      }),
    onSuccess: (res) => {
      toast.success(`Queued download task #${res.taskId}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const activeFilters = useMemo(
    () =>
      [
        filters.q && `Keyword: ${filters.q}`,
        filters.tag && `Tag: ${filters.tag}`,
        filters.circle && `Circle: ${filters.circle}`,
        filters.va && `VA: ${filters.va}`,
        filters.subtitle && "Subtitle only",
      ].filter(Boolean) as string[],
    [filters],
  );

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          Discover
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Search works and queue downloads
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Search by keyword, then narrow with tags, circle, VA, and subtitle coverage.
          Discover defaults to your local metadata index when no query is entered.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <Input
              value={draft.q}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, q: event.target.value }))
              }
              placeholder="Search keyword, RJ ID, title..."
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
              searchQuery.data?.items.map((work) => (
                <Card
                  key={work.sourceId}
                  className="cursor-pointer border-white/10 bg-white/6 backdrop-blur-xl transition hover:border-amber-400/40"
                  onClick={() => setSelectedSourceId(work.sourceId)}
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
                        <div className="text-xs text-slate-400">
                          {work.release}
                        </div>
                      </div>
                      <h3 className="line-clamp-2 text-lg font-semibold text-white">
                        {work.title}
                      </h3>
                      <p className="text-sm text-slate-400">{work.circle}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                      <Stat label="DL" value={String(work.dlCount)} />
                      <Stat label="Rate" value={work.rate.toFixed(2)} />
                      <Stat
                        label="Subtitle"
                        value={work.hasSubtitle ? "Yes" : "No"}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {work.tags.slice(0, 4).map((tag) => (
                        <button
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDraft((prev) => ({ ...prev, tag }));
                            setFilters((prev) => ({ ...prev, tag }));
                            setSelectedSourceId("");
                          }}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                    <Button
                      className="w-full"
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadMutation.mutate(work.sourceId);
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Queue download
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>

        <div className="space-y-4">
          <FacetCard
            title="Top tags"
            items={searchQuery.data?.facets.tags ?? []}
            onPick={(value) => {
              setDraft((prev) => ({ ...prev, tag: value }));
              setFilters((prev) => ({ ...prev, tag: value }));
            }}
          />
          <FacetCard
            title="Top circles"
            items={searchQuery.data?.facets.circles ?? []}
            onPick={(value) => {
              setDraft((prev) => ({ ...prev, circle: value }));
              setFilters((prev) => ({ ...prev, circle: value }));
            }}
          />
          <FacetCard
            title="Top VAs"
            items={searchQuery.data?.facets.vas ?? []}
            onPick={(value) => {
              setDraft((prev) => ({ ...prev, va: value }));
              setFilters((prev) => ({ ...prev, va: value }));
            }}
          />
          <WorkDetailCard
            detail={detailQuery.data}
            loading={detailQuery.isLoading}
            onQueue={(sourceId) => downloadMutation.mutate(sourceId)}
          />
        </div>
      </div>
    </section>
  );
}

function FacetCard({
  title,
  items,
  onPick,
}: {
  title: string;
  items: DiscoverFacet[];
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
