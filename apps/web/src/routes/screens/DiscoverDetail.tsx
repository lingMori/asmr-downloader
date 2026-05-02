import type { ReactNode } from "react";
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
  Calendar,
  Clock,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, fadeUpItem, staggerContainer } from "@/components/ui/sweet";
import type { DiscoverRouteSearch } from "@/routes/discoverSearch";
import { apiClient, type TrackNode } from "@/lib/api";

const routeApi = getRouteApi("/discover/$sourceId");
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

  const downloadMutation = useMutation({
    mutationFn: () =>
      apiClient.createDownload({
        mode: "single",
        ids: [sourceId],
      }),
    onSuccess: (res) => {
      toast.success(`已加入下载队列，任务 #${res.task_id}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  if (detailQuery.isLoading) {
    return <div className="text-[color:var(--text-body)]">正在加载作品详情...</div>;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <div className="text-[color:var(--telltale-red)]">作品详情加载失败。</div>;
  }

  const detail = detailQuery.data;
  const coverUrl = detail.summary.main_cover_url || detail.summary.thumbnail_url;

  return (
    <motion.section
      className="space-y-6"
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
          kicker="Discover Detail"
          title={detail.summary.title}
          description="作品档案页集中显示封面、核心指标、标签、声优、补充信息与音轨树，便于快速判断是否投递下载。"
          meta={
            <div className="deck-screen grid gap-2 p-4">
              <Badge variant="warn">{detail.summary.source_id}</Badge>
              <Badge variant="decal">{detail.summary.circle || "未知社团"}</Badge>
              {detail.age_category ? <Badge variant="live">{detail.age_category}</Badge> : null}
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
                <div className="deck-screen">
                  {coverUrl ? (
                    <>
                      <img
                        src={coverUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-3xl"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,12,9,0.04),rgba(5,12,9,0.62))]" />
                      <img
                        src={coverUrl}
                        alt={detail.summary.title}
                        className="relative z-10 mx-auto max-h-[42rem] w-auto max-w-full object-contain"
                      />
                    </>
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center text-sm text-[color:var(--text-mute)]">
                      暂无封面
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="warn">{detail.summary.source_id}</Badge>
                <Badge variant="decal">{detail.summary.circle || "未知社团"}</Badge>
                {detail.age_category ? <Badge variant="live">{detail.age_category}</Badge> : null}
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
                        <Badge key={tag} variant="decal">
                          #{tag}
                        </Badge>
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
                        <Badge key={va} variant="live">
                          {va}
                        </Badge>
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
                音轨树
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.tracks.map((track, index) => (
                <TrackTree key={`${track.title}-${index}`} node={track} depth={0} />
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
    </motion.section>
  );
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

function TrackTree({ node, depth }: { node: TrackNode; depth: number }) {
  const Icon = trackTypeIcon(node.type);

  return (
    <div className="space-y-2">
      <div
        className="deck-screen px-4 py-3 text-sm text-[color:var(--text-display)]"
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex items-center gap-3">
          <span className="deck-plate flex h-9 w-9 shrink-0 items-center justify-center text-[color:var(--telltale-amber)]">
            <Icon className="h-4 w-4" weight="duotone" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{node.title}</div>
            <div className="mt-1 text-xs text-[color:var(--text-mute)]">{node.type}</div>
          </div>
        </div>
      </div>
      {node.children?.map((child, index) => (
        <TrackTree key={`${child.title}-${index}`} node={child} depth={depth + 1} />
      ))}
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
  return MusicNotes;
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
