import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Archive,
  ArrowCircleRight,
  Gauge,
  HardDrives,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
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
  const taskSummaryQuery = useQuery({
    queryKey: ["task-summary", "dashboard"],
    queryFn: () => apiClient.getTaskSummary(),
  });
  const libraryQuery = useQuery({
    queryKey: ["dashboard", "library"],
    queryFn: () => apiClient.getLibraryWorks({ page: 1, pageSize: 6 }),
  });

  const tasks = tasksQuery.data?.items ?? [];
  const runningTasks = taskSummaryQuery.data?.running ?? 0;
  const totalIndex = reportQuery.data?.totals.metadata ?? 0;
  const reportState = reportQuery.isError
    ? "error"
    : reportQuery.isLoading
      ? "loading"
      : "ready";

  return (
    <motion.section
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="DASHBOARD"
          title="ASMRoner 控制台"
          description="本地任务、同步队列、媒体库和播放器状态集中显示。"
          meta={
            <div className="deck-screen min-w-[13rem] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="deck-decal">LIVE BUS</div>
                <div className="console-readout text-lg">{runningTasks}</div>
              </div>
              <div className="visualizer mt-2 h-8" aria-hidden="true">
                {[0.32, 0.72, 0.48, 0.9, 0.56, 0.78].map((height, index) => (
                  <span
                    key={index}
                    className="visualizer-dot"
                    style={{ height: `${height * 100}%` }}
                  />
                ))}
              </div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-3 xl:grid-cols-[1.35fr_0.8fr_0.65fr]">
        <Card surface="screen" foil className="min-h-[16rem] md:min-h-[18rem]">
          <CardContent className="flex min-h-[16rem] flex-col gap-4 p-4 md:min-h-[18rem]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="deck-decal">ARCHIVE INDEX</div>
                <div className="console-readout mt-3 text-5xl leading-none md:text-6xl">
                  {reportState === "error" ? "--" : totalIndex.toLocaleString()}
                </div>
              </div>
              <Badge variant={reportState === "error" ? "halt" : reportState === "loading" ? "warn" : "signal"}>
                {reportState === "error" ? "清单不可用" : reportState === "loading" ? "读取中" : "清单可用"}
              </Badge>
            </div>
            <div className="mt-auto border-t border-[color:var(--phosphor-mid)] pt-4">
              <div className="console-mono mb-3 text-[10px] uppercase tracking-[0.2em] text-[color:var(--telltale-amber)]">
                RECENT TASK BUS
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
                    &gt; {tasksQuery.isError ? "任务接口暂不可用" : "暂无任务动态"}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[16rem] md:min-h-[18rem]">
          <CardHeader>
            <CardTitle>运行状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Meter label="运行中" value={runningTasks} max={6} variant="live" />
            <Meter label="本地作品" value={libraryQuery.data?.total ?? 0} max={Math.max(1, libraryQuery.data?.total ?? 1)} variant="signal" />
            <Meter label="失败任务" value={taskSummaryQuery.data?.failed ?? 0} max={Math.max(1, taskSummaryQuery.data?.failed ?? 1)} variant="halt" />
          </CardContent>
        </Card>

        <Card surface="screen" className="min-h-[16rem] md:min-h-[18rem]">
          <CardHeader>
            <CardTitle>数量概览</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RailReadout label="任务" value={taskSummaryQuery.data?.total ?? 0} />
            <RailReadout label="本地库" value={libraryQuery.data?.total ?? 0} />
            <RailReadout label="待下载" value={reportQuery.data?.downloads.pending ?? 0} />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-3 lg:grid-cols-3">
        <QuickLink
          to="/discover"
          title="搜索作品"
          description="搜索远端作品，按标签、声优、社团筛选，并加入下载任务。"
          icon={<Gauge className="h-5 w-5" weight="duotone" />}
        />
        <QuickLink
          to="/queue"
          title="下载任务"
          description="查看下载和同步进度，处理失败、取消、重试和清理。"
          icon={<SlidersHorizontal className="h-5 w-5" weight="duotone" />}
        />
        <QuickLink
          to="/library"
          title="本地媒体库"
          description="浏览已下载作品，播放音频，并查看匹配到的字幕文件。"
          icon={<Archive className="h-5 w-5" weight="duotone" />}
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <Card foil>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>同步与下载进度</CardTitle>
              <p className="mt-2 text-sm text-[color:var(--text-body)]">显示作品清单、本地下载和字幕作品的整体推进情况。</p>
            </div>
            <Badge variant="signal">同步进度</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressTrack
              label="总体进度"
              value={reportQuery.data?.progress.overall ?? 0}
              running={runningTasks > 0}
              hint="作品清单与下载落地进度"
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
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="deck-decal">下一步建议</div>
                <div className="console-title mt-2 text-2xl font-black leading-none text-[color:var(--text-display)]">
                  推荐操作序列
                </div>
              </div>
              <span className="deck-screen flex h-10 w-10 shrink-0 items-center justify-center text-[color:var(--phosphor-primary)]">
                <HardDrives className="h-5 w-5" weight="duotone" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="halt">失败清理</Badge>
              <Badge variant="signal">高评分检索</Badge>
              <Badge variant="live">字幕优先</Badge>
              <Badge variant="warn">增量同步</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-body)]">
              建议先处理失败任务，再通过搜索作品筛选高评分或有字幕内容，最后进入同步与批量下载执行入库。
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
        <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="deck-screen flex h-9 w-9 items-center justify-center text-[color:var(--phosphor-primary)]">
              {icon}
            </span>
            <ArrowCircleRight className="h-5 w-5 text-[color:var(--text-mute)]" weight="duotone" />
          </div>
          <div className="space-y-2">
            <div className="console-title text-xl font-black leading-none text-[color:var(--text-display)]">
              {title}
            </div>
            <div className="text-sm leading-5 text-[color:var(--text-body)]">{description}</div>
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
    <div className="deck-screen p-2.5">
      <div className="flex items-center justify-between gap-3">
        <Badge variant={variant}>{label}</Badge>
        <span className="console-readout text-sm">{value}</span>
      </div>
      <div className="mt-3 h-1.5 border border-[color:var(--phosphor-mid)] bg-[color:var(--screen-void)]">
        <div className="h-full bg-[color:var(--phosphor-primary)] shadow-[var(--glow-phosphor)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function RailReadout({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[color:var(--phosphor-mid)] pb-2.5">
      <div className="text-xs text-[color:var(--text-mute)]">{label}</div>
      <div className="console-readout mt-1.5 text-2xl">{value}</div>
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
