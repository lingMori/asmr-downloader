import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, type Task } from "@/lib/api";
import { keys } from "@/lib/keys";
import { cn } from "@/lib/utils";
import { Dialog, Sticker } from "@/components/ui";
import { describeTask, statusChip } from "./taskDisplay";

export type DeleteTaskDialogProps = {
  /** null = 关闭 */
  task: Task | null;
  onClose: () => void;
};

/**
 * 删除任务确认对话框(原型缺失,按下载复核对话框同范式补):
 * download 类任务可选「同时删除已下载文件」。
 */
export function DeleteTaskDialog({ task, onClose }: DeleteTaskDialogProps) {
  const queryClient = useQueryClient();
  const [withFiles, setWithFiles] = useState(false);

  // 每次换任务/重开时复位勾选
  useEffect(() => {
    setWithFiles(false);
  }, [task?.id]);

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteFiles }: { id: number; deleteFiles: boolean }) =>
      apiClient.deleteTask(id, { withFiles: deleteFiles }),
    onSuccess: (res) => {
      toast.success(
        res.filesDeleted ? `任务已删除 · 清理 ${res.filesDeleted} 个文件` : "任务已删除",
      );
      queryClient.invalidateQueries({ queryKey: keys.tasks.all });
      queryClient.invalidateQueries({ queryKey: keys.library.all });
      onClose();
    },
    onError: (error) => {
      toast.error(`删除失败:${error instanceof Error ? error.message : "未知错误"}`);
    },
  });

  const display = task ? describeTask(task) : null;
  const chip = task ? statusChip(task.status) : null;
  const isDownload = task?.type === "download";

  return (
    <Dialog open={task !== null} onClose={onClose} label="删除任务">
      <Sticker>删除任务 · さくじょ</Sticker>
      <div className="y-dialog-title">确认删除这条任务记录?</div>
      <div className="y-dialog-desc">
        默认只删除任务记录与日志;勾选后会连同已下载文件一并清理,不可恢复。
      </div>
      {task && display && chip && (
        <div className="y-review-rows">
          <div className="y-review-row">
            <span className="k">任务</span>
            <span className="v">
              {display.rj ? `${display.rj} · ` : ""}
              {display.title}
            </span>
          </div>
          <div className="y-review-row">
            <span className="k">状态</span>
            <span className="v">{chip.label}</span>
          </div>
        </div>
      )}
      {isDownload && (
        <button
          type="button"
          role="checkbox"
          aria-checked={withFiles}
          className="y-tr-check"
          onClick={() => setWithFiles((value) => !value)}
        >
          <span className={cn("y-checkbox", withFiles && "is-on")}>{withFiles ? "✓" : ""}</span>
          同时删除已下载文件
        </button>
      )}
      <div className="y-dialog-actions">
        <button type="button" className="y-btn-ghost" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="y-tr-btn-danger"
          disabled={deleteMutation.isPending}
          onClick={() =>
            task && deleteMutation.mutate({ id: task.id, deleteFiles: isDownload && withFiles })
          }
        >
          {deleteMutation.isPending ? "删除中…" : "确认删除"}
        </button>
      </div>
    </Dialog>
  );
}
