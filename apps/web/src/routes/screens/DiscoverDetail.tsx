import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
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
  ShieldCheck,
  Star,
  Tag,
  UserCircle,
  Buildings,
  CaretDown,
  CaretRight,
  Calendar,
  Clock,
  FolderOpen,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { AudioDeck, type AudioDeckHandle } from "@/components/AudioDeck";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, fadeUpItem, staggerContainer } from "@/components/ui/sweet";
import type { DiscoverRouteSearch } from "@/routes/discoverSearch";
import { apiClient, type TrackNode, type WorkStatus } from "@/lib/api";
import {
  findSubtitleForAudio,
  flattenPlayableTracks,
  flattenSubtitleTracks,
  isTrackFolder,
  playNextTrack,
} from "@/lib/playback";
import { cn } from "@/lib/utils";

const routeApi = getRouteApi("/discover/$sourceId");
const PLAYER_LOG_PREFIX = "[ASMRoner Player]";
const pillActionClass =
  "deck-button-secondary inline-flex h-[38px] items-center justify-center gap-2 border px-4 py-2 text-xs font-bold transition hover:brightness-110";

export function DiscoverDetail() {
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
  const audioDeckRef = useRef<AudioDeckHandle | null>(null);

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

  const selectedAudioFile = remoteAudioFiles.find((file) => file.path === selectedTrackPath);
  const selectedSubtitleFile = findSubtitleForAudio(remoteSubtitleFiles, selectedAudioFile);

  function selectAndPlayTrack(path: string) {
    console.info(PLAYER_LOG_PREFIX, "detail tree track clicked", {
      path,
      hasDeck: Boolean(audioDeckRef.current),
      audioFilesCount: remoteAudioFiles.length,
      track: remoteAudioFiles.find((file) => file.path === path),
      sourceId: detail?.summary.source_id,
    });
    if (audioDeckRef.current) {
      void audioDeckRef.current.playTrack(path);
      return;
    }
    setSelectedTrackPath(path);
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
    <motion.section
      className="space-y-4 pb-28"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/discover" search={discoverSearch} className={pillActionClass}>
            <ArrowLeft className="h-4 w-4" />
            返回作品搜索
          </Link>
          <Button
            busy={downloadMutation.isPending}
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending}
          >
            <Download className="h-4 w-4" />
            下载当前作品
          </Button>
        </div>
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="作品详情"
          title={detail.summary.title}
          description="查看封面、指标、标签、声优和音轨，确认后加入下载。"
          meta={
            <div className="deck-screen grid gap-2 p-3">
              <Badge variant="warn">{detail.summary.source_id}</Badge>
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
                <Badge variant="decal">未知社团</Badge>
              )}
              {detail.age_category ? <Badge variant="live">{detail.age_category}</Badge> : null}
              <WorkStatusBadge status={workStatus} />
            </div>
          }
        />
      </motion.div>

      <motion.div
        variants={fadeUpItem}
        className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_19rem]"
      >
        <div className="space-y-4">
          <Card foil className="overflow-hidden">
            <CardContent className="space-y-4 p-4">
              <div className="deck-bezel">
                <div className="deck-screen min-h-[16rem] p-3 sm:min-h-[22rem]">
                  {coverUrl ? (
                    <>
                      <img
                        src={coverUrl}
                        alt=""
                        aria-hidden="true"
                        className="deck-screen-fill h-full w-full scale-110 object-cover opacity-20 blur-3xl"
                      />
                      <div className="deck-screen-fill bg-[linear-gradient(180deg,rgba(5,12,9,0.04),rgba(5,12,9,0.62))]" />
                      <div className="deck-screen-content flex min-h-[14rem] items-center justify-center sm:min-h-[20rem]">
                        <img
                          src={coverUrl}
                          alt={detail.summary.title}
                          className="max-h-[min(68vh,42rem)] w-full max-w-full object-contain"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[14rem] items-center justify-center text-sm text-[color:var(--text-mute)] sm:min-h-[20rem]">
                      暂无封面
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="warn">{detail.summary.source_id}</Badge>
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
                  <Badge variant="decal">未知社团</Badge>
                )}
                {detail.age_category ? <Badge variant="live">{detail.age_category}</Badge> : null}
                <WorkStatusBadge status={workStatus} />
                <Badge variant={detail.summary.has_subtitle ? "signal" : "mute"}>
                  {detail.summary.has_subtitle ? "有字幕" : "无字幕"}
                </Badge>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                <InfoStat
                  icon={Calendar}
                  label="发售日"
                  value={detail.summary.release || "-"}
                />
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
                <InfoStat
                  icon={Clock}
                  label="时长"
                  value={formatDuration(detail.summary.duration)}
                />
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                <CompactInfoRow
                  icon={Buildings}
                  label="社团"
                  value={detail.summary.circle || "-"}
                />
                <CompactInfoRow
                  icon={Info}
                  label="社团 ID"
                  value={String(detail.circle_id)}
                />
                <CompactInfoRow
                  icon={ShieldCheck}
                  label="年龄分级"
                  value={detail.age_category || "-"}
                />
                <CompactInfoRow
                  icon={MusicNotes}
                  label="作品属性"
                  value={detail.work_attributes || "-"}
                />
                <CompactInfoRow
                  icon={FileText}
                  label="字幕状态"
                  value={detail.summary.has_subtitle ? "有字幕" : "无字幕"}
                />
                <CompactInfoRow
                  icon={Calendar}
                  label="创建日期"
                  value={detail.create_date || "-"}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
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
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MusicNotes className="h-4 w-4 text-[color:var(--tape-pink)]" weight="duotone" />
                文件树
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.tracks.map((track, index) => (
                <TrackTree
                  key={`${track.title}-${index}`}
                  node={track}
                  depth={0}
                  selectedTrackPath={selectedTrackPath}
                  onSelectTrack={selectAndPlayTrack}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card foil className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-[color:var(--tape-pink)]" weight="duotone" />
                快速操作
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                busy={downloadMutation.isPending}
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
              >
                <Download className="h-4 w-4" />
                加入下载队列
              </Button>
              <a
                href={detail.source_url}
                target="_blank"
                rel="noreferrer"
                className={pillActionClass}
              >
                <Globe className="h-4 w-4" />
                打开源站作品页
              </a>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="h-4 w-4 text-[color:var(--tape-pink)]" weight="duotone" />
                作品概览
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
              <SummaryTile label="RJ 编号" value={detail.summary.source_id} />
              <SummaryTile label="下载状态" value={workStatus?.label || "未下载"} />
              <SummaryTile label="社团名" value={detail.summary.circle || "-"} />
              <SummaryTile label="标签数量" value={String(detail.summary.tags.length)} />
              <SummaryTile label="声优数量" value={String(detail.summary.vas.length)} />
              <SummaryTile
                label="字幕状态"
                value={detail.summary.has_subtitle ? "有字幕" : "无字幕"}
              />
              <SummaryTile label="评分人数" value={String(detail.rate_count)} />
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {remoteAudioFiles.length > 0 ? (
        <AudioDeck
          ref={audioDeckRef}
          variant="dock"
          tracks={remoteAudioFiles}
          selectedPath={selectedTrackPath}
          onSelect={setSelectedTrackPath}
          subtitle={selectedSubtitleFile}
          subtitles={remoteSubtitleFiles}
          title={detail.summary.title}
          mediaId={detail.summary.source_id}
          coverUrl={coverUrl}
          onEnded={() =>
            playNextTrack(remoteAudioFiles, selectedTrackPath, selectAndPlayTrack)
          }
        />
      ) : null}
    </motion.section>
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
      className="max-w-full min-w-0 transition hover:brightness-110"
    >
      <Badge variant={variant} active className="max-w-full min-w-0 gap-1">
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
    <div className="deck-screen px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="deck-plate flex h-9 w-9 items-center justify-center text-[color:var(--telltale-amber)]">
          <Icon className="h-4 w-4" weight="duotone" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-mute)]">
            {label}
          </div>
          <div className="console-readout mt-0.5 truncate text-sm">
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
    <Card surface="screen">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-[color:var(--telltale-amber)]" weight="duotone" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 pb-4">{children}</CardContent>
    </Card>
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
    <div className="deck-screen px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="deck-plate mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center text-[color:var(--telltale-amber)]">
          <Icon className="h-4 w-4" weight="duotone" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-mute)]">
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

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="deck-screen px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-mute)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[color:var(--text-display)]">{value}</div>
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
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={isFolder ? expanded : undefined}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "deck-plate group flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[color:var(--text-display)] transition",
          isActive
            ? "border-[color:var(--tape-pink)] shadow-[var(--glow-tape)]"
            : "hover:border-[color:var(--telltale-amber)] hover:brightness-110",
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
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[color:var(--telltale-amber)]">
          <Icon className="h-4 w-4" weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{node.title}</div>
          <div className="mt-0.5 truncate text-xs text-[color:var(--text-mute)]">
            {isFolder ? `${childCount} 个项目` : isPlayable ? "可在线播放" : node.type || "file"}
          </div>
        </div>
      </button>
      {isFolder && expanded ? (
        <div className="ml-5 border-l border-[color:var(--chassis-edge)] pl-2">
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
