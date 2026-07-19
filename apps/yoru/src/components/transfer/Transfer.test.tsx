import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import type { Task, TaskListQuery, TaskListResponse } from "@/lib/api";
import { TransferScreen } from "@/routes/screens/Transfer";

vi.mock("@/lib/api", () => ({
  apiClient: {
    getTasks: vi.fn(),
    getTaskSummary: vi.fn(),
    cancelTask: vi.fn(),
    retryTask: vi.fn(),
    deleteTask: vi.fn(),
    getReport: vi.fn(),
    queueSyncMetadata: vi.fn(),
    queueSyncDownload: vi.fn(),
    queueSyncRetry: vi.fn(),
  },
}));

// 空队列提示里的「去发现 →」用到 Link;此处不关心路由跳转,降为 <a>
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { apiClient } from "@/lib/api";

const mocked = vi.mocked(apiClient);

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

const RUNNING = makeTask({
  id: 11,
  name: "Download RJ123456",
  status: "RUNNING",
  progress: 0.62,
  message: "RJ123456 track 3/8",
  payload: '{"mode":"single","ids":["RJ123456"]}',
  updated_at: "2026-07-18T03:00:00Z",
});
const QUEUED = makeTask({
  id: 12,
  name: "Download 2 items",
  status: "QUEUED",
  progress: 0,
  message: "",
  payload: '{"mode":"batch","ids":["RJ111111","RJ222222"]}',
  updated_at: "2026-07-18T02:00:00Z",
});
const FAILED = makeTask({
  id: 13,
  name: "Download RJ333333",
  status: "FAILED",
  progress: 1,
  message: "network timeout",
  payload: '{"mode":"single","ids":["RJ333333"]}',
  updated_at: "2026-07-18T13:00:00Z",
});
const SUCCESS = makeTask({
  id: 14,
  name: "Download RJ444444",
  status: "SUCCESS",
  progress: 1,
  message: "completed 2026-07-18T11:30:00Z",
  payload: '{"mode":"single","ids":["RJ444444"]}',
  result: '{"output_dir":"/data/RJ444444"}',
  completed_at: "2026-07-18T11:30:00Z",
  updated_at: "2026-07-18T11:30:00Z",
});

const REPORT = {
  totals: { metadata: 100, subtitle: 60, without_subtitle: 40 },
  downloads: { completed: 50, failed: 2, pending: 48 },
  progress: { overall: 0.5, with_subtitle: 0.25, without_subtitle: 1 },
};

function taskList(items: Task[]): TaskListResponse {
  return { items, total: items.length, page: 1, size: 20 };
}

/** getTasks 按 filter 分流:带 status=SUCCESS 的是「最近完成」,否则是队列 */
function mockTaskLists(queueItems: Task[], recentItems: Task[]) {
  mocked.getTasks.mockImplementation((params?: TaskListQuery) => {
    if (params?.status) {
      return Promise.resolve(taskList(recentItems));
    }
    return Promise.resolve(taskList(queueItems));
  });
}

function renderTransfer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TransferScreen />
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTaskLists([RUNNING, QUEUED, FAILED, SUCCESS], [SUCCESS]);
  mocked.getTaskSummary.mockResolvedValue({
    total: 4,
    queued: 1,
    running: 1,
    success: 1,
    failed: 1,
    canceled: 0,
    terminated: 0,
  });
  mocked.getReport.mockResolvedValue(REPORT);
  mocked.cancelTask.mockResolvedValue({ canceled: true });
  mocked.retryTask.mockResolvedValue({ code: "ACCEPTED", task_id: 99 });
  mocked.deleteTask.mockResolvedValue({ deleted: true, filesDeleted: 3 });
  mocked.queueSyncMetadata.mockResolvedValue({ code: "ACCEPTED", task_id: 21 });
  mocked.queueSyncDownload.mockResolvedValue({ code: "ACCEPTED", task_id: 22 });
  mocked.queueSyncRetry.mockResolvedValue({ code: "ACCEPTED", task_id: 23 });
});

