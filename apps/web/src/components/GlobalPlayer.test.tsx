import { forwardRef, useImperativeHandle, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/AudioDeck", () => ({
  AudioDeck: forwardRef(function MockAudioDeck(props: { mediaId: string; selectedPath: string }, ref) {
    useImperativeHandle(ref, () => ({ playTrack: vi.fn(), pause: vi.fn() }));
    return <div data-testid="global-audio-deck">{props.mediaId}:{props.selectedPath}</div>;
  }),
}));

import { GlobalPlayerProvider, useGlobalPlayer } from "./GlobalPlayer";

afterEach(cleanup);

function Harness() {
  const [page, setPage] = useState("discover");
  const player = useGlobalPlayer();
  return (
    <div>
      <div>{page}</div>
      <button onClick={() => player.play({
        mediaId: "RJ123456",
        title: "Sample",
        tracks: [{ path: "track-1", name: "Track", kind: "audio", url: "/track.mp3" }],
      })}>播放</button>
      <button onClick={() => setPage("library")}>切换页面</button>
    </div>
  );
}

describe("GlobalPlayerProvider", () => {
  it("keeps the active session when route content changes", () => {
    render(<GlobalPlayerProvider><Harness /></GlobalPlayerProvider>);
    fireEvent.click(screen.getByRole("button", { name: "播放" }));
    expect(screen.getByTestId("global-audio-deck")).toHaveTextContent("RJ123456:track-1");
    fireEvent.click(screen.getByRole("button", { name: "切换页面" }));
    expect(screen.getByText("library")).toBeInTheDocument();
    expect(screen.getByTestId("global-audio-deck")).toHaveTextContent("RJ123456:track-1");
  });
});
