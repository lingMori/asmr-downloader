import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  AudioLines,
  BadgeInfo,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  Globe,
  MessageSquareText,
  Music4,
  ShieldCheck,
  Star,
  Tags,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, fadeUpItem, staggerContainer } from "@/components/ui/sweet";
import type { DiscoverRouteSearch } from "@/routes/discoverSearch";
import { apiClient, type TrackNode } from "@/lib/api";

const routeApi = getRouteApi("/discover/$sourceId");
const pillActionClass =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-white/58 px-4 py-3 text-sm font-medium text-[color:var(--text-strong)] transition hover:-translate-y-0.5 hover:border-[color:var(--interactive-border)] hover:bg-[color:var(--interactive-bg)] hover:shadow-[var(--interactive-shadow)]";

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
      toast.success(`已加入下载队列，任务 #${res.taskId}`);
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
    return <div className="text-rose-500">作品详情加载失败。</div>;
  }

  const detail = detailQuery.data;
  const coverUrl = detail.summary.mainCoverUrl || detail.summary.thumbnailUrl;

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
          <Button onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}>
            <Download className="h-4 w-4" />
            下载当前作品
          </Button>
        </div>
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="Discover Detail"
          title={detail.summary.title}
          description="改成更高密度的作品资料页后，封面、核心指标、标签、声优、补充信息和音轨树会同时留在视野里，不需要来回扫大段空白。"
          meta={
            <div className="grid gap-2 rounded-[1.8rem] border border-white/40 bg-white/45 p-4 shadow-[0_16px_34px_rgba(255,182,193,0.12)]">
              <Badge variant="gold">{detail.summary.sourceId}</Badge>
              <Badge variant="pink">{detail.summary.circle || "未知社团"}</Badge>
              {detail.ageCategory ? <Badge variant="violet">{detail.ageCategory}</Badge> : null}
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
              <div className="rounded-[1.8rem] border border-white/45 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,239,246,0.72))] p-3 shadow-[0_18px_36px_rgba(255,182,193,0.14)] lg:p-4">
                <div className="relative overflow-hidden rounded-[1.55rem] bg-white/82">
                  {coverUrl ? (
                    <>
                      <img
                        src={coverUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-3xl"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.72))]" />
                      <img
                        src={coverUrl}
                        alt={detail.summary.title}
                        className="relative z-10 mx-auto max-h-[42rem] w-auto max-w-full object-contain"
                      />
                    </>
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center text-sm text-[color:var(--text-muted)]">
                      暂无封面
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="gold">{detail.summary.sourceId}</Badge>
                <Badge variant="pink">{detail.summary.circle || "未知社团"}</Badge>
                {detail.ageCategory ? <Badge variant="violet">{detail.ageCategory}</Badge> : null}
                <Badge variant={detail.summary.hasSubtitle ? "mint" : "ghost"}>
                  {detail.summary.hasSubtitle ? "有字幕" : "无字幕"}
                </Badge>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                <InfoStat
                  icon={CalendarDays}
                  label="发售日"
                  value={detail.summary.release || "-"}
                  accentClassName="from-amber-300 to-orange-300"
                />
                <InfoStat
                  icon={CircleDollarSign}
                  label="价格"
                  value={String(detail.price)}
                  accentClassName="from-emerald-300 to-cyan-300"
                />
                <InfoStat
                  icon={Download}
                  label="下载量"
                  value={String(detail.summary.dlCount)}
                  accentClassName="from-rose-300 to-pink-300"
                />
                <InfoStat
                  icon={Star}
                  label="评分"
                  value={detail.summary.rate.toFixed(2)}
                  accentClassName="from-amber-200 to-rose-300"
                />
                <InfoStat
                  icon={MessageSquareText}
                  label="评论数"
                  value={String(detail.reviewCount)}
                  accentClassName="from-violet-300 to-fuchsia-300"
                />
                <InfoStat
                  icon={BadgeInfo}
                  label="评分人数"
                  value={String(detail.rateCount)}
                  accentClassName="from-violet-300 to-sky-300"
                />
                <InfoStat
                  icon={Music4}
                  label="音轨数"
                  value={String(detail.tracks.length)}
                  accentClassName="from-sky-300 to-blue-300"
                />
                <InfoStat
                  icon={Clock3}
                  label="时长"
                  value={formatDuration(detail.summary.duration)}
                  accentClassName="from-emerald-300 to-teal-300"
                />
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                <CompactInfoRow
                  icon={Building2}
                  label="社团"
                  value={detail.summary.circle || "-"}
                />
                <CompactInfoRow
                  icon={BadgeInfo}
                  label="社团 ID"
                  value={String(detail.circleId)}
                />
                <CompactInfoRow
                  icon={ShieldCheck}
                  label="年龄分级"
                  value={detail.ageCategory || "-"}
                />
                <CompactInfoRow
                  icon={AudioLines}
                  label="作品属性"
                  value={detail.workAttributes || "-"}
                />
                <CompactInfoRow
                  icon={FileText}
                  label="字幕状态"
                  value={detail.summary.hasSubtitle ? "有字幕" : "无字幕"}
                />
                <CompactInfoRow
                  icon={CalendarDays}
                  label="创建日期"
                  value={detail.createDate || "-"}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <MetaBlock title="标签" icon={Tags}>
                  <div className="flex flex-wrap gap-2">
                    {detail.summary.tags.length > 0 ? (
                      detail.summary.tags.map((tag) => (
                        <Badge key={tag} variant="pink">
                          #{tag}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="ghost">暂无标签</Badge>
                    )}
                  </div>
                </MetaBlock>

                <MetaBlock title="声优" icon={UserRound}>
                  <div className="flex flex-wrap gap-2">
                    {detail.summary.vas.length > 0 ? (
                      detail.summary.vas.map((va) => (
                        <Badge key={va} variant="violet">
                          {va}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="ghost">暂无声优信息</Badge>
                    )}
                  </div>
                </MetaBlock>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AudioLines className="h-4 w-4 text-[color:var(--accent-rose)]" />
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
                <Globe className="h-4 w-4 text-[color:var(--accent-rose)]" />
                快速操作
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
              >
                <Download className="h-4 w-4" />
                加入下载队列
              </Button>
              <a
                href={detail.sourceUrl}
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
                <Star className="h-4 w-4 text-[color:var(--accent-rose)]" />
                作品概览
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
              <SummaryTile label="RJ 编号" value={detail.summary.sourceId} />
              <SummaryTile label="社团名" value={detail.summary.circle || "-"} />
              <SummaryTile label="标签数量" value={String(detail.summary.tags.length)} />
              <SummaryTile label="声优数量" value={String(detail.summary.vas.length)} />
              <SummaryTile
                label="字幕状态"
                value={detail.summary.hasSubtitle ? "有字幕" : "无字幕"}
              />
              <SummaryTile label="评分人数" value={String(detail.rateCount)} />
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
  accentClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accentClassName: string;
}) {
  return (
    <div className="rounded-[1.3rem] border border-white/40 bg-white/42 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_10px_20px_rgba(255,182,193,0.18)] ${accentClassName}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            {label}
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-strong)]">
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
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card className="bg-white/42">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-[color:var(--accent-rose)]" />
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
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.15rem] border border-white/40 bg-white/42 px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--interactive-bg)] text-[color:var(--accent-rose)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            {label}
          </div>
          <div className="mt-1 text-sm font-semibold leading-6 text-[color:var(--text-strong)]">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-white/40 bg-white/42 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[color:var(--text-strong)]">{value}</div>
    </div>
  );
}

function TrackTree({ node, depth }: { node: TrackNode; depth: number }) {
  const Icon = trackTypeIcon(node.type);

  return (
    <div className="space-y-2">
      <div
        className="rounded-[1.35rem] border border-white/40 bg-white/42 px-4 py-3 text-sm text-[color:var(--text-strong)]"
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--interactive-bg)] text-[color:var(--accent-rose)]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{node.title}</div>
            <div className="mt-1 text-xs text-[color:var(--text-muted)]">{node.type}</div>
          </div>
        </div>
      </div>
      {node.children?.map((child, index) => (
        <TrackTree key={`${child.title}-${index}`} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function trackTypeIcon(type: string): LucideIcon {
  const value = type.toLowerCase();
  if (value.includes("audio") || value.includes("track")) {
    return Music4;
  }
  if (value.includes("folder") || value.includes("album")) {
    return Tags;
  }
  return AudioLines;
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
