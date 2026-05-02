import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Clock3, DownloadCloud, RefreshCcw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  EmptyState,
  PageHeader,
  ProgressTrack,
  StatCard,
  fadeUpItem,
  staggerContainer,
} from "@/components/ui/sweet";
import { apiClient, type Task } from "@/lib/api";
import { useTaskEvents } from "@/lib/useTaskEvents";

const retryableTaskTypes = new Set([
  "download",
  "sync",
  "sync-download",
  "sync-retry",
]);

export function Queue() {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    type: "",
    page: 1,
    pageSize: 20,
  });
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => apiClient.getTasks(filters),
    refetchInterval: 15000,
  });
  const taskDetailQuery = useQuery({
    queryKey: ["task", selectedTaskId],
    queryFn: () => apiClient.getTask(selectedTaskId as number),
    enabled: typeof selectedTaskId === "number" && Number.isFinite(selectedTaskId),
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => apiClient.retryTask(id),
    onSuccess: (res) => {
      toast.success(`已创建重试任务 #${res.task_id}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteTask(id),
    onSuccess: () => {
      toast.success("任务已删除");
      if (selectedTaskId !== null) {
        setSelectedTaskId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const deleteWithFilesMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteTask(id, { withFiles: true }),
    onSuccess: (res) => {
      const removed = res.filesDeleted ?? 0;
      toast.success(
        removed > 0
          ? `已清理 ${removed} 个下载目录并移除记录`
          : "已移除记录，未找到可清理的下载目录",
      );
      if (selectedTaskId !== null) {
        setSelectedTaskId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => apiClient.cancelTask(id),
    onSuccess: () => {
      toast.success("已发送取消请求");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (selectedTaskId !== null) {
        queryClient.invalidateQueries({ queryKey: ["task", selectedTaskId] });
      }
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  useTaskEvents(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    if (selectedTaskId !== null) {
      queryClient.invalidateQueries({ queryKey: ["task", selectedTaskId] });
    }
  });

  const summary = useMemo(() => {
    const items = tasksQuery.data?.items ?? [];
    return {
      running: items.filter((item) => item.status === "RUNNING").length,
      failed: items.filter((item) => item.status === "FAILED").length,
      total: tasksQuery.data?.total ?? 0,
    };
  }, [tasksQuery.data]);

  const selectedTask = taskDetailQuery.data;
  const totalPages = Math.max(1, Math.ceil((tasksQuery.data?.total ?? 0) / filters.pageSize));
  const canRetry = Boolean(
    selectedTask &&
      selectedTask.status !== "RUNNING" &&
      selectedTask.status !== "QUEUED" &&
      retryableTaskTypes.has(selectedTask.type),
  );
  const canDelete = Boolean(
    selectedTask &&
      selectedTask.status !== "RUNNING" &&
      selectedTask.status !== "QUEUED",
  );
  const canCancel = Boolean(
    selectedTask &&
      (selectedTask.status === "RUNNING" || selectedTask.status === "QUEUED") &&
      retryableTaskTypes.has(selectedTask.type),
  );
  const canDeleteWithFiles = Boolean(
    selectedTask &&
      canDelete &&
      supportsDeleteWithFiles(selectedTask),
  );

  if (tasksQuery.isLoading) {
    return <div className="text-[color:var(--text-body)]">正在加载任务列表...</div>;
  }

  if (tasksQuery.isError) {
    return <div className="text-[color:var(--accent-red)]">任务列表加载失败。</div>;
  }

  return (
    <motion.section
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="Queue"
          title="任务调度台"
          description="集中查看下载与同步状态流。失败、排队、进行中和可再次处理的任务会以统一状态色和进度读数展示。"
          meta={
            <div className="space-y-3 rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-4 shadow-[var(--shadow-glass)]">
              <Badge variant="blue">自动刷新</Badge>
              <div className="text-sm leading-6 text-[color:var(--text-body)]">
                当前命中 {tasksQuery.data?.total ?? 0} 条任务
              </div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="运行中"
          value={summary.running}
          hint="当前正在推进的任务数量"
          icon={<Clock3 className="h-5 w-5" />}
          accentClassName="from-blue-400 to-emerald-400"
        />
        <StatCard
          label="失败"
          value={summary.failed}
          hint="建议优先检查日志并重试"
          icon={<Activity className="h-5 w-5" />}
          accentClassName="from-red-400 to-amber-400"
        />
        <StatCard
          label="命中任务数"
          value={summary.total}
          hint="筛选条件下可见的全部任务"
          icon={<DownloadCloud className="h-5 w-5" />}
          accentClassName="from-amber-400 to-red-400"
        />
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <Card foil>
          <CardHeader>
            <CardTitle className="text-base">筛选条件</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_140px]">
            <Input
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  search: event.target.value,
                  page: 1,
                }))
              }
              placeholder="按任务名称或消息搜索"
            />
            <Select
              value={filters.type}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  type: event.target.value,
                  page: 1,
                }))
              }
            >
              <option value="">全部类型</option>
              <option value="download">下载</option>
              <option value="sync">元数据同步</option>
              <option value="sync-download">同步下载</option>
              <option value="sync-retry">同步重试</option>
            </Select>
            <Select
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value,
                  page: 1,
                }))
              }
            >
              <option value="">全部状态</option>
              <option value="QUEUED">排队中</option>
              <option value="RUNNING">运行中</option>
              <option value="SUCCESS">成功</option>
              <option value="FAILED">失败</option>
              <option value="CANCELED">已取消</option>
              <option value="TERMINATED">已终止</option>
            </Select>
            <Select
              value={String(filters.pageSize)}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  pageSize: Number(event.target.value) || 20,
                  page: 1,
                }))
              }
            >
              <option value="10">每页 10 条</option>
              <option value="20">每页 20 条</option>
              <option value="50">每页 50 条</option>
            </Select>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">任务列表</CardTitle>
              <p className="mt-2 text-sm text-[color:var(--text-body)]">
                点击任意任务卡查看参数、日志和操作按钮。
              </p>
            </div>
            <Badge variant="violet">
              第 {filters.page} / {totalPages} 页
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {(tasksQuery.data?.items ?? []).map((task) => (
              <button
                key={task.id}
                type="button"
                className={`beam-border block w-full rounded-lg border p-4 text-left transition ${
                  selectedTaskId === task.id
                    ? "border-[color:var(--panel-border-strong)] bg-[color:var(--interactive-bg-strong)]"
                    : "border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] hover:-translate-y-0.5 hover:bg-[color:var(--interactive-bg-strong)]"
                }`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-[color:var(--text-strong)]">
                      {task.name}
                    </div>
                    <div className="text-xs text-[color:var(--text-muted)]">
                      #{task.id} · {translateTaskType(task.type)}
                    </div>
                  </div>
                  <Badge variant={statusBadgeVariant(task.status)}>
                    {translateTaskStatus(task.status)}
                  </Badge>
                </div>
                <div className="mt-4">
                  <ProgressTrack
                    label="进度"
                    value={task.progress ?? 0}
                    mascot="MARK"
                    hint={task.message || "等待更多日志..."}
                  />
                </div>
              </button>
            ))}

            {(tasksQuery.data?.items.length ?? 0) === 0 && (
              <EmptyState
                symbol="EMPTY"
                title="当前筛选下没有任务"
                description="试着放宽搜索条件，或者回到发现页、同步页创建新的下载和同步任务。"
                className="min-h-[24rem]"
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] px-4 py-3">
              <span className="text-sm text-[color:var(--text-body)]">
                第 {filters.page} / {totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filters.page <= 1}
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  上一页
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filters.page >= totalPages}
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card foil className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">任务详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedTaskId && (
              <EmptyState
                symbol="SELECT"
                title="先选一个任务"
                description="选中左侧任意任务后，可以查看请求参数、执行结果、日志，并进行取消、重试或删除。"
                className="min-h-[28rem]"
              />
            )}
            {taskDetailQuery.isLoading && (
              <div className="text-sm text-[color:var(--text-body)]">正在加载任务详情...</div>
            )}
            {selectedTask && (
              <>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => cancelMutation.mutate(selectedTask.id)}
                    disabled={!canCancel || cancelMutation.isPending}
                  >
                    <XCircle className="h-4 w-4" />
                    取消任务
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => retryMutation.mutate(selectedTask.id)}
                    disabled={!canRetry || retryMutation.isPending}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    重试任务
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => deleteMutation.mutate(selectedTask.id)}
                    disabled={!canDelete || deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    删除任务
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => deleteWithFilesMutation.mutate(selectedTask.id)}
                    disabled={!canDeleteWithFiles || deleteWithFilesMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    清理文件并移除记录
                  </Button>
                </div>

                <ProgressTrack
                  label="当前任务进度"
                  value={selectedTask.progress ?? 0}
                  mascot="MARK"
                  hint={selectedTask.message || "任务还没有返回额外消息。"}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <Summary label="状态" value={translateTaskStatus(selectedTask.status)} />
                  <Summary label="来源" value={selectedTask.source || "-"} />
                  <Summary label="类型" value={translateTaskType(selectedTask.type)} />
                  <Summary label="创建时间" value={selectedTask.created_at || "-"} />
                  <Summary label="开始时间" value={selectedTask.started_at || "-"} />
                  <Summary label="完成时间" value={selectedTask.completed_at || "-"} />
                </div>

                <CodeBlock title="请求参数" value={selectedTask.payload || "{}"} />
                <CodeBlock title="执行结果" value={selectedTask.result || "{}"} />

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[color:var(--text-body)]">日志</div>
                  <div className="space-y-2">
                    {(selectedTask.logs ?? []).length === 0 && (
                      <div className="rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-3 text-sm text-[color:var(--text-muted)]">
                        暂无日志输出。
                      </div>
                    )}
                    {(selectedTask.logs ?? []).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-3 text-sm text-[color:var(--text-strong)]"
                      >
                        <div>{log.message}</div>
                        {log.created_at ? (
                          <div className="mt-2 text-xs text-[color:var(--text-muted)]">
                            {log.created_at}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[color:var(--text-strong)]">{value}</div>
    </div>
  );
}

function CodeBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-[color:var(--text-body)]">{title}</div>
      <pre className="overflow-auto rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-4 text-xs text-[color:var(--text-strong)]">
        {value}
      </pre>
    </div>
  );
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "QUEUED":
      return "violet" as const;
    case "RUNNING":
      return "blue" as const;
    case "SUCCESS":
      return "mint" as const;
    case "FAILED":
      return "danger" as const;
    case "CANCELED":
      return "ghost" as const;
    case "TERMINATED":
      return "ghost" as const;
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

function supportsDeleteWithFiles(task: Task) {
  if (task.type !== "download") {
    return false;
  }

  try {
    const payload = JSON.parse(task.payload || "{}") as {
      mode?: string;
      ids?: string[];
    };
    const mode = String(payload.mode || "batch").toLowerCase();
    return mode !== "hot100" && Array.isArray(payload.ids) && payload.ids.length > 0;
  } catch {
    return false;
  }
}
