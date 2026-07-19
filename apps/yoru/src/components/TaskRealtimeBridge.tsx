import { useQueryClient } from "@tanstack/react-query";
import type { Task, TaskListResponse } from "@/lib/api";
import { keys } from "@/lib/keys";
import { notifyTaskTerminal, readNotifyEnabled } from "@/lib/notify";
import { useTaskEvents } from "@/lib/useTaskEvents";

type TaskEventPayload = {
  task_id: number;
  status: string;
  message: string;
  progress: number;
  time: string;
};

const terminalStatuses = new Set([
  "SUCCESS",
  "FAILED",
  "CANCELED",
  "TERMINATED",
]);

/**
 * SSE → react-query 桥(自 apps/web 同名组件适配):
 * 共享 EventSource 挂 /api/events;task 事件直接补丁 tasks.list 缓存,
 * 终态失效关联查询(nav 徽章同源 tasks.summary,靠 invalidate 刷新)。
 */
export function TaskRealtimeBridge() {
  const queryClient = useQueryClient();

  useTaskEvents((event) => {
    const payload = parseTaskEvent(event);
    if (!payload) {
      return;
    }

    // 仅补丁 list 缓存(summary 形状不同,走 invalidate)
    queryClient.setQueriesData<TaskListResponse>(
      { queryKey: ["tasks", "list"] },
      (current) => patchTaskList(current, payload),
    );
    queryClient.invalidateQueries({ queryKey: keys.tasks.summary });

    if (terminalStatuses.has(payload.status)) {
      queryClient.invalidateQueries({ queryKey: keys.tasks.all });
      queryClient.invalidateQueries({ queryKey: keys.sync.report });
      queryClient.invalidateQueries({ queryKey: keys.library.all });
      queryClient.invalidateQueries({ queryKey: keys.worksStatus() });
      try {
        // 设置页「系统通知」开关(localStorage)+ 浏览器权限双门槛,内部自行降级
        notifyTaskTerminal(payload, readNotifyEnabled());
      } catch {
        // 通知失败不影响缓存桥
      }
    }
  });

  return null;
}

function parseTaskEvent(event: MessageEvent) {
  try {
    return JSON.parse(event.data) as TaskEventPayload;
  } catch {
    return null;
  }
}

function patchTaskList(
  current: TaskListResponse | undefined,
  payload: TaskEventPayload,
) {
  if (!current) {
    return current;
  }

  return {
    ...current,
    items: current.items.map((task) => patchExistingTask(task, payload)),
  };
}

function patchTask(task: Task | undefined, payload: TaskEventPayload) {
  if (!task || task.id !== payload.task_id) {
    return task;
  }

  return {
    ...task,
    status: payload.status,
    progress: payload.progress,
    message: payload.message,
    updated_at: payload.time,
    started_at:
      payload.status === "RUNNING" ? task.started_at ?? payload.time : task.started_at,
    completed_at: terminalStatuses.has(payload.status)
      ? task.completed_at ?? payload.time
      : task.completed_at,
  };
}

function patchExistingTask(task: Task, payload: TaskEventPayload) {
  return patchTask(task, payload) ?? task;
}
