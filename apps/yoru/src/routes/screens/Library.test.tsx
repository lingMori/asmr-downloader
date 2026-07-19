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

const { playSessionMock } = vi.hoisted(() => ({ playSessionMock: vi.fn() }));

vi.mock("@/player", () => ({
  useGlobalPlayer: () => ({
    session: null,
    currentTrack: null,
    playSession: playSessionMock,
  }),
}));

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>();
  return {
    apiClient: {
      getLibraryWorks: vi.fn(),
      getLatestPlaybackProgress: vi.fn(),
      getLibraryWork: vi.fn(),
      getCollections: vi.fn(),
      getWorkStatuses: vi.fn(async () => ({ items: [] })),
      getDiscoverWork: vi.fn(),
      addCollection: vi.fn(async () => ({ collected: true })),
      removeCollection: vi.fn(async () => ({ deleted: true })),
      createDownload: vi.fn(),
    },
    toCollectionInput: actual.toCollectionInput,
  };
});

import { apiClient, type Collection, type WorkStatus } from "@/lib/api";
import { LibraryScreen } from "./Library";

const mockedWorks = vi.mocked(apiClient.getLibraryWorks);
const mockedLatest = vi.mocked(apiClient.getLatestPlaybackProgress);
const mockedCollections = vi.mocked(apiClient.getCollections);
const mockedStatuses = vi.mocked(apiClient.getWorkStatuses);
const mockedAddCollection = vi.mocked(apiClient.addCollection);
const mockedRemoveCollection = vi.mocked(apiClient.removeCollection);

const WORKS = {
  items: [
    {
      id: "1",
      media_id: "RJ111",
      title: "子守唄バイノーラル",
      release_date: "2024-03-01",
      has_subtitles: true,
      file_count: 10,
      audio_file_count: 5,
      subtitle_count: 2,
      thumbnail_url: "/media/rj111/cover.jpg",
    },
    {
      id: "2",
      media_id: "RJ222",
      title: "耳かきの夜",
      release_date: "2024-05-12",
      has_subtitles: false,
      file_count: 8,
      audio_file_count: 3,
      subtitle_count: 0,
    },
  ],
  total: 2,
  page: 1,
  page_size: 24,
};

const COLLECTED_WORK: Collection = {
  source_id: "RJ555",
  title: "收藏の夜話",
  circle: "音の森",
  vas: ["CV甲"],
  tags: [],
  release: "2024-04-01",
  rate: 4.5,
  dl_count: 100,
  duration: 1800,
  has_subtitle: true,
  thumbnail_url: "",
  main_cover_url: "",
};

const LOCAL_PROGRESS = {
  source_id: "RJ111",
  work_title: "ねむりの森",
  cover_url: "",
  track_path: "/media/RJ111/01.mp3",
  track_title: "01 耳かき",
  position: 61,
  duration: 600,
  updated_at: "2024-06-01T00:00:00Z",
};

