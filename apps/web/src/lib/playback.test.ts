import { describe, expect, it } from "vitest";

import type { LibraryFile } from "./api";
import { findSubtitleForAudio } from "./playback";

const file = (path: string, kind: LibraryFile["kind"]): LibraryFile => ({
  path,
  name: path,
  kind,
  url: `/api/${encodeURIComponent(path)}`,
});

describe("findSubtitleForAudio", () => {
  it("prefers an exact subtitle in the audio file directory", () => {
    const audio = file("disc-b/track.wav", "audio");
    const wrong = file("disc-a/track.lrc", "subtitle");
    const right = file("disc-b/track.wav.vtt", "subtitle");

    expect(findSubtitleForAudio([wrong, right], audio)).toBe(right);
  });

  it("matches normalized punctuation but never filename prefixes", () => {
    const audio = file("main/#01 - Greeting.wav", "audio");
    const normalized = file("main/01 Greeting.srt", "subtitle");
    const prefixOnly = file("main/#01 - Greeting extended.srt", "subtitle");

    expect(findSubtitleForAudio([prefixOnly, normalized], audio)).toBe(normalized);
    expect(findSubtitleForAudio([prefixOnly], audio)).toBeUndefined();
  });
});
