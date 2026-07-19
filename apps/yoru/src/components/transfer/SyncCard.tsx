import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { keys } from "@/lib/keys";
import { formatCount } from "@/lib/format";
import { ProgressBar, Skeleton, Sticker } from "@/components/ui";
import { isSyncBusyError } from "./taskDisplay";

type SyncMode = "metadata" | "download" | "retry";

/**
 * 同步卡(原型 dc.html:352-369 的 field 卡范式):
 * 装饰性的 NAS/手机同步目标按 §2 决策替换为真实 /api/sync/report。
 */
export function SyncCard() {
  const queryClient = useQueryClient();

  const reportQuery = useQuery({
    queryKey: keys.sync.report,
    queryFn: () => apiClient.getReport(),
  });

  const queueMutation = useMutation({
    mutationFn: (mode: SyncMode) => {
      if (mode === "metadata") {
        return apiClient.queueSyncMetadata("all");
      }
      if (mode === "download") {
        return apiClient.queueSyncDownload();
      }
      return apiClient.queueSyncRetry();
    },
    onSuccess: () => {
      toast.success("已创建任务");
      queryClient.invalidateQueries({ queryKey: keys.tasks.all });
      queryClient.invalidateQueries({ queryKey: keys.sync.report });
    },
    onError: (error) => {
      if (isSyncBusyError(error)) {
        toast.warning("同步运行中,请稍候");
        return;
      }
      toast.error(`创建任务失败:${error instanceof Error ? error.message : "未知错误"}`);
    },
  });

  const report = reportQuery.data;

  return (
    <section className="y-tr-card" aria-label="同步">
      <Sticker section color="lav" rotate={2}>
        同步 · どうき
      </Sticker>
      <div className="y-tr-head">
        <h2 className="y-tr-title">同步报告</h2>
      </div>

      {reportQuery.isLoading && (
        <div className="y-tr-syncrows">
          <Skeleton variant="row" count={3} />
        </div>
      )}

      {reportQuery.isError && (
        <div className="y-tr-error" role="alert">
          <span>
            同步报告加载失败:
            {reportQuery.error instanceof Error ? reportQuery.error.message : "未知错误"}
          </span>
          <button type="button" className="y-tr-act" onClick={() => void reportQuery.refetch()}>
            重试
          </button>
        </div>
      )}

      {report && (
        <>
          <div className="y-tr-syncrows">
            <SyncRow label="元数据" total={report.totals.metadata} ratio={report.progress.overall} />
            <SyncRow
              label="含字幕"
              total={report.totals.subtitle}
              ratio={report.progress.with_subtitle}
            />
            <SyncRow
              label="无字幕"
              total={report.totals.without_subtitle}
              ratio={report.progress.without_subtitle}
            />
          </div>
          <div className="y-tr-dlstats">
            已完成 {formatCount(report.downloads.completed)} · 失败{" "}
            {formatCount(report.downloads.failed)} · 待下载 {formatCount(report.downloads.pending)}
          </div>
          <div className="y-tr-syncbtns">
            <button
              type="button"
              className="y-btn-ghost"
              disabled={queueMutation.isPending}
              onClick={() => queueMutation.mutate("metadata")}
            >
              同步元数据
            </button>
            <button
              type="button"
              className="y-btn-ghost"
              disabled={queueMutation.isPending}
              onClick={() => queueMutation.mutate("download")}
            >
              按计划下载
            </button>
            <button
              type="button"
              className="y-btn-ghost"
              disabled={queueMutation.isPending}
              onClick={() => queueMutation.mutate("retry")}
            >
              重试失败
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function SyncRow({ label, total, ratio }: { label: string; total: number; ratio: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  return (
    <div className="y-tr-syncrow">
      <div className="y-tr-syncrow__top">
        <span className="y-tr-syncrow__label">{label}</span>
        <span className="y-tr-syncrow__count">{formatCount(total)} 部</span>
      </div>
      <div className="y-tr-syncrow__bar">
        <ProgressBar value={pct} className="y-tr-syncrow__progress" />
        <span className="y-tr-syncrow__pct">{pct}%</span>
      </div>
    </div>
  );
}
