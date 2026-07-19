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
    getWorkStatuses: vi.fn(),
    getLibraryWork: vi.fn(),
    getDiscoverWork: vi.fn(),
    getWorkNeighbors: vi.fn(),
  },
  toCollectionInput: (w: unknown) => w,
}));

import { apiClient, type DiscoverWorkDetail, type LibraryWorkDetail } from "@/lib/api";
import { WorkDetailScreen } from "./WorkDetail";

const mockedStatuses = vi.mocked(apiClient.getWorkStatuses);
const mockedLibraryWork = vi.mocked(apiClient.getLibraryWork);
const mockedDiscoverWork = vi.mocked(apiClient.getDiscoverWork);
const mockedNeighbors = vi.mocked(apiClient.getWorkNeighbors);

const LIB: LibraryWorkDetail = {
  summary: {
    id: "42",
    media_id: "RJ1",
    title: "本地の夜",
    release_date: "2024-03-01",
    has_subtitles: true,
    file_count: 4,
    audio_file_count: 2,
    subtitle_count: 1,
    thumbnail_url: "/media/RJ1/cover.jpg",
  },
  files: [
    { path: "RJ1/SE/01 耳かき.mp3", name: "01 耳かき.mp3", kind: "audio", url: "/media/RJ1/SE/01.mp3" },
    { path: "RJ1/SE/02 ささやき.mp3", name: "02 ささやき.mp3", kind: "audio", url: "/media/RJ1/SE/02.mp3" },
    { path: "RJ1/SE/01 耳かき.lrc", name: "01 耳かき.lrc", kind: "subtitle", url: "/media/RJ1/SE/01.lrc" },
    { path: "RJ1/cover.jpg", name: "cover.jpg", kind: "image", url: "/media/RJ1/cover.jpg" },
  ],
};

const REMOTE: DiscoverWorkDetail = {
  summary: {
    source_id: "RJ1",
    title: "遠端の夜",
    circle: "さくらみみ",
    release: "20240101",
    dl_count: 120,
    rate: 4.5,
    duration: 3600,
    has_subtitle: true,
    vas: ["こより"],
    tags: ["耳かき"],
    thumbnail_url: "/media/t.jpg",
    main_cover_url: "/media/c.jpg",
  },
  source_url: "https://asmr.one/work/RJ1",
  circle_id: 7,
  price: 1100,
  review_count: 33,
  rate_count: 40,
  create_date: "2024-01-01",
  work_attributes: "",
  age_category: "general",
  tracks: [
    {
      id: "0",
      type: "folder",
      title: "本編",
      children: [
        { id: "0.0", type: "audio", title: "01 耳かき.mp3", play_url: "/api/discover/works/RJ1/tracks/0.0/stream" },
        { id: "0.1", type: "audio", title: "02 ささやき.mp3", play_url: "/api/discover/works/RJ1/tracks/0.1/stream" },
        { id: "0.2", type: "subtitle", title: "01 耳かき.lrc", file_url: "/api/discover/works/RJ1/tracks/0.2/file" },
      ],
    },
  ],
};

const STATUS_NONE = { items: [{ source_id: "RJ1", state: "none" as const, label: "" }] };
const STATUS_IN_LIBRARY = {
  items: [
    {
      source_id: "RJ1",
      state: "in_library" as const,
      label: "已在库",
      library_id: "42",
      collected: true,
    },
  ],
};

