import { describe, expect, it } from "vitest";
import type { SubtitleCue } from "@/lib/subtitles";
import {
  activeCueIndex,
  clampIndex,
  findTrackIndexByUrl,
  formatTime,
  nextIndex,
  prevIndex,
  shouldPersistPosition,
  shouldResume,
  shouldSendFeedback,
} from "./logic";
import type { PlaybackSession, PlayerTrack } from "./types";

const tracks = (n: number): PlayerTrack[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    title: `Track ${i + 1}`,
    url: `/media/t${i}.mp3`,
  }));

describe("track 索引钳制", () => {
  it("clampIndex 收敛越界输入", () => {
    expect(clampIndex(0, 3)).toBe(0);
    expect(clampIndex(2, 3)).toBe(2);
    expect(clampIndex(99, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(5, 0)).toBe(0);
  });

  it("prev 在首曲顶到边界", () => {
    expect(prevIndex(0, 3)).toEqual({ index: 0, atBoundary: true });
    expect(prevIndex(2, 3)).toEqual({ index: 1, atBoundary: false });
    expect(prevIndex(1, 1)).toEqual({ index: 0, atBoundary: true });
  });

  it("next 在末曲顶到边界", () => {
    expect(nextIndex(2, 3)).toEqual({ index: 2, atBoundary: true });
    expect(nextIndex(0, 3)).toEqual({ index: 1, atBoundary: false });
    expect(nextIndex(0, 1)).toEqual({ index: 0, atBoundary: true });
  });
});

describe("findTrackIndexByUrl(session 续播对轨)", () => {
  it("命中返回索引,未命中 -1", () => {
    const list = tracks(3);
    expect(findTrackIndexByUrl(list, "/media/t1.mp3")).toBe(1);
    expect(findTrackIndexByUrl(list, "/media/nope.mp3")).toBe(-1);
    expect(findTrackIndexByUrl(list, "")).toBe(-1);
  });
});

describe("activeCueIndex(字幕当前行)", () => {
  const cues: SubtitleCue[] = [
    { start: 0, end: 4, text: "一" },
    { start: 4, end: 9.5, text: "二" },
    { start: 12, end: 15, text: "三" },
  ];

  it("按 currentTime 选行,间隙与越界为 -1", () => {
    expect(activeCueIndex(cues, 0)).toBe(0);
    expect(activeCueIndex(cues, 3.99)).toBe(0);
    expect(activeCueIndex(cues, 4)).toBe(1);
    expect(activeCueIndex(cues, 10)).toBe(-1); // cue 间隙
    expect(activeCueIndex(cues, 14.99)).toBe(2);
    expect(activeCueIndex(cues, 15)).toBe(-1);
    expect(activeCueIndex([], 5)).toBe(-1);
  });
});

describe("会话门槛", () => {
  const base: PlaybackSession = {
    workTitle: "w",
    tracks: tracks(2),
    startIndex: 0,
    stream: false,
  };

  it("feedback 仅远端串流会话", () => {
    expect(shouldSendFeedback({ ...base, stream: true, sourceId: "RJ1" })).toBe(true);
    expect(shouldSendFeedback({ ...base, stream: true })).toBe(false);
    expect(shouldSendFeedback({ ...base, sourceId: "L1" })).toBe(false);
    expect(shouldSendFeedback(null)).toBe(false);
  });

  it("持久化需要 sourceId 且 position > 5s", () => {
    const local = { ...base, sourceId: "L1" };
    expect(shouldPersistPosition(local, 6)).toBe(true);
    expect(shouldPersistPosition(local, 5)).toBe(false);
    expect(shouldPersistPosition(local, Number.NaN)).toBe(false);
    expect(shouldPersistPosition(base, 60)).toBe(false);
    expect(shouldPersistPosition(null, 60)).toBe(false);
  });

  it("resume 同样需要 position > 5s", () => {
    expect(shouldResume(5.1)).toBe(true);
    expect(shouldResume(5)).toBe(false);
    expect(shouldResume(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("formatTime", () => {
  it("m:ss 与 h:mm:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3599)).toBe("59:59");
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3661.9)).toBe("1:01:01");
    expect(formatTime(-1)).toBe("--:--");
    expect(formatTime(Number.NaN)).toBe("--:--");
  });
});
