import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Archive,
  ArrowRightCircle,
  Database,
  DownloadCloud,
  Gauge,
  Radar,
  RadioTower,
  SlidersHorizontal,
} from "lucide-react";
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
          title="总控状态屏"
          description="集中监控远端索引、任务队列、同步进度与本地媒体档案。所有模块保持在线读数，适合长时间停留和快速调度。"
          meta={
            <div className="rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-4 shadow-[var(--shadow-glass)]">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-strong)]">
                <RadioTower className="h-4 w-4 text-[color:var(--accent-green)]" />
                SIGNAL METER
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
          hint="远端作品池已进入本地索引的条目数"
          icon={<Database className="h-5 w-5" />}
          accentClassName="from-emerald-400 to-amber-400"
        />
        <StatCard
          label="任务总数"
          value={tasksQuery.data?.total ?? 0}
          hint="包含下载、同步和失败重试"
          icon={<DownloadCloud className="h-5 w-5" />}
          accentClassName="from-blue-400 to-emerald-400"
        />
        <StatCard
          label="媒体库作品"
          value={libraryQuery.data?.total ?? 0}
          hint="已经落地到本地的作品收藏"
          icon={<Archive className="h-5 w-5" />}
          accentClassName="from-amber-400 to-red-400"
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 lg:grid-cols-3">
        <QuickLink
          to="/discover"
          title="发现雷达"
          description="检索远端索引，筛选标签、声优、社团并投递下载任务。"
          icon={<Radar className="h-5 w-5" />}
          accentClassName="from-emerald-400 to-amber-400"
        />
        <QuickLink
          to="/queue"
          title="任务调度台"
          description="查看运行、失败、排队任务，并执行取消、重试和清理。"
          icon={<SlidersHorizontal className="h-5 w-5" />}
          accentClassName="from-blue-400 to-emerald-400"
        />
        <QuickLink
          to="/library"
          title="媒体档案"
          description="浏览本地落盘作品，在监听台播放音频并匹配字幕轨。"
          icon={<Archive className="h-5 w-5" />}
          accentClassName="from-amber-400 to-red-400"
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <Card foil className="min-h-[26rem]">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">最近任务</CardTitle>
              <p className="mt-2 text-sm text-[color:var(--text-body)]">
                调度台正在推进的动作会优先显示在这里。
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
                className="beam-border rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-4"
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
                    mascot="MARK"
                    hint={task.message || "任务正在等待更多日志。"}
                  />
                </div>
              </motion.div>
            ))}
            {(tasksQuery.data?.items?.length ?? 0) === 0 && (
              <div className="sweet-empty-state min-h-[18rem]">
                <div className="sweet-empty-bubble">EMPTY</div>
                <div className="console-title text-2xl font-bold text-[color:var(--text-strong)]">
                  当前还没有活跃任务
                </div>
                <p className="max-w-md text-sm leading-7 text-[color:var(--text-body)]">
                  当前没有可显示任务。前往发现雷达或同步舱创建新的下载与同步动作。
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
                  以仪表读数监控同步推进。
                </p>
              </div>
              <Badge variant="mint">SYNC BUS</Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <ProgressTrack
                label="总体进度"
                value={reportQuery.data?.progress.overall ?? 0}
                mascot="MARK"
                hint="全量元数据与下载落地进度"
              />
              <ProgressTrack
                label="字幕作品进度"
                value={reportQuery.data?.progress.with_subtitle ?? 0}
                mascot="MARK"
                hint="适合优先推进有字幕的作品集"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryCard
                  label="已完成下载"
                  value={reportQuery.data?.downloads.completed ?? 0}
                  accentClassName="from-emerald-400 to-blue-400"
                />
                <SummaryCard
                  label="失败待处理"
                  value={reportQuery.data?.downloads.failed ?? 0}
                  accentClassName="from-red-400 to-amber-400"
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
                  <div className="console-title mt-2 text-2xl font-bold text-[color:var(--text-strong)]">
                    推荐操作序列
                  </div>
                </div>
                <Badge variant="pink">OPS HINT</Badge>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge variant="pink">失败清理</Badge>
                <Badge variant="mint">高评分检索</Badge>
                <Badge variant="violet">字幕优先</Badge>
                <Badge variant="blue">增量同步</Badge>
              </div>
              <p className="mt-4 text-sm leading-7 text-[color:var(--text-body)]">
                建议先清理失败任务，再通过发现雷达筛选高评分或有字幕作品，最后进入同步舱执行批量落盘。
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
              className={`flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-[var(--shadow-glow)] ${accentClassName}`}
            >
              {icon}
            </span>
            <ArrowRightCircle className="h-5 w-5 text-[color:var(--text-muted)]" />
          </div>
          <div className="space-y-2">
            <div className="console-title text-xl font-bold text-[color:var(--text-strong)]">
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
    <div className="rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-4 shadow-[var(--shadow-glass)]">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br ${accentClassName}`}
        >
          <Gauge className="h-4 w-4 text-[#06100b]" />
        </span>
        <div className="text-sm font-semibold text-[color:var(--text-body)]">{label}</div>
      </div>
      <div className="console-title mt-4 text-3xl font-extrabold text-[color:var(--text-strong)]">
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
