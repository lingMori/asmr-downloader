import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type {
  DiscoverSearchResponse,
  DiscoverWorkDetail,
  DiscoverWorkListResponse,
  DiscoverWorkSummary,
  WorkStatusResponse,
} from "@/lib/api";
import { GlobalPlayerProvider } from "@/player";
import { DiscoverScreen } from "./Discover";

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>();
  return {
    apiClient: {
      searchDiscover: vi.fn(),
      searchWorks: vi.fn(),
      getDiscoverWork: vi.fn(),
      getWorkNeighbors: vi.fn(),
      getWorkStatuses: vi.fn(),
      exportSearch: vi.fn(),
      createDownload: vi.fn(),
      getPlaybackProgress: vi.fn(),
      savePlaybackProgress: vi.fn(),
      sendFeedback: vi.fn(),
      addCollection: vi.fn(async () => ({ collected: true })),
      removeCollection: vi.fn(async () => ({ deleted: true })),
    },
    toCollectionInput: actual.toCollectionInput,
  };
});

import { apiClient } from "@/lib/api";

const mockedSearchDiscover = vi.mocked(apiClient.searchDiscover);
const mockedSearchWorks = vi.mocked(apiClient.searchWorks);
const mockedGetDiscoverWork = vi.mocked(apiClient.getDiscoverWork);
const mockedGetWorkNeighbors = vi.mocked(apiClient.getWorkNeighbors);
const mockedGetWorkStatuses = vi.mocked(apiClient.getWorkStatuses);
const mockedGetPlaybackProgress = vi.mocked(apiClient.getPlaybackProgress);
const mockedSavePlaybackProgress = vi.mocked(apiClient.savePlaybackProgress);

const WORKS: DiscoverWorkSummary[] = [
  {
    source_id: "RJ001",
    title: "雨音の催眠夜話",
    circle: "雨音シアター",
    release: "2024-05-01",
    dl_count: 12408,
    rate: 4.8,
    duration: 3600,
    has_subtitle: true,
    vas: ["篝火ほたる"],
    tags: ["耳语", "催眠"],
  },
  {
    source_id: "RJ002",
    title: "治愈系耳かき特集",
    circle: "音の森",
    release: "2024-06-15",
    dl_count: 8800,
    rate: 4.35,
    duration: 2400,
    has_subtitle: false,
    vas: ["tester"],
    tags: ["治愈"],
  },
];

const FACETS: DiscoverSearchResponse["facets"] = {
  tags: [{ value: "耳语", count: 3 }],
  circles: [{ value: "雨音シアター", count: 2 }],
  vas: [{ value: "篝火ほたる", count: 2 }],
};

function searchResponse(patch: Partial<DiscoverSearchResponse> = {}): DiscoverSearchResponse {
  return { items: WORKS, facets: FACETS, total: 42, page: 1, page_size: 24, ...patch };
}

const DETAIL: DiscoverWorkDetail = {
  summary: WORKS[0],
  source_url: "https://example.com/RJ001",
  circle_id: 1,
  price: 1100,
  review_count: 233,
  rate_count: 200,
  create_date: "2024-04-01",
  work_attributes: "",
  age_category: "all",
  tracks: [
    {
      id: "0",
      type: "folder",
      title: "root",
      children: [
        {
          id: "0.0",
          type: "audio",
          title: "01 雨声.mp3",
          play_url: "/api/discover/works/RJ001/tracks/0.0/stream",
        },
        {
          id: "0.1",
          type: "audio",
          title: "02 耳语.mp3",
          play_url: "/api/discover/works/RJ001/tracks/0.1/stream",
        },
      ],
    },
  ],
};

const NEIGHBORS: DiscoverWorkListResponse = {
  items: [WORKS[1]],
  page: 1,
  page_size: 6,
  total: 1,
};

const EMPTY_STATUS: WorkStatusResponse = { items: [] };

