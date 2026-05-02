import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowClockwise, Database, DownloadSimple } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
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
      toast.success(`已创建${label}任务 #${res.task_id}`);
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

  const running = queueMutation.isPending;
  const progress = reportQuery.data?.progress;
  const totals = reportQuery.data?.totals;
  const downloads = reportQuery.data?.downloads;
  const pipePercent = Math.round((progress?.overall ?? 0) * 100);

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
          title="同步舱与批量任务"
          description="把元数据同步、批量下载和失败重试收进磁带复制工作站。来源机、目标机和传输管道会一起显示当前库存推进。"
          meta={
            <div className="deck-screen min-w-[13rem] p-4">
              <Badge variant={running ? "live" : "warn"}>同步中心</Badge>
              <div className="console-readout mt-3 text-2xl">{pipePercent}%</div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 lg:grid-cols-3">
        <ActionCard
          title="元数据同步"
          description="从远端刷新作品索引。适合先让资料库跟上最新状态。"
          icon={ArrowClockwise}
          busy={queueMutation.isPending}
          onClick={() => queueMutation.mutate("metadata")}
          panelSlot={
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
          icon={Database}
          busy={queueMutation.isPending}
          onClick={() => queueMutation.mutate("download")}
        />
        <ActionCard
          title="失败重试"
          description="把失败任务重新拉回轨道，避免库存断层。"
          icon={ArrowClockwise}
          busy={queueMutation.isPending}
          onClick={() => queueMutation.mutate("retry")}
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-[1.15fr_0.95fr]">
        <Card foil={running}>
          <CardHeader>
            <CardTitle>磁带传输管道</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <MachineDeck label="REMOTE INDEX" value={totals?.metadata ?? 0} icon={<Database className="h-8 w-8" weight="duotone" />} />
              <TransferPipe running={running} percent={pipePercent} />
              <MachineDeck label="LOCAL ARCHIVE" value={downloads?.completed ?? 0} icon={<DownloadSimple className="h-8 w-8" weight="duotone" />} />
            </div>
            <ProgressTrack
              label="总体进度"
              value={progress?.overall ?? 0}
              running={running}
              hint="整体元数据与下载落地推进情况"
            />
            <ProgressTrack
              label="字幕作品进度"
              value={progress?.with_subtitle ?? 0}
              running={running}
              hint="适合优先保证可读性较高的作品库存"
            />
            <ProgressTrack
              label="无字幕作品进度"
              value={progress?.without_subtitle ?? 0}
              running={running}
              hint="补全库存的尾段通常会落在这里"
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="元数据作品数"
            value={totals?.metadata ?? 0}
            icon={<ArrowClockwise className="h-5 w-5" weight="duotone" />}
          />
          <StatCard
            label="字幕作品数"
            value={totals?.subtitle ?? 0}
            icon={<DownloadSimple className="h-5 w-5" weight="duotone" />}
          />
          <StatCard
            label="无字幕作品数"
            value={totals?.without_subtitle ?? 0}
            icon={<Database className="h-5 w-5" weight="duotone" />}
          />
          <StatCard
            label="待下载"
            value={downloads?.pending ?? 0}
            icon={<ArrowClockwise className="h-5 w-5" weight="duotone" />}
          />
          <StatCard
            label="已完成下载"
            value={downloads?.completed ?? 0}
            icon={<DownloadSimple className="h-5 w-5" weight="duotone" />}
            className="sm:col-span-2"
          />
          <StatCard
            label="失败下载"
            value={downloads?.failed ?? 0}
            icon={<Database className="h-5 w-5" weight="duotone" />}
            className="sm:col-span-2"
          />
        </div>
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <Card>
          <CardHeader>
            <CardTitle>同步导出</CardTitle>
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
                busy={exportMutation.isPending}
                onClick={() =>
                  exportMutation.mutate({
                    status: exportStatus,
                    format: exportFormat,
                  })
                }
                disabled={exportMutation.isPending}
              >
                <DownloadSimple className="h-4 w-4" weight="duotone" />
                导出当前选择
              </Button>
            </div>

            <div className="flex flex-wrap gap-3">
              <QuickExportButton
                onClick={() => exportMutation.mutate({ status: "failed", format: "csv" })}
                disabled={exportMutation.isPending}
                busy={exportMutation.isPending}
                label="失败 CSV"
              />
              <QuickExportButton
                onClick={() => exportMutation.mutate({ status: "failed", format: "json" })}
                disabled={exportMutation.isPending}
                busy={exportMutation.isPending}
                label="失败 JSON"
              />
              <QuickExportButton
                onClick={() => exportMutation.mutate({ status: "success", format: "csv" })}
                disabled={exportMutation.isPending}
                busy={exportMutation.isPending}
                label="成功 CSV"
              />
              <QuickExportButton
                onClick={() => exportMutation.mutate({ status: "success", format: "json" })}
                disabled={exportMutation.isPending}
                busy={exportMutation.isPending}
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
  panelSlot,
  busy,
}: {
  title: string;
  description: string;
  icon: Icon;
  onClick: () => void;
  panelSlot?: ReactNode;
  busy?: boolean;
}) {
  return (
    <Card interactive foil className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="console-title text-xl font-black text-[color:var(--text-display)]">{title}</div>
            <div className="text-sm leading-6 text-[color:var(--text-body)]">{description}</div>
          </div>
          <span className="deck-screen flex h-12 w-12 items-center justify-center text-[color:var(--phosphor-primary)]">
            <Icon className="h-5 w-5" weight="duotone" />
          </span>
        </div>
        {panelSlot}
        <Button className="mt-auto w-full" busy={busy} onClick={onClick} disabled={busy}>
          执行操作
        </Button>
      </CardContent>
    </Card>
  );
}

function MachineDeck({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="deck-screen p-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center text-[color:var(--telltale-amber)]">
        {icon}
      </div>
      <div className="deck-decal mt-3 justify-center">{label}</div>
      <div className="console-readout mt-4 text-3xl">{value}</div>
    </div>
  );
}

function TransferPipe({ running, percent }: { running: boolean; percent: number }) {
  return (
    <div className="min-w-[9rem]">
      <div className="mascot-progress grid-cols-[34px_minmax(0,1fr)_34px]">
        <div className="tape-reel" data-running={running ? "true" : undefined} />
        <div className="tape-track" data-running={running ? "true" : undefined}>
          <div className="tape-track__fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="tape-reel" data-running={running ? "true" : undefined} />
      </div>
      <div className="console-mono mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-mute)]">
        TAPE BUS
      </div>
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
    <Button variant="secondary" busy={busy} onClick={onClick} disabled={disabled}>
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
