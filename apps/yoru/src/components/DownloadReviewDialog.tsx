import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { keys } from "@/lib/keys";
import { Dialog, Sticker } from "@/components/ui";

export type DownloadReviewItem = { sourceId: string; title: string };

export type DownloadReviewDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 本次要下载的作品(1 件=single,多件=batch) */
  items: DownloadReviewItem[];
  /** 输出目录;留空 = 后端默认路径(跟随设置) */
  outputDir?: string;
};

/** 下载复核对话框(原型 dc.html:509-530):确认后创建下载任务 */
export function DownloadReviewDialog({ open, onClose, items, outputDir }: DownloadReviewDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.createDownload({
        mode: items.length === 1 ? "single" : "batch",
        ids: items.map((w) => w.sourceId),
        output_dir: outputDir?.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`已加入传输队列 · ${items.length} 件`);
      queryClient.invalidateQueries({ queryKey: keys.tasks.all });
      queryClient.invalidateQueries({ queryKey: ["works-status"] });
      onClose();
      if (items.length > 1) navigate({ to: "/transfer" });
    },
    onError: (err) => {
      toast.error(`创建下载任务失败:${err instanceof Error ? err.message : "未知错误"}`);
    },
  });

  const scopeText =
    items.length === 1
      ? `${items[0]?.sourceId ?? ""} · ${items[0]?.title ?? ""}`
      : `已选 ${items.length} 件作品`;

  return (
    <Dialog open={open} onClose={onClose} label="下载复核">
      <Sticker>下载复核 · かくにん</Sticker>
      <div className="y-dialog-title">确认创建下载任务</div>
      <div className="y-dialog-desc">
        只会下载下方明确列出的范围,任务创建后可在「传输」中取消或重试。
      </div>
      <div className="y-review-rows">
        <div className="y-review-row">
          <span className="k">下载范围</span>
          <span className="v">{scopeText}</span>
        </div>
        {items.length > 1 && (
          <div className="y-review-row">
            <span className="k">作品编号</span>
            <span className="v" style={{ fontFamily: "ui-monospace,monospace", fontWeight: 500 }}>
              {items.map((w) => w.sourceId).join("、")}
            </span>
          </div>
        )}
        <div className="y-review-row">
          <span className="k">输出目录</span>
          <span className="v" style={{ fontFamily: "ui-monospace,monospace", fontWeight: 500 }}>
            {outputDir?.trim() || "默认路径(跟随设置)"}
          </span>
        </div>
      </div>
      {items.length >= 4 && (
        <div className="y-warn-strip">
          <Warning size={13} weight="fill" /> 该操作可能产生较大的网络流量与磁盘占用。
        </div>
      )}
      <div className="y-dialog-actions">
        <span className="y-btn-ghost" role="button" onClick={onClose}>
          取消
        </span>
        <span
          className="y-btn-primary"
          role="button"
          aria-disabled={mutation.isPending}
          onClick={mutation.isPending ? undefined : () => mutation.mutate()}
        >
          {mutation.isPending ? "创建中…" : "创建下载任务"}
        </span>
      </div>
    </Dialog>
  );
}
