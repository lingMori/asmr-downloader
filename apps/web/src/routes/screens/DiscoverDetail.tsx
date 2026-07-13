import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowLeft,
  ChatText,
  CurrencyDollar,
  Download,
  FileText,
  Globe,
  Info,
  MusicNotes,
  Star,
  Tag,
  UserCircle,
  CaretDown,
  CaretRight,
  Calendar,
  FolderOpen,
  Play,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useGlobalPlayer } from "@/components/GlobalPlayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DiscoverRouteSearch } from "@/routes/discoverSearch";
import { apiClient, type TrackNode, type WorkStatus } from "@/lib/api";
import {
  flattenPlayableTracks,
  flattenSubtitleTracks,
  isTrackFolder,
} from "@/lib/playback";
import { cn } from "@/lib/utils";

const routeApi = getRouteApi("/discover/$sourceId");
const PLAYER_LOG_PREFIX = "[ASMRoner Player]";
const pillActionClass =
  "deck-button-secondary inline-flex h-9 items-center justify-center gap-2 border px-3 text-xs font-bold";

export function DiscoverDetail() {
  const player = useGlobalPlayer();
  const { sourceId } = routeApi.useParams();
  const discoverSearch = routeApi.useSearch() as DiscoverRouteSearch;
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["discover", "detail-page", sourceId],
    queryFn: () => apiClient.getDiscoverWork(sourceId),
  });
  const workStatusQuery = useQuery({
    queryKey: ["work-status", sourceId],
    queryFn: () => apiClient.getWorkStatuses([sourceId]),
    enabled: sourceId.length > 0,
    staleTime: 5000,
  });
  const detail = detailQuery.data;
  const workStatus = workStatusQuery.data?.items[0];
  const remoteAudioFiles = useMemo(
    () => flattenPlayableTracks(detail?.tracks ?? []),
    [detail?.tracks],
  );
  const remoteSubtitleFiles = useMemo(
    () => flattenSubtitleTracks(detail?.tracks ?? []),
    [detail?.tracks],
  );
  const [selectedTrackPath, setSelectedTrackPath] = useState("");

  useEffect(() => {
    setSelectedTrackPath((current) => {
      if (remoteAudioFiles.some((file) => file.path === current)) {
        return current;
      }
      return remoteAudioFiles[0]?.path ?? "";
    });
  }, [remoteAudioFiles]);

  useEffect(() => {
    if (!detail) {
      return;
    }
    console.info(PLAYER_LOG_PREFIX, "detail tracks loaded", {
      sourceId: detail.summary.source_id,
      topLevelTrackCount: detail.tracks.length,
      playableTrackCount: remoteAudioFiles.length,
      playableTracks: remoteAudioFiles,
      rawTracks: detail.tracks,
    });
  }, [detail, remoteAudioFiles]);

  function selectAndPlayTrack(path: string) {
    console.info(PLAYER_LOG_PREFIX, "detail tree track clicked", {
      path,
      audioFilesCount: remoteAudioFiles.length,
      track: remoteAudioFiles.find((file) => file.path === path),
      sourceId: detail?.summary.source_id,
    });
    setSelectedTrackPath(path);
    if (detail) {
      player.play({
        tracks: remoteAudioFiles,
        subtitles: remoteSubtitleFiles,
        title: detail.summary.title,
        mediaId: detail.summary.source_id,
        coverUrl: detail.summary.main_cover_url || detail.summary.thumbnail_url,
      }, path);
    }
  }

  const downloadMutation = useMutation({
    mutationFn: () =>
      apiClient.createDownload({
        mode: "single",
        ids: [sourceId],
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

  if (detailQuery.isLoading) {
    return <div className="text-[color:var(--text-body)]">正在加载作品详情...</div>;
  }

  if (detailQuery.isError || !detail) {
    return <div className="text-[color:var(--telltale-red)]">作品详情加载失败。</div>;
  }

  const coverUrl = detail.summary.main_cover_url || detail.summary.thumbnail_url;

  return (
    <section className="space-y-4">
      <header className="space-y-4 border-b border-[color:var(--chassis-edge)] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/discover" search={discoverSearch} className={pillActionClass}>
            <ArrowLeft className="h-4 w-4" />
            返回作品搜索
          </Link>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => selectedTrackPath && selectAndPlayTrack(selectedTrackPath)}
              disabled={!selectedTrackPath}
            >
              <Play className="h-4 w-4" weight="fill" />
              播放选中音轨
            </Button>
            <Button
              size="sm"
              busy={downloadMutation.isPending}
              onClick={() => downloadMutation.mutate()}
              disabled={downloadMutation.isPending}
            >
              <Download className="h-4 w-4" />
              下载当前作品
            </Button>
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warn">{detail.summary.source_id}</Badge>
            <WorkStatusBadge status={workStatus} />
            <Badge variant={detail.summary.has_subtitle ? "signal" : "mute"}>
              {detail.summary.has_subtitle ? "有字幕" : "无字幕"}
            </Badge>
            {detail.age_category ? <Badge variant="mute">{detail.age_category}</Badge> : null}
          </div>
          <h1 className="max-w-5xl text-2xl font-semibold leading-tight text-[color:var(--text-display)]">
            {detail.summary.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[color:var(--text-body)]">
            {detail.summary.circle ? (
              <DetailSearchChip
                kind="社团"
                label={detail.summary.circle}
                variant="decal"
                search={buildDetailFacetSearch(discoverSearch, {
                  circle: detail.summary.circle,
                })}
              />
            ) : (
              <span>未知社团</span>
            )}
            <span>{detail.summary.release || "发售日期未知"}</span>
            <span>{formatDuration(detail.summary.duration)}</span>
          </div>
        </div>
      </header>

      <div>
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="grid gap-5 p-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
              <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
                <div className="flex aspect-square items-center justify-center overflow-hidden border border-[color:var(--chassis-edge)] bg-[color:var(--interactive-bg)]">
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
                <a
                  href={detail.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${pillActionClass} w-full`}
                >
                  <Globe className="h-4 w-4" />
                  打开源站作品页
                </a>
              </div>

              <div className="min-w-0 space-y-5">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <InfoStat
                  icon={CurrencyDollar}
                  label="价格"
                  value={String(detail.price)}
                />
                <InfoStat
                  icon={Download}
                  label="下载量"
                  value={String(detail.summary.dl_count)}
                />
                <InfoStat
                  icon={Star}
                  label="评分"
                  value={detail.summary.rate.toFixed(2)}
                />
                <InfoStat
                  icon={ChatText}
                  label="评论数"
                  value={String(detail.review_count)}
                />
                <InfoStat
                  icon={Info}
                  label="评分人数"
                  value={String(detail.rate_count)}
                />
                <InfoStat
                  icon={MusicNotes}
                  label="音轨数"
                  value={String(detail.tracks.length)}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <CompactInfoRow
                  icon={Info}
                  label="社团 ID"
                  value={String(detail.circle_id)}
                />
                <CompactInfoRow
                  icon={MusicNotes}
                  label="作品属性"
                  value={detail.work_attributes || "-"}
                />
                <CompactInfoRow
                  icon={Calendar}
                  label="创建日期"
                  value={detail.create_date || "-"}
                />
              </div>

              <div className="grid gap-4 border-t border-[color:var(--chassis-edge)] pt-4 lg:grid-cols-2">
                <MetaBlock title="标签" icon={Tag}>
                  <div className="flex flex-wrap gap-2">
                    {detail.summary.tags.length > 0 ? (
                      detail.summary.tags.map((tag) => (
                        <DetailSearchChip
                          key={tag}
                          kind="标签"
                          label={tag}
                          prefix="#"
                          variant="decal"
                          search={buildDetailFacetSearch(discoverSearch, { tag })}
                        />
                      ))
                    ) : (
                      <Badge variant="mute">暂无标签</Badge>
                    )}
                  </div>
                </MetaBlock>

                <MetaBlock title="声优" icon={UserCircle}>
                  <div className="flex flex-wrap gap-2">
                    {detail.summary.vas.length > 0 ? (
                      detail.summary.vas.map((va) => (
                        <DetailSearchChip
                          key={va}
                          kind="声优"
                          label={va}
                          variant="live"
                          search={buildDetailFacetSearch(discoverSearch, { va })}
                        />
                      ))
                    ) : (
                      <Badge variant="mute">暂无声优信息</Badge>
                    )}
                  </div>
                </MetaBlock>
              </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-[color:var(--chassis-edge)] pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm normal-case">
                <span className="flex items-center gap-2">
                  <MusicNotes className="h-4 w-4 text-[color:var(--tape-pink)]" />
                  文件树
                </span>
                <span className="font-normal text-[color:var(--text-mute)]">
                  {remoteAudioFiles.length} 个可播放文件，点击文件立即播放
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {detail.tracks.length > 0 ? (
                <div className="divide-y divide-[color:var(--chassis-edge)]">
                  {detail.tracks.map((track, index) => (
                    <TrackTree
                      key={`${track.title}-${index}`}
                      node={track}
                      depth={0}
                      selectedTrackPath={selectedTrackPath}
                      onSelectTrack={selectAndPlayTrack}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-5 text-sm text-[color:var(--text-mute)]">暂无文件。</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function buildDetailFacetSearch(
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

function DetailSearchChip({
  kind,
  label,
  prefix = "",
  variant,
  search,
}: {
  kind: "标签" | "声优" | "社团";
  label: string;
  prefix?: string;
  variant: "decal" | "live" | "signal";
  search: DiscoverRouteSearch;
}) {
  return (
    <Link
      to="/discover"
      search={search}
      title={`搜索${kind}: ${label}`}
      className="max-w-full min-w-0"
    >
      <Badge variant={variant} className="max-w-full min-w-0 gap-1">
        <span className="min-w-0 max-w-[min(18rem,72vw)] truncate">
          {prefix}
          {label}
        </span>
      </Badge>
    </Link>
  );
}

function WorkStatusBadge({ status }: { status?: WorkStatus }) {
  if (!status || status.state === "none") {
    return null;
  }

  return (
    <Badge
      variant={workStatusBadgeVariant(status.state)}
      title={status.message || status.label}
      className="shrink-0"
    >
      {status.label}
    </Badge>
  );
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
    default:
      return "mute" as const;
  }
}

function InfoStat({
  icon: Icon,
  label,
  value,
}: {
  icon: Icon;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-[color:var(--chassis-edge)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center text-[color:var(--text-mute)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-[color:var(--text-mute)]">
            {label}
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-display)]">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: Icon;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--text-display)]">
          <Icon className="h-4 w-4 text-[color:var(--text-mute)]" />
          {title}
      </h2>
      {children}
    </section>
  );
}

function CompactInfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: Icon;
  label: string;
  value: string;
}) {
  return (
    <div className="border-l-2 border-[color:var(--chassis-edge)] px-3 py-2">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-[color:var(--text-mute)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-[color:var(--text-mute)]">
            {label}
          </div>
          <div className="mt-1 text-sm font-semibold leading-6 text-[color:var(--text-display)]">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackTree({
  node,
  depth,
  selectedTrackPath,
  onSelectTrack,
}: {
  node: TrackNode;
  depth: number;
  selectedTrackPath: string;
  onSelectTrack: (path: string) => void;
}) {
  const isFolder = isTrackFolder(node);
  const [expanded, setExpanded] = useState(depth < 1);
  const Icon = isFolder ? FolderOpen : trackTypeIcon(node.type);
  const childCount = countTrackChildren(node);
  const isPlayable = Boolean(node.play_url && node.id);
  const isActive = isPlayable && selectedTrackPath === node.id;

  return (
    <div>
      <button
        type="button"
        aria-expanded={isFolder ? expanded : undefined}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "group flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[color:var(--text-display)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--tape-pink)]",
          isActive
            ? "bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)]"
            : "hover:bg-[color:var(--interactive-bg)]",
          !isFolder && !isPlayable ? "cursor-default opacity-75" : "",
        )}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => {
          console.info(PLAYER_LOG_PREFIX, "detail tree node clicked", {
            title: node.title,
            type: node.type,
            id: node.id,
            playUrl: node.play_url,
            isFolder,
            isPlayable,
            depth,
            childCount,
          });
          if (isFolder) {
            setExpanded((value) => !value);
            return;
          }
          if (isPlayable && node.id) {
            onSelectTrack(node.id);
            return;
          }
          console.warn(PLAYER_LOG_PREFIX, "detail tree node is not playable", {
            reason: !node.id ? "missing id" : "missing play_url",
            node,
          });
        }}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[color:var(--text-mute)]">
          {isFolder ? (
            expanded ? (
              <CaretDown className="h-4 w-4" weight="bold" />
            ) : (
              <CaretRight className="h-4 w-4" weight="bold" />
            )
          ) : null}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[color:var(--text-mute)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{node.title}</div>
          <div className="mt-0.5 truncate text-xs text-[color:var(--text-mute)]">
            {isFolder ? `${childCount} 个项目` : isPlayable ? "可在线播放" : node.type || "file"}
          </div>
        </div>
      </button>
      {isFolder && expanded ? (
        <div className="ml-5 border-l border-[color:var(--chassis-edge)]">
          {node.children?.map((child, index) => (
            <TrackTree
              key={`${child.title}-${index}`}
              node={child}
              depth={depth + 1}
              selectedTrackPath={selectedTrackPath}
              onSelectTrack={onSelectTrack}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function trackTypeIcon(type: string): Icon {
  const value = type.toLowerCase();
  if (value.includes("audio") || value.includes("track")) {
    return MusicNotes;
  }
  if (value.includes("folder") || value.includes("album")) {
    return Tag;
  }
  return FileText;
}

function countTrackChildren(node: TrackNode): number {
  if (!node.children?.length) {
    return 0;
  }
  return node.children.reduce((total, child) => total + 1 + countTrackChildren(child), 0);
}

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) {
    return "-";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