function renderDiscover(initialPath = "/discover") {
  const rootRoute = createRootRoute({
    component: () => (
      <GlobalPlayerProvider>
        <Outlet />
      </GlobalPlayerProvider>
    ),
  });
  const discoverRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/discover",
    component: DiscoverScreen,
  });
  const stub = (path: string) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <div>stub {path}</div>,
    });
  const router = createRouter({
    routeTree: rootRoute.addChildren([discoverRoute, stub("/settings"), stub("/transfer")]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
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

describe("DiscoverScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSearchDiscover.mockResolvedValue(searchResponse());
    mockedSearchWorks.mockResolvedValue({ items: [], total: 0, count: 0 });
    mockedGetDiscoverWork.mockResolvedValue(DETAIL);
    mockedGetWorkNeighbors.mockResolvedValue(NEIGHBORS);
    mockedGetWorkStatuses.mockResolvedValue(EMPTY_STATUS);
    mockedGetPlaybackProgress.mockRejectedValue(new Error("404"));
    mockedSavePlaybackProgress.mockResolvedValue({ saved: true });
  });

  it("搜索输入防抖 400ms 后写入 URL 并带 q 重新查询", async () => {
    const router = renderDiscover();
    await screen.findByText("雨音の催眠夜話");
    expect(mockedSearchDiscover).toHaveBeenCalledWith(expect.objectContaining({ q: "", page: 1 }));

    fireEvent.change(screen.getByLabelText("搜索关键词或高级查询表达式"), {
      target: { value: "RJ123" },
    });

    await waitFor(
      () =>
        expect(mockedSearchDiscover).toHaveBeenCalledWith(
          expect.objectContaining({ q: "RJ123", page: 1 }),
        ),
      { timeout: 2000 },
    );
    expect(router.state.location.search).toMatchObject({ q: "RJ123" });
  });

  it("无限滚动:哨兵入视自动加载下一页并累加,末页后显示到底提示", async () => {
    const page1Works = Array.from({ length: 24 }, (_, i) => ({
      ...WORKS[0],
      source_id: `RJ${String(i + 1).padStart(3, "0")}`,
      title: `作品 ${i + 1}`,
    }));
    const page2Works = [
      { ...WORKS[0], source_id: "RJ025", title: "作品 25" },
      { ...WORKS[0], source_id: "RJ026", title: "作品 26" },
    ];
    mockedSearchDiscover.mockImplementation((params?: { page?: number }) =>
      Promise.resolve(
        searchResponse({
          items: (params?.page ?? 1) === 1 ? page1Works : page2Works,
          total: 26,
        }),
      ),
    );
    renderDiscover();

    // 第一页 24 条渲染;满页 → 有下一页,哨兵生效;先无到底提示
    expect(await screen.findByText("作品 24")).toBeInTheDocument();
    expect(screen.queryByText(/已经到底啦/)).toBeNull();

    const instances = (
      window.IntersectionObserver as unknown as {
        instances: { triggerIntersect(v: boolean): void }[];
      }
    ).instances;
    expect(instances.length).toBeGreaterThan(0);
    instances[instances.length - 1].triggerIntersect(true);

    // 第二页 2 条累加;不满页 → 到底提示
    expect(await screen.findByText("作品 25")).toBeInTheDocument();
    expect(screen.getByText("作品 24")).toBeInTheDocument();
    expect(await screen.findByText("已经到底啦 · 共 26 条")).toBeInTheDocument();
    expect(mockedSearchDiscover).toHaveBeenCalledTimes(2);
    expect(mockedSearchDiscover).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it("筛选面板点排序 chip 实时写 URL(order=rate_average_2dp)", async () => {
    const router = renderDiscover();
    await screen.findByText("雨音の催眠夜話");

    fireEvent.click(screen.getByRole("button", { name: /筛选/ }));
    fireEvent.click(await screen.findByRole("button", { name: "评分" }));

    await waitFor(() =>
      expect(mockedSearchDiscover).toHaveBeenCalledWith(
        expect.objectContaining({ order: "rate_average_2dp", page: 1 }),
      ),
    );
    expect(router.state.location.search).toMatchObject({ order: "rate_average_2dp" });
    // 激活条件出现「排序: 评分」chip,移除后回到默认
    fireEvent.click(await screen.findByRole("button", { name: /排序: 评分 ×/ }));
    await waitFor(() =>
      expect(mockedSearchDiscover).toHaveBeenCalledWith(
        expect.objectContaining({ order: "dl_count" }),
      ),
    );
  });

  it("勾选结果行 → 批量栏出现,可打开下载复核", async () => {
    renderDiscover();
    await screen.findByText("雨音の催眠夜話");
    expect(screen.queryByText("已选 1 件")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "选择 RJ001" }));
    expect(await screen.findByText("已选 1 件")).toBeInTheDocument();
    // 统计行与批量栏都会出现「已选 1 件」
    expect(screen.getAllByText(/已选 1 件/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /批量加入传输队列/ }));
    expect(await screen.findByText("确认创建下载任务")).toBeInTheDocument();
    expect(screen.getByText(/RJ001 · 雨音の催眠夜話/)).toBeInTheDocument();
  });

  it("点击结果行选中详情:URL work=RJ,侧栏显示指标/音轨/相似作品,点音轨建串流会话", async () => {
    const router = renderDiscover();
    await screen.findByText("雨音の催眠夜話");

    fireEvent.click(screen.getByText("雨音の催眠夜話"));

    await waitFor(() => expect(mockedGetDiscoverWork).toHaveBeenCalledWith("RJ001"));
    expect(router.state.location.search).toMatchObject({ work: "RJ001" });
    expect(await screen.findByText("音轨试听 · ためしぎき")).toBeInTheDocument();
    expect(screen.getByText("发售日")).toBeInTheDocument();
    expect(screen.getByText("¥1,100")).toBeInTheDocument();
    expect(screen.getByText("2 轨")).toBeInTheDocument();
    expect(screen.getByText(/01 雨声/)).toBeInTheDocument();
    // 相似作品区块
    expect(screen.getByText("相似作品 · にている")).toBeInTheDocument();

    // 点音轨 → 全部 audio 轨建 stream 会话,startIndex=该轨;当前轨行高亮(is-on)
    fireEvent.click(screen.getByText(/02 耳语/));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /02 耳语/ }).className).toContain("is-on"),
    );
  });

  it("零结果 → 空态 + 重置钮", async () => {
    mockedSearchDiscover.mockResolvedValue(
      searchResponse({ items: [], total: 0, facets: { tags: [], circles: [], vas: [] } }),
    );
    renderDiscover();
    expect(await screen.findByText(/没有找到匹配的作品/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重置条件" })).toBeInTheDocument();
  });

  it("搜索失败 → 内联错误条(设置链接 + 重试)", async () => {
    mockedSearchDiscover.mockRejectedValueOnce(new Error("502 Bad Gateway"));
    renderDiscover();
    expect(await screen.findByText(/搜索失败/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去设置检查 →" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await screen.findByText("雨音の催眠夜話");
  });

  it("结果行 ♡ 收藏:点击调 addCollection(快照带 source_id),不触发行选中", async () => {
    renderDiscover();
    await screen.findByText("雨音の催眠夜話");

    const collectButtons = screen.getAllByRole("button", { name: "收藏" });
    expect(collectButtons.length).toBeGreaterThan(0);
    fireEvent.click(collectButtons[0]);

    await waitFor(() =>
      expect(vi.mocked(apiClient.addCollection)).toHaveBeenCalledWith(
        expect.objectContaining({ source_id: "RJ001", title: "雨音の催眠夜話" }),
      ),
    );
    // stopPropagation:没有打开详情
    expect(mockedGetDiscoverWork).not.toHaveBeenCalled();
  });

  it("详情侧栏:操作行含 ♡ 收藏与「查看完整详情 →」链接(/works/$sourceId)", async () => {
    renderDiscover();
    await screen.findByText("雨音の催眠夜話");

    fireEvent.click(screen.getByText("雨音の催眠夜話"));
    expect(await screen.findByText("音轨试听 · ためしぎき")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "查看完整详情 →" }),
    ).toHaveAttribute("href", "/works/RJ001");
    // 侧栏操作行的收藏钮(正常尺寸,与结果行的 sm 分开计数)
    expect(screen.getAllByRole("button", { name: "收藏" }).length).toBeGreaterThan(1);
  });

  it("q 含 $ → 高级语法模式:走 searchWorks,徽章高亮「高级语法 $」", async () => {
    mockedSearchWorks.mockResolvedValue({ items: WORKS, total: 2, count: 2 });
    renderDiscover("/discover?q=$tag:耳语$");

    await waitFor(() =>
      expect(mockedSearchWorks).toHaveBeenCalledWith(
        expect.objectContaining({ query: "$tag:耳语$" }),
      ),
    );
    expect(mockedSearchDiscover).not.toHaveBeenCalled();
    expect(await screen.findByText(/语法: \$tag:耳语\$/)).toBeInTheDocument();
  });
});