function renderRoute(initial: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const libraryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/library",
    component: LibraryScreen,
  });
  const workRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/works/$sourceId",
    component: () => <div>work detail stub</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([libraryRoute, workRoute]),
    history: createMemoryHistory({ initialEntries: [initial] }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("LibraryScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockedWorks.mockResolvedValue(WORKS);
    mockedLatest.mockResolvedValue({ items: [LOCAL_PROGRESS] });
    mockedCollections.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 48 });
    mockedStatuses.mockResolvedValue({ items: [] });
  });

  it("hero 展示最近进度,继续播放按 track_path 建会话并 resumeFrom", async () => {
    renderRoute("/library");
    expect(await screen.findByText("ねむりの森")).toBeInTheDocument();
    expect(screen.getByText("01 耳かき")).toBeInTheDocument();
    expect(screen.getByText("已播 1:01/10:00")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "▶ 继续播放" }));
    expect(playSessionMock).toHaveBeenCalledWith(
      {
        sourceId: "RJ111",
        workTitle: "ねむりの森",
        coverUrl: undefined,
        tracks: [{ id: "0", title: "01 耳かき", url: "/media/RJ111/01.mp3" }],
        startIndex: 0,
        stream: false,
      },
      { resumeFrom: 61 },
    );
  });

  it("远端进度(track_path 非 /media)显示「在线」徽章且 stream=true", async () => {
    mockedLatest.mockResolvedValue({
      items: [
        {
          ...LOCAL_PROGRESS,
          track_path: "/api/discover/works/RJ111/tracks/1/stream",
        },
      ],
    });
    renderRoute("/library");
    expect(await screen.findByText("在线")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "▶ 继续播放" }));
    expect(playSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true }),
      { resumeFrom: 61 },
    );
  });

  it("无收听记录时显示虚线空态卡与引导链接", async () => {
    mockedLatest.mockResolvedValue({ items: [] });
    renderRoute("/library");
    expect(await screen.findByText(/还没有收听记录/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去发现" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去在线" })).toBeInTheDocument();
  });

  it("收藏区:渲染 collections 卡片(标题/CV·社团/字幕贴纸/已收藏态 ♥)", async () => {
    mockedCollections.mockResolvedValue({
      items: [COLLECTED_WORK],
      total: 1,
      page: 1,
      page_size: 48,
    });
    renderRoute("/library");
    expect(await screen.findByText("收藏の夜話")).toBeInTheDocument();
    expect(screen.getByText("CV CV甲 · 音の森")).toBeInTheDocument();
    expect(screen.getAllByText("字幕あり").length).toBeGreaterThan(0);
    // 收藏区卡片恒为已收藏态;整卡链接指向 /works/$sourceId
    expect(screen.getByRole("button", { name: "取消收藏" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("link", { name: "收藏の夜話" })).toHaveAttribute(
      "href",
      "/works/RJ555",
    );
  });

  it("收藏区:点 ♥ 取消收藏 → removeCollection(source_id)", async () => {
    mockedCollections.mockResolvedValue({
      items: [COLLECTED_WORK],
      total: 1,
      page: 1,
      page_size: 48,
    });
    renderRoute("/library");
    fireEvent.click(await screen.findByRole("button", { name: "取消收藏" }));
    await waitFor(() => expect(mockedRemoveCollection).toHaveBeenCalledWith("RJ555"));
    expect(mockedAddCollection).not.toHaveBeenCalled();
  });

  it("收藏区:无收藏时显示虚线空态卡", async () => {
    renderRoute("/library");
    expect(await screen.findByText(/还没有收藏作品/)).toBeInTheDocument();
  });

  it("本地卡 ♡ 走 works/status.collected;未收藏点击 → addCollection 快照", async () => {
    const statuses: WorkStatus[] = [
      { source_id: "RJ222", state: "none", label: "", collected: true },
    ];
    mockedStatuses.mockImplementation(async (ids: string[]) => ({
      items: statuses.filter((s) => ids.includes(s.source_id)),
    }));
    renderRoute("/library");
    await screen.findByText("耳かきの夜");
    // works/status 批量请求带上了本地 media_id
    await waitFor(() =>
      expect(mockedStatuses).toHaveBeenCalledWith(
        expect.arrayContaining(["RJ111", "RJ222"]),
      ),
    );
    // RJ222 collected:true → 已收藏态;RJ111 无记录 → 未收藏态
    expect(await screen.findByRole("button", { name: "取消收藏" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    await waitFor(() =>
      expect(mockedAddCollection).toHaveBeenCalledWith(
        expect.objectContaining({ source_id: "RJ111", title: "子守唄バイノーラル" }),
      ),
    );
  });

  it("tab 过滤:有字幕只留 has_subtitles 作品,计数 = 全部 total / 页内匹配数", async () => {
    renderRoute("/library");
    expect(await screen.findByText("耳かきの夜")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "有字幕 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "有字幕 1" }));
    await waitFor(() => expect(screen.queryByText("耳かきの夜")).toBeNull());
    expect(screen.getAllByText("子守唄バイノーラル").length).toBeGreaterThan(0);
  });

  it("搜索输入 300ms 防抖后以 search 参数重新请求", async () => {
    renderRoute("/library");
    await screen.findByText("耳かきの夜");
    expect(mockedWorks).toHaveBeenCalledWith({ page: 1, pageSize: 24, search: undefined });

    fireEvent.change(screen.getByLabelText("搜索本地作品"), { target: { value: "耳かき" } });
    await waitFor(
      () =>
        expect(mockedWorks).toHaveBeenCalledWith({
          page: 1,
          pageSize: 24,
          search: "耳かき",
        }),
      { timeout: 2000 },
    );
  });

  it("空库显示空态与双入口链接", async () => {
    mockedWorks.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24 });
    renderRoute("/library");
    expect(await screen.findByText(/媒体库是空的/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去发现下载" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去设置查看存储路径" })).toBeInTheDocument();
  });

  it("加载失败显示内联错误条 + 重试", async () => {
    mockedWorks.mockRejectedValue(new Error("boom"));
    renderRoute("/library");
    expect(await screen.findByRole("alert")).toHaveTextContent("本地作品加载失败:boom");
    mockedWorks.mockResolvedValue(WORKS);
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("耳かきの夜")).toBeInTheDocument();
  });
});
