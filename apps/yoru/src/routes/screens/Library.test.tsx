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

vi.mock("@/lib/api", () => ({
  apiClient: {
    getLibraryWorks: vi.fn(),
    getLatestPlaybackProgress: vi.fn(),
    getLibraryWork: vi.fn(),
  },
}));

import { apiClient, type LibraryWorkDetail } from "@/lib/api";
import { FAVORITES_STORAGE_KEY } from "@/lib/favorites";
import { LibraryScreen } from "./Library";
import { LibraryDetailScreen } from "./LibraryDetail";

const mockedWorks = vi.mocked(apiClient.getLibraryWorks);
const mockedLatest = vi.mocked(apiClient.getLatestPlaybackProgress);
const mockedWork = vi.mocked(apiClient.getLibraryWork);

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
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/library/$id",
    component: LibraryDetailScreen,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([libraryRoute, detailRoute]),
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

  it("tab 过滤:有字幕只留 has_subtitles 作品,计数 = 全部 total / 页内匹配数", async () => {
    renderRoute("/library");
    expect(await screen.findByText("耳かきの夜")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "有字幕 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "有字幕 1" }));
    await waitFor(() => expect(screen.queryByText("耳かきの夜")).toBeNull());
    expect(screen.getAllByText("子守唄バイノーラル").length).toBeGreaterThan(0);
  });

  it("♡ 收藏切换写入 localStorage,收藏 tab 只显示已收藏", async () => {
    renderRoute("/library");
    const favBtn = await screen.findByRole("button", { name: "收藏 耳かきの夜" });
    fireEvent.click(favBtn);

    expect(JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY)!)).toEqual(["2"]);
    expect(await screen.findByRole("button", { name: "收藏 ♡ 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "收藏 ♡ 1" }));
    await waitFor(() => expect(screen.queryByText("子守唄バイノーラル")).toBeNull());
    expect(screen.getByText("耳かきの夜")).toBeInTheDocument();
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

const DETAIL: LibraryWorkDetail = {
  summary: {
    id: "1",
    media_id: "RJ111",
    title: "子守唄バイノーラル",
    release_date: "2024-03-01",
    has_subtitles: true,
    file_count: 5,
    audio_file_count: 2,
    subtitle_count: 1,
    thumbnail_url: "/media/RJ111/cover.jpg",
  },
  files: [
    { path: "RJ111/01.mp3", name: "01 耳かき.mp3", kind: "audio", url: "/media/RJ111/01.mp3" },
    { path: "RJ111/02.mp3", name: "02 ささやき.mp3", kind: "audio", url: "/media/RJ111/02.mp3" },
    { path: "RJ111/01.lrc", name: "01 耳かき.lrc", kind: "subtitle", url: "/media/RJ111/01.lrc" },
    { path: "RJ111/cover.jpg", name: "cover.jpg", kind: "image", url: "/media/RJ111/cover.jpg" },
    { path: "RJ111/readme.txt", name: "readme.txt", kind: "other", url: "/media/RJ111/readme.txt" },
  ],
};

describe("LibraryDetailScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockedWork.mockResolvedValue(DETAIL);
  });

  it("按 kind 分组渲染文件列表(组标题带计数)", async () => {
    renderRoute("/library/1");
    expect(await screen.findByText("子守唄バイノーラル")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "音声" })).toHaveTextContent("音声2");
    expect(screen.getByRole("region", { name: "字幕" })).toHaveTextContent("字幕1");
    expect(screen.getByRole("region", { name: "图片" })).toHaveTextContent("图片1");
    expect(screen.getByRole("region", { name: "其他" })).toHaveTextContent("其他1");
    expect(screen.getByRole("link", { name: /cover\.jpg/ })).toHaveAttribute(
      "href",
      "/media/RJ111/cover.jpg",
    );
    expect(screen.getByRole("link", { name: /cover\.jpg/ })).toHaveAttribute("target", "_blank");
  });

  it("播放整作:全部音声按序建会话并匹配字幕;单曲行为 startIndex", async () => {
    renderRoute("/library/1");
    fireEvent.click(await screen.findByRole("button", { name: "▶ 播放整作" }));
    expect(playSessionMock).toHaveBeenCalledWith({
      sourceId: "RJ111",
      workTitle: "子守唄バイノーラル",
      coverUrl: "/media/RJ111/cover.jpg",
      rj: "RJ111",
      tracks: [
        {
          id: "RJ111/01.mp3",
          title: "01 耳かき.mp3",
          url: "/media/RJ111/01.mp3",
          subtitleUrl: "/media/RJ111/01.lrc",
        },
        {
          id: "RJ111/02.mp3",
          title: "02 ささやき.mp3",
          url: "/media/RJ111/02.mp3",
          subtitleUrl: undefined,
        },
      ],
      startIndex: 0,
      stream: false,
    });

    playSessionMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /02 ささやき\.mp3/ }));
    expect(playSessionMock).toHaveBeenCalledWith(expect.objectContaining({ startIndex: 1 }));
  });

  it("404 → 作品不存在空态", async () => {
    mockedWork.mockRejectedValue(new Error("404 Not Found"));
    renderRoute("/library/9");
    expect(await screen.findByText(/作品不存在/)).toBeInTheDocument();
  });
});
