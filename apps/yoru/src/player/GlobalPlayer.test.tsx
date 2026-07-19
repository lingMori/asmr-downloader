import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Toaster } from "sonner";
import { GlobalPlayerProvider, useGlobalPlayer } from "./GlobalPlayer";
import { PlayerBar } from "./PlayerBar";
import { ExpandedPlayer } from "./ExpandedPlayer";
import type { PlaybackSession } from "./types";

vi.mock("@/lib/api", () => ({
  apiClient: {
    getPlaybackProgress: vi.fn(),
    savePlaybackProgress: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api";

const mockedProgress = vi.mocked(apiClient.getPlaybackProgress);
const mockedSave = vi.mocked(apiClient.savePlaybackProgress);

const SESSION: PlaybackSession = {
  sourceId: "RJ1234",
  workTitle: "ねむりの森の耳かき",
  tracks: [
    { id: "1", title: "Track 1", url: "/api/discover/works/RJ1234/tracks/1/stream" },
    { id: "2", title: "Track 2", url: "/api/discover/works/RJ1234/tracks/2/stream" },
  ],
  startIndex: 0,
  stream: true,
  cv: "涼花",
  rj: "RJ1234",
};

function StartButton({ session = SESSION }: { session?: PlaybackSession }) {
  const { playSession } = useGlobalPlayer();
  return (
    <button type="button" onClick={() => playSession(session)}>
      start
    </button>
  );
}

function renderPlayer(children: React.ReactNode) {
  return render(
    <GlobalPlayerProvider>
      {children}
      <PlayerBar />
      <ExpandedPlayer />
      <Toaster />
    </GlobalPlayerProvider>,
  );
}

describe("GlobalPlayer + PlayerBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 404 = 无历史进度
    mockedProgress.mockRejectedValue(new Error("404"));
    mockedSave.mockResolvedValue({ saved: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("无会话时不渲染播放条", () => {
    renderPlayer(<div />);
    expect(screen.queryByTestId("playerbar-desktop")).toBeNull();
    expect(screen.queryByTestId("playerbar-compact")).toBeNull();
  });

  it("playSession 后显示标题/Track 1/串流徽章,上下曲钳制+边界 toast", async () => {
    renderPlayer(<StartButton />);
    fireEvent.click(screen.getByText("start"));

    expect(await screen.findAllByText(/ねむりの森の耳かき · Track 1/)).not.toHaveLength(0);
    expect(screen.getAllByText("在线").length).toBeGreaterThan(0);

    // 首曲再上一首 → 钳制 + toast
    fireEvent.click(screen.getByRole("button", { name: "上一首" }));
    expect(await screen.findByText("已经是第一首")).toBeInTheDocument();
    expect(screen.getAllByText(/Track 1/).length).toBeGreaterThan(0);

    // 下一首 → Track 2;再下一首 → 钳制 + toast
    fireEvent.click(screen.getByRole("button", { name: "下一首" }));
    expect(await screen.findAllByText(/Track 2/)).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "下一首" }));
    expect(await screen.findByText("已经是最后一首")).toBeInTheDocument();
    expect(screen.getAllByText(/Track 2/).length).toBeGreaterThan(0);
  });

  it("playSession 切换会话时重置到 startIndex", async () => {
    const second: PlaybackSession = {
      ...SESSION,
      sourceId: "RJ9999",
      workTitle: "第二作",
      startIndex: 1,
    };
    function Both() {
      const { playSession } = useGlobalPlayer();
      return (
        <>
          <button onClick={() => playSession(SESSION)}>s1</button>
          <button onClick={() => playSession(second)}>s2</button>
        </>
      );
    }
    renderPlayer(<Both />);
    fireEvent.click(screen.getByText("s1"));
    fireEvent.click(screen.getByRole("button", { name: "下一首" }));
    fireEvent.click(screen.getByText("s2"));
    expect(await screen.findAllByText(/第二作 · Track 2/)).not.toHaveLength(0);
  });

  it("显式选轨优先于历史进度:不被强制切回上次曲目", async () => {
    // 历史进度录的是 Track 2;用户显式 startIndex=0 点播,必须播 Track 1
    mockedProgress.mockResolvedValue({
      source_id: "RJ1234",
      work_title: "ねむりの森の耳かき",
      cover_url: "",
      track_path: "/api/discover/works/RJ1234/tracks/2/stream",
      track_title: "Track 2",
      position: 120,
      duration: 300,
      updated_at: "2024-01-01T00:00:00Z",
    });
    renderPlayer(<StartButton />);
    fireEvent.click(screen.getByText("start"));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockedProgress).not.toHaveBeenCalled();
    expect(screen.getAllByText(/ねむりの森の耳かき · Track 1/).length).toBeGreaterThan(0);
  });

  it("resumeWork=true 才按历史进度续播(切到记录的曲目)", async () => {
    mockedProgress.mockResolvedValue({
      source_id: "RJ1234",
      work_title: "ねむりの森の耳かき",
      cover_url: "",
      track_path: "/api/discover/works/RJ1234/tracks/2/stream",
      track_title: "Track 2",
      position: 120,
      duration: 300,
      updated_at: "2024-01-01T00:00:00Z",
    });
    function ResumeButton() {
      const { playSession } = useGlobalPlayer();
      return <button onClick={() => playSession(SESSION, { resumeWork: true })}>r</button>;
    }
    renderPlayer(<ResumeButton />);
    fireEvent.click(screen.getByText("r"));
    expect(await screen.findAllByText(/ねむりの森の耳かき · Track 2/)).not.toHaveLength(0);
  });

  it("停靠字幕行:随时间轴切换当前句,点击展开播放器", async () => {
    const lrc = "[00:01.00] こんばんは\n[00:05.00] おやすみなさい\n";
    const fetchMock = vi.fn().mockResolvedValue(new Response(lrc, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const session: PlaybackSession = {
      ...SESSION,
      tracks: [
        {
          id: "1",
          title: "Track 1",
          url: "/api/discover/works/RJ1234/tracks/1/stream",
          subtitleUrl: "/media/RJ1234/01.lrc",
        },
      ],
    };
    renderPlayer(<StartButton session={session} />);
    fireEvent.click(screen.getByText("start"));

    const audio = document.querySelector("audio")!;
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // 时间 1.5s → 第一句;6s → 第二句(桌面/移动两条停靠行都会渲染)
    audio.currentTime = 1.5;
    fireEvent(audio, new Event("timeupdate"));
    expect(await screen.findAllByText("こんばんは")).not.toHaveLength(0);
    audio.currentTime = 6;
    fireEvent(audio, new Event("timeupdate"));
    expect(await screen.findAllByText("おやすみなさい")).not.toHaveLength(0);

    // 点击停靠行 → 展开播放器(字幕卡列出全部两句)
    fireEvent.click(screen.getAllByTestId("playerbar-cue")[0]);
    expect(await screen.findByRole("dialog", { name: "播放器" })).toBeInTheDocument();
    expect(screen.getAllByText("こんばんは").length).toBeGreaterThan(0);
  });
});
