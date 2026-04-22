import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowCircleRight,
  Books,
  DownloadSimple,
  MagnifyingGlass,
  MusicNotesSimple,
  Sparkle,
  Waveform,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PageHeader,
  ProgressTrack,
  StatCard,
  fadeUpItem,
  staggerContainer,
} from "@/components/ui/sweet";
import { apiClient } from "@/lib/api";

export function Dashboard() {
  const reportQuery = useQuery({
    queryKey: ["dashboard", "report"],
    queryFn: () => apiClient.getReport(),
  });
  const tasksQuery = useQuery({
    queryKey: ["dashboard", "tasks"],
    queryFn: () => apiClient.getTasks(),
  });
  const libraryQuery = useQuery({
    queryKey: ["dashboard", "library"],
    queryFn: () => apiClient.getLibraryWorks({ page: 1, pageSize: 6 }),
  });

  return (
    <motion.section
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="Dashboard"
          title="今日耳边小舞台"
          description="把下载器从冷静控制台改成更有情绪价值的个人面板。这里集中展示作品发现、任务节奏、同步推进和媒体库存量。"
          meta={
            <div className="rounded-[1.75rem] border border-white/40 bg-white/45 p-4 shadow-[0_16px_34px_rgba(255,182,193,0.12)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-strong)]">
                <Sparkle className="h-4 w-4 text-[color:var(--accent-rose)]" weight="fill" />
                声波情绪条
              </div>
              <div className="visualizer mt-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <span
                    key={index}
                    className="visualizer-dot"
                    style={{ width: `${0.72 + index * 0.03}rem` }}
                  />
                ))}
              </div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 lg:grid-cols-3">
        <StatCard
          label="已索引元数据"
          value={reportQuery.data?.totals.metadata ?? 0}
          hint="远端作品池已经进入舞台的条目数"
          icon={<Sparkle className="h-6 w-6" weight="duotone" />}
          accentClassName="from-amber-300 to-rose-300"
        />
        <StatCard
          label="任务总数"
          value={tasksQuery.data?.total ?? 0}
          hint="包含下载、同步和失败重试"
          icon={<DownloadSimple className="h-6 w-6" weight="duotone" />}
          accentClassName="from-sky-300 to-violet-300"
        />
        <StatCard
          label="媒体库作品"
          value={libraryQuery.data?.total ?? 0}
          hint="已经落地到本地的作品收藏"
          icon={<Books className="h-6 w-6" weight="duotone" />}
          accentClassName="from-emerald-300 to-cyan-300"
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 lg:grid-cols-3">
        <QuickLink
          to="/discover"
          title="封面墙搜索"
          description="进入带筛选胶囊和抽卡卡面的发现页。"
          icon={<MagnifyingGlass className="h-5 w-5" weight="duotone" />}
          accentClassName="from-rose-300 to-orange-300"
        />
        <QuickLink
          to="/queue"
          title="后勤任务面板"
          description="把正在跑的下载、失败和排队状态看得更直观。"
          icon={<Waveform className="h-5 w-5" weight="duotone" />}
          accentClassName="from-sky-300 to-violet-300"
        />
        <QuickLink
          to="/library"
          title="本地作品卡册"
          description="浏览已下载作品，并在播放器里接着听。"
          icon={<MusicNotesSimple className="h-5 w-5" weight="duotone" />}
          accentClassName="from-emerald-300 to-cyan-300"
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <Card foil className="min-h-[26rem]">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">最近任务</CardTitle>
              <p className="mt-2 text-sm text-[color:var(--text-body)]">
                后勤台正在推进的动作会优先显示在这里。
              </p>
            </div>
            <Badge variant="blue">实时刷新</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {(tasksQuery.data?.items ?? []).slice(0, 5).map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index }}
                className="beam-border rounded-[1.65rem] border border-white/40 bg-white/48 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-[color:var(--text-strong)]">
                      {task.name}
                    </div>
                    <div className="text-xs text-[color:var(--text-muted)]">
                      {translateTaskType(task.type)}
                    </div>
                  </div>
                  <Badge variant={statusBadgeVariant(task.status)}>
                    {translateTaskStatus(task.status)}
                  </Badge>
                </div>
                <div className="mt-4">
                  <ProgressTrack
                    label="执行进度"
                    value={task.progress ?? 0}
                    mascot={task.status === "SUCCESS" ? "✨" : task.status === "FAILED" ? "💥" : "🏃"}
                    hint={task.message || "任务正在等待更多日志。"}
                  />
                </div>
              </motion.div>
            ))}
            {(tasksQuery.data?.items?.length ?? 0) === 0 && (
              <div className="sweet-empty-state min-h-[18rem]">
                <div className="sweet-empty-bubble">🪄</div>
                <div className="sweet-title text-2xl font-bold text-[color:var(--text-strong)]">
                  当前还没有活跃任务
                </div>
                <p className="max-w-md text-sm leading-7 text-[color:var(--text-body)]">
                  这里空空的，去发现页挑几部想听的作品，后勤小队就会开始忙起来。
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">同步赛道</CardTitle>
                <p className="mt-2 text-sm text-[color:var(--text-body)]">
                  用更像游戏进度条的方式看同步推进。
                </p>
              </div>
              <span className="text-3xl">🐈</span>
            </CardHeader>
            <CardContent className="space-y-5">
              <ProgressTrack
                label="总体进度"
                value={reportQuery.data?.progress.overall ?? 0}
                mascot="🐾"
                hint="全量元数据与下载落地进度"
              />
              <ProgressTrack
                label="字幕作品进度"
                value={reportQuery.data?.progress.with_subtitle ?? 0}
                mascot="🎧"
                hint="适合优先推进有字幕的作品集"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryCard
                  label="已完成下载"
                  value={reportQuery.data?.downloads.completed ?? 0}
                  accentClassName="from-emerald-300 to-cyan-300"
                />
                <SummaryCard
                  label="失败待处理"
                  value={reportQuery.data?.downloads.failed ?? 0}
                  accentClassName="from-rose-300 to-pink-300"
                />
              </div>
            </CardContent>
          </Card>

          <Card foil className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[color:var(--text-body)]">
                    收藏偏好
                  </div>
                  <div className="sweet-title mt-2 text-2xl font-bold text-[color:var(--text-strong)]">
                    今日适合补货
                  </div>
                </div>
                <Badge variant="pink">推送建议</Badge>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge variant="pink">耳语系</Badge>
                <Badge variant="mint">助眠</Badge>
                <Badge variant="violet">双耳道</Badge>
                <Badge variant="blue">高评分</Badge>
              </div>
              <p className="mt-4 text-sm leading-7 text-[color:var(--text-body)]">
                如果你打算继续扩充库存，先去发现页跑一轮高评分标签，再把同步页的失败队列清掉，整体节奏会更顺。
              </p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </motion.section>
  );
}

