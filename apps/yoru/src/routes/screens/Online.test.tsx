import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { apiClient, type DiscoverWorkSummary } from "@/lib/api";
import { OnlineScreen } from "./Online";

const playerMock = vi.hoisted(() => ({
  playSession: vi.fn(),
  // useGlobalPlayer() 每次调用读这里,测试间在 beforeEach 重置
  value: null as unknown,
}));

vi.mock("@/player", () => ({
  useGlobalPlayer: () => playerMock.value,
}));

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>();
  return {
    apiClient: {
      getPopularWorks: vi.fn(),
      getRecommendWorks: vi.fn(),
      getWorkStatuses: vi.fn(async () => ({ items: [] })),
      addCollection: vi.fn(async () => ({ collected: true })),
      removeCollection: vi.fn(async () => ({ deleted: true })),
    },
    toCollectionInput: actual.toCollectionInput,
  };
});

function makeWork(id: string, over: Partial<DiscoverWorkSummary> = {}): DiscoverWorkSummary {
  return {
    source_id: id,
    title: `作品 ${id}`,
    circle: "社团A",
    release: "2024-01-01",
    dl_count: 1234,
    rate: 4.5,
    duration: 3600,
    has_subtitle: true,
    vas: ["CV甲"],
    tags: [],
    ...over,
  };
}

function listResponse(ids: string[], total = ids.length) {
  return { items: ids.map((id) => makeWork(id)), page: 1, page_size: 24, total };
}

function triggerLastSentinel() {
  const instances = (window.IntersectionObserver as unknown as { instances: { triggerIntersect(v: boolean): void }[] })
    .instances;
  expect(instances.length).toBeGreaterThan(0);
  instances[instances.length - 1].triggerIntersect(true);
}

function renderOnline(initialUrl = "/online") {
  const rootRoute = createRootRoute({ component: Outlet });
  const onlineRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/online",
    component: OnlineScreen,
  });
  const workRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/works/$sourceId",
    component: () => <div>detail stub</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([onlineRoute, workRoute]),
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const popularWorks = () => vi.mocked(apiClient.getPopularWorks);
const recommendWorks = () => vi.mocked(apiClient.getRecommendWorks);

describe("在线曲库 /online", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playerMock.value = { session: null, playSession: playerMock.playSession };
    popularWorks().mockResolvedValue(listResponse(["RJ001"]));
    recommendWorks().mockResolvedValue(listResponse(["RJ009"]));
    vi.mocked(apiClient.getWorkStatuses).mockResolvedValue({ items: [] });
  });

  it("默认拉取热门列表;切换 chip 改走推荐接口并写 URL", async () => {
    const router = renderOnline();

    expect(await screen.findByText("作品 RJ001")).toBeInTheDocument();
    expect(popularWorks()).toHaveBeenCalledWith({ page: 1, pageSize: 24, subtitle: false });
    expect(recommendWorks()).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "热门" })).toHaveAttribute("aria-pressed", "true");
    expect(vi.mocked(apiClient.getWorkStatuses)).toHaveBeenCalledWith(["RJ001"]);

    fireEvent.click(screen.getByRole("button", { name: "为你推荐" }));

    expect(await screen.findByText("作品 RJ009")).toBeInTheDocument();
    expect(recommendWorks()).toHaveBeenCalledWith({ page: 1, pageSize: 24, subtitle: false });
    expect(popularWorks()).toHaveBeenCalledTimes(1);
    expect(router.state.location.search).toMatchObject({ sort: "recommend" });
    expect(screen.getByRole("button", { name: "为你推荐" })).toHaveAttribute("aria-pressed", "true");
  });

  it("仅字幕 toggle 写入 subtitle=1 参数并重查当前数据源", async () => {
    renderOnline();
    expect(await screen.findByText("作品 RJ001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "仅字幕" }));

    await vi.waitFor(() => {
      expect(popularWorks()).toHaveBeenLastCalledWith({ page: 1, pageSize: 24, subtitle: true });
    });
    expect(screen.getByRole("switch", { name: "仅字幕" })).toHaveAttribute("aria-checked", "true");
  });

  it("点卡 → 跳转 /works/$sourceId 详情页(不直接播放)", async () => {
    const router = renderOnline();
    expect(await screen.findByText("作品 RJ001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看详情 作品 RJ001" }));

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe("/works/RJ001");
    });
    expect(playerMock.playSession).not.toHaveBeenCalled();
  });

  it("正在播放的作品:封面显示 ♪ 指示(非交互),点卡仍跳详情", async () => {
    playerMock.value = {
      session: { sourceId: "RJ001", workTitle: "作品 RJ001", tracks: [], startIndex: 0, stream: true },
      playSession: playerMock.playSession,
    };
    const router = renderOnline();
    expect(await screen.findByText("作品 RJ001")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "正在播放" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看详情 作品 RJ001" }));
    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe("/works/RJ001");
    });
    expect(playerMock.playSession).not.toHaveBeenCalled();
  });

  it("♡ 收藏:点击调 addCollection(快照带 source_id)", async () => {
    renderOnline();
    expect(await screen.findByText("作品 RJ001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    await vi.waitFor(() => {
      expect(vi.mocked(apiClient.addCollection)).toHaveBeenCalledWith(
        expect.objectContaining({ source_id: "RJ001", title: "作品 RJ001" }),
      );
    });
  });

  it("无限滚动:哨兵入视自动加载下一页并累加,末页后显示到底提示", async () => {
    const page1Ids = Array.from({ length: 24 }, (_, i) => `RJ${String(i + 1).padStart(3, "0")}`);
    popularWorks().mockImplementation((params?: { page?: number }) =>
      Promise.resolve(
        (params?.page ?? 1) === 1 ? listResponse(page1Ids, 26) : listResponse(["RJ025", "RJ026"], 26),
      ),
    );
    renderOnline();

    // 第一页 24 条全部渲染;满页 → 有下一页,哨兵生效
    expect(await screen.findByText("作品 RJ024")).toBeInTheDocument();
    expect(screen.queryByText(/已经到底啦/)).toBeNull();

    triggerLastSentinel();

    // 第二页 2 条累加进来;不满页 → 无下一页,显示到底提示
    expect(await screen.findByText("作品 RJ025")).toBeInTheDocument();
    expect(screen.getByText("作品 RJ024")).toBeInTheDocument();
    expect(await screen.findByText("已经到底啦 · 共 26 部")).toBeInTheDocument();
    expect(popularWorks()).toHaveBeenCalledTimes(2);
    expect(popularWorks()).toHaveBeenLastCalledWith({ page: 2, pageSize: 24, subtitle: false });
  });

  it("加载失败 → 内联错误条(含设置链接),重试后恢复", async () => {
    popularWorks().mockRejectedValueOnce(new Error("上游 502:bad gateway"));
    renderOnline();

    expect(await screen.findByText(/加载失败:上游 502:bad gateway/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去设置检查 →" })).toHaveAttribute("href", "/settings");

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(await screen.findByText("作品 RJ001")).toBeInTheDocument();
    expect(popularWorks()).toHaveBeenCalledTimes(2);
  });
});
