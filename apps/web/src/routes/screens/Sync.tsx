import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCcw, RotateCcw, ServerCrash } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  PageHeader,
  ProgressTrack,
  StatCard,
  fadeUpItem,
  staggerContainer,
} from "@/components/ui/sweet";
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
    <motion.section
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="Sync"
          title="同步编队与批量下载"
          description="把元数据同步、批量下载和失败重试收进统一的编队面板。你可以在这里先看赛道进度，再决定下一步让哪支队伍出击。"
          meta={
            <div className="space-y-3 rounded-[1.8rem] border border-white/40 bg-white/45 p-4 shadow-[0_16px_34px_rgba(255,182,193,0.12)]">
              <Badge variant="violet">同步中心</Badge>
              <div className="text-sm text-[color:var(--text-body)]">
                总体进度 {Math.round((reportQuery.data?.progress.overall ?? 0) * 100)}%
              </div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 lg:grid-cols-3">
        <ActionCard
          title="元数据同步"
          description="从远端刷新作品索引。适合先让资料库跟上最新状态。"
          icon={RefreshCcw}
          accentClassName="from-amber-300 to-rose-300"
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
          description="批量抓取同步清单里尚未下载的作品。"
          icon={ServerCrash}
          accentClassName="from-sky-300 to-violet-300"
          onClick={() => queueMutation.mutate("download")}
        />
        <ActionCard
          title="失败重试"
          description="把失败任务重新拉回轨道，避免库存断层。"
          icon={RotateCcw}
          accentClassName="from-emerald-300 to-cyan-300"
          onClick={() => queueMutation.mutate("retry")}
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-[1.15fr_0.95fr]">
        <Card foil className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">同步赛道</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ProgressTrack
              label="总体进度"
              value={reportQuery.data?.progress.overall ?? 0}
              mascot="🐾"
              hint="整体元数据与下载落地推进情况"
            />
            <ProgressTrack
              label="字幕作品进度"
              value={reportQuery.data?.progress.withSubtitle ?? 0}
              mascot="🎧"
              hint="适合优先保证可读性较高的作品库存"
            />
            <ProgressTrack
              label="无字幕作品进度"
              value={reportQuery.data?.progress.withoutSubtitle ?? 0}
              mascot="📦"
              hint="补全库存的尾段通常会落在这里"
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="元数据作品数"
            value={reportQuery.data?.totals.metadata ?? 0}
            icon={<RefreshCcw className="h-5 w-5" />}
            accentClassName="from-amber-300 to-rose-300"
          />
          <StatCard
            label="字幕作品数"
            value={reportQuery.data?.totals.subtitle ?? 0}
            icon={<Download className="h-5 w-5" />}
            accentClassName="from-sky-300 to-violet-300"
          />
          <StatCard
            label="无字幕作品数"
            value={reportQuery.data?.totals.withoutSubtitle ?? 0}
            icon={<ServerCrash className="h-5 w-5" />}
            accentClassName="from-violet-300 to-fuchsia-300"
          />
          <StatCard
            label="待下载"
            value={reportQuery.data?.downloads.pending ?? 0}
            icon={<RotateCcw className="h-5 w-5" />}
            accentClassName="from-emerald-300 to-cyan-300"
          />
          <StatCard
            label="已完成下载"
            value={reportQuery.data?.downloads.completed ?? 0}
            icon={<Download className="h-5 w-5" />}
            accentClassName="from-emerald-300 to-teal-300"
            className="sm:col-span-2"
          />
          <StatCard
            label="失败下载"
            value={reportQuery.data?.downloads.failed ?? 0}
            icon={<ServerCrash className="h-5 w-5" />}
            accentClassName="from-rose-300 to-pink-300"
            className="sm:col-span-2"
          />
        </div>
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">同步导出</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
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
                <Download className="h-4 w-4" />
                导出当前选择
              </Button>
            </div>

            <div className="flex flex-wrap gap-3">
              <QuickExportButton
                onClick={() => exportMutation.mutate({ status: "failed", format: "csv" })}
                disabled={exportMutation.isPending}
                label="失败 CSV"
              />
              <QuickExportButton
                onClick={() => exportMutation.mutate({ status: "failed", format: "json" })}
                disabled={exportMutation.isPending}
                label="失败 JSON"
              />
              <QuickExportButton
                onClick={() => exportMutation.mutate({ status: "success", format: "csv" })}
                disabled={exportMutation.isPending}
                label="成功 CSV"
              />
              <QuickExportButton
                onClick={() => exportMutation.mutate({ status: "success", format: "json" })}
                disabled={exportMutation.isPending}
                label="成功 JSON"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.section>
  );
}

function ActionCard({
  title,
  description,
  icon: Icon,
  onClick,
  controls,
  accentClassName,
}: {
  title: string;
  description: string;
  icon: typeof RefreshCcw;
  onClick: () => void;
  controls?: ReactNode;
  accentClassName: string;
}) {
  return (
    <Card interactive foil className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-[color:var(--text-body)]">{title}</div>
            <div className="text-sm leading-6 text-[color:var(--text-muted)]">{description}</div>
          </div>
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_14px_26px_rgba(255,182,193,0.22)] ${accentClassName}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        </div>
        {controls}
        <Button className="mt-auto w-full" onClick={onClick}>
          执行操作
        </Button>
      </CardContent>
    </Card>
  );
}

function QuickExportButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={disabled}>
      <Download className="h-4 w-4" />
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
