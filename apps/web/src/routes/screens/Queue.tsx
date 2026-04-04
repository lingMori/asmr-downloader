import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Clock3, DownloadCloud, RefreshCcw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api";
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
      toast.success(`已创建重试任务 #${res.taskId}`);
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
  const totalPages = Math.max(
    1,
    Math.ceil((tasksQuery.data?.total ?? 0) / filters.pageSize),
  );
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

  if (tasksQuery.isLoading) {
    return <div className="text-slate-400">正在加载任务列表...</div>;
  }

  if (tasksQuery.isError) {
    return <div className="text-rose-300">任务列表加载失败。</div>;
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          任务
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          跟踪下载与同步任务
        </h1>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Clock3} label="运行中" value={summary.running} />
        <MetricCard icon={Activity} label="失败" value={summary.failed} />
        <MetricCard icon={DownloadCloud} label="命中任务数" value={summary.total} />
      </div>

      <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_120px]">
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

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>任务列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>ID</TableHeaderCell>
                    <TableHeaderCell>名称</TableHeaderCell>
                    <TableHeaderCell>类型</TableHeaderCell>
                    <TableHeaderCell>状态</TableHeaderCell>
                    <TableHeaderCell>进度</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {tasksQuery.data?.items.map((task) => (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <TableCell>{task.id}</TableCell>
                      <TableCell className="text-slate-200">{task.name}</TableCell>
                      <TableCell className="text-slate-400">{translateTaskType(task.type)}</TableCell>
                      <TableCell>
                        <Badge>{translateTaskStatus(task.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {Math.round((task.progress ?? 0) * 100)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between px-4 pb-4 text-sm text-slate-400">
              <span>
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

        <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>任务详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedTaskId && (
              <p className="text-sm text-slate-500">
                选择一个任务以查看参数、结果和日志。
              </p>
            )}
            {taskDetailQuery.isLoading && (
              <p className="text-sm text-slate-500">正在加载任务详情...</p>
            )}
            {selectedTask && (
              <>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => cancelMutation.mutate(selectedTask.id)}
                    disabled={!canCancel || cancelMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    取消任务
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => retryMutation.mutate(selectedTask.id)}
                    disabled={!canRetry || retryMutation.isPending}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    重试任务
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => deleteMutation.mutate(selectedTask.id)}
                    disabled={!canDelete || deleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除任务
                  </Button>
                </div>
                <Summary label="状态" value={translateTaskStatus(selectedTask.status)} />
                <Summary label="消息" value={selectedTask.message || "-"} />
                <Summary label="来源" value={selectedTask.source || "-"} />
                <Summary label="创建时间" value={selectedTask.createdAt || "-"} />
                <CodeBlock title="请求参数" value={selectedTask.payload || "{}"} />
                <CodeBlock title="执行结果" value={selectedTask.result || "{}"} />
                <div className="space-y-2">
                  <div className="text-sm text-slate-500">日志</div>
                  <div className="space-y-2">
                    {(selectedTask.logs ?? []).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300"
                      >
                        {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-sm">{label}</span>
          <Icon className="h-4 w-4 text-amber-300" />
        </div>
        <div className="text-3xl font-semibold text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}

function CodeBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="text-slate-500">{title}</div>
      <pre className="overflow-auto rounded-2xl bg-slate-950/60 p-3 text-xs text-slate-300">
        {value}
      </pre>
    </div>
  );
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
