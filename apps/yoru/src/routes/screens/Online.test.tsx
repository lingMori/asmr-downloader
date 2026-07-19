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
import { apiClient, type DiscoverWorkDetail, type DiscoverWorkSummary } from "@/lib/api";
import { OnlineScreen } from "./Online";

const playerMock = vi.hoisted(() => ({
  playSession: vi.fn(),
  toggle: vi.fn(),
  // useGlobalPlayer() 每次调用读这里,测试间在 beforeEach 重置
  value: null as unknown,
}));

vi.mock("@/player", () => ({
  useGlobalPlayer: () => playerMock.value,
}));

vi.mock("@/lib/api", () => ({
  apiClient: {
    getPopularWorks: vi.fn(),
    getRecommendWorks: vi.fn(),
    getWorkStatuses: vi.fn(async () => ({ items: [] })),
    getDiscoverWork: vi.fn(),
  },
}));

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

function renderOnline(initialUrl = "/online") {
  const rootRoute = createRootRoute({ component: Outlet });
  const onlineRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/online",
    component: OnlineScreen,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([onlineRoute]),
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
    playerMock.value = {
      session: null,
      playing: false,
      playSession: playerMock.playSession,
      toggle: playerMock.toggle,
    };
    popularWorks().mockResolvedValue(listResponse(["RJ001"]));
    recommendWorks().mockResolvedValue(listResponse(["RJ009"]));
    vi.mocked(apiClient.getWorkStatuses).mockResolvedValue({ items: [] });
  });

  it("默认拉取热门列表;切换 chip 改走推荐接口并写 URL", async () => {
    const router = renderOnline();

    // 默认 sort=popular → getPopularWorks(subtitle:false)
    expect(await screen.findByText("作品 RJ001")).toBeInTheDocument();
    expect(popularWorks()).toHaveBeenCalledWith({ page: 1, pageSize: 24, subtitle: false });
    expect(recommendWorks()).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "热门" })).toHaveAttribute("aria-pressed", "true");
    // 本页 source_id 驱动 works/status
    expect(vi.mocked(apiClient.getWorkStatuses)).toHaveBeenCalledWith(["RJ001"]);

    fireEvent.click(screen.getByRole("button", { name: "为你推荐" }));

    expect(await screen.findByText("作品 RJ009")).toBeInTheDocument();
    expect(recommendWorks()).toHaveBeenCalledWith({ page: 1, pageSize: 24, subtitle: false });
    // 热门只拉过一次,不重复请求
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

  it("点卡:拉详情拍平音轨后 playSession(stream:true) 建串流会话", async () => {
    vi.mocked(apiClient.getDiscoverWork).mockResolvedValue({
      tracks: [
        {
          type: "folder",
          title: "root",
          children: [
            {
              id: "t1",
              type: "audio",
              title: "01.mp3",
              play_url: "/api/discover/works/RJ001/tracks/t1/stream",
            },
            {
              id: "t2",
              type: "subtitle",
              title: "01.vtt",
              file_url: "/api/discover/works/RJ001/tracks/t2/file",
            },
          ],
        },
      ],
    } as unknown as DiscoverWorkDetail);
    renderOnline();
    expect(await screen.findByText("作品 RJ001")).toBeInTheDocument();

    fireEvent.click(screen.getByText("作品 RJ001"));

    await vi.waitFor(() => {
      expect(playerMock.playSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: "RJ001",
          workTitle: "作品 RJ001",
          stream: true,
          startIndex: 0,
          cv: "CV甲",
          rj: "RJ001",
          tracks: [
            expect.objectContaining({
              id: "t1",
              url: "/api/discover/works/RJ001/tracks/t1/stream",
              subtitleUrl: "/api/discover/works/RJ001/tracks/t2/file",
            }),
          ],
        }),
      );
    });
    expect(apiClient.getDiscoverWork).toHaveBeenCalledWith("RJ001");
  });

  it("该作已在播时点卡 → toggle,不再拉详情", async () => {
    playerMock.value = {
      session: { sourceId: "RJ001", workTitle: "作品 RJ001", tracks: [], startIndex: 0, stream: true },
      playing: true,
      playSession: playerMock.playSession,
      toggle: playerMock.toggle,
    };
    renderOnline();
    expect(await screen.findByText("作品 RJ001")).toBeInTheDocument();
    // 在播卡圆钮显示暂停语义
    expect(screen.getByRole("button", { name: "暂停" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("作品 RJ001"));

    expect(playerMock.toggle).toHaveBeenCalledTimes(1);
    expect(apiClient.getDiscoverWork).not.toHaveBeenCalled();
    expect(playerMock.playSession).not.toHaveBeenCalled();
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
