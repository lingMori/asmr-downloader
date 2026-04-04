import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCcw, RotateCcw, ServerCrash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { apiClient } from "@/lib/api";
import { useTaskEvents } from "@/lib/useTaskEvents";

export function Sync() {
  const queryClient = useQueryClient();
  const [syncScope, setSyncScope] = useState<"all" | "subtitle">("all");
  const [exportStatus, setExportStatus] = useState<
    "failed" | "success" | "pending" | "all"
  >("failed");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const reportQuery = useQuery({
    queryKey: ["sync", "report"],
    queryFn: () => apiClient.getReport(),
  });

  useTaskEvents(() => {
    queryClient.invalidateQueries({ queryKey: ["sync", "report"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  });

  const queueMutation = useMutation({
    mutationFn: async (mode: "metadata" | "download" | "retry") => {
      if (mode === "metadata") {
        return apiClient.queueSyncMetadata(syncScope);
      }
      if (mode === "download") {
        return apiClient.queueSyncDownload();
      }
      return apiClient.queueSyncRetry();
    },
    onSuccess: (res, mode) => {
      const label =
        mode === "metadata" ? "元数据同步" : mode === "download" ? "同步下载" : "失败重试";
      toast.success(`已创建${label}任务 #${res.taskId}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  const exportMutation = useMutation({
    mutationFn: async ({
      status,
      format,
    }: {
      status: "failed" | "success" | "pending" | "all";
      format: "csv" | "json";
    }) => {
      const result = await apiClient.exportSync(status, format);
      triggerBlobDownload(
        result.blob,
        result.filename ?? `sync_${status}.${format}`,
      );
      return { status, format };
    },
    onSuccess: ({ status, format }) => {
      const label =
        status === "failed"
          ? "失败"
          : status === "success"
            ? "成功"
            : status === "pending"
              ? "待处理"
              : "全部";
      toast.success(`已导出${label}同步记录，格式 ${format.toUpperCase()}`);
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          同步
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          控制元数据同步与批量下载
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <ActionCard
          title="元数据同步"
          description="从远端刷新作品元数据索引。"
          icon={RefreshCcw}
          onClick={() => queueMutation.mutate("metadata")}
          controls={
            <Select
              value={syncScope}
              onChange={(event) =>
                setSyncScope(event.target.value as "all" | "subtitle")
              }
            >
              <option value="all">全部元数据</option>
              <option value="subtitle">仅字幕作品</option>
            </Select>
          }
        />
        <ActionCard
          title="同步下载"
          description="批量下载待同步的作品。"
          icon={ServerCrash}
          onClick={() => queueMutation.mutate("download")}
        />
        <ActionCard
          title="失败重试"
          description="重新尝试下载失败的同步作品。"
          icon={RotateCcw}
          onClick={() => queueMutation.mutate("retry")}
        />
      </div>

      <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>同步报表</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Stat label="元数据作品数" value={reportQuery.data?.totals.metadata ?? 0} />
          <Stat label="字幕作品数" value={reportQuery.data?.totals.subtitle ?? 0} />
          <Stat
            label="无字幕作品数"
            value={reportQuery.data?.totals.withoutSubtitle ?? 0}
          />
          <Stat
            label="已完成下载"
            value={reportQuery.data?.downloads.completed ?? 0}
          />
          <Stat label="失败下载" value={reportQuery.data?.downloads.failed ?? 0} />
          <Stat label="待下载" value={reportQuery.data?.downloads.pending ?? 0} />
          <Stat
            label="总体进度"
            value={`${Math.round((reportQuery.data?.progress.overall ?? 0) * 100)}%`}
          />
          <Stat
            label="字幕作品进度"
            value={`${Math.round((reportQuery.data?.progress.withSubtitle ?? 0) * 100)}%`}
          />
          <Stat
            label="无字幕作品进度"
            value={`${Math.round((reportQuery.data?.progress.withoutSubtitle ?? 0) * 100)}%`}
          />
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>同步导出</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              value={exportStatus}
              onChange={(event) =>
                setExportStatus(
                  event.target.value as "failed" | "success" | "pending" | "all",
                )
              }
            >
              <option value="failed">失败记录</option>
              <option value="success">成功记录</option>
              <option value="pending">待处理记录</option>
              <option value="all">全部记录</option>
            </Select>
            <Select
              value={exportFormat}
              onChange={(event) =>
                setExportFormat(event.target.value as "csv" | "json")
              }
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </Select>
            <Button
              variant="secondary"
              onClick={() =>
                exportMutation.mutate({
                  status: exportStatus,
                  format: exportFormat,
                })
              }
              disabled={exportMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              导出当前选择
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => exportMutation.mutate({ status: "failed", format: "csv" })}
              disabled={exportMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              失败 CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportMutation.mutate({ status: "failed", format: "json" })}
              disabled={exportMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              失败 JSON
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportMutation.mutate({ status: "success", format: "csv" })}
              disabled={exportMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              成功 CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportMutation.mutate({ status: "success", format: "json" })}
              disabled={exportMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              成功 JSON
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ActionCard({
  title,
  description,
  icon: Icon,
  onClick,
  controls,
}: {
  title: string;
  description: string;
  icon: typeof RefreshCcw;
  onClick: () => void;
  controls?: ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">{title}</div>
          <Icon className="h-4 w-4 text-amber-300" />
        </div>
        <p className="text-sm leading-6 text-slate-300">{description}</p>
        {controls}
        <Button className="w-full" onClick={onClick}>
          执行操作
        </Button>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
