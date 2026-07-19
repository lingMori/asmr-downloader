import type { CoverColor } from "@/components/ui";
import type { Task } from "@/lib/api";

/** 传输中心纯逻辑:状态映射 / 名称解析 / 排序 / 摘要(单测直接覆盖) */

export const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING"]);
export const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "CANCELED", "TERMINATED"]);
export const RETRYABLE_STATUSES = new Set(["FAILED", "CANCELED", "TERMINATED"]);

export type StatusChipTone = "dim" | "lav" | "ok" | "pink" | "mut";

export type StatusChipSpec = {
  label: string;
  tone: StatusChipTone;
};

/** 状态 → chip(配色公式见 transfer.css .y-tr-chip--*,dc.html:664) */
export function statusChip(status: string): StatusChipSpec {
  switch (status) {
    case "QUEUED":
      return { label: "排队中", tone: "dim" };
    case "RUNNING":
      return { label: "下载中", tone: "lav" };
    case "SUCCESS":
      return { label: "已完成", tone: "ok" };
    case "FAILED":
      return { label: "已失败", tone: "pink" };
    case "CANCELED":
      return { label: "已取消", tone: "mut" };
    case "TERMINATED":
      return { label: "已中断", tone: "mut" };
    default:
      return { label: status || "未知", tone: "mut" };
  }
}

/** 作品编号模式(与旧前端 parseDirectIDs 同源) */
const WORK_ID_PATTERN = /^(RJ|VJ|BJ|AJ|CJ|DL|NP|AL|KN)\d+$/i;
const WORK_ID_IN_TEXT = /\b((?:RJ|VJ|BJ|AJ|CJ|DL|NP|AL|KN)\d+)\b/i;

export function parseTaskPayload(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // 落回空对象
  }
  return {};
}

/** payload.ids 中的作品编号(大写、去重、保持顺序) */
export function taskWorkIds(task: Task): string[] {
  const ids = parseTaskPayload(task.payload).ids;
  if (!Array.isArray(ids)) {
    return [];
  }
  return Array.from(
    new Set(
      ids
        .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
        .filter((item) => WORK_ID_PATTERN.test(item)),
    ),
  );
}

export type TaskDisplay = {
  /** mono RJ 编号(无则 undefined) */
  rj?: string;
  /** 可读标题 */
  title: string;
};

/**
 * 任务显示名:RJ 优先取 payload.ids[0],退化到 name 内嵌编号;
 * 标题取 name,剥掉后端兜底名的 "Download " 前缀并中文化已知模式
 * (download_service.go:88-95 的 hot100/batch/single 兜底文案)。
 */
export function describeTask(task: Task): TaskDisplay {
  const payload = parseTaskPayload(task.payload);
  const ids = taskWorkIds(task);
  const fromName = (task.name ?? "").match(WORK_ID_IN_TEXT)?.[1];
  const rj = (ids[0] ?? fromName)?.toUpperCase();

  const rawName = (task.name ?? "").trim();
  const customName = typeof payload.name === "string" ? payload.name.trim() : "";
  let title = rawName || customName;

  const stripped = title.replace(/^download\s+/i, "").trim();
  if (/^hot\s*\d+$/i.test(stripped)) {
    const count = typeof payload.count === "number" ? payload.count : stripped.replace(/\D+/g, "");
    title = `Hot100 热门 ${count} 部`;
  } else if (/^\d+\s+items?$/i.test(stripped)) {
    title = `批量下载 · ${ids.length || stripped.replace(/\D+/g, "")} 件`;
  } else {
    title = stripped;
  }

  if (!title) {
    title = rj ?? `任务 #${task.id}`;
  }
  return { rj, title };
}

/** 客户端排序:RUNNING/QUEUED 在前,其余按 updated_at 倒序(同组内亦倒序) */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aActive = ACTIVE_STATUSES.has(a.status) ? 0 : 1;
    const bActive = ACTIVE_STATUSES.has(b.status) ? 0 : 1;
    if (aActive !== bActive) {
      return aActive - bActive;
    }
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  });
}

/** 最近完成:completed_at(退化 updated_at)倒序 */
export function sortRecentTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) =>
    (b.completed_at ?? b.updated_at ?? "").localeCompare(a.completed_at ?? a.updated_at ?? ""),
  );
}

export function hasActiveTasks(tasks?: Task[]): boolean {
  return Boolean(tasks?.some((task) => ACTIVE_STATUSES.has(task.status)));
}

/** 进度 0-1 → 0-100 整数 */
export function taskPercent(task: Task): number {
  const value = Number.isFinite(task.progress) ? task.progress : 0;
  return Math.min(100, Math.max(0, Math.round(value * 100)));
}

/** 最近完成摘要小字:result.error 优先,其次非常规 message(后端成功消息为 "completed <ts>",无信息量) */
export function resultSummary(task: Task): string {
  const result = parseTaskPayload(task.result);
  if (typeof result.error === "string" && result.error.trim()) {
    return result.error.trim();
  }
  const message = (task.message ?? "").trim();
  if (message && !/^completed\b/i.test(message)) {
    return message;
  }
  return "";
}

/** 409 SYNC_RUNNER_BUSY:apiClient 只透传 message,按文案识别(兼容 code 透出) */
export function isSyncBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /SYNC_RUNNER_BUSY|already running|busy/i.test(message);
}

const COVER_COLORS: CoverColor[] = ["lav", "rose", "blue", "plum"];

/** 名称 hash → 封面占位 4 色(稳定) */
export function coverColorFor(seed: string): CoverColor {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
}