function QuickLink({
  to,
  title,
  description,
  icon,
  accentClassName,
}: {
  to: "/" | "/discover" | "/queue" | "/library" | "/sync" | "/settings";
  title: string;
  description: string;
  icon: ReactNode;
  accentClassName: string;
}) {
  return (
    <Link to={to}>
      <Card interactive foil className="h-full">
        <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_14px_26px_rgba(255,182,193,0.22)] ${accentClassName}`}
            >
              {icon}
            </span>
            <ArrowCircleRight className="h-5 w-5 text-[color:var(--text-muted)]" weight="bold" />
          </div>
          <div className="space-y-2">
            <div className="sweet-title text-xl font-bold text-[color:var(--text-strong)]">
              {title}
            </div>
            <div className="text-sm leading-7 text-[color:var(--text-body)]">{description}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SummaryCard({
  label,
  value,
  accentClassName,
}: {
  label: string;
  value: number;
  accentClassName: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/40 bg-white/48 p-4 shadow-[0_12px_24px_rgba(255,182,193,0.1)]">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${accentClassName}`}
        >
          <Sparkle className="h-4 w-4 text-white" weight="fill" />
        </span>
        <div className="text-sm font-semibold text-[color:var(--text-body)]">{label}</div>
      </div>
      <div className="sweet-title mt-4 text-3xl font-extrabold text-[color:var(--text-strong)]">
        {value}
      </div>
    </div>
  );
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "SUCCESS":
      return "mint" as const;
    case "FAILED":
      return "danger" as const;
    case "RUNNING":
      return "blue" as const;
    case "QUEUED":
      return "violet" as const;
    default:
      return "default" as const;
  }
}

function translateTaskType(type: string) {
  switch (type) {
    case "download":
      return "下载";
    case "sync":
      return "元数据同步";
    case "sync-download":
      return "同步下载";
    case "sync-retry":
      return "同步重试";
    default:
      return type;
  }
}

function translateTaskStatus(status: string) {
  switch (status) {
    case "QUEUED":
      return "排队中";
    case "RUNNING":
      return "运行中";
    case "SUCCESS":
      return "成功";
    case "FAILED":
      return "失败";
    case "CANCELED":
      return "已取消";
    case "TERMINATED":
      return "已终止";
    default:
      return status;
  }
}
