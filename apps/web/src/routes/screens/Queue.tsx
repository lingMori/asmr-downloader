import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowClockwise, DownloadSimple, Fire, Plus, Trash, XCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionReviewDialog, DeckDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  EmptyState,
  PageHeader,
  ProgressTrack,
  RouteFeedback,
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
  const [downloadComposerOpen, setDownloadComposerOpen] = useState(false);
  const [createReview, setCreateReview] = useState<"batch" | "hot100" | null>(null);
  const [deleteIntent, setDeleteIntent] = useState<"record" | "files" | null>(null);
  const [downloadDraft, setDownloadDraft] = useState({
    ids: "",
    hotCount: "10",
    outputDir: "",
  });
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
  const taskSummaryQuery = useQuery({
    queryKey: ["task-summary", "queue", filters.search, filters.type, filters.status],
    queryFn: () =>
      apiClient.getTaskSummary({
        search: filters.search,
        type: filters.type || undefined,
        status: filters.status || undefined,
      }),
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
      setDeleteIntent(null);
      if (selectedTaskId !== null) {
        setSelectedTaskId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-summary"] });
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
      setDeleteIntent(null);
      if (selectedTaskId !== null) {
        setSelectedTaskId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-summary"] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["work-status"] });
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

  const createDownloadMutation = useMutation({
    mutationFn: (mode: "batch" | "hot100") =>
      mode === "hot100"
        ? apiClient.createDownload({
            mode: "hot100",
            count: Math.min(100, Math.max(1, Number(downloadDraft.hotCount) || 10)),
            output_dir: downloadDraft.outputDir.trim() || undefined,
            name: `Hot100 x${Math.min(100, Math.max(1, Number(downloadDraft.hotCount) || 10))}`,
          })
        : apiClient.createDownload({
            mode: "batch",
            ids: parseDirectIDs(downloadDraft.ids),
            output_dir: downloadDraft.outputDir.trim() || undefined,
            name: "RJ 批量下载",
          }),
    onSuccess: (res, mode) => {
      toast.success(`已创建${mode === "hot100" ? " Hot100" : " RJ 批量"}任务 #${res.task_id}`);
      setCreateReview(null);
      setDownloadComposerOpen(false);
      setDownloadDraft((current) => ({ ...current, ids: "" }));
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-summary"] });
      queryClient.invalidateQueries({ queryKey: ["work-status"] });
    },
    onError: (error) => toast.error(String(error)),
  });

  const summary = taskSummaryQuery.data ?? {
    running: 0,
    failed: 0,
    total: tasksQuery.data?.total ?? 0,
  };

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
    <section className="space-y-4">
      <PageHeader
        kicker="任务中心"
        title="下载任务"
        description="扫描任务状态，处理取消、重试、删除和文件清理。"
        meta={
          <Button size="sm" onClick={() => setDownloadComposerOpen(true)}>
            <Plus className="h-4 w-4" weight="bold" />
            新建下载任务
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-3 border-b border-[color:var(--chassis-edge)]">
          <QueueMetric label="运行中" value={summary.running} tone="live" />
          <QueueMetric label="失败" value={summary.failed} tone="halt" />
          <QueueMetric label="当前筛选" value={summary.total} tone="warn" />
        </div>
        <CardContent className="grid gap-3 p-3 lg:grid-cols-[2fr_1fr_1fr_140px]">
          <Input
            aria-label="搜索任务"
            value={filters.search}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))
            }
            placeholder="按任务名称或消息搜索"
          />
          <Select
            aria-label="任务类型"
            value={filters.type}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, type: event.target.value, page: 1 }))
            }
          >
            <option value="">全部类型</option>
            <option value="download">下载</option>
            <option value="sync">刷新作品清单</option>
            <option value="sync-download">批量下载</option>
            <option value="sync-retry">同步重试</option>
          </Select>
          <Select
            aria-label="任务状态"
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))
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
            aria-label="每页任务数量"
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[color:var(--chassis-edge)] pb-3">
            <div>
              <CardTitle className="text-base">任务列表</CardTitle>
              <p className="mt-1 text-xs text-[color:var(--text-mute)]">自动刷新 · 点击任务名称检查详情</p>
            </div>
            <Badge variant="mute">{tasksQuery.data?.total ?? 0} 条</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto" role="region" aria-label="任务列表，可横向滚动" tabIndex={0}>
              <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                <caption className="sr-only">符合当前筛选条件的下载与同步任务</caption>
                <thead className="bg-[color:var(--screen-void)] text-xs text-[color:var(--text-mute)]">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">任务</th>
                    <th className="px-3 py-2.5 font-medium">类型</th>
                    <th className="px-3 py-2.5 font-medium">状态</th>
                    <th className="px-3 py-2.5 font-medium">进度</th>
                    <th className="px-4 py-2.5 font-medium">最近消息</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--chassis-edge)]">
                  {(tasksQuery.data?.items ?? []).map((task) => {
                    const percent = Math.round((task.progress ?? 0) * 100);
                    const selected = selectedTaskId === task.id;
                    return (
                      <tr
                        key={task.id}
                        className={selected ? "bg-[color:var(--screen-void)] shadow-[inset_2px_0_0_var(--accent)]" : "hover:bg-[color:var(--surface-elevated)]"}
                      >
                        <td className="max-w-[17rem] px-4 py-3">
                          <button
                            type="button"
                            className="block w-full text-left"
                            aria-pressed={selected}
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            <span className="block truncate font-semibold text-[color:var(--text-display)]">{task.name}</span>
                            <span className="console-mono mt-0.5 block text-xs text-[color:var(--text-mute)]">#{task.id}</span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-[color:var(--text-body)]">{translateTaskType(task.type)}</td>
                        <td className="px-3 py-3">
                          <Badge variant={statusBadgeVariant(task.status)}>{translateTaskStatus(task.status)}</Badge>
                        </td>
                        <td className="w-32 px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden bg-[color:var(--screen-void)]">
                              <div className="h-full bg-[color:var(--phosphor-primary)]" style={{ width: `${percent}%` }} />
                            </div>
                            <span className="console-mono w-9 text-right text-xs text-[color:var(--text-body)]">{percent}%</span>
                          </div>
                        </td>
                        <td className="max-w-[18rem] px-4 py-3">
                          <div className="truncate text-xs text-[color:var(--text-mute)]">{task.message || "等待更多日志..."}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {(tasksQuery.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                symbol="无任务"
                title="当前筛选下没有任务"
                description="放宽筛选条件，或新建下载和同步任务。"
                className="min-h-[12rem]"
              />
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--chassis-edge)] px-4 py-3">
              <span className="text-xs text-[color:var(--text-mute)]">第 {filters.page} / {totalPages} 页</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filters.page >= totalPages}
                  onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden self-start">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[color:var(--chassis-edge)] pb-3">
            <CardTitle className="text-base">任务详情</CardTitle>
            {selectedTask ? (
              <Badge variant={statusBadgeVariant(selectedTask.status)}>{translateTaskStatus(selectedTask.status)}</Badge>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {!selectedTaskId ? (
              <EmptyState
                symbol="请选择"
                title="先选一个任务"
                description="选中任务名称后查看参数、结果、日志和可用操作。"
                className="min-h-[14rem]"
              />
            ) : null}
            {taskDetailQuery.isLoading ? (
              <div className="text-sm text-[color:var(--text-body)]">正在加载任务详情...</div>
            ) : null}
            {selectedTask ? (
              <>
                {selectedTaskInsight ? (
                  <div className="border-l-2 border-[color:var(--accent)] pl-3">
                    <div className="text-sm font-semibold text-[color:var(--text-display)]">{selectedTaskInsight.guidanceTitle}</div>
                    <p className="mt-1 text-sm leading-5 text-[color:var(--text-body)]">{selectedTaskInsight.guidance}</p>
                    {selectedTaskInsight.canOpenLibrary ? (
                      <Link
                        to="/library"
                        search={{ q: "", id: "", page: 1 }}
                        className="mt-2 inline-flex text-xs font-semibold text-[color:var(--accent)]"
                      >
                        去本地媒体库查看
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 border-y border-[color:var(--chassis-edge)] py-3">
                  <Button variant="secondary" size="sm" busy={cancelMutation.isPending} onClick={() => cancelMutation.mutate(selectedTask.id)} disabled={!canCancel || cancelMutation.isPending}>
                    <XCircle className="h-4 w-4" weight="duotone" />取消任务
                  </Button>
                  <Button variant="secondary" size="sm" busy={retryMutation.isPending} onClick={() => retryMutation.mutate(selectedTask.id)} disabled={!canRetry || retryMutation.isPending}>
                    <ArrowClockwise className="h-4 w-4" weight="duotone" />重新创建任务
                  </Button>
                  <Button variant="danger" size="sm" busy={deleteMutation.isPending} onClick={() => setDeleteIntent("record")} disabled={!canDelete || deleteMutation.isPending}>
                    <Trash className="h-4 w-4" weight="duotone" />删除记录
                  </Button>
                  <Button variant="danger" size="sm" busy={deleteWithFilesMutation.isPending} onClick={() => setDeleteIntent("files")} disabled={!canDeleteWithFiles || deleteWithFilesMutation.isPending}>
                    <Trash className="h-4 w-4" weight="duotone" />清理文件并移除记录
                  </Button>
                </div>

                <ProgressTrack
                  label="当前任务进度"
                  value={selectedTask.progress ?? 0}
                  running={selectedTask.status === "RUNNING"}
                  hint={selectedTask.message || "任务还没有返回额外消息。"}
                />

                <dl className="divide-y divide-[color:var(--chassis-edge)] border-y border-[color:var(--chassis-edge)]">
                  <Summary label="状态" value={translateTaskStatus(selectedTask.status)} />
                  <Summary label="来源" value={selectedTask.source || "-"} />
                  <Summary label="类型" value={translateTaskType(selectedTask.type)} />
                  <Summary label="创建时间" value={selectedTask.created_at || "-"} />
                  <Summary label="开始时间" value={selectedTask.started_at || "-"} />
                  <Summary label="完成时间" value={selectedTask.completed_at || "-"} />
                </dl>

                {selectedTaskInsight ? (
                  <>
                    <TaskSummaryPanel title="任务参数摘要" rows={selectedTaskInsight.payloadRows} />
                    {selectedTaskInsight.relatedIDs.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-[color:var(--text-body)]">相关作品</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedTaskInsight.relatedIDs.map((id) => <Badge key={id} variant="warn">{id}</Badge>)}
                        </div>
                      </div>
                    ) : null}
                    {selectedTaskInsight.resultRows.length > 0 ? <TaskSummaryPanel title="执行结果摘要" rows={selectedTaskInsight.resultRows} /> : null}
                    {selectedTask.status === "FAILED" ? (
                      <div className="border-l-2 border-[color:var(--danger)] pl-3 text-sm leading-5 text-[color:var(--text-display)]">
                        <div className="mb-1 font-semibold">失败原因</div>
                        {selectedTask.log_excerpt || selectedTask.message || "任务失败，但没有返回详细原因。"}
                      </div>
                    ) : null}
                  </>
                ) : null}

                <CodeBlock title="原始请求 JSON" value={formatJSON(selectedTask.payload)} />
                <CodeBlock title="原始结果 JSON" value={formatJSON(selectedTask.result)} />

                <details className="deck-plate group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-[color:var(--text-display)]">
                    <span>日志</span>
                    <Badge variant="mute">{selectedTask.logs?.length ?? 0}</Badge>
                  </summary>
                  <div className="space-y-2 border-t border-[color:var(--chassis-edge)] p-3">
                    {(selectedTask.logs ?? []).length === 0 ? <div className="text-sm text-[color:var(--text-mute)]">暂无日志输出。</div> : null}
                    {(selectedTask.logs ?? []).map((log) => (
                      <div key={log.id} className="border-b border-[color:var(--chassis-edge)] pb-2 text-sm text-[color:var(--text-display)] last:border-0 last:pb-0">
                        <div>{log.message}</div>
                        {log.created_at ? <div className="console-mono mt-1 text-xs text-[color:var(--text-mute)]">{log.created_at}</div> : null}
                      </div>
                    ))}
                  </div>
                </details>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <DeckDialog
        open={downloadComposerOpen}
        onOpenChange={setDownloadComposerOpen}
        kicker="New Download"
        title="新建下载任务"
        description="直接输入作品编号，或从 Hot100 创建下载任务。搜索结果下载仍在搜索页完成。"
        tone="signal"
        footer={
          <Button variant="secondary" onClick={() => setDownloadComposerOpen(false)}>
            关闭
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <div>
              <div className="font-semibold text-[color:var(--text-display)]">RJ 编号批量下载</div>
              <p className="mt-1 text-sm text-[color:var(--text-body)]">支持逗号、空格或换行分隔，并会自动去重。</p>
            </div>
            <Input
              aria-label="RJ 编号"
              value={downloadDraft.ids}
              onChange={(event) => setDownloadDraft((current) => ({ ...current, ids: event.target.value }))}
              placeholder="例如 RJ123456, RJ234567"
            />
            <Button
              className="w-full"
              disabled={parseDirectIDs(downloadDraft.ids).length === 0}
              onClick={() => {
                setDownloadComposerOpen(false);
                setCreateReview("batch");
              }}
            >
              <DownloadSimple className="h-4 w-4" weight="duotone" />
              复核 RJ 批量任务
            </Button>
          </div>

          <div className="border-t border-[color:var(--chassis-edge)] pt-5">
            <div className="font-semibold text-[color:var(--text-display)]">Hot100 下载</div>
            <p className="mt-1 text-sm text-[color:var(--text-body)]">按远端热门榜单顺序下载，最多 100 部作品。</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[9rem_1fr]">
              <Input
                aria-label="Hot100 下载数量"
                type="number"
                min={1}
                max={100}
                value={downloadDraft.hotCount}
                onChange={(event) => setDownloadDraft((current) => ({ ...current, hotCount: event.target.value }))}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  setDownloadComposerOpen(false);
                  setCreateReview("hot100");
                }}
              >
                <Fire className="h-4 w-4" weight="duotone" />
                复核 Hot100 任务
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t border-[color:var(--chassis-edge)] pt-5">
            <div className="text-sm font-semibold text-[color:var(--text-display)]">输出目录（可选）</div>
            <Input
              aria-label="下载输出目录"
              value={downloadDraft.outputDir}
              onChange={(event) => setDownloadDraft((current) => ({ ...current, outputDir: event.target.value }))}
              placeholder="留空则使用设置中的同步目录"
            />
          </div>
        </div>
      </DeckDialog>

      <ActionReviewDialog
        open={createReview !== null}
        onOpenChange={(open) => {
          if (!open && !createDownloadMutation.isPending) {
            setCreateReview(null);
            setDownloadComposerOpen(true);
          }
        }}
        title={createReview === "hot100" ? "确认创建 Hot100 下载" : "确认创建 RJ 批量下载"}
        description="任务创建后会立即进入后台执行，可在任务中心查看进度或取消。"
        rows={[
          {
            label: "下载范围",
            value:
              createReview === "hot100"
                ? `Hot100 前 ${Math.min(100, Math.max(1, Number(downloadDraft.hotCount) || 10))} 部`
                : `${parseDirectIDs(downloadDraft.ids).length} 个作品编号`,
          },
          { label: "输出目录", value: downloadDraft.outputDir.trim() || "设置中的同步目录" },
        ]}
        warning={createReview === "hot100" ? "Hot100 可能产生较大的网络流量和磁盘占用，请确认数量与目录。" : undefined}
        confirmLabel="创建下载任务"
        busy={createDownloadMutation.isPending}
        onConfirm={() => createReview && createDownloadMutation.mutate(createReview)}
      />

      <ActionReviewDialog
        open={deleteIntent !== null && Boolean(selectedTask)}
        onOpenChange={(open) => !open && !deleteMutation.isPending && !deleteWithFilesMutation.isPending && setDeleteIntent(null)}
        title={deleteIntent === "files" ? "确认清理文件并删除任务" : "确认删除任务记录"}
        description={deleteIntent === "files" ? "此操作会删除匹配到的本地作品目录和任务记录。" : "此操作只删除任务记录及日志，不删除已下载文件。"}
        rows={selectedTask ? [
          { label: "任务", value: `#${selectedTask.id} ${selectedTask.name}` },
          { label: "状态", value: translateTaskStatus(selectedTask.status) },
        ] : []}
        warning={deleteIntent === "files" ? "文件删除后无法通过任务中心恢复。Hot100 和同步任务不支持自动文件清理。" : undefined}
        confirmLabel={deleteIntent === "files" ? "清理文件并删除" : "删除任务记录"}
        confirmVariant="danger"
        busy={deleteMutation.isPending || deleteWithFilesMutation.isPending}
        onConfirm={() => {
          if (!selectedTask) return;
          if (deleteIntent === "files") deleteWithFilesMutation.mutate(selectedTask.id);
          else deleteMutation.mutate(selectedTask.id);
        }}
      />
    </section>
  );
}

function parseDirectIDs(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\s,，;；]+/)
        .map((value) => value.trim().toUpperCase())
        .filter((value) => /^(RJ|VJ|BJ|AJ|CJ|DL|NP|AL|KN)\d+$/.test(value)),
    ),
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-[color:var(--text-mute)]">{label}</dt>
      <dd className="min-w-0 break-words text-[color:var(--text-display)]">{value}</dd>
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
      <dl className="divide-y divide-[color:var(--chassis-edge)] border-y border-[color:var(--chassis-edge)]">
        {rows.map((row) => (
          <Summary key={`${title}-${row.label}`} label={row.label} value={row.value} />
        ))}
      </dl>
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

function QueueMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: BadgeTone;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 border-r border-[color:var(--chassis-edge)] px-3 py-2.5 last:border-r-0">
      <div>
        <div className="text-xs text-[color:var(--text-mute)]">{label}</div>
        <div className="console-readout mt-1 text-xl">{formatStatValue(value)}</div>
      </div>
      <Badge variant={tone}>{value > 0 ? "有" : "无"}</Badge>
    </div>
  );
}

function formatStatValue(value: number) {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
}

function CodeBlock({ title, value }: { title: string; value: string }) {
  return (
    <details className="deck-plate group">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-[color:var(--text-display)]">
        {title}
      </summary>
      <pre className="max-h-80 overflow-auto border-t border-[color:var(--chassis-edge)] bg-[color:var(--screen-void)] p-3 text-xs text-[color:var(--text-display)]">{value}</pre>
    </details>
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
