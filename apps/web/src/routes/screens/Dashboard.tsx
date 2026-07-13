import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, ProgressTrack } from "@/components/ui/sweet";
import { apiClient, type Task } from "@/lib/api";

export function Dashboard() {
  const reportQuery = useQuery({
    queryKey: ["dashboard", "report"],
    queryFn: () => apiClient.getReport(),
  });
  const tasksQuery = useQuery({
    queryKey: ["dashboard", "tasks", "active"],
    queryFn: () => apiClient.getTasks({
      status: ["QUEUED", "RUNNING"],
      pageSize: 50,
    }),
  });
  const taskSummaryQuery = useQuery({
    queryKey: ["task-summary", "dashboard"],
    queryFn: () => apiClient.getTaskSummary(),
  });
  const libraryQuery = useQuery({
    queryKey: ["dashboard", "library"],
    queryFn: () => apiClient.getLibraryWorks({ page: 1, pageSize: 6 }),
  });

  const activeTasks = tasksQuery.data?.items ?? [];
  const runningTasks = taskSummaryQuery.data?.running ?? 0;
  const reportState = reportQuery.isError
    ? "error"
    : reportQuery.isLoading
      ? "loading"
      : "ready";

  return (
    <section className="space-y-4">
      <PageHeader
        kicker="控制台概览"
        title="控制台"
        description="任务、同步进度和最近入库内容。"
        meta={
          <Link
            to="/queue"
            className="deck-button-secondary inline-flex h-9 items-center gap-2 border px-3 text-xs font-bold"
          >
            查看全部任务
            <ArrowRight className="h-4 w-4" weight="bold" />
          </Link>
        }
      />

      <div className="deck-chassis grid grid-cols-2 overflow-hidden lg:grid-cols-4">
        <Metric label="运行中" value={runningTasks} />
        <Metric label="任务总数" value={taskSummaryQuery.data?.total ?? 0} />
        <Metric label="本地作品" value={libraryQuery.data?.total ?? 0} />
        <Metric label="待下载" value={reportQuery.data?.downloads.pending ?? 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[color:var(--chassis-edge)] pb-3">
            <div>
              <CardTitle className="text-base">活动任务</CardTitle>
              <p className="mt-1 text-xs text-[color:var(--text-mute)]">正在运行或排队的任务</p>
            </div>
            <Badge variant={activeTasks.length > 0 ? "live" : "mute"}>
              {activeTasks.length} 个活动任务
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto" role="region" aria-label="活动任务表，可横向滚动" tabIndex={0}>
              <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
                <caption className="sr-only">正在运行或排队的任务</caption>
                <thead className="bg-[color:var(--screen-void)] text-xs text-[color:var(--text-mute)]">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">任务</th>
                    <th className="px-3 py-2.5 font-medium">类型</th>
                    <th className="px-3 py-2.5 font-medium">状态</th>
                    <th className="px-3 py-2.5 font-medium">进度</th>
                    <th className="px-4 py-2.5 text-right font-medium">更新时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--chassis-edge)]">
                  {activeTasks.slice(0, 8).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </tbody>
              </table>
            </div>
            {activeTasks.length === 0 ? (
              <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                <Clock className="h-5 w-5 text-[color:var(--text-mute)]" weight="duotone" />
                <p className="text-sm font-semibold text-[color:var(--text-display)]">暂无活动任务</p>
                <p className="text-xs text-[color:var(--text-mute)]">
                  {tasksQuery.isError ? "任务接口暂不可用" : "新建下载或同步任务后会显示在这里"}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[color:var(--chassis-edge)] pb-3">
            <CardTitle className="text-base">同步状态</CardTitle>
            <Badge variant={reportState === "error" ? "halt" : reportState === "loading" ? "warn" : "signal"}>
              {reportState === "error" ? "报告不可用" : reportState === "loading" ? "读取中" : "已连接"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <ProgressTrack
              label="总体进度"
              value={reportQuery.data?.progress.overall ?? 0}
              running={runningTasks > 0}
              hint={`${reportQuery.data?.downloads.completed ?? 0} 已完成 / ${reportQuery.data?.downloads.pending ?? 0} 待下载`}
            />
            <ProgressTrack
              label="字幕作品"
              value={reportQuery.data?.progress.with_subtitle ?? 0}
              running={runningTasks > 0}
              hint={`${reportQuery.data?.totals.subtitle ?? 0} 条字幕作品元数据`}
            />
            <div className="flex items-center justify-between border-t border-[color:var(--chassis-edge)] pt-3 text-sm">
              <span className="flex items-center gap-2 text-[color:var(--text-body)]">
                <WarningCircle className="h-4 w-4" weight="duotone" />
                失败记录
              </span>
              <span className="console-mono font-semibold text-[color:var(--text-display)]">
                {reportQuery.data?.downloads.failed ?? 0}
              </span>
            </div>
            <Link
              to="/sync"
              className="deck-button-secondary inline-flex h-9 w-full items-center justify-center gap-2 border px-3 text-xs font-bold"
            >
              打开同步中心
              <ArrowRight className="h-4 w-4" weight="bold" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[color:var(--chassis-edge)] pb-3">
          <div>
            <CardTitle className="text-base">最近入库</CardTitle>
            <p className="mt-1 text-xs text-[color:var(--text-mute)]">最近扫描到的本地作品</p>
          </div>
          <Link
            to="/library"
            search={{ q: "", id: "", page: 1 }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--accent)]"
          >
            媒体库
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[color:var(--chassis-edge)]">
            {(libraryQuery.data?.items ?? []).map((work) => (
              <div key={work.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[color:var(--text-display)]">{work.title}</div>
                  <div className="console-mono mt-0.5 text-xs text-[color:var(--text-mute)]">{work.media_id}</div>
                </div>
                <span className="text-xs text-[color:var(--text-mute)]">{work.audio_file_count} 音频</span>
                <Badge variant={work.has_subtitles ? "signal" : "mute"}>
                  {work.has_subtitles ? `${work.subtitle_count} 字幕` : "无字幕"}
                </Badge>
                <span className="text-xs text-[color:var(--text-mute)]">{work.release_date || "日期未知"}</span>
              </div>
            ))}
          </div>
          {(libraryQuery.data?.items.length ?? 0) === 0 ? (
            <div className="flex min-h-28 items-center justify-center px-4 py-6 text-sm text-[color:var(--text-mute)]">
              {libraryQuery.isError ? "媒体库暂不可用" : "本地媒体库暂无作品"}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-h-20 border-b border-r border-[color:var(--chassis-edge)] px-4 py-3 lg:border-b-0">
      <div className="text-xs text-[color:var(--text-mute)]">{label}</div>
      <div className="console-readout mt-1 text-2xl">{value.toLocaleString()}</div>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const percent = Math.round((task.progress ?? 0) * 100);
  return (
    <tr className="text-[color:var(--text-body)]">
      <td className="max-w-[18rem] px-4 py-3">
        <div className="truncate font-semibold text-[color:var(--text-display)]">{task.name}</div>
        <div className="console-mono mt-0.5 text-xs text-[color:var(--text-mute)]">#{task.id}</div>
      </td>
      <td className="px-3 py-3 text-xs">{translateTaskType(task.type)}</td>
      <td className="px-3 py-3">
        <Badge variant={task.status === "RUNNING" ? "live" : "warn"}>
          {task.status === "RUNNING" ? "运行中" : "排队中"}
        </Badge>
      </td>
      <td className="w-32 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden bg-[color:var(--screen-void)]">
            <div className="h-full bg-[color:var(--phosphor-primary)]" style={{ width: `${percent}%` }} />
          </div>
          <span className="console-mono w-9 text-right text-xs">{percent}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right text-xs text-[color:var(--text-mute)]">
        {formatTaskTime(task.updated_at || task.created_at)}
      </td>
    </tr>
  );
}

function translateTaskType(type: string) {
  switch (type) {
    case "download":
      return "下载";
    case "sync":
      return "刷新清单";
    case "sync-download":
      return "批量下载";
    case "sync-retry":
      return "同步重试";
    default:
      return type;
  }
}

function formatTaskTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
