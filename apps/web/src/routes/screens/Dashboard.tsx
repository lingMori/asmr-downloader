import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Archive,
  ArrowCircleRight,
  Database,
  DownloadSimple,
  Gauge,
  HardDrives,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  PageHeader,
  ProgressTrack,
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

  const tasks = tasksQuery.data?.items ?? [];
  const runningTasks = tasks.filter((task) => task.status === "RUNNING").length;
  const totalIndex = reportQuery.data?.totals.metadata ?? 0;

  return (
    <motion.section
      className="space-y-5"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="Dashboard"
          title="总控状态屏"
          description="集中监控远端索引、任务队列、同步进度与本地媒体档案。这个界面应该像一台仍在通电的助眠节目控制台。"
          meta={
            <div className="deck-screen min-w-[15rem] p-4">
              <div className="deck-decal">SIGNAL METER</div>
              <div className="visualizer mt-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <span
                    key={index}
                    className="visualizer-dot"
                    style={{
                      width: `${0.64 + index * 0.04}rem`,
                      height: `${0.7 + Math.min(1, runningTasks / 4) * (index + 1) * 0.28}rem`,
                    }}
                  />
                ))}
              </div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-[1.6fr_0.62fr_0.44fr]">
        <Card surface="screen" foil className="min-h-[28rem]">
          <CardContent className="flex min-h-[28rem] flex-col gap-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="deck-decal">TOTAL INDEX</div>
                <div className="console-readout mt-4 text-5xl md:text-7xl">
                  {totalIndex.toLocaleString()}
                </div>
              </div>
              <Badge variant="signal">PHOSPHOR ONLINE</Badge>
            </div>
            <div className="mt-auto border-t border-[color:var(--phosphor-mid)] pt-4">
              <div className="console-mono mb-3 text-[10px] uppercase tracking-[0.2em] text-[color:var(--telltale-amber)]">
                Live Task Feed
              </div>
              <div className="space-y-2">
                {tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className="console-mono flex gap-3 text-xs text-[color:var(--text-body)]">
                    <span className="text-[color:var(--phosphor-primary)]">&gt;</span>
                    <span>{formatTaskTime(task.updated_at || task.created_at)}</span>
                    <span>task#{task.id}</span>
                    <span className={task.status === "RUNNING" ? "text-[color:var(--tape-pink)]" : ""}>
                      {task.status}
                    </span>
                  </div>
                ))}
                {tasks.length === 0 ? (
                  <div className="console-mono text-xs text-[color:var(--text-mute)]">
                    &gt; no active packet on this channel
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[28rem]">
          <CardHeader>
            <CardTitle>Signal Rail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Meter label="RUNNING" value={runningTasks} max={6} variant="live" />
            <Meter label="LIBRARY" value={libraryQuery.data?.total ?? 0} max={Math.max(1, libraryQuery.data?.total ?? 1)} variant="signal" />
            <Meter label="FAILED" value={reportQuery.data?.downloads.failed ?? 0} max={Math.max(1, reportQuery.data?.downloads.failed ?? 1)} variant="halt" />
          </CardContent>
        </Card>

        <Card surface="screen" className="min-h-[28rem]">
          <CardHeader>
            <CardTitle>Task Rail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RailReadout label="TASKS" value={tasksQuery.data?.total ?? 0} />
            <RailReadout label="ARCH" value={libraryQuery.data?.total ?? 0} />
            <RailReadout label="PEND" value={reportQuery.data?.downloads.pending ?? 0} />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 lg:grid-cols-3">
        <QuickLink
          to="/discover"
          title="发现雷达"
          description="检索远端索引，筛选标签、声优、社团并投递下载任务。"
          icon={<Gauge className="h-5 w-5" weight="duotone" />}
        />
        <QuickLink
          to="/queue"
          title="任务调度台"
          description="查看运行、失败、排队任务，并执行取消、重试和清理。"
          icon={<SlidersHorizontal className="h-5 w-5" weight="duotone" />}
        />
        <QuickLink
          to="/library"
          title="媒体档案"
          description="浏览本地落盘作品，在监听台播放音频并匹配字幕轨。"
          icon={<Archive className="h-5 w-5" weight="duotone" />}
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card foil>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>同步赛道</CardTitle>
              <p className="mt-2 text-sm text-[color:var(--text-body)]">磁带式进度会在运行任务存在时进入传输态。</p>
            </div>
            <Badge variant="signal">SYNC BUS</Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <ProgressTrack
              label="总体进度"
              value={reportQuery.data?.progress.overall ?? 0}
              running={runningTasks > 0}
              hint="全量元数据与下载落地进度"
            />
            <ProgressTrack
              label="字幕作品进度"
              value={reportQuery.data?.progress.with_subtitle ?? 0}
              running={runningTasks > 0}
              hint="适合优先推进有字幕的作品集"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="deck-decal">OPS HINT</div>
                <div className="console-title mt-3 text-2xl font-black text-[color:var(--text-display)]">
                  推荐操作序列
                </div>
              </div>
              <HardDrives className="h-8 w-8 text-[color:var(--telltale-amber)]" weight="duotone" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="halt">失败清理</Badge>
              <Badge variant="signal">高评分检索</Badge>
              <Badge variant="live">字幕优先</Badge>
              <Badge variant="warn">增量同步</Badge>
            </div>
            <p className="mt-4 text-sm leading-7 text-[color:var(--text-body)]">
              建议先清理失败任务，再通过发现雷达筛选高评分或有字幕作品，最后进入同步舱执行批量落盘。
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.section>
  );
}

function QuickLink({
  to,
  title,
  description,
  icon,
}: {
  to: "/" | "/discover" | "/queue" | "/library" | "/sync" | "/settings";
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link to={to}>
      <Card interactive foil className="h-full">
        <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <span className="deck-screen flex h-12 w-12 items-center justify-center text-[color:var(--phosphor-primary)]">
              {icon}
            </span>
            <ArrowCircleRight className="h-5 w-5 text-[color:var(--text-mute)]" weight="duotone" />
          </div>
          <div className="space-y-2">
            <div className="console-title text-xl font-black text-[color:var(--text-display)]">
              {title}
            </div>
            <div className="text-sm leading-7 text-[color:var(--text-body)]">{description}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Meter({
  label,
  value,
  max,
  variant,
}: {
  label: string;
  value: number;
  max: number;
  variant: "live" | "signal" | "halt";
}) {
  const percent = Math.max(4, Math.min(100, (value / max) * 100));
  return (
    <div className="deck-screen p-3">
      <div className="flex items-center justify-between gap-3">
        <Badge variant={variant}>{label}</Badge>
        <span className="console-readout text-sm">{value}</span>
      </div>
      <div className="mt-4 h-2 border border-[color:var(--phosphor-mid)] bg-[color:var(--screen-void)]">
        <div className="h-full bg-[color:var(--phosphor-primary)] shadow-[var(--glow-phosphor)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function RailReadout({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[color:var(--phosphor-mid)] pb-3">
      <div className="console-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-mute)]">{label}</div>
      <div className="console-readout mt-2 text-3xl">{value}</div>
    </div>
  );
}

function formatTaskTime(value?: string) {
  if (!value) {
    return "--:--:--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}
