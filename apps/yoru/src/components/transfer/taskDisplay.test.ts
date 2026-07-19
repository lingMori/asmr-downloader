import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/api";
import {
  coverColorFor,
  describeTask,
  hasActiveTasks,
  isSyncBusyError,
  resultSummary,
  sortTasks,
  statusChip,
  taskPercent,
} from "./taskDisplay";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    name: "",
    type: "download",
    status: "QUEUED",
    progress: 0,
    message: "",
    payload: "",
    result: "",
    ...overrides,
  };
}

describe("statusChip 状态映射", () => {
  it("六态映射到对应中文与色调", () => {
    expect(statusChip("QUEUED")).toEqual({ label: "排队中", tone: "dim" });
    expect(statusChip("RUNNING")).toEqual({ label: "下载中", tone: "lav" });
    expect(statusChip("SUCCESS")).toEqual({ label: "已完成", tone: "ok" });
    expect(statusChip("FAILED")).toEqual({ label: "已失败", tone: "pink" });
    expect(statusChip("CANCELED")).toEqual({ label: "已取消", tone: "mut" });
    expect(statusChip("TERMINATED")).toEqual({ label: "已中断", tone: "mut" });
  });

  it("未知状态原样显示且 tone 为 mut", () => {
    expect(statusChip("WHATEVER")).toEqual({ label: "WHATEVER", tone: "mut" });
  });
});

describe("describeTask 名称解析", () => {
  it("single:payload.ids 提供 mono RJ,标题剥掉 Download 前缀", () => {
    const task = makeTask({
      name: "Download RJ123456",
      payload: '{"mode":"single","ids":["rj123456"],"count":0,"output_dir":"","name":""}',
    });
    expect(describeTask(task)).toEqual({ rj: "RJ123456", title: "RJ123456" });
  });

  it("batch:后端兜底名 'Download N items' 中文化,ids 计数", () => {
    const task = makeTask({
      name: "Download 2 items",
      payload: '{"mode":"batch","ids":["RJ111111","RJ222222"]}',
    });
    expect(describeTask(task)).toEqual({ rj: "RJ111111", title: "批量下载 · 2 件" });
  });

  it("hot100:后端兜底名 'Download hot N' 中文化", () => {
    const task = makeTask({
      name: "Download hot 10",
      payload: '{"mode":"hot100","count":10}',
    });
    expect(describeTask(task)).toEqual({ rj: undefined, title: "Hot100 热门 10 部" });
  });

  it("payload 缺失时从 name 提取编号;全空时退回任务 id", () => {
    expect(describeTask(makeTask({ name: "手动下载 RJ998877" })).rj).toBe("RJ998877");
    expect(describeTask(makeTask({ id: 42 })).title).toBe("任务 #42");
  });

  it("坏 payload JSON 不炸", () => {
    expect(describeTask(makeTask({ name: "x", payload: "{oops" })).title).toBe("x");
  });
});

describe("sortTasks 队列排序", () => {
  it("RUNNING/QUEUED 在前,其余按 updated_at 倒序", () => {
    const tasks = [
      makeTask({ id: 1, status: "SUCCESS", updated_at: "2026-07-18T12:00:00Z" }),
      makeTask({ id: 2, status: "RUNNING", updated_at: "2026-07-18T01:00:00Z" }),
      makeTask({ id: 3, status: "FAILED", updated_at: "2026-07-18T13:00:00Z" }),
      makeTask({ id: 4, status: "QUEUED", updated_at: "2026-07-18T02:00:00Z" }),
    ];
    expect(sortTasks(tasks).map((t) => t.id)).toEqual([4, 2, 3, 1]);
  });
});

describe("杂项辅助", () => {
  it("hasActiveTasks 只在含 QUEUED/RUNNING 时为真", () => {
    expect(hasActiveTasks([makeTask({ status: "RUNNING" })])).toBe(true);
    expect(hasActiveTasks([makeTask({ status: "SUCCESS" })])).toBe(false);
    expect(hasActiveTasks(undefined)).toBe(false);
  });

  it("taskPercent 0-1 → 百分比并钳制", () => {
    expect(taskPercent(makeTask({ progress: 0.625 }))).toBe(63);
    expect(taskPercent(makeTask({ progress: 2 }))).toBe(100);
    expect(taskPercent(makeTask({ progress: Number.NaN }))).toBe(0);
  });

  it("resultSummary:后端 'completed <ts>' 不显示,其他 message 显示", () => {
    expect(
      resultSummary(makeTask({ message: "completed 2026-07-18T00:00:00Z" })),
    ).toBe("");
    expect(resultSummary(makeTask({ message: "字幕匹配完成" }))).toBe("字幕匹配完成");
    expect(
      resultSummary(makeTask({ result: '{"error":"磁盘已满"}', message: "" })),
    ).toBe("磁盘已满");
  });

  it("isSyncBusyError 识别 409 文案与 code", () => {
    expect(isSyncBusyError(new Error("sync download or retry is already running"))).toBe(true);
    expect(isSyncBusyError(new Error("SYNC_RUNNER_BUSY"))).toBe(true);
    expect(isSyncBusyError(new Error("network error"))).toBe(false);
  });

  it("coverColorFor 稳定且在 4 色内", () => {
    const colors = new Set(["lav", "rose", "blue", "plum"]);
    expect(colors.has(coverColorFor("RJ123456"))).toBe(true);
    expect(coverColorFor("RJ123456")).toBe(coverColorFor("RJ123456"));
  });
});
