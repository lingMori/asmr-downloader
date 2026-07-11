import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AudioDeck } from "./AudioDeck";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AudioDeck seeking", () => {
  it("commits only the final position after a pointer drag", () => {
    const { container } = render(
      <AudioDeck
        tracks={[{
          path: "data7.wav",
          name: "data7.wav",
          kind: "audio",
          url: "/api/discover/RJ01593625/tracks/6/stream",
        }]}
        selectedPath="data7.wav"
        onSelect={vi.fn()}
        title="Test work"
        mediaId="RJ01593625"
      />,
    );
    const audio = container.querySelector("audio");
    if (!audio) {
      throw new Error("audio element was not rendered");
    }

    const committedTimes: number[] = [];
    let currentTime = 12;
    Object.defineProperty(audio, "duration", {
      configurable: true,
      get: () => 300,
    });
    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
        committedTimes.push(value);
      },
    });
    fireEvent.durationChange(audio);
    fireEvent.timeUpdate(audio);

    const seek = screen.getByRole("slider", { name: "播放进度" });
    fireEvent.pointerDown(seek, { pointerId: 1 });
    fireEvent.change(seek, { target: { value: "60" } });
    fireEvent.change(seek, { target: { value: "120" } });

    expect(committedTimes).toEqual([]);
    expect(seek).toHaveValue("120");

    fireEvent.pointerUp(seek, { pointerId: 1 });

    expect(committedTimes).toEqual([120]);
    expect(currentTime).toBe(120);
  });
});