function renderRoute(initial: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const workRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/works/$sourceId",
    component: WorkDetailScreen,
  });
  const libraryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/library",
    component: () => <div>媒体库</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([workRoute, libraryRoute]),
    history: createMemoryHistory({ initialEntries: [initial] }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("WorkDetailScreen · 仅本地(远端失败容错)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStatuses.mockResolvedValue(STATUS_IN_LIBRARY);
    mockedLibraryWork.mockResolvedValue(LIB);
    mockedDiscoverWork.mockRejectedValue(new Error("mirror unreachable"));
  });

  it("status→library 装配:头卡/本地文件树/虚线提示/状态贴纸", async () => {
    renderRoute("/works/RJ1");
    expect(await screen.findByText("本地の夜")).toBeInTheDocument();
    expect(mockedStatuses).toHaveBeenCalledWith(["RJ1"]);
    expect(mockedLibraryWork).toHaveBeenCalledWith("42");

    // 本地文件区 + 在线信息不可用虚线提示(不致命)
    expect(screen.getByRole("region", { name: "本地文件" })).toBeInTheDocument();
    expect(screen.getByText(/在线信息暂时不可用/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "在线音轨" })).toBeNull();

    // 贴纸行 + 仅本地指标格 + 下载钮三态(已拥有)
    expect(screen.getByText("字幕あり")).toBeInTheDocument();
    expect(screen.getByText("已下载 ✓")).toBeInTheDocument();
    expect(screen.getByText("已收藏 ♡")).toBeInTheDocument();
    expect(screen.getByText("文件数")).toBeInTheDocument();
    expect(screen.getByText("字幕数")).toBeInTheDocument();
    expect(screen.getByText("已拥有")).toBeInTheDocument();

    // 远端失败 → 不拉相似作品
    expect(mockedNeighbors).not.toHaveBeenCalled();
  });

  it("▶ 播放:全部本地音频轨建会话 stream:false 并匹配字幕", async () => {
    renderRoute("/works/RJ1");
    fireEvent.click(await screen.findByRole("button", { name: "▶ 播放" }));
    expect(playSessionMock).toHaveBeenCalledWith({
      sourceId: "RJ1",
      workTitle: "本地の夜",
      coverUrl: "/media/RJ1/cover.jpg",
      tracks: [
        {
          id: "RJ1/SE/01 耳かき.mp3",
          title: "01 耳かき.mp3",
          url: "/media/RJ1/SE/01.mp3",
          duration: undefined,
          subtitleUrl: "/media/RJ1/SE/01.lrc",
        },
        {
          id: "RJ1/SE/02 ささやき.mp3",
          title: "02 ささやき.mp3",
          url: "/media/RJ1/SE/02.mp3",
          duration: undefined,
          subtitleUrl: undefined,
        },
      ],
      startIndex: 0,
      stream: false,
      cv: undefined,
      rj: "RJ1",
    }, { resumeWork: true });
  });

  it("树:第一层文件夹默认展开,深层可点开,audio 叶点击=startIndex 播放", async () => {
    renderRoute("/works/RJ1");
    await screen.findByText("本地の夜");
    // 第一层 RJ1 展开,第二层 SE 默认折叠
    expect(screen.getByRole("button", { name: "SE" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /02 ささやき/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "SE" }));
    fireEvent.click(screen.getByRole("button", { name: /02 ささやき\.mp3/ }));
    expect(playSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ startIndex: 1, stream: false }),
    );
  });
});

