import { SETTINGS_STORAGE_KEY } from "./settings";

export type TaskTerminalEvent = {
  task_id: number;
  status: string;
  message?: string;
};

/**
 * 直接读 localStorage(不走 useSettings Context),供 TaskRealtimeBridge 在
 * react-query 回调里使用,避免 hooks/循环依赖。schema 与 lib/settings.tsx 一致。
 */
export function readNotifyEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed: unknown = JSON.parse(raw);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { notify?: unknown }).notify === true
    );
  } catch {
    return false;
  }
}

/**
 * 任务终态系统通知:仅在 enabled 且权限 granted 且状态为 SUCCESS/FAILED 时弹出。
 * 任何环境不支持/构造异常都静默降级(壳层 toast 体系不在这里重复提示)。
 */
export function notifyTaskTerminal(evt: TaskTerminalEvent, enabled: boolean): void {
  if (!enabled) {
    return;
  }
  if (evt.status !== "SUCCESS" && evt.status !== "FAILED") {
    return;
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  try {
    new Notification(evt.status === "SUCCESS" ? "下载完成" : "任务失败", {
      body: evt.message || `任务 #${evt.task_id}`,
    });
  } catch {
    // 部分环境(如无窗口 iframe)构造 Notification 会抛错,忽略
  }
}
