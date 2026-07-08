import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowClockwise, Clock, DownloadSimple, Pulse, Trash, XCircle } from "@phosphor-icons/react";
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
  RouteFeedback,
  fadeUpItem,
  staggerContainer,
} from "@/components/ui/sweet";
import { apiClient, type Task } from "@/lib/api";

type BadgeTone = "live" | "signal" | "warn" | "halt";

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

  const summary = useMemo(() => {
    const items = tasksQuery.data?.items ?? [];
    return {
      running: items.filter((item) => item.status === "RUNNING").length,
      failed: items.filter((item) => item.status === "FAILED").length,
      total: tasksQuery.data?.total ?? 0,
    };
  }, [tasksQuery.data]);

  const selectedTask = taskDetailQuery.data;
  const selectedTaskInsight = useMemo(
    () => (selectedTask ? buildTaskInsight(selectedTask) : null),
    [selectedTask],
  );
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
    return (
      <RouteFeedback
        title="正在读取任务列表"
        description="正在连接本地后端并拉取下载、同步和重试任务。"
      />
    );
  }

  if (tasksQuery.isError) {
    return (
      <RouteFeedback
        tone="halt"
        title="任务列表加载失败"
        description={`没有拿到任务数据。请确认本地后端正在运行，或稍后重试。${tasksQuery.error ? `错误信息：${formatErrorMessage(tasksQuery.error)}` : ""}`}
        action={
          <Button variant="secondary" onClick={() => void tasksQuery.refetch()}>
            <ArrowClockwise className="h-4 w-4" weight="duotone" />
            重新加载
          </Button>
        }
      />
    );
  }

  return (
    <motion.section
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="任务"
          title="下载任务"
          description="查看下载和同步任务进度，处理取消、重试、删除和文件清理。"
          meta={
            <div className="deck-screen space-y-3 p-4">
              <Badge variant="signal">自动刷新</Badge>
              <div className="text-sm leading-6 text-[color:var(--text-body)]">
                当前命中 {tasksQuery.data?.total ?? 0} 条任务
              </div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <div className="deck-chassis grid gap-2 p-2.5 md:grid-cols-3">
          <QueueStat
            label="运行中"
            value={summary.running}
            hint="正在推进"
            icon={<Clock className="h-4 w-4" weight="duotone" />}
            tone="live"
          />
          <QueueStat
            label="失败"
            value={summary.failed}
            hint="待处理"
            icon={<Pulse className="h-4 w-4" weight="duotone" />}
            tone="halt"
          />
          <QueueStat
            label="命中任务数"
            value={summary.total}
            hint="当前筛选"
            icon={<DownloadSimple className="h-4 w-4" weight="duotone" />}
            tone="warn"
          />
        </div>
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
              <option value="sync">刷新作品清单</option>
              <option value="sync-download">批量下载</option>
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
            <Badge variant="warn">
              第 {filters.page} / {totalPages} 页
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {(tasksQuery.data?.items ?? []).map((task) => (
              <button
                key={task.id}
                type="button"
                className={`block w-full border p-4 text-left transition ${
                  selectedTaskId === task.id
                    ? "deck-live border-[color:var(--tape-pink)] bg-[color:var(--screen-void)]"
                    : "deck-plate hover:border-[color:var(--telltale-amber)]"
                }`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="console-mono text-sm font-semibold text-[color:var(--text-display)]">
                      {task.name}
                    </div>
                    <div className="console-mono text-xs text-[color:var(--text-mute)]">
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
                    running={task.status === "RUNNING"}
                    hint={task.message || "等待更多日志..."}
                  />
                </div>
              </button>
            ))}

            {(tasksQuery.data?.items.length ?? 0) === 0 && (
              <EmptyState
                symbol="无任务"
                title="当前筛选下没有任务"
                description="试着放宽搜索条件，或者回到发现页、同步页创建新的下载和同步任务。"
                className="min-h-[14rem]"
              />
            )}

            <div className="deck-plate flex flex-wrap items-center justify-between gap-3 px-4 py-3">
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
                symbol="请选择"
                title="先选一个任务"
                description="选中左侧任意任务后，可以查看请求参数、执行结果、日志，并进行取消、重试或删除。"
                className="min-h-[16rem]"
              />
            )}
            {taskDetailQuery.isLoading && (
              <div className="text-sm text-[color:var(--text-body)]">正在加载任务详情...</div>
            )}
            {selectedTask && (
              <>
                {selectedTaskInsight ? (
                  <div className="deck-screen space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="deck-decal">推荐下一步</div>
                        <div className="console-title mt-3 text-xl font-black text-[color:var(--text-display)]">
                          {selectedTaskInsight.guidanceTitle}
                        </div>
                      </div>
                      <Badge variant={statusBadgeVariant(selectedTask.status)}>
                        {translateTaskStatus(selectedTask.status)}
                      </Badge>
                    </div>
                    <p className="text-sm leading-6 text-[color:var(--text-body)]">
                      {selectedTaskInsight.guidance}
                    </p>
                    {selectedTaskInsight.canOpenLibrary ? (
                      <Link
                        to="/library"
                        className="deck-button-secondary inline-flex h-[38px] items-center justify-center border px-4 py-2 text-center text-xs font-bold transition hover:brightness-110"
                      >
                        去本地媒体库查看
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    busy={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(selectedTask.id)}
                    disabled={!canCancel || cancelMutation.isPending}
                  >
                    <XCircle className="h-4 w-4" weight="duotone" />
                    取消任务
                  </Button>
                  <Button
                    variant="secondary"
                    busy={retryMutation.isPending}
                    onClick={() => retryMutation.mutate(selectedTask.id)}
                    disabled={!canRetry || retryMutation.isPending}
                  >
                    <ArrowClockwise className="h-4 w-4" weight="duotone" />
                    重新创建任务
                  </Button>
                  <Button
                    variant="danger"
                    busy={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(selectedTask.id)}
                    disabled={!canDelete || deleteMutation.isPending}
                  >
                    <Trash className="h-4 w-4" weight="duotone" />
                    删除记录
                  </Button>
                  <Button
                    variant="danger"
                    busy={deleteWithFilesMutation.isPending}
                    onClick={() => deleteWithFilesMutation.mutate(selectedTask.id)}
                    disabled={!canDeleteWithFiles || deleteWithFilesMutation.isPending}
                  >
                    <Trash className="h-4 w-4" weight="duotone" />
                    清理文件并移除记录
                  </Button>
                </div>

                <ProgressTrack
                  label="当前任务进度"
                  value={selectedTask.progress ?? 0}
                  running={selectedTask.status === "RUNNING"}
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

                {selectedTaskInsight ? (
                  <>
                    <TaskSummaryPanel
                      title="任务参数摘要"
                      rows={selectedTaskInsight.payloadRows}
                    />
                    {selectedTaskInsight.relatedIDs.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-[color:var(--text-body)]">
                          相关作品
                        </div>
                        <div className="deck-screen flex flex-wrap gap-2 p-3">
                          {selectedTaskInsight.relatedIDs.map((id) => (
                            <Badge key={id} variant="warn">
                              {id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedTaskInsight.resultRows.length > 0 ? (
                      <TaskSummaryPanel
                        title="执行结果摘要"
                        rows={selectedTaskInsight.resultRows}
                      />
                    ) : null}
                    {selectedTask.status === "FAILED" ? (
                      <div className="deck-screen p-4">
                        <div className="deck-decal">失败原因</div>
                        <p className="mt-3 text-sm leading-6 text-[color:var(--text-display)]">
                          {selectedTask.log_excerpt || selectedTask.message || "任务失败，但没有返回详细原因。"}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}

                <CodeBlock title="原始请求 JSON" value={formatJSON(selectedTask.payload)} />
                <CodeBlock title="原始结果 JSON" value={formatJSON(selectedTask.result)} />

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[color:var(--text-body)]">日志</div>
                  <div className="space-y-2">
                    {(selectedTask.logs ?? []).length === 0 && (
                      <div className="deck-screen p-3 text-sm text-[color:var(--text-mute)]">
                        暂无日志输出。
                      </div>
                    )}
                    {(selectedTask.logs ?? []).map((log) => (
                      <div
                        key={log.id}
                        className="deck-screen p-3 text-sm text-[color:var(--text-display)]"
                      >
                        <div>{log.message}</div>
                        {log.created_at ? (
                          <div className="mt-2 text-xs text-[color:var(--text-mute)]">
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
    <div className="deck-screen p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-mute)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[color:var(--text-display)]">{value}</div>
    </div>
  );
}

type TaskSummaryRow = {
  label: string;
  value: string;
};

type TaskInsight = {
  guidanceTitle: string;
  guidance: string;
  canOpenLibrary: boolean;
  relatedIDs: string[];
  payloadRows: TaskSummaryRow[];
  resultRows: TaskSummaryRow[];
};

function TaskSummaryPanel({
  title,
  rows,
}: {
  title: string;
  rows: TaskSummaryRow[];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-[color:var(--text-body)]">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <Summary key={`${title}-${row.label}`} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}

function buildTaskInsight(task: Task): TaskInsight {
  const payload = parseJSONRecord(task.payload);
  const result = parseJSONRecord(task.result);
  const ids = readStringArray(payload.ids);
  const outputDir = readString(payload.output_dir) || readString(result.output_dir);
  const folder = readString(payload.folder) || readString(result.folder);
  const mode = readString(payload.mode);
  const scope = readString(payload.scope);

  const payloadRows: TaskSummaryRow[] = [];
  const resultRows: TaskSummaryRow[] = [];

  switch (task.type) {
    case "download":
      payloadRows.push({ label: "下载模式", value: translateDownloadMode(mode) });
      if (ids.length > 0) {
        payloadRows.push({ label: "作品数量", value: String(ids.length) });
      }
      if (typeof payload.count === "number" && Number.isFinite(payload.count)) {
        payloadRows.push({ label: "数量", value: String(payload.count) });
      }
      payloadRows.push({
        label: "目标目录",
        value: outputDir || "使用设置中的同步目录",
      });
      if (outputDir) {
        resultRows.push({ label: "下载目录", value: outputDir });
      }
      break;
    case "sync":
      payloadRows.push({ label: "同步范围", value: scope === "subtitle" ? "仅字幕作品" : "全部作品" });
      payloadRows.push({ label: "会下载文件", value: "不会，只刷新作品清单" });
      if (readString(result.scope)) {
        resultRows.push({ label: "完成范围", value: readString(result.scope) });
      }
      break;
    case "sync-download":
      payloadRows.push({ label: "操作内容", value: "批量下载未入库作品" });
      payloadRows.push({ label: "目标目录", value: folder || "使用设置中的同步目录" });
      if (folder) {
        resultRows.push({ label: "下载目录", value: folder });
      }
      break;
    case "sync-retry":
      payloadRows.push({ label: "操作内容", value: "重试失败下载记录" });
      payloadRows.push({ label: "影响范围", value: "只处理失败记录" });
      break;
    default:
      payloadRows.push({ label: "任务类型", value: translateTaskType(task.type) });
  }

  const errorMessage = readString(result.error) || task.log_excerpt || task.message;
  if (task.status === "FAILED" && errorMessage) {
    resultRows.push({ label: "失败原因", value: errorMessage });
  }

  return {
    guidanceTitle: taskGuidanceTitle(task),
    guidance: taskGuidance(task),
    canOpenLibrary:
      task.status === "SUCCESS" &&
      (task.type === "download" || task.type === "sync-download"),
    relatedIDs: ids,
    payloadRows,
    resultRows,
  };
}

function taskGuidanceTitle(task: Task) {
  switch (task.status) {
    case "RUNNING":
      return "任务正在执行";
    case "QUEUED":
      return "任务正在排队";
    case "FAILED":
      return "任务失败，建议先看原因";
    case "SUCCESS":
      return "任务已完成";
    case "CANCELED":
      return "任务已取消";
    case "TERMINATED":
      return "任务被中断";
    default:
      return "查看任务详情";
  }
}

function taskGuidance(task: Task) {
  switch (task.status) {
    case "RUNNING":
      return "如果当前任务占用时间过长或目标不对，可以取消任务；取消后会保留当前记录和日志。";
    case "QUEUED":
      return "任务已经创建，正在等待执行。确认参数无误即可等待，也可以在执行前取消。";
    case "FAILED":
      return "先查看失败原因和日志。网络、鉴权或远端限流问题通常可以重新创建任务；目录或参数错误建议先修改设置。";
    case "SUCCESS":
      if (task.type === "download" || task.type === "sync-download") {
        return "文件已经处理完成。可以进入本地媒体库搜索对应 RJ 编号或标题继续播放和整理。";
      }
      return "任务已经完成。可以查看摘要确认本次操作影响范围。";
    case "CANCELED":
      return "任务已被取消。需要继续时可以重新创建任务，或删除这条记录保持列表清爽。";
    case "TERMINATED":
      return "服务重启或进程中断导致任务终止。建议重新创建任务，并检查上一次是否留下了部分文件。";
    default:
      return "查看任务参数、执行结果和日志，确认下一步操作。";
  }
}

function parseJSONRecord(raw: string | undefined) {
  if (!raw) {
    return {} as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {} as Record<string, unknown>;
  }
  return {} as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function formatJSON(raw: string | undefined) {
  if (!raw) {
    return "{}";
  }
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function translateDownloadMode(mode: string) {
  switch (mode) {
    case "single":
      return "单个作品";
    case "batch":
      return "批量作品";
    case "hot100":
      return "Hot100";
    default:
      return mode || "批量作品";
  }
}

function QueueStat({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone: BadgeTone;
}) {
  return (
    <div className="deck-plate flex min-h-[4rem] items-center gap-3 px-3 py-2.5">
      <span className="deck-screen flex h-9 w-9 shrink-0 items-center justify-center text-[color:var(--phosphor-primary)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tone} className="shrink-0">
            {label}
          </Badge>
          <span className="truncate text-xs text-[color:var(--text-mute)]">
            {hint}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden border border-[color:var(--chassis-edge)] bg-[color:var(--screen-void)]">
          <div
            className="h-full bg-[color:var(--phosphor-primary)] shadow-[var(--glow-phosphor)]"
            style={{ width: `${statBarWidth(value)}%` }}
          />
        </div>
      </div>
      <div className="console-readout shrink-0 text-2xl font-bold leading-none md:text-3xl">
        {formatStatValue(value)}
      </div>
    </div>
  );
}

function statBarWidth(value: number) {
  if (value <= 0) {
    return 4;
  }
  return Math.max(12, Math.min(100, Math.log10(value + 1) * 42));
}

function formatStatValue(value: number) {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
}

function CodeBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-[color:var(--text-body)]">{title}</div>
      <pre className="deck-screen overflow-auto p-4 text-xs text-[color:var(--text-display)]">
        {value}
      </pre>
    </div>
  );
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "QUEUED":
      return "warn" as const;
    case "RUNNING":
      return "live" as const;
    case "SUCCESS":
      return "signal" as const;
    case "FAILED":
      return "halt" as const;
    case "CANCELED":
      return "mute" as const;
    case "TERMINATED":
      return "mute" as const;
    default:
      return "decal" as const;
  }
}

function translateTaskType(type: string) {
  switch (type) {
    case "download":
      return "下载";
    case "sync":
      return "刷新作品清单";
    case "sync-download":
      return "批量下载";
    case "sync-retry":
      return "重试失败下载";
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

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
