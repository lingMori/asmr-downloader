import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Toaster } from "sonner";
import { GlobalPlayerProvider, useGlobalPlayer } from "./GlobalPlayer";
import { PlayerBar } from "./PlayerBar";
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
});
