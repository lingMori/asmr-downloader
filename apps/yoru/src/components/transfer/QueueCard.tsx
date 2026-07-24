import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { MusicNote } from "@phosphor-icons/react";
import { toast } from "sonner";
import { apiClient, type Task, type TaskListQuery } from "@/lib/api";
import { keys } from "@/lib/keys";
import { cn } from "@/lib/utils";
import { CoverPlaceholder, ProgressBar, Skeleton, Sticker } from "@/components/ui";
import { DeleteTaskDialog } from "./DeleteTaskDialog";
import {
  ACTIVE_STATUSES,
  coverColorFor,
  describeTask,
  hasActiveTasks,
  RETRYABLE_STATUSES,
  sortTasks,
  statusChip,
  taskPercent,
  TERMINAL_STATUSES,
} from "./taskDisplay";

const QUEUE_FILTER: TaskListQuery = { type: ["download"], page: 1, pageSize: 20 };

/**
 * 下载队列卡(原型 dc.html:327-350):
 * 计数 chips + 任务行(封面/RJ/状态 chip/进度条/操作钮)+ 底部虚线提示。
 * 后端无暂停/继续,操作收敛为 取消/重试/删除(§2 决策表)。
 */
export function QueueCard() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [tasksRef] = useAutoAnimate();

  const tasksQuery = useQuery({
    queryKey: keys.tasks.list(QUEUE_FILTER),
    queryFn: () => apiClient.getTasks(QUEUE_FILTER),
    // SSE 实时补丁为主(TaskRealtimeBridge),5s 兜底仅在还有活动任务时轮询
    refetchInterval: (query) => (hasActiveTasks(query.state.data?.items) ? 5000 : false),
  });
  // 与壳 nav 徽章同源(keys.tasks.summary)
  const summaryQuery = useQuery({
    queryKey: keys.tasks.summary,
    queryFn: () => apiClient.getTaskSummary(),
  });

  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: keys.tasks.all });
    queryClient.invalidateQueries({ queryKey: keys.library.all });
  };

  const cancelMutation = useMutation({
    mutationFn: (id: number) => apiClient.cancelTask(id),
    onSuccess: () => {
      toast.success("已发送取消请求");
      invalidateTasks();
    },
    onError: (error) => {
      toast.error(`取消失败:${error instanceof Error ? error.message : "未知错误"}`);
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => apiClient.retryTask(id),
    onSuccess: () => {
      toast.success("已重新入队");
      invalidateTasks();
    },
    onError: (error) => {
      toast.error(`重试失败:${error instanceof Error ? error.message : "未知错误"}`);
    },
  });

  const summary = summaryQuery.data;
  const tasks = sortTasks(tasksQuery.data?.items ?? []);

  return (
    <section className="y-tr-card y-tr-card--queue" aria-label="下载队列">
      <Sticker section>下载队列 · きゅー</Sticker>
      <div className="y-tr-head">
        <h2 className="y-tr-title">任务</h2>
        {summary && (
          <div className="y-tr-stats">
            <span className="y-tr-stat">
              排队<b>{summary.queued}</b>
            </span>
            <span className="y-tr-stat">
              进行<b>{summary.running}</b>
            </span>
            <span className="y-tr-stat y-tr-stat--ok">
              完成<b>{summary.success}</b>
            </span>
            <span className="y-tr-stat y-tr-stat--bad">
              失败<b>{summary.failed}</b>
            </span>
          </div>
        )}
      </div>

      {tasksQuery.isLoading && (
        <div className="y-tr-tasks">
          <Skeleton variant="row" count={3} />
        </div>
      )}

      {tasksQuery.isError && (
        <div className="y-tr-error" role="alert">
          <span>
            任务列表加载失败:
            {tasksQuery.error instanceof Error ? tasksQuery.error.message : "未知错误"}
          </span>
          <button type="button" className="y-tr-act" onClick={() => void tasksQuery.refetch()}>
            重试
          </button>
        </div>
      )}

      {tasksQuery.isSuccess && (
        <>
          {tasks.length > 0 && (
            <div className="y-tr-tasks" ref={tasksRef}>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onCancel={() => cancelMutation.mutate(task.id)}
                  onRetry={() => retryMutation.mutate(task.id)}
                  onDelete={() => setDeleteTarget(task)}
                  actionPending={cancelMutation.isPending || retryMutation.isPending}
                />
              ))}
            </div>
          )}
          {/* 空队列时这条虚线提示即空态(dc.html:349 文案) */}
          <div className="y-hint y-tr-hint">
            <span className="y-tr-hint__mark">
              <MusicNote size={13} />
            </span>
            <span>去「发现」检索并批量加入队列,完成后会自动匹配字幕。</span>
            <Link to="/discover" className="y-tr-link">
              去发现 →
            </Link>
          </div>
        </>
      )}

      <DeleteTaskDialog task={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </section>
  );
}

function TaskRow({
  task,
  onCancel,
  onRetry,
  onDelete,
  actionPending,
}: {
  task: Task;
  onCancel: () => void;
  onRetry: () => void;
  onDelete: () => void;
  actionPending: boolean;
}) {
  const display = describeTask(task);
  const chip = statusChip(task.status);
  const pct = taskPercent(task);
  const failedWithMessage = task.status === "FAILED" && Boolean(task.message?.trim());

  return (
    <div className="y-tr-task">
      <CoverPlaceholder
        color={coverColorFor(display.rj ?? display.title)}
        label={display.rj ?? "TASK"}
        className="y-tr-task__cover"
      />
      <div className="y-tr-task__main">
        <div className="y-tr-task__top">
          {display.rj && <span className="y-tr-task__rj">{display.rj}</span>}
          <span className={cn("y-tr-chip", `y-tr-chip--${chip.tone}`)}>{chip.label}</span>
        </div>
        <div className="y-tr-task__title">{display.title}</div>
        <div className="y-tr-task__bar">
          <ProgressBar variant="task" value={pct} className="y-tr-task__progress" />
          <span className={cn("y-tr-task__meta", failedWithMessage && "y-tr-task__meta--fail")}>
            {pct}% · {task.message?.trim() || chip.label}
          </span>
        </div>
      </div>
      <div className="y-tr-task__actions">
        {ACTIVE_STATUSES.has(task.status) && (
          <button type="button" className="y-tr-act" disabled={actionPending} onClick={onCancel}>
            取消
          </button>
        )}
        {RETRYABLE_STATUSES.has(task.status) && (
          <button type="button" className="y-tr-act" disabled={actionPending} onClick={onRetry}>
            重试
          </button>
        )}
        {TERMINAL_STATUSES.has(task.status) && (
          <button type="button" className="y-tr-act y-tr-act--danger" onClick={onDelete}>
            删除
          </button>
        )}
      </div>
    </div>
  );
}
