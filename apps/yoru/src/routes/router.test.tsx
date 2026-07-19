import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";

vi.mock("@/lib/api", () => ({
  apiClient: {
    getHealth: vi.fn().mockResolvedValue({ status: "ok", version: "0.0.0", time: "" }),
    getTaskSummary: vi.fn().mockResolvedValue({
      total: 0,
      queued: 0,
      running: 0,
      success: 0,
      failed: 0,
      canceled: 0,
      terminated: 0,
    }),
    // /settings 已是真实页面(Phase 6):需要 config/auth 数据源
    getConfig: vi.fn().mockResolvedValue({
      user: { account: "guest", password: "***" },
      downloader: {
        api_url: "https://api.asmr-300.com",
        proxy_url: "",
        sync_data_folder: "./syncdata",
        prefer_media: "all",
        max_workers: 5,
        max_retries: 3,
      },
      limit: {
        sync_qps: 2,
        download_qps: 0.2,
        sync_jitter_min: 100,
        sync_jitter_max: 500,
        download_jitter_min: 2000,
        download_jitter_max: 5000,
      },
      auth: { state: "success", message: "已登录" },
    }),
    getAuthStatus: vi.fn().mockResolvedValue({ state: "success", message: "已登录" }),
    // /transfer 已是真实页面(Phase 5):需要 tasks/sync 数据源
    getTasks: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, size: 20 }),
    // /library 已是真实页面(Phase 2):需要 library/playback 数据源
    getLibraryWorks: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24 }),
    getLatestPlaybackProgress: vi.fn().mockResolvedValue({ items: [] }),
    // /discover 已是真实页面(Phase 3):需要 search/works-status 数据源
    searchDiscover: vi.fn().mockResolvedValue({
      items: [],
      facets: { tags: [], circles: [], vas: [] },
      total: 0,
      page: 1,
      page_size: 24,
    }),
    searchWorks: vi.fn().mockResolvedValue({ items: [], total: 0, count: 0, page: 1, page_size: 20 }),
    getWorkStatuses: vi.fn().mockResolvedValue({ items: [] }),
    getReport: vi.fn().mockResolvedValue({
      totals: { metadata: 0, subtitle: 0, without_subtitle: 0 },
      downloads: { completed: 0, failed: 0, pending: 0 },
      progress: { overall: 0, with_subtitle: 0, without_subtitle: 0 },
    }),
  },
}));

function renderRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("router 骨架(真实路由树)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("/ 重定向到 /library 并渲染真实媒体库页(Phase 2 落地)", async () => {
    await router.navigate({ to: "/", replace: true });
    renderRouter();
    const main = document.querySelector(".y-shell-main")!;
    await vi.waitFor(() => {
      expect(main.textContent).toContain("还没有收听记录");
      expect(main.textContent).toContain("本地作品");
    });
    expect(router.state.location.pathname).toBe("/library");
    // 当前页 nav 高亮在媒体库
    await vi.waitFor(() => {
      const link = document.querySelector('.y-nav__item[href="/library"]');
      expect(link?.className).toContain("is-on");
    });
  });

  it("/discover 真实发现页可达(Phase 3 落地)", async () => {
    renderRouter();
    await router.navigate({ to: "/discover", replace: true });
    const main = document.querySelector(".y-shell-main")!;
    await vi.waitFor(() => {
      expect(main.textContent).toContain("还没有激活筛选条件");
    });
  });

  it("/transfer 真实传输页可达(Phase 5 落地)", async () => {
    renderRouter();
    await router.navigate({ to: "/transfer", replace: true });
    const main = document.querySelector(".y-shell-main")!;
    await vi.waitFor(() => {
      expect(main.textContent).toContain("下载队列 · きゅー");
      expect(main.textContent).toContain("同步 · どうき");
      expect(main.textContent).toContain("最近完成 · かんりょう");
    });
  });

  it("/settings 真实设置页可达(Phase 6 落地)", async () => {
    renderRouter();
    await router.navigate({ to: "/settings", replace: true });
    const main = document.querySelector(".y-shell-main")!;
    await vi.waitFor(() => {
      expect(main.textContent).toContain("下载 · だうんろーど");
      expect(main.textContent).toContain("数据源 · みらー");
      expect(main.textContent).toContain("外观 · がいかん");
      expect(main.textContent).toContain("关于 · あばうと");
    });
  });

  it("未匹配路由 → 404 空态", async () => {
    window.history.replaceState(null, "", "/no-such-page");
    renderRouter();
    expect(await screen.findByText(/ページが見つかりません/)).toBeInTheDocument();
  });
});
