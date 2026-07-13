import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowClockwise, Database, DownloadSimple } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionReviewDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  PageHeader,
  ProgressTrack,
  RouteFeedback,
} from "@/components/ui/sweet";
import { apiClient } from "@/lib/api";

export function Sync() {
  const queryClient = useQueryClient();
  const [syncScope, setSyncScope] = useState<"all" | "subtitle">("all");
  const [exportStatus, setExportStatus] = useState<
    "failed" | "success" | "pending" | "all"
  >("failed");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [pendingMode, setPendingMode] = useState<"metadata" | "download" | "retry" | null>(null);
  const reportQuery = useQuery({
    queryKey: ["sync", "report"],
    queryFn: () => apiClient.getReport(),
  });
  const activeSyncTasksQuery = useQuery({
    queryKey: ["tasks", "sync-active"],
    queryFn: () =>
      apiClient.getTasks({
        type: ["sync", "sync-download", "sync-retry"],
        status: ["QUEUED", "RUNNING"],
        pageSize: 50,
      }),
    refetchInterval: 15000,
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
        mode === "metadata" ? "刷新作品清单" : mode === "download" ? "批量下载" : "重试失败下载";
      toast.success(`已创建${label}任务 #${res.task_id}`);
      setPendingMode(null);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-summary"] });
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

  const running =
    queueMutation.isPending || (activeSyncTasksQuery.data?.items.length ?? 0) > 0;
  const progress = reportQuery.data?.progress;
  const totals = reportQuery.data?.totals;
  const downloads = reportQuery.data?.downloads;
  const pipePercent = Math.round((progress?.overall ?? 0) * 100);

  if (reportQuery.isError) {
    return (
      <RouteFeedback
        tone="halt"
        title="同步报告加载失败"
        description={`没有拿到作品清单和下载进度。请确认本地后端正在运行，或稍后重试。${reportQuery.error ? `错误信息：${formatErrorMessage(reportQuery.error)}` : ""}`}
        action={
          <Button variant="secondary" onClick={() => void reportQuery.refetch()}>
            重新加载同步报告
          </Button>
        }
      />
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        kicker="同步中心"
        title="同步与批量下载"
        description="刷新作品清单、下载未入库作品，或重试失败记录。"
        meta={
          <div className="flex items-center gap-3">
            <Badge variant={running ? "live" : "mute"}>{running ? "任务运行中" : "当前空闲"}</Badge>
            <span className="console-readout text-xl">{pipePercent}%</span>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[color:var(--chassis-edge)] pb-3">
          <div>
            <CardTitle className="text-base">同步命令</CardTitle>
            <p className="mt-1 text-xs text-[color:var(--text-mute)]">执行前会显示操作范围和文件影响</p>
          </div>
          <Badge variant="mute">{activeSyncTasksQuery.data?.items.length ?? 0} 个活动任务</Badge>
        </CardHeader>
        <CardContent className="divide-y divide-[color:var(--chassis-edge)] p-0">
          <SyncCommand
            title="刷新作品清单"
            description="更新标题、标签、声优和字幕标记，只写入数据库。"
            icon={ArrowClockwise}
            control={
              <Select aria-label="作品清单刷新范围" value={syncScope} onChange={(event) => setSyncScope(event.target.value as "all" | "subtitle")}>
                <option value="all">全部作品清单</option>
                <option value="subtitle">仅带字幕作品</option>
              </Select>
            }
            actionLabel="刷新清单"
            busy={queueMutation.isPending}
            onClick={() => setPendingMode("metadata")}
          />
          <SyncCommand
            title="批量下载未入库作品"
            description="按本地清单下载尚未入库的作品，写入设置中的同步目录。"
            icon={Database}
            control={<Badge variant={(downloads?.pending ?? 0) > 0 ? "warn" : "mute"}>{downloads?.pending ?? 0} 条待处理</Badge>}
            actionLabel="开始批量下载"
            busy={queueMutation.isPending}
            onClick={() => setPendingMode("download")}
          />
          <SyncCommand
            title="重试失败下载"
            description="只处理之前失败的记录，不影响已经完成的作品。"
            icon={ArrowClockwise}
            control={<Badge variant={(downloads?.failed ?? 0) > 0 ? "halt" : "mute"}>{downloads?.failed ?? 0} 条失败</Badge>}
            actionLabel="重试失败下载"
            busy={queueMutation.isPending}
            onClick={() => setPendingMode("retry")}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[color:var(--chassis-edge)] pb-3">
          <div>
            <CardTitle className="text-base">同步报告</CardTitle>
            <p className="mt-1 text-xs text-[color:var(--text-mute)]">作品清单与本地文件的当前覆盖情况</p>
          </div>
          <Badge variant={reportQuery.isLoading ? "warn" : "signal"}>{reportQuery.isLoading ? "读取中" : "已更新"}</Badge>
        </CardHeader>

        <div className="grid grid-cols-2 border-b border-[color:var(--chassis-edge)] md:grid-cols-3 xl:grid-cols-6">
          <ReportMetric label="作品清单" value={totals?.metadata ?? 0} />
          <ReportMetric label="字幕作品" value={totals?.subtitle ?? 0} />
          <ReportMetric label="无字幕" value={totals?.without_subtitle ?? 0} />
          <ReportMetric label="待下载" value={downloads?.pending ?? 0} />
          <ReportMetric label="已完成" value={downloads?.completed ?? 0} />
          <ReportMetric label="失败" value={downloads?.failed ?? 0} />
        </div>

        <CardContent className="grid gap-0 p-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
          <div className="space-y-4 p-4 xl:border-r xl:border-[color:var(--chassis-edge)]">
            <ProgressTrack label="总体进度" value={progress?.overall ?? 0} running={running} hint="作品清单与下载落地推进情况" />
            <ProgressTrack label="字幕作品进度" value={progress?.with_subtitle ?? 0} running={running} hint="有字幕作品的本地覆盖率" />
            <ProgressTrack label="无字幕作品进度" value={progress?.without_subtitle ?? 0} running={running} hint="其余作品的本地覆盖率" />
          </div>

          <div className="space-y-4 border-t border-[color:var(--chassis-edge)] p-4 xl:border-t-0">
            <div>
              <div className="text-sm font-semibold text-[color:var(--text-display)]">导出同步记录</div>
              <p className="mt-1 text-xs text-[color:var(--text-mute)]">按状态和格式生成诊断文件</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select aria-label="导出记录状态" value={exportStatus} onChange={(event) => setExportStatus(event.target.value as "failed" | "success" | "pending" | "all")}>
                <option value="failed">失败记录</option>
                <option value="success">成功记录</option>
                <option value="pending">待处理记录</option>
                <option value="all">全部记录</option>
              </Select>
              <Select aria-label="导出文件格式" value={exportFormat} onChange={(event) => setExportFormat(event.target.value as "csv" | "json")}>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </Select>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              busy={exportMutation.isPending}
              onClick={() => exportMutation.mutate({ status: exportStatus, format: exportFormat })}
              disabled={exportMutation.isPending}
            >
              <DownloadSimple className="h-4 w-4" weight="duotone" />
              导出记录
            </Button>
            <details className="group border-t border-[color:var(--chassis-edge)] pt-3">
              <summary className="cursor-pointer list-none text-xs font-semibold text-[color:var(--text-body)]">快捷导出</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <QuickExportButton onClick={() => exportMutation.mutate({ status: "failed", format: "csv" })} disabled={exportMutation.isPending} busy={exportMutation.isPending} label="失败 CSV" />
                <QuickExportButton onClick={() => exportMutation.mutate({ status: "failed", format: "json" })} disabled={exportMutation.isPending} busy={exportMutation.isPending} label="失败 JSON" />
                <QuickExportButton onClick={() => exportMutation.mutate({ status: "success", format: "csv" })} disabled={exportMutation.isPending} busy={exportMutation.isPending} label="成功 CSV" />
                <QuickExportButton onClick={() => exportMutation.mutate({ status: "success", format: "json" })} disabled={exportMutation.isPending} busy={exportMutation.isPending} label="成功 JSON" />
              </div>
            </details>
          </div>
        </CardContent>
      </Card>

      <details className="deck-plate group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[color:var(--text-display)]">
          <span>存储与诊断</span>
          <span className="text-xs text-[color:var(--text-mute)] group-open:hidden">展开</span>
          <span className="hidden text-xs text-[color:var(--text-mute)] group-open:inline">收起</span>
        </summary>
        <div className="grid gap-0 border-t border-[color:var(--chassis-edge)] md:grid-cols-3">
          <StorageNote label="作品清单" value=".asmroner-data/asmroner.db" description="metadata_works 表，记录可批量下载的作品元数据。" />
          <StorageNote label="下载记录" value=".asmroner-data/asmroner.db" description="work_sync_infos 表，记录完成、失败和待处理状态。" />
          <div className="border-t border-[color:var(--chassis-edge)] p-4 md:border-l md:border-t-0">
            <div className="text-xs text-[color:var(--text-mute)]">实际文件</div>
            <div className="console-mono mt-2 break-all text-sm font-semibold text-[color:var(--text-display)]">设置中的同步目录</div>
            <p className="mt-2 text-sm leading-5 text-[color:var(--text-body)]">音频、字幕和封面保存在这里。</p>
            <Link to="/settings" className="mt-3 inline-flex text-xs font-semibold text-[color:var(--accent)]">查看同步目录</Link>
          </div>
        </div>
      </details>

      <ActionReviewDialog
        open={pendingMode !== null}
        onOpenChange={(open) => !open && !queueMutation.isPending && setPendingMode(null)}
        title={
          pendingMode === "metadata"
            ? "确认刷新作品清单"
            : pendingMode === "download"
              ? "确认批量下载"
              : "确认重试失败下载"
        }
        description="确认范围后，任务会立即进入后台队列；执行进度可在任务中心查看。"
        rows={[
          {
            label: "操作范围",
            value:
              pendingMode === "metadata"
                ? syncScope === "subtitle" ? "仅带字幕作品" : "全部作品清单"
                : pendingMode === "download"
                  ? `${downloads?.pending ?? 0} 条待处理记录`
                  : `${downloads?.failed ?? 0} 条失败记录`,
          },
          {
            label: "文件影响",
            value: pendingMode === "metadata" ? "只更新数据库，不下载文件" : "写入设置中的同步目录",
          },
        ]}
        warning={pendingMode === "download" ? "批量下载可能占用较多网络流量与磁盘空间，请先核对待处理数量和同步目录。" : undefined}
        confirmLabel="创建后台任务"
        busy={queueMutation.isPending}
        onConfirm={() => pendingMode && queueMutation.mutate(pendingMode)}
      />
    </section>
  );
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function SyncCommand({
  title,
  description,
  icon: Icon,
  onClick,
  actionLabel,
  control,
  busy,
}: {
  title: string;
  description: string;
  icon: Icon;
  onClick: () => void;
  actionLabel: string;
  control?: ReactNode;
  busy?: boolean;
}) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[2rem_minmax(0,1fr)_minmax(11rem,0.45fr)_auto] md:items-center">
      <Icon className="h-5 w-5 text-[color:var(--accent)]" weight="duotone" />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[color:var(--text-display)]">{title}</div>
        <div className="mt-0.5 text-xs leading-5 text-[color:var(--text-mute)]">{description}</div>
      </div>
      <div className="min-w-0">{control}</div>
      <Button size="sm" busy={busy} onClick={onClick} disabled={busy}>
        {actionLabel}
      </Button>
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-r border-[color:var(--chassis-edge)] px-3 py-3 xl:border-b-0">
      <div className="text-xs text-[color:var(--text-mute)]">{label}</div>
      <div className="console-readout mt-1 text-xl">{value.toLocaleString()}</div>
    </div>
  );
}

function StorageNote({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="border-b border-[color:var(--chassis-edge)] p-4 md:border-b-0 md:border-r">
      <div className="text-xs text-[color:var(--text-mute)]">{label}</div>
      <div className="console-mono mt-2 break-all text-sm font-semibold text-[color:var(--text-display)]">
        {value}
      </div>
      <p className="mt-2 text-sm leading-5 text-[color:var(--text-body)]">
        {description}
      </p>
    </div>
  );
}

function QuickExportButton({
  onClick,
  disabled,
  busy,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  busy?: boolean;
  label: string;
}) {
  return (
    <Button variant="secondary" size="sm" busy={busy} onClick={onClick} disabled={disabled}>
      <DownloadSimple className="h-4 w-4" weight="duotone" />
      {label}
    </Button>
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