describe("WorkDetailScreen · 仅远端", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStatuses.mockResolvedValue(STATUS_NONE);
    mockedDiscoverWork.mockResolvedValue(REMOTE);
    mockedNeighbors.mockResolvedValue({
      items: [
        {
          source_id: "RJ9",
          title: "隣の作品",
          circle: "となり",
          release: "20240202",
          dl_count: 5,
          rate: 4.25,
          duration: 100,
          has_subtitle: false,
          vas: [],
          tags: [],
        },
      ],
      page: 1,
      page_size: 6,
      total: 1,
    });
  });

  it("远端装配:完整信息(chips/指标格)/在线音轨树/源站外链/相似作品", async () => {
    renderRoute("/works/RJ1");
    expect(await screen.findByText("遠端の夜")).toBeInTheDocument();
    expect(mockedLibraryWork).not.toHaveBeenCalled();

    // 4×2 指标格:发售日/价格/评分/评价/评论/销量/时长/音轨
    expect(screen.getByText("¥1,100")).toBeInTheDocument();
    expect(screen.getByText("4.50")).toBeInTheDocument();
    expect(screen.getByText("40 人")).toBeInTheDocument();
    expect(screen.getByText("33")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("1:00:00")).toBeInTheDocument();
    expect(screen.getByText("2 轨")).toBeInTheDocument();

    // 社团链接 / 声优 chip / 标签 chip → 发现页对应筛选
    expect(screen.getByRole("link", { name: "さくらみみ" })).toHaveAttribute(
      "href",
      expect.stringContaining("/discover?circle="),
    );
    expect(screen.getByRole("link", { name: "こより" })).toHaveAttribute(
      "href",
      expect.stringContaining("/discover?va="),
    );
    expect(screen.getByRole("link", { name: "#耳かき" })).toHaveAttribute(
      "href",
      expect.stringContaining("/discover?tags="),
    );

    // 分级徽章(general → 全年龄)
    expect(screen.getByText("全年龄")).toBeInTheDocument();

    // 在线音轨区:第一层文件夹「本編」默认展开,audio 叶直接可见
    expect(screen.getByRole("region", { name: "在线音轨" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /01 耳かき\.mp3/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "本地文件" })).toBeNull();

    // 源站外链(新窗口)+ 无「已下载」贴纸
    const source = screen.getByRole("link", { name: "源站链接 ↗" });
    expect(source).toHaveAttribute("href", "https://asmr.one/work/RJ1");
    expect(source).toHaveAttribute("target", "_blank");
    expect(screen.queryByText("已下载 ✓")).toBeNull();

    // 相似作品:小卡指向 /works/$id
    expect(await screen.findByRole("link", { name: /隣の作品/ })).toHaveAttribute(
      "href",
      "/works/RJ9",
    );
  });

  it("▶ 播放:远端 audio 轨会话 stream:true + 字幕匹配;叶点击=startIndex", async () => {
    renderRoute("/works/RJ1");
    fireEvent.click(await screen.findByRole("button", { name: "▶ 播放" }));
    expect(playSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "RJ1",
        workTitle: "遠端の夜",
        stream: true,
        startIndex: 0,
        cv: "こより",
        tracks: [
          {
            id: "0.0",
            title: "01 耳かき.mp3",
            url: "/api/discover/works/RJ1/tracks/0.0/stream",
            duration: undefined,
            subtitleUrl: "/api/discover/works/RJ1/tracks/0.2/file",
          },
          {
            id: "0.1",
            title: "02 ささやき.mp3",
            url: "/api/discover/works/RJ1/tracks/0.1/stream",
            duration: undefined,
            subtitleUrl: undefined,
          },
        ],
      }),
      { resumeWork: true },
    );

    playSessionMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /02 ささやき\.mp3/ }));
    expect(playSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ startIndex: 1, stream: true }),
    );
  });
});

describe("WorkDetailScreen · 双有(本地+远端)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStatuses.mockResolvedValue(STATUS_IN_LIBRARY);
    mockedLibraryWork.mockResolvedValue(LIB);
    mockedDiscoverWork.mockResolvedValue(REMOTE);
    mockedNeighbors.mockResolvedValue({ items: [], page: 1, page_size: 6, total: 0 });
  });

  it("两个文件层级区都渲染,▶ 播放本地优先(stream:false)", async () => {
    renderRoute("/works/RJ1");
    // 标题取远端元数据
    expect(await screen.findByText("遠端の夜")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "本地文件" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "在线音轨" })).toBeInTheDocument();
    expect(screen.queryByText(/在线信息暂时不可用/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "▶ 播放" }));
    expect(playSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workTitle: "遠端の夜",
        stream: false,
        tracks: expect.arrayContaining([
          expect.objectContaining({ url: "/media/RJ1/SE/01.mp3" }),
        ]),
      }),
      { resumeWork: true },
    );
  });
});

describe("WorkDetailScreen · 全失败", () => {
  it("本地/远端都不可用 → EmptyState + 返回媒体库链接", async () => {
    vi.clearAllMocks();
    mockedStatuses.mockResolvedValue(STATUS_NONE);
    mockedDiscoverWork.mockRejectedValue(new Error("boom"));
    renderRoute("/works/RJ404");
    expect(await screen.findByText(/作品不存在或暂时不可用/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回媒体库" })).toHaveAttribute("href", "/library");
  });
});
