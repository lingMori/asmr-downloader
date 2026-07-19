import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyTaskTerminal, readNotifyEnabled } from "./notify";
import { SETTINGS_STORAGE_KEY } from "./settings";

const calls: { title: string; body?: string }[] = [];

class MockNotification {
  static permission: string = "granted";
  constructor(title: string, options?: { body?: string }) {
    calls.push({ title, body: options?.body });
  }
}

describe("notify", () => {
  beforeEach(() => {
    calls.length = 0;
    window.localStorage.clear();
    MockNotification.permission = "granted";
    vi.stubGlobal("Notification", MockNotification);
  });

  it("enabled + granted + SUCCESS → 弹「下载完成」", () => {
    notifyTaskTerminal({ task_id: 3, status: "SUCCESS", message: "RJ123 全部曲目完成" }, true);
    expect(calls).toEqual([{ title: "下载完成", body: "RJ123 全部曲目完成" }]);
  });

  it("FAILED 且无 message → body 回退为任务号", () => {
    notifyTaskTerminal({ task_id: 7, status: "FAILED", message: "" }, true);
    expect(calls).toEqual([{ title: "任务失败", body: "任务 #7" }]);
  });

  it("disabled / 权限不足 / 非终态 → 不弹", () => {
    notifyTaskTerminal({ task_id: 1, status: "SUCCESS", message: "x" }, false);
    expect(calls).toHaveLength(0);

    MockNotification.permission = "denied";
    notifyTaskTerminal({ task_id: 1, status: "SUCCESS", message: "x" }, true);
    expect(calls).toHaveLength(0);

    MockNotification.permission = "granted";
    notifyTaskTerminal({ task_id: 1, status: "CANCELED", message: "x" }, true);
    notifyTaskTerminal({ task_id: 1, status: "RUNNING", message: "x" }, true);
    expect(calls).toHaveLength(0);
  });

  it("readNotifyEnabled 读 localStorage schema", () => {
    expect(readNotifyEnabled()).toBe(false);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ notify: true }));
    expect(readNotifyEnabled()).toBe(true);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, "{not json");
    expect(readNotifyEnabled()).toBe(false);
  });
});
