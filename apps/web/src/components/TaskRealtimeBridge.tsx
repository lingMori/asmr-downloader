import { useQueryClient } from "@tanstack/react-query";
import type { Task, TaskListResponse } from "@/lib/api";
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

export function TaskRealtimeBridge() {
  const queryClient = useQueryClient();

  useTaskEvents((event) => {
    const payload = parseTaskEvent(event);
    if (!payload) {
      return;
    }

    queryClient.setQueriesData<TaskListResponse>(
      { queryKey: ["tasks"] },
      (current) => patchTaskList(current, payload),
    );
    queryClient.setQueryData<TaskListResponse>(["dashboard", "tasks"], (current) =>
      patchTaskList(current, payload),
    );
    queryClient.setQueryData<Task>(["task", payload.task_id], (current) =>
      patchTask(current, payload),
    );

    queryClient.invalidateQueries({ queryKey: ["task", payload.task_id] });

    if (terminalStatuses.has(payload.status)) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["sync", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "report"] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "library"] });
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
    updatedAt: payload.time,
    startedAt:
      payload.status === "RUNNING" ? task.started_at ?? payload.time : task.started_at,
    completedAt: terminalStatuses.has(payload.status)
      ? task.completed_at ?? payload.time
      : task.completed_at,
  };
}

function patchExistingTask(task: Task, payload: TaskEventPayload) {
  return patchTask(task, payload) ?? task;
}
