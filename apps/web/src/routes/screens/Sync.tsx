import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
  RouteFeedback,
  StatCard,
  fadeUpItem,
  staggerContainer,
} from "@/components/ui/sweet";
import { apiClient } from "@/lib/api";

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
    <motion.section
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="同步"
          title="同步与批量下载"
          description="刷新作品清单，批量下载未入库作品，或重试失败记录。"
          meta={
            <div className="deck-screen min-w-[13rem] p-4">
              <Badge variant={running ? "live" : "warn"}>整体进度</Badge>
              <div className="console-readout mt-3 text-2xl">{pipePercent}%</div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 lg:grid-cols-3">
        <ActionCard
          title="刷新作品清单"
          description="更新作品标题、标签、声优、字幕标记等元数据，写入本地数据库；不会下载音频文件。"
          icon={ArrowClockwise}
          actionLabel="刷新清单"
          busy={queueMutation.isPending}
          onClick={() => queueMutation.mutate("metadata")}
          panelSlot={
            <Select
              value={syncScope}
              onChange={(event) =>
                setSyncScope(event.target.value as "all" | "subtitle")
              }
            >
              <option value="all">全部作品清单</option>
              <option value="subtitle">仅带字幕作品</option>
            </Select>
          }
        />
        <ActionCard
          title="批量下载未入库作品"
          description="根据本地作品清单下载尚未入库的作品，文件会保存到设置里的同步目录。"
          icon={Database}
          actionLabel="开始批量下载"
          busy={queueMutation.isPending}
          onClick={() => queueMutation.mutate("download")}
        />
        <ActionCard
          title="重试失败下载"
          description="只重新处理之前失败的下载记录，不会影响已经完成的作品。"
          icon={ArrowClockwise}
          actionLabel="重试失败下载"
          busy={queueMutation.isPending}
          onClick={() => queueMutation.mutate("retry")}
        />
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <Card>
          <CardHeader>
            <CardTitle>数据存放位置</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <StorageNote
              label="作品清单"
              value=".asmroner-data/asmroner.db"
              description="对应数据库表 metadata_works，用来记录可批量下载的作品元数据。"
            />
            <StorageNote
              label="下载记录"
              value=".asmroner-data/asmroner.db"
              description="对应数据库表 work_sync_infos，用来判断哪些作品已完成、失败或待处理。"
            />
            <div className="deck-screen p-4">
              <div className="deck-decal">实际文件</div>
              <div className="console-mono mt-3 break-all text-sm font-bold text-[color:var(--text-display)]">
                设置里的同步目录
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--text-body)]">
                下载后的音频、字幕和封面保存在这里，可在设置页查看或修改。
              </p>
              <Link
                to="/settings"
                className="deck-button-secondary mt-4 inline-flex h-[34px] items-center justify-center border px-3 text-xs font-bold"
              >
                查看同步目录
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-[1.15fr_0.95fr]">
        <Card foil={running}>
          <CardHeader>
            <CardTitle>同步进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <MachineDeck
                label="本地作品清单"
                value={totals?.metadata ?? 0}
                icon={<Database className="h-8 w-8" weight="duotone" />}
              />
              <TransferPipe running={running} percent={pipePercent} />
              <MachineDeck
                label="本地已下载"
                value={downloads?.completed ?? 0}
                icon={<DownloadSimple className="h-8 w-8" weight="duotone" />}
              />
            </div>
            <ProgressTrack
              label="总体进度"
              value={progress?.overall ?? 0}
              running={running}
              hint="作品清单与下载落地推进情况"
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
            label="作品清单总数"
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
            label="待批量下载"
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
            label="失败记录"
            value={downloads?.failed ?? 0}
            icon={<Database className="h-5 w-5" weight="duotone" />}
            className="sm:col-span-2"
          />
        </div>
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <Card>
          <CardHeader>
            <CardTitle>导出同步记录</CardTitle>
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
                导出记录
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

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function ActionCard({
  title,
  description,
  icon: Icon,
  onClick,
  actionLabel,
  panelSlot,
  busy,
}: {
  title: string;
  description: string;
  icon: Icon;
  onClick: () => void;
  actionLabel: string;
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
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
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
    <div className="deck-screen p-4">
      <div className="deck-decal">{label}</div>
      <div className="console-mono mt-3 break-all text-sm font-bold text-[color:var(--text-display)]">
        {value}
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--text-body)]">
        {description}
      </p>
    </div>
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
        同步通道
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