describe("传输中心 · 下载队列", () => {
  it("渲染任务行:状态 chip 映射 / 进度 meta / 客户端排序 / 计数 chips", async () => {
    const { container } = renderTransfer();

    // 状态 chip 映射
    expect(await screen.findByText("下载中")).toBeInTheDocument();
    expect(screen.getByText("排队中")).toBeInTheDocument();
    expect(screen.getByText("已失败")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();

    // 进度 meta:RUNNING 显示 message;QUEUED message 为空时显示状态文案
    expect(screen.getByText("62% · RJ123456 track 3/8")).toBeInTheDocument();
    expect(screen.getByText("0% · 排队中")).toBeInTheDocument();

    // 失败行 message 粉色小字
    const failMeta = screen.getByText("100% · network timeout");
    expect(failMeta).toHaveClass("y-tr-task__meta--fail");

    // 排序:RUNNING/QUEUED 在前(即使 updated_at 更旧),FAILED 按 updated_at 倒序先于 SUCCESS
    const rows = container.querySelectorAll(".y-tr-task");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("RJ123456");
    expect(rows[1]).toHaveTextContent("RJ111111");
    expect(rows[2]).toHaveTextContent("RJ333333");
    expect(rows[3]).toHaveTextContent("RJ444444");

    // 顶部计数 chips(summary)
    expect(screen.getByText("排队")).toHaveTextContent("1");
    expect(screen.getByText("进行")).toHaveTextContent("1");
    expect(screen.getByText("完成")).toHaveTextContent("1");
    expect(screen.getByText("失败")).toHaveTextContent("1");
  });

  it("取消/重试/删除交互:调对应 API 并弹 toast", async () => {
    renderTransfer();
    await screen.findByText("下载中");

    // 取消(RUNNING 行;mutationFn 异步执行,用 waitFor 等 spy)
    fireEvent.click(screen.getAllByText("取消")[0]);
    await vi.waitFor(() => expect(mocked.cancelTask).toHaveBeenCalledWith(11));
    expect(await screen.findByText("已发送取消请求")).toBeInTheDocument();

    // 重试(FAILED 行)→ 202 toast「已重新入队」
    fireEvent.click(screen.getByText("重试"));
    await vi.waitFor(() => expect(mocked.retryTask).toHaveBeenCalledWith(13));
    expect(await screen.findByText("已重新入队")).toBeInTheDocument();

    // 删除(FAILED 行,终态)→ Dialog 确认 + 勾选「同时删除已下载文件」
    fireEvent.click(screen.getAllByText("删除")[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/RJ333333/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByText("确认删除"));
    await vi.waitFor(() =>
      expect(mocked.deleteTask).toHaveBeenCalledWith(13, { withFiles: true }),
    );
    expect(await screen.findByText("任务已删除 · 清理 3 个文件")).toBeInTheDocument();
  });

  it("空队列显示虚线引导与「去发现」链接", async () => {
    mockTaskLists([], []);
    const { container } = renderTransfer();

    expect(
      await screen.findByText("去「发现」检索并批量加入队列,完成后会自动匹配字幕。"),
    ).toBeInTheDocument();
    expect(screen.getByText("去发现 →").closest("a")).toHaveAttribute("href", "/discover");
    expect(container.querySelectorAll(".y-tr-task")).toHaveLength(0);
    expect(screen.getByText("还没有完成的任务")).toBeInTheDocument();
  });

  it("队列加载失败显示错误条,重试后恢复", async () => {
    mocked.getTasks.mockImplementation((params?: TaskListQuery) => {
      if (params?.status) {
        return Promise.resolve(taskList([SUCCESS]));
      }
      return Promise.reject(new Error("连接被拒"));
    });
    renderTransfer();

    expect(await screen.findByText(/任务列表加载失败/)).toBeInTheDocument();

    mockTaskLists([RUNNING], [SUCCESS]);
    fireEvent.click(screen.getByText("重试", { selector: ".y-tr-error .y-tr-act" }));
    expect(await screen.findByText("下载中")).toBeInTheDocument();
  });
});

describe("传输中心 · 同步卡", () => {
  it("渲染 report 三段进度与下载统计,三钮创建任务", async () => {
    renderTransfer();

    // 三段进度行
    expect(await screen.findByText("元数据")).toBeInTheDocument();
    expect(screen.getByText("100 部")).toBeInTheDocument();
    expect(screen.getByText("60 部")).toBeInTheDocument();
    expect(screen.getByText("40 部")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    // 下载统计行
    expect(screen.getByText("已完成 50 · 失败 2 · 待下载 48")).toBeInTheDocument();

    // 三钮 → 202 toast「已创建任务」(mutationFn 异步执行,waitFor 等 spy)
    fireEvent.click(screen.getByText("同步元数据"));
    await vi.waitFor(() => expect(mocked.queueSyncMetadata).toHaveBeenCalledWith("all"));
    expect(await screen.findAllByText("已创建任务")).not.toHaveLength(0);

    fireEvent.click(screen.getByText("按计划下载"));
    await vi.waitFor(() => expect(mocked.queueSyncDownload).toHaveBeenCalled());

    fireEvent.click(screen.getByText("重试失败"));
    await vi.waitFor(() => expect(mocked.queueSyncRetry).toHaveBeenCalled());
  });

  it("409 SYNC_RUNNER_BUSY → toast.warning 提示稍候", async () => {
    mocked.queueSyncDownload.mockRejectedValue(
      new Error("sync download or retry is already running"),
    );
    renderTransfer();
    await screen.findByText("元数据");

    fireEvent.click(screen.getByText("按计划下载"));
    expect(await screen.findByText("同步运行中,请稍候")).toBeInTheDocument();
  });
});

describe("传输中心 · 最近完成", () => {
  it("渲染完成行:绿点/名称/时间/摘要", async () => {
    const { container } = renderTransfer();

    // 最近完成是独立查询,等它渲染完再断言(队列里的同名任务会先出现)
    await vi.waitFor(() =>
      expect(container.querySelectorAll(".y-tr-done")).toHaveLength(1),
    );
    const row = screen
      .getAllByText(/RJ444444/)
      .find((el) => el.closest(".y-tr-done"));
    expect(row).toBeTruthy();
    expect(container.querySelectorAll(".y-tr-done__dot")).toHaveLength(1);
    // completed 消息无信息量,不出摘要;时间文本存在
    expect(container.querySelector(".y-tr-done__time")?.textContent).toBeTruthy();
  });
});
