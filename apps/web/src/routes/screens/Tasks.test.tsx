import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Queue } from "./Queue";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(apiClient, "getTaskSummary").mockResolvedValue({
    total: 0,
    queued: 0,
    running: 0,
    success: 0,
    failed: 0,
    canceled: 0,
    terminated: 0,
  });
});

describe("Tasks screen", () => {
  it("renders loading state", () => {
    vi.spyOn(apiClient, "getTasks").mockImplementation(
      () => new Promise(() => {}),
    );

    const queryClient = new QueryClient();
    const view = render(
      <QueryClientProvider client={queryClient}>
        <Queue />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/正在读取任务列表/i)).toBeInTheDocument();
    view.unmount();
    queryClient.clear();
  });

  it("shows retry and delete actions for a selected task", async () => {
    vi.spyOn(apiClient, "getTasks").mockResolvedValue({
      items: [
        {
          id: 7,
          name: "Failed sync",
          type: "sync",
          status: "FAILED",
          progress: 1,
          message: "failed",
          payload: "{}",
          result: "",
          logs: [],
        },
      ],
      total: 1,
      page: 1,
      size: 20,
    });
    vi.spyOn(apiClient, "getTask").mockResolvedValue({
      id: 7,
      name: "Failed sync",
      type: "sync",
      status: "FAILED",
      progress: 1,
      message: "failed",
      payload: "{}",
      result: "",
      logs: [],
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Queue />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByText("Failed sync"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /重新创建任务/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /删除记录/i })).toBeInTheDocument();
    });

    queryClient.clear();
  });

  it("shows cancel action for a running task", async () => {
    vi.spyOn(apiClient, "getTasks").mockResolvedValue({
      items: [
        {
          id: 9,
          name: "Running download",
          type: "download",
          status: "RUNNING",
          progress: 0.4,
          message: "running",
          payload: "{}",
          result: "",
          logs: [],
        },
      ],
      total: 1,
      page: 1,
      size: 20,
    });
    vi.spyOn(apiClient, "getTask").mockResolvedValue({
      id: 9,
      name: "Running download",
      type: "download",
      status: "RUNNING",
      progress: 0.4,
      message: "running",
      payload: "{}",
      result: "",
      logs: [],
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Queue />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByText("Running download"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /取消任务/i })).toBeInTheDocument();
    });

    queryClient.clear();
  });

  it("reviews direct ids before creating a download task", async () => {
    vi.spyOn(apiClient, "getTasks").mockResolvedValue({ items: [], total: 0, page: 1, size: 20 });
    const createDownload = vi.spyOn(apiClient, "createDownload").mockResolvedValue({ code: "ACCEPTED", task_id: 12 });
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Queue />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /新建下载任务/i }));
    fireEvent.change(await screen.findByPlaceholderText(/RJ123456/), { target: { value: "rj123456, RJ123456, invalid" } });
    fireEvent.click(screen.getByRole("button", { name: /复核 RJ 批量任务/i }));
    fireEvent.click(await screen.findByRole("button", { name: /创建下载任务/i }));

    await waitFor(() => expect(createDownload).toHaveBeenCalledWith(expect.objectContaining({ ids: ["RJ123456"] })));
    queryClient.clear();
  });
});
